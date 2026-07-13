import { json, method, safeError } from "../_lib/http.js";
import { select } from "../_lib/supabase.js";

export default async function handler(request, response) {
  if (!method(request, response, "GET")) return;
  try {
    const [row] = await select("ocr_snapshots", "select=*&order=source_date.desc,fetched_at.desc&limit=1");
    if (!row) return json(response, 503, { error: "OCR forecast is temporarily unavailable." });
    json(response, 200, { id: row.id, source_name: row.source_name, source_url: row.source_url, source_date: row.source_date, current_ocr: Number(row.current_ocr), forecast_points: row.forecast_points || [], fetched_at: row.fetched_at });
  } catch (error) { console.error("OCR latest", error); safeError(response); }
}
