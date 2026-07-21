import { createHmac, timingSafeEqual } from "node:crypto";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const buckets = new Map();
const RATES_API_URL = "https://ratesapi.nz/api/v1/mortgage-rates";
const FIVE_BANK_IDS = new Set(["institution:anz", "institution:asb", "institution:bnz", "institution:kiwibank", "institution:westpac"]);

export function deploymentEnvironment() {
  const value = String(process.env.TRIMRATE_ENV || process.env.VERCEL_ENV || "development").toLowerCase();
  return value === "production" ? "production" : value === "preview" ? "preview" : "development";
}
export function isProductionEnvironment() { return deploymentEnvironment() === "production"; }
export function allowNonProductionWrites() { return process.env.TRIMRATE_ALLOW_NONPROD_WRITES === "true"; }
export function canPersistPublicData() { return isProductionEnvironment() || allowNonProductionWrites(); }
export function canUseAdminTest() { return !isProductionEnvironment() || process.env.ADMIN_TEST_ENABLED === "true"; }

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

function googleSheetsSettings() {
  const url = cleanText(process.env.GOOGLE_SHEETS_WEBHOOK_URL, 500);
  const secret = String(process.env.GOOGLE_SHEETS_WEBHOOK_SECRET || "");
  if (!url || !secret) throw new Error("Google Sheets webhook is not configured.");
  return { url, secret };
}
export async function appendGoogleSheet(action, data) {
  const { url, secret } = googleSheetsSettings();
  const payload = JSON.stringify({ action, data, timestamp: new Date().toISOString() });
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  const response = await fetch(url, {
    method: "POST",
    redirect: "follow",
    headers: { "content-type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ payload, signature })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Google Sheets webhook failed (${response.status}): ${text.slice(0, 300)}`);
  if (!text) return;
  try {
    const result = JSON.parse(text);
    if (result.ok === false) throw new Error(result.error || "Google Sheets rejected the request.");
  } catch (error) {
    if (error instanceof SyntaxError) return;
    throw error;
  }
}
export function appendLead(row) { return appendGoogleSheet("lead", { ...row, id: cleanText(row.id, 120) || crypto.randomUUID(), created_at: new Date().toISOString() }); }
export function appendAnalyticsEvent(row) { return appendGoogleSheet("activity", { ...row, id: cleanText(row.id, 120) || crypto.randomUUID(), created_at: new Date().toISOString() }); }

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

// The calculator fetches Rates API directly. This daily production cron is a
// health check for the five-bank source, not a database refresh.
export async function refreshMarketRates() {
  const response = await fetch(RATES_API_URL, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Rates API returned ${response.status}.`);
  const payload = await response.json();
  const banks = (payload.data || []).filter((bank) => FIVE_BANK_IDS.has(bank.id));
  if (banks.length !== FIVE_BANK_IDS.size) throw new Error("Rates API did not return all five required banks.");
  return {
    healthy: true,
    provider: "Rates API",
    checkedAt: new Date().toISOString(),
    sourceUpdatedAt: payload.lastUpdated || payload.timestamp || null,
    banks: banks.map((bank) => bank.name || bank.id)
  };
}
