import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Banknote, CalendarClock, Home, RefreshCw, SlidersHorizontal } from "lucide-react";
import "./index.css";
import { submitLeadPayload, trackEvent } from "./analyticsClient";
import { fetchOcrSnapshot } from "./ocrApi";
import { LoanBalanceStep } from "./components/LoanBalanceStep";
import { ExecutiveSummaryLeadStep } from "./components/ExecutiveSummaryLeadStep";
import { MarketRateComparisonStep } from "./components/MarketRateComparisonStep";
import { OptimizationStep } from "./components/OptimizationStep";
import { RateStressStep } from "./components/RateStressStep";
import { RepaymentBreakdownTable, RepaymentSummaryStep } from "./components/RepaymentSummaryStep";
import { Stat } from "./components/ui";
import {
  FREQUENCY_CONFIG,
  CALCULATION_AS_OF_DATE,
  MARKET_RATE_SNAPSHOT,
  balanceAfterMonths,
  buildPlainEnglishSummary,
  buildLoanPartRepaymentDetails,
  buildRefixScenarioView,
  calculateLoanPartRepayment,
  currency,
  dtiAssessment,
  debtToIncomeRatio,
  forecastRefixRows,
  marketTermMonths,
  netCashPosition,
  monthsLabel,
  percent,
  paymentToAnnual,
  repaymentToIncomeRatio,
  remainingPrincipalAndInterestToFixedEnd,
  summarizeMortgage,
  trancheRows,
  weightedLoanSnapshot
} from "./financialModel";
import { getInitialMortgageFormState, mortgageFormReducer, toNumber, toPositive } from "./mortgageFormState";
import { validateBalanceAtRefix } from "./lib/mortgageCalculations";
import { fetchMortgageRates } from "./ratesApi";
import { lowestRateBanks } from "./marketRateUtils";
import {
  DEFAULT_OCR_FORECAST_SNAPSHOT,
  LATEST_KNOWN_RBNZ_MPS,
  addMonthsToDate,
  createCalculationRun,
  evaluateLatestMpsWarnings
} from "./snapshotLayer.js";
import { buildSummaryPayload, monthlyEquivalent } from "./summaryPayload.js";
import { LegalPage } from "./LegalPage.jsx";
import { InfoPage } from "./InfoPage.jsx";
import { ContactPage } from "./ContactPage.jsx";

