export function getInitialMortgageFormState() {
  return {
    loanBalance: "",
    loanStructure: "single",
    salaryIncome: "",
    extraPayment: "",
    outgoingCosts: "",
    interestOnlyYears: "0",
    ocrScenario: "Forecast",
    tranches: [createTranche()]
  };
}

export function createTrancheId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `tranche-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createTranche(overrides = {}) {
  return {
    id: createTrancheId(),
    amount: "",
    rate: "",
    termYears: "30",
    fixedTermMonths: "12",
    fixedMonths: "12",
    offsetBalance: "0",
    frequency: "Monthly",
    type: "Fixed",
    ...overrides
  };
}

export function normalizeDecimalInput(value) {
  const next = String(value ?? "").replace(/,/g, "").trim();
  if (next === "") return "";
  if (/^\d*\.?\d*$/.test(next)) return next;
  return null;
}

export function toNumber(value) {
  return Number(String(value ?? "").replace(/,/g, "")) || 0;
}

export function toPositive(value) {
  return Math.max(toNumber(value), 0);
}

export function setDecimalValue(value) {
  const normalized = normalizeDecimalInput(value);
  return normalized === null ? undefined : normalized;
}

export function mortgageFormReducer(state, action) {
  switch (action.type) {
    case "SET_FIELD": {
      const value = action.decimal ? setDecimalValue(action.value) : action.value;
      if (value === undefined) return state;
      return { ...state, [action.field]: value };
    }

    case "UPDATE_TRANCHE": {
      const value = action.decimal ? setDecimalValue(action.value) : action.value;
      if (value === undefined) return state;
      return {
        ...state,
        tranches: state.tranches.map((tranche) =>
          tranche.id === action.id ? { ...tranche, [action.field]: value } : tranche
        )
      };
    }

    case "ADD_TRANCHE": {
      const existingTranches = state.tranches.map((tranche) => ({ ...tranche }));

      // State preservation fix: appending a loan part never rewrites existing user inputs.
      // The total loan balance remains only the headline total; split amounts are explicit.
      return {
        ...state,
        loanStructure: "split",
        tranches: [...existingTranches, createTranche()]
      };
    }

    case "REMOVE_TRANCHE": {
      if (state.tranches.length === 1) return state;
      return {
        ...state,
        tranches: state.tranches.filter((tranche) => tranche.id !== action.id)
      };
    }

    case "RESET":
      return getInitialMortgageFormState();

    default:
      return state;
  }
}
