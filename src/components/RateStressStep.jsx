import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { FREQUENCY_CONFIG, OCR_FORECAST_SOURCES, currency, monthsLabel, percent } from "../financialModel";
import { ResponsiveTable, Segmented, Stat, StepShell } from "./ui";

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

        <ResponsiveTable>
          <thead className="bg-[#F7F5F0] text-xs uppercase tracking-wide text-[#7B756E]">
            <tr>
              <th className="p-3">New fixed term</th>
              <th className="p-3">Re-fix point</th>
              <th className="p-3">Consensus OCR</th>
              <th className="p-3">Forecast mortgage rate</th>
              <th className="p-3">{FREQUENCY_CONFIG[selectedForecastFrequency].label} repayment</th>
              <th className="p-3">Change from now</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2DDD5] text-[#1B2A22]">
            {forecastRows.map((row) => (
              <tr key={row.months}>
                <td className="p-3 font-black">{row.label}</td>
                <td className="p-3">{row.refixPointLabel}</td>
                <td className="p-3">{percent(row.forecastOcr)}</td>
                <td className="p-3 font-bold">{percent(row.forecastMortgageRate)}</td>
                <td className="p-3 font-black text-[#3A6047]">{currency(row.repayment)}</td>
                <td className={`p-3 font-bold ${row.repaymentChange > 0 ? "text-[#C86A53]" : "text-[#3A6047]"}`}>
                  {row.repaymentChange >= 0 ? "+" : ""}
                  {currency(row.repaymentChange)}
                </td>
              </tr>
            ))}
          </tbody>
        </ResponsiveTable>

        <div className="grid gap-3 rounded-lg bg-[#F7F5F0] p-4 text-sm leading-6 text-[#7B756E] md:grid-cols-[1fr_auto] md:items-center">
          <p>
            Live refresh should use official, licensed, or manually reviewed forecast data. This local app uses a
            built-in fallback with the same source shape a permissioned backend feed can replace.
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
