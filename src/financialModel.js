import {
  DEFAULT_BANK_RATE_SNAPSHOT,
  DEFAULT_OCR_FORECAST_SNAPSHOT,
  USER_RATE_DATA_NOTICE,
  addMonthsToDate,
  buildBankRateSnapshotView,
  lookupOcrForecastByDate
} from "./snapshotLayer.js";

export const FREQUENCY_CONFIG = {
  Weekly: { periodsPerYear: 52, label: "week", short: "wk" },
  Fortnightly: { periodsPerYear: 26, label: "fortnight", short: "fn" },
  Monthly: { periodsPerYear: 12, label: "month", short: "mo" }
};

export const CALCULATION_AS_OF_DATE = "2026-07-07";
export const CALCULATION_ENGINE_VERSION = "trimrate-calculation-engine-2026-07-07.1";

export const CURRENT_OCR_ASSUMPTION = DEFAULT_OCR_FORECAST_SNAPSHOT.currentOcr;

export const RBNZ_OCR_FORECAST_SOURCE = {
  id: DEFAULT_OCR_FORECAST_SNAPSHOT.id,
  source: DEFAULT_OCR_FORECAST_SNAPSHOT.source,
  url: "https://www.rbnz.govt.nz/monetary-policy/monetary-policy-statement",
  publicationsUrl: "https://www.rbnz.govt.nz/research-and-publications/publications/publications-library",
  ocrDecisionsUrl: "https://www.rbnz.govt.nz/monetary-policy/about-monetary-policy/official-cash-rate",
  note: USER_RATE_DATA_NOTICE,
  capturedAt: DEFAULT_OCR_FORECAST_SNAPSHOT.capturedAt,
  reviewedAt: DEFAULT_OCR_FORECAST_SNAPSHOT.reviewedAt,
  forecast: DEFAULT_OCR_FORECAST_SNAPSHOT.forecast
};

export const OCR_FORECAST_SOURCES = [RBNZ_OCR_FORECAST_SOURCE];

export const BANK_MARGIN_ASSUMPTIONS = {
  sixMonth: 1.65,
  fixed1y: 1.85,
  fixed2y: 2.05,
  fixed3y: 2.25,
  fixed4y: 2.4,
  fixed5y: 2.55,
  floating: 3.0,
  conservativeBuffer: 0.75
};

export const FORECAST_SCENARIOS = [
  {
    key: "optimistic",
    label: "Optimistic",
    shortLabel: "Optimistic",
    rateBuffer: -0.2,
    ocrPassThrough: 0.75,
    tone: "good"
  },
  {
    key: "base",
    label: "Base case",
    shortLabel: "Base",
    rateBuffer: 0,
    ocrPassThrough: 0.9,
    tone: "neutral"
  },
  {
    key: "conservative",
    label: "Conservative",
    shortLabel: "Conservative",
    rateBuffer: 0.35,
    ocrPassThrough: 1,
    tone: "watch"
  }
];

export const FIXED_TERM_OPTIONS = [
  { months: 6, label: "6 months", rateType: "sixMonth" },
  { months: 12, label: "1 year", rateType: "fixed1y" },
  { months: 24, label: "2 years", rateType: "fixed2y" },
  { months: 36, label: "3 years", rateType: "fixed3y" },
  { months: 48, label: "4 years", rateType: "fixed4y" },
  { months: 60, label: "5 years", rateType: "fixed5y" }
];

export const MARKET_RATE_SNAPSHOT = buildBankRateSnapshotView(DEFAULT_BANK_RATE_SNAPSHOT);

const MARKET_TERM_MONTHS = {
  "6 months": 6,
  "1 year": 12,
  "18 months": 18,
  "2 years": 24,
  "3 years": 36,
  "4 years": 48,
  "5 years": 60,
  Revolving: 0,
  Floating: 0
};

export function currency(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits
  }).format(Number.isFinite(value) ? value : 0);
}

export function percent(value, maximumFractionDigits = 2) {
  return `${Number(value || 0).toFixed(maximumFractionDigits)}%`;
}

