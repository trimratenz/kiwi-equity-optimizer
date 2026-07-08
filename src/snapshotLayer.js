export const USER_RATE_DATA_NOTICE =
  "Rate and OCR data are estimates based on the latest available snapshot. Confirm final rates directly with the lender.";

export const BANK_RATE_TERMS = {
  floating: { key: "floating", label: "Floating", months: 0 },
  six_months: { key: "six_months", label: "6 months", months: 6 },
  one_year: { key: "one_year", label: "1 year", months: 12 },
  eighteen_months: { key: "eighteen_months", label: "18 months", months: 18 },
  two_years: { key: "two_years", label: "2 years", months: 24 },
  three_years: { key: "three_years", label: "3 years", months: 36 },
  four_years: { key: "four_years", label: "4 years", months: 48 },
  five_years: { key: "five_years", label: "5 years", months: 60 }
};

const TERM_BY_MONTHS = new Map(Object.values(BANK_RATE_TERMS).map((term) => [term.months, term]));
const TERM_BY_LABEL = new Map(Object.values(BANK_RATE_TERMS).map((term) => [term.label, term]));

export const DEFAULT_BANK_RATE_SNAPSHOT = createBankRateSnapshot({
  id: "bank-rates-5-bank-fallback-2026-07-05",
  source: "Cached 5-bank fallback",
  capturedAt: "2026-07-05",
  records: [
    { institution: "Five-bank average", institutionId: "average", termKey: "six_months", rate: 4.68 },
    { institution: "Five-bank average", institutionId: "average", termKey: "one_year", rate: 4.73 },
    { institution: "Five-bank average", institutionId: "average", termKey: "eighteen_months", rate: 5.12 },
    { institution: "Five-bank average", institutionId: "average", termKey: "two_years", rate: 5.24 },
    { institution: "Five-bank average", institutionId: "average", termKey: "three_years", rate: 5.35 },
    { institution: "Five-bank average", institutionId: "average", termKey: "four_years", rate: 5.47 },
    { institution: "Five-bank average", institutionId: "average", termKey: "five_years", rate: 5.57 },
    { institution: "Five-bank average", institutionId: "average", termKey: "floating", rate: 5.81 }
  ]
});

export const DEFAULT_OCR_FORECAST_SNAPSHOT = createOcrForecastSnapshot({
  id: "ocr-rbnz-mps-may-2026",
  source: "RBNZ Monetary Policy Statement May 2026 OCR track",
  currentOcr: 2.5,
  currentOcrSourceUrl: "https://www.rbnz.govt.nz/monetary-policy/about-monetary-policy/the-official-cash-rate",
  currentOcrUpdatedAt: "2026-07-08",
  sourceUrl:
    "https://www.rbnz.govt.nz/monetary-policy/monetary-policy-statement/monetary-policy-statement-filtered-listing-page/2026/may-270/monetary-policy-statement-may-2026/web-version",
  capturedAt: "2026-06-03",
  publishedAt: "2026-06-03",
  reviewedAt: "2026-07-08",
  lookupMethod: "quarter_containing_date",
  forecast: [
    { date: "2026-06-30", ocr: 2.3 },
    { date: "2026-09-30", ocr: 2.5 },
    { date: "2026-12-31", ocr: 2.8 },
    { date: "2027-03-31", ocr: 3.0 },
    { date: "2027-06-30", ocr: 3.1 },
    { date: "2027-09-30", ocr: 3.1 },
    { date: "2027-12-31", ocr: 3.1 },
    { date: "2028-03-31", ocr: 3.2 },
    { date: "2028-06-30", ocr: 3.2 },
    { date: "2028-09-30", ocr: 3.2 },
    { date: "2028-12-31", ocr: 3.3 },
    { date: "2029-03-31", ocr: 3.3 },
    { date: "2029-06-30", ocr: 3.3 }
  ],
  reviewEvents: ["2026-06-03"]
});

export const LATEST_KNOWN_RBNZ_MPS = {
  title: "Monetary Policy Statement May 2026",
  publishedAt: "2026-06-03",
  url: DEFAULT_OCR_FORECAST_SNAPSHOT.sourceUrl
};

export function termFromMonths(months) {
  return TERM_BY_MONTHS.get(Number(months)) ?? null;
}

export function termFromLabel(label) {
  return TERM_BY_LABEL.get(label) ?? null;
}

export function termFromKey(termKey) {
  return BANK_RATE_TERMS[termKey] ?? null;
}

export function normaliseTerm(term) {
  if (typeof term === "number") return termFromMonths(term);
  return termFromKey(term) ?? termFromLabel(term) ?? null;
}

