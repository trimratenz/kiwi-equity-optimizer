import React from "react";
import { Building2, Home, Mail, MessageSquare, ShieldCheck } from "lucide-react";

const bestFor = ["Product feedback", "Mortgage adviser or broker enquiries", "Lender or partnership interest", "General questions"];

export function ContactPage() {
  return (
    <main className="min-h-screen bg-[#F7F8FA] px-5 py-6 text-slate-950 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-600" aria-label="Main navigation">
          <a href="/calculator" className="inline-flex h-10 items-center gap-2 rounded-lg px-3 hover:bg-white hover:text-[#092B63]"><Home size={17} aria-hidden="true" /> Calculator</a>
          <a href="/info" className="inline-flex h-10 items-center rounded-lg px-3 hover:bg-white hover:text-[#092B63]">How it works</a>
          <a href="/contact" className="inline-flex h-10 items-center rounded-lg bg-white px-3 text-[#092B63] shadow-sm">Contact</a>
        </nav>

        <section className="mt-5 max-w-3xl py-10 sm:py-14">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Get in touch</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] text-[#092B63] sm:text-5xl">Contact TrimRate</h1>
          <p className="mt-4 text-lg text-slate-600">Questions, feedback, or partnership enquiries?</p>
          <p className="mt-6 max-w-2xl leading-7 text-slate-600">We’re building TrimRate to help New Zealand homeowners better understand their mortgage numbers. If you have feedback, questions, or would like to discuss partnerships, get in touch.</p>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-8">
            <span className="inline-flex rounded-xl bg-blue-50 p-3 text-[#092B63]"><Mail size={23} aria-hidden="true" /></span>
            <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-950">Email</h2>
            <p className="mt-2 text-sm text-slate-500">We’ll do our best to respond as soon as possible.</p>
            <a href="mailto:support@trimrate.co.nz" className="mt-7 inline-flex min-h-12 w-full items-center justify-between rounded-xl bg-[#092B63] px-5 text-sm font-black text-white shadow-lg shadow-blue-950/15 transition hover:bg-[#103b80] focus:outline-none focus:ring-4 focus:ring-blue-500/25 sm:w-auto sm:min-w-[300px]">support@trimrate.co.nz <Mail size={17} aria-hidden="true" /></a>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><span className="inline-flex rounded-xl bg-slate-100 p-3 text-slate-700"><MessageSquare size={22} aria-hidden="true" /></span><h2 className="mt-5 text-xl font-black tracking-tight text-slate-950">Best for</h2><ul className="mt-4 space-y-3">{bestFor.map((item) => <li key={item} className="flex gap-3 text-sm font-medium leading-5 text-slate-600"><Building2 className="mt-0.5 shrink-0 text-blue-700" size={16} aria-hidden="true" />{item}</li>)}</ul></article>
        </section>

        <section className="mt-6 flex gap-4 rounded-2xl border border-slate-200 bg-slate-100/70 p-6"><span className="shrink-0 rounded-xl bg-white p-2 text-[#092B63]"><ShieldCheck size={20} aria-hidden="true" /></span><p className="text-sm leading-6 text-slate-600">TrimRate does not provide personal financial advice. For advice specific to your situation, please speak with a qualified mortgage adviser, financial adviser, or your lender.</p></section>
      </div>
    </main>
  );
}
