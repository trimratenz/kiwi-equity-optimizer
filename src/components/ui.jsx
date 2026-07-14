import React, { useState } from "react";

function formatThousands(value) {
  const raw = String(value ?? "").replace(/,/g, "");
  if (!raw) return "";
  const [whole, decimal] = raw.split(".");
  const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimal === undefined ? formattedWhole : `${formattedWhole}.${decimal}`;
}

export function Field({ label, hint, error, children }) {
  const [touched, setTouched] = useState(false);

  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-800" onBlur={() => setTouched(true)}>
      <span>{label}</span>
      {hint && <span className="text-xs font-medium leading-5 text-slate-500">{hint}</span>}
      {children}
      {touched && error && <span className="pt-0.5 text-xs font-bold text-[#C86A53]">{error}</span>}
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
      className={`flex h-12 items-center rounded-xl border px-3 shadow-sm transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 ${
        disabled ? "border-slate-200 bg-slate-50 text-slate-500" : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      {prefix && <span className="mr-2 text-sm text-slate-500">{prefix}</span>}
      <input
        className="h-full w-full bg-transparent text-base font-bold text-slate-950 outline-none placeholder:text-slate-400 disabled:text-slate-500"
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
      {suffix && <span className="ml-2 text-sm text-slate-500">{suffix}</span>}
    </div>
  );
}

export function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
    >
      {children}
    </select>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div
      className="grid gap-1 rounded-xl bg-slate-100 p-1"
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
              ? "bg-[#092B63] text-white shadow-sm"
              : "text-slate-500 hover:bg-white hover:text-slate-900"
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-7">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-blue-50 p-2 text-[#092B63]">
          <Icon size={20} aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-700">{step}</p>
          <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{title}</h2>
          {detail && <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{detail}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, icon: Icon, className = "" }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
        {Icon && (
          <span className="rounded-lg bg-blue-50 p-2 text-[#092B63]">
            <Icon size={17} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      {sub && <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{sub}</p>}
    </div>
  );
}

export function ResponsiveTable({ children }) {
  return (
    <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white overscroll-x-contain">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}
