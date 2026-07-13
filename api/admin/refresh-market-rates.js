import { requireAdmin } from "../_lib/admin.js";
import { json, method, safeError } from "../_lib/http.js";
import { refreshMarketRates } from "../_lib/refresh.js";
export default async function handler(request, response) { if (!method(request, response, "POST") || !requireAdmin(request, response)) return; try { json(response, 200, { ok: true, result: await refreshMarketRates() }); } catch (error) { console.error(error); safeError(response); } }
