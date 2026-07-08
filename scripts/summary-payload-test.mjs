import assert from "node:assert/strict";
import {
  buildPlainEnglishSummary,
  buildRefixScenarioView,
  summarizeMortgage
} from "../src/financialModel.js";
import { buildSummaryPayload, monthlyEquivalent, SUMMARY_VERSION } from "../src/summaryPayload.js";
import { DEFAULT_OCR_FORECAST_SNAPSHOT } from "../src/snapshotLayer.js";

const tranches = [
  {
    id: "part-1",
    index: 1,
    amount: 500000,
    originalBalance: 500000,
    rate: 4.5,
    termYears: 30,
    type: "Fixed",
    frequency: "Monthly",
    fixedTermMonths: 12,
    fixedMonths: 6
  },
  {
    id: "part-2",
    index: 2,
    amount: 500000,
    originalBalance: 500000,
    rate: 5,
    termYears: 30,
    type: "Fixed",
    frequency: "Monthly",
    fixedTermMonths: 24,
    fixedMonths: 18
  }
];

const summary = summarizeMortgage({
  tranches,
  displayFrequency: "Monthly",
  extraPayment: 700
});
const refixView = buildRefixScenarioView({
  tranches,
  selectedTrancheId: "part-1",
  selectedTermMonths: 12,
  marketRates: [{ term: "1 year", rate: 4.73 }],
  bankRateSnapshotId: "bank-rates-test",
  ocrSnapshot: DEFAULT_OCR_FORECAST_SNAPSHOT
});
const marketRateRows = [
  {
    id: "part-1",
    index: 1,
    balance: 500000,
    frequency: "Monthly",
    marketTerm: "1 year",
    marketRate: 4.73,
    comparisonSource: "Five-bank average",
    currentRate: 4.5,
    difference: -0.23,
    currentRepayment: 2533.426549129429,
    marketRepayment: 2602,
    repaymentDifference: 68.573450870571
  }
];

const content = buildPlainEnglishSummary({
  tranches,
  totalDebt: 1000000,
  weightedRate: 4.75,
  primaryFrequency: "Monthly",
  selectedForecastTranche: refixView.selectedForecastTranche,
  selectedForecastRow: refixView.selectedForecastRow,
  selectedForecastScenario: refixView.selectedForecastScenario,
  extraPayment: 700,
  summary,
  periodIncome: 12000,
  repaymentToIncome: 43.5,
  cashAfterRepayment: 6782.465335809871,
  cashAfterOutgoings: 2082.465335809871,
  marketRateRows
});

const bannedSummaryTerms = /\b(should|best|recommend|choose this|you need to)\b/i;
assert.equal(bannedSummaryTerms.test(content.plainText), false, "summary avoids directive advice language");
assert.ok(content.plainText.includes("Current monthly repayment"), "summary includes current monthly repayment");
assert.ok(content.plainText.includes("calculated minimum repayment"), "summary explains repayment source");
assert.ok(content.plainText.includes("DTI is an estimate"), "summary includes estimated DTI");
assert.ok(content.plainText.includes("Five-bank average"), "summary includes market comparison source");
assert.ok(content.plainText.includes("Selected re-fix scenario"), "summary includes selected re-fix scenario");
assert.ok(content.plainText.includes("Optional top-up/living-cost scenario"), "summary includes top-up and living costs");
assert.ok(content.disclaimer.includes("not financial advice"), "summary includes disclaimer");

const payload = buildSummaryPayload({
  createdAt: "2026-07-07T00:00:00.000Z",
  ratesSnapshotId: "bank-rates-test",
  ocrSnapshotId: DEFAULT_OCR_FORECAST_SNAPSHOT.id,
  contact: {
    name: "Alex Example",
    email: "alex@example.nz",
    phone: "0210000000",
    propertyAddress: "1 Example Street",
    currentBank: "ANZ"
  },
  consent: {
    privacyConsent: true,
    adviserContactConsent: true,
    submittedAt: "2026-07-07T00:01:00.000Z"
  },
  inputs: { loanBalance: 1000000, loanParts: tranches },
  outputs: {
    currentMonthlyRepayment: monthlyEquivalent(summary.repayment, "Monthly"),
    cashAfterRepaymentMonthly: monthlyEquivalent(6782.465335809871, "Monthly"),
    dtiEstimate: 6.944444444444445
  },
  marketComparison: { rows: marketRateRows },
  refixScenario: {
    selectedLoanPart: 1,
    selectedTermMonths: 12,
    scenarioLabel: refixView.selectedForecastScenario.label
  },
  visuals: { summaryText: content.plainText },
  disclaimer: content.disclaimer
});

for (const key of [
  "summaryVersion",
  "createdAt",
  "calculationEngineVersion",
  "ratesSnapshotId",
  "ocrSnapshotId",
  "contact",
  "consent",
  "inputs",
  "outputs",
  "marketComparison",
  "refixScenario",
  "visuals",
  "disclaimer"
]) {
  assert.ok(Object.hasOwn(payload, key), `payload includes ${key}`);
}

assert.equal(payload.summaryVersion, SUMMARY_VERSION);
assert.equal(payload.contact.email, "alex@example.nz");
assert.equal(payload.consent.adviserContactConsent, true);

console.log("Summary payload test passed");
