import { requireAdmin } from "../_lib/admin.js";
import { json, method, safeError } from "../_lib/http.js";
import { select } from "../_lib/supabase.js";

export default async function handler(request, response) {
  if (!method(request, response, "GET") || !requireAdmin(request, response)) return;
  try {
    const [events, requests, market, ocr] = await Promise.all([
      select("analytics_events", "select=session_id,event_name,step_number"), select("adviser_review_requests", "select=id"),
      select("market_rate_snapshots", "select=snapshot_date,created_at&order=created_at.desc&limit=1"), select("ocr_snapshots", "select=source_date,fetched_at&order=fetched_at.desc&limit=1")
    ]);
    const pageViews = events.filter((row) => row.event_name === "page_view").length;
    const completed = events.filter((row) => row.step_number).reduce((counts, row) => ({ ...counts, [row.step_number]: (counts[row.step_number] || 0) + 1 }), {});
    const most = Object.entries(completed).sort((a, b) => b[1] - a[1])[0];
    json(response, 200, { totalPageViews: pageViews, uniqueSessions: new Set(events.map((row) => row.session_id)).size, adviserReviewRequests: requests.length, visitorToRequestConversionRate: pageViews ? requests.length / pageViews : 0, mostCompletedStep: most ? { stepNumber: Number(most[0]), count: most[1] } : null, latestMarketRateRefresh: market[0]?.created_at || null, latestOcrRefresh: ocr[0]?.fetched_at || null });
  } catch (error) { console.error("admin dashboard", error); safeError(response); }
}
