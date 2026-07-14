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

## Production deploy

The frontend is ready for Vercel through the included `vercel.json`:

- Framework preset: Vite
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

Recommended Vercel setup:

1. Push this repo to GitHub.
2. In Vercel, import `trimratenz/kiwi-equity-optimizer`.
3. Keep the default Vite project settings, or let `vercel.json` provide them.
4. Set the production environment variables listed below. Keep `VITE_API_BASE_URL` blank when the frontend and Vercel Functions share this project.

GitHub Actions runs `npm test` and `npm run build` on pushes to `master`/`main` and on pull requests.

## Vercel and Supabase backend MVP

Production APIs are Vercel Functions in `api/`, with Supabase Postgres as the durable store. The legacy file-backed local server remains only for existing local test coverage; do not use it for production hosting.

Required Vercel environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `DATABASE_URL` (reserved for future direct database tooling)
- `CRON_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Apply the SQL migration in `supabase/migrations/202607120001_trimrate_mvp.sql` with the Supabase SQL editor or CLI before deploying. It creates: `market_rates`, `market_rate_snapshots`, `ocr_snapshots`, `adviser_review_requests`, and `analytics_events`.

Vercel Cron is configured in `vercel.json` to refresh market rates daily at 03:00 UTC and review the RBNZ OCR forecast on the first day of each month at 03:15 UTC. Vercel automatically sends the cron secret as an Authorization bearer token. The market provider uses Rates API with a manual five-bank fallback. The OCR job records a monthly review even when the published RBNZ source date is unchanged, while retaining that source date for traceability.

`/admin` is protected with an HttpOnly signed session using `ADMIN_EMAIL` and `ADMIN_PASSWORD`. After deployment, open `https://trimrate.co.nz/admin` and sign in. The dashboard provides summary metrics, raw tables, manual refresh actions, and CSV exports.

For domains, add both `trimrate.co.nz` and `www.trimrate.co.nz` in Vercel, set the DNS records Vercel supplies, and redirect one to the preferred canonical domain in the Vercel domain settings. Test the public APIs, an adviser submission, CSV exports, cron logs, and admin logout after production deployment.

Legal copy is draft content and must be reviewed by a qualified legal professional before production launch.

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

Rate and OCR data are modelled through explicit snapshots so calculation runs can reference the exact bank-rate and OCR source used. The OCR snapshot is reviewed monthly and should also be manually refreshed after an RBNZ OCR decision or Monetary Policy Statement. Confirm final lender rates directly before re-fixing.

Current mortgage-rate comparisons call `https://ratesapi.nz/api/v1/mortgage-rates` through `src/ratesApi.js`. The app filters the feed to ANZ, ASB, BNZ, Kiwibank, and Westpac, excludes obvious green/top-up/offset products from fixed-rate averages, and falls back to a cached major-bank rate set if the live request fails. Confirm final rates directly with lenders before re-fixing.
