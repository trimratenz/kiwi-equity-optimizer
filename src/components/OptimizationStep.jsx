import React from "react";
import { Minus, PiggyBank, Plus, WalletCards } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FREQUENCY_CONFIG, currency, yearsAndMonths } from "../financialModel";
import { Field, NumberInput, Select, StepShell } from "./ui";

export function OptimizationStep({
  extraPayment,
  outgoingCosts,
  interestOnlyYears,
  payoffRows,
  primaryFrequency,
  netCash,
  summary,
  dispatch,
  nudgeExtra
}) {
  return (
    <StepShell
      step="Step 6"
      icon={PiggyBank}
      title="What changes could improve the numbers?"
      detail="Model one controlled change at a time: extra repayments, interest-only period, or loan structure."
    >
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="grid content-start gap-4">
          <div className="rounded-xl border border-[#E2DDD5] bg-[#FFFEFC] p-4 shadow-[0_12px_34px_rgba(27,42,34,0.05)]">
            <p className="text-xs font-black uppercase tracking-wide text-[#3A6047]">Cash-flow inputs</p>
            <div className="mt-4 grid gap-4">
              <Field label={`Extra repayment per ${FREQUENCY_CONFIG[primaryFrequency].label}`} hint="Optional">
                <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
                  <button
                    type="button"
                    onClick={() => nudgeExtra(-25)}
                    className="inline-flex h-11 items-center justify-center rounded-lg border border-[#E2DDD5] bg-white text-[#1B2A22] hover:border-[#3A6047]/70 hover:text-[#3A6047]"
                  >
                    <Minus size={16} aria-hidden="true" />
                  </button>
                  <NumberInput
                    value={extraPayment}
                    onChange={(value) => dispatch({ type: "SET_FIELD", field: "extraPayment", value, decimal: true })}
                    step={25}
                    prefix="$"
                    placeholder="Optional"
                    thousands
                  />
                  <button
                    type="button"
                    onClick={() => nudgeExtra(25)}
                    className="inline-flex h-11 items-center justify-center rounded-lg border border-[#E2DDD5] bg-white text-[#1B2A22] hover:border-[#3A6047]/70 hover:text-[#3A6047]"
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </div>
              </Field>
              <Field label={`Living costs per ${FREQUENCY_CONFIG[primaryFrequency].label}`} hint="Excluding mortgage">
                <NumberInput
                  value={outgoingCosts}
                  onChange={(value) => dispatch({ type: "SET_FIELD", field: "outgoingCosts", value, decimal: true })}
                  step={50}
                  prefix="$"
                  placeholder="0"
                  thousands
                />
              </Field>
              <Field label="Interest-only years" hint="Investor scenario">
                <Select
                  value={interestOnlyYears}
                  onChange={(value) => dispatch({ type: "SET_FIELD", field: "interestOnlyYears", value, decimal: true })}
                >
                  {[0, 1, 2, 3, 4, 5].map((year) => (
                    <option key={year} value={year}>
                      {year} {year === 1 ? "year" : "years"}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>

          <div className="rounded-xl border border-[#BFD3C5] bg-[#F4FAF6] p-4 shadow-[0_12px_34px_rgba(27,42,34,0.05)]">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-white p-2 text-[#3A6047] shadow-sm">
                <WalletCards size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-[#3A6047]">Result per {FREQUENCY_CONFIG[primaryFrequency].label}</p>
                <p className="mt-1 text-2xl font-black text-[#1B2A22]">
                  {netCash.incomePerPeriod > 0 ? currency(netCash.cashAfterOutgoings) : "Add income"}
                </p>
                <p className="mt-1 text-xs font-medium leading-5 text-[#6D756E]">
                  Cash left after mortgage, optional top-up, and living costs.
                </p>
              </div>
            </div>

            <div className="mt-4 divide-y divide-[#D6E2DA] rounded-lg bg-white px-3 text-sm">
              <div className="flex items-center justify-between gap-3 py-2">
                <span className="font-semibold text-[#6D756E]">Income</span>
                <span className="font-black text-[#1B2A22]">{currency(netCash.incomePerPeriod)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <span className="font-semibold text-[#6D756E]">Mortgage + top-up</span>
                <span className="font-black text-[#1B2A22]">{currency(netCash.repaymentWithExtra)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <span className="font-semibold text-[#6D756E]">Living costs</span>
                <span className="font-black text-[#1B2A22]">{currency(netCash.outgoingCosts)}</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#7B756E]">Interest saved</p>
                <p className="mt-1 text-lg font-black text-[#1B2A22]">{currency(summary.interestSaved)}</p>
              </div>
              <div className="rounded-lg bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#7B756E]">Time saved</p>
                <p className="mt-1 text-lg font-black text-[#1B2A22]">
                  {yearsAndMonths(summary.timeSavedPeriods, primaryFrequency)}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="h-80 min-h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={payoffRows}>
              <defs>
                <linearGradient id="standardDebt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C86A53" stopOpacity={0.26} />
                  <stop offset="95%" stopColor="#C86A53" stopOpacity={0.04} />
                </linearGradient>
                <linearGradient id="fasterDebt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3A6047" stopOpacity={0.26} />
                  <stop offset="95%" stopColor="#3A6047" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DDD5" />
              <XAxis dataKey="year" tick={{ fill: "#7B756E" }} axisLine={{ stroke: "#E2DDD5" }} tickLine={false} />
              <YAxis
                tickFormatter={(value) => `$${Math.round(value / 1000)}k`}
                width={54}
                tick={{ fill: "#7B756E" }}
                axisLine={{ stroke: "#E2DDD5" }}
                tickLine={false}
              />
              <Tooltip
                formatter={(value) => currency(value)}
                contentStyle={{
                  background: "#FFFFFF",
                  border: "1px solid #E2DDD5",
                  borderRadius: 10,
                  color: "#1B2A22"
                }}
                labelStyle={{ color: "#1B2A22" }}
              />
              <Legend wrapperStyle={{ color: "#7B756E" }} />
              <Area
                type="monotone"
                dataKey="standardDebt"
                name="Current debt path"
                stroke="#C86A53"
                fill="url(#standardDebt)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="fasterDebt"
                name="With top-ups"
                stroke="#3A6047"
                fill="url(#fasterDebt)"
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </StepShell>
  );
}
