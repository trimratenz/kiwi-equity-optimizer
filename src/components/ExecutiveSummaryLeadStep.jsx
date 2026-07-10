import React, { useMemo, useState } from "react";
import { ClipboardCheck, Send } from "lucide-react";
import { currency, percent } from "../financialModel";
import { emptyConsentFields, emptyContactFields } from "../summaryPayload.js";
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

function repaymentLabel(value, frequency) {
  return `${currency(value)} / ${String(frequency || "period").toLowerCase()}`;
}

function forecastRangeLabel(changes, frequency) {
  const low = Math.min(...changes);
  const high = Math.max(...changes);
  const frequencyLabel = String(frequency || "period").toLowerCase();

  if (Math.abs(low) < 0.5 && Math.abs(high) < 0.5) return "Similar to now";
  if (low >= 0.5) return `${currency(low)} to ${currency(high)} more / ${frequencyLabel}`;
  if (high <= -0.5) return `${currency(Math.abs(high))} to ${currency(Math.abs(low))} less / ${frequencyLabel}`;
  return `${currency(Math.abs(low))} less to ${currency(high)} more / ${frequencyLabel}`;
}

function termLabel(value) {
  return String(value || "")
    .replace(/(\d+) yr/g, (_, years) => `${years} ${Number(years) === 1 ? "year" : "years"}`)
    .replace(/(\d+) mo/g, (_, months) => `${months} months`);
}

