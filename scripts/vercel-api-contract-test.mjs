import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path) { return readFileSync(new URL(path, import.meta.url), "utf8"); }

const migration = source("../supabase/migrations/202607120001_trimrate_mvp.sql");
for (const table of ["market_rates", "market_rate_snapshots", "ocr_snapshots", "adviser_review_requests", "analytics_events"]) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}`), `${table} migration exists`);
}

const adviser = source("../api/adviser-review-request.js");
assert.match(adviser, /consentGiven/, "adviser endpoint requires consent");
assert.match(adviser, /rateLimit\(request\)/, "adviser endpoint is rate limited");
assert.match(adviser, /website/, "adviser endpoint has a spam honeypot");

const analytics = source("../api/analytics/event.js");
assert.match(analytics, /analytics_events/, "analytics endpoint stores anonymous events");
assert.doesNotMatch(analytics, /contact|loan_details/i, "analytics endpoint does not accept contact or loan details");

const client = source("../src/analyticsClient.js");
assert.match(client, /\/api\/analytics\/event/, "frontend sends analytics to the production endpoint");
assert.match(client, /safeAnalyticsMetadata/, "frontend strips sensitive analytics metadata");
assert.match(client, /\/api\/adviser-review-request/, "frontend sends adviser requests to the production endpoint");

const cron = source("../api/cron/refresh-market-rates.js");
assert.match(cron, /requireCron/, "cron endpoint checks CRON_SECRET");
assert.doesNotMatch(cron, /query\.secret/, "cron endpoint does not accept secrets in URLs");
const admin = source("../api/admin/dashboard-summary.js");
assert.match(admin, /requireAdmin/, "admin dashboard API requires authentication");
const config = source("../vercel.json");
assert.match(config, /refresh-market-rates/, "Vercel cron is configured");
assert.match(config, /maxDuration/, "refresh functions have enough time for provider and database work");

console.log("Vercel API contract test passed");
