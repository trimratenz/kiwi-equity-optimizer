import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path) { return readFileSync(new URL(path, import.meta.url), "utf8"); }

const adviser = source("../api/public.js");
assert.match(adviser, /consentGiven/, "adviser endpoint requires consent");
assert.match(adviser, /rateLimit\(request\)/, "adviser endpoint is rate limited");
assert.match(adviser, /website/, "adviser endpoint has a spam honeypot");

const analytics = adviser;
assert.match(analytics, /appendAnalyticsEvent/, "analytics endpoint writes anonymous events to Google Sheets");
assert.match(analytics, /sessionId/, "analytics endpoint requires an anonymous session ID");

const storage = source("../serverless/core.js");
assert.match(storage, /GOOGLE_SHEETS_WEBHOOK_URL/, "Google Sheets webhook URL is configured server-side");
assert.match(storage, /createHmac/, "Google Sheets requests are signed");
assert.match(storage, /appendLead/, "lead requests are sent to Google Sheets");

const script = source("../google-apps-script/Code.gs");
assert.match(script, /function doPost/, "Apps Script exposes a POST receiver");
assert.match(script, /function doGet/, "Apps Script provides a no-write health check");
assert.match(script, /editor Run button/, "Apps Script handles manual editor runs safely");
assert.match(script, /computeHmacSha256Signature/, "Apps Script verifies request signatures");

const client = source("../src/analyticsClient.js");
assert.match(client, /\/api\/analytics\/event/, "frontend sends analytics to the production endpoint");
assert.match(client, /safeAnalyticsMetadata/, "frontend strips sensitive analytics metadata");
assert.match(client, /\/api\/adviser-review-request/, "frontend sends adviser requests to the production endpoint");

const cron = source("../api/cron.js");
assert.match(cron, /requireCron/, "cron endpoint checks CRON_SECRET");
assert.doesNotMatch(cron, /query\.secret/, "cron endpoint does not accept secrets in URLs");
const admin = source("../api/admin.js");
assert.match(admin, /isAdmin\(request\)/, "admin dashboard API requires authentication");
const config = source("../vercel.json");
assert.match(config, /refresh-market-rates/, "Vercel cron is configured");
assert.match(config, /maxDuration/, "refresh function has enough time for the provider health check");
assert.match(config, /api\/public/, "public API routes are consolidated");
assert.doesNotMatch(config, /market-rates\/latest/, "legacy Supabase market-rate endpoint is removed");
assert.doesNotMatch(config, /ocr-snapshot\/latest/, "legacy Supabase OCR endpoint is removed");
assert.doesNotMatch(storage, /SUPABASE_SERVICE_ROLE_KEY/, "runtime no longer requires Supabase");

console.log("Vercel API contract test passed");
