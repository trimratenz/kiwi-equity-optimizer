import { createHmac, timingSafeEqual } from "node:crypto";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const buckets = new Map();

export function json(response, status, body, headers = {}) {
  Object.entries({ "cache-control": "no-store", ...headers }).forEach(([key, value]) => response.setHeader(key, value));
  response.status(status).json(body);
}

export function method(request, response, expected) {
  if (request.method === expected) return true;
  json(response, 405, { error: "Method not allowed." }, { allow: expected });
  return false;
}

export function safeError(response) { json(response, 500, { error: "Something went wrong. Please try again." }); }
export function cleanText(value, max = 500) { return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max); }
export function cleanObject(value, maxKeys = 30) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, maxKeys).map(([key, item]) => [cleanText(key, 60), cleanValue(item)]));
}
function cleanValue(value) {
  if (typeof value === "string") return cleanText(value, 500);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(cleanValue);
  return value && typeof value === "object" ? cleanObject(value, 20) : "";
}
function clientIp(request) { return cleanText(String(request.headers["x-forwarded-for"] || "").split(",")[0], 100) || "unknown"; }

export function rateLimit(request, limit = 5, scope = "public") {
  const key = `${scope}:${clientIp(request)}`;
  const now = Date.now();
  const recent = (buckets.get(key) || []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= limit) return false;
  recent.push(now); buckets.set(key, recent); return true;
}
export function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(value, 254)); }

function timingSafeEquals(left, right) {
  const a = Buffer.from(String(left)); const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}
function adminSecret() { return process.env.ADMIN_PASSWORD || ""; }
function sign(value) { return createHmac("sha256", adminSecret()).update(value).digest("base64url"); }
function cookies(header) { return Object.fromEntries(header.split(";").map((item) => item.trim().split("=")).filter(([key]) => key)); }
export function authenticateAdmin(email, password) {
  const configuredEmail = cleanText(process.env.ADMIN_EMAIL, 254); const configuredPassword = adminSecret();
  return Boolean(configuredEmail && configuredPassword && timingSafeEquals(cleanText(email, 254), configuredEmail) && timingSafeEquals(String(password || ""), configuredPassword));
}
export function createAdminSession() { const expires = Date.now() + 8 * 60 * 60 * 1000; return { value: `${expires}.${sign(String(expires))}`, expires }; }
export function isAdmin(request) {
  const [expires, signature] = (cookies(request.headers.cookie || "").trimrate_admin || "").split(".");
  return Boolean(expires && signature && Number(expires) > Date.now() && timingSafeEquals(signature, sign(expires)));
}
export function adminCookie(value, expires) { return `trimrate_admin=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${new Date(expires).toUTCString()}`; }
export function clearedAdminCookie() { return "trimrate_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"; }
export function requireCron(request) { const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") || ""; return Boolean(process.env.CRON_SECRET && timingSafeEquals(token, process.env.CRON_SECRET)); }

function settings() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase server environment is not configured.");
  return { url: url.replace(/\/$/, ""), serviceKey };
}
export async function supabase(path, options = {}) {
  const config = settings();
  const response = await fetch(`${config.url}/rest/v1/${path}`, { ...options, headers: { apikey: config.serviceKey, authorization: `Bearer ${config.serviceKey}`, "content-type": "application/json", ...(options.headers || {}) } });
  const text = await response.text(); const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`Supabase request failed (${response.status})`);
  return data;
}
export function insert(table, row) { return supabase(table, { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify(row) }); }
export function select(table, query = "") { return supabase(`${table}${query ? `?${query}` : ""}`); }

