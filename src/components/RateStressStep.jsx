import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  FREQUENCY_CONFIG,
  currency,
  monthsLabel,
  percent
} from "../financialModel";
import { USER_RATE_DATA_NOTICE } from "../snapshotLayer.js";
import { Field, NumberInput, Segmented, Stat, StepShell } from "./ui";

export function RateStressStep({
  forecastRows,
  forecastTranches,
  selectedForecastTranche,
  selectedForecastTrancheId,
  selectedForecastFrequency,
  selectedForecastPayment,
  selectedForecastRow,
  scenarioLabel,
  selectedForecastTermMonths,
  setSelectedForecastTermMonths,
  setSelectedForecastTrancheId,
  updateTranche,
  step = "Step 4"
}) {
  const selectedTerm =
    selectedForecastRow ??
    forecastRows.find((row) => row.months === selectedForecastTermMonths) ??
    forecastRows.find((row) => row.months === 12) ??
    forecastRows[0];

  return (
    <StepShell
      step={step}
      icon={AlertTriangle}
      title="What could I pay when I re-fix?"
      detail="Pick the loan tranche and the new fixed term. TrimRate uses the RBNZ OCR forecast for the date your fixed term ends, then shows three repayment outlooks together."
    >
      <div className="grid gap-5">
        <Segmented
          value={selectedForecastTranche?.id || selectedForecastTrancheId || forecastTranches[0]?.id}
          onChange={setSelectedForecastTrancheId}
          options={forecastTranches.map((tranche) => ({
            value: tranche.id,
            label: forecastTranches.length === 1 ? "Loan details" : `Loan Tranche ${tranche.index}`
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
              sub={`Current fixed term: ${monthsLabel(selectedForecastTranche.fixedTermMonths)}`}
            />
            <Stat
              label="Balance at re-fix"
              value={currency(selectedTerm?.remainingBalance ?? selectedForecastTranche.resolvedBalanceAtRefix ?? selectedForecastTranche.amount)}
              sub="Projected from the current balance and repayment"
            />
            <Stat
              label={`Current ${FREQUENCY_CONFIG[selectedForecastFrequency].label} repayment`}
              value={currency(selectedForecastPayment)}
              sub={`At ${percent(selectedForecastTranche.rate)}`}
            />
          </div>
        )}

        {selectedForecastTranche?.type === "Fixed" && (
          <div className="rounded-xl border border-[#E2DDD5] bg-[#F7F5F0] p-4">
            <Field
              label="Balance at re-fix"
              hint="Optional adjustment"
              error={selectedForecastTranche.balanceAtRefixError || undefined}
            >
              <NumberInput
                value={selectedForecastTranche.balanceAtRefixInput || ""}
                onChange={(value) => updateTranche(selectedForecastTranche.id, { balanceAtRefix: value })}
                step={1000}
                prefix="$"
                placeholder={String(Math.round(selectedForecastTranche.estimatedBalanceAtRefix ?? selectedTerm?.remainingBalance ?? 0))}
                thousands
              />
            </Field>
            <p className="mt-2 text-xs font-medium leading-5 text-[#7B756E]">
              Your balance at refix is used to estimate what your repayments could look like when this loan rolls over.
            </p>
            {selectedForecastTranche.estimatedBalanceAtRefix >= selectedForecastTranche.amount && (
              <p className="mt-2 rounded-md bg-[#FFF8E1] px-3 py-2 text-xs font-semibold leading-5 text-[#6B5B2A]">
                This estimate has not reduced from today&apos;s balance. Check your repayment amount and months until re-fix.
              </p>
            )}
          </div>
        )}

        {selectedTerm && (
          <article className="rounded-xl border border-[#E2DDD5] bg-white p-5 shadow-[0_12px_34px_rgba(27,42,34,0.06)]">
            <div className="grid gap-5">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#7B756E]">Selected re-fix scenario</p>
                <p className="mt-1 text-sm font-black text-[#3A6047]">
                  Showing scenario for {scenarioLabel ?? "Loan details"}
                </p>
                <h3 className="mt-2 text-2xl font-black text-[#1B2A22]">
                  {selectedTerm.label} fixed in {selectedTerm.refixPointLabel}
                </h3>
                <p className="mt-1 text-sm font-medium leading-6 text-[#7B756E]">
                  RBNZ OCR forecast at that point is {percent(selectedTerm.forecastOcr)}. Current Five-bank average for a{" "}
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
                  OCR snapshot:{" "}
                  {selectedTerm.forecastSourceUrl ? (
                    <a
                      href={selectedTerm.forecastSourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-[#3A6047] underline-offset-2 hover:underline"
                    >
                      {selectedTerm.forecastSource}
                    </a>
                  ) : (
                    selectedTerm.forecastSource
                  )}
                  , last reviewed {selectedTerm.ocrLastRefreshed}.{" "}
                  {selectedTerm.currentOcrSourceUrl ? (
                    <a
                      href={selectedTerm.currentOcrSourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-[#3A6047] underline-offset-2 hover:underline"
                    >
                      Current OCR {percent(selectedTerm.currentOcr)}
                    </a>
                  ) : (
                    <>Current OCR {percent(selectedTerm.currentOcr)}</>
                  )}{" "}
                  as at {selectedTerm.currentOcrUpdatedAt || selectedTerm.ocrLastRefreshed} to{" "}
                  {percent(selectedTerm.forecastOcr)} for the {selectedTerm.forecastQuarterDate} quarter forecast.
                </p>
              </div>
            </div>
          </article>
        )}

        <div className="grid gap-3 rounded-lg bg-[#F7F5F0] p-4 text-sm leading-6 text-[#7B756E] md:grid-cols-[1fr_auto] md:items-center">
          <p>{USER_RATE_DATA_NOTICE}</p>
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#E2DDD5] bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-[#3A6047]">
            <RefreshCw size={14} aria-hidden="true" />
            Snapshot-based
          </div>
        </div>
      </div>
    </StepShell>
  );
}
