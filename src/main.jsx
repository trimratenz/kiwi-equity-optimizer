import React, { useEffect, useMemo, useReducer, useState } from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle, Banknote, CalendarClock, Home, RefreshCw, SlidersHorizontal } from "lucide-react";
import "./index.css";
import { LoanBalanceStep } from "./components/LoanBalanceStep";
import { LoanStructureStep } from "./components/LoanStructureStep";
import { MarketRateComparisonStep } from "./components/MarketRateComparisonStep";
import { OptimizationStep } from "./components/OptimizationStep";
import { RateStressStep } from "./components/RateStressStep";
import { RepaymentSummaryStep } from "./components/RepaymentSummaryStep";
import { Stat } from "./components/ui";
import {
  FREQUENCY_CONFIG,
  MARKET_RATE_SNAPSHOT,
  calculatePayment,
  currency,
  forecastRefixRows,
  marketTermMonths,
  monthsLabel,
  percent,
  summarizeLoan,
  trancheRows,
  weightedLoanSnapshot
} from "./financialModel";
import { getInitialMortgageFormState, mortgageFormReducer, toNumber, toPositive } from "./mortgageFormState";
import { fetchMortgageRates } from "./ratesApi";

const FORM_STORAGE_KEY = "kiwi-equity-optimiser-form";

function getStoredMortgageFormState() {
  const initialState = getInitialMortgageFormState();

  try {
    const stored = window.localStorage.getItem(FORM_STORAGE_KEY);
    if (!stored) return initialState;

    const parsed = JSON.parse(stored);
    return {
      ...initialState,
      ...parsed,
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
  const [marketRates, setMarketRates] = useState({
    rates: MARKET_RATE_SNAPSHOT.rates,
    rawRecords: [],
    captured: MARKET_RATE_SNAPSHOT.captured,
    source: MARKET_RATE_SNAPSHOT.source,
    note: MARKET_RATE_SNAPSHOT.note,
    url: MARKET_RATE_SNAPSHOT.url,
    status: "idle",
    error: ""
  });
  const { loanBalance, loanStructure, salaryIncome, extraPayment, interestOnlyYears, tranches } = formState;

  useEffect(() => {
    window.localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formState));
  }, [formState]);

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
  const currentPayment = calculatePayment(effectiveLoan, modelRate, modelYears, primaryFrequency);
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
  const selectedForecastTranche = forecastTranches.find((tranche) => tranche.id === selectedForecastTrancheId) ?? forecastTranches[0];
  const selectedForecastFrequency = selectedForecastTranche?.frequency || primaryFrequency;
  const selectedForecastPayment = selectedForecastTranche
    ? calculatePayment(
        selectedForecastTranche.amount,
        selectedForecastTranche.rate,
        selectedForecastTranche.termYears,
        selectedForecastFrequency
      )
    : currentPayment;
  const summary = useMemo(
    () =>
      summarizeLoan({
        principal: effectiveLoan,
        annualRate: modelRate,
        years: modelYears,
        frequency: primaryFrequency,
        extraPayment: toPositive(extraPayment),
        interestOnlyYears: toPositive(interestOnlyYears)
      }),
    [effectiveLoan, modelRate, modelYears, primaryFrequency, extraPayment, interestOnlyYears]
  );
  const forecastRows = useMemo(
    () =>
      forecastRefixRows({
        principal: selectedForecastTranche?.amount ?? effectiveLoan,
        currentRate: selectedForecastTranche?.rate ?? modelRate,
        years: selectedForecastTranche?.termYears ?? modelYears,
        frequency: selectedForecastFrequency,
        currentPayment: selectedForecastPayment,
        fixedEndsInMonths: selectedForecastTranche?.fixedMonths ?? 0,
        marketRates: marketRates.rates
      }),
    [
      effectiveLoan,
      modelRate,
      modelYears,
      selectedForecastFrequency,
      selectedForecastPayment,
      selectedForecastTranche,
      marketRates.rates
    ]
  );
  const selectedForecastRow =
    forecastRows.find((row) => row.months === selectedForecastTermMonths) ?? forecastRows.find((row) => row.months === 12) ?? forecastRows[0];
  const selectedForecastScenario = selectedForecastRow?.scenarios.find((scenario) => scenario.key === "base") ?? selectedForecastRow?.scenarios[0];
  const paymentDelta = selectedForecastScenario ? selectedForecastScenario.repaymentChange : 0;
  const tranchesWithPayments = useMemo(() => trancheRows(mathTranches, primaryFrequency), [mathTranches, primaryFrequency]);
  const payoffRows = summary.standard.rows.map((row, index) => ({
    year: row.year,
    standardDebt: row.debt,
    fasterDebt: summary.accelerated.rows[index]?.debt ?? summary.accelerated.rows.at(-1)?.debt ?? 0
  }));
  const salaryAmount = toPositive(salaryIncome);
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
    const comparisonSource = selectedBankRate?.institution ?? "5-bank average";
    const marketRepayment = calculatePayment(tranche.amount, comparisonRate, tranche.termYears, tranche.frequency);
    const currentRepayment = calculatePayment(tranche.amount, tranche.rate, tranche.termYears, tranche.frequency);

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
      marketRepayment
    };
  });

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
    dispatch({ type: "RESET" });
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
                Built by Kiwis for Kiwis, TrimRate helps you outsmart the OCR, see where rates are heading, and slash your interest to trim what you pay.
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
                label={`${FREQUENCY_CONFIG[primaryFrequency].label} repayment`}
                value={currency(summary.repayment)}
                sub={`At blended ${percent(modelRate)} over ${modelYears} years`}
                icon={Banknote}
              />
              <Stat label="Effective balance" value={currency(effectiveLoan)} sub="After offset/redraw" icon={SlidersHorizontal} />
              <Stat label="Interest you'll pay" value={currency(summary.totalInterest)} sub="Current schedule" icon={CalendarClock} />
              <Stat
                label="Next forecast re-fix"
                value={`${paymentDelta >= 0 ? "+" : ""}${currency(paymentDelta)}`}
                sub={`${selectedForecastTranche ? `Loan part ${selectedForecastTranche.index}` : "Loan"} at ${
                  selectedForecastRow?.refixPointLabel ?? "re-fix"
                }: ${percent(selectedForecastScenario?.forecastMortgageRate ?? 0)}`}
                icon={AlertTriangle}
              />
            </div>

            <RepaymentSummaryStep
              primaryFrequency={primaryFrequency}
              summary={summary}
              modelRate={modelRate}
              modelYears={modelYears}
              salaryIncome={salaryIncome}
              salaryAmount={salaryAmount}
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
              selectedForecastTermMonths={selectedForecastTermMonths}
              setSelectedForecastTermMonths={setSelectedForecastTermMonths}
              setSelectedForecastTrancheId={setSelectedForecastTrancheId}
            />

            <OptimizationStep
              extraPayment={extraPayment}
              interestOnlyYears={interestOnlyYears}
              payoffRows={payoffRows}
              primaryFrequency={primaryFrequency}
              summary={summary}
              dispatch={dispatch}
              nudgeExtra={nudgeExtra}
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
