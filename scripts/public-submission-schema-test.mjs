import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { appendGoogleSheet } from "../serverless/core.js";
import { adviserRequest, buildLeadActivityRecord, buildLeadSheetRecord, validateAdviserRequest } from "../api/public.js";

const validBody = {
  visitor_id: "visitor-test",
  session_id: "session-test",
  submission_id: "lead-test-stable-id",
  page_path: "/calculator",
  referrer: "https://example.nz/article",
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "refix",
  createdAt: "2026-07-21T10:00:00.000Z",
  contact: { name: "Alex Example", email: "alex@example.nz", phone: "021 000 0000", propertyAddress: "1 Example Street", currentBank: "ANZ" },
  consent: { privacyConsent: true, adviserContactConsent: true, consentText: "Consent text", consentTimestamp: "2026-07-21T09:59:00.000Z" },
  summaryPayload: {
    summaryVersion: "trimrate-summary-v1",
    calculationEngineVersion: "test-engine",
    ratesSnapshotId: "rates-test",
    ocrSnapshotId: "ocr-test",
    marketRateSnapshot: { source: "Rates API", captured: "2026-07-21" },
    ocrForecastSnapshot: { source: "RBNZ", publishedAt: "2026-07-01" },
    inputs: { loanBalance: 750000, loanParts: [{ fixedTermMonths: 12, fixedEndsInMonths: 6 }] },
    outputs: { currentMonthlyRepayment: 4200, weightedAverageRate: 5.1 },
    marketComparison: { rows: [{ estimatedMonthlyImpact: -45 }] },
    refixScenario: { estimatedMonthlyImpact: 75 }
  }
};

const validated = validateAdviserRequest(validBody);
assert.equal(validated.error, undefined, "a complete, consented request is valid");
const lead = buildLeadSheetRecord(validBody, validated.contact, validated.consent, validated.summary, "mobile");
assert.equal(lead.visitor_id, "visitor-test");
assert.equal(lead.page_path, "/calculator");
assert.equal(lead.consent_timestamp, "2026-07-21T09:59:00.000Z");
assert.equal(lead.market_rate_snapshot_id, "rates-test");
assert.equal(lead.ocr_forecast_snapshot_id, "ocr-test");
assert.equal(lead.referral_status, "New");
assert.equal(lead.id, "lead-test-stable-id", "a browser submission ID is retained for idempotent Sheets writes");
assert.equal(lead.loan_details.loanBalance, 750000);

const activity = buildLeadActivityRecord(lead, validated.summary);
assert.equal(activity.event_name, "lead_submitted");
assert.equal(activity.activity.inputs.loanBalance, 750000);
assert.equal(activity.activity.outputs.marketComparison.rows[0].estimatedMonthlyImpact, -45);
assert.equal(JSON.stringify(activity).includes("Alex Example"), false, "activity records never include direct contact details");

assert.match(validateAdviserRequest({ ...validBody, consent: { ...validBody.consent, adviserContactConsent: false } }).error, /Consent is required/);
assert.match(validateAdviserRequest({ ...validBody, contact: { ...validBody.contact, email: "not-an-email" } }).error, /valid email/);

const savedLeads = [];
const savedActivity = [];
const request = { method: "POST", body: validBody, headers: { "user-agent": "Mobile Safari", "x-forwarded-for": "203.0.113.1" } };
const successResponse = responseRecorder();
await adviserRequest(request, successResponse, { canPersistPublicData: () => true, rateLimit: () => true, appendLead: async (row) => savedLeads.push(row), appendAnalyticsEvent: async (row) => savedActivity.push(row) });
assert.equal(successResponse.statusCode, 201, "a valid production request is accepted");
assert.equal(savedLeads.length, 1, "a valid production request writes one lead");
assert.equal(savedActivity.length, 1, "a valid production request records anonymous activity");

const missingConsentResponse = responseRecorder();
await adviserRequest({ ...request, body: { ...validBody, consent: { ...validBody.consent, privacyConsent: false } } }, missingConsentResponse, { canPersistPublicData: () => true, rateLimit: () => true });
assert.equal(missingConsentResponse.statusCode, 400, "missing consent is rejected before any write");

const invalidContactResponse = responseRecorder();
await adviserRequest({ ...request, body: { ...validBody, contact: { ...validBody.contact, phone: "12" } } }, invalidContactResponse, { canPersistPublicData: () => true, rateLimit: () => true });
assert.equal(invalidContactResponse.statusCode, 400, "invalid contact details are rejected before any write");

const webhookFailureResponse = responseRecorder();
const originalConsoleError = console.error;
try {
  console.error = () => {};
  await adviserRequest(request, webhookFailureResponse, { canPersistPublicData: () => true, rateLimit: () => true, appendLead: async () => { throw new Error("Google Sheets webhook failed (503)"); } });
} finally {
  console.error = originalConsoleError;
}
assert.equal(webhookFailureResponse.statusCode, 500, "a lead webhook failure returns a safe failure response");
assert.equal(webhookFailureResponse.body.error, "Something went wrong. Please try again.", "webhook details are not exposed to visitors");

const originalFetch = globalThis.fetch;
const originalUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
const originalSecret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;
try {
  process.env.GOOGLE_SHEETS_WEBHOOK_URL = "https://sheet.example.invalid/webhook";
  process.env.GOOGLE_SHEETS_WEBHOOK_SECRET = "test-secret";
  globalThis.fetch = async () => ({ ok: false, status: 503, text: async () => "temporary failure" });
  await assert.rejects(() => appendGoogleSheet("lead", lead), /Google Sheets webhook failed \(503\)/, "a webhook failure is surfaced to the API without exposing it to visitors");
} finally {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.GOOGLE_SHEETS_WEBHOOK_URL; else process.env.GOOGLE_SHEETS_WEBHOOK_URL = originalUrl;
  if (originalSecret === undefined) delete process.env.GOOGLE_SHEETS_WEBHOOK_SECRET; else process.env.GOOGLE_SHEETS_WEBHOOK_SECRET = originalSecret;
}

const appsScript = readFileSync(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
for (const expected of ["LEAD_ADDITIONAL_HEADERS", "ACTIVITY_EVENT_HEADERS", "setupTrimRateWorkbook", "ensureDashboardTemplate", "removePersonalData"]) {
  assert.match(appsScript, new RegExp(expected), `Apps Script includes ${expected}`);
}
assert.match(appsScript, /Activity Events/, "event-level anonymous activity is retained separately from legacy session summaries");

console.log("Public submission schema test passed");

function responseRecorder() {
  return {
    statusCode: 0,
    body: null,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; }
  };
}
