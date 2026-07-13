import { cleanObject, cleanText, json, method, safeError } from "./_lib/http.js";
import { insert } from "./_lib/supabase.js";
import { rateLimit, validEmail } from "./_lib/security.js";

export default async function handler(request, response) {
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
    await insert("adviser_review_requests", {
      name: cleanText(contact.name, 120), email: cleanText(contact.email, 254).toLowerCase(), phone: cleanText(contact.phone, 40),
      preferred_contact_method: cleanText(contact.preferredContactMethod, 30), consent_given: true,
      loan_details: cleanObject(body.loan_details || summary.inputs), calculated_summary: cleanObject(body.calculated_summary || summary.outputs),
      market_comparison: cleanObject(body.market_comparison || summary.marketComparison), ocr_forecast_summary: cleanObject(body.ocr_forecast_summary || summary.refixScenario),
      user_notes: cleanText(body.user_notes || contact.userNotes, 2000), referral_status: "new"
    });
    json(response, 201, { ok: true, message: "Your review request has been received." });
  } catch (error) { console.error("adviser review request", error); safeError(response); }
}
