import { createHash, randomUUID } from "node:crypto";
import { LEAD_CONSENT_TEXT } from "../src/privacy.js";

export const TRACKED_EVENTS = new Set([
  "page_view",
  "calculator_started",
  "step_1_completed",
  "step_2_completed",
  "step_3_viewed",
  "step_4_viewed",
  "step_5_viewed",
  "step_6_completed",
  "summary_viewed",
  "summary_exported",
  "lead_form_started",
  "consent_checked",
  "lead_submitted",
  "lead_submit_failed",
  "reset_clicked"
]);

const STEP_EVENT_MAP = {
  step_1_completed: 1,
  step_2_completed: 2,
  step_3_viewed: 3,
  step_4_viewed: 4,
  step_5_viewed: 5,
  step_6_completed: 6
};

export function createLeadRateLimiter({ limit = 5, windowMs = 60 * 60 * 1000 } = {}) {
  const buckets = new Map();

  return {
    check(key, nowMs = Date.now()) {
      const bucket = buckets.get(key) || [];
      const recent = bucket.filter((timestamp) => nowMs - timestamp < windowMs);
      if (recent.length >= limit) {
        buckets.set(key, recent);
        return false;
      }
      recent.push(nowMs);
      buckets.set(key, recent);
      return true;
    },
    reset() {
      buckets.clear();
    }
  };
}

export async function trackEvent({ store, body = {}, meta = {} }) {
  const eventName = body.eventName;
  if (!TRACKED_EVENTS.has(eventName)) {
    return { status: 400, body: { error: "Unsupported event." } };
  }

  const context = await ensureVisitorSession({ store, body, meta });
  const createdAt = body.createdAt || new Date().toISOString();
  const event = await store.insert("events", {
    visitorId: context.visitor.id,
    sessionId: context.session.id,
    eventName,
    payload: safeObject(body.payload),
    path: cleanString(body.path),
    referrer: cleanString(body.referrer || meta.referrer),
    utmSource: cleanString(body.utmSource),
    utmMedium: cleanString(body.utmMedium),
    utmCampaign: cleanString(body.utmCampaign),
    createdAt
  });

  const stepNumber = STEP_EVENT_MAP[eventName];
  if (stepNumber) {
    await recordStepCompletion({
      store,
      visitorId: context.visitor.id,
      sessionId: context.session.id,
      stepNumber,
      eventName,
      createdAt
    });
  }

  return {
    status: 201,
    body: {
      ok: true,
      visitorId: context.visitor.id,
      sessionId: context.session.id,
      eventId: event.id
    }
  };
}

export async function recordCalculatorRun({ store, body = {}, meta = {} }) {
  const context = await ensureVisitorSession({ store, body, meta });
  const summaryPayload = safeObject(body.summaryPayload);
  const inputs = safeObject(summaryPayload.inputs);
  const outputs = safeObject(summaryPayload.outputs);
  const refixScenario = safeObject(summaryPayload.refixScenario);
  const createdAt = body.createdAt || new Date().toISOString();

  await upsertSnapshotStubs({ store, summaryPayload, createdAt });

  const run = await store.insert("calculator_runs", {
    visitorId: context.visitor.id,
    sessionId: context.session.id,
    inputsJson: inputs,
    outputsJson: outputs,
    summaryJson: summaryPayload,
    ratesSnapshotId: cleanString(summaryPayload.ratesSnapshotId),
    ocrSnapshotId: cleanString(summaryPayload.ocrSnapshotId),
    calculationVersion: cleanString(summaryPayload.calculationEngineVersion),
    loanBalance: Number(inputs.loanBalance) || 0,
    dtiEstimate: Number(outputs.dtiEstimate) || 0,
    currentMonthlyRepayment: Number(outputs.currentMonthlyRepayment) || 0,
    cashAfterRepaymentMonthly: Number(outputs.cashAfterRepaymentMonthly) || 0,
    refixTimeframe: cleanString(refixScenario.refixPointLabel || refixScenario.selectedTermLabel),
    createdAt
  });

  return { status: 201, body: { ok: true, calculatorRunId: run.id } };
}

