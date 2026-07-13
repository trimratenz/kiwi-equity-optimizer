export function json(response, status, body, headers = {}) {
  Object.entries({ "cache-control": "no-store", ...headers }).forEach(([key, value]) => response.setHeader(key, value));
  response.status(status).json(body);
}

export function method(request, response, expected) {
  if (request.method === expected) return true;
  json(response, 405, { error: "Method not allowed." }, { allow: expected });
  return false;
}

export function safeError(response) {
  json(response, 500, { error: "Something went wrong. Please try again." });
}

export function cleanText(value, max = 500) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

export function cleanObject(value, maxKeys = 30) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, maxKeys).map(([key, item]) => [cleanText(key, 60), cleanValue(item)]));
}

function cleanValue(value) {
  if (typeof value === "string") return cleanText(value, 500);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(cleanValue);
  if (value && typeof value === "object") return cleanObject(value, 20);
  return "";
}

export function clientIp(request) {
  return cleanText(String(request.headers["x-forwarded-for"] || "").split(",")[0], 100) || "unknown";
}
