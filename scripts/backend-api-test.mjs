import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTrimRateServer } from "../server/index.mjs";
import { createLeadRateLimiter, TRACKED_EVENTS } from "../server/analytics.mjs";
import { createDataStore, COLLECTIONS } from "../server/storage.mjs";
import { LEAD_CONSENT_TEXT } from "../src/privacy.js";

const dataDir = await mkdtemp(join(tmpdir(), "trimrate-backend-test-"));
const store = createDataStore({ dataDir });
await store.init();

const server = createTrimRateServer({
  store,
  adminToken: "test-admin-token",
  rateLimiter: createLeadRateLimiter({ limit: 20, windowMs: 60_000 })
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

try {
  for (const collection of COLLECTIONS) {
    assert.ok(Array.isArray(await store.all(collection)), `${collection} collection exists`);
  }

  for (const eventName of ["page_view", "calculator_started", "step_1_completed", "step_2_completed"]) {
    const response = await post("/api/events", eventPayload(eventName));
    assert.equal(response.status, 201, `${eventName} tracked`);
  }

  const events = await store.all("events");
  const completions = await store.all("step_completions");
  assert.equal(events.length, 4, "event tracking stores events");
  assert.equal(completions.length, 2, "step completion table stores completed steps once");
  assert.ok(TRACKED_EVENTS.has("lead_submitted"), "lead_submitted is a tracked event");

  const calculatorRun = await post("/api/calculator-runs", {
    ...visitorContext(),
    summaryPayload: summaryPayload()
  });
  assert.equal(calculatorRun.status, 201, "calculator run stored");

  const blockedLead = await post("/api/leads", {
    ...visitorContext(),
    contact: contact(),
    consent: {
      privacyConsent: false,
      adviserContactConsent: false,
      consentText: "",
      consentTimestamp: ""
    },
    summaryPayload: summaryPayload()
  });
  assert.equal(blockedLead.status, 400, "lead submission without consent is blocked");
  assert.equal((await store.all("leads")).length, 0, "blocked lead is not stored");

  const submittedLead = await post("/api/leads", {
    ...visitorContext(),
    contact: contact(),
    consent: consent(),
    summaryPayload: summaryPayload()
  });
  assert.equal(submittedLead.status, 201, "lead submission with consent succeeds");
  const leadRows = await store.all("leads");
  assert.equal(leadRows.length, 1, "consented lead is stored");
  assert.equal(leadRows[0].consentText, LEAD_CONSENT_TEXT, "exact consent text is stored");
  assert.equal(leadRows[0].consentTimestamp, "2026-07-07T00:00:00.000Z", "consent timestamp is stored");
  assert.equal(leadRows[0].email, "alex@example.nz", "lead contact details are stored");
  assert.equal(leadRows[0].ratesSnapshotId, "bank-rates-test", "rate snapshot id is stored");
  assert.equal(leadRows[0].ocrSnapshotId, "ocr-test", "OCR snapshot id is stored");

  const publicLeadRead = await get("/api/leads");
  assert.equal(publicLeadRead.status, 404, "public API does not expose lead list");
  assert.equal(JSON.stringify(publicLeadRead.body).includes("alex@example.nz"), false, "public API response does not leak lead data");

  const unauthorizedAdmin = await get("/api/admin/leads");
  assert.equal(unauthorizedAdmin.status, 401, "admin lead table is authenticated");
  assert.equal(JSON.stringify(unauthorizedAdmin.body).includes("alex@example.nz"), false, "unauthenticated admin response does not leak lead data");

  const metrics = await get("/api/admin/metrics", true);
  assert.equal(metrics.status, 200, "admin metrics route works");
  assert.equal(metrics.body.totalViews, 1, "dashboard aggregation counts page views");
  assert.equal(metrics.body.uniqueVisitors, 1, "dashboard aggregation counts unique visitors");
  assert.equal(metrics.body.calculatorStarts, 1, "dashboard aggregation counts calculator starts");
  assert.equal(metrics.body.leadSubmissions, 1, "dashboard aggregation counts lead submissions");
  assert.equal(metrics.body.completionRateByStep[0].completions, 1, "dashboard aggregation counts step completion");
  assert.equal(metrics.body.dropOffByStep[0].dropOff, 0, "dashboard aggregation calculates drop-off");
  assert.equal(Math.round(metrics.body.averageLoanBalance), 750000, "dashboard aggregation calculates average loan balance");
  assert.equal(Number(metrics.body.averageDti.toFixed(2)), 5.5, "dashboard aggregation calculates average DTI");
  assert.equal(metrics.body.mostCommonCurrentBanks[0].label, "ANZ", "dashboard aggregation counts common banks");
  assert.equal(metrics.body.mostCommonRefixTimeframes[0].label, "6 mo", "dashboard aggregation counts re-fix timeframes");

  const adminLeads = await get("/api/admin/leads?search=alex", true);
  assert.equal(adminLeads.status, 200, "admin lead table supports search");
  assert.equal(adminLeads.body.rows.length, 1, "admin lead table returns matching lead");
  assert.equal(adminLeads.body.rows[0].propertyAddress, "1 Example Street", "admin lead table includes lead details");

  const csv = await getText("/api/admin/leads.csv", true);
  assert.equal(csv.status, 200, "CSV export route works");
  assert.ok(csv.text.includes("alex@example.nz"), "CSV export includes lead email");
  assert.ok(csv.text.startsWith("createdAt,name,email,phone"), "CSV export has headers");
  assert.equal((await store.all("lead_exports")).length, 1, "lead export is recorded");

  console.log("Backend API test passed");
} finally {
  await new Promise((resolve) => server.close(resolve));
  await rm(dataDir, { recursive: true, force: true });
}

function visitorContext() {
  return {
    visitorId: "visitor-test",
    sessionId: "session-test",
    path: "/",
    referrer: "https://example.nz",
    utmSource: "google",
    utmMedium: "cpc",
    utmCampaign: "winter"
  };
}

function eventPayload(eventName) {
  return {
    ...visitorContext(),
    eventName,
    payload: { fixture: true },
    createdAt: "2026-07-07T00:00:00.000Z"
  };
}

function contact() {
  return {
    name: "Alex Example",
    email: "alex@example.nz",
    phone: "0210000000",
    propertyAddress: "1 Example Street",
    currentBank: "ANZ"
  };
}

function consent() {
  return {
    privacyConsent: true,
    adviserContactConsent: true,
    consentText: LEAD_CONSENT_TEXT,
    consentTimestamp: "2026-07-07T00:00:00.000Z"
  };
}

function summaryPayload() {
  return {
    summaryVersion: "trimrate-summary-v1",
    createdAt: "2026-07-07T00:00:00.000Z",
    calculationEngineVersion: "test-calculation-engine",
    ratesSnapshotId: "bank-rates-test",
    ocrSnapshotId: "ocr-test",
    contact: {},
    consent: {},
    inputs: {
      loanBalance: 750000,
      loanParts: [{ id: "part-1", balance: 750000, rate: 5 }]
    },
    outputs: {
      currentMonthlyRepayment: 4200,
      cashAfterRepaymentMonthly: 2800,
      dtiEstimate: 5.5
    },
    marketComparison: { rows: [] },
    refixScenario: {
      selectedLoanPart: 1,
      selectedTermMonths: 12,
      selectedTermLabel: "1 year",
      refixPointLabel: "6 mo"
    },
    visuals: { summaryText: "Plain summary" },
    disclaimer: "Calculator summary only."
  };
}

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

async function get(path, admin = false) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: admin ? { authorization: "Bearer test-admin-token" } : {}
  });
  return { status: response.status, body: await response.json() };
}

async function getText(path, admin = false) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: admin ? { authorization: "Bearer test-admin-token" } : {}
  });
  return { status: response.status, text: await response.text() };
}
