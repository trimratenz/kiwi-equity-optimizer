import { json } from "./http.js";
import { isAdmin } from "./security.js";

export function requireAdmin(request, response) {
  if (isAdmin(request)) return true;
  json(response, 401, { error: "Admin authentication required." });
  return false;
}

export function csv(rows, columns) {
  return [columns.join(","), ...rows.map((row) => columns.map((column) => cell(row[column])).join(","))].join("\n");
}

function cell(value) {
  const text = typeof value === "object" ? JSON.stringify(value ?? {}) : String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
