import React from "react";
import { Banknote, PieChart, PiggyBank } from "lucide-react";
import { currency, percent } from "../financialModel";
import { Field, NumberInput, Stat, StepShell } from "./ui";

export function RepaymentSummaryStep({
  primaryFrequency,
  repaymentFrequencyLabel,
  repaymentFrequencyNote,
  hasMixedRepaymentFrequencies,
  summary,
  modelRate,
  modelYears,
  salaryIncome,
  salaryAmount,
  repaymentToIncome,
  cashAfterRepayment,
  dtiRatio,
  dti,
  tranchesWithPayments,
  dispatch
}) {
  const frequencyLabel = primaryFrequency;
  const totalRepaymentLabel = repaymentFrequencyLabel || frequencyLabel;
  const totalRepaymentNote =
    repaymentFrequencyNote || `Summed loan-part schedules; weighted ${percent(modelRate)} over ${modelYears} years`;
  const repaymentPerSelectedPeriod = summary.repayment;

  return (
    <StepShell
      step="Step 3"
      icon={Banknote}
      title="What am I paying now?"
      detail="Start here if you simply need to know the repayment, total cost, and what remains after paying the mortgage."
    >
      <div className="grid gap-5">
        <div className="grid gap-4 rounded-2xl border border-[#E2DDD5] bg-[#F7F5F0] p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-6">
          <Stat
            label={`${totalRepaymentLabel} Repayment`}
            value={currency(repaymentPerSelectedPeriod)}
            sub={totalRepaymentNote}
            icon={Banknote}
            className="xl:col-span-3 xl:p-6"
          />
          <div className="rounded-xl border border-[#E2DDD5] bg-white p-4 shadow-[0_12px_34px_rgba(27,42,34,0.06)] xl:col-span-3 xl:p-6">
            <Field
              label={`${frequencyLabel} Income`}
              hint="After-tax income"
              error={salaryAmount <= 0 ? "Optional" : undefined}
            >
              <NumberInput
                value={salaryIncome}
                onChange={(value) => dispatch({ type: "SET_FIELD", field: "salaryIncome", value, decimal: true })}
                step={100}
                prefix="$"
                placeholder="0"
                thousands
              />
            </Field>
          </div>
          <Stat
            label="Cash after repayment"
            value={salaryAmount > 0 ? currency(cashAfterRepayment) : "Add income"}
            sub={
              salaryAmount > 0
                ? `${totalRepaymentLabel} surplus after standard mortgage payments`
                : `Enter ${primaryFrequency.toLowerCase()} income above`
            }
            icon={PiggyBank}
            className="xl:col-span-3 xl:p-6"
          />
          <Stat
            label="Repayment / income"
            value={salaryAmount > 0 ? percent(repaymentToIncome, 1) : "Add income"}
            sub={salaryAmount > 0 ? `${currency(repaymentPerSelectedPeriod)} of ${currency(salaryAmount)}` : frequencyLabel}
            icon={PieChart}
            className="xl:col-span-3"
          />
          <div className="rounded-xl border border-[#E2DDD5] bg-white p-4 shadow-[0_12px_34px_rgba(27,42,34,0.06)] xl:col-span-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#7B756E]">DTI scale</p>
              <span className="rounded-lg bg-[#F7F5F0] px-2 py-1 text-xs font-black text-[#3A6047]">
                {salaryAmount > 0 ? `${dtiRatio.toFixed(2)}x` : "Add income"}
              </span>
            </div>
            <div className="mt-4">
              <div className="relative h-3 rounded-full bg-gradient-to-r from-[#3A6047] via-[#D8A344] to-[#C86A53]">
                <span
                  className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-[#1B2A22]"
                  style={{ left: `calc(${dti.position}% - 2px)` }}
                />
              </div>
              <div className="mt-2 grid grid-cols-4 text-[10px] font-bold uppercase tracking-wide text-[#7B756E]">
                <span>0x</span>
                <span>5x watch</span>
                <span>6x owner</span>
                <span className="text-right">7x investor</span>
              </div>
            </div>
            <p className="mt-3 text-xs font-medium leading-5 text-[#7B756E]">{dti.detail}</p>
          </div>
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
                  {totalRepaymentLabel} Repayment
                </td>
                <td className="break-words px-2 py-3 font-black text-[#3A6047] sm:px-3">
                  {currency(repaymentPerSelectedPeriod)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {hasMixedRepaymentFrequencies && (
          <p className="text-xs font-medium leading-5 text-[#7B756E]">
            Mixed repayment frequencies are not added directly. TrimRate annualises each loan part's actual schedule, then
            converts the total back to the selected cash-flow period for the headline figure.
          </p>
        )}
      </div>
    </StepShell>
  );
}