export function affordabilitySnapshot({ repayment, income }) {
  const safeRepayment = Math.max(Number(repayment) || 0, 0);
  const safeIncome = Math.max(Number(income) || 0, 0);
  const ratio = safeIncome > 0 ? (safeRepayment / safeIncome) * 100 : 0;
  const targetRatio = 28;
  const watchRatio = 35;
  const stretchedRatio = 45;

  let band = "Add income";
  let detail = "Enter after-tax income to see the affordability view.";
  let tone = "neutral";

  if (safeIncome > 0 && ratio <= targetRatio) {
    band = "Comfortable";
    detail = "Repayments sit inside the target range.";
    tone = "good";
  } else if (safeIncome > 0 && ratio <= watchRatio) {
    band = "Watch";
    detail = "Manageable, but keep an eye on other commitments.";
    tone = "watch";
  } else if (safeIncome > 0 && ratio <= stretchedRatio) {
    band = "Tight";
    detail = "A rate rise or income dip could bite quickly.";
    tone = "tight";
  } else if (safeIncome > 0) {
    band = "Stretched";
    detail = "Consider a buffer, lower debt, or human review before re-fixing.";
    tone = "stretched";
  }

  return {
    ratio,
    targetRatio,
    watchRatio,
    stretchedRatio,
    band,
    detail,
    tone,
    incomeNeededForTarget: targetRatio > 0 ? safeRepayment / (targetRatio / 100) : 0,
    incomeNeededForWatch: watchRatio > 0 ? safeRepayment / (watchRatio / 100) : 0,
    cashAfterRepayment: safeIncome - safeRepayment,
    targetRepaymentAtIncome: safeIncome * (targetRatio / 100),
    watchRepaymentAtIncome: safeIncome * (watchRatio / 100),
    headroomToTarget: safeIncome > 0 ? safeIncome * (targetRatio / 100) - safeRepayment : 0,
    headroomToWatch: safeIncome > 0 ? safeIncome * (watchRatio / 100) - safeRepayment : 0
  };
}

export function marketTermMonths(term) {
  return MARKET_TERM_MONTHS[term] ?? 0;
}

export function yearsAndMonths(periods, frequency = "Monthly") {
  const months = Math.ceil((periods / FREQUENCY_CONFIG[frequency].periodsPerYear) * 12);
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) return `${remainingMonths} mo`;
  if (remainingMonths === 0) return `${years} yr`;
  return `${years} yr ${remainingMonths} mo`;
}

function safeMoney(value) {
  return Math.max(Number(value) || 0, 0);
}

function safeFrequency(frequency = "Monthly") {
  return FREQUENCY_CONFIG[frequency] ? frequency : "Monthly";
}

function periodsPerYear(frequency = "Monthly") {
  return FREQUENCY_CONFIG[safeFrequency(frequency)].periodsPerYear;
}

function normaliseLoanPart(part, fallbackFrequency = "Monthly") {
  const frequency = safeFrequency(part?.frequency || fallbackFrequency);
  const principal = safeMoney(part?.amount ?? part?.principal ?? part?.balance);

  return {
    ...part,
    amount: principal,
    principal,
    rate: Number(part?.rate ?? part?.annualRate) || 0,
    termYears: Math.max(Number(part?.termYears ?? part?.years) || 1, 1),
    frequency,
    fixedMonths: Math.max(Number(part?.fixedMonths) || 0, 0)
  };
}

export function calculatePayment(principal, annualRate, years, frequency = "Monthly") {
  const safePrincipal = safeMoney(principal);
  const safeYears = Math.max(Number(years) || 1, 1);
  const periodCount = periodsPerYear(frequency);
  const totalPeriods = safeYears * periodCount;
  const periodicRate = (Number(annualRate) || 0) / 100 / periodCount;

  if (periodicRate === 0) return safePrincipal / totalPeriods;

  return (
    (safePrincipal * periodicRate * Math.pow(1 + periodicRate, totalPeriods)) /
    (Math.pow(1 + periodicRate, totalPeriods) - 1)
  );
}

export function calculateLoanPartRepayment(part, fallbackFrequency = "Monthly") {
  const normalised = normaliseLoanPart(part, fallbackFrequency);
  return calculatePayment(normalised.principal, normalised.rate, normalised.termYears, normalised.frequency);
}

export function weightedAverageRate(tranches) {
  const active = tranches.map((tranche) => normaliseLoanPart(tranche)).filter((tranche) => tranche.principal > 0);
  const totalPrincipal = active.reduce((sum, tranche) => sum + tranche.principal, 0);
  if (totalPrincipal <= 0) return 0;

  return active.reduce((sum, tranche) => sum + tranche.principal * tranche.rate, 0) / totalPrincipal;
}

export function totalRepaymentAcrossLoanParts(tranches, displayFrequency = "Monthly") {
  const targetFrequency = safeFrequency(displayFrequency);
  const annualPayment = tranches.reduce((sum, tranche) => {
    const normalised = normaliseLoanPart(tranche, targetFrequency);
    const repayment = calculateLoanPartRepayment(normalised);
    return sum + paymentToAnnual(repayment, normalised.frequency);
  }, 0);

  return paymentFromAnnual(annualPayment, targetFrequency);
}

function periodsForMonths(months, frequency = "Monthly") {
  return Math.ceil((Math.max(Number(months) || 0, 0) / 12) * periodsPerYear(frequency));
}

