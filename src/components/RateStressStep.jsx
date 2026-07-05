import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  CURRENT_OCR_ASSUMPTION,
  FREQUENCY_CONFIG,
  MARKET_EXPECTATION_SOURCES,
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
  selectedForecastScenarioKey,
  selectedForecastTermMonths,
  setSelectedForecastScenarioKey,
  setSelectedForecastTermMonths,
  setSelectedForecastTrancheId
}) {
  const firstForecast = forecastRows[0];
  const selectedTerm =
    forecastRows.find((row) => row.months === selectedForecastTermMonths) ??
    forecastRows.find((row) => row.months === 12) ??
    firstForecast;
  const selectedScenario =
    selectedTerm?.scenarios.find((scenario) => scenario.key === selectedForecastScenarioKey) ??
    selectedTerm?.scenarios.find((scenario) => scenario.key === "base") ??
    selectedTerm?.scenarios[0];

  return (
    <StepShell
      step="Step 5"
      icon={AlertTriangle}
      title="What could I pay when I re-fix?"
      detail="Pick the loan part, the new fixed term, and one outlook. The app projects the balance at re-fix, then estimates the repayment from the current market curve plus OCR expectations."
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

        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
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
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#7B756E]">Outlook</p>
            <Segmented
              value={selectedScenario?.key ?? selectedForecastScenarioKey}
              onChange={setSelectedForecastScenarioKey}
              options={(selectedTerm?.scenarios ?? []).map((scenario) => ({
                value: scenario.key,
                label: scenario.shortLabel
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

        {selectedTerm && selectedScenario && (
          <article className="rounded-xl border border-[#E2DDD5] bg-white p-5 shadow-[0_12px_34px_rgba(27,42,34,0.06)]">
            <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#7B756E]">
                  {selectedScenario.label} outlook
                </p>
                <h3 className="mt-2 text-3xl font-black text-[#1B2A22]">{currency(selectedScenario.repayment)}</h3>
                <p className="mt-1 text-sm font-medium text-[#7B756E]">
                  Every {FREQUENCY_CONFIG[selectedForecastFrequency].label} on a {selectedTerm.label} re-fix.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-[#F7F5F0] p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#7B756E]">Forecast rate</p>
                    <p className="mt-1 text-xl font-black text-[#1B2A22]">
                      {percent(selectedScenario.forecastMortgageRate)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#F7F5F0] p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#7B756E]">Change from now</p>
                    <p className={`mt-1 text-xl font-black ${selectedScenario.repaymentChange > 0 ? "text-[#C86A53]" : "text-[#3A6047]"}`}>
                      {selectedScenario.repaymentChange >= 0 ? "+" : ""}
                      {currency(selectedScenario.repaymentChange)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#F7F5F0] p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#7B756E]">Market today</p>
                    <p className="mt-1 text-xl font-black text-[#1B2A22]">{percent(selectedTerm.marketRateToday)}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-[#E2DDD5] bg-[#F7F5F0] p-4">
                <p className="text-xs font-black uppercase tracking-wide text-[#7B756E]">OCR path used</p>
                <p className="mt-2 text-sm font-bold text-[#1B2A22]">
                  {percent(CURRENT_OCR_ASSUMPTION)} today to {percent(selectedTerm.forecastOcr)} at re-fix
                </p>
                <p className="mt-2 text-xs leading-5 text-[#7B756E]">
                  Blended from RBNZ projection assumptions and 90-day bank bill market pricing assumptions.
                </p>
              </div>
            </div>
          </article>
        )}

        <div className="grid gap-3 rounded-lg bg-[#F7F5F0] p-4 text-sm leading-6 text-[#7B756E] md:grid-cols-[1fr_auto] md:items-center">
          <p>
            Best production approach: use a small backend job to pull Yahoo Finance ^NZ90D for market-implied OCR
            expectations and RBNZ projection files for the official OCR track. Until then, update{" "}
            <span className="font-bold text-[#1B2A22]">MARKET_EXPECTATION_SOURCES</span> and{" "}
            <span className="font-bold text-[#1B2A22]">CURRENT_OCR_ASSUMPTION</span> in src/financialModel.js after
            each OCR decision or Monetary Policy Statement.
          </p>
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#E2DDD5] bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-[#3A6047]">
            <RefreshCw size={14} aria-hidden="true" />
            Feed-ready
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {[...MARKET_EXPECTATION_SOURCES, ...OCR_FORECAST_SOURCES].map((source) =>
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
