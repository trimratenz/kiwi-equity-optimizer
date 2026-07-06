import React from "react";
import { Field, NumberInput } from "./ui";

export function LoanBalanceStep({ loanBalance, hasLoanBalance, dispatch }) {
  return (
    <section className="rounded-xl border border-[#E2DDD5] bg-white p-5 shadow-[0_18px_50px_rgba(27,42,34,0.07)] sm:p-8">
      <p className="text-xs font-black uppercase tracking-wide text-[#3A6047]">Step 1</p>
      <div className="mt-2 grid gap-5 lg:grid-cols-[1fr_340px] lg:items-end">
        <div>
          <h2 className="text-3xl font-black text-[#1B2A22] sm:text-4xl">How much loan do you have?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7B756E]">
            Start with the total amount owed. The next card lets you split that loan into fixed and variable parts.
          </p>
        </div>
        <Field label="Total loan balance" error={!hasLoanBalance ? "Enter your current mortgage balance." : undefined}>
          <NumberInput
            value={loanBalance}
            onChange={(value) => dispatch({ type: "SET_FIELD", field: "loanBalance", value, decimal: true })}
            step={10000}
            prefix="$"
            placeholder="0"
            thousands
          />
        </Field>
      </div>
    </section>
  );
}
