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
    session_id: context.sessionId,
    event_name: eventName,
    page_path: context.path,
    referrer: context.referrer,
    metadata: safeAnalyticsMetadata(payload)
  });
}

export function submitLeadPayload({ contact, consent, summaryPayload, website = "" }) {
  return postPublic("/api/adviser-review-request", {
    contact,
    consent,
    summaryPayload,
    website,
    createdAt: new Date().toISOString()
  });
}

function safeAnalyticsMetadata(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([key]) => !/name|email|phone|address|loan|balance|income|summary/i.test(key))
      .slice(0, 15)
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 120) : typeof value === "number" || typeof value === "boolean" ? value : ""])
  );
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
