export const FREQUENCY_CONFIG = {
  Weekly: { periodsPerYear: 365 / 7, label: "week", short: "wk" },
  Fortnightly: { periodsPerYear: 365 / 14, label: "fortnight", short: "fn" },
  Monthly: { periodsPerYear: 12, label: "month", short: "mo" }
};

export function safeMoney(value) {
  return Math.max(Number(value) || 0, 0);
}

export function optionalMoney(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const numeric = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numeric) ? Math.max(numeric, 0) : null;
}

export function safeFrequency(frequency = "Monthly") {
  return FREQUENCY_CONFIG[frequency] ? frequency : "Monthly";
}

export function periodsPerYear(frequency = "Monthly") {
  return FREQUENCY_CONFIG[safeFrequency(frequency)].periodsPerYear;
}

export function periodsForMonths(months, frequency = "Monthly") {
  return Math.ceil((Math.max(Number(months) || 0, 0) / 12) * periodsPerYear(frequency));
}

function periodsForLoanTerm(years, frequency = "Monthly") {
  const safeYears = Math.max(Number(years) || 1, 1);
  const paymentCount = periodsPerYear(frequency);

  return frequency === "Monthly" ? Math.round(safeYears * paymentCount) : Math.floor(safeYears * paymentCount);
}

function normalizedRate(annualInterestRate) {
  return (Number(annualInterestRate) || 0) / 100;
}

export function calculateMinimumRepayment({
  loanBalance,
  principal,
  annualInterestRate,
  annualRate,
  remainingYears,
  years,
  frequency = "Monthly"
}) {
  const safePrincipal = safeMoney(loanBalance ?? principal);
  const safeYears = Math.max(Number(remainingYears ?? years) || 1, 1);
  const paymentCount = periodsPerYear(frequency);
  const numberOfPayments = periodsForLoanTerm(safeYears, frequency);
  const periodicRate = normalizedRate(annualInterestRate ?? annualRate) / paymentCount;

  if (periodicRate === 0) return safePrincipal / numberOfPayments;

  return safePrincipal * periodicRate / (1 - Math.pow(1 + periodicRate, -numberOfPayments));
}

export function calculateMinimumRepaymentExact({ principal, annualRate, years, frequency = "Monthly" }) {
  return calculateMinimumRepayment({
    loanBalance: principal,
    annualInterestRate: annualRate,
    remainingYears: years,
    frequency
  });
}

export function calculatePayment(principal, annualRate, years, frequency = "Monthly") {
  return calculateMinimumRepaymentExact({ principal, annualRate, years, frequency });
}

export function buildLoanPartRepaymentDetails({
  principal,
  annualRate,
  years,
  frequency = "Monthly",
  userCurrentRepayment
}) {
  const calculatedMinimumRepaymentExact = calculateMinimumRepaymentExact({ principal, annualRate, years, frequency });
  const calculatedMinimumRepaymentRounded = Math.round(calculatedMinimumRepaymentExact);
  const userCurrentRepaymentExact = optionalMoney(userCurrentRepayment);
  const hasUserRepayment = userCurrentRepaymentExact !== null;
  const hasValidUserRepayment = hasUserRepayment && userCurrentRepaymentExact >= calculatedMinimumRepaymentExact;
  const effectiveCurrentRepaymentExact = hasValidUserRepayment
    ? userCurrentRepaymentExact
    : calculatedMinimumRepaymentExact;

  return {
    calculatedMinimumRepaymentExact,
    calculatedMinimumRepaymentRounded,
    userCurrentRepaymentExact,
    effectiveCurrentRepaymentExact,
    repaymentSource: hasValidUserRepayment ? "user_override" : "calculated",
    repaymentValidationError:
      hasUserRepayment && !hasValidUserRepayment
        ? {
            code: "current-repayment-below-minimum",
            minimumRepaymentExact: calculatedMinimumRepaymentExact,
            minimumRepaymentRounded: calculatedMinimumRepaymentRounded
          }
        : null
  };
}