export function createBankRateSnapshot({ id, source, capturedAt, records = [], url = "", status = "snapshot", note = "" }) {
  const snapshotId = id || `bank-rates-${capturedAt || "unknown"}`;

  return {
    id: snapshotId,
    type: "bank-rate-snapshot",
    source,
    capturedAt,
    lastRefreshed: capturedAt,
    url,
    status,
    note,
    records: records.map((record, index) => {
      const term = normaliseTerm(record.termKey ?? record.termInMonths ?? record.term);
      const termKey = term?.key ?? record.termKey ?? "unknown";
      const fallbackTermMonths = Number(record.termInMonths);
      const termInMonths = term?.months ?? (Number.isFinite(fallbackTermMonths) ? fallbackTermMonths : 0);

      return {
        id: record.id || `${snapshotId}:${record.institutionId || record.institution}:${termKey}:${index}`,
        snapshotId,
        institution: record.institution,
        institutionId: record.institutionId,
        product: record.product || "",
        termKey,
        term: term?.label ?? record.term,
        termInMonths,
        rate: Number(record.rate),
        rateId: record.rateId || ""
      };
    })
  };
}

export function recordsForTerm(snapshot, term) {
  const normalised = normaliseTerm(term);
  if (!normalised) return [];

  return (snapshot?.records || []).filter((record) => record.termInMonths === normalised.months && Number.isFinite(record.rate));
}

export function averageRateForTerm(snapshot, term) {
  const records = recordsForTerm(snapshot, term);
  if (records.length === 0) return null;
  const average = records.reduce((sum, record) => sum + record.rate, 0) / records.length;
  return Number(average.toFixed(2));
}

export function lowestRateForTerm(snapshot, term) {
  const records = recordsForTerm(snapshot, term);
  if (records.length === 0) return null;

  return [...records].sort((a, b) => {
    if (a.rate !== b.rate) return a.rate - b.rate;
    return String(a.institution).localeCompare(String(b.institution));
  })[0];
}

export function buildBankRateSnapshotView(snapshot) {
  const rates = Object.values(BANK_RATE_TERMS)
    .map((term) => {
      const records = recordsForTerm(snapshot, term.key);
      if (records.length === 0) return null;
      const lowest = lowestRateForTerm(snapshot, term.key);

      return {
        term: term.label,
        termKey: term.key,
        termInMonths: term.months,
        rate: averageRateForTerm(snapshot, term.key),
        lenderCount: new Set(records.map((record) => record.institution)).size,
        banks: records.map((record) => record.institution),
        lowestBank: lowest?.institution ?? "Unavailable",
        lowestRate: lowest?.rate ?? null,
        snapshotId: snapshot.id
      };
    })
    .filter(Boolean);

  return {
    snapshotId: snapshot.id,
    rates,
    rawRecords: snapshot.records,
    captured: snapshot.capturedAt,
    lastRefreshed: snapshot.lastRefreshed,
    source: snapshot.source,
    note: snapshot.note || USER_RATE_DATA_NOTICE,
    status: snapshot.status,
    url: snapshot.url || "",
    warnings: evaluateBankRateSnapshotWarnings(snapshot)
  };
}

export function evaluateBankRateSnapshotWarnings(snapshot, asOfDate = new Date()) {
  const captured = parseDate(snapshot?.capturedAt);
  const asOf = parseDate(asOfDate);
  if (!captured || !asOf) return [];

  const ageDays = Math.floor((asOf.getTime() - captured.getTime()) / 86400000);
  return ageDays > 7
    ? [
        {
          code: "bank-rates-stale",
          severity: "warning",
          message: `Bank rate snapshot ${snapshot.id} is ${ageDays} days old.`,
          ageDays,
          snapshotId: snapshot.id
        }
      ]
    : [];
}

export function createOcrForecastSnapshot({
  id,
  source,
  sourceUrl = "",
  currentOcr,
  currentOcrSourceUrl = "",
  currentOcrUpdatedAt = "",
  capturedAt,
  publishedAt = capturedAt,
  reviewedAt,
  lookupMethod = "interpolate",
  forecast = [],
  reviewEvents = []
}) {
  const snapshotId = id || `ocr-forecast-${capturedAt || "unknown"}`;

  return {
    id: snapshotId,
    type: "ocr-forecast-snapshot",
    source,
    sourceUrl,
    currentOcr: Number(currentOcr),
    currentOcrSourceUrl,
    currentOcrUpdatedAt,
    capturedAt,
    publishedAt,
    reviewedAt,
    lastRefreshed: reviewedAt || capturedAt,
    lookupMethod,
    forecast: forecast
      .map((point) => ({ date: point.date, ocr: Number(point.ocr) }))
      .sort((a, b) => parseDate(a.date) - parseDate(b.date)),
    reviewEvents
  };
}

