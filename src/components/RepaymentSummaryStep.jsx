import React from "react";
import { Banknote, PiggyBank } from "lucide-react";
import { FREQUENCY_CONFIG, currency, percent } from "../financialModel";
import { Field, NumberInput, ResponsiveTable, Stat, StepShell } from "./ui";

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
  const cashAfterRepayment = Math.max(salaryAmount - summary.repayment, 0);

  return (
    <StepShell
      step="Step 3"
      icon={Banknote}
      title="What will I pay?"
      detail="Start here if you simply need to know the repayment, total cost, and what remains after paying the mortgage."
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
            label="Cash after repayment"
            value={salaryAmount > 0 ? currency(cashAfterRepayment) : "Add income"}
            sub={`Every ${FREQUENCY_CONFIG[primaryFrequency].label}`}
            icon={PiggyBank}
          />
        </div>
        <div className="grid gap-4">
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
