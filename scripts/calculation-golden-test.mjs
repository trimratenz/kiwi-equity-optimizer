import assert from "node:assert/strict";
import {
  balanceAfterMonths,
  calculateLoanPartRepayment,
  cashAfterMortgageTopUpAndLivingCosts,
  cashAfterRepayment,
  debtToIncomeRatio,
  remainingPrincipalAndInterestToFixedEnd,
  repaymentToIncomeRatio,
  summarizeMortgage,
  weightedAverageRate
} from "../src/financialModel.js";

const tolerance = 1e-6;

function assertClose(actual, expected, label) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}`
  );
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
    fixedMonths: 6,
    offsetBalance: 0
  },
  {
    id: "part-2",
    amount: 500000,
    rate: 5,
    termYears: 30,
    type: "Fixed",
    frequency: "Monthly",
    fixedTermMonths: 24,
    fixedMonths: 18,
    offsetBalance: 0
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

console.log("Calculation golden test passed");
