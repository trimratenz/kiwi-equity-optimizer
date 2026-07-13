import { json, method, safeError } from "../../api/_lib/http.js";
import { refreshOcrSnapshot } from "../../api/_lib/refresh.js";
import { requireCron } from "../../api/_lib/security.js";
export default async function handler(request, response) { if (!method(request, response, "GET")) return; if (!requireCron(request)) return json(response, 401, { error: "Cron authentication required." }); try { json(response, 200, { ok: true, result: await refreshOcrSnapshot() }); } catch (error) { console.error(error); safeError(response); } }
