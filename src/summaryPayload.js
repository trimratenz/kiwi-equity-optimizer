import { CALCULATION_ENGINE_VERSION, paymentToAnnual } from "./financialModel.js";

export const SUMMARY_VERSION = "trimrate-summary-v1";

export function emptyContactFields() {
  return {
    name: "",
    email: "",
    phone: "",
    propertyAddress: "",
    currentBank: ""
  };
}

export function emptyConsentFields() {
  return {
    privacyConsent: false,
    adviserContactConsent: false,
    submittedAt: ""
  };
}

export function buildSummaryPayload({
  createdAt = new Date().toISOString(),
  ratesSnapshotId = "",
  ocrSnapshotId = "",
  contact = emptyContactFields(),
  consent = emptyConsentFields(),
  inputs,
  outputs,
  marketComparison,
  refixScenario,
  visuals,
  disclaimer
}) {
  return {
    summaryVersion: SUMMARY_VERSION,
    createdAt,
    calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    ratesSnapshotId,
    ocrSnapshotId,
    contact: {
      ...emptyContactFields(),
      ...contact
    },
    consent: {
      ...emptyConsentFields(),
      ...consent
    },
    inputs,
    outputs,
    marketComparison,
    refixScenario,
    visuals,
    disclaimer
  };
}

export function buildBrokerReadySummaryPayload(summaryPayload) {
  return {
    payloadType: "trimrate-broker-ready-summary",
    payloadVersion: 1,
    generatedAt: new Date().toISOString(),
    summary: summaryPayload
  };
}

export function downloadJson(filename, payload) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function monthlyEquivalent(amount, frequency) {
  return paymentToAnnual(amount, frequency) / 12;
}
