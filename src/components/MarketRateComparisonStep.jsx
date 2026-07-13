import React from "react";
import { Sparkles } from "lucide-react";
import { FREQUENCY_CONFIG, currency, percent } from "../financialModel";
import { ResponsiveTable, Select, StepShell } from "./ui";

export function MarketRateComparisonStep({
  bankOptions,
  marketRateRows,
  marketRates,
  selectedBankId,
  setSelectedBankId
}) {
  const statusLabel = {
    idle: "Cached rates",
    loading: "Refreshing rates",
    live: "Rates API",
    fallback: "Cached rates"
  }[marketRates.status];
  const selectedBankName = bankOptions.find((bank) => bank.id === selectedBankId)?.name;
  const matchedRateLabel = selectedBankName ? `${selectedBankName} rate` : "Five-bank average";
  const differenceLabel = selectedBankName ? `${selectedBankName} vs your rate` : "Average vs your rate";
  const repaymentFrequencies = [...new Set(marketRateRows.map((row) => row.frequency).filter(Boolean))];
  const impactLabel =
    repaymentFrequencies.length === 1 && repaymentFrequencies[0] === "Monthly"
      ? "Estimated monthly impact"
      : "Estimated repayment impact";

  return (
    <StepShell
      step="Step 3"
      icon={Sparkles}
      title="How Does Each Loan Tranche Compare With the Market?"
      detail={`Each loan tranche is matched to the closest term from ${marketRates.source}. Last refreshed ${marketRates.lastRefreshed || marketRates.captured}. Leave the bank selector blank for the average, or choose one bank for a direct comparison.`}
    >
      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_260px] lg:items-end">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#3A6047]/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-[#3A6047]">
            {statusLabel}
          </span>
          {marketRates.error && marketRates.status === "fallback" && (
            <span className="rounded-full bg-[#C86A53]/10 px-3 py-1 text-xs font-bold text-[#C86A53]">
              Using cached rates
            </span>
          )}
        </div>
        <label className="grid gap-2 text-sm font-semibold text-[#1B2A22]">
          <span className="text-xs font-bold uppercase tracking-wide text-[#7B756E]">Bank view</span>
          <Select value={selectedBankId} onChange={setSelectedBankId}>
            <option value="">Five-bank average</option>
            {bankOptions.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="grid gap-5">
        <ResponsiveTable>
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[13%]" />
            <col className="w-[15%]" />
            <col className="w-[14%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[22%]" />
          </colgroup>
          <thead className="bg-[#F7F5F0] text-xs uppercase tracking-wide text-[#7B756E]">
            <tr>
              <th className="p-3">Tranche</th>
              <th className="p-3">Your setup</th>
              <th className="p-3">{matchedRateLabel}</th>
              <th className="p-3">Lowest bank</th>
              <th className="p-3">Your rate</th>
              <th className="p-3">{differenceLabel}</th>
              <th className="p-3">{impactLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2DDD5] text-[#1B2A22]">
            {marketRateRows.map((row) => {
              const isRepaymentLower = row.repaymentDifference > 0;
              const isRepaymentSame = Math.abs(row.repaymentDifference) < 0.5;
              const repaymentTone = isRepaymentSame
                ? "text-[#7B756E]"
                : isRepaymentLower
                  ? "text-[#3A6047]"
                  : "text-[#C86A53]";
              const rateTone = Math.abs(row.difference) < 0.05 ? "text-[#7B756E]" : row.difference < 0 ? "text-[#3A6047]" : "text-[#C86A53]";

              return (
                <tr key={row.id}>
                <td className="p-3 align-top">
                  <p className="font-black">Tranche {row.index}</p>
                  <p className="text-xs font-medium text-[#7B756E]">{currency(row.balance)}</p>
                </td>
                <td className="p-3 align-top">
                  <p className="font-bold">{row.type} {row.fixedTermLabel}</p>
                </td>
                <td className="p-3 align-top">
                  <p className="font-bold">{percent(row.marketRate)}</p>
                  <p className="text-xs font-medium text-[#7B756E]">
                    {row.marketTerm} - {row.comparisonSource}
                  </p>
                </td>
                <td className="p-3 align-top">
                  <p className="font-bold">{row.lowestRate === null ? "Unavailable" : percent(row.lowestRate)}</p>
                  <p className="text-xs font-medium text-[#7B756E]">
                    {row.lowestBanks?.length ? row.lowestBanks.join(", ") : "Unavailable"}
                  </p>
                </td>
                <td className="p-3 align-top">{percent(row.currentRate)}</td>
                <td className={`p-3 align-top font-bold ${rateTone}`}>
                  {row.difference >= 0 ? "+" : ""}
                  {percent(row.difference)}
                </td>
                <td className="p-3 align-top">
                  <p className="font-bold">{currency(row.marketRepayment)}</p>
                  <p className="text-xs font-medium text-[#7B756E]">
                    Every {FREQUENCY_CONFIG[row.frequency].label}
                  </p>
                  <p className={`mt-1 text-xs font-black ${repaymentTone}`}>
                    {isRepaymentSame
                      ? "No repayment change"
                      : `${row.repaymentDifference > 0 ? "+" : ""}${currency(row.repaymentDifference)} vs your rate`}
                  </p>
                  <p className="text-xs font-medium text-[#7B756E]">Your current: {currency(row.currentRepayment)}</p>
                </td>
                </tr>
              );
            })}
          </tbody>
        </ResponsiveTable>
      </div>
      <p className="mt-4 text-xs leading-5 text-[#7B756E]">{marketRates.note}</p>
    </StepShell>
  );
}