const TERMS = [0, 6, 12, 18, 24, 36, 48, 60];
const BANK_IDS = new Set(["institution:anz", "institution:asb", "institution:bnz", "institution:kiwibank", "institution:westpac"]);
const RATES_API_URL = "https://ratesapi.nz/api/v1/mortgage-rates";
const RBNZ_OCR_URL = "https://www.rbnz.govt.nz/monetary-policy/about-monetary-policy/the-official-cash-rate";
const RBNZ_MPS_URL = "https://www.rbnz.govt.nz/monetary-policy/monetary-policy-statement";
export async function refreshMarketRates() {
  const source = await marketSource();
  if (source.provider === "manual-fallback") { const existing = await select("market_rate_snapshots", "select=id&order=created_at.desc&limit=1"); if (existing.length) return { updated: false, provider: source.provider, reason: "Provider refresh failed; keeping the latest valid saved snapshot." }; }
  const fetchedAt = new Date().toISOString();
  await insert("market_rates", source.records.map((row) => ({ bank_name: row.bankName, fixed_term: row.fixedTerm, rate: row.rate, rate_type: row.rateType, source_url: source.sourceUrl, source_date: source.sourceDate, fetched_at: fetchedAt })));
  const groups = new Map(); source.records.forEach((row) => groups.set(row.fixedTerm, [...(groups.get(row.fixedTerm) || []), row]));
  const snapshots = [...groups.entries()].map(([term, rows]) => ({ fixed_term: term, average_rate: round(rows.reduce((sum, row) => sum + row.rate, 0) / rows.length), bank_count: new Set(rows.map((row) => row.bankName)).size, included_banks: [...new Set(rows.map((row) => row.bankName))], snapshot_date: source.sourceDate }));
  await insert("market_rate_snapshots", snapshots); return { updated: true, provider: source.provider, fetchedAt, snapshots };
}
export async function refreshOcrSnapshot() {
  const incoming = await ocrSource(); const existing = await select("ocr_snapshots", "select=source_date,fetched_at&order=fetched_at.desc&limit=1");
  const reviewedThisMonth = existing[0]?.fetched_at && sameCalendarMonth(existing[0].fetched_at, new Date());
  if (reviewedThisMonth) return { updated: false, sourceDate: existing[0].source_date, reason: "OCR forecast already reviewed this month." };
  const [snapshot] = await insert("ocr_snapshots", { source_name: incoming.sourceName, source_url: incoming.sourceUrl, source_date: incoming.sourceDate, current_ocr: incoming.currentOcr, forecast_points: incoming.forecastPoints, fetched_at: new Date().toISOString() }); return { updated: true, snapshot };
}
async function marketSource() {
  try { const response = await fetch(RATES_API_URL, { headers: { accept: "application/json" } }); if (!response.ok) throw new Error("Rate provider failed"); const payload = await response.json(); const records = (payload.data || []).filter((bank) => BANK_IDS.has(bank.id)).flatMap((bank) => TERMS.map((term) => pickRate(bank, term)).filter(Boolean)); if (records.length < 5) throw new Error("Insufficient rates"); return { records, sourceUrl: RATES_API_URL, sourceDate: dateOnly(payload.lastUpdated || new Date()), provider: "rates-api" }; } catch { return { records: manualRates(), sourceUrl: "", sourceDate: dateOnly(new Date()), provider: "manual-fallback" }; }
}
async function ocrSource() {
  const manual = manualOcr();
  try { const response = await fetch(RBNZ_OCR_URL, { headers: { accept: "text/html" } }); if (!response.ok) throw new Error("OCR provider failed"); const html = await response.text(); const match = html.match(/(?:Official Cash Rate|OCR)[^\d]{0,120}(\d(?:\.\d+)?)\s*%/i); if (!match) throw new Error("OCR parse failed"); return { ...manual, currentOcr: Number(match[1]), sourceUrl: RBNZ_OCR_URL, sourceName: "Reserve Bank of New Zealand OCR" }; } catch { return manual; }
}
function pickRate(bank, months) { const candidates = (bank.products || []).flatMap((product) => (product.rates || []).map((rate) => ({ product, rate }))).filter(({ rate }) => termMonths(rate) === months && rateValue(rate) !== null).sort((a, b) => score(a.product) - score(b.product)); const selected = candidates[0]; return selected ? { bankName: bank.name || bank.id, fixedTerm: months, rate: rateValue(selected.rate), rateType: /special/i.test(`${selected.product.name || ""} ${selected.product.id || ""}`) ? "special" : "standard" } : null; }
function termMonths(rate) { const direct = Number(rate.termInMonths ?? rate.termMonths ?? rate.fixedTermMonths ?? rate.months); if (Number.isFinite(direct)) return direct; const text = String(rate.term || rate.termLabel || rate.name || "").toLowerCase(); if (text.includes("floating") || text.includes("variable")) return 0; const months = text.match(/(\d+)\s*month/); const years = text.match(/(\d+)\s*year/); return months ? Number(months[1]) : years ? Number(years[1]) * 12 : null; }
function rateValue(rate) { const value = Number(rate.rate ?? rate.interestRate ?? rate.advertisedRate ?? rate.standardRate ?? rate.specialRate); return Number.isFinite(value) && value > 0 ? (value <= 1 ? value * 100 : value) : null; }
function score(product) { const text = `${product.id || ""} ${product.name || ""}`.toLowerCase(); return text.includes("special") ? 0 : text.includes("standard") ? 1 : 2; }
function manualRates() { const averages = { 0: 5.81, 6: 4.68, 12: 4.73, 18: 5.12, 24: 5.24, 36: 5.35, 48: 5.47, 60: 5.57 }; return Object.entries(averages).flatMap(([fixedTerm, rate]) => ["ANZ", "ASB", "BNZ", "Kiwibank", "Westpac"].map((bankName) => ({ bankName, fixedTerm: Number(fixedTerm), rate, rateType: "manual" }))); }
function manualOcr() { return { sourceName: "RBNZ Monetary Policy Statement manual fallback", sourceUrl: RBNZ_MPS_URL, sourceDate: "2026-06-03", currentOcr: 2.5, forecastPoints: [{ date: "2026-06-30", ocr: 2.3 }, { date: "2026-09-30", ocr: 2.5 }, { date: "2026-12-31", ocr: 2.8 }, { date: "2027-03-31", ocr: 3.0 }, { date: "2027-06-30", ocr: 3.1 }, { date: "2027-09-30", ocr: 3.1 }, { date: "2027-12-31", ocr: 3.1 }, { date: "2028-03-31", ocr: 3.2 }, { date: "2028-06-30", ocr: 3.2 }] }; }
function dateOnly(value) { return new Date(value).toISOString().slice(0, 10); }
function sameCalendarMonth(value, date) { const left = new Date(value); return !Number.isNaN(left.getTime()) && left.getUTCFullYear() === date.getUTCFullYear() && left.getUTCMonth() === date.getUTCMonth(); }
function round(value) { return Math.round(value * 1000) / 1000; }
