import React from "react";
import { Banknote, PieChart, PiggyBank } from "lucide-react";
import { FREQUENCY_CONFIG, currency, percent } from "../financialModel";
import { Field, NumberInput, Stat, StepShell } from "./ui";

export function RepaymentSummaryStep({
  primaryFrequency,
  summary,
  modelRate,
  modelYears,
  salaryIncome,
  salaryAmount,
  tranchesWithPayments,
  dispatch
}) {
  const periodLabel = FREQUENCY_CONFIG[primaryFrequency].label;
  const incomePeriodLabel = `${periodLabel.charAt(0).toUpperCase()}${periodLabel.slice(1)}ly`;
  const totalAnnualRepayment = tranchesWithPayments.reduce((sum, tranche) => sum + tranche.annualPayment, 0);
  const totalRepayment = totalAnnualRepayment / FREQUENCY_CONFIG[primaryFrequency].periodsPerYear;
  const repaymentToIncome = salaryAmount > 0 ? (totalRepayment / salaryAmount) * 100 : 0;
  const cashAfterRepayment = Math.max(salaryAmount - totalRepayment, 0);

  return (
    <StepShell
      step="Step 3"
      icon={Banknote}
      title="What will I pay?"
      detail="Start here if you simply need to know the repayment, total cost, and what remains after paying the mortgage."
    >
      <div className="grid gap-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Stat
            label={`Total ${FREQUENCY_CONFIG[primaryFrequency].label} repayment`}
            value={currency(totalRepayment)}
            sub={`At blended ${percent(modelRate)} over ${modelYears} years`}
            icon={Banknote}
          />
          <Stat label="Total paid over loan" value={currency(summary.totalPaid)} sub="Principal plus interest" icon={PiggyBank} />
          <div className="rounded-xl border border-[#E2DDD5] bg-white p-4 shadow-[0_12px_34px_rgba(27,42,34,0.06)]">
            <Field
              label={`${incomePeriodLabel} income`}
              hint="After tax is best"
              error={salaryAmount <= 0 ? "Optional" : undefined}
            >
              <NumberInput
                value={salaryIncome}
                onChange={(value) => dispatch({ type: "SET_FIELD", field: "salaryIncome", value, decimal: true })}
                step={100}
                prefix="$"
                placeholder="0"
              />
            </Field>
          </div>
          <Stat
            label="Repayment / income"
            value={salaryAmount > 0 ? percent(repaymentToIncome, 1) : "Add income"}
            sub={salaryAmount > 0 ? `${currency(totalRepayment)} of ${currency(salaryAmount)}` : `Every ${periodLabel}`}
            icon={PieChart}
          />
          <Stat
            label="Cash after repayment"
            value={salaryAmount > 0 ? currency(cashAfterRepayment) : "Add income"}
            sub={`Every ${periodLabel}`}
            icon={PiggyBank}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-[#E2DDD5] bg-white">
          <table className="w-full table-fixed text-left text-xs sm:text-sm">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[23%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[17%]" />
            </colgroup>
            <thead className="bg-[#F7F5F0] text-[10px] uppercase tracking-wide text-[#7B756E] sm:text-xs">
              <tr>
                <th className="px-2 py-3 sm:px-3">Part</th>
                <th className="px-2 py-3 sm:px-3">Type</th>
                <th className="px-2 py-3 sm:px-3">Balance</th>
                <th className="px-2 py-3 sm:px-3">Rate</th>
                <th className="px-2 py-3 sm:px-3">Freq.</th>
                <th className="px-2 py-3 sm:px-3">Repay.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2DDD5] text-[#1B2A22]">
              {tranchesWithPayments.map((tranche) => (
                <tr key={tranche.id}>
                  <td className="px-2 py-3 font-bold sm:px-3">{tranche.index}</td>
                  <td className="px-2 py-3 sm:px-3">{tranche.type}</td>
                  <td className="break-words px-2 py-3 sm:px-3">{currency(tranche.amount)}</td>
                  <td className="px-2 py-3 sm:px-3">{percent(tranche.rate)}</td>
                  <td className="px-2 py-3 sm:px-3">{tranche.frequency}</td>
                  <td className="break-words px-2 py-3 font-bold text-[#3A6047] sm:px-3">
                    {currency(tranche.repayment)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-[#E2DDD5] bg-[#F7F5F0] text-[#1B2A22]">
              <tr>
                <td className="px-2 py-3 font-black sm:px-3" colSpan={5}>
                  Total {periodLabel} repayment
                </td>
                <td className="break-words px-2 py-3 font-black text-[#3A6047] sm:px-3">
                  {currency(totalRepayment)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </StepShell>
  );
}
