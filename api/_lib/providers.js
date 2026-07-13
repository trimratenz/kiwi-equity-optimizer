// Providers are deliberately isolated so fragile source-specific scrapers can be replaced independently.
const RATES_API_URL = "https://ratesapi.nz/api/v1/mortgage-rates";
const RBNZ_OCR_URL = "https://www.rbnz.govt.nz/monetary-policy/about-monetary-policy/the-official-cash-rate";
const RBNZ_MPS_URL = "https://www.rbnz.govt.nz/monetary-policy/monetary-policy-statement";
const TERMS = [0, 6, 12, 18, 24, 36, 48, 60];
const BANK_IDS = new Set(["institution:anz", "institution:asb", "institution:bnz", "institution:kiwibank", "institution:westpac"]);

export async function fetchMarketRateRecords() {
  try {
    const response = await fetch(RATES_API_URL, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Rates API returned ${response.status}`);
    const payload = await response.json();
    const records = (payload.data || []).filter((bank) => BANK_IDS.has(bank.id)).flatMap((bank) =>
      TERMS.map((term) => pickRate(bank, term)).filter(Boolean)
    );
    if (records.length < 5) throw new Error("Rates API did not include enough selected-bank rates");
    return { records, sourceUrl: RATES_API_URL, sourceDate: dateOnly(payload.lastUpdated || new Date()), provider: "rates-api" };
  } catch (error) {
    console.warn("TrimRate market rate provider failed; using manual fallback", error.message);
    return { records: manualMarketRates(), sourceUrl: "", sourceDate: dateOnly(new Date()), provider: "manual-fallback" };
  }
}

export async function fetchOcrSnapshot() {
  // TODO: Add a resilient RBNZ MPS chart/table parser. The fallback preserves the last known manual track.
  try {
    const response = await fetch(RBNZ_OCR_URL, { headers: { accept: "text/html" } });
    if (!response.ok) throw new Error(`RBNZ OCR page returned ${response.status}`);
    const html = await response.text();
    const match = html.match(/(?:Official Cash Rate|OCR)[^\d]{0,120}(\d(?:\.\d+)?)\s*%/i);
    if (!match) throw new Error("Unable to parse current OCR");
    const manualSnapshot = manualOcrSnapshot();
    return {
      ...manualSnapshot,
      currentOcr: Number(match[1]),
      sourceUrl: RBNZ_OCR_URL,
      // Do not present today's OCR page as a newer forecast document. The stored MPS date
      // keeps refreshes from overwriting a newer forecast track until a robust MPS parser exists.
      sourceDate: manualSnapshot.sourceDate,
      sourceName: "Reserve Bank of New Zealand OCR"
    };
  } catch (error) {
    console.warn("TrimRate OCR provider failed; using manual fallback", error.message);
    return manualOcrSnapshot();
  }
}

function pickRate(bank, months) {
  const candidates = (bank.products || []).flatMap((product) => (product.rates || []).map((rate) => ({ product, rate })));
  const matching = candidates
    .filter(({ rate }) => termMonths(rate) === months && rateValue(rate) !== null)
    .sort((a, b) => score(a.product) - score(b.product));
  const selected = matching[0];
  if (!selected) return null;
  return { bankName: bank.name || bank.id, fixedTerm: months, rate: rateValue(selected.rate), rateType: /special/i.test(`${selected.product.name || ""} ${selected.product.id || ""}`) ? "special" : "standard" };
}

function termMonths(rate) {
  const direct = Number(rate.termInMonths ?? rate.termMonths ?? rate.fixedTermMonths ?? rate.months);
  if (Number.isFinite(direct)) return direct;
  const text = String(rate.term || rate.termLabel || rate.name || "").toLowerCase();
  if (text.includes("floating") || text.includes("variable")) return 0;
  const months = text.match(/(\d+)\s*month/);
  const years = text.match(/(\d+)\s*year/);
  return months ? Number(months[1]) : years ? Number(years[1]) * 12 : null;
}

function rateValue(rate) {
  const value = Number(rate.rate ?? rate.interestRate ?? rate.advertisedRate ?? rate.standardRate ?? rate.specialRate);
  return Number.isFinite(value) && value > 0 ? (value <= 1 ? value * 100 : value) : null;
}

function score(product) {
  const text = `${product.id || ""} ${product.name || ""}`.toLowerCase();
  return text.includes("special") ? 0 : text.includes("standard") ? 1 : 2;
}

function manualMarketRates() {
  const averages = { 0: 5.81, 6: 4.68, 12: 4.73, 18: 5.12, 24: 5.24, 36: 5.35, 48: 5.47, 60: 5.57 };
  const banks = ["ANZ", "ASB", "BNZ", "Kiwibank", "Westpac"];
  return Object.entries(averages).flatMap(([fixedTerm, average]) => banks.map((bank) => ({ bankName: bank, fixedTerm: Number(fixedTerm), rate: average, rateType: "manual" })));
}

function manualOcrSnapshot() {
  return {
    sourceName: "RBNZ Monetary Policy Statement manual fallback",
    sourceUrl: RBNZ_MPS_URL,
    sourceDate: "2026-06-03",
    currentOcr: 2.5,
    forecastPoints: [
      { date: "2026-06-30", ocr: 2.3 }, { date: "2026-09-30", ocr: 2.5 }, { date: "2026-12-31", ocr: 2.8 },
      { date: "2027-03-31", ocr: 3.0 }, { date: "2027-06-30", ocr: 3.1 }, { date: "2027-09-30", ocr: 3.1 },
      { date: "2027-12-31", ocr: 3.1 }, { date: "2028-03-31", ocr: 3.2 }, { date: "2028-06-30", ocr: 3.2 }
    ]
  };
}

function dateOnly(value) { return new Date(value).toISOString().slice(0, 10); }
