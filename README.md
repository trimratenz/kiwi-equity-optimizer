# TrimRate.co.nz

A local React app for helping New Zealand property owners understand mortgage setup, repayment visibility, rate-change risk, and next-step optimisation.

## Run locally

```powershell
cd trimratenz
npm install
.\start-dev.ps1
```

Then open `http://127.0.0.1:5173/`. The launcher is idempotent: if TrimRate is already running, it leaves it alone; if not, it starts Vite on the fixed port and waits until the URL responds.

## QA checks

```powershell
npm test
npm run build
```

The test suite covers form state, calculation outputs, re-fix scenario selection, snapshot handling, summary payloads, and backend analytics/lead privacy boundaries.

## Backend, analytics, and admin

TrimRate includes a small Node HTTP backend using file-backed JSON collections under `data/`. The public app can only write analytics, calculator runs, and consented leads. Lead reads, dashboard metrics, and CSV export are only available through authenticated admin routes.

```powershell
$env:ADMIN_USERNAME="harry"
$env:ADMIN_PASSWORD="replace-with-a-long-random-password"
$env:ADMIN_TOKEN="replace-with-a-long-random-token"
npm run build
npm run server
```

Open `http://127.0.0.1:8787/admin` for the admin dashboard and sign in with the Basic Auth username/password. `ADMIN_TOKEN` is for authenticated API calls such as scripted exports.

For Vite development against a separately running backend, set:

```powershell
$env:VITE_API_BASE_URL="http://127.0.0.1:8787"
```

Collections created by the backend:

- `visitors`
- `sessions`
- `events`
- `step_completions`
- `calculator_runs`
- `rate_snapshots`
- `ocr_snapshots`
- `leads`
- `lead_exports`
- `admin_users`

## What is included

- Mortgage repayments for weekly, fortnightly, and monthly schedules.
- A step-by-step questionnaire that starts with: "How much do you owe?"
- Editable numeric fields that can be fully cleared before retyping.
- One loan part by default, with an explicit single-loan vs split-loan choice.
- Split loan part balances are always user-entered and are never auto-filled from the total loan.
- Fixed and variable tranche modelling with repayment frequency, loan term, fixed term, fixed expiry, and offset/redraw balance.
- Local OCR forecast settings shaped around the RBNZ Monetary Policy Statement OCR track.
- Loan-part re-fix forecast comparison using each part's fixed-end month, projected remaining balance, selectable fixed term, and Optimistic/Base/Conservative outlook scenarios.
- Bank-rate estimates from OCR plus retail mortgage margin assumptions.
- Faster payoff simulator showing interest saved and time saved.
- Rate comparison views for 6-month, 1-year, 2-year, and floating estimates.
- Market-rate comparison using Rates API major-bank averages for ANZ, ASB, BNZ, Kiwibank, and Westpac, with cached fallback rates if the live request is unavailable.
- Income comparison showing repayment as a share of the user's income per chosen repayment frequency.
- Tranche breakdown table with repayment and interest totals.
- Recharts line and bar visualizations.

## UX flow

1. Loan balance: ask one prominent question at the top of the page.
2. Loan setup: immediately collect whether the loan is single or split, tranche rate, type, term, repayment frequency, fixed term, fixed expiry, optional offset/redraw balance, and explicit split balances only when needed.
3. Conditional transition: all result sections stay hidden until the loan setup is complete and any tranche split balances match the total loan.
4. What will I pay?: show repayment, effective balance, total interest, total paid, income comparison, and each tranche's repayment.
5. How does my rate compare?: compare each loan part with an average market-rate snapshot; weighted average rate is display-only.
6. What could I pay when I re-fix?: select a loan part and one new fixed term, then compare Optimistic, Base case, and Conservative repayments together.
7. How can I improve this?: let users test extra repayments and interest-only periods, then show interest saved and time saved.

## Notes

Rate and OCR data are modelled through explicit snapshots so calculation runs can reference the exact bank-rate and OCR source used. Review the OCR snapshot after RBNZ OCR decisions or Monetary Policy Statements, and confirm final lender rates directly before re-fixing.

Current mortgage-rate comparisons call `https://ratesapi.nz/api/v1/mortgage-rates` through `src/ratesApi.js`. The app filters the feed to ANZ, ASB, BNZ, Kiwibank, and Westpac, excludes obvious green/top-up/offset products from fixed-rate averages, and falls back to a cached major-bank rate set if the live request fails. Confirm final rates directly with lenders before re-fixing.
