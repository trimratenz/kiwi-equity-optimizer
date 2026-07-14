import React from "react";
import { Check, CircleAlert, Home, ShieldCheck, Sparkles } from "lucide-react";

const features = [
  ["Simple", "No spreadsheets or confusing bank calculators."],
  ["NZ focused", "Built around NZ mortgage terms, fixed tranches, floating rates, top-ups, and OCR scenarios."],
  ["Transparent", "Clear estimates, visible assumptions, and no financial advice."]
];

const capabilities = [
  "Estimate mortgage repayments",
  "Compare your rate with market averages",
  "Understand cash flow after mortgage costs",
  "Review DTI and repayment-to-income",
  "Explore OCR-based repayment scenarios",
  "Generate a summary to review or share"
];

export function InfoPage() {
  return (
    <main className="min-h-screen bg-[#F7F8FA] px-5 py-6 text-slate-950 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-600" aria-label="Main navigation">
          <a href="/calculator" className="inline-flex h-10 items-center gap-2 rounded-lg px-3 hover:bg-white hover:text-[#092B63]"><Home size={17} aria-hidden="true" /> Calculator</a>
          <a href="/info" className="inline-flex h-10 items-center rounded-lg bg-white px-3 text-[#092B63] shadow-sm">How it works</a>
          <a href="/contact" className="inline-flex h-10 items-center rounded-lg px-3 hover:bg-white hover:text-[#092B63]">Contact</a>
        </nav>

        <section className="relative mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white px-6 py-12 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">About TrimRate</p>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] text-[#092B63] sm:text-5xl">Mortgage clarity for New Zealand homeowners</h1>
            <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">TrimRate helps you understand your repayments, rate position, cash flow, and future rate scenarios in one clean estimate.</p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          {features.map(([title, description], index) => {
            const Icon = index === 0 ? Sparkles : index === 1 ? Home : ShieldCheck;
            return <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="inline-flex rounded-xl bg-blue-50 p-2 text-[#092B63]"><Icon size={20} aria-hidden="true" /></span><h2 className="mt-5 text-xl font-black tracking-tight text-slate-950">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></article>;
          })}
        </section>

        <section className="mt-12">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">The dashboard</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950">What TrimRate helps you understand</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((capability) => <div key={capability} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><span className="rounded-full bg-emerald-50 p-1 text-emerald-700"><Check size={15} strokeWidth={3} aria-hidden="true" /></span><p className="text-sm font-bold text-slate-800">{capability}</p></div>)}
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-amber-200 bg-amber-50/70 p-6 sm:p-8">
          <div className="flex gap-4"><span className="mt-0.5 text-amber-700"><CircleAlert size={24} strokeWidth={2.25} aria-hidden="true" /></span><div><h2 className="text-xl font-black tracking-tight text-slate-950">Important disclaimer</h2><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">TrimRate provides estimates and general information only. It does not provide financial advice, lending advice, or recommendations to refix, refinance, borrow, repay, or switch lenders. Results depend on the information entered and assumptions used. For personal advice, speak with a qualified mortgage adviser, financial adviser, or your lender.</p></div></div>
        </section>
      </div>
    </main>
  );
}
