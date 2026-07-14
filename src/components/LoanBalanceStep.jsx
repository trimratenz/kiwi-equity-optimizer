import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { FIXED_TERM_OPTIONS, FREQUENCY_CONFIG, currency } from "../financialModel";
import { Field, NumberInput, Segmented, Select } from "./ui";

function FormSection({ title, detail, children, className = "" }) {
  return <section className={`border-t border-slate-200 pt-6 ${className}`}><div className="mb-4"><h3 className="text-sm font-black text-slate-900">{title}</h3>{detail && <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>}</div>{children}</section>;
}

export function LoanBalanceStep({ hasExistingLoan, isSplitLoan, loanStructure, displayedTranches, normalizedTranches, dispatch, updateTranche, addTranche, removeTranche, step = "Step 1" }) {
  const isExistingLoan = hasExistingLoan === "yes";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-700">{step}</p>
      <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">Set up your mortgage.</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Add your loan details and confirm your current repayment if you pay more than the estimated minimum.</p>

      <FormSection title="Mortgage structure" detail="Tell us how your home loan is set up today." className="mt-7">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Do you already have a home loan?">
            <Segmented value={hasExistingLoan} onChange={(value) => dispatch({ type: "SET_FIELD", field: "hasExistingLoan", value })} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
          </Field>
          <Field label={isExistingLoan ? "Is your home loan split into different tranches?" : "Do you want to split your new loan into different tranches?"}>
            <Segmented value={loanStructure} onChange={(value) => dispatch({ type: "SET_FIELD", field: "loanStructure", value })} options={[{ value: "single", label: "No, one loan" }, { value: "split", label: "Yes, split into tranches" }]} />
          </Field>
        </div>
      </FormSection>

      <div className="mt-7 grid gap-5">
        {displayedTranches.map((tranche, index) => {
          const normalized = normalizedTranches[index];
          const termMonths = (normalized?.termYears || 0) * 12;
          const frequencyLabel = FREQUENCY_CONFIG[normalized?.frequency || tranche.frequency]?.label || "period";
          const canShowMinimum = normalized?.amount > 0 && normalized?.hasInterestRate && normalized?.termYears > 0 && (!isExistingLoan || normalized?.repaymentPrincipal > 0);
          return (
            <article key={tranche.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3"><div><p className="text-lg font-black tracking-tight text-slate-950">{isSplitLoan ? `Loan tranche ${index + 1}` : "Loan details"}</p><p className="mt-1 text-xs text-slate-500">Enter the figures from your loan statement or lender app.</p></div>{isSplitLoan && <button type="button" onClick={() => removeTranche(tranche.id)} disabled={displayedTranches.length === 1} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-[#C86A53]/70 hover:bg-[#C86A53]/10 hover:text-[#C86A53] disabled:cursor-not-allowed disabled:opacity-35" title="Remove loan tranche"><Trash2 size={16} aria-hidden="true" /></button>}</div>

              <FormSection title="Loan amount" detail="Use the balance you owe now. We use the original amount to estimate your current repayment.">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label={isExistingLoan ? "Current home loan balance" : "New loan amount"} hint={isExistingLoan ? "The amount you owe today." : "Your planned borrowing amount."} error={normalized?.amount <= 0 ? `Enter a ${isExistingLoan ? "current home loan balance" : "new loan amount"} greater than $0.` : undefined}><NumberInput value={tranche.amount} onChange={(value) => updateTranche(tranche.id, { amount: value })} step={5000} prefix="$" placeholder="0" thousands /></Field>
                  {isExistingLoan && <Field label="Original home loan amount" hint="The amount your repayments were originally based on." error={normalized?.originalAmountBelowCurrent ? "Original loan amount cannot be less than your current balance." : normalized?.repaymentPrincipal <= 0 ? "Enter an original home loan amount greater than $0." : undefined}><NumberInput value={tranche.originalLoanAmount} onChange={(value) => updateTranche(tranche.id, { originalLoanAmount: value })} step={5000} prefix="$" placeholder="0" thousands /></Field>}
                </div>
              </FormSection>

              <FormSection title="Repayment settings" detail="These inputs determine your estimated minimum and current repayment.">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label={isExistingLoan ? "Current interest rate" : "Interest rate"} hint="Your current annual mortgage rate." error={!normalized?.hasInterestRate || normalized?.rate < 0 || normalized?.rate > 15 ? "Enter an interest rate between 0% and 15%." : undefined}><NumberInput value={tranche.rate} onChange={(value) => updateTranche(tranche.id, { rate: value })} step={0.05} suffix="%" placeholder="6.50" /></Field>
                  <Field label="Loan term" hint="Use the documented loan term, not just the years left." error={normalized?.termYears <= 0 ? "Enter a loan term greater than 0." : undefined}><NumberInput value={tranche.termYears} onChange={(value) => updateTranche(tranche.id, { termYears: value })} min={0} max={35} suffix="yr" /></Field>
                  <Field label="Repayment frequency" hint="How often you make mortgage repayments." error={!normalized?.hasFrequency ? "Choose a repayment frequency." : undefined}><Select value={tranche.frequency} onChange={(value) => updateTranche(tranche.id, { frequency: value })}><option value="">Choose frequency</option>{Object.keys(FREQUENCY_CONFIG).map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
                  <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Estimated minimum repayment</p><p className="mt-1 text-2xl font-black tracking-tight text-slate-950">{canShowMinimum ? currency(normalized.calculatedMinimumRepaymentExact) : "Complete loan details"}</p><p className="mt-1 text-xs font-medium text-slate-500">Per {frequencyLabel}</p></div>
                  <Field label="Your actual repayment" hint={`Optional. Enter the amount paid per ${frequencyLabel.toLowerCase()}.`} error={normalized?.repaymentValidationError ? "Enter an actual repayment greater than $0, or leave this blank to use the estimate." : undefined}><NumberInput value={tranche.repaymentAmount} onChange={(value) => updateTranche(tranche.id, { repaymentAmount: value, paysMoreThanMinimum: value ? "yes" : "no" })} step={10} prefix="$" placeholder="Optional" thousands /></Field>
                </div>
                {normalized?.repaymentWarning && <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">This is lower than the estimated minimum. Check the amount or continue only if this reflects your actual arrangement.</p>}
              </FormSection>

              <FormSection title="Rate type" detail="Fixed loans include a refix scenario. Floating loans do not.">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Rate type"><Segmented value={tranche.type} onChange={(value) => updateTranche(tranche.id, { type: value, fixedTermMonths: value === "Floating" ? "0" : tranche.fixedTermMonths || "12", fixedMonths: value === "Floating" ? "0" : tranche.fixedMonths || "12" })} options={[{ value: "Fixed", label: "Fixed" }, { value: "Floating", label: "Floating" }]} /></Field>
                  {tranche.type === "Fixed" && <><Field label="Fixed term" hint="The length of your current fixed-rate period."><Segmented value={tranche.fixedTermMonths || "12"} onChange={(value) => updateTranche(tranche.id, { fixedTermMonths: value, fixedMonths: value })} options={FIXED_TERM_OPTIONS.map((option) => ({ value: String(option.months), label: option.label }))} /></Field>{isExistingLoan && <Field label="Fixed term remaining" hint="Months remaining on your current fixed period." error={normalized?.fixedTermTooLong || normalized?.fixedMonths > termMonths ? "Fixed term cannot be longer than the loan term." : undefined}><NumberInput value={tranche.fixedMonths} onChange={(value) => updateTranche(tranche.id, { fixedMonths: value })} min={0} max={60} suffix="mo" /></Field>}</>}
                </div>
              </FormSection>
            </article>
          );
        })}
        {isSplitLoan && <button type="button" onClick={addTranche} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-4 text-sm font-black text-[#092B63] transition hover:bg-[#092B63] hover:text-white"><Plus size={18} aria-hidden="true" />Add another loan tranche</button>}
      </div>
    </section>
  );
}
