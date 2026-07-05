import { marketTermMonths } from "./financialModel";

export const LOCAL_BANK_RATE_ROWS = [
  {
    bank: "ANZ",
    product: "Special",
    sourceUrl: "https://www.anz.co.nz/rates-fees-agreements/home-loans/",
    verifiedStatus: "manual-review-required",
    rates: [
      { term: "6 months", rate: 4.69 },
      { term: "1 year", rate: 4.65 },
      { term: "18 months", rate: 5.19 },
      { term: "2 years", rate: 5.29 },
      { term: "3 years", rate: 5.49 },
      { term: "Floating", rate: 5.79 }
    ]
  },
  {
    bank: "ASB",
    product: "Fixed",
    sourceUrl: "https://www.asb.co.nz/home-loans-mortgages/interest-rates-fees.html",
    verifiedStatus: "manual-review-required",
    rates: [
      { term: "6 months", rate: 4.69 },
      { term: "1 year", rate: 4.65 },
      { term: "18 months", rate: 5.09 },
      { term: "2 years", rate: 5.25 },
      { term: "3 years", rate: 5.29 },
      { term: "4 years", rate: 5.49 },
      { term: "5 years", rate: 5.59 },
      { term: "Floating", rate: 5.79 }
    ]
  },
  {
    bank: "BNZ",
    product: "Fixed",
    sourceUrl: "https://www.bnz.co.nz/personal-banking/home-loans/calculators-rates-and-fees/rates-and-fees",
    verifiedStatus: "manual-review-required",
    rates: [
      { term: "6 months", rate: 4.69 },
      { term: "1 year", rate: 4.79 },
      { term: "18 months", rate: 5.09 },
      { term: "2 years", rate: 5.29 },
      { term: "3 years", rate: 5.29 },
      { term: "4 years", rate: 5.39 },
      { term: "5 years", rate: 5.49 },
      { term: "Floating", rate: 5.84 }
    ]
  },
  {
    bank: "Kiwibank",
    product: "Special",
    sourceUrl: "https://www.kiwibank.co.nz/personal-banking/home-loans/rates-and-fees/",
    verifiedStatus: "manual-review-required",
    rates: [
      { term: "6 months", rate: 4.65 },
      { term: "1 year", rate: 4.75 },
      { term: "2 years", rate: 5.19 },
      { term: "3 years", rate: 5.39 },
      { term: "4 years", rate: 5.59 },
      { term: "5 years", rate: 5.69 },
      { term: "Floating", rate: 5.75 }
    ]
  },
  {
    bank: "Westpac",
    product: "Special",
    sourceUrl: "https://www.westpac.co.nz/home-loans-mortgages/options/rates/",
    verifiedStatus: "manual-review-required",
    rates: [
      { term: "6 months", rate: 4.69 },
      { term: "1 year", rate: 4.79 },
      { term: "18 months", rate: 5.09 },
      { term: "2 years", rate: 5.19 },
      { term: "3 years", rate: 5.29 },
      { term: "4 years", rate: 5.39 },
      { term: "5 years", rate: 5.49 },
      { term: "Floating", rate: 5.89 }
    ]
  }
];

const TERM_ORDER = ["6 months", "1 year", "18 months", "2 years", "3 years", "4 years", "5 years", "Floating"];

export const LOCAL_BANK_RATE_WORKSHEET = {
  source: "Local bank-rate worksheet",
  url: "",
  captured: "2026-07-05",
  note:
    "Using a local worksheet because Rates API data is sourced from interest.co.nz and is not guaranteed to match each bank's live website. Treat these as comparison prompts and confirm directly with the lender before re-fixing.",
  verificationStatus: "manual-review-required",
  rows: LOCAL_BANK_RATE_ROWS,
  rates: TERM_ORDER.map((term) => {
    const matchingRates = LOCAL_BANK_RATE_ROWS.flatMap((bankRow) =>
      bankRow.rates.filter((rateRow) => rateRow.term === term).map((rateRow) => rateRow.rate)
    );
    const average = matchingRates.reduce((sum, rate) => sum + rate, 0) / matchingRates.length;

    return {
      term,
      termInMonths: marketTermMonths(term),
      rate: Number(average.toFixed(2)),
      lenderCount: matchingRates.length,
      source: "Local worksheet"
    };
  })
};
