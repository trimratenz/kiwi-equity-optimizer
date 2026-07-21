import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");

for (const tab of ["Lead Summary", "Lead Loan Parts", "Activity Summary", "Activity Loan Parts"]) {
  assert.match(source, new RegExp(`'${tab}'`), `${tab} is created by the safe setup function`);
}
for (const headerSet of ["LEAD_SUMMARY_HEADERS", "LEAD_LOAN_PART_HEADERS", "ACTIVITY_SUMMARY_HEADERS", "ACTIVITY_LOAN_PART_HEADERS"]) {
  assert.match(source, new RegExp(headerSet), `${headerSet} defines explicit flattened columns`);
}
assert.match(source, /function loanPartRows/, "nested loan parts are flattened into one row per tranche");
assert.match(source, /function scalarValues/, "scalar inputs and outputs are flattened into individual columns");
assert.match(source, /function upsertHumanRow/, "flattened rows use stable-ID upserts");
assert.match(source, /createTextFinder\(String\(key\)\)/, "duplicate flattened keys are detected before a row is appended");
assert.match(source, /function backfillFlattenedTabs/, "an idempotent backfill entry point exists");
assert.match(source, /backfillLeads\(book\)/, "backfill reads raw Leads");
assert.match(source, /backfillActivity\(book\)/, "backfill reads raw Activity");
assert.match(source, /function removePersonalData/, "activity flattening retains the no-PII guard");
assert.doesNotMatch(source.match(/const ACTIVITY_SUMMARY_HEADERS = \[[^;]+/s)?.[0] || "", /'(?:Name|Email|Phone|Property Address)'/, "Activity Summary does not define direct-contact columns");

console.log("Google Sheets flattening test passed");
