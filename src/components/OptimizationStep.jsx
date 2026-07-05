import React from "react";
import { CheckCircle2, Minus, PiggyBank, Plus } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FREQUENCY_CONFIG, currency, yearsAndMonths } from "../financialModel";
import { Field, NumberInput, Select, Stat, StepShell } from "./ui";

export function OptimizationStep({
  extraPayment,
  interestOnlyYears,
  payoffRows,
  primaryFrequency,
  summary,
  dispatch,
  nudgeExtra
}) {
  return (
    <StepShell
      step="Step 6"
      icon={PiggyBank}
      title="How can I improve this?"
      detail="Make one controlled change at a time: extra repayments, interest-only period, or loan structure."
    >
      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <div className="grid gap-4">
          <Field label={`Extra per ${FREQUENCY_CONFIG[primaryFrequency].label}`} hint={currency(Number(extraPayment) || 0)}>
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
          <Stat
            label="Interest saved"
            value={currency(summary.interestSaved)}
            sub={`${yearsAndMonths(summary.timeSavedPeriods, primaryFrequency)} sooner`}
            icon={CheckCircle2}
          />
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
