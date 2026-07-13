import { createOcrForecastSnapshot } from "./snapshotLayer.js";

export async function fetchOcrSnapshot() {
  const response = await fetch("/api/ocr-snapshot/latest", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("OCR forecast is unavailable.");
  const data = await response.json();
  return createOcrForecastSnapshot({
    id: data.id || `ocr-${data.source_date}`,
    source: data.source_name,
    sourceUrl: data.source_url,
    currentOcr: data.current_ocr,
    currentOcrSourceUrl: data.source_url,
    currentOcrUpdatedAt: data.source_date,
    capturedAt: data.source_date,
    publishedAt: data.source_date,
    reviewedAt: data.fetched_at?.slice(0, 10) || data.source_date,
    lookupMethod: "quarter_containing_date",
    forecast: data.forecast_points || []
  });
}
