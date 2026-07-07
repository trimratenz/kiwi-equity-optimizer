import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Banknote, CalendarClock, Home, RefreshCw, SlidersHorizontal } from "lucide-react";
import "./index.css";
import { submitLeadPayload, trackCalculatorRun, trackEvent } from "./analyticsClient";
import { LoanBalanceStep } from "./components/LoanBalanceStep";
import { ExecutiveSummaryLeadStep } from "./components/ExecutiveSummaryLeadStep";
import { LoanStructureStep } from "./components/LoanStructureStep";
import { MarketRateComparisonStep } from "./components/MarketRateComparisonStep";
import { OptimizationStep } from "./components/OptimizationStep";
import { RateStressStep } from "./components/RateStressStep";
import { RepaymentSummaryStep } from "./components/RepaymentSummaryStep";
import { Stat } from "./components/ui";
import {
  FREQUENCY_CONFIG,
  MARKET_RATE_SNAPSHOT,
  buildPlainEnglishSummary,
  buildRefixScenarioView,
  calculateLoanPartRepayment,
  currency,
  dtiAssessment,
  debtToIncomeRatio,
  marketTermMonths,
  netCashPosition,
  monthsLabel,
  percent,
  repaymentToIncomeRatio,
  remainingPrincipalAndInterestToFixedEnd,
  summarizeMortgage,
  trancheRows,
  weightedLoanSnapshot
} from "./financialModel";
import { getInitialMortgageFormState, mortgageFormReducer, toNumber, toPositive } from "./mortgageFormState";
import { fetchMortgageRates } from "./ratesApi";
import { DEFAULT_OCR_FORECAST_SNAPSHOT, createCalculationRun } from "./snapshotLayer.js";
import { buildSummaryPayload, monthlyEquivalent } from "./summaryPayload.js";

const FORM_STORAGE_KEY = "trimratenz-form";

function getStoredMortgageFormState() {
  const initialState = getInitialMortgageFormState();

  try {
    const stored = window.localStorage.getItem(FORM_STORAGE_KEY);
    if (!stored) return initialState;

    const parsed = JSON.parse(stored);
    return {
      ...initialState,
      ...parsed,
      extraPayment: parsed.extraPayment === "100" ? "" : parsed.extraPayment ?? initialState.extraPayment,
      outgoingCosts: parsed.outgoingCosts ?? initialState.outgoingCosts,
      tranches: Array.isArray(parsed.tranches) && parsed.tranches.length > 0 ? parsed.tranches : initialState.tranches
    };
  } catch {
    return initialState;
  }
}

