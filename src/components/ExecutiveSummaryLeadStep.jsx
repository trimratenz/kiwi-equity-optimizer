import React, { useMemo, useState } from "react";
import { Clipboard, ClipboardCheck, Download, FileJson, Mail, Printer, Send } from "lucide-react";
import {
  buildBrokerReadySummaryPayload,
  copyTextToClipboard,
  downloadJson,
  emptyConsentFields,
  emptyContactFields
} from "../summaryPayload.js";
import { LEAD_CONSENT_TEXT, PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from "../privacy.js";

const BANK_OPTIONS = ["", "ANZ", "ASB", "BNZ", "Kiwibank", "Westpac", "Other"];

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  propertyAddress: "",
  currentBank: "",
  privacyConsent: false
};

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function buildEmailBody(summaryContent) {
  const stats = (summaryContent.summaryStats ?? []).map((item) => `${item.label}: ${item.value} (${item.detail})`);
  const inputs = (summaryContent.inputRows ?? []).map((item) => `${item.label}: ${item.value} - ${item.detail}`);
  const market = (summaryContent.marketRows ?? []).map(
    (item) =>
      `${item.label}: your rate ${item.yourRate}, average rate ${item.marketRate}, average vs your rate ${item.difference}, monthly impact ${item.monthlyImpact}`
  );
  const actions = (summaryContent.actionRows ?? []).map((item) => `${item.label}: ${item.value} - ${item.detail}`);

  return [
    "TrimRate home loan summary",
    "",
    "Key results",
    ...stats,
    "",
    "Inputs used",
    ...inputs,
    "",
    "Market comparison",
    ...(market.length > 0 ? market : ["No market comparison rows available."]),
    "",
    "Scenarios",
    ...actions,
    "",
    summaryContent.disclaimer
  ].join("\n");
}

function validateLeadForm(values) {
  const errors = {};
  const phoneDigits = values.phone.replace(/\D/g, "");

  if (!values.name.trim()) errors.name = "Enter your name.";
  if (!validateEmail(values.email)) errors.email = "Enter a valid email address.";
  if (phoneDigits.length < 7) errors.phone = "Enter a valid phone number.";
  if (!values.propertyAddress.trim()) errors.propertyAddress = "Enter the property street address.";
  if (!values.currentBank) errors.currentBank = "Select your current bank.";
  if (!values.privacyConsent) errors.privacyConsent = "Confirm you agree to be contacted about this request.";

  return errors;
}

