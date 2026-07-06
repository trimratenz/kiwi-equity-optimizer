import React from "react";

function formatThousands(value) {
  const raw = String(value ?? "").replace(/,/g, "");
  if (!raw) return "";
  const [whole, decimal] = raw.split(".");
  const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimal === undefined ? formattedWhole : `${formattedWhole}.${decimal}`;
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#1B2A22]">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {hint && <span className="text-xs font-medium text-[#7B756E]">{hint}</span>}
      </span>
      {children}
      {error && <span className="text-xs font-bold text-[#C86A53]">{error}</span>}
    </label>
  );
}

export function NumberInput({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  prefix,
  suffix,
  placeholder = "0",
  disabled = false,
  thousands = false
}) {
  const displayValue = thousands ? formatThousands(value) : value;

  return (
    <div
      className={`flex h-12 items-center rounded-lg border px-3 shadow-sm transition focus-within:border-[#3A6047] focus-within:ring-2 focus-within:ring-[#3A6047]/15 ${
        disabled ? "border-[#E2DDD5] bg-[#F7F5F0] text-[#7B756E]" : "border-[#E2DDD5] bg-white"
      }`}
    >
      {prefix && <span className="mr-2 text-sm text-[#7B756E]">{prefix}</span>}
      <input
        className="h-full w-full bg-transparent text-base font-bold text-[#1B2A22] outline-none placeholder:text-[#7B756E]/60 disabled:text-[#7B756E]"
        inputMode="decimal"
        type="text"
        aria-valuemin={min}
        aria-valuemax={max}
        data-step={step}
        value={displayValue}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {suffix && <span className="ml-2 text-sm text-[#7B756E]">{suffix}</span>}
    </div>
  );
}

export function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-12 rounded-lg border border-[#E2DDD5] bg-white px-3 text-sm font-bold text-[#1B2A22] outline-none transition focus:border-[#3A6047] focus:ring-2 focus:ring-[#3A6047]/15"
    >
      {children}
    </select>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div
      className="grid gap-1 rounded-lg bg-[#F7F5F0] p-1"
      style={{
        gridTemplateColumns:
          options.length > 3 ? "repeat(auto-fit, minmax(92px, 1fr))" : `repeat(${options.length}, minmax(0, 1fr))`
      }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`min-h-11 rounded-md px-3 text-sm font-bold transition ${
            value === option.value
              ? "bg-[#3A6047] text-white shadow-sm"
              : "text-[#7B756E] hover:bg-white hover:text-[#1B2A22]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function StepShell({ step, title, detail, icon: Icon, children }) {
  return (
    <section className="rounded-xl border border-[#E2DDD5] bg-white p-5 shadow-[0_18px_50px_rgba(27,42,34,0.07)] sm:p-7">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-lg bg-[#3A6047]/10 p-2 text-[#3A6047]">
          <Icon size={20} aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#3A6047]">{step}</p>
          <h2 className="text-xl font-black text-[#1B2A22] sm:text-2xl">{title}</h2>
          {detail && <p className="mt-1 max-w-3xl text-sm leading-6 text-[#7B756E]">{detail}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, icon: Icon, className = "" }) {
  return (
    <div className={`rounded-xl border border-[#E2DDD5] bg-white p-4 shadow-[0_12px_34px_rgba(27,42,34,0.06)] ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#7B756E]">{label}</p>
        {Icon && (
          <span className="rounded-lg bg-[#F7F5F0] p-2 text-[#3A6047]">
            <Icon size={17} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-black text-[#1B2A22]">{value}</p>
      {sub && <p className="mt-1 text-xs font-medium leading-5 text-[#7B756E]">{sub}</p>}
    </div>
  );
}

export function ResponsiveTable({ children }) {
  return (
    <div className="max-w-full overflow-x-auto rounded-xl border border-[#E2DDD5] bg-white overscroll-x-contain">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}