export async function submitLead({ store, body = {}, meta = {}, rateLimiter = createLeadRateLimiter() }) {
  const honeypot = cleanString(body.website);
  const contact = safeObject(body.contact);
  const consent = safeObject(body.consent);
  const summaryPayload = safeObject(body.summaryPayload);
  const clientKey = `${meta.ipHash || "unknown"}:${String(contact.email || "").toLowerCase()}`;

  if (honeypot) {
    await trackFailedLead({ store, body, meta, reason: "spam_field" });
    return { status: 202, body: { ok: true } };
  }

  if (!rateLimiter.check(clientKey)) {
    await trackFailedLead({ store, body, meta, reason: "rate_limited" });
    return { status: 429, body: { error: "Too many lead submissions. Try again later." } };
  }

  const validationError = validateLead({ contact, consent, summaryPayload });
  if (validationError) {
    await trackFailedLead({ store, body, meta, reason: validationError });
    return { status: 400, body: { error: validationError } };
  }

  const context = await ensureVisitorSession({ store, body, meta });
  const consentTimestamp = cleanString(consent.consentTimestamp || consent.submittedAt || new Date().toISOString());
  const createdAt = body.createdAt || new Date().toISOString();

  await upsertSnapshotStubs({ store, summaryPayload, createdAt });
  await recordCalculatorRun({ store, body: { ...body, summaryPayload, createdAt }, meta });

  const lead = await store.insert("leads", {
    visitorId: context.visitor.id,
    sessionId: context.session.id,
    name: cleanString(contact.name),
    email: cleanString(contact.email).toLowerCase(),
    phone: cleanString(contact.phone),
    propertyAddress: cleanString(contact.propertyAddress),
    currentBank: cleanString(contact.currentBank),
    consentText: cleanString(consent.consentText),
    consentTimestamp,
    inputsJson: safeObject(summaryPayload.inputs),
    outputsJson: safeObject(summaryPayload.outputs),
    summaryJson: summaryPayload,
    ratesSnapshotId: cleanString(summaryPayload.ratesSnapshotId),
    ocrSnapshotId: cleanString(summaryPayload.ocrSnapshotId),
    calculationVersion: cleanString(summaryPayload.calculationEngineVersion),
    utmSource: cleanString(body.utmSource),
    utmMedium: cleanString(body.utmMedium),
    utmCampaign: cleanString(body.utmCampaign),
    referrer: cleanString(body.referrer || meta.referrer),
    createdAt
  });

  await trackEvent({
    store,
    body: {
      ...body,
      eventName: "lead_submitted",
      payload: { leadId: lead.id },
      createdAt
    },
    meta
  });

  return { status: 201, body: { ok: true, leadId: lead.id } };
}

export async function adminMetrics(store) {
  const [visitors, sessions, events, stepCompletions, calculatorRuns, leads] = await Promise.all([
    store.all("visitors"),
    store.all("sessions"),
    store.all("events"),
    store.all("step_completions"),
    store.all("calculator_runs"),
    store.all("leads")
  ]);
  const eventCount = (eventName) => events.filter((event) => event.eventName === eventName).length;
  const calculatorStarts = eventCount("calculator_started");
  const totalViews = eventCount("page_view");
  const stepCounts = [1, 2, 3, 4, 5, 6].map((step) => ({
    step,
    completions: uniqueCount(stepCompletions.filter((row) => row.stepNumber === step).map((row) => row.sessionId))
  }));

  return {
    totalViews,
    uniqueVisitors: visitors.length,
    sessions: sessions.length,
    calculatorStarts,
    completionRateByStep: stepCounts.map((row) => ({
      ...row,
      rate: calculatorStarts > 0 ? row.completions / calculatorStarts : 0
    })),
    dropOffByStep: stepCounts.map((row, index) => {
      const previous = index === 0 ? calculatorStarts : stepCounts[index - 1].completions;
      return {
        step: row.step,
        dropOff: Math.max(previous - row.completions, 0),
        rate: previous > 0 ? Math.max(previous - row.completions, 0) / previous : 0
      };
    }),
    summaryViews: eventCount("summary_viewed"),
    leadFormStarts: eventCount("lead_form_started"),
    leadSubmissions: leads.length,
    leadConversionRate: calculatorStarts > 0 ? leads.length / calculatorStarts : 0,
    averageLoanBalance: average(calculatorRuns.map((run) => run.loanBalance)),
    averageDti: average(calculatorRuns.map((run) => run.dtiEstimate)),
    averageMonthlyRepayment: average(calculatorRuns.map((run) => run.currentMonthlyRepayment)),
    averageCashAfterRepayment: average(calculatorRuns.map((run) => run.cashAfterRepaymentMonthly)),
    mostCommonCurrentBanks: topCounts(leads.map((lead) => lead.currentBank).filter(Boolean)),
    mostCommonRefixTimeframes: topCounts(calculatorRuns.map((run) => run.refixTimeframe).filter(Boolean))
  };
}

