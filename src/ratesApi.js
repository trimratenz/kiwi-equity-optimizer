import { LOCAL_BANK_RATE_WORKSHEET } from "./localMortgageRateWorksheet";

export const RATES_API_BASE_URL = "https://ratesapi.nz";
export const MORTGAGE_RATES_ENDPOINT = `${RATES_API_BASE_URL}/api/v1/mortgage-rates`;

const RATE_KEYS = ["rate", "interestRate", "advertisedRate", "standardRate", "specialRate"];
const TERM_KEYS = ["termInMonths", "termMonths", "fixedTermMonths", "months"];
const TARGET_TERMS = [6, 12, 18, 24, 36, 48, 60];
const TERM_LABELS = new Map([
  [6, "6 months"],
  [12, "1 year"],
  [18, "18 months"],
  [24, "2 years"],
  [36, "3 years"],
  [48, "4 years"],
  [60, "5 years"]
]);

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

function institutionFromRecord(record, fallback) {
  const id = String(record.institutionId || record.id || "");
  if (id.startsWith("institution:")) {
    return record.institutionName || record.name || record.displayName || fallback;
  }
  return record.institutionName || record.bankName || fallback;
}

function extractRateRecords(node, context = {}, output = []) {
  if (Array.isArray(node)) {
    node.forEach((item) => extractRateRecords(item, context, output));
    return output;
  }

  if (!node || typeof node !== "object") return output;

  const nextContext = {
    ...context,
    institution: institutionFromRecord(node, context.institution)
  };
  const rate = toPercentRate(findNumericValue(node, RATE_KEYS));
  const termInMonths = normalizeTermMonths(node);

  if (rate !== null && termInMonths !== null && TARGET_TERMS.includes(termInMonths)) {
    output.push({
      institution: nextContext.institution || "Unknown lender",
      termInMonths,
      rate
    });
  }

  Object.entries(node).forEach(([key, value]) => {
    if (key !== "metadata" && key !== "errors") extractRateRecords(value, nextContext, output);
  });

  return output;
}

function ratesApiTermsAreUnverified(payload) {
  const terms = String(payload?.termsOfUse || "").toLowerCase();
  return terms.includes("interest.co.nz") || terms.includes("not guaranteed");
}

export function normalizeMortgageRatesResponse(payload) {
  if (ratesApiTermsAreUnverified(payload)) {
    return {
      ...LOCAL_BANK_RATE_WORKSHEET,
      status: "unverified-api",
      source: LOCAL_BANK_RATE_WORKSHEET.source,
      note: `${LOCAL_BANK_RATE_WORKSHEET.note} Rates API terms say its data is retrieved from interest.co.nz and is not guaranteed.`,
      apiTermsOfUse: payload.termsOfUse,
      rawRecords: []
    };
  }

  const records = extractRateRecords(payload);
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
      lenderCount: new Set(rates.map((record) => record.institution)).size
    };
  }).filter(Boolean);

  return {
    rates: mergeLiveRatesWithFallback(liveRates),
    verificationStatus: "api-no-warning",
    rawRecords: records
  };
}

function mergeLiveRatesWithFallback(liveRates) {
  return LOCAL_BANK_RATE_WORKSHEET.rates.map((fallbackRate) => {
    const liveRate = liveRates.find((rate) => rate.termInMonths === fallbackRate.termInMonths);
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
