import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lowestRateBanks } from "../src/marketRateUtils.js";

const oneLowest = lowestRateBanks([{ institution: "ANZ", termInMonths: 12, rate: 5.59 }, { institution: "ASB", termInMonths: 12, rate: 5.69 }], 12);
assert.deepEqual(oneLowest, { rate: 5.59, banks: ["ANZ"] }, "single lowest bank is shown");
const tiedLowest = lowestRateBanks([{ institution: "BNZ", termInMonths: 12, rate: 5.59 }, { institution: "ANZ", termInMonths: 12, rate: 5.59 }, { institution: "ASB", termInMonths: 12, rate: 5.79 }], 12);
assert.deepEqual(tiedLowest, { rate: 5.59, banks: ["ANZ", "BNZ"] }, "all tied lowest banks are shown");

const main = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
assert.match(main, /loanSituation === "fixed_only" \|\| loanSituation === "mixed"/, "fixed and mixed situations show Step 4");
const stepOne = readFileSync(new URL("../src/components/LoanBalanceStep.jsx", import.meta.url), "utf8");
assert.match(stepOne, /Which best describes your situation\?/, "loan situation selector renders");
assert.match(stepOne, /Your actual repayment/, "actual repayment input renders");
assert.match(stepOne, /This is lower than the estimated minimum/, "lower repayment soft warning renders");
const info = readFileSync(new URL("../src/InfoPage.jsx", import.meta.url), "utf8");
const contact = readFileSync(new URL("../src/ContactPage.jsx", import.meta.url), "utf8");
assert.match(info, /The all-in-one mortgage calculator for Kiwis/, "Info page renders");
assert.match(contact, /hello@trimrate\.co\.nz/, "Contact page renders");
console.log("Frontend UX test passed");