export async function adminLeadRows(store, { search = "", currentBank = "" } = {}) {
  const leads = await store.all("leads");
  const needle = search.trim().toLowerCase();
  const bank = currentBank.trim().toLowerCase();

  return leads
    .filter((lead) => {
      const bankMatches = !bank || String(lead.currentBank).toLowerCase() === bank;
      const searchMatches =
        !needle ||
        [lead.name, lead.email, lead.phone, lead.propertyAddress, lead.currentBank]
          .map((item) => String(item || "").toLowerCase())
          .some((item) => item.includes(needle));
      return bankMatches && searchMatches;
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function leadCsvExport(store, filters = {}) {
  const rows = await adminLeadRows(store, filters);
  const headers = [
    "createdAt",
    "name",
    "email",
    "phone",
    "propertyAddress",
    "currentBank",
    "consentTimestamp",
    "ratesSnapshotId",
    "ocrSnapshotId",
    "calculationVersion",
    "utmSource",
    "utmMedium",
    "utmCampaign",
    "referrer"
  ];
  const csv = [headers.join(",")]
    .concat(rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")))
    .join("\n");

  await store.insert("lead_exports", {
    filters,
    rowCount: rows.length,
    createdAt: new Date().toISOString()
  });

  return `${csv}\n`;
}

async function ensureVisitorSession({ store, body = {}, meta = {} }) {
  const visitorId = cleanString(body.visitorId) || `visitor_${randomUUID()}`;
  const sessionId = cleanString(body.sessionId) || `session_${randomUUID()}`;
  const now = new Date().toISOString();
  const utm = {
    utmSource: cleanString(body.utmSource),
    utmMedium: cleanString(body.utmMedium),
    utmCampaign: cleanString(body.utmCampaign)
  };

  const visitor = await store.upsert(
    "visitors",
    (row) => row.id === visitorId,
    (existing) => ({
      id: visitorId,
      firstSeenAt: existing?.firstSeenAt || now,
      lastSeenAt: now,
      userAgent: cleanString(meta.userAgent),
      ipHash: meta.ipHash || "",
      ...utm
    })
  );
  const session = await store.upsert(
    "sessions",
    (row) => row.id === sessionId,
    (existing) => ({
      id: sessionId,
      visitorId,
      startedAt: existing?.startedAt || now,
      lastSeenAt: now,
      referrer: cleanString(body.referrer || meta.referrer),
      ...utm
    })
  );

  return { visitor, session };
}

async function recordStepCompletion({ store, visitorId, sessionId, stepNumber, eventName, createdAt }) {
  const existing = (await store.all("step_completions")).find(
    (row) => row.sessionId === sessionId && row.stepNumber === stepNumber
  );
  if (existing) return existing;

  return store.insert("step_completions", {
    visitorId,
    sessionId,
    stepNumber,
    eventName,
    createdAt
  });
}

async function trackFailedLead({ store, body, meta, reason }) {
  await trackEvent({
    store,
    body: {
      ...body,
      eventName: "lead_submit_failed",
      payload: { reason },
      createdAt: new Date().toISOString()
    },
    meta
  });
}

async function upsertSnapshotStubs({ store, summaryPayload, createdAt }) {
  const ratesSnapshotId = cleanString(summaryPayload.ratesSnapshotId);
  const ocrSnapshotId = cleanString(summaryPayload.ocrSnapshotId);

  if (ratesSnapshotId) {
    await store.upsert(
      "rate_snapshots",
      (row) => row.id === ratesSnapshotId,
      () => ({
        id: ratesSnapshotId,
        source: "client-calculator-summary",
        capturedAt: createdAt
      })
    );
  }

  if (ocrSnapshotId) {
    await store.upsert(
      "ocr_snapshots",
      (row) => row.id === ocrSnapshotId,
      () => ({
        id: ocrSnapshotId,
        source: "client-calculator-summary",
        capturedAt: createdAt
      })
    );
  }
}

function validateLead({ contact, consent, summaryPayload }) {
  if (consent.privacyConsent !== true && consent.adviserContactConsent !== true) {
    return "Consent is required before lead details can be submitted.";
  }
  if (cleanString(consent.consentText) !== LEAD_CONSENT_TEXT) {
    return "Consent text is missing or does not match the submitted consent.";
  }
  if (!cleanString(consent.consentTimestamp)) return "Consent timestamp is required.";
  if (!cleanString(contact.name)) return "Name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanString(contact.email))) return "Valid email is required.";
  if (cleanString(contact.phone).replace(/\D/g, "").length < 7) return "Valid phone is required.";
  if (!cleanString(contact.propertyAddress)) return "Property address is required.";
  if (!cleanString(contact.currentBank)) return "Current bank is required.";
  if (!summaryPayload || Object.keys(summaryPayload).length === 0) return "Calculator summary is required.";
  return "";
}

export function requestMeta(request) {
  const forwarded = request.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || request.socket?.remoteAddress || "");
  return {
    ipHash: hashValue(ip.split(",")[0].trim()),
    userAgent: request.headers["user-agent"] || "",
    referrer: request.headers.referer || request.headers.referrer || ""
  };
}

function hashValue(value) {
  return value ? createHash("sha256").update(value).digest("hex") : "";
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanString(value) {
  return String(value || "").trim().slice(0, 2000);
}

function uniqueCount(values) {
  return new Set(values.filter(Boolean)).size;
}

function average(values) {
  const numbers = values.map(Number).filter(Number.isFinite);
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function topCounts(values, limit = 5) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function csvCell(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}
