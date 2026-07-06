export const FREQUENCY_CONFIG = {
  Weekly: { periodsPerYear: 52, label: "week", short: "wk" },
  Fortnightly: { periodsPerYear: 26, label: "fortnight", short: "fn" },
  Monthly: { periodsPerYear: 12, label: "month", short: "mo" }
};

export const CURRENT_OCR_ASSUMPTION = 2.25;

export const RBNZ_OCR_FORECAST_SOURCE = {
  source: "RBNZ Monetary Policy Statement OCR track",
  url: "https://www.rbnz.govt.nz/monetary-policy/monetary-policy-statement",
  publicationsUrl: "https://www.rbnz.govt.nz/research-and-publications/publications/publications-library",
  ocrDecisionsUrl: "https://www.rbnz.govt.nz/monetary-policy/about-monetary-policy/official-cash-rate",
  note:
    "Update these values from the latest RBNZ Monetary Policy Statement projection tables. Direct RBNZ pages may require browser access because automated fetches can be blocked.",
  forecast: [
    { months: 6, ocr: 2.6 },
    { months: 12, ocr: 2.55 },
    { months: 24, ocr: 2.45 },
    { months: 36, ocr: 2.45 },
    { months: 48, ocr: 2.45 },
    { months: 60, ocr: 2.45 }
  ]
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

export const MARKET_RATE_SNAPSHOT = {
  source: "Cached 5-bank fallback",
  url: "",
  captured: "2026-07-05",
  note: "Cached major-bank comparison rates used only when the live Rates API request is unavailable. Confirm directly with lenders before re-fixing.",
  rates: [
    { term: "6 months", rate: 4.68 },
    { term: "1 year", rate: 4.73 },
    { term: "18 months", rate: 5.12 },
    { term: "2 years", rate: 5.24 },
    { term: "3 years", rate: 5.35 },
    { term: "4 years", rate: 5.47 },
    { term: "5 years", rate: 5.57 },
    { term: "Floating", rate: 5.81 }
  ]
};

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
    cashAfterRepayment: Math.max(safeIncome - safeRepayment, 0),
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

export function calculatePayment(principal, annualRate, years, frequency = "Monthly") {
  const safePrincipal = Math.max(Number(principal) || 0, 0);
  const safeYears = Math.max(Number(years) || 1, 1);
  const periodsPerYear = FREQUENCY_CONFIG[frequency].periodsPerYear;
  const totalPeriods = safeYears * periodsPerYear;
  const periodicRate = (Number(annualRate) || 0) / 100 / periodsPerYear;

  if (periodicRate === 0) return safePrincipal / totalPeriods;

  return (
    (safePrincipal * periodicRate * Math.pow(1 + periodicRate, totalPeriods)) /
    (Math.pow(1 + periodicRate, totalPeriods) - 1)
  );
}

export function remainingPrincipalAndInterestToFixedEnd(tranches, fallbackFrequency = "Monthly") {
  const rows = tranches.map((tranche) => {
    const frequency = tranche.frequency || fallbackFrequency;
    const periodsPerYear = FREQUENCY_CONFIG[frequency].periodsPerYear;
    const remainingMonths = tranche.type === "Fixed" ? Math.max(Number(tranche.fixedMonths) || 0, 0) : 0;
    const periodsRemaining = Math.ceil((remainingMonths / 12) * periodsPerYear);
    const periodicRate = (Number(tranche.rate) || 0) / 100 / periodsPerYear;
    const repayment = calculatePayment(tranche.amount, tranche.rate, tranche.termYears, frequency);
    let balance = Math.max(Number(tranche.amount) || 0, 0);
    let principal = 0;
    let interest = 0;

    for (let period = 0; period < periodsRemaining && balance > 0.5; period += 1) {
      const periodInterest = balance * periodicRate;
      const principalPaid = Math.max(0, Math.min(balance, repayment - periodInterest));
      principal += principalPaid;
      interest += periodInterest;
      balance = Math.max(0, balance - principalPaid);
    }

    return {
      id: tranche.id,
      index: tranche.index,
      frequency,
      remainingMonths,
      periodsRemaining,
      repayment,
      principal: Math.round(principal),
      interest: Math.round(interest),
      total: Math.round(principal + interest),
      balanceAtFixedEnd: Math.round(balance)
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
  return payment * FREQUENCY_CONFIG[frequency].periodsPerYear;
}

export function paymentFromAnnual(annualPayment, frequency = "Monthly") {
  return annualPayment / FREQUENCY_CONFIG[frequency].periodsPerYear;
}

export function annualIncomeFromPeriod(periodIncome, frequency = "Monthly") {
  return Math.max(Number(periodIncome) || 0, 0) * FREQUENCY_CONFIG[frequency].periodsPerYear;
}

export function debtToIncomeRatio(totalDebt, periodIncome, frequency = "Monthly") {
  const annualIncome = annualIncomeFromPeriod(periodIncome, frequency);
  const safeDebt = Math.max(Number(totalDebt) || 0, 0);
  return annualIncome > 0 ? safeDebt / annualIncome : 0;
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
  const incomePerPeriod = Math.max(Number(periodIncome) || 0, 0);
  const safeStandardRepayment = Math.max(Number(standardRepayment) || 0, 0);
  const extraPerPeriod = Math.max(Number(extraPayment) || 0, 0);
  const safeOutgoingCosts = Math.max(Number(outgoingCosts) || 0, 0);
  const repaymentWithExtra = safeStandardRepayment + extraPerPeriod;
  const cashAfterRepayment = incomePerPeriod - repaymentWithExtra;

  return {
    frequency,
    incomePerPeriod,
    standardRepayment: safeStandardRepayment,
    extraPerPeriod,
    outgoingCosts: safeOutgoingCosts,
    repaymentWithExtra,
    remainingCash: cashAfterRepayment,
    cashAfterOutgoings: cashAfterRepayment - safeOutgoingCosts
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
  const periodsPerYear = FREQUENCY_CONFIG[frequency].periodsPerYear;
  const periodicRate = (Number(annualRate) || 0) / 100 / periodsPerYear;
  const interestOnlyPeriods = Math.round(Math.max(interestOnlyYears, 0) * periodsPerYear);
  const basePayment = calculatePayment(principal, annualRate, years, frequency);
  const extraPerPeriod = Math.max(Number(extraPayment) || 0, 0);
  const rows = [];
  let balance = Math.max(Number(principal) || 0, 0);
  let totalInterest = 0;
  let yearInterest = 0;
  let period = 0;

  for (; period < horizonYears * periodsPerYear && balance > 0.5; period += 1) {
    const interest = balance * periodicRate;
    const isInterestOnly = period < interestOnlyPeriods;
    const scheduledPayment = isInterestOnly ? interest : basePayment;
    const principalPaid = isInterestOnly
      ? 0
      : Math.max(0, Math.min(balance, scheduledPayment + extraPerPeriod - interest));

    balance = Math.max(0, balance - principalPaid);
    totalInterest += interest;
    yearInterest += interest;

    if ((period + 1) % periodsPerYear === 0 || balance <= 0.5) {
      rows.push({
        year: Math.ceil((period + 1) / periodsPerYear),
        debt: Math.round(balance),
        annualInterest: Math.round(yearInterest),
        totalInterest: Math.round(totalInterest)
      });
      yearInterest = 0;
    }
  }

  return {
    rows,
    totalInterest: Math.round(totalInterest),
    totalPaid: Math.round(totalInterest + Number(principal || 0)),
    periodsToRepay: period,
    finalDebt: Math.round(balance)
  };
}

export function summarizeLoan({ principal, annualRate, years, frequency, extraPayment = 0, interestOnlyYears = 0 }) {
  const repayment = calculatePayment(principal, annualRate, years, frequency);
  const extra = Math.max(Number(extraPayment) || 0, 0);
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

export function weightedLoanSnapshot(tranches, fallbackFrequency) {
  const active = tranches.filter((tranche) => Number(tranche.amount) > 0);
  const totalPrincipal = active.reduce((sum, tranche) => sum + Number(tranche.amount || 0), 0);
  const weightedRate =
    active.reduce((sum, tranche) => sum + Number(tranche.amount || 0) * Number(tranche.rate || 0), 0) /
    Math.max(totalPrincipal, 1);
  const weightedTerm =
    active.reduce((sum, tranche) => sum + Number(tranche.amount || 0) * Number(tranche.termYears || 0), 0) /
    Math.max(totalPrincipal, 1);
  const annualPayment = active.reduce((sum, tranche) => {
    const trancheFrequency = tranche.frequency || fallbackFrequency;
    const payment = calculatePayment(tranche.amount, tranche.rate, tranche.termYears, trancheFrequency);
    return sum + paymentToAnnual(payment, trancheFrequency);
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
    const frequency = tranche.frequency || fallbackFrequency;
    const repayment = calculatePayment(tranche.amount, tranche.rate, tranche.termYears, frequency);
    const summary = summarizeLoan({
      principal: tranche.amount,
      annualRate: tranche.rate,
      years: tranche.termYears,
      frequency
    });

    return {
      ...tranche,
      index: index + 1,
      repayment,
      annualPayment: paymentToAnnual(repayment, frequency),
      totalInterest: summary.totalInterest
    };
  });
}

export function calculateAverageForecastOcr(monthWindow = 24) {
  const allForecasts = OCR_FORECAST_SOURCES.flatMap((source) =>
    source.forecast.filter((item) => item.months <= monthWindow).map((item) => item.ocr)
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

export function balanceAfterMonths({ principal, annualRate, years, frequency = "Monthly", months = 0 }) {
  const safePrincipal = Math.max(Number(principal) || 0, 0);
  const periodsPerYear = FREQUENCY_CONFIG[frequency].periodsPerYear;
  const periodsToRun = Math.round((Math.max(Number(months) || 0, 0) / 12) * periodsPerYear);
  const periodicRate = (Number(annualRate) || 0) / 100 / periodsPerYear;
  const scheduledPayment = calculatePayment(safePrincipal, annualRate, years, frequency);
  let balance = safePrincipal;

  for (let period = 0; period < periodsToRun && balance > 0.5; period += 1) {
    const interest = balance * periodicRate;
    const principalPaid = Math.max(0, Math.min(balance, scheduledPayment - interest));
    balance = Math.max(0, balance - principalPaid);
  }

  return Math.round(balance);
}

export function consensusOcrForMonths(months) {
  const targetMonths = Math.max(Number(months) || 0, 0);
  const forecasts = OCR_FORECAST_SOURCES.map((source) => {
    const sorted = [...source.forecast].sort((a, b) => a.months - b.months);
    const exact = sorted.find((item) => item.months === targetMonths);
    if (exact) return exact.ocr;

    const previous = sorted.filter((item) => item.months < targetMonths).at(-1);
    const next = sorted.find((item) => item.months > targetMonths);
    if (!previous && !next) return undefined;
    if (!previous) return next.ocr;
    if (!next) return previous.ocr;

    const progress = (targetMonths - previous.months) / (next.months - previous.months);
    return previous.ocr + (next.ocr - previous.ocr) * progress;
  }).filter(Number.isFinite);

  return forecasts.reduce((sum, item) => sum + item, 0) / Math.max(forecasts.length, 1);
}

function interpolateForecast(source, months) {
  const targetMonths = Math.max(Number(months) || 0, 0);
  const sorted = [...source.forecast].sort((a, b) => a.months - b.months);
  const exact = sorted.find((item) => item.months === targetMonths);
  if (exact) return exact.ocr;

  const previous = sorted.filter((item) => item.months < targetMonths).at(-1);
  const next = sorted.find((item) => item.months > targetMonths);
  if (!previous && !next) return undefined;
  if (!previous) return next.ocr;
  if (!next) return previous.ocr;

  const progress = (targetMonths - previous.months) / (next.months - previous.months);
  return previous.ocr + (next.ocr - previous.ocr) * progress;
}

export function rbnzOcrForMonths(months) {
  return {
    ocr: interpolateForecast(RBNZ_OCR_FORECAST_SOURCE, months),
    source: RBNZ_OCR_FORECAST_SOURCE.source
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
  marketRates = MARKET_RATE_SNAPSHOT.rates
}) {
  const expiryMonths = Math.max(Number(fixedEndsInMonths) || 0, 0);
  const rbnzOcr = rbnzOcrForMonths(expiryMonths);
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

export function buildExecutiveAdvice({
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
  marketRates = MARKET_RATE_SNAPSHOT.rates
}) {
  const sortedFixedTranches = [...tranches]
    .filter((tranche) => tranche.type === "Fixed")
    .sort((a, b) => Number(a.fixedMonths || 0) - Number(b.fixedMonths || 0));
  const upcomingTranche = sortedFixedTranches[0] ?? selectedForecastTranche ?? tranches[0];
  const fallbackOneYearRate = MARKET_RATE_SNAPSHOT.rates.find((rate) => rate.term === "1 year")?.rate ?? 0;
  const oneYearRate = marketRates.find((rate) => rate.term === "1 year")?.rate ?? fallbackOneYearRate;
  const currentOcr = selectedForecastRow?.currentOcr ?? CURRENT_OCR_ASSUMPTION;
  const forecastOcr = selectedForecastRow?.forecastOcr ?? currentOcr;
  const baseRepaymentChange = selectedForecastScenario?.repaymentChange ?? 0;
  const extra = Math.max(Number(extraPayment) || 0, 0);
  const dtiRatio = debtToIncomeRatio(totalDebt, periodIncome, primaryFrequency);
  const dti = dtiAssessment(dtiRatio);
  const frequencyShort = FREQUENCY_CONFIG[primaryFrequency].short;
  const upcomingBalance = upcomingTranche?.originalBalance ?? upcomingTranche?.amount ?? 0;
  const upcomingMonths = upcomingTranche?.fixedMonths ?? 0;
  const blendedPremium = weightedRate - oneYearRate;
  const surplus = Number.isFinite(cashAfterOutgoings) ? cashAfterOutgoings : 0;

  const structureSentence = `${currency(totalDebt)} is split across ${tranches.length} ${
    tranches.length === 1 ? "loan part" : "loan parts"
  } with a weighted blended rate of ${percent(weightedRate)}, which is ${
    blendedPremium >= 0 ? `${percent(blendedPremium)} above` : `${percent(Math.abs(blendedPremium))} below`
  } the current 1-year market average used in this calculator (${percent(oneYearRate)}).`;
  const expirySentence = `The next fixed-term date shown is Part ${upcomingTranche?.index ?? 1}, with ${currency(
    upcomingBalance
  )} expiring in ${monthsLabel(upcomingMonths)}; the forecast view uses an OCR path from ${percent(currentOcr)} to ${percent(
    forecastOcr
  )} and estimates a base-case repayment change of ${baseRepaymentChange >= 0 ? "+" : ""}${currency(
    baseRepaymentChange
  )}/${frequencyShort}.`;
  const cashFlowSentence =
    surplus > 0
      ? `Based on the income and outgoing costs entered, the calculator shows ${currency(
          cashAfterRepayment
        )}/${frequencyShort} remaining after repayments and ${currency(surplus)}/${frequencyShort} remaining after declared outgoings, with a DTI estimate of ${dtiRatio.toFixed(
          2
        )}x.`
      : `Based on the income and outgoing costs entered, the calculator shows ${currency(
          cashAfterRepayment
        )}/${frequencyShort} remaining after repayments and ${currency(surplus)}/${frequencyShort} remaining after declared outgoings, with a DTI estimate of ${dtiRatio.toFixed(
          2
        )}x.`;

  return {
    bullets: [
      { label: "Loan structure", copy: structureSentence },
      { label: "Next fixed-term date", copy: expirySentence },
      { label: "Cash-flow snapshot", copy: cashFlowSentence }
    ],
    closingSentence:
      "This is a calculator summary only, not financial advice; speak with a licensed mortgage adviser before making lending, refinancing, or re-fixing decisions.",
    dtiRatio,
    dti,
    extraImpact:
      extra > 0
        ? `Optional top-up model: ${currency(extra)}/${frequencyShort} could save ${currency(
            summary.interestSaved
          )} and shorten the loan by ${yearsAndMonths(summary.timeSavedPeriods, primaryFrequency)}.`
        : ""
  };
}