export function ExecutiveSummaryLeadStep({
  summaryContent,
  summaryPayloadBase,
  serializedState,
  onSubmitLead,
  onPdfRequested,
  onSummaryExported
}) {
  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [actionStatus, setActionStatus] = useState("");
  const [consentTimestamp, setConsentTimestamp] = useState("");
  const [leadFormStarted, setLeadFormStarted] = useState(false);

  const summaryStats = useMemo(() => summaryContent.summaryStats ?? [], [summaryContent.summaryStats]);
  const overviewRows = useMemo(() => summaryContent.overviewRows ?? [], [summaryContent.overviewRows]);
  const marketRows = useMemo(() => summaryContent.marketRows ?? [], [summaryContent.marketRows]);
  const actionRows = useMemo(() => summaryContent.actionRows ?? [], [summaryContent.actionRows]);
  const inputRows = useMemo(() => summaryContent.inputRows ?? [], [summaryContent.inputRows]);
  const emailBody = useMemo(() => buildEmailBody(summaryContent), [summaryContent]);
  const contact = useMemo(
    () => ({
      ...emptyContactFields(),
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      propertyAddress: values.propertyAddress.trim(),
      currentBank: values.currentBank
    }),
    [values]
  );
  const consent = useMemo(
    () => ({
      ...emptyConsentFields(),
      privacyConsent: values.privacyConsent,
      adviserContactConsent: values.privacyConsent,
      consentText: values.privacyConsent ? LEAD_CONSENT_TEXT : "",
      consentTimestamp: values.privacyConsent ? consentTimestamp : ""
    }),
    [consentTimestamp, values.privacyConsent]
  );
  const summaryPayload = useMemo(
    () => ({
      ...summaryPayloadBase,
      contact,
      consent
    }),
    [summaryPayloadBase, contact, consent]
  );

  function updateField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitted(false);
    setActionStatus("");

    if (!leadFormStarted) {
      setLeadFormStarted(true);
      onSummaryExported?.("lead_form_started");
    }

    if (field === "privacyConsent") {
      if (value) {
        const timestamp = new Date().toISOString();
        setConsentTimestamp(timestamp);
        onSummaryExported?.("consent_checked");
      } else {
        setConsentTimestamp("");
      }
    }
  }

  async function handleCopySummary() {
    await copyTextToClipboard(emailBody);
    onSummaryExported?.("copy_summary");
    setActionStatus("Summary copied.");
  }

  function handleExportJson() {
    downloadJson("trimrate-summary.json", summaryPayload);
    onSummaryExported?.("export_json");
    setActionStatus("Summary JSON exported.");
  }

  async function handleBrokerPayload() {
    const brokerPayload = buildBrokerReadySummaryPayload(summaryPayload);
    await copyTextToClipboard(JSON.stringify(brokerPayload, null, 2));
    onSummaryExported?.("broker_payload");
    setActionStatus("Broker-ready summary payload generated and copied.");
  }

  function handlePdfHook() {
    onPdfRequested?.(summaryPayload);
    onSummaryExported?.("download_pdf");
    setActionStatus("Choose Save as PDF in the print window.");
    window.print();
  }

  function handleEmailSummary() {
    if (!validateEmail(values.email)) {
      setErrors((current) => ({ ...current, email: "Enter an email address first." }));
      setActionStatus("Add your email address to send the summary.");
      return;
    }

    const subject = encodeURIComponent("Your TrimRate home loan summary");
    const body = encodeURIComponent(emailBody);
    window.location.href = `mailto:${encodeURIComponent(values.email.trim())}?subject=${subject}&body=${body}`;
    onSummaryExported?.("email_summary");
    setActionStatus("Email draft opened with your summary.");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateLeadForm(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    const submittedAt = new Date().toISOString();
    const finalConsentTimestamp = consentTimestamp || submittedAt;
    const leadSummaryPayload = {
      ...summaryPayload,
      consent: {
        ...summaryPayload.consent,
        consentText: LEAD_CONSENT_TEXT,
        consentTimestamp: finalConsentTimestamp,
        submittedAt
      }
    };

    try {
      await onSubmitLead({
        contact: {
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          propertyAddress: values.propertyAddress.trim(),
          currentBank: values.currentBank
        },
        consent: {
          privacyConsent: values.privacyConsent,
          adviserContactConsent: values.privacyConsent,
          consentText: LEAD_CONSENT_TEXT,
          consentTimestamp: finalConsentTimestamp,
          submittedAt
        },
        website: values.website || "",
        summaryPayload: leadSummaryPayload,
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        propertyAddress: values.propertyAddress.trim(),
        currentBank: values.currentBank,
        privacyConsent: values.privacyConsent
      });
      setSubmitted(true);
    } catch (error) {
      setErrors((current) => ({ ...current, submit: error.message || "Lead submission failed." }));
    }
  }

  return (
    <section className="rounded-xl border border-[#E2DDD5] bg-white p-5 shadow-[0_18px_50px_rgba(27,42,34,0.07)] sm:p-7">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-lg bg-[#3A6047]/10 p-2 text-[#3A6047]">
          <ClipboardCheck size={20} aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#3A6047]">Home loan summary</p>
          <h2 className="text-xl font-black text-[#1B2A22] sm:text-2xl">Your results at a glance</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#7B756E]">The key numbers from your calculator run.</p>
        </div>
      </div>

      <div className="grid gap-5">
        <div id="home-loan-summary" className="grid gap-5">
          <div className="print-heading">
            <p>TrimRate.co.nz</p>
            <h1>Home Loan Summary</h1>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaryStats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-[#E2DDD5] bg-[#FFFEFC] p-4">
                <p className="text-xs font-black uppercase tracking-wide text-[#7B756E]">{stat.label}</p>
                <p className="mt-2 text-2xl font-black text-[#1B2A22]">{stat.value}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-[#7B756E]">{stat.detail}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-[#E2DDD5] bg-[#FFFEFC]">
            <div className="border-b border-[#E2DDD5] bg-[#F7F5F0] px-4 py-3">
              <h3 className="text-sm font-black text-[#1B2A22]">Inputs used</h3>
            </div>
            <div className="grid divide-y divide-[#E2DDD5] md:grid-cols-2 md:divide-x md:divide-y-0">
              {inputRows.map((row) => (
                <div key={row.label} className="p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-[#7B756E]">{row.label}</p>
                  <p className="mt-1 font-black text-[#1B2A22]">{row.value}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[#7B756E]">{row.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            <div className="overflow-hidden rounded-xl border border-[#E2DDD5] bg-[#FFFEFC]">
              <div className="border-b border-[#E2DDD5] bg-[#F7F5F0] px-4 py-3">
                <h3 className="text-sm font-black text-[#1B2A22]">Loan overview</h3>
              </div>
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-[#E2DDD5]">
                  {overviewRows.map((row) => (
                    <tr key={row.label}>
                      <th className="w-[36%] px-4 py-3 align-top text-xs font-black uppercase tracking-wide text-[#7B756E]">
                        {row.label}
                      </th>
                      <td className="px-4 py-3">
                        <p className="font-black text-[#1B2A22]">{row.value}</p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-[#7B756E]">{row.detail}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#E2DDD5] bg-[#FFFEFC]">
              <div className="border-b border-[#E2DDD5] bg-[#F7F5F0] px-4 py-3">
                <h3 className="text-sm font-black text-[#1B2A22]">Market comparison</h3>
              </div>
              <div className="max-w-full overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-[#7B756E]">
                    <tr>
                      <th className="px-4 py-3">Part</th>
                      <th className="px-4 py-3">Your rate</th>
                      <th className="px-4 py-3">Average rate</th>
                      <th className="px-4 py-3">Average vs your rate</th>
                      <th className="px-4 py-3">Monthly impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2DDD5]">
                    {marketRows.map((row) => (
                      <tr key={row.label}>
                        <td className="px-4 py-3">
                          <p className="font-black text-[#1B2A22]">{row.label}</p>
                          <p className="text-xs font-semibold text-[#7B756E]">{row.setup}</p>
                        </td>
                        <td className="px-4 py-3 font-bold">{row.yourRate}</td>
                        <td className="px-4 py-3">
                          <p className="font-bold">{row.marketRate}</p>
                          <p className="text-xs font-semibold text-[#7B756E]">{row.comparisonSource}</p>
                        </td>
                        <td className="px-4 py-3 font-black text-[#3A6047]">{row.difference}</td>
                        <td className="px-4 py-3 font-black text-[#1B2A22]">{row.monthlyImpact}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {actionRows.map((row) => (
              <div key={row.label} className="rounded-xl border border-[#D6E2DA] bg-[#F4FAF6] p-4">
                <p className="text-xs font-black uppercase tracking-wide text-[#3A6047]">{row.label}</p>
                <p className="mt-2 text-lg font-black text-[#1B2A22]">{row.value}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-[#5F665F]">{row.detail}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[#D6E2DA] bg-[#F4FAF6] p-4">
            <p className="text-sm font-semibold leading-6 text-[#3A6047]">{summaryContent.disclaimer}</p>
          </div>
        </div>

        <div className="no-print grid gap-4 rounded-xl border border-[#E2DDD5] bg-[#FFFEFC] p-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#1B2A22]">
            Email summary to
            <input
              value={values.email}
              onChange={(event) => updateField("email", event.target.value)}
              className="h-12 w-full rounded-lg border border-[#D6E2DA] bg-white px-3 text-base font-bold outline-none transition focus:border-[#3A6047] focus:ring-2 focus:ring-[#3A6047]/15"
              type="email"
              autoComplete="email"
              placeholder="you@example.co.nz"
            />
            {errors.email && <span className="text-xs font-bold text-[#C86A53]">{errors.email}</span>}
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={handlePdfHook}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#3A6047] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#2F503B]"
            >
              <Printer size={16} aria-hidden="true" />
              Download PDF
            </button>
            <button
              type="button"
              onClick={handleEmailSummary}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[#D6E2DA] bg-white px-4 text-sm font-black text-[#1B2A22] hover:border-[#3A6047]/70 hover:text-[#3A6047]"
            >
              <Mail size={16} aria-hidden="true" />
              Email summary
            </button>
            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[#D6E2DA] bg-white px-4 text-sm font-black text-[#1B2A22] hover:border-[#3A6047]/70 hover:text-[#3A6047]"
            >
              <Clipboard size={16} aria-hidden="true" />
              Copy summary
            </button>
          </div>
          {actionStatus && (
            <p className="rounded-lg bg-[#F4FAF6] px-3 py-2 text-sm font-bold text-[#3A6047] lg:col-span-2">
              {actionStatus}
            </p>
          )}
          <details className="lg:col-span-2">
            <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-[#7B756E]">
              Advanced export options
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#D6E2DA] bg-white px-3 text-xs font-black text-[#1B2A22] hover:border-[#3A6047]/70 hover:text-[#3A6047]"
              >
                <Download size={15} aria-hidden="true" />
                Export calculator data
              </button>
              <button
                type="button"
                onClick={handleBrokerPayload}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#D6E2DA] bg-white px-3 text-xs font-black text-[#1B2A22] hover:border-[#3A6047]/70 hover:text-[#3A6047]"
              >
                <FileJson size={15} aria-hidden="true" />
                Copy broker payload
              </button>
            </div>
          </details>
        </div>

        <form onSubmit={handleSubmit} className="no-print rounded-xl border border-[#D6E2DA] bg-[#F4FAF6] p-4 sm:p-5">
          <h3 className="text-lg font-black text-[#1B2A22]">Request a mortgage adviser review</h3>
          <p className="mt-1 text-sm leading-6 text-[#5F665F]">
            Send this calculator summary to a New Zealand mortgage adviser for a regulated review.
          </p>

          <div className="mt-5 grid gap-4">
            <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#1B2A22]">
              Name
              <input
                value={values.name}
                onChange={(event) => updateField("name", event.target.value)}
                className="h-12 w-full rounded-lg border border-[#D6E2DA] bg-white px-3 text-base font-bold outline-none transition focus:border-[#3A6047] focus:ring-2 focus:ring-[#3A6047]/15"
                type="text"
                autoComplete="name"
              />
              {errors.name && <span className="text-xs font-bold text-[#C86A53]">{errors.name}</span>}
            </label>

            <input
              value={values.website || ""}
              onChange={(event) => updateField("website", event.target.value)}
              className="hidden"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#1B2A22]">
                Email Address
                <input
                  value={values.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  className="h-12 w-full rounded-lg border border-[#D6E2DA] bg-white px-3 text-base font-bold outline-none transition focus:border-[#3A6047] focus:ring-2 focus:ring-[#3A6047]/15"
                  type="email"
                  autoComplete="email"
                />
                {errors.email && <span className="text-xs font-bold text-[#C86A53]">{errors.email}</span>}
              </label>

              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#1B2A22]">
                Phone Number
                <input
                  value={values.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  className="h-12 w-full rounded-lg border border-[#D6E2DA] bg-white px-3 text-base font-bold outline-none transition focus:border-[#3A6047] focus:ring-2 focus:ring-[#3A6047]/15"
                  type="tel"
                  autoComplete="tel"
                />
                {errors.phone && <span className="text-xs font-bold text-[#C86A53]">{errors.phone}</span>}
              </label>
            </div>

            <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#1B2A22]">
              Property Street Address
              <input
                value={values.propertyAddress}
                onChange={(event) => updateField("propertyAddress", event.target.value)}
                className="h-12 w-full rounded-lg border border-[#D6E2DA] bg-white px-3 text-base font-bold outline-none transition focus:border-[#3A6047] focus:ring-2 focus:ring-[#3A6047]/15"
                type="text"
                autoComplete="street-address"
              />
              {errors.propertyAddress && <span className="text-xs font-bold text-[#C86A53]">{errors.propertyAddress}</span>}
            </label>

            <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#1B2A22]">
              Current Bank
              <select
                value={values.currentBank}
                onChange={(event) => updateField("currentBank", event.target.value)}
                className="h-12 w-full rounded-lg border border-[#D6E2DA] bg-white px-3 text-sm font-bold text-[#1B2A22] outline-none transition focus:border-[#3A6047] focus:ring-2 focus:ring-[#3A6047]/15"
              >
                {BANK_OPTIONS.map((bank) => (
                  <option key={bank || "placeholder"} value={bank}>
                    {bank || "Select bank"}
                  </option>
                ))}
              </select>
              {errors.currentBank && <span className="text-xs font-bold text-[#C86A53]">{errors.currentBank}</span>}
            </label>

            <label className="grid grid-cols-[18px_1fr] gap-3 rounded-lg bg-white p-3 text-xs font-semibold leading-5 text-[#5F665F]">
              <input
                type="checkbox"
                checked={values.privacyConsent}
                onChange={(event) => updateField("privacyConsent", event.target.checked)}
                className="mt-1 h-4 w-4 accent-[#3A6047]"
              />
              <span>
                {LEAD_CONSENT_TEXT}
                <span className="mt-1 block">
                  <a className="font-black text-[#3A6047] underline" href={PRIVACY_POLICY_URL}>
                    Privacy Policy
                  </a>{" "}
                  and{" "}
                  <a className="font-black text-[#3A6047] underline" href={TERMS_OF_USE_URL}>
                    Terms of Use
                  </a>
                </span>
                {errors.privacyConsent && (
                  <span className="mt-1 block text-xs font-bold text-[#C86A53]">{errors.privacyConsent}</span>
                )}
              </span>
            </label>

            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#3A6047] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#2F503B] focus:outline-none focus:ring-2 focus:ring-[#3A6047]/30"
            >
              <Send size={16} aria-hidden="true" />
              Request a mortgage adviser review
            </button>
            {submitted && (
              <p className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-[#3A6047]">
                Request captured. The broker-ready summary payload was attached for review.
              </p>
            )}
            {errors.submit && (
              <p className="rounded-lg bg-[#C86A53]/10 px-3 py-2 text-sm font-bold text-[#C86A53]">{errors.submit}</p>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
