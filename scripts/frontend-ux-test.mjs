import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lowestRateBanks } from "../src/marketRateUtils.js";
import { getVisibleStepLabels } from "../src/visibleSteps.js";

const oneLowest = lowestRateBanks([{ institution: "ANZ", termInMonths: 12, rate: 5.59 }, { institution: "ASB", termInMonths: 12, rate: 5.69 }], 12);
assert.deepEqual(oneLowest, { rate: 5.59, banks: ["ANZ"] }, "single lowest bank is shown");
const tiedLowest = lowestRateBanks([{ institution: "BNZ", termInMonths: 12, rate: 5.59 }, { institution: "ANZ", termInMonths: 12, rate: 5.59 }, { institution: "ASB", termInMonths: 12, rate: 5.79 }], 12);
assert.deepEqual(tiedLowest, { rate: 5.59, banks: ["ANZ", "BNZ"] }, "all tied lowest banks are shown");

const main = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
assert.match(main, /forecastTranches\.filter\(\(tranche\) => tranche\.type === "Fixed"\)/, "only fixed tranches enter OCR forecasting");
assert.match(main, /const shouldShowRefix = setupComplete && fixedForecastTranches\.length > 0/, "all floating loans skip the OCR step");
assert.match(main, /fixedForecastTranches\.map\(\(tranche\) =>/, "summary OCR scenarios only use fixed tranches");
const stepOne = readFileSync(new URL("../src/components/LoanBalanceStep.jsx", import.meta.url), "utf8");
assert.match(stepOne, /Do you already have a home loan\?/, "existing-loan selector renders");
assert.doesNotMatch(stepOne, /Which best describes your situation\?/, "loan situation selector is removed");
assert.match(stepOne, /Your actual repayment/, "actual repayment input renders");
assert.match(stepOne, /This is lower than the estimated minimum/, "lower repayment soft warning renders");
assert.match(stepOne, /value: "Floating", label: "Floating"/, "loan type uses Floating wording");
const rateStress = readFileSync(new URL("../src/components/RateStressStep.jsx", import.meta.url), "utf8");
const summary = readFileSync(new URL("../src/components/ExecutiveSummaryLeadStep.jsx", import.meta.url), "utf8");
for (const source of [main, stepOne, rateStress, summary]) {
  assert.doesNotMatch(source, /Variable/i, "no Variable wording remains in visible loan flow");
  assert.doesNotMatch(source, /Floating\s+Floating/i, "loan type wording is never duplicated");
}
assert.deepEqual(getVisibleStepLabels(true), {
  loanDetails: "Step 1",
  repayment: "Step 2",
  marketComparison: "Step 3",
  ocrForecast: "Step 4",
  optimization: "Step 5"
}, "fixed loans show sequential OCR steps");
assert.deepEqual(getVisibleStepLabels(false), {
  loanDetails: "Step 1",
  repayment: "Step 2",
  marketComparison: "Step 3",
  ocrForecast: null,
  optimization: "Step 4"
}, "all floating loans skip OCR without a step-number gap");
const info = readFileSync(new URL("../src/InfoPage.jsx", import.meta.url), "utf8");
const contact = readFileSync(new URL("../src/ContactPage.jsx", import.meta.url), "utf8");
assert.match(info, /The all-in-one mortgage calculator for Kiwis/, "Info page renders");
assert.match(contact, /hello@trimrate\.co\.nz/, "Contact page renders");
console.log("Frontend UX test passed");
