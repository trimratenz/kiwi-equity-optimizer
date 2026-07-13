import assert from "node:assert/strict";
import {
  balanceAfterMonths,
  buildLoanPartRepaymentDetails,
  calculateMinimumRepaymentExact,
  calculateLoanPartRepayment,
  cashAfterMortgageTopUpAndLivingCosts,
  cashAfterRepayment,
  debtToIncomeRatio,
  remainingPrincipalAndInterestToFixedEnd,
  repaymentToIncomeRatio,
  summarizeMortgage,
  totalRepaymentAcrossLoanParts,
  weightedAverageRate
} from "../src/financialModel.js";
import {
  calculateMinimumRepayment,
  calculatePayoffTime,
  calculateRemainingBalance,
  calculateScenarioComparison,
  calculateTotalInterest,
  validateBalanceAtRefix
} from "../src/lib/mortgageCalculations.js";

const tolerance = 1e-6;

function assertClose(actual, expected, label) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}`
  );
}

function assertRoundedCents(actual, expected, label) {
  assert.equal(Number(actual.toFixed(2)), expected, label);
}

const tranches = [
  {
    id: "part-1",
    amount: 500000,
    rate: 4.5,
    termYears: 30,
    type: "Fixed",
    frequency: "Monthly",
    fixedTermMonths: 12,
    fixedMonths: 6
  },
  {
    id: "part-2",
    amount: 500000,
    rate: 5,
    termYears: 30,
    type: "Fixed",
    frequency: "Monthly",
    fixedTermMonths: 24,
    fixedMonths: 18
  }
];

const monthlyIncome = 12000;
const livingCostsPerMonth = 4000;
const extraRepaymentPerMonth = 700;

const summary = summarizeMortgage({
  tranches,
  displayFrequency: "Monthly",
  extraPayment: extraRepaymentPerMonth
});
const fixedEnd = remainingPrincipalAndInterestToFixedEnd(tranches, "Monthly");
const dti = debtToIncomeRatio(1000000, monthlyIncome, "Monthly");
const repaymentToIncome = repaymentToIncomeRatio(summary.repayment, monthlyIncome);

assertClose(weightedAverageRate(tranches), 4.75, "weighted average rate");
assertClose(calculateLoanPartRepayment(tranches[0]), 2533.426549129429, "part 1 monthly repayment");
assertClose(calculateLoanPartRepayment(tranches[1]), 2684.108115060699, "part 2 monthly repayment");
assertClose(
  calculateLoanPartRepayment({
    amount: 500000,
    repaymentPrincipal: 600000,
    rate: 5,
    termYears: 30,
    frequency: "Monthly"
  }),
  calculateMinimumRepaymentExact({ principal: 600000, annualRate: 5, years: 30, frequency: "Monthly" }),
  "existing-loan repayment uses the original loan amount"
);
assertClose(
  calculateLoanPartRepayment({
    amount: 500000,
    rate: 5,
    termYears: 30,
    frequency: "Monthly"
  }),
  calculateMinimumRepaymentExact({ principal: 500000, annualRate: 5, years: 30, frequency: "Monthly" }),
  "new-loan repayment uses the new loan amount"
);
assertClose(summary.repayment, 5217.534664190129, "total monthly repayment");
assert.equal(Math.round(summary.repayment), 5218, "display monthly repayment");
assertClose(summary.totalInterest, 878312.4791084463, "total interest over full loan term");
assertClose(cashAfterRepayment(monthlyIncome, summary.repayment), 6782.465335809871, "cash after repayment");
assert.equal(Number(repaymentToIncome.toFixed(1)), 43.5, "repayment-to-income percent rounded");
assertClose(dti, 6.944444444444445, "DTI");
assert.equal(Number(dti.toFixed(2)), 6.94, "display DTI");
assertClose(
  balanceAfterMonths({ principal: 500000, annualRate: 4.5, years: 30, frequency: "Monthly", months: 6 }),
  496012.21850776055,
  "part 1 balance after 6 months"
);
assertClose(
  balanceAfterMonths({ principal: 500000, annualRate: 5, years: 30, frequency: "Monthly", months: 18 }),
  488794.4144798936,
  "part 2 balance after 18 months"
);
assertClose(fixedEnd.total, 63514.50536586916, "P&I to fixed ends");
assertClose(fixedEnd.principal, 15193.36701234593, "principal to fixed ends");
assertClose(fixedEnd.interest, 48321.13835352323, "interest to fixed ends");
assert.equal(fixedEnd.periodsRemaining, 24, "scheduled payments to fixed ends");
assertClose(
  cashAfterMortgageTopUpAndLivingCosts({
    periodIncome: monthlyIncome,
    standardRepayment: summary.repayment,
    extraPayment: extraRepaymentPerMonth,
    livingCosts: livingCostsPerMonth
  }),
  2082.465335809871,
  "cash after mortgage, top-up, and living costs"
);

const trimRateFortnightlyParts = [
  {
    id: "trimrate-part-1",
    amount: 395000,
    rate: 5.13,
    termYears: 30,
    type: "Fixed",
    frequency: "Fortnightly",
    repaymentAmount: 989.55,
    fixedTermMonths: 36,
    fixedMonths: 36
  },
  {
    id: "trimrate-part-2",
    amount: 270000,
    rate: 4.59,
    termYears: 30,
    type: "Fixed",
    frequency: "Fortnightly",
    repaymentAmount: "",
    fixedTermMonths: 24,
    fixedMonths: 24
  },
  {
    id: "trimrate-part-3",
    amount: 200000,
    rate: 4.44,
    termYears: 30,
    type: "Fixed",
    frequency: "Fortnightly",
    repaymentAmount: "",
    fixedTermMonths: 24,
    fixedMonths: 24
  }
];
trimRateFortnightlyParts[0].repaymentAmount = "";

const trimRateFortnightlySummary = summarizeMortgage({
  tranches: trimRateFortnightlyParts,
  displayFrequency: "Fortnightly"
});
const part1Repayment = buildLoanPartRepaymentDetails({
  principal: 395000,
  annualRate: 5.13,
  years: 30,
  frequency: "Fortnightly"
});
const part2Repayment = buildLoanPartRepaymentDetails({
  principal: 270000,
  annualRate: 4.59,
  years: 30,
  frequency: "Fortnightly"
});
const part3Repayment = buildLoanPartRepaymentDetails({
  principal: 200000,
  annualRate: 4.44,
  years: 30,
  frequency: "Fortnightly"
});

assertClose(part1Repayment.calculatedMinimumRepaymentExact, 990.077738350965, "part 1 minimum fortnightly repayment");
assert.equal(part1Repayment.calculatedMinimumRepaymentRounded, 990, "part 1 display repayment");
assert.equal(part1Repayment.repaymentSource, "calculated", "part 1 repayment source");
assertClose(
  summarizeMortgage({
    tranches: [trimRateFortnightlyParts[0]],
    displayFrequency: "Fortnightly"
  }).totalInterest,
  379240.79139043705,
  "Squirrel reference case total interest"
);
assertClose(part2Repayment.calculatedMinimumRepaymentExact, 636.0902428207919, "part 2 minimum fortnightly repayment");
assert.equal(part2Repayment.calculatedMinimumRepaymentRounded, 636, "part 2 display repayment");
assert.equal(part2Repayment.repaymentSource, "calculated", "part 2 repayment source");
assertClose(part3Repayment.calculatedMinimumRepaymentExact, 462.9718971909009, "part 3 minimum fortnightly repayment");
assert.equal(part3Repayment.calculatedMinimumRepaymentRounded, 463, "part 3 display repayment");
assert.equal(part3Repayment.repaymentSource, "calculated", "part 3 repayment source");
assertClose(trimRateFortnightlySummary.repayment, 2089.139878362658, "total calculated fortnightly repayment");
assert.equal(Math.round(trimRateFortnightlySummary.repayment), 2089, "display total fortnightly repayment");
assert.ok(trimRateFortnightlySummary.standard.rows[0].debt > 0, "fortnightly debt chart starts above zero");
assert.equal(trimRateFortnightlySummary.standard.rows.at(-1).year, 30, "fortnightly debt chart ends at the loan term");
assertClose((trimRateFortnightlySummary.repayment * (365 / 14)) / 12, 4538.90509287125, "monthly equivalent exact");
assert.equal(Math.round((trimRateFortnightlySummary.repayment * (365 / 14)) / 12), 4539, "display monthly equivalent");
assert.equal(Number(weightedAverageRate(trimRateFortnightlyParts).toFixed(2)), 4.8, "weighted average rate rounded");

const overrideParts = trimRateFortnightlyParts.map((part, index) => ({
  ...part,
  repaymentAmount: index === 0 ? 1100 : ""
}));
const overrideSummary = summarizeMortgage({
  tranches: overrideParts,
  displayFrequency: "Fortnightly"
});
const overridePart1 = buildLoanPartRepaymentDetails({
  principal: 395000,
  annualRate: 5.13,
  years: 30,
  frequency: "Fortnightly",
  userCurrentRepayment: 1100
});
assertClose(overridePart1.effectiveCurrentRepaymentExact, 1100, "part 1 valid override effective repayment");
assert.equal(overridePart1.repaymentSource, "user_override", "part 1 valid override source");
assertClose(calculateLoanPartRepayment(overrideParts[1]), 636.0902428207919, "part 2 remains calculated");
assertClose(calculateLoanPartRepayment(overrideParts[2]), 462.9718971909009, "part 3 remains calculated");
assertClose(overrideSummary.repayment, 2199.062140011693, "total override fortnightly repayment");
assert.equal(Math.round(overrideSummary.repayment), 2199, "display override fortnightly repayment");
assert.equal(Math.round((overrideSummary.repayment * (365 / 14)) / 12), 4778, "display override monthly equivalent");

const invalidOverride = buildLoanPartRepaymentDetails({
  principal: 395000,
  annualRate: 5.13,
  years: 30,
  frequency: "Fortnightly",
  userCurrentRepayment: 900
});
assert.equal(invalidOverride.repaymentValidationError, null, "lower actual repayment is a soft warning, not a validation error");
assert.equal(invalidOverride.repaymentWarning.code, "current-repayment-below-minimum", "lower actual repayment warning");
assertClose(
  invalidOverride.effectiveCurrentRepaymentExact,
  900,
  "lower actual repayment is used"
);
assert.equal(invalidOverride.repaymentSource, "user_override", "lower actual repayment remains an entered repayment");

const equalOverride = buildLoanPartRepaymentDetails({
  principal: 395000,
  annualRate: 5.13,
  years: 30,
  frequency: "Fortnightly",
  userCurrentRepayment: 990.077738350965
});
assert.equal(equalOverride.repaymentWarning, null, "equal actual repayment has no warning");
assert.equal(equalOverride.repaymentSource, "user_override", "equal actual repayment is used");
assert.equal(overridePart1.repaymentWarning, null, "higher actual repayment has no warning");

for (const frequency of ["Weekly", "Fortnightly", "Monthly"]) {
  const currentBalance = 500000;
  const laterBalance = balanceAfterMonths({ principal: currentBalance, annualRate: 5, years: 30, frequency, months: 12 });
  assert.ok(laterBalance > 0 && laterBalance < currentBalance, `${frequency} balance decreases over time`);
  assertClose(
    balanceAfterMonths({ principal: currentBalance, annualRate: 5, years: 30, frequency, months: 0 }),
    currentBalance,
    `${frequency} balance at re-fix is unchanged at month zero`
  );
}

assert.equal(validateBalanceAtRefix("", 500000).valid, true, "blank balance at refix uses estimate");
assert.equal(validateBalanceAtRefix(490000, 500000).valid, true, "valid balance at refix is accepted");
assert.equal(validateBalanceAtRefix(0, 500000).valid, false, "zero balance at refix is blocked");
assert.equal(validateBalanceAtRefix(500001, 500000).valid, false, "balance at refix cannot exceed current balance");

assertClose(
  calculateMinimumRepaymentExact({ principal: 500000, annualRate: 5, years: 30, frequency: "Monthly" }),
  2684.108115060699,
  "edge monthly repayment"
);
assertRoundedCents(
  calculateMinimumRepayment({
    loanBalance: 500000,
    annualInterestRate: 5,
    remainingYears: 30,
    frequency: "Monthly"
  }),
  2684.11,
  "required case 2 monthly repayment"
);
assertClose(
  calculateMinimumRepaymentExact({ principal: 500000, annualRate: 5, years: 30, frequency: "Fortnightly" }),
  1234.9247141146366,
  "edge fortnightly repayment"
);
assertRoundedCents(
  calculateMinimumRepayment({
    loanBalance: 500000,
    annualInterestRate: 5,
    remainingYears: 30,
    frequency: "Fortnightly"
  }),
  1234.92,
  "required case 1 fortnightly repayment"
);
assertClose(
  calculateMinimumRepaymentExact({ principal: 500000, annualRate: 5, years: 30, frequency: "Weekly" }),
  617.3348729285032,
  "edge weekly repayment"
);
assertRoundedCents(
  calculateMinimumRepayment({
    loanBalance: 500000,
    annualInterestRate: 4.55,
    remainingYears: 25,
    frequency: "Fortnightly"
  }),
  1285.84,
  "required case 3 fortnightly repayment"
);
assertRoundedCents(
  calculateMinimumRepayment({
    loanBalance: 100000,
    annualInterestRate: 0,
    remainingYears: 10,
    frequency: "Fortnightly"
  }),
  384.62,
  "required case 4 zero-interest fortnightly repayment"
);
assertClose(
  calculateMinimumRepaymentExact({ principal: 120000, annualRate: 0, years: 10, frequency: "Monthly" }),
  1000,
  "edge zero interest repayment"
);
assertClose(
  calculateMinimumRepaymentExact({ principal: 1000, annualRate: 5, years: 30, frequency: "Monthly" }),
  5.368216230121398,
  "edge small loan balance"
);
assertClose(
  calculateMinimumRepaymentExact({ principal: 500000, annualRate: 15, years: 30, frequency: "Monthly" }),
  6322.220107825217,
  "edge high interest rate"
);
assertClose(
  calculateMinimumRepaymentExact({ principal: 12000, annualRate: 5, years: 1, frequency: "Monthly" }),
  1027.2897814616085,
  "edge one-year loan term"
);
assertClose(
  totalRepaymentAcrossLoanParts(
    [
      { amount: 100000, rate: 5, termYears: 30, frequency: "Weekly" },
      { amount: 100000, rate: 5, termYears: 30, frequency: "Fortnightly" },
      { amount: 100000, rate: 5, termYears: 30, frequency: "Monthly" }
    ],
    "Monthly"
  ),
  1609.9192157379136,
  "edge mixed frequencies annualise to monthly equivalent"
);

assertClose(
  calculateRemainingBalance({
    loanBalance: 500000,
    annualInterestRate: 5,
    remainingYears: 30,
    frequency: "Monthly",
    months: 12
  }),
  492623.17327216256,
  "pure remaining balance after 12 months"
);
assertClose(
  calculateTotalInterest({
    loanBalance: 500000,
    annualInterestRate: 5,
    remainingYears: 30,
    frequency: "Monthly"
  }),
  466278.9214218487,
  "pure total interest over full term"
);
assert.equal(
  calculatePayoffTime({
    loanBalance: 500000,
    annualInterestRate: 5,
    remainingYears: 30,
    frequency: "Monthly"
  }).periods,
  360,
  "pure payoff time in monthly periods"
);

const scenarioComparison = calculateScenarioComparison({
  baseScenario: {
    loanBalance: 500000,
    annualInterestRate: 5,
    remainingYears: 30,
    frequency: "Monthly"
  },
  comparisonScenario: {
    loanBalance: 500000,
    annualInterestRate: 4.55,
    remainingYears: 25,
    frequency: "Fortnightly"
  }
});
assert.ok(scenarioComparison.repaymentDifference < 0, "pure scenario comparison calculates repayment difference");
assert.ok(scenarioComparison.totalInterestDifference < 0, "pure scenario comparison calculates interest difference");

console.log("Calculation golden test passed");
