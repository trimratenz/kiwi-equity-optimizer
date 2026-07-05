import React from "react";
import { Sparkles } from "lucide-react";
import { FREQUENCY_CONFIG, currency, percent } from "../financialModel";
import { ResponsiveTable, StepShell } from "./ui";

export function MarketRateComparisonStep({ marketRateRows, marketRates }) {
  const statusLabel = {
    idle: "Local worksheet",
    loading: "Loading live rates",
    live: "Live Rates API",
    worksheet: "Local worksheet",
    fallback: "Fallback rates"
  }[marketRates.status];

  return (
    <StepShell
      step="Step 4"
      icon={Sparkles}
      title="How does each loan part compare?"
      detail={`Each loan part is matched to the closest average term from ${marketRates.source}, captured ${marketRates.captured}. Use this as a prompt to compare, not as a loan offer.`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#3A6047]/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-[#3A6047]">
          {statusLabel}
        </span>
        {marketRates.error && (
          <span className="rounded-full bg-[#C86A53]/10 px-3 py-1 text-xs font-bold text-[#C86A53]">
            {marketRates.error}
          </span>
        )}
      </div>
      <div className="grid gap-5">
        <ResponsiveTable>
          <thead className="bg-[#F7F5F0] text-xs uppercase tracking-wide text-[#7B756E]">
            <tr>
              <th className="p-3">Loan part</th>
              <th className="p-3">Your setup</th>
              <th className="p-3">Matched average</th>
              <th className="p-3">Your rate</th>
              <th className="p-3">Difference</th>
              <th className="p-3">Repayment at average</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2DDD5] text-[#1B2A22]">
            {marketRateRows.map((row) => (
              <tr key={row.id}>
                <td className="p-3">
                  <p className="font-black">Loan part {row.index}</p>
                  <p className="text-xs font-medium text-[#7B756E]">{currency(row.balance)}</p>
                </td>
                <td className="p-3">
                  <p className="font-bold">{row.fixedTermLabel}</p>
                  <p className="text-xs font-medium text-[#7B756E]">{row.type}</p>
                </td>
                <td className="p-3">
                  <p className="font-bold">{percent(row.marketRate)}</p>
                  <p className="text-xs font-medium text-[#7B756E]">{row.marketTerm}</p>
                </td>
                <td className="p-3">{percent(row.currentRate)}</td>
                <td className="p-3 font-bold text-[#3A6047]">
                  {row.difference >= 0 ? "+" : ""}
                  {percent(row.difference)}
                </td>
                <td className="p-3">
                  <p>{currency(row.marketRepayment)}</p>
                  <p className="text-xs font-medium text-[#7B756E]">
                    Every {FREQUENCY_CONFIG[row.frequency].label}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </ResponsiveTable>
      </div>
      <p className="mt-4 text-xs leading-5 text-[#7B756E]">{marketRates.note}</p>
    </StepShell>
  );
}
