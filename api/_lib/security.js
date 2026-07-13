import { createHmac, timingSafeEqual } from "node:crypto";
import { cleanText, clientIp } from "./http.js";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const buckets = new Map();

export function requireCron(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
  return Boolean(process.env.CRON_SECRET && timingSafeEquals(token, process.env.CRON_SECRET));
}

export function rateLimit(request, limit = 5, scope = "public") {
  const key = `${scope}:${clientIp(request)}`;
  const now = Date.now();
  const recent = (buckets.get(key) || []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= limit) return false;
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

export function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(value, 254));
}

function secret() {
  return process.env.ADMIN_PASSWORD || "";
}

export function createAdminSession() {
  const expires = Date.now() + 8 * 60 * 60 * 1000;
  const value = `${expires}.${sign(String(expires))}`;
  return { value, expires };
}

export function isAdmin(request) {
  const cookie = parseCookies(request.headers.cookie || "").trimrate_admin || "";
  const [expires, signature] = cookie.split(".");
  return Boolean(expires && signature && Number(expires) > Date.now() && timingSafeEquals(signature, sign(expires)));
}

export function authenticateAdmin(email, password) {
  const adminEmail = cleanText(process.env.ADMIN_EMAIL, 254);
  const adminPassword = secret();
  if (!adminEmail || !adminPassword) return false;
  return timingSafeEquals(cleanText(email, 254), adminEmail) && timingSafeEquals(String(password || ""), adminPassword);
}

export function adminCookie(value, expires) {
  return `trimrate_admin=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${new Date(expires).toUTCString()}`;
}

export function clearedAdminCookie() {
  return "trimrate_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}

function sign(value) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function parseCookies(header) {
  return Object.fromEntries(header.split(";").map((item) => item.trim().split("=")).filter(([key]) => key));
}

function timingSafeEquals(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}
