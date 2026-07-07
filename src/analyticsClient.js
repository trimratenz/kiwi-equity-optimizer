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
  return postPublic("/api/events", {
    ...analyticsContext(),
    eventName,
    payload,
    createdAt: new Date().toISOString()
  });
}

export function trackCalculatorRun(summaryPayload) {
  return postPublic("/api/calculator-runs", {
    ...analyticsContext(),
    summaryPayload,
    createdAt: new Date().toISOString()
  });
}

export function submitLeadPayload({ contact, consent, summaryPayload, website = "" }) {
  return postPublic("/api/leads", {
    ...analyticsContext(),
    contact,
    consent,
    summaryPayload,
    website,
    createdAt: new Date().toISOString()
  });
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