function App() {
  const [formState, dispatch] = useReducer(mortgageFormReducer, undefined, getStoredMortgageFormState);
  const [selectedForecastTrancheId, setSelectedForecastTrancheId] = useState("");
  const [selectedForecastTermMonths, setSelectedForecastTermMonths] = useState(12);
  const [selectedMarketBankId, setSelectedMarketBankId] = useState("");
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
  const { loanBalance, loanStructure, salaryIncome, extraPayment, outgoingCosts, interestOnlyYears, tranches } = formState;

  useEffect(() => {
    window.localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formState));
  }, [formState]);

  useEffect(() => {
    trackOnce(trackedEvents, "page_view");
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

  useEffect(() => {
    (marketRates.warnings || []).forEach((warning) => {
      console.warn("TrimRate data warning", warning);
    });
  }, [marketRates.warnings]);

  const loanAmount = toPositive(loanBalance);
  const isSplitLoan = loanStructure === "split";
  const displayedTranches = useMemo(() => (isSplitLoan ? tranches : tranches.slice(0, 1)), [isSplitLoan, tranches]);
  const normalizedTranches = useMemo(
    () =>
      displayedTranches.map((tranche) => ({
        ...tranche,
        amount: isSplitLoan ? toPositive(tranche.amount) : loanAmount,
        rate: toNumber(tranche.rate),
        termYears: Math.max(toNumber(tranche.termYears), 1),
        fixedTermMonths: tranche.type === "Fixed" ? Math.max(toNumber(tranche.fixedTermMonths || "12"), 0) : 0,
        fixedMonths: tranche.type === "Fixed" ? Math.max(toNumber(tranche.fixedMonths), 0) : 0,
        offsetBalance: Math.min(toPositive(tranche.offsetBalance), isSplitLoan ? toPositive(tranche.amount) : loanAmount)
      })),
    [displayedTranches, isSplitLoan, loanAmount]
  );
  const mathTranches = useMemo(
    () =>
      normalizedTranches.map((tranche) => ({
        ...tranche,
        amount: Math.max(tranche.amount - tranche.offsetBalance, 0)
      })),
    [normalizedTranches]
  );

  const trancheTotal = normalizedTranches.reduce((sum, tranche) => sum + tranche.amount, 0);
  const effectiveLoan = mathTranches.reduce((sum, tranche) => sum + tranche.amount, 0);
  const splitMatches = !isSplitLoan || Math.abs(trancheTotal - loanAmount) <= 1;
  const allTranchesComplete = normalizedTranches.every(
    (tranche) =>
      tranche.amount > 0 &&
      tranche.rate > 0 &&
      tranche.termYears > 0 &&
      tranche.frequency &&
      tranche.type &&
      (tranche.type === "Variable" || tranche.fixedMonths >= 0)
  );
  const setupComplete = loanAmount > 0 && allTranchesComplete && splitMatches;
  const completionItems = [
    { label: "Loan balance", done: loanAmount > 0 },
    { label: "Rate entered", done: normalizedTranches.every((tranche) => tranche.rate > 0) },
    { label: "Term checked", done: normalizedTranches.every((tranche) => tranche.termYears > 0) },
    { label: isSplitLoan ? "Split matches" : "Single loan", done: splitMatches }
  ];

  const loan = useMemo(() => weightedLoanSnapshot(mathTranches, "Monthly"), [mathTranches]);
  const modelRate = loan.weightedRate || 0;
  const modelYears = Math.max(1, Math.round(loan.weightedTerm || 30));
  const primaryFrequency = normalizedTranches[0]?.frequency || "Monthly";
  const repaymentFrequencies = useMemo(
    () => [...new Set(normalizedTranches.map((tranche) => tranche.frequency).filter(Boolean))],
    [normalizedTranches]
  );
  const hasMixedRepaymentFrequencies = repaymentFrequencies.length > 1;
  const repaymentFrequencyLabel = hasMixedRepaymentFrequencies ? `${primaryFrequency} Equivalent` : primaryFrequency;
  const repaymentFrequencyNote = hasMixedRepaymentFrequencies
    ? `Annualised from ${repaymentFrequencies.join(" + ")} loan-part repayments`
    : `Summed loan-part schedules; weighted rate ${percent(modelRate)}`;
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
        ocrSnapshot: DEFAULT_OCR_FORECAST_SNAPSHOT
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
      marketRates.snapshotId
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
  const marketRateRows = forecastTranches.map((tranche) => {
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
      (record) => record.institutionId === selectedMarketBankId && record.termInMonths === matchedMonths
    );
    const lowestRate = marketRates.rawRecords
      .filter((record) => record.termInMonths === matchedMonths)
      .sort((a, b) => a.rate - b.rate)[0];
    const comparisonRate = selectedBankRate?.rate ?? closestRate.rate;
    const comparisonSource = selectedBankRate?.institution ?? "Five-bank average";
    const marketRepayment = calculateLoanPartRepayment({ ...tranche, rate: comparisonRate }, tranche.frequency);
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
      lowestBank: lowestRate?.institution ?? "Unavailable",
      lowestRate: lowestRate?.rate ?? null,
      currentRate: tranche.rate,
      difference: tranche.rate ? tranche.rate - comparisonRate : 0,
      currentRepayment,
      marketRepayment,
      repaymentDifference
    };
  });
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
        extraPayment: toPositive(extraPayment),
        summary,
        periodIncome: salaryAmount,
        repaymentToIncome,
        cashAfterRepayment: netCash.remainingCash,
        cashAfterOutgoings: netCash.cashAfterOutgoings,
        marketRateRows
      }),
    [
      forecastTranches,
      loanAmount,
      modelRate,
      primaryFrequency,
      selectedForecastTranche,
      selectedForecastRow,
      selectedForecastScenario,
      extraPayment,
      summary,
      salaryAmount,
      repaymentToIncome,
      netCash.remainingCash,
      netCash.cashAfterOutgoings,
      marketRateRows
    ]
  );
  const serializedMortgageState = useMemo(
    () => ({
      steps: {
        loanBalance: {
          loanBalance,
          loanAmount,
          effectiveLoan
        },
        loanStructure: {
          loanStructure,
          tranches: normalizedTranches,
          offsetAdjustedTranches: mathTranches,
          splitMatches
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
        ocrForecastSnapshotId: DEFAULT_OCR_FORECAST_SNAPSHOT.id,
        ocrForecastLastRefreshed: DEFAULT_OCR_FORECAST_SNAPSHOT.lastRefreshed
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
        ocrForecastSnapshot: DEFAULT_OCR_FORECAST_SNAPSHOT
      }),
      rawFormState: formState
    }),
    [
      loanBalance,
      loanAmount,
      effectiveLoan,
      loanStructure,
      normalizedTranches,
      mathTranches,
      splitMatches,
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
      formState
    ]
  );
  const summaryPayloadBase = useMemo(
    () =>
      buildSummaryPayload({
        ratesSnapshotId: marketRates.snapshotId,
        ocrSnapshotId: DEFAULT_OCR_FORECAST_SNAPSHOT.id,
        inputs: {
          loanBalance: loanAmount,
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
            effectiveBalance: mathTranches[index]?.amount ?? tranche.amount,
            offsetBalance: tranche.offsetBalance,
            rate: tranche.rate,
            termYears: tranche.termYears,
            type: tranche.type,
            repaymentFrequency: tranche.frequency,
            fixedTermMonths: tranche.fixedTermMonths,
            fixedEndsInMonths: tranche.fixedMonths
          }))
        },
        outputs: {
          currentMonthlyRepayment: monthlyEquivalent(summary.repayment, primaryFrequency),
          currentRepaymentPerSelectedPeriod: summary.repayment,
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
      trackCalculatorRun(summaryPayloadBase);
    }
  }, [loanStructure, normalizedTranches.length, setupComplete, summaryPayloadBase]);

  function updateTranche(id, patch) {
    Object.entries(patch).forEach(([field, value]) => {
      dispatch({
        type: "UPDATE_TRANCHE",
        id,
        field,
        value,
        decimal: ["amount", "rate", "termYears", "fixedTermMonths", "fixedMonths", "offsetBalance"].includes(field)
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
          <button
            type="button"
            onClick={resetTool}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#E2DDD5] bg-white px-4 text-sm font-bold text-[#1B2A22] shadow-sm hover:border-[#3A6047]/70 hover:text-[#3A6047]"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Reset
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <LoanBalanceStep loanBalance={loanBalance} hasLoanBalance={loanAmount > 0} dispatch={dispatch} />

        <LoanStructureStep
          isSplitLoan={isSplitLoan}
          loanAmount={loanAmount}
          loanStructure={loanStructure}
          displayedTranches={displayedTranches}
          normalizedTranches={normalizedTranches}
          trancheTotal={trancheTotal}
          splitMatches={splitMatches}
          setupComplete={setupComplete}
          completionItems={completionItems}
          dispatch={dispatch}
          updateTranche={updateTranche}
          addTranche={addTranche}
          removeTranche={removeTranche}
        />

        {setupComplete && (
          <section className="space-y-5">
            <div className="grid gap-3 md:grid-cols-4">
              <Stat
                label={`${repaymentFrequencyLabel} Repayment`}
                value={currency(summary.repayment)}
                sub={repaymentFrequencyNote}
                icon={Banknote}
              />
              <Stat label="Effective balance" value={currency(effectiveLoan)} sub="After offset/redraw" icon={SlidersHorizontal} />
              <Stat label="Interest you'll pay" value={currency(summary.totalInterest)} sub="Current schedule" icon={CalendarClock} />
              <Stat
                label="Remaining P&I to fixed end"
                value={currency(remainingFixedPayments.total)}
                sub={`${currency(remainingFixedPayments.principal)} principal + ${currency(
                  remainingFixedPayments.interest
                )} interest across ${remainingFixedPayments.periodsRemaining} scheduled repayments`}
                icon={CalendarClock}
              />
            </div>

            <RepaymentSummaryStep
              primaryFrequency={primaryFrequency}
              repaymentFrequencyLabel={repaymentFrequencyLabel}
              repaymentFrequencyNote={repaymentFrequencyNote}
              hasMixedRepaymentFrequencies={hasMixedRepaymentFrequencies}
              summary={summary}
              modelRate={modelRate}
              modelYears={modelYears}
              salaryIncome={salaryIncome}
              salaryAmount={salaryAmount}
              repaymentToIncome={repaymentToIncome}
              cashAfterRepayment={netCash.remainingCash}
              dtiRatio={dtiRatio}
              dti={dti}
              tranchesWithPayments={tranchesWithPayments}
              dispatch={dispatch}
            />

            <MarketRateComparisonStep
              bankOptions={marketBankOptions}
              marketRateRows={marketRateRows}
              marketRates={marketRates}
              selectedBankId={selectedMarketBankId}
              setSelectedBankId={setSelectedMarketBankId}
            />

            <RateStressStep
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
            />

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
              onSubmitLead={handleLeadCapture}
              onPdfRequested={handlePdfGeneration}
              onSummaryExported={handleSummaryExported}
            />
          </section>
        )}
      </div>

      <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs leading-5 text-[#7B756E] sm:px-6 lg:px-8">
        Educational model only. Mortgage-rate comparisons use market data where available, while forecasts are modelling
        assumptions. Confirm final rates and tax treatment with qualified advisers before making a decision.
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);

function trackOnce(ref, eventName, payload = {}) {
  if (ref.current.has(eventName)) return;
  ref.current.add(eventName);
  trackEvent(eventName, payload).catch(() => {});
}
