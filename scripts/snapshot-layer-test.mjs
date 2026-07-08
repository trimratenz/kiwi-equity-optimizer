import assert from "node:assert/strict";
import {
  averageRateForTerm,
  DEFAULT_OCR_FORECAST_SNAPSHOT,
  LATEST_KNOWN_RBNZ_MPS,
  createBankRateSnapshot,
  createCalculationRun,
  createOcrForecastSnapshot,
  evaluateBankRateSnapshotWarnings,
  evaluateLatestMpsWarnings,
  evaluateOcrForecastWarnings,
  lookupOcrForecastByDate,
  lowestRateForTerm
} from "../src/snapshotLayer.js";

const bankRateSnapshot = createBankRateSnapshot({
  id: "fixture-bank-rates-2026-07-07",
  source: "Fixture bank rates",
  capturedAt: "2026-07-07",
  records: [
    { institution: "ANZ", institutionId: "institution:anz", termKey: "one_year", rate: 4.65 },
    { institution: "ASB", institutionId: "institution:asb", termKey: "one_year", rate: 4.65 },
    { institution: "BNZ", institutionId: "institution:bnz", termKey: "one_year", rate: 4.75 },
    { institution: "Kiwibank", institutionId: "institution:kiwibank", termKey: "one_year", rate: 4.75 },
    { institution: "Westpac", institutionId: "institution:westpac", termKey: "one_year", rate: 4.85 },
    { institution: "ANZ", institutionId: "institution:anz", termKey: "two_years", rate: 5.29 },
    { institution: "ASB", institutionId: "institution:asb", termKey: "two_years", rate: 5.29 },
    { institution: "BNZ", institutionId: "institution:bnz", termKey: "two_years", rate: 5.23 },
    { institution: "Kiwibank", institutionId: "institution:kiwibank", termKey: "two_years", rate: 5.19 },
    { institution: "Westpac", institutionId: "institution:westpac", termKey: "two_years", rate: 5.2 }
  ]
});

assert.equal(averageRateForTerm(bankRateSnapshot, "one_year"), 4.73, "1-year average rate");
assert.equal(averageRateForTerm(bankRateSnapshot, "two_years"), 5.24, "2-year average rate");

const oneYearLowest = lowestRateForTerm(bankRateSnapshot, "one_year");
assert.equal(oneYearLowest.institution, "ANZ", "1-year lowest bank uses alphabetical tie-break");
assert.equal(oneYearLowest.rate, 4.65, "1-year lowest rate");

const twoYearLowest = lowestRateForTerm(bankRateSnapshot, "two_years");
assert.equal(twoYearLowest.institution, "Kiwibank", "2-year lowest bank");
assert.equal(twoYearLowest.rate, 5.19, "2-year lowest rate");

const staleWarnings = evaluateBankRateSnapshotWarnings(
  createBankRateSnapshot({
    id: "stale-bank-rates",
    source: "Fixture bank rates",
    capturedAt: "2026-06-20",
    records: bankRateSnapshot.records
  }),
  "2026-07-07"
);
assert.equal(staleWarnings[0].code, "bank-rates-stale", "bank rates older than 7 days warn");

const ocrSnapshot = createOcrForecastSnapshot({
  id: "fixture-ocr-mps-may-2026",
  source: "Fixture OCR forecast source",
  currentOcr: 2.25,
  capturedAt: "2026-05-28",
  reviewedAt: "2026-05-28",
  forecast: [{ date: "2027-01-07", ocr: 2.6 }]
});
const forecast = lookupOcrForecastByDate(ocrSnapshot, "2027-01-07");
assert.equal(forecast.source, "Fixture OCR forecast source", "OCR source");
assert.equal(forecast.ocr, 2.6, "OCR forecast by re-fix date");
assert.equal(forecast.snapshotId, "fixture-ocr-mps-may-2026", "OCR lookup carries snapshot ID");

const rbnzTableForecast = lookupOcrForecastByDate(DEFAULT_OCR_FORECAST_SNAPSHOT, "2027-01-07");
assert.equal(rbnzTableForecast.ocr, 3.0, "RBNZ Table 6.1 quarter-containing OCR forecast");
assert.equal(rbnzTableForecast.sourceUrl.includes("rbnz.govt.nz"), true, "RBNZ forecast carries source URL");

const ocrWarnings = evaluateOcrForecastWarnings(ocrSnapshot, "2026-07-01");
assert.equal(ocrWarnings[0].code, "ocr-forecast-review-stale", "OCR source review warning");

const latestMpsWarnings = evaluateLatestMpsWarnings(ocrSnapshot, {
  title: "Monetary Policy Statement August 2026",
  publishedAt: "2026-08-12",
  url: "https://www.rbnz.govt.nz/monetary-policy/monetary-policy-statement"
});
assert.equal(latestMpsWarnings[0].code, "ocr-forecast-mps-outdated", "newer MPS warning");
assert.equal(
  evaluateLatestMpsWarnings(DEFAULT_OCR_FORECAST_SNAPSHOT, LATEST_KNOWN_RBNZ_MPS).length,
  0,
  "current default OCR snapshot matches latest known MPS"
);

const calculationRun = createCalculationRun({
  id: "fixture-run",
  inputs: { balance: 1000000 },
  result: { repayment: 5218 },
  bankRateSnapshot,
  ocrForecastSnapshot: ocrSnapshot,
  createdAt: "2026-07-07T00:00:00.000Z"
});
assert.equal(calculationRun.snapshotIds.bankRateSnapshotId, "fixture-bank-rates-2026-07-07");
assert.equal(calculationRun.snapshotIds.ocrForecastSnapshotId, "fixture-ocr-mps-may-2026");

console.log("Snapshot layer test passed");
