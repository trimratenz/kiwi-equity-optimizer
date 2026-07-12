import React from "react";
import { Home } from "lucide-react";
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from "./privacy.js";

const sectionClass = "mt-8";

export function LegalPage({ type }) {
  const isPrivacy = type === "privacy";
  const title = isPrivacy ? "Privacy Policy" : "Terms of Use";

  return (
    <main className="min-h-screen bg-[#F5F3EF] px-4 py-8 text-[#1B2A22] sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl rounded-2xl border border-[#D6E2DA] bg-white p-6 shadow-sm sm:p-10">
        <a className="inline-flex items-center gap-2 text-sm font-bold text-[#3A6047]" href="/">
          <Home size={17} aria-hidden="true" /> Back to calculator
        </a>
        <h1 className="mt-8 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-4 rounded-lg bg-[#FFF8E1] p-4 text-sm leading-6 text-[#6B5B2A]">
          Draft content: this page should be reviewed by a qualified legal professional before production launch.
        </p>

        {isPrivacy ? (
          <>
            <p className="mt-6 leading-7 text-[#5F665F]">This draft policy explains how TrimRate may handle information when you use this New Zealand mortgage calculator.</p>
            <section className={sectionClass}><h2 className="text-xl font-black">What we collect</h2><p className="mt-2 leading-7 text-[#5F665F]">You may enter loan details such as balances, rates, terms, repayment frequency and income. If you submit a Request a mortgage adviser review, we collect the contact details and property information you provide. We may also collect privacy-safe usage analytics such as page views and steps completed.</p></section>
            <section className={sectionClass}><h2 className="text-xl font-black">Why we collect it</h2><p className="mt-2 leading-7 text-[#5F665F]">Loan details are used to calculate and display estimates. Contact details are used to respond to a review request. Analytics help us understand how the calculator is used and improve it.</p></section>
            <section className={sectionClass}><h2 className="text-xl font-black">Sharing</h2><p className="mt-2 leading-7 text-[#5F665F]">We do not share your loan or contact details with mortgage advisers or brokers unless you submit a review request and consent to being contacted. We may use service providers to host the site or provide analytics under appropriate safeguards.</p></section>
            <section className={sectionClass}><h2 className="text-xl font-black">Storage and security</h2><p className="mt-2 leading-7 text-[#5F665F]">The calculator does not intentionally store full loan details or contact details in browser storage. We take reasonable steps to protect information, but no online service can guarantee absolute security.</p></section>
            <section className={sectionClass}><h2 className="text-xl font-black">Your rights</h2><p className="mt-2 leading-7 text-[#5F665F]">You may ask to access, correct or delete personal information we hold about you. Contact <a className="underline" href="mailto:privacy@example.co.nz">privacy@example.co.nz</a>.</p></section>
          </>
        ) : (
          <>
            <p className="mt-6 leading-7 text-[#5F665F]">By using TrimRate, you agree to these draft terms. They should be replaced or approved before production launch.</p>
            <section className={sectionClass}><h2 className="text-xl font-black">Estimates only</h2><p className="mt-2 leading-7 text-[#5F665F]">TrimRate provides estimates and educational information. It does not provide financial advice, credit advice or a lending decision. Results may be inaccurate, incomplete or out of date.</p></section>
            <section className={sectionClass}><h2 className="text-xl font-black">Get independent help</h2><p className="mt-2 leading-7 text-[#5F665F]">Speak with a qualified mortgage adviser or lender before making a borrowing, refinancing or repayment decision. We do not guarantee savings, approval, refinancing or better rates.</p></section>
            <section className={sectionClass}><h2 className="text-xl font-black">Liability and acceptable use</h2><p className="mt-2 leading-7 text-[#5F665F]">To the extent permitted by law, TrimRate is not liable for loss arising from reliance on estimates or site availability. Use the service lawfully, do not misuse it, and do not attempt to disrupt or access it without permission.</p></section>
            <section className={sectionClass}><h2 className="text-xl font-black">Contact</h2><p className="mt-2 leading-7 text-[#5F665F]">Questions about these terms can be sent to <a className="underline" href="mailto:legal@example.co.nz">legal@example.co.nz</a>.</p></section>
          </>
        )}

        <nav className="mt-10 border-t border-[#E5E0D8] pt-5 text-sm font-bold text-[#3A6047]" aria-label="Legal pages">
          <a className="underline" href={PRIVACY_POLICY_URL}>Privacy Policy</a><span className="px-2">·</span><a className="underline" href={TERMS_OF_USE_URL}>Terms of Use</a>
        </nav>
      </article>
    </main>
  );
}
