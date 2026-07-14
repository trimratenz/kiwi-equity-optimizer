import React from "react";
import { Sparkles } from "lucide-react";
import { FREQUENCY_CONFIG, currency, percent } from "../financialModel";
import { ResponsiveTable, Select, StepShell } from "./ui";

export function MarketRateComparisonStep({
  bankOptions,
  marketRateRows,
  marketRates,
  selectedBankId,
  setSelectedBankId,
  step = "Step 3"
}) {
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
      step={step}
      icon={Sparkles}
      title="How Does Each Loan Tranche Compare With the Market?"
      detail="Each loan tranche is matched to the closest comparable market term. Leave the bank selector blank for the average, or choose one bank for a direct comparison."
    >
      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_260px] lg:items-end">
        <div />
        <label className="grid gap-2 text-sm font-semibold text-slate-800">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Bank view</span>
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
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
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
          <tbody className="divide-y divide-slate-200 text-slate-900">
            {marketRateRows.map((row) => {
              const isRepaymentLower = row.repaymentDifference > 0;
              const isRepaymentSame = Math.abs(row.repaymentDifference) < 0.5;
              const repaymentTone = isRepaymentSame
                ? "text-slate-500"
                : isRepaymentLower
                  ? "text-emerald-700"
                  : "text-[#C86A53]";
              const rateTone = Math.abs(row.difference) < 0.05 ? "text-slate-500" : row.difference < 0 ? "text-emerald-700" : "text-[#C86A53]";

              return (
                <tr key={row.id}>
                <td className="p-3 align-top">
                  <p className="font-black">Tranche {row.index}</p>
                  <p className="text-xs font-medium text-slate-500">{currency(row.balance)}</p>
                </td>
                <td className="p-3 align-top">
                  <p className="font-bold">{row.type} {row.fixedTermLabel}</p>
                </td>
                <td className="p-3 align-top">
                  <p className="font-bold">{percent(row.marketRate)}</p>
                  <p className="text-xs font-medium text-slate-500">
                    {row.marketTerm} - {row.comparisonSource}
                  </p>
                </td>
                <td className="p-3 align-top">
                  <p className="font-bold">{row.lowestRate === null ? "Unavailable" : percent(row.lowestRate)}</p>
                  <p className="text-xs font-medium text-slate-500">
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
                  <p className="text-xs font-medium text-slate-500">
                    Every {FREQUENCY_CONFIG[row.frequency].label}
                  </p>
                  <p className={`mt-1 text-xs font-black ${repaymentTone}`}>
                    {isRepaymentSame
                      ? "No repayment change"
                      : `${row.repaymentDifference > 0 ? "+" : ""}${currency(row.repaymentDifference)} vs your rate`}
                  </p>
                  <p className="text-xs font-medium text-slate-500">Your current: {currency(row.currentRepayment)}</p>
                </td>
                </tr>
              );
            })}
          </tbody>
        </ResponsiveTable>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">Market comparisons are estimates only and may not include lender-specific pricing, fees, or eligibility criteria.</p>
    </StepShell>
  );
}
