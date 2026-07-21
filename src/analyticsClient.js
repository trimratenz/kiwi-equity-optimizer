const VISITOR_KEY = "trimratenz-visitor-id";
const SESSION_KEY = "trimratenz-session-id";

export function analyticsContext() {
  const visitorId = getStorageId(window.localStorage, VISITOR_KEY, "visitor");
  const sessionId = getStorageId(window.sessionStorage, SESSION_KEY, "session");
  const params = new URLSearchParams(window.location.search);

  return {
    visitorId,
    sessionId,
    path: window.location.pathname,
    referrer: document.referrer,
    utmSource: params.get("utm_source") || "",
    utmMedium: params.get("utm_medium") || "",
    utmCampaign: params.get("utm_campaign") || ""
  };
}

export function trackEvent(eventName, payload = {}) {
  const context = analyticsContext();
  return postPublic("/api/analytics/event", {
    visitor_id: context.visitorId,
    session_id: context.sessionId,
    event_name: eventName,
    page_path: context.path,
    referrer: context.referrer,
    utm_source: context.utmSource,
    utm_medium: context.utmMedium,
    utm_campaign: context.utmCampaign,
    metadata: safeAnalyticsMetadata(payload)
  });
}

export function submitLeadPayload({ contact, consent, summaryPayload, website = "" }) {
  const context = analyticsContext();
  return postPublic("/api/adviser-review-request", {
    visitor_id: context.visitorId,
    session_id: context.sessionId,
    page_path: context.path,
    referrer: context.referrer,
    utm_source: context.utmSource,
    utm_medium: context.utmMedium,
    utm_campaign: context.utmCampaign,
    contact,
    consent,
    summaryPayload,
    website,
    createdAt: new Date().toISOString()
  });
}

function safeAnalyticsMetadata(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const safe = Object.fromEntries(
    Object.entries(payload)
      .filter(([key]) => !/name|email|phone|address|contact/i.test(key))
      .slice(0, 15)
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 120) : typeof value === "number" || typeof value === "boolean" ? value : ""])
  );
  if (payload.activity && typeof payload.activity === "object" && !Array.isArray(payload.activity)) {
    safe.activity = {
      inputs: payload.activity.inputs || {},
      outputs: payload.activity.outputs || {},
      marketRateSnapshotId: payload.activity.marketRateSnapshotId || "",
      marketRateSnapshot: payload.activity.marketRateSnapshot || {},
      ocrForecastSnapshotId: payload.activity.ocrForecastSnapshotId || "",
      ocrForecastSnapshot: payload.activity.ocrForecastSnapshot || {}
    };
  }
  return safe;
}

function getStorageId(storage, key, prefix) {
  try {
    const existing = storage.getItem(key);
    if (existing) return existing;
    const next = `${prefix}_${crypto.randomUUID()}`;
    storage.setItem(key, next);
    return next;
  } catch {
    return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now()}`;
  }
}

async function postPublic(path, payload) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}
