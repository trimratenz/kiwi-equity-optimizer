import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  CURRENT_OCR_ASSUMPTION,
  FREQUENCY_CONFIG,
  OCR_FORECAST_SOURCES,
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
  setSelectedForecastTrancheId
}) {
  const firstForecast = forecastRows[0];

  return (
    <StepShell
      step="Step 5"
      icon={AlertTriangle}
      title="What could I pay when I re-fix?"
      detail="Select the loan part that is coming up for re-fix. The app projects that part's balance at its fixed-end date, then compares new repayment options using forecast OCR and retail mortgage-rate assumptions."
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

        <div className="grid gap-3">
          {forecastRows.map((row) => (
            <article key={row.months} className="rounded-xl border border-[#E2DDD5] bg-white p-4">
              <div className="grid gap-3 border-b border-[#E2DDD5] pb-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <h3 className="text-lg font-black text-[#1B2A22]">{row.label}</h3>
                  <p className="mt-1 text-xs font-medium leading-5 text-[#7B756E]">
                    Re-fix in {row.refixPointLabel}. Current 5-bank average for this term is{" "}
                    {percent(row.marketRateToday)}.
                  </p>
                </div>
                <div className="text-xs font-bold uppercase tracking-wide text-[#7B756E]">
                  OCR {percent(CURRENT_OCR_ASSUMPTION)}{" -> "}{percent(row.forecastOcr)}
                </div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {row.scenarios.map((scenario) => (
                  <div
                    key={scenario.key}
                    className={`rounded-lg border p-3 ${
                      scenario.key === "conservative"
                        ? "border-[#C86A53]/35 bg-[#C86A53]/5"
                        : "border-[#E2DDD5] bg-[#F7F5F0]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-black uppercase tracking-wide text-[#7B756E]">{scenario.label}</p>
                      <p className="text-sm font-black text-[#1B2A22]">{percent(scenario.forecastMortgageRate)}</p>
                    </div>
                    <p className="mt-2 text-xl font-black text-[#3A6047]">{currency(scenario.repayment)}</p>
                    <p className={`mt-1 text-xs font-bold ${scenario.repaymentChange > 0 ? "text-[#C86A53]" : "text-[#3A6047]"}`}>
                      {scenario.repaymentChange >= 0 ? "+" : ""}
                      {currency(scenario.repaymentChange)} vs current {FREQUENCY_CONFIG[selectedForecastFrequency].label}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="grid gap-3 rounded-lg bg-[#F7F5F0] p-4 text-sm leading-6 text-[#7B756E] md:grid-cols-[1fr_auto] md:items-center">
          <p>
            Forecasts are modelled from the current 5-bank Rates API curve plus the expected OCR move. To update the
            OCR path, edit <span className="font-bold text-[#1B2A22]">OCR_FORECAST_SOURCES</span> and{" "}
            <span className="font-bold text-[#1B2A22]">CURRENT_OCR_ASSUMPTION</span> in src/financialModel.js after
            each RBNZ OCR decision or Monetary Policy Statement.
          </p>
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#E2DDD5] bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-[#3A6047]">
            <RefreshCw size={14} aria-hidden="true" />
            Feed-ready
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {OCR_FORECAST_SOURCES.map((source) =>
            source.url.startsWith("http") ? (
              <a
                key={source.source}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-[#E2DDD5] bg-white px-4 py-3 text-sm font-bold text-[#1B2A22] hover:border-[#3A6047]/60"
              >
                {source.source}
              </a>
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
