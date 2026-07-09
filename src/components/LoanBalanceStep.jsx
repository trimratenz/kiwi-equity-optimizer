import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { FIXED_TERM_OPTIONS, FREQUENCY_CONFIG, currency } from "../financialModel";
import { Field, NumberInput, Segmented, Select } from "./ui";

export function LoanBalanceStep({
  isSplitLoan,
  loanAmount,
  loanBalance,
  loanStructure,
  displayedTranches,
  normalizedTranches,
  trancheTotal,
  splitMatches,
  dispatch,
  updateTranche,
  addTranche,
  removeTranche
}) {
  const hasLoanBalance = loanAmount > 0;

  return (
    <section className="rounded-xl border border-[#E2DDD5] bg-white p-5 shadow-[0_18px_50px_rgba(27,42,34,0.07)] sm:p-8">
      <p className="text-xs font-black uppercase tracking-wide text-[#3A6047]">Step 1</p>
      <div className="mt-2 grid gap-5">
        <div>
          <h2 className="text-3xl font-black text-[#1B2A22] sm:text-4xl">How much home loan do you have?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7B756E]">
            Add your loan details and confirm your current repayment if you pay more than the estimated minimum.
          </p>
        </div>

        <div className="grid gap-4">
          <Field
            label="Home loan balance"
            error={!hasLoanBalance ? "Enter a loan balance greater than $0." : undefined}
          >
            <NumberInput
              value={loanBalance}
              onChange={(value) => dispatch({ type: "SET_FIELD", field: "loanBalance", value, decimal: true })}
              step={10000}
              prefix="$"
              placeholder="0"
              thousands
            />
          </Field>

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

          {displayedTranches.map((tranche, index) => {
            const normalized = normalizedTranches[index];
            const termMonths = (normalized?.termYears || 0) * 12;
            const frequencyLabel = FREQUENCY_CONFIG[normalized?.frequency || tranche.frequency]?.label || "period";
            const paysMoreThanMinimum =
              tranche.paysMoreThanMinimum === "yes" || Boolean(String(tranche.repaymentAmount ?? "").trim());
            const canShowMinimum = normalized?.amount > 0 && normalized?.hasInterestRate && normalized?.termYears > 0;

            return (
              <div key={tranche.id} className="rounded-xl border border-[#E2DDD5] bg-[#FFFEFC] p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-lg font-black">{isSplitLoan ? `Loan part ${index + 1}` : "Loan details"}</p>
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
                      label="Home loan balance"
                      error={normalized?.amount <= 0 ? "Enter a loan balance greater than $0." : undefined}
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
                    <Field
                      label="Current interest rate"
                      error={
                        !normalized?.hasInterestRate || normalized?.rate < 0 || normalized?.rate > 15
                          ? "Enter an interest rate between 0% and 15%."
                          : undefined
                      }
                    >
                      <NumberInput
                        value={tranche.rate}
                        onChange={(value) => updateTranche(tranche.id, { rate: value })}
                        step={0.05}
                        suffix="%"
                        placeholder="6.50"
                      />
                    </Field>
                    <Field
                      label="Remaining loan term"
                      error={normalized?.termYears <= 0 ? "Enter a remaining loan term greater than 0." : undefined}
                    >
                      <NumberInput
                        value={tranche.termYears}
                        onChange={(value) => updateTranche(tranche.id, { termYears: value })}
                        min={0}
                        max={35}
                        suffix="yr"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Repayment frequency"
                      error={!normalized?.hasFrequency ? "Choose a repayment frequency." : undefined}
                    >
                      <Select value={tranche.frequency} onChange={(value) => updateTranche(tranche.id, { frequency: value })}>
                        <option value="">Choose frequency</option>
                        {Object.keys(FREQUENCY_CONFIG).map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </Select>
                    </Field>
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
                  </div>

                  {tranche.type === "Fixed" && (
                    <div className="grid gap-4 sm:grid-cols-2">
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
                      <Field
                        label="Current fixed term remaining"
                        hint="Months"
                        error={normalized?.fixedTermTooLong || normalized?.fixedMonths > termMonths ? "Fixed term cannot be longer than the remaining loan term." : undefined}
                      >
                        <NumberInput
                          value={tranche.fixedMonths}
                          onChange={(value) => updateTranche(tranche.id, { fixedMonths: value })}
                          min={0}
                          max={60}
                          suffix="mo"
                        />
                      </Field>
                    </div>
                  )}

                  <div className="grid gap-3 rounded-lg border border-[#E2DDD5] bg-[#F7F5F0] p-3 sm:grid-cols-[1fr_220px] sm:items-end">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-[#7B756E]">
                        Estimated minimum repayment
                      </p>
                      <p className="mt-1 text-xl font-black text-[#1B2A22]">
                        {canShowMinimum ? currency(normalized.calculatedMinimumRepaymentExact) : "Complete loan details"}
                      </p>
                      <p className="mt-1 text-xs font-medium text-[#7B756E]">Per {frequencyLabel}</p>
                    </div>
                    <Field label="Paying more?">
                      <Segmented
                        value={paysMoreThanMinimum ? "yes" : "no"}
                        onChange={(value) =>
                          updateTranche(tranche.id, {
                            paysMoreThanMinimum: value,
                            repaymentAmount: value === "yes" ? tranche.repaymentAmount : ""
                          })
                        }
                        options={[
                          { value: "no", label: "No" },
                          { value: "yes", label: "Yes" }
                        ]}
                      />
                    </Field>
                    {paysMoreThanMinimum && (
                      <div className="sm:col-span-2">
                        <Field
                          label="Actual repayment amount"
                          hint={`Per ${frequencyLabel}`}
                          error={
                            normalized?.repaymentValidationError
                              ? "This amount is below the estimated minimum repayment. Please check your repayment amount."
                              : undefined
                          }
                        >
                          <NumberInput
                            value={tranche.repaymentAmount}
                            onChange={(value) =>
                              updateTranche(tranche.id, { repaymentAmount: value, paysMoreThanMinimum: "yes" })
                            }
                            step={10}
                            prefix="$"
                            placeholder="0"
                            thousands
                          />
                        </Field>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isSplitLoan && (
            <button
              type="button"
              onClick={addTranche}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-dashed border-[#3A6047]/60 bg-[#3A6047]/10 px-4 text-sm font-black text-[#3A6047] hover:bg-[#3A6047] hover:text-white"
            >
              <Plus size={18} aria-hidden="true" />
              Add another loan part
            </button>
          )}

          {isSplitLoan && !splitMatches && (
            <p className="rounded-lg bg-[#C86A53]/10 p-3 text-sm font-bold text-[#C86A53]">
              Your loan parts add to {currency(trancheTotal)}, but your total loan is {currency(loanAmount)}. Adjust the
              part balances until they match.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
