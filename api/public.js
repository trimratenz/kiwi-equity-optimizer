import { appendAnalyticsEvent, appendLead, canPersistPublicData, cleanObject, cleanText, deploymentEnvironment, json, method, rateLimit, safeError, validEmail } from "../serverless/core.js";

const EVENTS = new Set(["page_view", "calculator_started", "step_1_completed", "step_2_completed", "step_3_viewed", "step_4_viewed", "step_5_viewed", "step_6_completed", "summary_viewed", "summary_exported", "lead_form_started", "consent_checked", "lead_submitted", "lead_submit_failed", "reset_clicked", "activity_updated"]);

export default async function handler(request, response) {
  const route = request.query?.route;
  if (route === "adviser-review-request") return adviserRequest(request, response);
  if (route === "analytics/event") return analyticsEvent(request, response);
  return json(response, 404, { error: "Not found." });
}

export async function adviserRequest(request, response, dependencies = {}) {
  if (!method(request, response, "POST")) return;
  try {
    const body = request.body || {};
    if (cleanText(body.website, 200)) return json(response, 202, { ok: true });
    if (!(dependencies.rateLimit || rateLimit)(request)) return json(response, 429, { error: "Too many requests. Please try again later." });
    const validated = validateAdviserRequest(body);
    if (validated.error) return json(response, 400, { error: validated.error });
    const { contact, consent, summary } = validated;
    if (!(dependencies.canPersistPublicData || canPersistPublicData)()) return json(response, 202, { ok: true, preview: true, stored: false, message: "Preview submission accepted but not stored." });
    const lead = buildLeadSheetRecord(body, contact, consent, summary, deviceType(request));
    await (dependencies.appendLead || appendLead)(lead);
    // A lead is safely stored once its webhook write succeeds. Activity reporting must not turn that success into a retry/duplicate lead.
    try { await (dependencies.appendAnalyticsEvent || appendAnalyticsEvent)(buildLeadActivityRecord(lead, summary)); } catch (error) { console.error("lead activity tracking", error); }
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
    const activity = cleanActivity(body.metadata || body.payload);
    await appendAnalyticsEvent({ id: cleanText(body.activity_id || body.activityId, 120), session_id: sessionId, visitor_id: cleanText(body.visitor_id || body.visitorId, 120), event_name: eventName, page_path: cleanText(body.page_path || body.path, 250) || "/", step_number: Number.isInteger(step) && step > 0 ? step : null, step_name: cleanText(body.step_name, 100), activity, device_type: deviceType(request), referrer: cleanText(body.referrer, 500), utm_source: cleanText(body.utm_source || body.utmSource, 120), utm_medium: cleanText(body.utm_medium || body.utmMedium, 120), utm_campaign: cleanText(body.utm_campaign || body.utmCampaign, 160), market_rate_snapshot_id: cleanText(activity.marketRateSnapshotId, 160), market_rate_snapshot: cleanObject(activity.marketRateSnapshot), ocr_forecast_snapshot_id: cleanText(activity.ocrForecastSnapshotId, 160), ocr_forecast_snapshot: cleanObject(activity.ocrForecastSnapshot) });
    json(response, 201, { ok: true });
  } catch (error) { console.error("analytics event", error); safeError(response); }
}
export function validateAdviserRequest(body = {}) {
  const contact = cleanObject(body.contact);
  const consent = cleanObject(body.consent);
  const summary = cleanObject(body.summaryPayload || body.calculated_summary);
  if (consent.privacyConsent !== true || consent.adviserContactConsent !== true) return { error: "Consent is required before submitting your request." };
  if (!cleanText(consent.consentTimestamp || consent.submittedAt, 80) || !cleanText(consent.consentText, 1000)) return { error: "Please confirm consent before submitting your request." };
  if (!cleanText(contact.name, 120) || !validEmail(contact.email) || cleanText(contact.phone, 40).replace(/\D/g, "").length < 7) return { error: "Enter your name, a valid email address, and a valid phone number." };
  if (!Object.keys(summary).length) return { error: "Your calculator summary is required." };
  return { contact, consent, summary };
}

