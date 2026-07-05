import { MARKET_RATE_SNAPSHOT, marketTermMonths } from "./financialModel";

export const RATES_API_BASE_URL = "https://ratesapi.nz";
export const MORTGAGE_RATES_ENDPOINT = `${RATES_API_BASE_URL}/api/v1/mortgage-rates`;

const RATE_KEYS = ["rate", "interestRate", "advertisedRate", "standardRate", "specialRate"];
const TERM_KEYS = ["termInMonths", "termMonths", "fixedTermMonths", "months"];
const TARGET_TERMS = [0, 6, 12, 18, 24, 36, 48, 60];
const TERM_LABELS = new Map([
  [0, "Floating"],
  [6, "6 months"],
  [12, "1 year"],
  [18, "18 months"],
  [24, "2 years"],
  [36, "3 years"],
  [48, "4 years"],
  [60, "5 years"]
]);
const MAJOR_BANK_IDS = new Set(["institution:anz", "institution:asb", "institution:bnz", "institution:kiwibank", "institution:westpac"]);
const EXCLUDED_PRODUCT_PATTERNS = [
  "better",
  "energy",
  "future",
  "greater choices",
  "offset",
  "reno",
  "top up",
  "totalmoney",
  "everyday"
];

function toPercentRate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric <= 1 ? numeric * 100 : numeric;
}

function findNumericValue(record, keys) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      const numeric = Number(record[key]);
      if (Number.isFinite(numeric)) return numeric;
    }
  }
  return null;
}

function normalizeTermMonths(record) {
  const directTerm = findNumericValue(record, TERM_KEYS);
  if (directTerm !== null) return directTerm;

  const termText = String(record.term || record.termLabel || record.name || "").toLowerCase();
  if (termText.includes("floating") || termText.includes("variable")) return 0;
  const monthMatch = termText.match(/(\d+)\s*month/);
  if (monthMatch) return Number(monthMatch[1]);
  const yearMatch = termText.match(/(\d+)\s*year/);
  if (yearMatch) return Number(yearMatch[1]) * 12;
  return null;
}

function productText(product) {
  return `${product.id || ""} ${product.name || ""}`.toLowerCase();
}

function isExcludedProduct(product) {
  const text = productText(product);
  return EXCLUDED_PRODUCT_PATTERNS.some((pattern) => text.includes(pattern));
}

function productScore(product, termInMonths) {
  const text = productText(product);
  if (termInMonths === 0) {
    if (text.includes("standard")) return 0;
    if (text.includes("special")) return 1;
    return 2;
  }
  if (text.includes("special")) return 0;
  if (text.includes("standard")) return 1;
  return 2;
}

function rateForProductTerm(product, termInMonths) {
  const rate = (product.rates || []).find((rateRecord) => normalizeTermMonths(rateRecord) === termInMonths);
  if (!rate) return null;

  return {
    product: product.name || "Mortgage",
    term: TERM_LABELS.get(termInMonths),
    termInMonths,
    rate: toPercentRate(rate.rate),
    rateId: rate.id
  };
}

function extractMajorBankRecords(payload) {
  return (payload?.data || [])
    .filter((institution) => MAJOR_BANK_IDS.has(institution.id))
    .flatMap((institution) =>
      TARGET_TERMS.map((termInMonths) => {
        const candidates = (institution.products || [])
          .filter((product) => !isExcludedProduct(product))
          .map((product) => ({ product, rate: rateForProductTerm(product, termInMonths) }))
          .filter((candidate) => candidate.rate && candidate.rate.rate !== null)
          .sort((a, b) => productScore(a.product, termInMonths) - productScore(b.product, termInMonths));

        const selected = candidates[0];
        if (!selected) return null;

        return {
          institution: institution.name || institution.id,
          institutionId: institution.id,
          product: selected.rate.product,
          term: selected.rate.term,
          termInMonths,
          rate: selected.rate.rate,
          rateId: selected.rate.rateId
        };
      })
    )
    .filter(Boolean);
}

export function normalizeMortgageRatesResponse(payload) {
  const records = extractMajorBankRecords(payload);
  const grouped = new Map();

  records.forEach((record) => {
    const group = grouped.get(record.termInMonths) ?? [];
    group.push(record);
    grouped.set(record.termInMonths, group);
  });

  const liveRates = TARGET_TERMS.map((termInMonths) => {
    const rates = grouped.get(termInMonths) ?? [];
    if (rates.length === 0) return null;
    const average = rates.reduce((sum, record) => sum + record.rate, 0) / rates.length;

    return {
      term: TERM_LABELS.get(termInMonths),
      rate: Number(average.toFixed(2)),
      termInMonths,
      lenderCount: new Set(rates.map((record) => record.institution)).size,
      banks: rates.map((record) => record.institution)
    };
  }).filter(Boolean);

  return {
    rates: mergeLiveRatesWithFallback(liveRates),
    captured: String(payload?.lastUpdated || payload?.timestamp || new Date().toISOString()).slice(0, 10),
    source: "Rates API 5-bank average",
    note:
      "Rates API refreshes the current mortgage-rate feed and TrimRate averages ANZ, ASB, BNZ, Kiwibank, and Westpac by term. Confirm your final rate directly with the lender before re-fixing.",
    status: "live",
    termsOfUse: payload?.termsOfUse,
    rawRecords: records
  };
}

function mergeLiveRatesWithFallback(liveRates) {
  return MARKET_RATE_SNAPSHOT.rates.map((fallbackRate) => {
    const liveRate = liveRates.find((rate) => rate.termInMonths === marketTermMonths(fallbackRate.term));
    return liveRate ?? fallbackRate;
  });
}

export async function fetchMortgageRates() {
  const response = await fetch(MORTGAGE_RATES_ENDPOINT, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Rates API returned ${response.status}`);
  }

  const payload = await response.json();
  return normalizeMortgageRatesResponse(payload);
}
