# TrimRate.co.nz

A local React app for helping New Zealand property owners understand mortgage setup, repayment visibility, rate-change risk, and next-step optimisation.

## Run locally

```powershell
cd kiwi-equity-optimizer
npm install
npm run dev
```

Then open the Vite URL shown in the terminal, usually `http://localhost:5173`.

## QA checks

```powershell
npm run test:form
npm run build
```

The form-state smoke test validates that adding another loan part preserves existing user-entered values. The tranche form uses a reducer in `src/mortgageFormState.js` so array updates are immutable and stable IDs are kept separate from render order.

## What is included

- Mortgage repayments for weekly, fortnightly, and monthly schedules.
- A step-by-step questionnaire that starts with: "How much loan do you have?"
- Editable numeric fields that can be fully cleared before retyping.
- One loan part by default, with an explicit single-loan vs split-loan choice.
- Split loan part balances are always user-entered and are never auto-filled from the total loan.
- Fixed and variable tranche modelling with repayment frequency, loan term, fixed term, fixed expiry, and offset/redraw balance.
- Local fallback OCR forecast feed shaped around RBNZ, New Zealand Treasury, and permissioned bank economist review inputs.
- Loan-part re-fix forecast comparison using each part's fixed-end month and projected remaining balance.
- Bank-rate estimates from OCR plus retail mortgage margin assumptions.
- Faster payoff simulator showing interest saved and time saved.
- Rate comparison views for 6-month, 1-year, 2-year, and floating estimates.
- Market-rate comparison using a local bank-rate worksheet, with Rates API treated as unverified unless a future backend can confirm it against bank sources.
- Income comparison showing repayment as a share of the user's income per chosen repayment frequency.
- Tranche breakdown table with repayment and interest totals.
- Recharts line and bar visualizations.

## UX flow

1. Loan balance: ask one prominent question at the top of the page.
2. Loan setup: immediately collect whether the loan is single or split, tranche rate, type, term, repayment frequency, fixed term, fixed expiry, optional offset/redraw balance, and explicit split balances only when needed.
3. Conditional transition: all result sections stay hidden until the loan setup is complete and any tranche split balances match the total loan.
4. What will I pay?: show repayment, effective balance, total interest, total paid, income comparison, and each tranche's repayment.
5. How does my rate compare?: compare the user's blended rate with an average market-rate snapshot.
6. What could I pay when I re-fix?: select a loan part, project its balance at the fixed-end month, then compare forecast OCR, estimated mortgage rates, and repayment changes across new fixed-term options.
7. How can I improve this?: let users test extra repayments and interest-only periods, then show interest saved and time saved.

## Notes

The OCR feed is deliberately local and simulated so the app can run without a backend. In production, replace `OCR_FORECAST_SOURCES` in `src/financialModel.js` with a backend API that uses official, licensed, or manually reviewed source updates. Avoid scraping sites whose terms prohibit systematic extraction or commercial reuse.

Current mortgage-rate comparisons are based on `src/localMortgageRateWorksheet.js`. The app can call `https://ratesapi.nz/api/v1/mortgage-rates` through `src/ratesApi.js`, but Rates API currently states that its data is sourced from interest.co.nz and is not guaranteed. When that warning is present, TrimRate keeps using the local worksheet and asks users to confirm rates directly with lenders before re-fixing.
