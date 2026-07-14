import React, { useEffect, useMemo, useState } from "react";
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
  salaryAmount,
  extraPayment,
  monthlyCost,
  dtiRatio,
  repaymentToIncome,
  marketRateRows,
  trancheForecasts,
  averageFixedRates,
  floatingOnly,
  onSubmitLead,
  onSummaryExported,
  resetVersion
}) {
  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [consentTimestamp, setConsentTimestamp] = useState("");
  const [leadFormStarted, setLeadFormStarted] = useState(false);
  const primaryMarketRow = marketRateRows[0];
  const baseScenario = trancheForecasts[0]?.scenarios?.find((scenario) => scenario.key === "base");
  const incomeKnown = Number(salaryAmount) > 0;
  const rateDifference = primaryMarketRow?.difference ?? 0;
  const repaymentDifference = primaryMarketRow?.repaymentDifference ?? 0;
  const userRepaymentDifference = -repaymentDifference;
  const ratePosition = Math.abs(rateDifference) < 0.05 ? "in line with" : rateDifference > 0 ? "above" : "below";

  useEffect(() => {
    setValues(EMPTY_FORM);
    setErrors({});
    setSubmitted(false);
    setConsentTimestamp("");
    setLeadFormStarted(false);
  }, [resetVersion]);

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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-7">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-blue-50 p-2 text-[#092B63]">
          <ClipboardCheck size={20} aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-700">Mortgage intelligence report</p>
          <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Your summary</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Here&apos;s a simple snapshot of your current loan position and how your repayments may change under different rate scenarios.
          </p>
        </div>
      </div>

      <div className="grid gap-5">
        <div id="home-loan-summary" className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div className="print-heading">
            <p>TrimRate.co.nz</p>
            <h1>Home Loan Summary</h1>
          </div>

          <div className="grid gap-8">
            <section>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-700">Summary</p>
              <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">Your Current Position</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[["Current balance", currency(loanAmount), "Across all loan parts"], ["Current repayment", currency(currentRepayment), "Your selected repayment period"], ["Monthly mortgage cost", currency(monthlyCost), "Monthly equivalent"], ["Monthly income", incomeKnown ? currency(Number(salaryAmount)) : "Not calculated", incomeKnown ? "Based on your entered income" : "Add income in Step 2"], ["Net cash after mortgage", incomeKnown ? currency(cashAfterMortgage) : "Not calculated", incomeKnown ? "After your repayment" : "Add income in Step 2"]].map(([label, value, sub]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{sub}</p></div>)}
              </div>
              {extraPayment > 0 && <p className="mt-3 text-xs font-medium text-slate-500">Includes a top-up of {currency(extraPayment)} per repayment period.</p>}
            </section>

            <section>
              <h3 className="text-xl font-black tracking-tight text-slate-950">Your Rate Comparison</h3>
              {floatingOnly ? (
                <>
                  <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr><th className="p-3">Fixed term</th><th className="p-3">Average market rate</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {averageFixedRates.map((rate) => <tr key={rate.term}><td className="p-3 font-bold">{rate.term}</td><td className="p-3">{percent(rate.rate)}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[#7B756E]">
                    Because your loan is floating, you may be able to compare available fixed-rate options without waiting for a fixed term to end. Check with your lender.
                  </p>
                </>
              ) : (
                <>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="p-3">Loan part</th><th className="p-3">Current rate</th><th className="p-3">Market average</th><th className="p-3">Difference</th><th className="p-3">Repayment comparison</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-900">
                        {marketRateRows.map((row) => {
                          const userRepaymentDifference = -row.repaymentDifference;
                          const hasAverageRate = Number.isFinite(row.marketRate);
                          const impactLabel = !Number.isFinite(row.repaymentDifference)
                            ? "Not available"
                            : Math.abs(row.repaymentDifference) < 0.5
                              ? "Similar to market"
                              : `You pay ${currency(Math.abs(userRepaymentDifference))} ${userRepaymentDifference > 0 ? "more" : "less"} / ${String(row.frequency).toLowerCase()}`;
                          const impactTone = !Number.isFinite(row.repaymentDifference) || Math.abs(row.repaymentDifference) < 0.5
                            ? "text-[#7B756E]"
                            : userRepaymentDifference < 0
                              ? "text-[#3A6047]"
                              : "text-[#C86A53]";
                          return <tr key={row.id}>
                            <td className="p-3"><p className="font-black">Tranche {row.index}</p><p className="text-xs font-medium text-[#7B756E]">Fixed {termLabel(row.fixedTermLabel)}</p></td>
                            <td className="p-3">{percent(row.currentRate)}</td>
                            <td className="p-3">{hasAverageRate ? percent(row.marketRate) : "Not available"}</td>
                            <td className={`p-3 font-bold ${row.difference > 0.05 ? "text-[#C86A53]" : row.difference < -0.05 ? "text-emerald-700" : "text-slate-500"}`}>{row.difference > 0 ? "+" : ""}{percent(row.difference)}</td>
                            <td className={`p-3 font-bold ${impactTone}`}>{impactLabel}</td>
                          </tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            {trancheForecasts.length > 0 && (
            <section>
              <h3 className="text-xl font-black tracking-tight text-slate-950">OCR forecast repayment scenarios</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">Current repayment and rate are highlighted first, followed by optimistic, base, and conservative estimates.</p>
              <div className="hidden">
                {trancheForecasts.map((row) => {
                  const scenarios = [
                    ["Optimistic", row.scenarios.find((scenario) => scenario.key === "optimistic")],
                    ["Base", row.scenarios.find((scenario) => scenario.key === "base")],
                    ["Conservative", row.scenarios.find((scenario) => scenario.key === "conservative")]
                  ];
                  return (
                    <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-black">Tranche {row.index} · {row.frequency} repayment</p>
                          <p className="text-xs font-medium text-[#7B756E]">Rolling over {row.refixPointLabel === "now" ? "now" : `in ${termLabel(row.refixPointLabel)}`} · {row.fixedTermEnd} · OCR {percent(row.forecastOcr)}</p>
                        </div>
                        <div className="rounded-xl bg-[#092B63] px-4 py-3 text-white"><p className="text-[11px] font-bold uppercase tracking-wide text-blue-100">Current repayment & rate</p><p className="mt-1 text-base font-black">{repaymentLabel(row.currentRepayment, row.frequency)}</p><p className="mt-1 text-xs text-blue-100">Current rate {percent(row.currentRate)}</p></div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        {scenarios.map(([label, scenario]) => (
                          <div key={label} className={`rounded-xl border p-4 ${label === "Optimistic" ? "border-emerald-200 bg-emerald-50" : label === "Base" ? "border-blue-200 bg-blue-50" : "border-amber-200 bg-amber-50"}`}>
                            <p className={`text-xs font-black uppercase tracking-wide ${label === "Optimistic" ? "text-emerald-700" : label === "Base" ? "text-blue-700" : "text-amber-700"}`}>{label}{label === "Base" ? " · main scenario" : ""}</p>
                            <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{scenario ? currency(scenario.repayment) : "Not available"}</p>
                            {scenario && <p className="mt-1 text-sm font-medium text-slate-600">{percent(scenario.forecastMortgageRate)}</p>}
                            {scenario && <p className={`mt-2 text-sm font-black ${scenario.repaymentChange > 0 ? "text-amber-700" : scenario.repaymentChange < 0 ? "text-emerald-700" : "text-slate-500"}`}>{scenario.repaymentChange >= 0 ? "+" : "-"}{currency(Math.abs(scenario.repaymentChange))} / {String(row.frequency).toLowerCase()}</p>}
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full min-w-[1040px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr><th className="p-3">Loan part</th><th className="p-3">Frequency</th><th className="p-3">Current repayment</th><th className="p-3">Optimistic</th><th className="p-3">Base</th><th className="p-3">Conservative</th><th className="p-3">Scenario range</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-900">
                    {trancheForecasts.map((row) => {
                      const optimistic = row.scenarios.find((scenario) => scenario.key === "optimistic");
                      const base = row.scenarios.find((scenario) => scenario.key === "base");
                      const conservative = row.scenarios.find((scenario) => scenario.key === "conservative");
                      const forecastRates = row.scenarios.map((scenario) => scenario.forecastMortgageRate);
                      const forecastRepayments = row.scenarios.map((scenario) => scenario.repayment);
                      return <tr key={row.id}>
                        <td className="p-3"><p className="font-black">Tranche {row.index}</p><p className="text-xs font-medium text-[#7B756E]">Rolling over {row.refixPointLabel === "now" ? "now" : `in ${termLabel(row.refixPointLabel)}`}</p><p className="mt-1 text-xs font-medium text-[#7B756E]">{row.fixedTermEnd} · OCR {percent(row.forecastOcr)}</p></td>
                        <td className="p-3 font-medium text-slate-700">{row.frequency}</td>
                        <td className="p-3"><p className="font-bold">{currency(row.currentRepayment)}</p><p className="mt-1 text-xs font-medium text-slate-500">Current rate {percent(row.currentRate)}</p></td>
                        <td className="p-3">{optimistic ? <><p className="font-bold">{currency(optimistic.repayment)}</p><p className="mt-1 text-xs font-medium text-slate-500">Estimated rate at refix {percent(optimistic.forecastMortgageRate)}</p><p className="mt-1 text-xs text-slate-500">{optimistic.repaymentChange >= 0 ? "+" : "-"}{currency(Math.abs(optimistic.repaymentChange))} from current</p></> : "Not available"}</td>
                        <td className="p-3">{base ? <><p className="font-bold">{currency(base.repayment)}</p><p className="mt-1 text-xs font-medium text-slate-500">Estimated rate at refix {percent(base.forecastMortgageRate)}</p><p className="mt-1 text-xs text-slate-500">{base.repaymentChange >= 0 ? "+" : "-"}{currency(Math.abs(base.repaymentChange))} from current</p></> : "Not available"}</td>
                        <td className="p-3">{conservative ? <><p className="font-bold">{currency(conservative.repayment)}</p><p className="mt-1 text-xs font-medium text-slate-500">Estimated rate at refix {percent(conservative.forecastMortgageRate)}</p><p className="mt-1 text-xs text-slate-500">{conservative.repaymentChange >= 0 ? "+" : "-"}{currency(Math.abs(conservative.repaymentChange))} from current</p></> : "Not available"}</td>
                        <td className="p-3 font-bold">{forecastRates.length ? <><p>{percent(Math.min(...forecastRates))} to {percent(Math.max(...forecastRates))}</p><p className="mt-1 text-xs font-medium">{currency(Math.min(...forecastRepayments))} to {currency(Math.max(...forecastRepayments))}</p></> : "Not available"}</td>
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
            )}
          </div>

          <p className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold leading-6 text-slate-600">
            {summaryContent.disclaimer}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="no-print rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <h3 className="text-lg font-black tracking-tight text-slate-950">Request a mortgage adviser review</h3>
          <p className="mt-1 text-sm leading-6 text-[#5F665F]">
            Want a second opinion? A mortgage adviser can review your numbers and help you understand your options.
          </p>
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