function displayDate(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${date}T00:00:00Z`));
}

function getFreshMortgageFormState() {
  try {
    window.localStorage.removeItem("trimratenz-form");
  } catch {
    // Storage may be unavailable; the calculator still starts clean.
  }
  return getInitialMortgageFormState();
}

function App() {
  const [formState, dispatch] = useReducer(mortgageFormReducer, undefined, getFreshMortgageFormState);
  const [selectedForecastTrancheId, setSelectedForecastTrancheId] = useState("");
  const [selectedForecastTermMonths, setSelectedForecastTermMonths] = useState(12);
  const [selectedMarketBankId, setSelectedMarketBankId] = useState("");
  const [selectedSummaryScope, setSelectedSummaryScope] = useState("total");
  const [resetVersion, setResetVersion] = useState(0);
  const trackedEvents = useRef(new Set());
  const [marketRates, setMarketRates] = useState({
    rates: MARKET_RATE_SNAPSHOT.rates,
    rawRecords: [],
    captured: MARKET_RATE_SNAPSHOT.captured,
    source: MARKET_RATE_SNAPSHOT.source,
    note: MARKET_RATE_SNAPSHOT.note,
    url: MARKET_RATE_SNAPSHOT.url,
    snapshotId: MARKET_RATE_SNAPSHOT.snapshotId,
    lastRefreshed: MARKET_RATE_SNAPSHOT.lastRefreshed,
    warnings: MARKET_RATE_SNAPSHOT.warnings,
    status: "idle",
    error: ""
  });
  const [ocrSnapshot, setOcrSnapshot] = useState(DEFAULT_OCR_FORECAST_SNAPSHOT);
  const { hasExistingLoan, loanSituation, loanStructure, salaryIncome, extraPayment, outgoingCosts, interestOnlyYears, tranches } = formState;

  useEffect(() => {
    trackOnce(trackedEvents, "page_view");
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchOcrSnapshot()
      .then((snapshot) => { if (!cancelled) setOcrSnapshot(snapshot); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMarketRates() {
      setMarketRates((current) => ({ ...current, status: "loading", error: "" }));

      try {
        const result = await fetchMortgageRates();
        if (cancelled) return;

        setMarketRates({
          rates: result.rates,
          rawRecords: result.rawRecords,
          captured: result.captured,
          source: result.source,
          note: result.note,
          url: "",
          snapshotId: result.snapshotId,
          lastRefreshed: result.lastRefreshed,
          warnings: result.warnings,
          status: "live",
          error: ""
        });
      } catch (error) {
        if (cancelled) return;

        setMarketRates({
          rates: MARKET_RATE_SNAPSHOT.rates,
          rawRecords: [],
          captured: MARKET_RATE_SNAPSHOT.captured,
          source: MARKET_RATE_SNAPSHOT.source,
          note: `${MARKET_RATE_SNAPSHOT.note} Live rate refresh unavailable: ${error.message}.`,
          url: MARKET_RATE_SNAPSHOT.url,
          snapshotId: MARKET_RATE_SNAPSHOT.snapshotId,
          lastRefreshed: MARKET_RATE_SNAPSHOT.lastRefreshed,
          warnings: MARKET_RATE_SNAPSHOT.warnings,
          status: "fallback",
          error: error.message
        });
      }
    }

    loadMarketRates();

    return () => {
      cancelled = true;
    };
  }, []);

  const ocrForecastWarnings = useMemo(
    () => evaluateLatestMpsWarnings(ocrSnapshot, LATEST_KNOWN_RBNZ_MPS),
    [ocrSnapshot]
  );
  const dataWarnings = useMemo(
    () => [...(marketRates.warnings || []), ...ocrForecastWarnings],
    [marketRates.warnings, ocrForecastWarnings]
  );

  useEffect(() => {
    dataWarnings.forEach((warning) => {
      console.warn("TrimRate data warning", warning);
    });
  }, [dataWarnings]);

  const isExistingLoan = hasExistingLoan === "yes";
  const isSplitLoan = loanStructure === "split";
  const displayedTranches = useMemo(() => (isSplitLoan ? tranches : tranches.slice(0, 1)), [isSplitLoan, tranches]);
  const normalizedTranches = useMemo(
    () =>
      displayedTranches.map((tranche) => {
        const amount = toPositive(tranche.amount);
        const repaymentPrincipal = isExistingLoan ? toPositive(tranche.originalLoanAmount) : amount;
        const rate = toNumber(tranche.rate);
        const termYears = toNumber(tranche.termYears);
        const calculationTermYears = Math.max(termYears, 1);
        const frequency = tranche.frequency || "Monthly";
        const usesActualRepayment =
          tranche.paysMoreThanMinimum === "yes" || Boolean(String(tranche.repaymentAmount ?? "").trim());
        const repaymentDetails = buildLoanPartRepaymentDetails({
          principal: repaymentPrincipal,
          annualRate: rate,
          years: calculationTermYears,
          frequency,
          userCurrentRepayment: usesActualRepayment ? tranche.repaymentAmount : ""
        });
        const originalAmountBelowCurrent = isExistingLoan && repaymentPrincipal > 0 && repaymentPrincipal < amount;
        const fixedTermMonths = tranche.type === "Fixed" ? Math.max(toNumber(tranche.fixedTermMonths || "12"), 0) : 0;
        const fixedMonths = tranche.type === "Fixed" ? Math.max(toNumber(tranche.fixedMonths), 0) : 0;
        const fixedTermTooLong =
          tranche.type === "Fixed" && termYears > 0 && (fixedMonths > termYears * 12 || fixedTermMonths > termYears * 12);
        const needsActualRepayment = usesActualRepayment && String(tranche.repaymentAmount ?? "").trim() === "";
        const repaymentValidationError = needsActualRepayment
          ? {
              code: "current-repayment-required",
              minimumRepaymentExact: repaymentDetails.calculatedMinimumRepaymentExact,
              minimumRepaymentRounded: repaymentDetails.calculatedMinimumRepaymentRounded
            }
          : repaymentDetails.repaymentValidationError;
        const estimatedBalanceAtRefix = balanceAfterMonths({
          principal: amount,
          annualRate: rate,
          years: calculationTermYears,
          frequency,
          repaymentAmount: repaymentDetails.effectiveCurrentRepaymentExact,
          months: fixedMonths
        });
        const balanceAtRefixValidation = validateBalanceAtRefix(tranche.balanceAtRefix, amount);
        const balanceAtRefix = balanceAtRefixValidation.value || 0;
        const balanceAtRefixError = balanceAtRefixValidation.error;

        return {
          ...tranche,
          amount,
          repaymentPrincipal,
          originalAmountBelowCurrent,
          rate,
          hasInterestRate: String(tranche.rate ?? "").trim() !== "",
          termYears,
          calculationTermYears,
          hasFrequency: Boolean(frequency),
          repaymentAmount: toPositive(tranche.repaymentAmount),
          calculatedMinimumRepaymentExact: repaymentDetails.calculatedMinimumRepaymentExact,
          calculatedMinimumRepaymentRounded: repaymentDetails.calculatedMinimumRepaymentRounded,
          userCurrentRepaymentExact: repaymentDetails.userCurrentRepaymentExact,
          effectiveCurrentRepaymentExact: repaymentDetails.effectiveCurrentRepaymentExact,
          repaymentSource: repaymentDetails.repaymentSource,
          repaymentValidationError,
          repaymentWarning: repaymentDetails.repaymentWarning,
          frequency,
          fixedTermMonths,
          fixedMonths,
          fixedTermTooLong,
          estimatedBalanceAtRefix,
          balanceAtRefixInput: tranche.balanceAtRefix,
          balanceAtRefix,
          balanceAtRefixError,
          resolvedBalanceAtRefix: !balanceAtRefixError && balanceAtRefix > 0 ? balanceAtRefix : estimatedBalanceAtRefix
        };
      }),
    [displayedTranches, isExistingLoan]
  );
  const mathTranches = useMemo(
    () =>
      normalizedTranches.map((tranche) => ({
        ...tranche
      })),
    [normalizedTranches]
  );

  const effectiveLoan = mathTranches.reduce((sum, tranche) => sum + tranche.amount, 0);
  const loanAmount = effectiveLoan;
  const allTranchesComplete = normalizedTranches.every(
    (tranche) =>
      tranche.amount > 0 &&
      (!isExistingLoan || tranche.repaymentPrincipal > 0) &&
      !tranche.originalAmountBelowCurrent &&
      tranche.hasInterestRate &&
      tranche.rate >= 0 &&
      tranche.rate <= 15 &&
      tranche.termYears > 0 &&
      tranche.hasFrequency &&
      tranche.type &&
      (tranche.type === "Variable" || tranche.fixedMonths >= 0) &&
      !tranche.fixedTermTooLong &&
      !tranche.repaymentValidationError
  );
  const setupComplete = loanAmount > 0 && allTranchesComplete;
  const shouldShowRefix = setupComplete && (loanSituation === "fixed_only" || loanSituation === "mixed");

  const loan = useMemo(() => weightedLoanSnapshot(mathTranches, "Monthly"), [mathTranches]);
  const modelRate = loan.weightedRate || 0;
  const modelYears = Math.max(1, Math.round(loan.weightedTerm || 30));
  const selectedFrequency = normalizedTranches[0]?.frequency || "Monthly";
  const repaymentFrequencies = useMemo(
    () => [...new Set(normalizedTranches.map((tranche) => tranche.frequency).filter(Boolean))],
    [normalizedTranches]
  );
  const hasMixedRepaymentFrequencies = repaymentFrequencies.length > 1;
  const primaryFrequency = hasMixedRepaymentFrequencies && repaymentFrequencies.includes("Monthly") ? "Monthly" : selectedFrequency;
  const repaymentFrequencyLabel = hasMixedRepaymentFrequencies ? `${primaryFrequency} Equivalent` : primaryFrequency;
  const repaymentFrequencyNote = hasMixedRepaymentFrequencies
    ? `Annualised from ${repaymentFrequencies.join(" + ")} loan tranche repayments`
    : `Summed loan tranche schedules; weighted rate ${percent(modelRate)}`;
  const summary = useMemo(
    () =>
      summarizeMortgage({
        tranches: mathTranches,
        displayFrequency: primaryFrequency,
        extraPayment: toPositive(extraPayment),
        interestOnlyYears: toPositive(interestOnlyYears)
      }),
    [mathTranches, primaryFrequency, extraPayment, interestOnlyYears]
  );
  const forecastTranches = useMemo(
    () =>
      mathTranches.map((tranche, index) => ({
        ...tranche,
        index: index + 1,
        originalBalance: normalizedTranches[index]?.amount ?? tranche.amount,
        fixedMonths: normalizedTranches[index]?.fixedMonths ?? tranche.fixedMonths,
        fixedTermMonths: normalizedTranches[index]?.fixedTermMonths ?? tranche.fixedTermMonths
      })),
    [mathTranches, normalizedTranches]
  );
  const refixScenarioView = useMemo(
    () =>
      buildRefixScenarioView({
        tranches: forecastTranches,
        selectedTrancheId: selectedForecastTrancheId,
        selectedTermMonths: selectedForecastTermMonths,
        fallbackFrequency: primaryFrequency,
        fallbackPrincipal: effectiveLoan,
        fallbackRate: modelRate,
        fallbackYears: modelYears,
        marketRates: marketRates.rates,
        bankRateSnapshotId: marketRates.snapshotId,
        ocrSnapshot
      }),
    [
      forecastTranches,
      selectedForecastTrancheId,
      selectedForecastTermMonths,
      primaryFrequency,
      effectiveLoan,
      modelRate,
      modelYears,
      marketRates.rates,
      marketRates.snapshotId,
      ocrSnapshot
    ]
  );
  const {
    forecastRows,
    selectedForecastTranche,
    selectedForecastFrequency,
    selectedForecastPayment,
    selectedForecastRow,
    selectedForecastScenario
  } = refixScenarioView;
  useEffect(() => {
    if (refixScenarioView.selectedForecastTrancheId && selectedForecastTrancheId !== refixScenarioView.selectedForecastTrancheId) {
      setSelectedForecastTrancheId(refixScenarioView.selectedForecastTrancheId);
    }
  }, [refixScenarioView.selectedForecastTrancheId, selectedForecastTrancheId]);
  useEffect(() => {
    if (selectedForecastTermMonths !== refixScenarioView.selectedForecastTermMonths) {
      setSelectedForecastTermMonths(refixScenarioView.selectedForecastTermMonths);
    }
  }, [refixScenarioView.selectedForecastTermMonths, selectedForecastTermMonths]);
  const remainingFixedPayments = useMemo(
    () => remainingPrincipalAndInterestToFixedEnd(forecastTranches, primaryFrequency),
    [forecastTranches, primaryFrequency]
  );
  const tranchesWithPayments = useMemo(() => trancheRows(mathTranches, primaryFrequency), [mathTranches, primaryFrequency]);
  useEffect(() => {
    if (selectedSummaryScope !== "total" && !forecastTranches.some((tranche) => tranche.id === selectedSummaryScope)) {
      setSelectedSummaryScope("total");
    }
  }, [forecastTranches, selectedSummaryScope]);
  const selectedSummaryDetails = useMemo(() => {
    if (selectedSummaryScope === "total") {
      const hasFixedEndPayments = remainingFixedPayments.total > 0;
      const principalShare =
        remainingFixedPayments.total > 0 ? (remainingFixedPayments.principal / remainingFixedPayments.total) * 100 : 0;
      const interestShare =
        remainingFixedPayments.total > 0 ? (remainingFixedPayments.interest / remainingFixedPayments.total) * 100 : 0;

      return {
        title: "Total mortgage",
        description: `${forecastTranches.length} ${forecastTranches.length === 1 ? "Loan Tranche" : "Loan Tranches"} combined`,
        repaymentLabel: `${repaymentFrequencyLabel} Repayment`,
        repaymentValue: currency(summary.repayment),
        repaymentSub: repaymentFrequencyNote,
        principalLabel: hasFixedEndPayments ? "Remaining Principal" : "Current Balance",
        principalValue: hasFixedEndPayments ? currency(remainingFixedPayments.principal) : currency(effectiveLoan),
        principalSub: hasFixedEndPayments
          ? `${percent(principalShare, 0)} of payments go toward principal`
          : "Variable balance available to compare",
        interestLabel: hasFixedEndPayments ? "Remaining Interest" : "Current Rate",
        interestValue: hasFixedEndPayments ? currency(remainingFixedPayments.interest) : percent(modelRate),
        interestSub: hasFixedEndPayments
          ? `${percent(interestShare, 0)} of payments go toward interest`
          : "Weighted current variable rate",
        totalLabel: hasFixedEndPayments ? "Total P&I to Fixed End" : "Fixing Status",
        totalValue: hasFixedEndPayments ? currency(remainingFixedPayments.total) : "Ready now",
        totalSub: hasFixedEndPayments
          ? "Principal + interest before fixed terms end"
          : "Compare fixed-rate options from today"
      };
    }

    const tranche = forecastTranches.find((item) => item.id === selectedSummaryScope) ?? forecastTranches[0];
    const paymentRow = tranchesWithPayments.find((item) => item.id === tranche?.id);
    const fixedPaymentRow = remainingFixedPayments.rows.find((item) => item.id === tranche?.id);
    const principal = fixedPaymentRow?.principal ?? 0;
    const interest = fixedPaymentRow?.interest ?? 0;
    const total = fixedPaymentRow?.total ?? 0;
    const principalShare = total > 0 ? (principal / total) * 100 : 0;
    const interestShare = total > 0 ? (interest / total) * 100 : 0;
    const isVariable = tranche?.type === "Variable";
    const fixedTermSummary =
      tranche?.type === "Fixed"
        ? `Fixed term: ${monthsLabel(tranche.fixedTermMonths)} | Time remaining: ${monthsLabel(
            tranche.fixedMonths
          )} | Estimated end date: ${displayDate(addMonthsToDate(CALCULATION_AS_OF_DATE, tranche.fixedMonths))}`
        : "Variable rate | No fixed term end date";

    return {
      title: `Loan Tranche ${tranche?.index ?? 1}`,
      description: `${currency(tranche?.amount ?? 0)} at ${percent(tranche?.rate ?? 0)} | ${fixedTermSummary}`,
      repaymentLabel: `${tranche?.frequency ?? primaryFrequency} Repayment`,
      repaymentValue: currency(paymentRow?.repayment ?? 0),
      repaymentSub: `${tranche?.type ?? "Loan Tranche"}; ${tranche?.termYears ?? modelYears} yr term`,
      principalLabel: isVariable ? "Current Balance" : "Remaining Principal",
      principalValue: isVariable ? currency(tranche?.amount ?? 0) : currency(principal),
      principalSub: isVariable
        ? "Variable balance available to compare"
        : total > 0
          ? `${percent(principalShare, 0)} of payments go toward principal`
          : "No fixed-term period selected",
      interestLabel: isVariable ? "Current Rate" : "Remaining Interest",
      interestValue: isVariable ? percent(tranche?.rate ?? 0) : currency(interest),
      interestSub: isVariable
        ? "Current floating or variable rate"
        : total > 0
          ? `${percent(interestShare, 0)} of payments go toward interest`
          : "No fixed-term interest window",
      totalLabel: isVariable ? "Fixing Status" : "Total P&I to Fixed End",
      totalValue: isVariable ? "Ready now" : currency(total),
      totalSub: isVariable
        ? "Compare fixed-rate options from today"
        : total > 0
          ? "Principal + interest before this fixed term ends"
          : "No fixed-term payments to show"
    };
  }, [
    effectiveLoan,
    forecastTranches,
    modelYears,
    modelRate,
    primaryFrequency,
    remainingFixedPayments,
    repaymentFrequencyLabel,
    repaymentFrequencyNote,
    selectedSummaryScope,
    summary.repayment,
    tranchesWithPayments
  ]);
  const payoffRows = summary.standard.rows.map((row, index) => ({
    year: row.year,
    standardDebt: row.debt,
    fasterDebt: summary.accelerated.rows[index]?.debt ?? summary.accelerated.rows.at(-1)?.debt ?? 0
  }));
  const salaryAmount = toPositive(salaryIncome);
  const outgoingAmount = toPositive(outgoingCosts);
  const repaymentToIncome = repaymentToIncomeRatio(summary.repayment, salaryAmount);
  const netCash = useMemo(
    () =>
      netCashPosition({
        periodIncome: salaryAmount,
        standardRepayment: summary.repayment,
        extraPayment: toPositive(extraPayment),
        outgoingCosts: outgoingAmount,
        frequency: primaryFrequency
      }),
    [salaryAmount, summary.repayment, extraPayment, outgoingAmount, primaryFrequency]
  );
  const dtiRatio = debtToIncomeRatio(loanAmount, salaryAmount, primaryFrequency);
  const dti = dtiAssessment(dtiRatio);
  const marketBankOptions = useMemo(() => {
    const bankMap = new Map();
    marketRates.rawRecords.forEach((record) => {
      bankMap.set(record.institutionId, record.institution);
    });
    return [...bankMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [marketRates.rawRecords]);
  function buildMarketRateRows(selectedBankId = "") {
    return forecastTranches.map((tranche) => {
    const targetMonths = tranche.type === "Fixed" ? tranche.fixedTermMonths || tranche.fixedMonths : 0;
    const comparableRates = marketRates.rates.filter((rate) =>
      tranche.type === "Variable" ? marketTermMonths(rate.term) === 0 : marketTermMonths(rate.term) > 0
    );
    const closestRate =
      comparableRates
        .map((rate) => ({ ...rate, months: marketTermMonths(rate.term) }))
        .sort((a, b) => Math.abs(a.months - targetMonths) - Math.abs(b.months - targetMonths))[0] ??
      marketRates.rates[0];
    const matchedMonths = closestRate.termInMonths ?? marketTermMonths(closestRate.term);
    const selectedBankRate = marketRates.rawRecords.find(
      (record) => record.institutionId === selectedBankId && record.termInMonths === matchedMonths
    );
    const lowest = lowestRateBanks(marketRates.rawRecords, matchedMonths);
    const comparisonRate = selectedBankRate?.rate ?? closestRate.rate;
    const comparisonSource = selectedBankRate?.institution ?? "Five-bank average";
    const marketRepayment = calculateLoanPartRepayment(
      { ...tranche, rate: comparisonRate, repaymentAmount: 0 },
      tranche.frequency
    );
    const currentRepayment = calculateLoanPartRepayment(tranche, tranche.frequency);
    const repaymentDifference = marketRepayment - currentRepayment;

    return {
      id: tranche.id,
      index: tranche.index,
      type: tranche.type,
      balance: tranche.amount,
      frequency: tranche.frequency,
      fixedTermLabel: tranche.type === "Fixed" ? monthsLabel(targetMonths) : "Variable",
      marketTerm: closestRate.term,
      marketRate: comparisonRate,
      comparisonSource,
      lowestBanks: lowest.banks,
      lowestRate: lowest.rate,
      currentRate: tranche.rate,
      difference: tranche.rate ? tranche.rate - comparisonRate : 0,
      currentRepayment,
      marketRepayment,
      repaymentDifference
    };
    });
  }
  const marketRateRows = buildMarketRateRows(selectedMarketBankId);
  const averageMarketRateRows = selectedMarketBankId ? buildMarketRateRows() : marketRateRows;
  const trancheForecasts = useMemo(
    () =>
      forecastTranches.map((tranche) => {
        const currentRepayment = tranchesWithPayments.find((item) => item.id === tranche.id)?.repayment ?? 0;
        const forecastOptions = forecastRefixRows({
          principal: tranche.amount,
          currentRate: tranche.rate,
          years: tranche.termYears,
          frequency: tranche.frequency,
          currentPayment: currentRepayment,
          fixedEndsInMonths: tranche.fixedMonths,
          balanceAtRefix: tranche.resolvedBalanceAtRefix,
          marketRates: marketRates.rates,
          bankRateSnapshotId: marketRates.snapshotId,
          ocrSnapshot
        });
        const selectedOption =
          forecastOptions.find((option) => option.months === selectedForecastTermMonths) ??
          forecastOptions.find((option) => option.months === 12) ??
          forecastOptions[0];

        return {
          id: tranche.id,
          index: tranche.index,
          type: tranche.type,
          currentRate: tranche.rate,
          frequency: tranche.frequency,
          fixedTermLabel: tranche.type === "Fixed" ? monthsLabel(tranche.fixedMonths) : "Variable",
          refixPointLabel: selectedOption?.refixPointLabel ?? "now",
          fixedTermEnd:
            tranche.type === "Fixed"
              ? displayDate(addMonthsToDate(CALCULATION_AS_OF_DATE, tranche.fixedMonths))
              : "Available now",
          forecastOcr: selectedOption?.forecastOcr ?? 0,
          estimatedBalanceAtRefix: tranche.estimatedBalanceAtRefix,
          balanceAtRefixInput: tranche.balanceAtRefixInput,
          balanceAtRefix: tranche.balanceAtRefix,
          balanceAtRefixError: tranche.balanceAtRefixError,
          resolvedBalanceAtRefix: tranche.resolvedBalanceAtRefix,
          currentRepayment,
          scenarios: selectedOption?.scenarios ?? []
        };
      }),
    [forecastTranches, marketRates.rates, marketRates.snapshotId, ocrSnapshot, selectedForecastTermMonths, tranchesWithPayments]
  );
  const variableOnly = forecastTranches.length > 0 && forecastTranches.every((tranche) => tranche.type === "Variable");
  const averageFixedRates = marketRates.rates.filter((rate) => marketTermMonths(rate.term) > 0);
  const summaryContent = useMemo(
    () =>
      buildPlainEnglishSummary({
        tranches: forecastTranches,
        totalDebt: loanAmount,
        weightedRate: modelRate,
        primaryFrequency,
        selectedForecastTranche,
        selectedForecastRow,
        selectedForecastScenario,
        selectedForecastTermMonths,
        extraPayment: toPositive(extraPayment),
        summary,
        periodIncome: salaryAmount,
        repaymentToIncome,
        cashAfterRepayment: netCash.remainingCash,
        cashAfterOutgoings: netCash.cashAfterOutgoings,
        marketRateRows,
        marketRates: marketRates.rates
      }),
    [
      forecastTranches,
      loanAmount,
      modelRate,
      primaryFrequency,
      selectedForecastTranche,
      selectedForecastRow,
      selectedForecastScenario,
      selectedForecastTermMonths,
      extraPayment,
      summary,
      salaryAmount,
      repaymentToIncome,
      netCash.remainingCash,
      netCash.cashAfterOutgoings,
      marketRateRows,
      marketRates.rates
    ]
  );
  const serializedMortgageState = useMemo(
    () => ({
      steps: {
        loanBalance: {
          loanBalance: loanAmount,
          loanAmount,
          effectiveLoan
        },
        loanStructure: {
          loanStructure,
          tranches: normalizedTranches
        },
        repaymentSummary: {
          periodIncome: salaryAmount,
          incomeFrequency: primaryFrequency,
          weightedRate: modelRate,
          weightedTermYears: modelYears,
          primaryFrequency,
          remainingFixedPayments,
          summary
        },
        marketComparison: {
          selectedMarketBankId,
          marketRateRows
        },
        rolloverForecast: {
          selectedForecastTrancheId,
          selectedForecastTermMonths,
          selectedForecastRow,
          selectedForecastScenario
        },
        optimization: {
          extraPayment: toPositive(extraPayment),
          outgoingCosts: outgoingAmount,
          interestOnlyYears: toPositive(interestOnlyYears),
          netCash
        }
      },
      dataSnapshots: {
        bankRateSnapshotId: marketRates.snapshotId,
        bankRatesLastRefreshed: marketRates.lastRefreshed || marketRates.captured,
        ocrForecastSnapshotId: ocrSnapshot.id,
        ocrForecastLastRefreshed: ocrSnapshot.lastRefreshed,
        latestKnownMpsPublishedAt: LATEST_KNOWN_RBNZ_MPS.publishedAt,
        warnings: dataWarnings
      },
      calculationRun: createCalculationRun({
        inputs: {
          loanAmount,
          tranches: mathTranches,
          primaryFrequency
        },
        result: {
          repayment: summary.repayment,
          totalInterest: summary.totalInterest,
          selectedForecastRow
        },
        bankRateSnapshot: { id: marketRates.snapshotId },
        ocrForecastSnapshot: ocrSnapshot
      }),
      rawFormState: formState
    }),
    [
      loanAmount,
      effectiveLoan,
      loanStructure,
      normalizedTranches,
      mathTranches,
      salaryAmount,
      modelRate,
      modelYears,
      primaryFrequency,
      summary,
      selectedMarketBankId,
      marketRateRows,
      selectedForecastTrancheId,
      selectedForecastTermMonths,
      selectedForecastRow,
      selectedForecastScenario,
      remainingFixedPayments,
      extraPayment,
      outgoingAmount,
      interestOnlyYears,
      netCash,
      marketRates.snapshotId,
      marketRates.lastRefreshed,
      marketRates.captured,
      ocrSnapshot,
      dataWarnings,
      formState
    ]
  );
  const summaryPayloadBase = useMemo(
    () =>
      buildSummaryPayload({
        ratesSnapshotId: marketRates.snapshotId,
        ocrSnapshotId: ocrSnapshot.id,
        inputs: {
          hasExistingLoan: isExistingLoan,
          loanBalance: loanAmount,
          originalLoanAmount: isExistingLoan ? normalizedTranches.reduce((sum, tranche) => sum + tranche.repaymentPrincipal, 0) : null,
          loanStructure,
          repaymentFrequency: primaryFrequency,
          incomePerPeriod: salaryAmount,
          incomeFrequency: primaryFrequency,
          extraPaymentPerPeriod: toPositive(extraPayment),
          livingCostsPerPeriod: outgoingAmount,
          interestOnlyYears: toPositive(interestOnlyYears),
          loanParts: normalizedTranches.map((tranche, index) => ({
            id: tranche.id,
            index: index + 1,
            balance: tranche.amount,
            repaymentPrincipal: tranche.repaymentPrincipal,
            effectiveBalance: mathTranches[index]?.amount ?? tranche.amount,
            rate: tranche.rate,
            termYears: tranche.termYears,
            calculatedMinimumRepaymentExact: tranche.calculatedMinimumRepaymentExact,
            calculatedMinimumRepaymentRounded: tranche.calculatedMinimumRepaymentRounded,
            userCurrentRepaymentExact: tranche.userCurrentRepaymentExact,
            effectiveCurrentRepaymentExact: tranche.effectiveCurrentRepaymentExact,
            repaymentSource: tranche.repaymentSource,
            repaymentFrequency: tranche.frequency,
            type: tranche.type,
            fixedTermMonths: tranche.fixedTermMonths,
            fixedEndsInMonths: tranche.fixedMonths
          }))
        },
        outputs: {
          currentMonthlyRepayment: monthlyEquivalent(summary.repayment, primaryFrequency),
          currentMonthlyRepaymentRounded: Math.round(monthlyEquivalent(summary.repayment, primaryFrequency)),
          currentRepaymentPerSelectedPeriod: summary.repayment,
          currentRepaymentPerSelectedPeriodRounded: Math.round(summary.repayment),
          selectedCashFlowFrequency: primaryFrequency,
          totalInterest: summary.totalInterest,
          cashAfterRepaymentPerSelectedPeriod: netCash.remainingCash,
          cashAfterRepaymentMonthly: monthlyEquivalent(netCash.remainingCash, primaryFrequency),
          cashAfterTopUpAndLivingCostsPerSelectedPeriod: netCash.cashAfterOutgoings,
          dtiEstimate: dtiRatio,
          repaymentToIncomePercent: repaymentToIncome,
          weightedAverageRate: modelRate
        },
        marketComparison: {
          selectedBankId: selectedMarketBankId,
          selectedBankLabel: marketBankOptions.find((bank) => bank.id === selectedMarketBankId)?.name || "Five-bank average",
          rows: marketRateRows.map((row) => ({
            loanPart: row.index,
            balance: row.balance,
            currentRate: row.currentRate,
            marketRate: row.marketRate,
            comparisonSource: row.comparisonSource,
            marketTerm: row.marketTerm,
            differenceVsYourRate: row.difference,
            currentRepayment: row.currentRepayment,
            marketRepayment: row.marketRepayment,
            estimatedMonthlyImpact: monthlyEquivalent(row.repaymentDifference, row.frequency)
          }))
        },
        refixScenario: {
          selectedLoanPart: selectedForecastTranche?.index ?? 1,
          selectedTermMonths: selectedForecastRow?.months ?? selectedForecastTermMonths,
          selectedTermLabel: selectedForecastRow?.label ?? "",
          refixPointLabel: selectedForecastRow?.refixPointLabel ?? "",
          balanceAtRefix: selectedForecastRow?.remainingBalance ?? 0,
          forecastOcr: selectedForecastRow?.forecastOcr ?? 0,
          forecastMortgageRate: selectedForecastScenario?.forecastMortgageRate ?? 0,
          estimatedMonthlyRepayment: monthlyEquivalent(
            selectedForecastScenario?.repayment ?? 0,
            selectedForecastTranche?.frequency || primaryFrequency
          ),
          estimatedMonthlyImpact: monthlyEquivalent(
            selectedForecastScenario?.repaymentChange ?? 0,
            selectedForecastTranche?.frequency || primaryFrequency
          ),
          scenarioKey: selectedForecastScenario?.key ?? "",
          scenarioLabel: selectedForecastScenario?.label ?? ""
        },
        visuals: {
          payoffRows,
          chartSeries: ["standardDebt", "fasterDebt"],
          summaryText: summaryContent.plainText
        },
        disclaimer: summaryContent.disclaimer
      }),
    [
      marketRates.snapshotId,
      ocrSnapshot.id,
      isExistingLoan,
      loanAmount,
      loanStructure,
      primaryFrequency,
      salaryAmount,
      extraPayment,
      outgoingAmount,
      interestOnlyYears,
      normalizedTranches,
      mathTranches,
      summary,
      netCash.remainingCash,
      netCash.cashAfterOutgoings,
      dtiRatio,
      repaymentToIncome,
      modelRate,
      selectedMarketBankId,
      marketBankOptions,
      marketRateRows,
      selectedForecastTranche,
      selectedForecastRow,
      selectedForecastTermMonths,
      selectedForecastScenario,
      payoffRows,
      summaryContent
    ]
  );

  useEffect(() => {
    if (loanAmount > 0) {
      trackOnce(trackedEvents, "calculator_started", { loanAmount });
      trackOnce(trackedEvents, "step_1_completed", { loanAmount });
    }
  }, [loanAmount]);

  useEffect(() => {
    if (!setupComplete) return;

    trackOnce(trackedEvents, "step_2_completed", { loanStructure, loanPartCount: normalizedTranches.length });
    trackOnce(trackedEvents, "step_3_viewed");
    trackOnce(trackedEvents, "step_4_viewed");
    trackOnce(trackedEvents, "step_5_viewed");
    trackOnce(trackedEvents, "step_6_completed");

    if (!trackedEvents.current.has("summary_viewed")) {
      trackedEvents.current.add("summary_viewed");
      trackEvent("summary_viewed");
    }
  }, [loanStructure, normalizedTranches.length, setupComplete, summaryPayloadBase]);

  function updateTranche(id, patch) {
    Object.entries(patch).forEach(([field, value]) => {
      dispatch({
        type: "UPDATE_TRANCHE",
        id,
        field,
        value,
        decimal: ["amount", "rate", "termYears", "repaymentAmount", "balanceAtRefix", "fixedTermMonths", "fixedMonths"].includes(field)
      });
    });
  }

  function addTranche() {
    dispatch({ type: "ADD_TRANCHE" });
  }

  function removeTranche(id) {
    dispatch({ type: "REMOVE_TRANCHE", id });
  }

  function nudgeExtra(delta) {
    dispatch({
      type: "SET_FIELD",
      field: "extraPayment",
      value: String(Math.max(0, toNumber(extraPayment) + delta)),
      decimal: true
    });
  }

  function resetTool() {
    trackEvent("reset_clicked").catch(() => {});
    dispatch({ type: "RESET" });
    setSelectedForecastTrancheId("");
    setSelectedForecastTermMonths(12);
    setSelectedMarketBankId("");
    setSelectedSummaryScope("total");
    setResetVersion((version) => version + 1);
  }

  async function handleLeadCapture(payload) {
    const response = await submitLeadPayload({
      contact: payload.contact,
      consent: payload.consent,
      summaryPayload: payload.summaryPayload,
      website: payload.website
    });
    window.dispatchEvent(new CustomEvent("trimrate:lead-capture", { detail: { ...payload, response } }));
    console.info("TrimRate mortgage adviser review requested", { leadId: response.leadId });
    return response;
  }

  function handlePdfGeneration(payload) {
    window.dispatchEvent(new CustomEvent("trimrate:pdf-generation-requested", { detail: payload }));
    console.info("TrimRate PDF generation hook fired", payload);
  }

  function handleSummaryExported(exportType) {
    if (exportType === "lead_form_started" || exportType === "consent_checked") {
      trackEvent(exportType).catch(() => {});
      return;
    }
    trackEvent("summary_exported", { exportType }).catch(() => {});
  }

  return (
    <main className="min-h-screen bg-[#F7F5F0] text-[#1B2A22]">
      <header className="border-b border-[#E2DDD5] bg-white/95">
        <div className="mx-auto grid max-w-5xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#3A6047]/10 p-2 text-[#3A6047]">
              <Home size={24} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-black sm:text-3xl">TrimRate.co.nz</h1>
              <p className="mt-1 max-w-3xl text-sm leading-5 text-[#7B756E]">
                Built by Kiwis for Kiwis, TrimRate shows mortgage repayments, market-rate comparisons, and re-fix scenarios in one place.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href="/calculator" className="inline-flex h-11 items-center rounded-lg px-3 text-sm font-bold text-[#1B2A22] hover:bg-[#F7F5F0]">Calculator</a>
            <a href="/info" className="inline-flex h-11 items-center rounded-lg px-3 text-sm font-bold text-[#1B2A22] hover:bg-[#F7F5F0]">Info</a>
            <a href="/contact" className="inline-flex h-11 items-center rounded-lg px-3 text-sm font-bold text-[#1B2A22] hover:bg-[#F7F5F0]">Contact</a>
            <button
              type="button"
              onClick={resetTool}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#E2DDD5] bg-white px-4 text-sm font-bold text-[#1B2A22] shadow-sm hover:border-[#3A6047]/70 hover:text-[#3A6047]"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Reset
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <LoanBalanceStep
          hasExistingLoan={hasExistingLoan}
          loanSituation={loanSituation}
          isSplitLoan={isSplitLoan}
          loanStructure={loanStructure}
          displayedTranches={displayedTranches}
          normalizedTranches={normalizedTranches}
          dispatch={dispatch}
          updateTranche={updateTranche}
          addTranche={addTranche}
          removeTranche={removeTranche}
        />

        {setupComplete && (
          <section className="space-y-5">
            <div className="rounded-xl border border-[#E2DDD5] bg-white p-4 shadow-[0_12px_34px_rgba(27,42,34,0.06)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[#3A6047]">Repayment view</p>
                  <h2 className="mt-1 text-xl font-black text-[#1B2A22]">{selectedSummaryDetails.title}</h2>
                  <p className="mt-1 text-sm font-medium text-[#7B756E]">{selectedSummaryDetails.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSummaryScope("total")}
                    className={`min-h-10 rounded-lg px-3 text-sm font-black transition ${
                      selectedSummaryScope === "total"
                        ? "bg-[#3A6047] text-white shadow-sm"
                        : "border border-[#E2DDD5] bg-[#F7F5F0] text-[#7B756E] hover:bg-white hover:text-[#1B2A22]"
                    }`}
                  >
                    Total mortgage
                  </button>
                  {forecastTranches.map((tranche) => (
                    <button
                      key={tranche.id}
                      type="button"
                      onClick={() => setSelectedSummaryScope(tranche.id)}
                      className={`min-h-10 rounded-lg px-3 text-sm font-black transition ${
                        selectedSummaryScope === tranche.id
                          ? "bg-[#3A6047] text-white shadow-sm"
                          : "border border-[#E2DDD5] bg-[#F7F5F0] text-[#7B756E] hover:bg-white hover:text-[#1B2A22]"
                      }`}
                    >
                      Part {tranche.index}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <Stat
                label={selectedSummaryDetails.repaymentLabel}
                value={selectedSummaryDetails.repaymentValue}
                sub={selectedSummaryDetails.repaymentSub}
                icon={Banknote}
              />
              <Stat
                label={selectedSummaryDetails.principalLabel}
                value={selectedSummaryDetails.principalValue}
                sub={selectedSummaryDetails.principalSub}
                icon={SlidersHorizontal}
              />
              <Stat
                label={selectedSummaryDetails.interestLabel}
                value={selectedSummaryDetails.interestValue}
                sub={selectedSummaryDetails.interestSub}
                icon={CalendarClock}
              />
              <Stat
                label={selectedSummaryDetails.totalLabel}
                value={selectedSummaryDetails.totalValue}
                sub={selectedSummaryDetails.totalSub}
                icon={CalendarClock}
              />
            </div>

            <RepaymentBreakdownTable
              primaryFrequency={primaryFrequency}
              repaymentFrequencyLabel={repaymentFrequencyLabel}
              hasMixedRepaymentFrequencies={hasMixedRepaymentFrequencies}
              summary={summary}
              tranchesWithPayments={tranchesWithPayments}
            />

            <RepaymentSummaryStep
              primaryFrequency={primaryFrequency}
              repaymentFrequencyLabel={repaymentFrequencyLabel}
              repaymentFrequencyNote={repaymentFrequencyNote}
              summary={summary}
              modelRate={modelRate}
              modelYears={modelYears}
              salaryIncome={salaryIncome}
              salaryAmount={salaryAmount}
              repaymentToIncome={repaymentToIncome}
              cashAfterRepayment={netCash.remainingCash}
              dtiRatio={dtiRatio}
              dti={dti}
              dispatch={dispatch}
            />

            <MarketRateComparisonStep
              bankOptions={marketBankOptions}
              marketRateRows={averageMarketRateRows}
              marketRates={marketRates}
              selectedBankId={selectedMarketBankId}
              setSelectedBankId={setSelectedMarketBankId}
            />

            {shouldShowRefix && <RateStressStep
              forecastRows={forecastRows}
              forecastTranches={forecastTranches}
              selectedForecastTranche={selectedForecastTranche}
              selectedForecastTrancheId={selectedForecastTrancheId}
              selectedForecastFrequency={selectedForecastFrequency}
              selectedForecastPayment={selectedForecastPayment}
              selectedForecastRow={selectedForecastRow}
              scenarioLabel={refixScenarioView.scenarioLabel}
              selectedForecastTermMonths={selectedForecastTermMonths}
              setSelectedForecastTermMonths={setSelectedForecastTermMonths}
              setSelectedForecastTrancheId={setSelectedForecastTrancheId}
              updateTranche={updateTranche}
            />}

            <OptimizationStep
              extraPayment={extraPayment}
              outgoingCosts={outgoingCosts}
              interestOnlyYears={interestOnlyYears}
              payoffRows={payoffRows}
              primaryFrequency={primaryFrequency}
              netCash={netCash}
              summary={summary}
              dispatch={dispatch}
              nudgeExtra={nudgeExtra}
            />

            <ExecutiveSummaryLeadStep
              summaryContent={summaryContent}
              summaryPayloadBase={summaryPayloadBase}
              serializedState={serializedMortgageState}
              loanAmount={loanAmount}
              currentRepayment={summary.repayment}
              cashAfterMortgage={netCash.remainingCash}
              extraPayment={toPositive(extraPayment)}
              monthlyCost={paymentToAnnual(summary.repayment, primaryFrequency) / 12}
              dtiRatio={dtiRatio}
              repaymentToIncome={repaymentToIncome}
              marketRateRows={marketRateRows}
              trancheForecasts={trancheForecasts}
              averageFixedRates={averageFixedRates}
              variableOnly={variableOnly}
              onSubmitLead={handleLeadCapture}
              onPdfRequested={handlePdfGeneration}
              onSummaryExported={handleSummaryExported}
              resetVersion={resetVersion}
            />
          </section>
        )}
      </div>

      <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs leading-5 text-[#7B756E] sm:px-6 lg:px-8">
        Educational model only. Mortgage-rate comparisons use market data where available, while forecasts are modelling
        assumptions. Confirm final rates and tax treatment with qualified advisers before making a decision.
        <span className="mt-2 block">
          <a className="underline hover:text-[#3A6047]" href="/privacy-policy">Privacy Policy</a>
          <span className="px-2">·</span>
          <a className="underline hover:text-[#3A6047]" href="/terms-of-use">Terms of Use</a>
        </span>
      </footer>
    </main>
  );
}

function Root() {
  if (window.location.pathname === "/info") return <InfoPage />;
  if (window.location.pathname === "/contact") return <ContactPage />;
  if (window.location.pathname === "/privacy-policy") return <LegalPage type="privacy" />;
  if (window.location.pathname === "/terms-of-use") return <LegalPage type="terms" />;
  return <App />;
}

createRoot(document.getElementById("root")).render(<Root />);

function trackOnce(ref, eventName, payload = {}) {
  if (ref.current.has(eventName)) return;
  ref.current.add(eventName);
  trackEvent(eventName, payload).catch(() => {});
}
