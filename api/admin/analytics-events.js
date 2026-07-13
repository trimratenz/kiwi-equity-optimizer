import { requireAdmin } from "../_lib/admin.js";
import { json, method, safeError } from "../_lib/http.js";
import { select } from "../_lib/supabase.js";
export default async function handler(request, response) { if (!method(request, response, "GET") || !requireAdmin(request, response)) return; try { json(response, 200, { rows: await select("analytics_events", "select=*&order=created_at.desc&limit=500") }); } catch (error) { console.error(error); safeError(response); } }