export function buildLeadSheetRecord(body, contact, consent, summary, deviceTypeValue = "desktop") {
  const consentTimestamp = cleanText(consent.consentTimestamp || consent.submittedAt, 80);
  return {
    id: cleanText(body.submission_id || body.submissionId, 120), session_id: cleanText(body.session_id || body.sessionId, 120), visitor_id: cleanText(body.visitor_id || body.visitorId, 120), page_path: cleanText(body.page_path || body.path, 250) || "/", device_type: deviceTypeValue,
    referrer: cleanText(body.referrer, 500), utm_source: cleanText(body.utm_source || body.utmSource, 120), utm_medium: cleanText(body.utm_medium || body.utmMedium, 120), utm_campaign: cleanText(body.utm_campaign || body.utmCampaign, 160),
    name: cleanText(contact.name, 120), email: cleanText(contact.email, 254).toLowerCase(), phone: cleanText(contact.phone, 40), property_address: cleanText(contact.propertyAddress, 300), current_bank: cleanText(contact.currentBank, 120), preferred_contact_method: cleanText(contact.preferredContactMethod, 30),
    consent_given: true, consent_timestamp: consentTimestamp, consent_text: cleanText(consent.consentText, 1000), submission_timestamp: cleanText(body.created_at || body.createdAt, 80) || new Date().toISOString(),
    loan_details: cleanObject(body.loan_details || summary.inputs), calculated_summary: cleanObject(body.calculated_summary || summary.outputs), market_comparison: cleanObject(body.market_comparison || summary.marketComparison), ocr_forecast_summary: cleanObject(body.ocr_forecast_summary || summary.refixScenario), user_notes: cleanText(body.user_notes || contact.userNotes, 2000), referral_status: "New",
    summary_version: cleanText(summary.summaryVersion, 120), calculation_engine_version: cleanText(summary.calculationEngineVersion, 120), market_rate_snapshot_id: cleanText(summary.ratesSnapshotId, 160), market_rate_snapshot: cleanObject(summary.marketRateSnapshot), ocr_forecast_snapshot_id: cleanText(summary.ocrSnapshotId, 160), ocr_forecast_snapshot: cleanObject(summary.ocrForecastSnapshot)
  };
}

export function buildLeadActivityRecord(lead, summary) {
  return { lead_id: lead.id, session_id: lead.session_id, visitor_id: lead.visitor_id, event_name: "lead_submitted", page_path: lead.page_path, step_number: 6, step_name: "Lead submitted", device_type: lead.device_type, referrer: lead.referrer, utm_source: lead.utm_source, utm_medium: lead.utm_medium, utm_campaign: lead.utm_campaign, market_rate_snapshot_id: lead.market_rate_snapshot_id, market_rate_snapshot: lead.market_rate_snapshot, ocr_forecast_snapshot_id: lead.ocr_forecast_snapshot_id, ocr_forecast_snapshot: lead.ocr_forecast_snapshot, activity: { inputs: cleanObject(summary.inputs), outputs: cleanObject({ ...cleanObject(summary.outputs), marketComparison: cleanObject(summary.marketComparison), refixScenario: cleanObject(summary.refixScenario) }) } };
}

function deviceType(request) { return /mobile/i.test(request.headers["user-agent"] || "") ? "mobile" : "desktop"; }
function cleanActivity(value) { const activity = cleanObject(cleanObject(value).activity, 10); return { inputs: cleanObject(activity.inputs, 30), outputs: cleanObject(activity.outputs, 30), marketRateSnapshotId: cleanText(activity.marketRateSnapshotId, 160), marketRateSnapshot: cleanObject(activity.marketRateSnapshot), ocrForecastSnapshotId: cleanText(activity.ocrForecastSnapshotId, 160), ocrForecastSnapshot: cleanObject(activity.ocrForecastSnapshot) }; }
