import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getInitialMortgageFormState, mortgageFormReducer } from "../src/mortgageFormState.js";

function reduce(state, action) {
  return mortgageFormReducer(state, action);
}

function updateTranche(state, id, field, value) {
  return reduce(state, { type: "UPDATE_TRANCHE", id, field, value, decimal: true });
}

let existingSingle = getInitialMortgageFormState();
const existingSingleId = existingSingle.tranches[0].id;

assert.equal(existingSingle.hasExistingLoan, "yes", "Existing loan should be the default flow");
assert.equal(existingSingle.loanSituation, "fixed_only", "Fixed home loan is the default situation");
existingSingle = updateTranche(existingSingle, existingSingleId, "amount", "600000");
existingSingle = updateTranche(existingSingle, existingSingleId, "originalLoanAmount", "700000");
assert.equal(existingSingle.loanStructure, "single", "Existing one-loan flow should remain single");
assert.equal(existingSingle.tranches[0].amount, "600000", "Existing one-loan flow stores the current balance on the tranche");
assert.equal(existingSingle.tranches[0].originalLoanAmount, "700000", "Existing one-loan flow stores the original amount on the tranche");

let existingSplit = reduce(existingSingle, { type: "ADD_TRANCHE" });
const existingSplitId = existingSplit.tranches[1].id;
existingSplit = updateTranche(existingSplit, existingSplitId, "amount", "150000");
existingSplit = updateTranche(existingSplit, existingSplitId, "originalLoanAmount", "200000");
assert.equal(existingSplit.loanStructure, "split", "Existing split-loan flow should be split");
assert.equal(existingSplit.tranches.length, 2, "Existing split-loan flow should have two tranches");
assert.equal(existingSplit.tranches[0].originalLoanAmount, "700000", "Existing tranche original amount should be preserved");
assert.equal(existingSplit.tranches[1].originalLoanAmount, "200000", "New existing tranche should store its own original amount");

let newSingle = getInitialMortgageFormState();
const newSingleId = newSingle.tranches[0].id;
newSingle = reduce(newSingle, { type: "SET_FIELD", field: "hasExistingLoan", value: "no" });
newSingle = updateTranche(newSingle, newSingleId, "amount", "600000");
assert.equal(newSingle.hasExistingLoan, "no", "New-loan flow should be selectable");
assert.equal(newSingle.loanStructure, "single", "New one-loan flow should remain single");
assert.equal(newSingle.tranches[0].amount, "600000", "New one-loan flow stores the new loan amount on the tranche");

let newSplit = reduce(newSingle, { type: "ADD_TRANCHE" });
const newSplitId = newSplit.tranches[1].id;
newSplit = updateTranche(newSplit, newSplitId, "amount", "150000");
assert.equal(newSplit.loanStructure, "split", "New split-loan flow should be split");
assert.equal(newSplit.tranches.length, 2, "New split-loan flow should have two tranches");
assert.equal(newSplit.tranches[1].amount, "150000", "New split-loan flow stores each new loan amount on its tranche");

const resetState = reduce(existingSplit, { type: "RESET" });
assert.equal(resetState.tranches[0].amount, "", "Reset clears tranche amounts");
assert.equal(resetState.salaryIncome, "", "Reset clears income fields");

const beforeInvalidDecimal = newSplit;
const afterInvalidDecimal = reduce(newSplit, {
  type: "UPDATE_TRANCHE",
  id: newSingleId,
  field: "rate",
  value: "5.7.2",
  decimal: true
});

assert.equal(afterInvalidDecimal, beforeInvalidDecimal, "Invalid decimal input should be ignored without mutating state");

const stepOneSource = readFileSync(new URL("../src/components/LoanBalanceStep.jsx", import.meta.url), "utf8");
assert.doesNotMatch(stepOneSource, /loan part/i, "Step 1 should use loan tranche wording");

const mainSource = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
assert.doesNotMatch(mainSource, /localStorage\.setItem\(.*trimratenz-form/, "Loan form state should not be persisted");
assert.match(mainSource, /localStorage\.removeItem\("trimratenz-form"\)/, "Legacy stored loan state should be cleared");

const summarySource = readFileSync(new URL("../src/components/ExecutiveSummaryLeadStep.jsx", import.meta.url), "utf8");
assert.match(summarySource, /Want a second opinion\? A mortgage adviser can review your numbers and help you understand your options\./, "Adviser helper wording should render");
assert.doesNotMatch(summarySource, /localStorage|sessionStorage/, "Contact form fields should not use browser storage");

const legalSource = readFileSync(new URL("../src/LegalPage.jsx", import.meta.url), "utf8");
assert.match(legalSource, /Privacy Policy/, "Privacy Policy page should render");
assert.match(legalSource, /Terms of Use/, "Terms of Use page should render");

console.log("Form state smoke test passed");
