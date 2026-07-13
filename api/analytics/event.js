import { cleanObject, cleanText, json, method, safeError } from "../_lib/http.js";
import { insert } from "../_lib/supabase.js";

const EVENTS = new Set(["page_view", "calculator_started", "step_1_completed", "step_2_completed", "step_3_viewed", "step_4_viewed", "step_5_viewed", "step_6_completed", "summary_viewed", "summary_exported", "lead_form_started", "consent_checked", "lead_submitted", "lead_submit_failed", "reset_clicked"]);

export default async function handler(request, response) {
  if (!method(request, response, "POST")) return;
  try {
    const body = request.body || {};
    if (!EVENTS.has(body.event_name || body.eventName)) return json(response, 400, { error: "Unsupported event." });
    const eventName = body.event_name || body.eventName;
    const step = Number(body.step_number || stepFor(eventName));
    const sessionId = cleanText(body.session_id || body.sessionId, 120);
    if (!sessionId) return json(response, 400, { error: "Anonymous session ID is required." });
    await insert("analytics_events", {
      session_id: sessionId, event_name: eventName,
      page_path: cleanText(body.page_path || body.path, 250) || "/", step_number: Number.isInteger(step) && step > 0 ? step : null,
      step_name: cleanText(body.step_name, 100), metadata: cleanObject(body.metadata || body.payload),
      device_type: device(request.headers["user-agent"] || ""), referrer: cleanText(body.referrer, 500)
    });
    json(response, 201, { ok: true });
  } catch (error) { console.error("analytics event", error); safeError(response); }
}

function stepFor(event) { const hit = event.match(/^step_(\d)_/); return hit ? Number(hit[1]) : 0; }
function device(agent) { return /mobile/i.test(agent) ? "mobile" : /tablet|ipad/i.test(agent) ? "tablet" : "desktop"; }
