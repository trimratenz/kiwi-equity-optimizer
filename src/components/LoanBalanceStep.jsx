import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { FIXED_TERM_OPTIONS, FREQUENCY_CONFIG, currency } from "../financialModel";
import { Field, NumberInput, Segmented, Select } from "./ui";

export function LoanBalanceStep({
  hasExistingLoan,
  isSplitLoan,
  loanStructure,
  displayedTranches,
  normalizedTranches,
  dispatch,
  updateTranche,
  addTranche,
  removeTranche,
  step = "Step 1"
}) {
  const isExistingLoan = hasExistingLoan === "yes";

  return (
    <section className="rounded-xl border border-[#E2DDD5] bg-white p-5 shadow-[0_18px_50px_rgba(27,42,34,0.07)] sm:p-8">
      <p className="text-xs font-black uppercase tracking-wide text-[#3A6047]">{step}</p>
      <div className="mt-2 grid gap-5">
        <div>
          <h2 className="text-3xl font-black text-[#1B2A22] sm:text-4xl">How much home loan do you have?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7B756E]">
            Add your loan details and confirm your current repayment if you pay more than the estimated minimum.
          </p>
        </div>

        <div className="grid gap-4">
          <Field label="Do you already have a home loan?">
            <Segmented
              value={hasExistingLoan}
              onChange={(value) => dispatch({ type: "SET_FIELD", field: "hasExistingLoan", value })}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" }
              ]}
            />
          </Field>

          <Field
            label={
              isExistingLoan
                ? "Is your home loan split into different tranches?"
                : "Do you want to split your new loan into different tranches?"
            }
          >
            <Segmented
              value={loanStructure}
              onChange={(value) => dispatch({ type: "SET_FIELD", field: "loanStructure", value })}
              options={[
                { value: "single", label: "No, one loan" },
                { value: "split", label: "Yes, split into tranches" }
              ]}
            />
          </Field>

          {displayedTranches.map((tranche, index) => {
            const normalized = normalizedTranches[index];
            const termMonths = (normalized?.termYears || 0) * 12;
            const frequencyLabel = FREQUENCY_CONFIG[normalized?.frequency || tranche.frequency]?.label || "period";
            const canShowMinimum =
              normalized?.amount > 0 &&
              normalized?.hasInterestRate &&
              normalized?.termYears > 0 &&
              (!isExistingLoan || normalized?.repaymentPrincipal > 0);

            return (
              <div key={tranche.id} className="rounded-xl border border-[#E2DDD5] bg-[#FFFEFC] p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-lg font-black">{isSplitLoan ? `Loan tranche ${index + 1}` : "Loan details"}</p>
                  {isSplitLoan && (
                    <button
                      type="button"
                      onClick={() => removeTranche(tranche.id)}
                      disabled={displayedTranches.length === 1}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2DDD5] text-[#7B756E] hover:border-[#C86A53]/70 hover:bg-[#C86A53]/10 hover:text-[#C86A53] disabled:cursor-not-allowed disabled:opacity-35"
                      title="Remove loan tranche"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="grid gap-4">
                  <Field
                    label={isExistingLoan ? "Current home loan balance" : "New loan amount"}
                    hint={isExistingLoan ? "Use the amount you owe today." : undefined}
                    error={normalized?.amount <= 0 ? `Enter a ${isExistingLoan ? "current home loan balance" : "new loan amount"} greater than $0.` : undefined}
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

                  {isExistingLoan && (
                    <Field
                      label="Original home loan amount"
                      hint="Enter the original loan amount from your bank app or loan agreement—the amount your repayments were originally based on."
                      error={
                        normalized?.originalAmountBelowCurrent
                          ? "Original loan amount cannot be less than your current balance."
                          : normalized?.repaymentPrincipal <= 0
                            ? "Enter an original home loan amount greater than $0."
                            : undefined
                      }
                    >
                      <NumberInput
                        value={tranche.originalLoanAmount}
                        onChange={(value) => updateTranche(tranche.id, { originalLoanAmount: value })}
                        step={5000}
                        prefix="$"
                        placeholder="0"
                        thousands
                      />
                    </Field>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label={isExistingLoan ? "Current interest rate" : "Interest rate"}
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
                      label="Loan term"
                      hint="Use the documented loan term, not just the years left."
                      error={normalized?.termYears <= 0 ? "Enter a loan term greater than 0." : undefined}
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
                            fixedTermMonths: value === "Floating" ? "0" : tranche.fixedTermMonths || "12",
                            fixedMonths: value === "Floating" ? "0" : tranche.fixedMonths || "12"
                          })
                        }
                        options={[
                          { value: "Fixed", label: "Fixed" },
                          { value: "Floating", label: "Floating" }
                        ]}
                      />
                    </Field>
                  </div>

                  {tranche.type === "Fixed" && (
                    <div className={`grid gap-4 ${isExistingLoan ? "sm:grid-cols-2" : ""}`}>
                      <Field label="Fixed term">
                        <Segmented
                          value={tranche.fixedTermMonths || "12"}
                          onChange={(value) =>
                            updateTranche(tranche.id, {
                              fixedTermMonths: value,
                              fixedMonths: value
                            })
                          }
                          options={FIXED_TERM_OPTIONS.map((option) => ({
                            value: String(option.months),
                            label: option.label
                          }))}
                        />
                      </Field>
                      {isExistingLoan && (
                        <Field
                          label="Current fixed term remaining"
                          hint="Months"
                          error={normalized?.fixedTermTooLong || normalized?.fixedMonths > termMonths ? "Fixed term cannot be longer than the loan term." : undefined}
                        >
                          <NumberInput
                            value={tranche.fixedMonths}
                            onChange={(value) => updateTranche(tranche.id, { fixedMonths: value })}
                            min={0}
                            max={60}
                            suffix="mo"
                          />
                        </Field>
                      )}
                    </div>
                  )}

                  <div className="grid gap-3 rounded-lg border border-[#E2DDD5] bg-[#F7F5F0] p-3 sm:grid-cols-2 sm:items-end">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-[#7B756E]">
                        Estimated minimum repayment
                      </p>
                      <p className="mt-1 text-xl font-black text-[#1B2A22]">
                        {canShowMinimum ? currency(normalized.calculatedMinimumRepaymentExact) : "Complete loan details"}
                      </p>
                      <p className="mt-1 text-xs font-medium text-[#7B756E]">Per {frequencyLabel}</p>
                    </div>
                    <Field
                      label="Your actual repayment"
                      hint={`Per ${frequencyLabel}`}
                      error={normalized?.repaymentValidationError ? "Enter an actual repayment greater than $0, or leave this blank to use the estimate." : undefined}
                    >
                      <NumberInput
                        value={tranche.repaymentAmount}
                        onChange={(value) => updateTranche(tranche.id, { repaymentAmount: value, paysMoreThanMinimum: value ? "yes" : "no" })}
                        step={10}
                        prefix="$"
                        placeholder="Optional"
                        thousands
                      />
                    </Field>
                    <p className="sm:col-span-2 text-xs font-medium leading-5 text-[#7B756E]">
                      If you pay more than the minimum, enter your actual repayment. We&apos;ll use this for the comparison.
                    </p>
                    {normalized?.repaymentWarning && (
                      <p className="sm:col-span-2 rounded-md bg-[#FFF8E1] px-3 py-2 text-xs font-semibold leading-5 text-[#6B5B2A]">
                        This is lower than the estimated minimum. Check the amount or continue only if this reflects your actual arrangement.
                      </p>
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
              Add another loan tranche
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