export function amortizeLoanPart({
  principal,
  annualRate,
  years,
  frequency = "Monthly",
  extraPayment = 0,
  interestOnlyYears = 0,
  maxPeriods
}) {
  const safePrincipal = safeMoney(principal);
  const safeYears = Math.max(Number(years) || 1, 1);
  const safeFrequencyName = safeFrequency(frequency);
  const periodCount = periodsPerYear(safeFrequencyName);
  const periodicRate = (Number(annualRate) || 0) / 100 / periodCount;
  const basePayment = calculatePayment(safePrincipal, annualRate, safeYears, safeFrequencyName);
  const extraPerPeriod = safeMoney(extraPayment);
  const interestOnlyPeriods = Math.round(Math.max(Number(interestOnlyYears) || 0, 0) * periodCount);
  const scheduledPeriods = Math.ceil(safeYears * periodCount);
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

    if ((period + 1) % periodCount === 0 || balance <= 1e-8 || period + 1 === periodLimit) {
      rows.push({
        year: Math.ceil((period + 1) / periodCount),
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

export function balanceAfterMonths({ principal, annualRate, years, frequency = "Monthly", months = 0 }) {
  return amortizeLoanPart({
    principal,
    annualRate,
    years,
    frequency,
    maxPeriods: periodsForMonths(months, frequency)
  }).finalDebt;
}

export function principalAndInterestPaidAfterMonths({ principal, annualRate, years, frequency = "Monthly", months = 0 }) {
  const schedule = amortizeLoanPart({
    principal,
    annualRate,
    years,
    frequency,
    maxPeriods: periodsForMonths(months, frequency)
  });

  return {
    principal: schedule.totalPrincipal,
    interest: schedule.totalInterest,
    total: schedule.totalPrincipal + schedule.totalInterest,
    balance: schedule.finalDebt,
    periods: schedule.periodsToRepay
  };
}

export function remainingPrincipalAndInterestToFixedEnd(tranches, fallbackFrequency = "Monthly") {
  const rows = tranches.map((tranche) => {
    const normalised = normaliseLoanPart(tranche, fallbackFrequency);
    const remainingMonths = tranche.type === "Fixed" ? normalised.fixedMonths : 0;
    const periodsRemaining = periodsForMonths(remainingMonths, normalised.frequency);
    const schedule = amortizeLoanPart({
      principal: normalised.principal,
      annualRate: normalised.rate,
      years: normalised.termYears,
      frequency: normalised.frequency,
      maxPeriods: periodsRemaining
    });

    return {
      id: tranche.id,
      index: tranche.index,
      frequency: normalised.frequency,
      remainingMonths,
      periodsRemaining,
      repayment: schedule.repayment,
      principal: schedule.totalPrincipal,
      interest: schedule.totalInterest,
      total: schedule.totalPrincipal + schedule.totalInterest,
      balanceAtFixedEnd: schedule.finalDebt
    };
  });

  const nextExpiryMonths = rows
    .filter((row) => row.remainingMonths > 0)
    .reduce((min, row) => Math.min(min, row.remainingMonths), Infinity);

  return {
    rows,
    principal: rows.reduce((sum, row) => sum + row.principal, 0),
    interest: rows.reduce((sum, row) => sum + row.interest, 0),
    total: rows.reduce((sum, row) => sum + row.total, 0),
    periodsRemaining: rows.reduce((sum, row) => sum + row.periodsRemaining, 0),
    nextExpiryMonths: Number.isFinite(nextExpiryMonths) ? nextExpiryMonths : 0
  };
}

export function buildRepaymentMatrix({
  principal,
  years,
  frequency,
  minRate = 2,
  maxRate = 11,
  step = 0.05
}) {
  const matrix = {};
  for (let rate = minRate; rate <= maxRate + 0.001; rate += step) {
    const key = rate.toFixed(2);
    matrix[key] = calculatePayment(principal, Number(key), years, frequency);
  }
  return matrix;
}

export function lookupMatrixPayment(matrix, rate) {
  const keys = Object.keys(matrix);
  if (keys.length === 0) return 0;
  const rounded = (Math.round((Number(rate) || 0) * 20) / 20).toFixed(2);
  return matrix[rounded] ?? matrix[keys[0]];
}

export function paymentToAnnual(payment, frequency = "Monthly") {
  return payment * periodsPerYear(frequency);
}

export function paymentFromAnnual(annualPayment, frequency = "Monthly") {
  return annualPayment / periodsPerYear(frequency);
}

export function annualIncomeFromPeriod(periodIncome, frequency = "Monthly") {
  return safeMoney(periodIncome) * periodsPerYear(frequency);
}

export function debtToIncomeRatio(totalDebt, periodIncome, frequency = "Monthly") {
  const annualIncome = annualIncomeFromPeriod(periodIncome, frequency);
  const safeDebt = safeMoney(totalDebt);
  return annualIncome > 0 ? safeDebt / annualIncome : 0;
}

export function repaymentToIncomeRatio(repayment, income) {
  const safeIncome = safeMoney(income);
  return safeIncome > 0 ? (safeMoney(repayment) / safeIncome) * 100 : 0;
}

export function cashAfterRepayment(income, repayment) {
  return safeMoney(income) - safeMoney(repayment);
}

export function cashAfterMortgageTopUpAndLivingCosts({
  periodIncome,
  standardRepayment,
  extraPayment = 0,
  livingCosts = 0
}) {
  return cashAfterRepayment(periodIncome, standardRepayment) - safeMoney(extraPayment) - safeMoney(livingCosts);
}

export function dtiAssessment(ratio) {
  if (!ratio) {
    return {
      label: "Add income",
      detail: "Enter income to compare your debt-to-income ratio.",
      tone: "neutral",
      position: 0
    };
  }

  if (ratio < 5) {
    return {
      label: "Comfortable",
      detail: "Below the 5.00x watch zone used by many lenders.",
      tone: "good",
      position: Math.min((ratio / 7) * 100, 100)
    };
  }

  if (ratio < 6) {
    return {
      label: "Watch",
      detail: "Approaching the 6.00x owner-occupier DTI threshold.",
      tone: "watch",
      position: Math.min((ratio / 7) * 100, 100)
    };
  }

  if (ratio < 7) {
    return {
      label: "High",
      detail: "Above the common 6.00x owner-occupier DTI threshold.",
      tone: "tight",
      position: Math.min((ratio / 7) * 100, 100)
    };
  }

  return {
    label: "Very high",
    detail: "Above the common 7.00x investor DTI threshold.",
    tone: "stretched",
    position: 100
  };
}

export function netCashPosition({ periodIncome, standardRepayment, extraPayment = 0, outgoingCosts = 0, frequency = "Monthly" }) {
  const incomePerPeriod = safeMoney(periodIncome);
  const safeStandardRepayment = safeMoney(standardRepayment);
  const extraPerPeriod = safeMoney(extraPayment);
  const safeOutgoingCosts = safeMoney(outgoingCosts);
  const repaymentWithExtra = safeStandardRepayment + extraPerPeriod;

  return {
    frequency: safeFrequency(frequency),
    incomePerPeriod,
    standardRepayment: safeStandardRepayment,
    extraPerPeriod,
    outgoingCosts: safeOutgoingCosts,
    repaymentWithExtra,
    remainingCash: cashAfterRepayment(incomePerPeriod, safeStandardRepayment),
    cashAfterOutgoings: cashAfterMortgageTopUpAndLivingCosts({
      periodIncome: incomePerPeriod,
      standardRepayment: safeStandardRepayment,
      extraPayment: extraPerPeriod,
      livingCosts: safeOutgoingCosts
    })
  };
}

export function amortizationSeries({
  principal,
  annualRate,
  years,
  frequency = "Monthly",
  extraPayment = 0,
  interestOnlyYears = 0,
  horizonYears = years
}) {
  return amortizeLoanPart({
    principal,
    annualRate,
    years,
    frequency,
    extraPayment,
    interestOnlyYears,
    maxPeriods: Math.ceil(Math.max(Number(horizonYears) || Number(years) || 1, 1) * periodsPerYear(frequency))
  });
}

export function summarizeLoan({ principal, annualRate, years, frequency, extraPayment = 0, interestOnlyYears = 0 }) {
  const repayment = calculatePayment(principal, annualRate, years, frequency);
  const extra = safeMoney(extraPayment);
  const standard = amortizationSeries({ principal, annualRate, years, frequency, interestOnlyYears });
  const accelerated = amortizationSeries({
    principal,
    annualRate,
    years,
    frequency,
    extraPayment: extra,
    interestOnlyYears
  });

  return {
    repayment,
    repaymentWithExtra: repayment + extra,
    totalInterest: standard.totalInterest,
    totalPaid: standard.totalPaid,
    interestSaved: Math.max(0, standard.totalInterest - accelerated.totalInterest),
    timeSavedPeriods: Math.max(0, standard.periodsToRepay - accelerated.periodsToRepay),
    standard,
    accelerated
  };
}

function aggregateAnnualRows(schedules) {
  const maxYear = schedules.reduce((max, schedule) => Math.max(max, schedule.rows.at(-1)?.year ?? 0), 0);

  return Array.from({ length: maxYear }, (_, index) => {
    const year = index + 1;
    return schedules.reduce(
      (row, schedule) => {
        const exact = schedule.rows.find((item) => item.year === year);
        const previous = schedule.rows.filter((item) => item.year < year).at(-1);
        const snapshot = exact ?? previous;

        return {
          year,
          debt: row.debt + (snapshot?.debt ?? 0),
          annualInterest: row.annualInterest + (exact?.annualInterest ?? 0),
          totalInterest: row.totalInterest + (snapshot?.totalInterest ?? 0)
        };
      },
      { year, debt: 0, annualInterest: 0, totalInterest: 0 }
    );
  });
}

function allocateExtraByBalance(tranches, extraPayment, displayFrequency) {
  const totalPrincipal = tranches.reduce((sum, tranche) => sum + tranche.principal, 0);
  const annualExtra = safeMoney(extraPayment) * periodsPerYear(displayFrequency);

  return tranches.map((tranche) => {
    const share = totalPrincipal > 0 ? tranche.principal / totalPrincipal : 0;
    return (annualExtra * share) / periodsPerYear(tranche.frequency);
  });
}

export function summarizeMortgage({
  tranches,
  displayFrequency = "Monthly",
  extraPayment = 0,
  interestOnlyYears = 0
}) {
  const frequency = safeFrequency(displayFrequency);
  const active = tranches.map((tranche) => normaliseLoanPart(tranche, frequency)).filter((tranche) => tranche.principal > 0);
  const extrasByPart = allocateExtraByBalance(active, extraPayment, frequency);
  const partSummaries = active.map((tranche, index) => {
    const standard = amortizeLoanPart({
      principal: tranche.principal,
      annualRate: tranche.rate,
      years: tranche.termYears,
      frequency: tranche.frequency,
      interestOnlyYears
    });
    const accelerated = amortizeLoanPart({
      principal: tranche.principal,
      annualRate: tranche.rate,
      years: tranche.termYears,
      frequency: tranche.frequency,
      extraPayment: extrasByPart[index],
      interestOnlyYears
    });

    return {
      ...tranche,
      repayment: standard.repayment,
      annualPayment: paymentToAnnual(standard.repayment, tranche.frequency),
      totalInterest: standard.totalInterest,
      totalPaid: standard.totalPaid,
      standard,
      accelerated
    };
  });
  const annualPayment = partSummaries.reduce((sum, tranche) => sum + tranche.annualPayment, 0);
  const standardSchedules = partSummaries.map((part) => part.standard);
  const acceleratedSchedules = partSummaries.map((part) => part.accelerated);
  const periodsToDisplayPeriods = (schedule, index) => {
    const partFrequency = partSummaries[index]?.frequency ?? frequency;
    return (schedule.periodsToRepay / periodsPerYear(partFrequency)) * periodsPerYear(frequency);
  };
  const standard = {
    rows: aggregateAnnualRows(standardSchedules),
    totalInterest: standardSchedules.reduce((sum, schedule) => sum + schedule.totalInterest, 0),
    totalPaid: standardSchedules.reduce((sum, schedule) => sum + schedule.totalPaid, 0),
    periodsToRepay: Math.max(0, ...standardSchedules.map(periodsToDisplayPeriods)),
    finalDebt: standardSchedules.reduce((sum, schedule) => sum + schedule.finalDebt, 0)
  };
  const accelerated = {
    rows: aggregateAnnualRows(acceleratedSchedules),
    totalInterest: acceleratedSchedules.reduce((sum, schedule) => sum + schedule.totalInterest, 0),
    totalPaid: acceleratedSchedules.reduce((sum, schedule) => sum + schedule.totalPaid, 0),
    periodsToRepay: Math.max(0, ...acceleratedSchedules.map(periodsToDisplayPeriods)),
    finalDebt: acceleratedSchedules.reduce((sum, schedule) => sum + schedule.finalDebt, 0)
  };
  const repayment = paymentFromAnnual(annualPayment, frequency);

  return {
    frequency,
    repayment,
    repaymentWithExtra: repayment + safeMoney(extraPayment),
    annualPayment,
    totalInterest: standard.totalInterest,
    totalPaid: standard.totalPaid,
    interestSaved: Math.max(0, standard.totalInterest - accelerated.totalInterest),
    timeSavedPeriods: Math.max(0, standard.periodsToRepay - accelerated.periodsToRepay),
    weightedRate: weightedAverageRate(active),
    partSummaries,
    standard,
    accelerated
  };
}

export function weightedLoanSnapshot(tranches, fallbackFrequency) {
  const active = tranches.map((tranche) => normaliseLoanPart(tranche, fallbackFrequency)).filter((tranche) => tranche.principal > 0);
  const totalPrincipal = active.reduce((sum, tranche) => sum + tranche.principal, 0);
  const weightedRate = weightedAverageRate(active);
  const weightedTerm =
    active.reduce((sum, tranche) => sum + tranche.principal * tranche.termYears, 0) /
    Math.max(totalPrincipal, 1);
  const annualPayment = active.reduce((sum, tranche) => {
    const payment = calculateLoanPartRepayment(tranche, fallbackFrequency);
    return sum + paymentToAnnual(payment, tranche.frequency);
  }, 0);

  return {
    totalPrincipal,
    weightedRate,
    weightedTerm,
    annualPayment,
    paymentInFrequency: paymentFromAnnual(annualPayment, fallbackFrequency)
  };
}

export function trancheRows(tranches, fallbackFrequency) {
  return tranches.map((tranche, index) => {
    const normalised = normaliseLoanPart(tranche, fallbackFrequency);
    const repayment = calculateLoanPartRepayment(normalised);
    const summary = amortizeLoanPart({
      principal: normalised.principal,
      annualRate: normalised.rate,
      years: normalised.termYears,
      frequency: normalised.frequency
    });

    return {
      ...tranche,
      index: index + 1,
      frequency: normalised.frequency,
      repayment,
      annualPayment: paymentToAnnual(repayment, normalised.frequency),
      totalInterest: summary.totalInterest
    };
  });
}

export function calculateAverageForecastOcr(monthWindow = 24) {
  const cutoffDate = addMonthsToDate(CALCULATION_AS_OF_DATE, monthWindow);
  const allForecasts = OCR_FORECAST_SOURCES.flatMap((source) =>
    source.forecast.filter((item) => item.date <= cutoffDate).map((item) => item.ocr)
  );
  const truncated = allForecasts.slice(0, monthWindow);
  return truncated.reduce((sum, item) => sum + item, 0) / truncated.length;
}

export function estimateBankRateFromOcr(ocr, rateType = "fixed1y", stressed = false) {
  const margin = BANK_MARGIN_ASSUMPTIONS[rateType] ?? BANK_MARGIN_ASSUMPTIONS.fixed1y;
  return Math.max(0, ocr + margin + (stressed ? BANK_MARGIN_ASSUMPTIONS.conservativeBuffer : 0));
}

export function rateScenarioRows({ principal, years, frequency, averageOcr }) {
  const scenarios = [
    { scenario: "Lower", ocr: averageOcr - 0.75, stressed: false },
    { scenario: "Forecast", ocr: averageOcr, stressed: false },
    { scenario: "Stress", ocr: averageOcr + 1, stressed: true }
  ];

  return scenarios.map((scenario) => {
    const sixMonth = estimateBankRateFromOcr(scenario.ocr, "sixMonth", scenario.stressed);
    const fixed1y = estimateBankRateFromOcr(scenario.ocr, "fixed1y", scenario.stressed);
    const fixed2y = estimateBankRateFromOcr(scenario.ocr, "fixed2y", scenario.stressed);
    const floating = estimateBankRateFromOcr(scenario.ocr, "floating", scenario.stressed);

    return {
      scenario: scenario.scenario,
      ocr: scenario.ocr,
      sixMonthRate: sixMonth,
      fixed1yRate: fixed1y,
      fixed2yRate: fixed2y,
      floatingRate: floating,
      sixMonthPayment: calculatePayment(principal, sixMonth, years, frequency),
      fixed1yPayment: calculatePayment(principal, fixed1y, years, frequency),
      fixed2yPayment: calculatePayment(principal, fixed2y, years, frequency),
      floatingPayment: calculatePayment(principal, floating, years, frequency)
    };
  });
}

export function consensusOcrForMonths(months) {
  const refixDate = addMonthsToDate(CALCULATION_AS_OF_DATE, Math.max(Number(months) || 0, 0));
  const forecasts = [lookupOcrForecastByDate(DEFAULT_OCR_FORECAST_SNAPSHOT, refixDate).ocr].filter(Number.isFinite);

  return forecasts.reduce((sum, item) => sum + item, 0) / Math.max(forecasts.length, 1);
}

export function rbnzOcrForMonths(months, ocrSnapshot = DEFAULT_OCR_FORECAST_SNAPSHOT, calculationDate = CALCULATION_AS_OF_DATE) {
  const refixDate = addMonthsToDate(calculationDate, Math.max(Number(months) || 0, 0));
  const forecast = lookupOcrForecastByDate(ocrSnapshot, refixDate);

  return {
    ...forecast,
    refixDate,
    source: forecast.source
  };
}

function marketRateForTerm(termLabel, marketRates = []) {
  const exact = marketRates.find((rate) => rate.term === termLabel);
  if (exact) return exact.rate;

  const targetMonths = marketTermMonths(termLabel);
  const comparable = marketRates
    .filter((rate) => marketTermMonths(rate.term) > 0)
    .map((rate) => ({ ...rate, months: marketTermMonths(rate.term) }))
    .sort((a, b) => Math.abs(a.months - targetMonths) - Math.abs(b.months - targetMonths));

  return comparable[0]?.rate ?? estimateBankRateFromOcr(CURRENT_OCR_ASSUMPTION, "fixed1y");
}

export function monthsLabel(months) {
  const safeMonths = Math.max(Math.round(Number(months) || 0), 0);
  if (safeMonths === 0) return "now";
  if (safeMonths < 12) return `${safeMonths} mo`;
  const years = Math.floor(safeMonths / 12);
  const remainingMonths = safeMonths % 12;
  if (remainingMonths === 0) return `${years} yr`;
  return `${years} yr ${remainingMonths} mo`;
}

export function forecastRefixRows({
  principal,
  currentRate,
  years,
  frequency,
  currentPayment,
  fixedEndsInMonths = 0,
  marketRates = MARKET_RATE_SNAPSHOT.rates,
  bankRateSnapshotId = MARKET_RATE_SNAPSHOT.snapshotId,
  ocrSnapshot = DEFAULT_OCR_FORECAST_SNAPSHOT,
  calculationDate = CALCULATION_AS_OF_DATE
}) {
  const expiryMonths = Math.max(Number(fixedEndsInMonths) || 0, 0);
  const rbnzOcr = rbnzOcrForMonths(expiryMonths, ocrSnapshot, calculationDate);
  const forecastOcr = rbnzOcr.ocr;
  const ocrMove = forecastOcr - CURRENT_OCR_ASSUMPTION;
  const remainingBalance = balanceAfterMonths({
    principal,
    annualRate: currentRate,
    years,
    frequency,
    months: expiryMonths
  });
  const remainingYears = Math.max((years * 12 - expiryMonths) / 12, 1);

  return FIXED_TERM_OPTIONS.map((term) => {
    const marketRateToday = marketRateForTerm(term.label, marketRates);
    const scenarios = FORECAST_SCENARIOS.map((scenario) => {
      const forecastMortgageRate = Math.max(
        0.5,
        marketRateToday + ocrMove * scenario.ocrPassThrough + scenario.rateBuffer
      );
      const repayment = calculatePayment(remainingBalance, forecastMortgageRate, remainingYears, frequency);

      return {
        ...scenario,
        forecastMortgageRate,
        repayment,
        repaymentChange: repayment - currentPayment
      };
    });
    const baseScenario = scenarios.find((scenario) => scenario.key === "base") ?? scenarios[0];

    return {
      ...term,
      refixPointMonths: expiryMonths,
      refixPointLabel: monthsLabel(expiryMonths),
      forecastOcr,
      forecastSource: rbnzOcr.source,
      forecastDate: rbnzOcr.refixDate,
      ocrSnapshotId: rbnzOcr.snapshotId,
      bankRateSnapshotId,
      dataNotice: USER_RATE_DATA_NOTICE,
      ocrLastRefreshed: ocrSnapshot.lastRefreshed,
      currentOcr: CURRENT_OCR_ASSUMPTION,
      marketRateToday,
      forecastMortgageRate: baseScenario.forecastMortgageRate,
      remainingBalance,
      remainingYears,
      repayment: baseScenario.repayment,
      repaymentChange: baseScenario.repaymentChange,
      scenarios
    };
  });
}

export function buildRefixScenarioView({
  tranches,
  selectedTrancheId = "",
  selectedTermMonths = 12,
  fallbackFrequency = "Monthly",
  fallbackPrincipal = 0,
  fallbackRate = 0,
  fallbackYears = 30,
  marketRates = MARKET_RATE_SNAPSHOT.rates,
  bankRateSnapshotId = MARKET_RATE_SNAPSHOT.snapshotId,
  ocrSnapshot = DEFAULT_OCR_FORECAST_SNAPSHOT,
  calculationDate = CALCULATION_AS_OF_DATE
}) {
  const selectedTranche = tranches.find((tranche) => tranche.id === selectedTrancheId) ?? tranches[0];
  const selectedFrequency = selectedTranche?.frequency || fallbackFrequency;
  const selectedPayment = selectedTranche
    ? calculateLoanPartRepayment(selectedTranche, selectedFrequency)
    : calculatePayment(fallbackPrincipal, fallbackRate, fallbackYears, selectedFrequency);
  const forecastRows = forecastRefixRows({
    principal: selectedTranche?.amount ?? fallbackPrincipal,
    currentRate: selectedTranche?.rate ?? fallbackRate,
    years: selectedTranche?.termYears ?? fallbackYears,
    frequency: selectedFrequency,
    currentPayment: selectedPayment,
    fixedEndsInMonths: selectedTranche?.fixedMonths ?? 0,
    marketRates,
    bankRateSnapshotId,
    ocrSnapshot,
    calculationDate
  });
  const selectedForecastRow =
    forecastRows.find((row) => row.months === selectedTermMonths) ??
    forecastRows.find((row) => row.months === 12) ??
    forecastRows[0];
  const selectedForecastScenario =
    selectedForecastRow?.scenarios.find((scenario) => scenario.key === "base") ?? selectedForecastRow?.scenarios[0];

  return {
    forecastRows,
    selectedForecastTranche: selectedTranche,
    selectedForecastTrancheId: selectedTranche?.id ?? "",
    selectedForecastFrequency: selectedFrequency,
    selectedForecastPayment: selectedPayment,
    selectedForecastRow,
    selectedForecastScenario,
    selectedForecastTermMonths: selectedForecastRow?.months ?? selectedTermMonths,
    scenarioLabel: selectedTranche?.index ? `Loan part ${selectedTranche.index}` : "Loan details"
  };
}

export function buildPlainEnglishSummary({
  tranches,
  totalDebt,
  weightedRate,
  primaryFrequency,
  selectedForecastTranche,
  selectedForecastRow,
  selectedForecastScenario,
  extraPayment,
  summary,
  periodIncome,
  repaymentToIncome,
  cashAfterRepayment,
  cashAfterOutgoings,
  marketRateRows = []
}) {
  const currentOcr = selectedForecastRow?.currentOcr ?? CURRENT_OCR_ASSUMPTION;
  const forecastOcr = selectedForecastRow?.forecastOcr ?? currentOcr;
  const baseRepaymentChange = paymentToAnnual(selectedForecastScenario?.repaymentChange ?? 0, selectedForecastTranche?.frequency || primaryFrequency) / 12;
  const extra = Math.max(Number(extraPayment) || 0, 0);
  const dtiRatio = debtToIncomeRatio(totalDebt, periodIncome, primaryFrequency);
  const dti = dtiAssessment(dtiRatio);
  const frequencyLabel = FREQUENCY_CONFIG[primaryFrequency].label;
  const frequencyShort = FREQUENCY_CONFIG[primaryFrequency].short;
  const monthlyRepayment = paymentToAnnual(summary.repayment, primaryFrequency) / 12;
  const monthlyCashAfterRepayment = paymentToAnnual(cashAfterRepayment, primaryFrequency) / 12;
  const surplus = Number.isFinite(cashAfterOutgoings) ? cashAfterOutgoings : 0;
  const selectedBalance = selectedForecastRow?.remainingBalance ?? selectedForecastTranche?.amount ?? 0;
  const selectedFrequency = selectedForecastTranche?.frequency || primaryFrequency;
  const selectedRepayment = paymentToAnnual(selectedForecastScenario?.repayment ?? 0, selectedFrequency) / 12;
  const topUpMonthly = paymentToAnnual(extra, primaryFrequency) / 12;
  const livingCostsMonthly = paymentToAnnual(Number(cashAfterRepayment || 0) - Number(cashAfterOutgoings || 0) - extra, primaryFrequency) / 12;
  const cashAfterOutgoingsMonthly = paymentToAnnual(surplus, primaryFrequency) / 12;
  const marketComparisonCopy =
    marketRateRows.length > 0
      ? marketRateRows
          .map((row) => {
            const monthlyImpact = paymentToAnnual(row.repaymentDifference, row.frequency) / 12;
            return `Loan part ${row.index}: current rate ${percent(row.currentRate)} compared with ${percent(
              row.marketRate
            )} from ${row.comparisonSource || "Five-bank average"} for ${row.marketTerm}; difference ${row.difference >= 0 ? "+" : ""}${percent(
              row.difference
            )}; estimated monthly impact ${monthlyImpact >= 0 ? "+" : ""}${currency(monthlyImpact)}.`;
          })
          .join(" ")
      : "Market comparison is unavailable until loan-part and rate data are complete.";

  const structureSentence = `${currency(totalDebt)} is shown across ${tranches.length} ${
    tranches.length === 1 ? "loan part" : "loan parts"
  } with a weighted average rate of ${percent(weightedRate)}.`;
  const repaymentSentence = `Current monthly repayment is ${currency(monthlyRepayment)}. The selected cash-flow view shows ${currency(
    summary.repayment
  )} every ${frequencyLabel}.`;
  const cashFlowSentence = `Cash after the standard mortgage repayment is ${currency(
    monthlyCashAfterRepayment
  )} per month. DTI is an estimate of ${dtiRatio.toFixed(2)}x from the debt and income entered.`;
  const refixSentence = `Selected re-fix scenario: Loan part ${selectedForecastTranche?.index ?? 1}, ${selectedForecastRow?.label ?? "1 year"} fixed in ${
    selectedForecastRow?.refixPointLabel ?? "now"
  }. It uses an OCR path from ${percent(currentOcr)} to ${percent(forecastOcr)}, a forecast mortgage rate of ${percent(
    selectedForecastScenario?.forecastMortgageRate ?? selectedForecastRow?.forecastMortgageRate ?? 0
  )}, an estimated monthly repayment of ${currency(selectedRepayment)}, and a monthly impact of ${
    baseRepaymentChange >= 0 ? "+" : ""
  }${currency(baseRepaymentChange)}. Balance at re-fix is estimated at ${currency(selectedBalance)}.`;
  const optionalScenarioSentence = `Optional top-up/living-cost scenario: extra repayment is ${currency(
    topUpMonthly
  )} per month and living costs entered are about ${currency(livingCostsMonthly)} per month. The calculator shows ${currency(
    cashAfterOutgoingsMonthly
  )} per month after mortgage, top-up, and living costs; modelled interest difference is ${currency(
    summary.interestSaved
  )} and modelled time difference is ${yearsAndMonths(summary.timeSavedPeriods, primaryFrequency)}.`;
  const disclaimer =
    "This is a calculator summary only. It is not financial advice, credit advice, or a lending approval. Rates, forecasts, eligibility, fees, tax treatment, and repayments can change; confirm details with a licensed mortgage adviser or lender.";

  return {
    items: [
      { label: "Loan structure", copy: structureSentence },
      { label: "Current repayment", copy: repaymentSentence },
      { label: "Cash after repayment and DTI", copy: cashFlowSentence },
      { label: "Market comparison", copy: marketComparisonCopy },
      { label: "Selected re-fix scenario", copy: refixSentence },
      { label: "Optional top-up and living costs", copy: optionalScenarioSentence }
    ],
    plainText: [
      structureSentence,
      repaymentSentence,
      cashFlowSentence,
      marketComparisonCopy,
      refixSentence,
      optionalScenarioSentence,
      disclaimer
    ].join("\n\n"),
    disclaimer,
    dtiRatio,
    dti,
    repaymentToIncome,
    frequencyShort
  };
}
