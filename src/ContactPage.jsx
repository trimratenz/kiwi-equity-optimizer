import React from "react";
import { Home } from "lucide-react";

export function ContactPage() {
  return (
    <main className="min-h-screen bg-[#F7F5F0] px-4 py-8 text-[#1B2A22] sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl rounded-xl border border-[#E2DDD5] bg-white p-6 shadow-[0_18px_50px_rgba(27,42,34,0.07)] sm:p-10">
        <nav className="flex flex-wrap items-center gap-4 text-sm font-bold text-[#3A6047]" aria-label="Main navigation">
          <a href="/calculator" className="inline-flex items-center gap-2 hover:underline"><Home size={17} aria-hidden="true" /> Calculator</a>
          <a href="/info" className="hover:underline">Info</a>
          <a href="/contact" className="underline">Contact</a>
        </nav>
        <h1 className="mt-8 text-3xl font-black sm:text-4xl">Contact</h1>
        <p className="mt-5 leading-7 text-[#5F665F]">For enquiries, feedback, or partnership interest, please contact:</p>
        <a className="mt-3 inline-block text-lg font-black text-[#3A6047] underline" href="mailto:hello@trimrate.co.nz">hello@trimrate.co.nz</a>
        <p className="mt-5 leading-7 text-[#5F665F]">If you are a mortgage adviser, broker, or lender interested in TrimRate, feel free to get in touch.</p>
      </article>
    </main>
  );
}
