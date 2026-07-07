import React from "react";
import { CheckCircle2, Landmark, Plus, Trash2 } from "lucide-react";
import { FIXED_TERM_OPTIONS, FREQUENCY_CONFIG, currency } from "../financialModel";
import { Field, NumberInput, Segmented, Select, StepShell } from "./ui";

export function LoanStructureStep({
  isSplitLoan,
  loanAmount,
  loanStructure,
  displayedTranches,
  normalizedTranches,
  trancheTotal,
  splitMatches,
  setupComplete,
  completionItems,
  dispatch,
  updateTranche,
  addTranche,
  removeTranche
}) {
  const hasLoanBalance = loanAmount > 0;
  const missingRateCount = normalizedTranches.filter((tranche) => tranche.rate <= 0).length;

  return (
    <StepShell
      step="Step 2"
      icon={Landmark}
      title="Tell us how your loan is structured"
      detail="One loan part is enough for most people. Add another only if your mortgage is split across different rates or repayment settings."
    >
      <div className="grid gap-5">
        <Field label="Is this loan split into different parts?">
          <Segmented
            value={loanStructure}
            onChange={(value) => dispatch({ type: "SET_FIELD", field: "loanStructure", value })}
            options={[
              { value: "single", label: "No, one loan" },
              { value: "split", label: "Yes, split loan" }
            ]}
          />
        </Field>

        <div className="space-y-4">
          {displayedTranches.map((tranche, index) => {
            const normalized = normalizedTranches[index];

            return (
              <div key={tranche.id} className="rounded-xl border border-[#E2DDD5] bg-[#FFFEFC] p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{isSplitLoan ? `Loan part ${index + 1}` : "Loan details"}</p>
                    {!isSplitLoan && (
                      <p className="text-sm font-medium text-[#7B756E]">
                        Repayments use the total loan balance from Step 1.
                      </p>
                    )}
                  </div>
                  {isSplitLoan && (
                    <button
                      type="button"
                      onClick={() => removeTranche(tranche.id)}
                      disabled={displayedTranches.length === 1}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2DDD5] text-[#7B756E] hover:border-[#C86A53]/70 hover:bg-[#C86A53]/10 hover:text-[#C86A53] disabled:cursor-not-allowed disabled:opacity-35"
                      title="Remove loan part"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="grid gap-4">
                  {isSplitLoan && (
                    <Field
                      label="Balance for this part"
                      error={normalized?.amount <= 0 ? "Enter this loan part balance." : undefined}
                    >
                      <NumberInput
                        value={tranche.amount}
                        onChange={(value) => updateTranche(tranche.id, { amount: value })}
                        step={5000}
                        prefix="$"
                        placeholder="0"
                        thousands
                      />
                    </Field>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Interest rate" error={normalized?.rate <= 0 ? "Add the current rate for this loan part." : undefined}>
                      <NumberInput
                        value={tranche.rate}
                        onChange={(value) => updateTranche(tranche.id, { rate: value })}
                        step={0.05}
                        suffix="%"
                        placeholder="6.50"
                      />
                    </Field>
                    <Field label="Loan term">
                      <NumberInput
                        value={tranche.termYears}
                        onChange={(value) => updateTranche(tranche.id, { termYears: value })}
                        min={1}
                        max={35}
                        suffix="yr"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Type">
                      <Segmented
                        value={tranche.type}
                        onChange={(value) =>
                          updateTranche(tranche.id, {
                            type: value,
                            fixedTermMonths: value === "Variable" ? "0" : tranche.fixedTermMonths || "12",
                            fixedMonths: value === "Variable" ? "0" : tranche.fixedMonths || "12"
                          })
                        }
                        options={[
                          { value: "Fixed", label: "Fixed" },
                          { value: "Variable", label: "Variable" }
                        ]}
                      />
                    </Field>
                    <Field label="Repayment frequency">
                      <Select value={tranche.frequency} onChange={(value) => updateTranche(tranche.id, { frequency: value })}>
                        {Object.keys(FREQUENCY_CONFIG).map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  {tranche.type === "Fixed" && (
                    <Field label="Fixed term">
                      <Segmented
                        value={tranche.fixedTermMonths || "12"}
                        onChange={(value) => updateTranche(tranche.id, { fixedTermMonths: value, fixedMonths: value })}
                        options={FIXED_TERM_OPTIONS.map((option) => ({
                          value: String(option.months),
                          label: option.label
                        }))}
                      />
                    </Field>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Offset/redraw balance" hint="Optional">
                      <NumberInput
                        value={tranche.offsetBalance}
                        onChange={(value) => updateTranche(tranche.id, { offsetBalance: value })}
                        step={1000}
                        prefix="$"
                        thousands
                      />
                    </Field>
                    <Field
                      label="Fixed ends in"
                      hint={tranche.type === "Variable" ? "N/A" : "Defaults from fixed term"}
                    >
                      <NumberInput
                        value={tranche.fixedMonths}
                        onChange={(value) => updateTranche(tranche.id, { fixedMonths: value })}
                        min={0}
                        max={60}
                        suffix="mo"
                        disabled={tranche.type === "Variable"}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          {isSplitLoan ? (
            <button
              type="button"
              onClick={addTranche}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-dashed border-[#3A6047]/60 bg-[#3A6047]/10 px-4 text-sm font-black text-[#3A6047] hover:bg-[#3A6047] hover:text-white"
            >
              <Plus size={18} aria-hidden="true" />
              Add another loan part
            </button>
          ) : (
            <div className="rounded-lg bg-[#F7F5F0] px-4 py-3 text-sm font-semibold text-[#7B756E]">
              No split amounts needed for a single loan.
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {completionItems.map((item) => (
              <span
                key={item.label}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-bold ${
                  item.done ? "bg-[#3A6047]/10 text-[#3A6047]" : "bg-[#F7F5F0] text-[#7B756E]"
                }`}
              >
                <CheckCircle2 size={14} aria-hidden="true" />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {!hasLoanBalance && (
          <p className="rounded-lg bg-[#C86A53]/10 p-3 text-sm font-bold text-[#C86A53]">
            Add your total loan balance in Step 1 before the repayment results can be calculated.
          </p>
        )}

        {missingRateCount > 0 && (
          <p className="rounded-lg bg-[#C86A53]/10 p-3 text-sm font-bold text-[#C86A53]">
            Add an interest rate for {missingRateCount === 1 ? "the loan part" : "each loan part"} to unlock the results.
          </p>
        )}

        {isSplitLoan && !splitMatches && (
          <p className="rounded-lg bg-[#C86A53]/10 p-3 text-sm font-bold text-[#C86A53]">
            Your loan parts add to {currency(trancheTotal)}, but your total loan is {currency(loanAmount)}. Adjust the
            part balances until they match.
          </p>
        )}

        {!setupComplete && (
          <div className="rounded-lg bg-[#F7F5F0] p-4 text-sm leading-6 text-[#7B756E]">
            <p className="font-bold text-[#1B2A22]">Next, your results will appear below.</p>
            <p className="mt-1">
              Add the loan balance, rate, term, type, and repayment frequency. If the loan is split, make sure the
              parts equal the total loan.
            </p>
          </div>
        )}
      </div>
    </StepShell>
  );
}
