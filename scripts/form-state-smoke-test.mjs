import assert from "node:assert/strict";
import {
  getInitialMortgageFormState,
  mortgageFormReducer
} from "../src/mortgageFormState.js";

function reduce(state, action) {
  return mortgageFormReducer(state, action);
}

let state = getInitialMortgageFormState();
const firstId = state.tranches[0].id;

state = reduce(state, { type: "SET_FIELD", field: "loanBalance", value: "600000", decimal: true });
state = reduce(state, { type: "SET_FIELD", field: "salaryIncome", value: "5000", decimal: true });
assert.equal(state.tranches[0].termYears, "30", "Default loan term should be 30 years");
state = reduce(state, { type: "UPDATE_TRANCHE", id: firstId, field: "rate", value: "5.75", decimal: true });
state = reduce(state, { type: "UPDATE_TRANCHE", id: firstId, field: "termYears", value: "20", decimal: true });
state = reduce(state, { type: "UPDATE_TRANCHE", id: firstId, field: "repaymentAmount", value: "989.55", decimal: true });
state = reduce(state, { type: "UPDATE_TRANCHE", id: firstId, field: "type", value: "Variable" });
state = reduce(state, { type: "UPDATE_TRANCHE", id: firstId, field: "frequency", value: "Fortnightly" });
state = reduce(state, { type: "UPDATE_TRANCHE", id: firstId, field: "offsetBalance", value: "25000", decimal: true });

const beforeAdd = state;
state = reduce(state, { type: "ADD_TRANCHE" });

assert.notEqual(state, beforeAdd, "ADD_TRANCHE must return a new state object");
assert.equal(state.loanStructure, "split", "Adding a tranche should put the form into split-loan mode");
assert.equal(state.tranches.length, 2, "ADD_TRANCHE should append one tranche");
assert.equal(state.tranches[0].id, firstId, "Existing tranche key/id should be preserved");
assert.equal(state.tranches[0].amount, "", "Existing tranche amount should not be auto-filled from total balance");
assert.equal(state.tranches[0].rate, "5.75", "Existing interest rate should be preserved");
assert.equal(state.tranches[0].termYears, "20", "Existing term should be preserved");
assert.equal(state.tranches[0].repaymentAmount, "989.55", "Existing current repayment should be preserved");
assert.equal(state.tranches[0].type, "Variable", "Existing loan type should be preserved");
assert.equal(state.tranches[0].frequency, "Fortnightly", "Existing repayment frequency should be preserved");
assert.equal(state.tranches[0].offsetBalance, "25000", "Existing offset/redraw balance should be preserved");
assert.ok(state.tranches[1].id, "New tranche should have a generated id");
assert.notEqual(state.tranches[1].id, firstId, "New tranche id should be unique");

const afterInvalidDecimal = reduce(state, {
  type: "UPDATE_TRANCHE",
  id: firstId,
  field: "rate",
  value: "5.7.2",
  decimal: true
});

assert.equal(afterInvalidDecimal, state, "Invalid decimal input should be ignored without mutating state");
assert.equal(afterInvalidDecimal.tranches[0].rate, "5.75", "Invalid decimal input should not overwrite rate");

console.log("Form state smoke test passed");
