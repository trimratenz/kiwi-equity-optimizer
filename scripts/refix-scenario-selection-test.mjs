import assert from "node:assert/strict";
import {
  buildRefixScenarioView,
  calculateLoanPartRepayment,
  calculatePayment
} from "../src/financialModel.js";

const tolerance = 1e-6;

function assertClose(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, received ${actual}`);
}

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

function assertSelectedScenario(view, tranche, expectedBalance, expectedForecastOcr) {
  assert.equal(view.selectedForecastTranche.id, tranche.id, "selected loan part id");
  assert.equal(view.selectedForecastTranche.fixedTermMonths, tranche.fixedTermMonths, "current fixed term");
  assert.equal(view.selectedForecastTranche.fixedMonths, tranche.fixedMonths, "fixed ends in months");
  assert.equal(view.selectedForecastFrequency, tranche.frequency, "selected repayment frequency");
  assert.equal(view.selectedForecastRow.months, 12, "selected new fixed term");
  assert.equal(view.selectedForecastRow.refixPointMonths, tranche.fixedMonths, "OCR forecast date month");
  assert.equal(view.selectedForecastRow.refixPointLabel, tranche.fixedMonths === 6 ? "6 mo" : "1 yr 6 mo");
  assertClose(view.selectedForecastPayment, calculateLoanPartRepayment(tranche), "current repayment");
  assertClose(view.selectedForecastRow.remainingBalance, expectedBalance, "balance at re-fix");
  assertClose(view.selectedForecastRow.forecastOcr, expectedForecastOcr, "forecast OCR");

  const baseScenario = view.selectedForecastScenario;
  const expectedScenarioRepayment = calculatePayment(
    view.selectedForecastRow.remainingBalance,
    baseScenario.forecastMortgageRate,
    view.selectedForecastRow.remainingYears,
    tranche.frequency
  );
  assertClose(baseScenario.repayment, expectedScenarioRepayment, "scenario repayment");
  assertClose(
    baseScenario.repaymentChange,
    expectedScenarioRepayment - view.selectedForecastPayment,
    "scenario repayment change"
  );
}

const part1View = buildRefixScenarioView({
  tranches,
  selectedTrancheId: "part-1",
  selectedTermMonths: 12,
  fallbackFrequency: "Monthly"
});
const part2View = buildRefixScenarioView({
  tranches,
  selectedTrancheId: "part-2",
  selectedTermMonths: 12,
  fallbackFrequency: "Monthly"
});

assertSelectedScenario(part1View, tranches[0], 496012.21850776055, 2.6);
assertSelectedScenario(part2View, tranches[1], 488794.4144798936, 2.5);
assert.notEqual(part1View.selectedForecastTranche.id, part2View.selectedForecastTranche.id);
assert.notEqual(part1View.selectedForecastRow.refixPointMonths, part2View.selectedForecastRow.refixPointMonths);
assert.notEqual(part1View.selectedForecastRow.remainingBalance, part2View.selectedForecastRow.remainingBalance);
assert.notEqual(part1View.selectedForecastScenario.repayment, part2View.selectedForecastScenario.repayment);

const fallbackView = buildRefixScenarioView({
  tranches,
  selectedTrancheId: "removed-or-stale-id",
  selectedTermMonths: 999,
  fallbackFrequency: "Monthly"
});

assert.equal(fallbackView.selectedForecastTranche.id, "part-1", "stale selected id falls back to first active part");
assert.equal(fallbackView.selectedForecastTermMonths, 12, "stale selected term falls back to 1 year");

console.log("Re-fix scenario selection test passed");
