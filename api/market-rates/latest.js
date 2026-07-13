import { json, method, safeError } from "../_lib/http.js";
import { select } from "../_lib/supabase.js";

const TERMS = new Map([[0, "Floating"], [6, "6 months"], [12, "1 year"], [18, "18 months"], [24, "2 years"], [36, "3 years"], [48, "4 years"], [60, "5 years"]]);

export default async function handler(request, response) {
  if (!method(request, response, "GET")) return;
  try {
    const rows = await select("market_rate_snapshots", "select=*&order=snapshot_date.desc,created_at.desc&limit=100");
    const latestByTerm = new Map();
    rows.forEach((row) => { if (!latestByTerm.has(row.fixed_term)) latestByTerm.set(row.fixed_term, row); });
    const latest = [...latestByTerm.values()].sort((a, b) => a.fixed_term - b.fixed_term);
    if (!latest.length) return json(response, 503, { error: "Market rates are temporarily unavailable." });
    const captured = latest.reduce((newest, row) => newest > row.snapshot_date ? newest : row.snapshot_date, "");
    json(response, 200, {
      rates: latest.map((row) => ({ term: TERMS.get(row.fixed_term) || `${row.fixed_term} months`, termInMonths: row.fixed_term, rate: Number(row.average_rate), lenderCount: row.bank_count, banks: row.included_banks || [], snapshotId: `${row.snapshot_date}:${row.fixed_term}` })),
      snapshotId: `market-rates-${captured}`,
      captured,
      lastRefreshed: captured,
      source: "TrimRate five-bank market snapshot",
      note: "Rates are estimates from the latest saved market snapshot. Confirm final rates with the lender.",
      warnings: [],
      status: "saved"
    });
  } catch (error) { console.error("market rates latest", error); safeError(response); }
}
