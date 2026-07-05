import React from "react";
import { Banknote, PiggyBank, SlidersHorizontal } from "lucide-react";
import { FREQUENCY_CONFIG, affordabilitySnapshot, currency, percent } from "../financialModel";
import { Field, NumberInput, ResponsiveTable, Stat, StepShell } from "./ui";

export function RepaymentSummaryStep({
  primaryFrequency,
  summary,
  modelRate,
  modelYears,
  salaryIncome,
  salaryAmount,
  repaymentToIncomeRatio,
  tranchesWithPayments,
  dispatch
}) {
  const affordability = affordabilitySnapshot({
    repayment: summary.repayment,
    income: salaryAmount
  });
  const ratioWidth = Math.min(Math.max((affordability.ratio / affordability.stretchedRatio) * 100, 0), 100);
  const bandClass = {
    good: "bg-[#3A6047]/10 text-[#3A6047]",
    watch: "bg-[#3A6047]/10 text-[#3A6047]",
    tight: "bg-[#C86A53]/10 text-[#C86A53]",
    stretched: "bg-[#C86A53]/10 text-[#C86A53]",
    neutral: "bg-[#F7F5F0] text-[#7B756E]"
  }[affordability.tone];

  return (
    <StepShell
      step="Step 3"
      icon={Banknote}
      title="What will I pay?"
      detail="Start here if you simply need to know the repayment, total cost, and how it sits against your income."
    >
      <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
        <div className="grid gap-3">
          <Stat
            label={`Total ${FREQUENCY_CONFIG[primaryFrequency].label} repayment`}
            value={currency(summary.repayment)}
            sub={`At blended ${percent(modelRate)} over ${modelYears} years`}
            icon={Banknote}
          />
          <Stat label="Total paid over loan" value={currency(summary.totalPaid)} sub="Principal plus interest" icon={PiggyBank} />
          <Field
            label={`Your ${FREQUENCY_CONFIG[primaryFrequency].label} income`}
            hint="After tax is best"
            error={salaryAmount <= 0 ? "Optional, but needed for the income comparison." : undefined}
          >
            <NumberInput
              value={salaryIncome}
              onChange={(value) => dispatch({ type: "SET_FIELD", field: "salaryIncome", value, decimal: true })}
              step={100}
              prefix="$"
              placeholder="0"
            />
          </Field>
          <Stat
            label="Repayment vs income"
            value={salaryAmount > 0 ? percent(repaymentToIncomeRatio, 1) : "Add income"}
            sub={
              salaryAmount > 0
                ? `${currency(summary.repayment)} of ${currency(salaryAmount)}`
                : `Enter your ${FREQUENCY_CONFIG[primaryFrequency].label} income`
            }
            icon={SlidersHorizontal}
          />
          <div className="rounded-xl border border-[#E2DDD5] bg-white p-4 shadow-[0_12px_34px_rgba(27,42,34,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#7B756E]">Affordability</p>
                <p className="mt-2 text-2xl font-black text-[#1B2A22]">{affordability.band}</p>
                <p className="mt-1 text-xs font-medium leading-5 text-[#7B756E]">{affordability.detail}</p>
              </div>
              <span className={`rounded-md px-3 py-2 text-xs font-black ${bandClass}`}>
                Target {affordability.targetRatio}%
              </span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#F7F5F0]">
              <div className="h-full rounded-full bg-[#3A6047]" style={{ width: `${ratioWidth}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[11px] font-bold uppercase tracking-wide text-[#7B756E]">
              <span>0%</span>
              <span>28%</span>
              <span>35%</span>
              <span>45%+</span>
            </div>
          </div>
        </div>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Ideal income"
              value={currency(affordability.incomeNeededForTarget)}
              sub={`For repayments to be ${affordability.targetRatio}% of income`}
              icon={SlidersHorizontal}
            />
            <Stat
              label="Watch-line income"
              value={currency(affordability.incomeNeededForWatch)}
              sub={`At ${affordability.watchRatio}% of income`}
              icon={SlidersHorizontal}
            />
            <Stat
              label="Cash after repayment"
              value={salaryAmount > 0 ? currency(affordability.cashAfterRepayment) : "Add income"}
              sub={`Every ${FREQUENCY_CONFIG[primaryFrequency].label}`}
              icon={PiggyBank}
            />
          </div>

          <ResponsiveTable>
            <thead className="bg-[#F7F5F0] text-xs uppercase tracking-wide text-[#7B756E]">
              <tr>
                <th className="p-3">Loan part</th>
                <th className="p-3">Type</th>
                <th className="p-3">Balance</th>
                <th className="p-3">Rate</th>
                <th className="p-3">Frequency</th>
                <th className="p-3">Repayment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2DDD5] text-[#1B2A22]">
              {tranchesWithPayments.map((tranche) => (
                <tr key={tranche.id}>
                  <td className="p-3 font-bold">{tranche.index}</td>
                  <td className="p-3">{tranche.type}</td>
                  <td className="p-3">{currency(tranche.amount)}</td>
                  <td className="p-3">{percent(tranche.rate)}</td>
                  <td className="p-3">{tranche.frequency}</td>
                  <td className="p-3 font-bold text-[#3A6047]">{currency(tranche.repayment)}</td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        </div>
      </div>
    </StepShell>
  );
}
