import { json, method } from "../_lib/http.js";
import { clearedAdminCookie } from "../_lib/security.js";

export default function handler(request, response) {
  if (!method(request, response, "POST")) return;
  response.setHeader("set-cookie", clearedAdminCookie());
  json(response, 200, { ok: true });
}
