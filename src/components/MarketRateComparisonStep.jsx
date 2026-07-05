import React from "react";
import { Sparkles } from "lucide-react";
import { MARKET_RATE_SNAPSHOT, FREQUENCY_CONFIG, currency, percent } from "../financialModel";
import { ResponsiveTable, StepShell } from "./ui";

export function MarketRateComparisonStep({ marketRateRows }) {
  const hasLiveRatesUrl = Boolean(MARKET_RATE_SNAPSHOT.url);

  return (
    <StepShell
      step="Step 4"
      icon={Sparkles}
      title="How does each loan part compare?"
      detail={`Each loan part is matched to the closest average term from ${MARKET_RATE_SNAPSHOT.source}, captured ${MARKET_RATE_SNAPSHOT.captured}. Use this as a prompt to compare, not as a loan offer.`}
    >
      <div className={`grid gap-5 ${hasLiveRatesUrl ? "xl:grid-cols-[1fr_300px]" : ""}`}>
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
        {hasLiveRatesUrl && (
          <div className="grid content-start gap-3">
            <a
              href={MARKET_RATE_SNAPSHOT.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-[#3A6047]/60 bg-[#3A6047]/10 px-4 py-3 text-sm font-black text-[#3A6047] hover:bg-[#3A6047] hover:text-white"
            >
              Check live rates
            </a>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs leading-5 text-[#7B756E]">{MARKET_RATE_SNAPSHOT.note}</p>
    </StepShell>
  );
}
