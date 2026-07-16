import { isProductionEnvironment, json, method, refreshMarketRates, requireCron, safeError } from "../serverless/core.js";

export default async function handler(request, response) {
  if (!method(request, response, "GET")) return;
  if (!isProductionEnvironment()) return json(response, 403, { error: "Cron jobs are disabled outside production." });
  if (!requireCron(request)) return json(response, 401, { error: "Cron authentication required." });
  if (request.query?.job !== "refresh-market-rates") return json(response, 404, { error: "Not found." });
  try { return json(response, 200, { ok: true, result: await refreshMarketRates() }); }
  catch (error) { console.error("market-rate refresh", error); safeError(response); }
}
