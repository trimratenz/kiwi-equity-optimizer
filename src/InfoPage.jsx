import React from "react";
import { Home } from "lucide-react";

export function InfoPage() {
  return (
    <main className="min-h-screen bg-[#F7F5F0] px-4 py-8 text-[#1B2A22] sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl rounded-xl border border-[#E2DDD5] bg-white p-6 shadow-[0_18px_50px_rgba(27,42,34,0.07)] sm:p-10">
        <nav className="flex flex-wrap items-center gap-4 text-sm font-bold text-[#3A6047]" aria-label="Main navigation">
          <a href="/calculator" className="inline-flex items-center gap-2 hover:underline"><Home size={17} aria-hidden="true" /> Calculator</a>
          <a href="/info" className="underline">Info</a>
          <a href="/contact" className="hover:underline">Contact</a>
        </nav>
        <h1 className="mt-8 text-3xl font-black sm:text-4xl">The all-in-one mortgage calculator for Kiwis</h1>
        <p className="mt-5 leading-7 text-[#5F665F]">
          TrimRate helps New Zealand homeowners quickly understand their mortgage numbers in one place. You can estimate repayments, compare your rate with market averages, and explore how future rate changes could affect your loan.
        </p>
        <p className="mt-4 leading-7 text-[#5F665F]">
          It is designed to be simple, practical, and easy to share — whether you are refixing, refinancing, reviewing your repayments, or just trying to understand your options.
        </p>
        <p className="mt-4 leading-7 text-[#5F665F]">
          TrimRate provides estimates only and does not provide financial advice. For personal advice, speak with a qualified mortgage adviser or your lender.
        </p>
      </article>
    </main>
  );
}