export function lookupOcrForecastByDate(snapshot, refixDate) {
  const target = parseDate(refixDate);
  const forecast = snapshot?.forecast || [];
  if (!target || forecast.length === 0) {
    return {
      date: formatDate(target) || "",
      ocr: snapshot?.currentOcr ?? 0,
      source: snapshot?.source ?? "",
      sourceUrl: snapshot?.sourceUrl ?? "",
      snapshotId: snapshot?.id ?? ""
    };
  }

  const exact = forecast.find((point) => point.date === formatDate(target));
  if (exact) return { ...exact, source: snapshot.source, sourceUrl: snapshot.sourceUrl, snapshotId: snapshot.id };

  if (snapshot.lookupMethod === "quarter_containing_date") {
    const quarterPoint = forecast.find((point) => parseDate(point.date) >= target) ?? forecast.at(-1);
    return {
      ...quarterPoint,
      lookupDate: formatDate(target),
      source: snapshot.source,
      sourceUrl: snapshot.sourceUrl,
      snapshotId: snapshot.id,
      lookupMethod: snapshot.lookupMethod
    };
  }

  const previous = forecast.filter((point) => parseDate(point.date) < target).at(-1);
  const next = forecast.find((point) => parseDate(point.date) > target);
  if (!previous && !next) return { ...forecast[0], source: snapshot.source, sourceUrl: snapshot.sourceUrl, snapshotId: snapshot.id };
  if (!previous) return { ...next, source: snapshot.source, sourceUrl: snapshot.sourceUrl, snapshotId: snapshot.id };
  if (!next) return { ...previous, source: snapshot.source, sourceUrl: snapshot.sourceUrl, snapshotId: snapshot.id };

  const previousDate = parseDate(previous.date);
  const nextDate = parseDate(next.date);
  const progress = (target.getTime() - previousDate.getTime()) / (nextDate.getTime() - previousDate.getTime());

  return {
    date: formatDate(target),
    ocr: previous.ocr + (next.ocr - previous.ocr) * progress,
    source: snapshot.source,
    sourceUrl: snapshot.sourceUrl,
    snapshotId: snapshot.id,
    interpolatedFrom: [previous.date, next.date]
  };
}

export function evaluateOcrForecastWarnings(snapshot, latestRbnzEventDate) {
  const latestEvent = parseDate(latestRbnzEventDate);
  const reviewedAt = parseDate(snapshot?.reviewedAt);
  if (!latestEvent || !reviewedAt || reviewedAt >= latestEvent) return [];

  return [
    {
      code: "ocr-forecast-review-stale",
      severity: "warning",
      message: `OCR forecast snapshot ${snapshot.id} has not been reviewed after ${formatDate(latestEvent)}.`,
      latestRbnzEventDate: formatDate(latestEvent),
      reviewedAt: formatDate(reviewedAt),
      snapshotId: snapshot.id
    }
  ];
}

export function evaluateLatestMpsWarnings(snapshot, latestMps = {}) {
  const snapshotPublishedAt = parseDate(snapshot?.publishedAt || snapshot?.capturedAt);
  const latestPublishedAt = parseDate(latestMps.publishedAt);
  if (!snapshotPublishedAt || !latestPublishedAt || snapshotPublishedAt >= latestPublishedAt) return [];

  return [
    {
      code: "ocr-forecast-mps-outdated",
      severity: "warning",
      message: `OCR forecast snapshot ${snapshot.id} is based on an older MPS than ${latestMps.title || "the latest MPS"}.`,
      snapshotPublishedAt: formatDate(snapshotPublishedAt),
      latestMpsPublishedAt: formatDate(latestPublishedAt),
      latestMpsUrl: latestMps.url || "",
      snapshotId: snapshot.id
    }
  ];
}

export function createCalculationRun({ id, inputs = {}, result = {}, bankRateSnapshot, ocrForecastSnapshot, createdAt }) {
  return {
    id: id || `calculation-run-${createdAt || new Date().toISOString()}`,
    type: "calculation-run",
    createdAt: createdAt || new Date().toISOString(),
    inputs,
    result,
    snapshotIds: {
      bankRateSnapshotId: bankRateSnapshot?.id ?? "",
      ocrForecastSnapshotId: ocrForecastSnapshot?.id ?? ""
    }
  };
}

export function addMonthsToDate(date, months) {
  const source = parseDate(date);
  if (!source) return "";
  const next = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + Number(months || 0), source.getUTCDate()));
  return formatDate(next);
}

function parseDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = parseDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}
