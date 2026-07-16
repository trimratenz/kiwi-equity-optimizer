import { appendAnalyticsEvent, appendLead, canPersistPublicData, cleanObject, cleanText, deploymentEnvironment, json, method, rateLimit, safeError, validEmail } from "../serverless/core.js";

const EVENTS = new Set(["page_view", "calculator_started", "step_1_completed", "step_2_completed", "step_3_viewed", "step_4_viewed", "step_5_viewed", "step_6_completed", "summary_viewed", "summary_exported", "lead_form_started", "consent_checked", "lead_submitted", "lead_submit_failed", "reset_clicked", "activity_updated"]);

export default async function handler(request, response) {
  const route = request.query?.route;
  if (route === "adviser-review-request") return adviserRequest(request, response);
  if (route === "analytics/event") return analyticsEvent(request, response);
  return json(response, 404, { error: "Not found." });
}

async function adviserRequest(request, response) {
  if (!method(request, response, "POST")) return;
  try {
    const body = request.body || {};
    if (cleanText(body.website, 200)) return json(response, 202, { ok: true });
    if (!rateLimit(request)) return json(response, 429, { error: "Too many requests. Please try again later." });
    const contact = cleanObject(body.contact);
    const consent = cleanObject(body.consent);
    const consentGiven = consent.privacyConsent === true || consent.adviserContactConsent === true || body.consent_given === true;
    if (!consentGiven) return json(response, 400, { error: "Consent is required before submitting your request." });
    if (!cleanText(contact.name, 120) || !validEmail(contact.email) || cleanText(contact.phone, 40).replace(/\D/g, "").length < 7) return json(response, 400, { error: "Enter your name, a valid email address, and a valid phone number." });
    const summary = cleanObject(body.summaryPayload || body.calculated_summary);
    if (!Object.keys(summary).length) return json(response, 400, { error: "Your calculator summary is required." });
    if (!canPersistPublicData()) return json(response, 202, { ok: true, preview: true, stored: false, message: "Preview submission accepted but not stored." });
    const sessionId = cleanText(body.session_id, 120);
    await appendLead({ session_id: sessionId, name: cleanText(contact.name, 120), email: cleanText(contact.email, 254).toLowerCase(), phone: cleanText(contact.phone, 40), property_address: cleanText(contact.propertyAddress, 300), current_bank: cleanText(contact.currentBank, 120), preferred_contact_method: cleanText(contact.preferredContactMethod, 30), consent_given: true, loan_details: cleanObject(body.loan_details || summary.inputs), calculated_summary: cleanObject(body.calculated_summary || summary.outputs), market_comparison: cleanObject(body.market_comparison || summary.marketComparison), ocr_forecast_summary: cleanObject(body.ocr_forecast_summary || summary.refixScenario), user_notes: cleanText(body.user_notes || contact.userNotes, 2000), referral_status: "new" });
    await appendAnalyticsEvent({ session_id: sessionId, visitor_id: cleanText(body.visitor_id, 120), event_name: "lead_submitted", page_path: cleanText(body.page_path, 250) || "/", step_number: 6, step_name: "Lead submitted", activity: { inputs: cleanObject(summary.inputs), outputs: cleanObject(summary.outputs) } });
    json(response, 201, { ok: true, preview: deploymentEnvironment() !== "production", stored: true, message: "Your review request has been received." });
  } catch (error) { console.error("adviser review request", error); safeError(response); }
}

async function analyticsEvent(request, response) {
  if (!method(request, response, "POST")) return;
  try {
    const body = request.body || {};
    const eventName = body.event_name || body.eventName;
    if (!EVENTS.has(eventName)) return json(response, 400, { error: "Unsupported event." });
    const sessionId = cleanText(body.session_id || body.sessionId, 120);
    if (!sessionId) return json(response, 400, { error: "Anonymous session ID is required." });
    if (!canPersistPublicData()) return json(response, 202, { ok: true, preview: true });
    const step = Number(body.step_number || (eventName.match(/^step_(\d)_/)?.[1] || 0));
    await appendAnalyticsEvent({ session_id: sessionId, visitor_id: cleanText(body.visitor_id || body.visitorId, 120), event_name: eventName, page_path: cleanText(body.page_path || body.path, 250) || "/", step_number: Number.isInteger(step) && step > 0 ? step : null, step_name: cleanText(body.step_name, 100), activity: cleanActivity(body.metadata || body.payload), device_type: /mobile/i.test(request.headers["user-agent"] || "") ? "mobile" : "desktop", referrer: cleanText(body.referrer, 500) });
    json(response, 201, { ok: true });
  } catch (error) { console.error("analytics event", error); safeError(response); }
}
function cleanActivity(value) { const activity = cleanObject(cleanObject(value).activity, 10); return { inputs: cleanObject(activity.inputs, 30), outputs: cleanObject(activity.outputs, 30) }; }
