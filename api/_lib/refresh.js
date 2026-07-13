import { insert, select } from "./supabase.js";
import { fetchMarketRateRecords, fetchOcrSnapshot } from "./providers.js";

export async function refreshMarketRates() {
  const source = await fetchMarketRateRecords();
  if (source.provider === "manual-fallback") {
    const existing = await select("market_rate_snapshots", "select=id&order=created_at.desc&limit=1");
    if (existing.length) return { updated: false, provider: source.provider, reason: "Provider refresh failed; keeping the latest valid saved snapshot." };
  }
  const fetchedAt = new Date().toISOString();
  await insert("market_rates", source.records.map((row) => ({ bank_name: row.bankName, fixed_term: row.fixedTerm, rate: row.rate, rate_type: row.rateType, source_url: source.sourceUrl, source_date: source.sourceDate, fetched_at: fetchedAt })));
  const groups = new Map();
  source.records.forEach((row) => groups.set(row.fixedTerm, [...(groups.get(row.fixedTerm) || []), row]));
  const snapshots = [...groups.entries()].map(([term, records]) => ({ fixed_term: term, average_rate: round(records.reduce((sum, item) => sum + item.rate, 0) / records.length), bank_count: new Set(records.map((item) => item.bankName)).size, included_banks: [...new Set(records.map((item) => item.bankName))], snapshot_date: source.sourceDate }));
  await insert("market_rate_snapshots", snapshots);
  return { updated: true, provider: source.provider, fetchedAt, snapshots };
}

export async function refreshOcrSnapshot() {
  const incoming = await fetchOcrSnapshot();
  const existing = await select("ocr_snapshots", "select=source_date&order=source_date.desc&limit=1");
  if (existing[0]?.source_date && existing[0].source_date >= incoming.sourceDate) return { updated: false, sourceDate: existing[0].source_date };
  const [row] = await insert("ocr_snapshots", { source_name: incoming.sourceName, source_url: incoming.sourceUrl, source_date: incoming.sourceDate, current_ocr: incoming.currentOcr, forecast_points: incoming.forecastPoints, fetched_at: new Date().toISOString() });
  return { updated: true, snapshot: row };
}

function round(value) { return Math.round(value * 1000) / 1000; }