export function ExecutiveSummaryLeadStep({
  summaryContent,
  summaryPayloadBase,
  loanAmount,
  currentRepayment,
  cashAfterMortgage,
  extraPayment,
  monthlyCost,
  dtiRatio,
  repaymentToIncome,
  marketRateRows,
  trancheForecasts,
  averageFixedRates,
  variableOnly,
  onSubmitLead,
  onSummaryExported
}) {
  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [consentTimestamp, setConsentTimestamp] = useState("");
  const [leadFormStarted, setLeadFormStarted] = useState(false);

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
          <h2 className="text-xl font-black text-[#1B2A22] sm:text-2xl">Your summary</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#7B756E]">
            Here&apos;s a simple snapshot of your current loan position and how your repayments may change under different rate scenarios.
          </p>
        </div>
      </div>

      <div className="grid gap-5">
        <div id="home-loan-summary" className="rounded-xl border border-[#E2DDD5] bg-[#FFFEFC] p-4 sm:p-5">
          <div className="print-heading">
            <p>TrimRate.co.nz</p>
            <h1>Home Loan Summary</h1>
          </div>

          <div className="grid gap-5">
            <section>
              <h3 className="text-base font-black text-[#1B2A22]">Current position</h3>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#4F5A52] sm:grid-cols-2">
                <li><strong>Current loan balance:</strong> {currency(loanAmount)}</li>
                <li><strong>Current repayment:</strong> {currency(currentRepayment)}</li>
                <li><strong>Cash after mortgage:</strong> {currency(cashAfterMortgage)}</li>
                {extraPayment > 0 && <li><strong>Top-up:</strong> {currency(extraPayment)}</li>}
                <li><strong>Monthly cost:</strong> {currency(monthlyCost)}</li>
                <li><strong>DTI:</strong> {dtiRatio.toFixed(2)}x</li>
                <li><strong>Repayment-to-income ratio:</strong> {percent(repaymentToIncome, 1)}</li>
              </ul>
              <p className="mt-3 text-xs font-medium leading-5 text-[#7B756E]">
                These figures are based on the details entered and are estimates only.
              </p>
            </section>

            <section>
              <h3 className="text-base font-black text-[#1B2A22]">
                {variableOnly ? "Average fixed rates to compare" : "Rate comparison by loan tranche"}
              </h3>
              {variableOnly ? (
                <>
                  <div className="mt-3 overflow-x-auto rounded-lg border border-[#E2DDD5] bg-white">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead className="bg-[#F7F5F0] text-xs uppercase tracking-wide text-[#7B756E]">
                        <tr><th className="p-3">Fixed term</th><th className="p-3">Average market rate</th></tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2DDD5]">
                        {averageFixedRates.map((rate) => <tr key={rate.term}><td className="p-3 font-bold">{rate.term}</td><td className="p-3">{percent(rate.rate)}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[#7B756E]">
                    Because your loan is variable, you may be able to compare available fixed-rate options without waiting for a fixed term to end. Check with your lender.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm leading-6 text-[#7B756E]">
                    This compares your current repayment with an estimated repayment using the average market rate for the same fixed term.
                  </p>
                  <div className="mt-3 overflow-x-auto rounded-lg border border-[#E2DDD5] bg-white">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="bg-[#F7F5F0] text-xs uppercase tracking-wide text-[#7B756E]">
                        <tr>
                          <th className="p-3">Tranche</th><th className="p-3">Your rate</th><th className="p-3">Market rate</th><th className="p-3">Your repayment</th><th className="p-3">Market repayment</th><th className="p-3">Compared with market</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2DDD5] text-[#1B2A22]">
                        {marketRateRows.map((row) => {
                          const hasAverageRate = Number.isFinite(row.marketRate);
                          const marketRateNote = !hasAverageRate || Math.abs(row.difference) < 0.05
                            ? ""
                            : `${percent(Math.abs(row.difference))} ${row.difference > 0 ? "below" : "above"} your rate`;
                          const impactLabel = !Number.isFinite(row.repaymentDifference)
                            ? "Not available"
                            : Math.abs(row.repaymentDifference) < 0.5
                              ? "Similar to market"
                              : `You pay about ${currency(Math.abs(row.repaymentDifference))} ${row.repaymentDifference > 0 ? "less" : "more"} / ${String(row.frequency).toLowerCase()}`;
                          const impactTone = !Number.isFinite(row.repaymentDifference) || Math.abs(row.repaymentDifference) < 0.5
                            ? "text-[#7B756E]"
                            : row.repaymentDifference > 0
                              ? "text-[#3A6047]"
                              : "text-[#C86A53]";
                          return <tr key={row.id}>
                            <td className="p-3"><p className="font-black">Tranche {row.index}</p><p className="text-xs font-medium text-[#7B756E]">Fixed {termLabel(row.fixedTermLabel)}</p></td>
                            <td className="p-3">{percent(row.currentRate)}</td>
                            <td className="p-3"><p>{hasAverageRate ? percent(row.marketRate) : "Not available"}</p>{marketRateNote && <p className="mt-1 text-xs font-medium text-[#7B756E]">{marketRateNote}</p>}</td>
                            <td className="p-3">{repaymentLabel(row.currentRepayment, row.frequency)}</td>
                            <td className="p-3">{Number.isFinite(row.marketRepayment) ? repaymentLabel(row.marketRepayment, row.frequency) : "Not available"}</td>
                            <td className={`p-3 font-bold ${impactTone}`}>{impactLabel}</td>
                          </tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[#7B756E]">
                    Market comparisons are estimates only and do not include break fees, cashback clawbacks, or lender-specific pricing.
                  </p>
                </>
              )}
            </section>

            <section>
              <h3 className="text-base font-black text-[#1B2A22]">OCR forecast repayment scenarios</h3>
              <p className="mt-1 text-sm leading-6 text-[#7B756E]">These scenarios show how each tranche&apos;s repayment may change under optimistic, base, and conservative rate assumptions.</p>
              <p className="mt-1 text-xs font-medium leading-5 text-[#7B756E]">Optimistic means a lower-rate scenario. Conservative means a higher-rate scenario.</p>
              <div className="mt-3 overflow-x-auto rounded-lg border border-[#E2DDD5] bg-white">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-[#F7F5F0] text-xs uppercase tracking-wide text-[#7B756E]">
                    <tr><th className="p-3">Tranche</th><th className="p-3">Now</th><th className="p-3">Optimistic</th><th className="p-3">Base</th><th className="p-3">Conservative</th><th className="p-3">Change</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2DDD5] text-[#1B2A22]">
                    {trancheForecasts.map((row) => {
                      const optimistic = row.scenarios.find((scenario) => scenario.key === "optimistic");
                      const base = row.scenarios.find((scenario) => scenario.key === "base");
                      const conservative = row.scenarios.find((scenario) => scenario.key === "conservative");
                      const changes = row.scenarios.map((scenario) => scenario.repaymentChange);
                      const scenarioTone = (scenario) =>
                        !scenario || Math.abs(scenario.repaymentChange) < 0.5
                          ? "text-[#7B756E]"
                          : scenario.repaymentChange > 0
                            ? "text-[#C86A53]"
                            : "text-[#3A6047]";
                      const changeTone =
                        changes.length === 0 || (Math.min(...changes) < -0.5 && Math.max(...changes) > 0.5)
                          ? "text-[#7B756E]"
                          : Math.max(...changes) <= -0.5
                            ? "text-[#3A6047]"
                            : Math.min(...changes) >= 0.5
                              ? "text-[#C86A53]"
                              : "text-[#7B756E]";
                      return <tr key={row.id}>
                        <td className="p-3"><p className="font-black">Tranche {row.index}</p><p className="text-xs font-medium text-[#7B756E]">Rolling over {row.refixPointLabel === "now" ? "now" : `in ${termLabel(row.refixPointLabel)}`}</p><p className="mt-1 text-xs font-medium text-[#7B756E]">{row.fixedTermEnd} · OCR {percent(row.forecastOcr)}</p></td>
                        <td className="p-3">{repaymentLabel(row.currentRepayment, row.frequency)}</td>
                        <td className={`p-3 ${scenarioTone(optimistic)}`}>{optimistic ? `${repaymentLabel(optimistic.repayment, row.frequency)} (${percent(optimistic.forecastMortgageRate)})` : "Not available"}</td>
                        <td className={`p-3 ${scenarioTone(base)}`}>{base ? `${repaymentLabel(base.repayment, row.frequency)} (${percent(base.forecastMortgageRate)})` : "Not available"}</td>
                        <td className={`p-3 ${scenarioTone(conservative)}`}>{conservative ? `${repaymentLabel(conservative.repayment, row.frequency)} (${percent(conservative.forecastMortgageRate)})` : "Not available"}</td>
                        <td className={`p-3 font-bold ${changeTone}`}>{changes.length ? forecastRangeLabel(changes, row.frequency) : "Not available"}</td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#7B756E]">
                These scenarios estimate how repayments may change if rates move broadly in line with the OCR forecast assumptions. They are not predictions or lender offers.
              </p>
              <p className="mt-2 text-xs leading-5 text-[#7B756E]">Change compares each scenario with your current repayment.</p>
              {trancheForecasts.some((row) => row.scenarios.length > 0 && row.scenarios.every((scenario) => scenario.repayment > row.currentRepayment + 0.5)) && (
                <p className="mt-2 text-xs font-medium leading-5 text-[#7B756E]">
                  Your current rate is below the forecast scenario rates, so these scenarios show higher repayments than your current repayment.
                </p>
              )}
              <p className="mt-2 text-xs leading-5 text-[#7B756E]">
                Forecast repayments use the current market rate for the selected fixed term, adjusted for the OCR forecast movement with scenario-specific pass-through and rate buffers. Actual lender rates may move differently and may include margins, discounts, fees, or special offers.
              </p>
            </section>
          </div>

          <p className="mt-4 rounded-lg bg-[#F4FAF6] p-3 text-sm font-semibold leading-6 text-[#3A6047]">
            {summaryContent.disclaimer}
          </p>
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
