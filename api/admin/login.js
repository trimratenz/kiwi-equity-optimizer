import { cleanText, json, method } from "../_lib/http.js";
import { adminCookie, authenticateAdmin, createAdminSession, rateLimit } from "../_lib/security.js";

export default function handler(request, response) {
  if (!method(request, response, "POST")) return;
  if (!rateLimit(request, 10, "admin-login")) return json(response, 429, { error: "Too many sign-in attempts. Please try again later." });
  const { email, password } = request.body || {};
  if (!authenticateAdmin(email, password)) return json(response, 401, { error: "Invalid email or password." });
  const session = createAdminSession();
  response.setHeader("set-cookie", adminCookie(session.value, session.expires));
  json(response, 200, { ok: true, email: cleanText(email, 254) });
}