export function amortizeLoanPart({
  principal,
  loanBalance,
  annualRate,
  annualInterestRate,
  years,
  remainingYears,
  frequency = "Monthly",
  repaymentAmount = 0,
  extraPayment = 0,
  interestOnlyYears = 0,
  maxPeriods
}) {
  const safePrincipal = safeMoney(loanBalance ?? principal);
  const safeYears = Math.max(Number(remainingYears ?? years) || 1, 1);
  const safeFrequencyName = safeFrequency(frequency);
  const paymentCount = periodsPerYear(safeFrequencyName);
  const periodicRate = normalizedRate(annualInterestRate ?? annualRate) / paymentCount;
  const repaymentOverride = safeMoney(repaymentAmount);
  const minimumPayment = calculateMinimumRepayment({
    loanBalance: safePrincipal,
    annualInterestRate: annualInterestRate ?? annualRate,
    remainingYears: safeYears,
    frequency: safeFrequencyName
  });
  const usesRepaymentOverride = repaymentOverride >= minimumPayment;
  const basePayment = usesRepaymentOverride ? repaymentOverride : minimumPayment;
  const extraPerPeriod = safeMoney(extraPayment);
  const interestOnlyPeriods = Math.round(Math.max(Number(interestOnlyYears) || 0, 0) * paymentCount);
  const scheduledPeriods = usesRepaymentOverride ? Math.ceil(100 * paymentCount) : periodsForLoanTerm(safeYears, safeFrequencyName);
  const periodLimit = Number.isFinite(maxPeriods) ? Math.max(Math.round(maxPeriods), 0) : scheduledPeriods;
  const rows = [];
  let balance = safePrincipal;
  let totalInterest = 0;
  let totalPrincipal = 0;
  let yearInterest = 0;
  let period = 0;

  for (; period < periodLimit && balance > 1e-8; period += 1) {
    const interest = balance * periodicRate;
    const isInterestOnly = period < interestOnlyPeriods;
    const scheduledPayment = isInterestOnly ? interest : basePayment;
    const principalPaid = isInterestOnly
      ? 0
      : Math.max(0, Math.min(balance, scheduledPayment + extraPerPeriod - interest));

    balance = Math.max(0, balance - principalPaid);
    totalPrincipal += principalPaid;
    totalInterest += interest;
    yearInterest += interest;

    const completedYears = Math.floor((period + 1) / paymentCount);
    const completedYearsBeforePayment = Math.floor(period / paymentCount);
    const isYearEnd = completedYears > completedYearsBeforePayment;

    if (isYearEnd || balance <= 1e-8 || period + 1 === periodLimit) {
      rows.push({
        year: balance <= 1e-8 ? Math.min(Math.ceil(safeYears), Math.ceil((period + 1) / paymentCount)) : completedYears,
        debt: balance,
        annualInterest: yearInterest,
        totalInterest
      });
      yearInterest = 0;
    }
  }

  return {
    rows,
    repayment: basePayment,
    totalInterest,
    totalPrincipal,
    totalPaid: totalPrincipal + totalInterest,
    periodsToRepay: period,
    finalDebt: balance
  };
}

export function calculateRemainingBalance({
  loanBalance,
  principal,
  annualInterestRate,
  annualRate,
  remainingYears,
  years,
  frequency = "Monthly",
  repaymentAmount = 0,
  months = 0,
  periods
}) {
  return amortizeLoanPart({
    loanBalance: loanBalance ?? principal,
    annualInterestRate: annualInterestRate ?? annualRate,
    remainingYears: remainingYears ?? years,
    frequency,
    repaymentAmount,
    maxPeriods: Number.isFinite(periods) ? periods : periodsForMonths(months, frequency)
  }).finalDebt;
}

export function calculateTotalInterest({
  loanBalance,
  principal,
  annualInterestRate,
  annualRate,
  remainingYears,
  years,
  frequency = "Monthly",
  repaymentAmount = 0,
  extraPayment = 0,
  interestOnlyYears = 0
}) {
  return amortizeLoanPart({
    loanBalance: loanBalance ?? principal,
    annualInterestRate: annualInterestRate ?? annualRate,
    remainingYears: remainingYears ?? years,
    frequency,
    repaymentAmount,
    extraPayment,
    interestOnlyYears
  }).totalInterest;
}

export function calculatePayoffTime({
  loanBalance,
  principal,
  annualInterestRate,
  annualRate,
  remainingYears,
  years,
  frequency = "Monthly",
  repaymentAmount = 0,
  extraPayment = 0,
  interestOnlyYears = 0
}) {
  const schedule = amortizeLoanPart({
    loanBalance: loanBalance ?? principal,
    annualInterestRate: annualInterestRate ?? annualRate,
    remainingYears: remainingYears ?? years,
    frequency,
    repaymentAmount,
    extraPayment,
    interestOnlyYears
  });
  const paymentCount = periodsPerYear(frequency);

  return {
    periods: schedule.periodsToRepay,
    years: schedule.periodsToRepay / paymentCount,
    finalDebt: schedule.finalDebt
  };
}

export function calculateScenarioComparison({ baseScenario, comparisonScenario }) {
  const base = amortizeLoanPart(baseScenario);
  const comparison = amortizeLoanPart(comparisonScenario);

  return {
    base,
    comparison,
    repaymentDifference: comparison.repayment - base.repayment,
    totalInterestDifference: comparison.totalInterest - base.totalInterest,
    payoffPeriodDifference: comparison.periodsToRepay - base.periodsToRepay
  };
}

export function paymentToAnnual(payment, frequency = "Monthly") {
  return payment * periodsPerYear(frequency);
}

export function paymentFromAnnual(annualPayment, frequency = "Monthly") {
  return annualPayment / periodsPerYear(frequency);
}
