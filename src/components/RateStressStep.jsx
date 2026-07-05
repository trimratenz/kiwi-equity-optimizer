import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  CURRENT_OCR_ASSUMPTION,
  FREQUENCY_CONFIG,
  OCR_FORECAST_SOURCES,
  RBNZ_OCR_FORECAST_SOURCE,
  currency,
  monthsLabel,
  percent
} from "../financialModel";
import { Segmented, Stat, StepShell } from "./ui";

export function RateStressStep({
  forecastRows,
  forecastTranches,
  selectedForecastTranche,
  selectedForecastTrancheId,
  selectedForecastFrequency,
  selectedForecastPayment,
  selectedForecastTermMonths,
  setSelectedForecastTermMonths,
  setSelectedForecastTrancheId
}) {
  const firstForecast = forecastRows[0];
  const selectedTerm =
    forecastRows.find((row) => row.months === selectedForecastTermMonths) ??
    forecastRows.find((row) => row.months === 12) ??
    firstForecast;

  return (
    <StepShell
      step="Step 5"
      icon={AlertTriangle}
      title="What could I pay when I re-fix?"
      detail="Pick the loan part and the new fixed term. TrimRate uses the RBNZ OCR forecast for the date your fixed term ends, then shows three repayment outlooks together."
    >
      <div className="grid gap-5">
        <Segmented
          value={selectedForecastTranche?.id || selectedForecastTrancheId || forecastTranches[0]?.id}
          onChange={setSelectedForecastTrancheId}
          options={forecastTranches.map((tranche) => ({
            value: tranche.id,
            label: forecastTranches.length === 1 ? "Loan details" : `Loan part ${tranche.index}`
          }))}
        />

        <div className="grid gap-3">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#7B756E]">New fixed term</p>
            <Segmented
              value={String(selectedTerm?.months ?? selectedForecastTermMonths)}
              onChange={(value) => setSelectedForecastTermMonths(Number(value))}
              options={forecastRows.map((row) => ({
                value: String(row.months),
                label: row.label
              }))}
            />
          </div>
        </div>

        {selectedForecastTranche && (
          <div className="grid gap-3 md:grid-cols-4">
            <Stat
              label="Current part balance"
              value={currency(selectedForecastTranche.amount)}
              sub={`Original part: ${currency(selectedForecastTranche.originalBalance)}`}
            />
            <Stat
              label="Fixed ends in"
              value={monthsLabel(selectedForecastTranche.fixedMonths)}
              sub={
                selectedForecastTranche.type === "Fixed"
                  ? `Current fixed term: ${monthsLabel(selectedForecastTranche.fixedTermMonths)}`
                  : "Variable loan part"
              }
            />
            <Stat
              label="Balance at re-fix"
              value={currency(firstForecast?.remainingBalance ?? selectedForecastTranche.amount)}
              sub={`Projected from the user's current balance`}
            />
            <Stat
              label={`Current ${FREQUENCY_CONFIG[selectedForecastFrequency].label} repayment`}
              value={currency(selectedForecastPayment)}
              sub={`At ${percent(selectedForecastTranche.rate)}`}
            />
          </div>
        )}

        {selectedTerm && (
          <article className="rounded-xl border border-[#E2DDD5] bg-white p-5 shadow-[0_12px_34px_rgba(27,42,34,0.06)]">
            <div className="grid gap-5">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#7B756E]">Selected re-fix view</p>
                <h3 className="mt-2 text-2xl font-black text-[#1B2A22]">
                  {selectedTerm.label} fixed in {selectedTerm.refixPointLabel}
                </h3>
                <p className="mt-1 text-sm font-medium leading-6 text-[#7B756E]">
                  RBNZ OCR forecast at that point is {percent(selectedTerm.forecastOcr)}. Current 5-bank average for a{" "}
                  {selectedTerm.label} fixed rate is {percent(selectedTerm.marketRateToday)}.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {selectedTerm.scenarios.map((scenario) => (
                  <div
                    key={scenario.key}
                    className={`rounded-xl border p-4 ${
                      scenario.key === "base"
                        ? "border-[#3A6047]/50 bg-[#3A6047]/5"
                        : scenario.key === "conservative"
                          ? "border-[#C86A53]/35 bg-[#C86A53]/5"
                          : "border-[#E2DDD5] bg-[#F7F5F0]"
                    }`}
                  >
                    <p className="text-xs font-black uppercase tracking-wide text-[#7B756E]">{scenario.label}</p>
                    <p className="mt-2 text-2xl font-black text-[#1B2A22]">{currency(scenario.repayment)}</p>
                    <p className="mt-1 text-xs font-medium text-[#7B756E]">
                      Every {FREQUENCY_CONFIG[selectedForecastFrequency].label} at {percent(scenario.forecastMortgageRate)}
                    </p>
                    <p className={`mt-3 text-sm font-black ${scenario.repaymentChange > 0 ? "text-[#C86A53]" : "text-[#3A6047]"}`}>
                      {scenario.repaymentChange >= 0 ? "+" : ""}
                      {currency(scenario.repaymentChange)} vs now
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-[#E2DDD5] bg-[#F7F5F0] p-4 text-sm leading-6 text-[#7B756E]">
                <p>
                  OCR path used: {percent(CURRENT_OCR_ASSUMPTION)} today to {percent(selectedTerm.forecastOcr)} at
                  re-fix. Source: {RBNZ_OCR_FORECAST_SOURCE.source}.
                </p>
              </div>
            </div>
          </article>
        )}

        <div className="grid gap-3 rounded-lg bg-[#F7F5F0] p-4 text-sm leading-6 text-[#7B756E] md:grid-cols-[1fr_auto] md:items-center">
          <p>
            Forecast values come from the local RBNZ OCR track in src/financialModel.js. Update{" "}
            <span className="font-bold text-[#1B2A22]">CURRENT_OCR_ASSUMPTION</span> and{" "}
            <span className="font-bold text-[#1B2A22]">RBNZ_OCR_FORECAST_SOURCE</span> after each RBNZ Monetary Policy
            Statement.
          </p>
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#E2DDD5] bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-[#3A6047]">
            <RefreshCw size={14} aria-hidden="true" />
            Feed-ready
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {OCR_FORECAST_SOURCES.map((source) =>
            source.url.startsWith("http") ? (
              <React.Fragment key={source.source}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-[#E2DDD5] bg-white px-4 py-3 text-sm font-bold text-[#1B2A22] hover:border-[#3A6047]/60"
                >
                  {source.source}
                </a>
                <a
                  href={source.publicationsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-[#E2DDD5] bg-white px-4 py-3 text-sm font-bold text-[#1B2A22] hover:border-[#3A6047]/60"
                >
                  RBNZ publications library
                </a>
              </React.Fragment>
            ) : (
              <div
                key={source.source}
                className="rounded-lg border border-[#E2DDD5] bg-white px-4 py-3 text-sm font-bold text-[#1B2A22]"
              >
                {source.source}
              </div>
            )
          )}
        </div>
      </div>
    </StepShell>
  );
}
