import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import {
  adminLeadRows,
  adminMetrics,
  createLeadRateLimiter,
  leadCsvExport,
  recordCalculatorRun,
  requestMeta,
  submitLead,
  trackEvent
} from "./analytics.mjs";
import { createDataStore } from "./storage.mjs";

const DEFAULT_PORT = Number(process.env.PORT || 8787);

export function createTrimRateServer({
  store = createDataStore(),
  publicDir = join(process.cwd(), "dist"),
  adminToken = process.env.ADMIN_TOKEN || "",
  adminUsername = process.env.ADMIN_USERNAME || "",
  adminPassword = process.env.ADMIN_PASSWORD || "",
  rateLimiter = createLeadRateLimiter()
} = {}) {
  const server = createHttpServer(async (request, response) => {
    try {
      await routeRequest({
        request,
        response,
        store,
        publicDir,
        adminToken,
        adminUsername,
        adminPassword,
        rateLimiter
      });
    } catch (error) {
      console.error("TrimRate backend error", error);
      sendJson(response, 500, { error: "Internal server error." });
    }
  });

  return server;
}

async function routeRequest(context) {
  const { request, response, store } = context;
  const url = new URL(request.url, "http://localhost");

  if (request.method === "OPTIONS") {
    sendCors(response);
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/healthz") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/events") {
    const result = await trackEvent({ store, body: await readJson(request), meta: requestMeta(request) });
    sendJson(response, result.status, result.body);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/calculator-runs") {
    const result = await recordCalculatorRun({ store, body: await readJson(request), meta: requestMeta(request) });
    sendJson(response, result.status, result.body);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/leads") {
    const result = await submitLead({
      store,
      body: await readJson(request),
      meta: requestMeta(request),
      rateLimiter: context.rateLimiter
    });
    sendJson(response, result.status, result.body);
    return;
  }

  if (url.pathname.startsWith("/api/admin") || url.pathname === "/admin") {
    if (!isAdminRequest(request, context)) {
      sendAdminChallenge(response, context);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/metrics") {
      sendJson(response, 200, await adminMetrics(store));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/leads") {
      const rows = await adminLeadRows(store, {
        search: url.searchParams.get("search") || "",
        currentBank: url.searchParams.get("currentBank") || ""
      });
      sendJson(response, 200, { rows });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/leads.csv") {
      const csv = await leadCsvExport(store, {
        search: url.searchParams.get("search") || "",
        currentBank: url.searchParams.get("currentBank") || ""
      });
      sendText(response, 200, csv, "text/csv; charset=utf-8", {
        "content-disposition": `attachment; filename="trimrate-leads.csv"`
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/admin") {
      sendText(response, 200, adminDashboardHtml(), "text/html; charset=utf-8");
      return;
    }
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    await serveStatic(context, url.pathname || "/");
    return;
  }

  sendJson(response, 405, { error: "Method not allowed." });
}

function isAdminRequest(request, { adminToken, adminUsername, adminPassword }) {
  const authorization = request.headers.authorization || "";

  if (adminToken && authorization === `Bearer ${adminToken}`) return true;

  if (adminUsername && adminPassword && authorization.startsWith("Basic ")) {
    const decoded = Buffer.from(authorization.slice("Basic ".length), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    return username === adminUsername && password === adminPassword;
  }

  return false;
}

function sendAdminChallenge(response, { adminUsername, adminPassword }) {
  const headers = adminUsername && adminPassword ? { "www-authenticate": 'Basic realm="TrimRate Admin"' } : {};
  sendJson(response, 401, { error: "Admin authentication required." }, headers);
}

async function readJson(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > 1_000_000) throw new Error("Request body too large.");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

async function serveStatic({ request, response, publicDir }, pathname) {
  const safePath = normalize(pathname).replace(/^[/\\]+/, "").replace(/^(\.\.[/\\])+/, "");
  const targetPath = join(publicDir, safePath === "/" ? "index.html" : safePath);
  const fallbackPath = join(publicDir, "index.html");
  const filePath = (await exists(targetPath)) ? targetPath : fallbackPath;
  const fileStat = await exists(filePath);

  if (!fileStat) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  response.writeHead(200, {
    "content-type": contentType(filePath),
    "content-length": fileStat.size
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
}

async function exists(filePath) {
  try {
    return await stat(filePath);
  } catch {
    return null;
  }
}

function sendJson(response, status, body, extraHeaders = {}) {
  sendCors(response);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function sendText(response, status, text, contentTypeHeader, extraHeaders = {}) {
  sendCors(response);
  response.writeHead(status, {
    "content-type": contentTypeHeader,
    "cache-control": "no-store",
    ...extraHeaders
  });
  response.end(text);
}

function sendCors(response) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type,authorization");
}

function contentType(filePath) {
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg"
    }[extname(filePath)] || "application/octet-stream"
  );
}

function adminDashboardHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TrimRate Admin</title>
    <style>
      body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f5f0; color: #1b2a22; }
      main { max-width: 1180px; margin: 0 auto; padding: 28px 18px 48px; }
      h1 { margin: 0 0 18px; font-size: 28px; }
      .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
      .card { background: white; border: 1px solid #e2ddd5; border-radius: 8px; padding: 14px; box-shadow: 0 12px 30px rgba(27,42,34,.06); }
      .label { color: #6d756e; font-size: 12px; font-weight: 800; text-transform: uppercase; }
      .value { margin-top: 8px; font-size: 24px; font-weight: 900; }
      table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #e2ddd5; border-radius: 8px; overflow: hidden; }
      th, td { padding: 10px; border-bottom: 1px solid #e2ddd5; text-align: left; font-size: 13px; vertical-align: top; }
      th { background: #fffefc; color: #6d756e; font-size: 11px; text-transform: uppercase; }
      input, select, button, a.button { height: 38px; border-radius: 8px; border: 1px solid #d6e2da; padding: 0 10px; font-weight: 700; background: white; color: #1b2a22; }
      button, a.button { display: inline-flex; align-items: center; text-decoration: none; cursor: pointer; }
      .toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 22px 0 12px; }
    </style>
  </head>
  <body>
    <main>
      <h1>TrimRate Admin</h1>
      <section id="metrics" class="grid"></section>
      <div class="toolbar">
        <input id="search" placeholder="Search leads" />
        <select id="bank"><option value="">All banks</option></select>
        <button id="refresh">Refresh</button>
        <a class="button" href="/api/admin/leads.csv">Export CSV</a>
      </div>
      <table>
        <thead>
          <tr><th>Created</th><th>Name</th><th>Email</th><th>Phone</th><th>Bank</th><th>Loan</th><th>DTI</th></tr>
        </thead>
        <tbody id="leads"></tbody>
      </table>
    </main>
    <script>
      const money = new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD", maximumFractionDigits: 0 });
      async function load() {
        const [metricsRes, leadsRes] = await Promise.all([
          fetch("/api/admin/metrics"),
          fetch("/api/admin/leads?" + new URLSearchParams({ search: search.value, currentBank: bank.value }))
        ]);
        const metrics = await metricsRes.json();
        const leads = await leadsRes.json();
        renderMetrics(metrics);
        renderLeads(leads.rows || []);
      }
      function renderMetrics(metrics) {
        const items = [
          ["Total views", metrics.totalViews],
          ["Unique visitors", metrics.uniqueVisitors],
          ["Calculator starts", metrics.calculatorStarts],
          ["Summary views", metrics.summaryViews],
          ["Lead form starts", metrics.leadFormStarts],
          ["Lead submissions", metrics.leadSubmissions],
          ["Lead conversion", pct(metrics.leadConversionRate)],
          ["Avg loan balance", money.format(metrics.averageLoanBalance)],
          ["Avg DTI", Number(metrics.averageDti).toFixed(2) + "x"],
          ["Avg monthly repayment", money.format(metrics.averageMonthlyRepayment)],
          ["Avg cash after repayment", money.format(metrics.averageCashAfterRepayment)]
        ];
        metrics.completionRateByStep.forEach((row) => items.push(["Step " + row.step + " completion", pct(row.rate)]));
        metrics.dropOffByStep.forEach((row) => items.push(["Step " + row.step + " drop-off", row.dropOff + " (" + pct(row.rate) + ")"]));
        items.push(["Common banks", (metrics.mostCommonCurrentBanks || []).map((x) => x.label + " " + x.count).join(", ") || "-"]);
        items.push(["Common re-fix", (metrics.mostCommonRefixTimeframes || []).map((x) => x.label + " " + x.count).join(", ") || "-"]);
        document.querySelector("#metrics").innerHTML = items.map(([label, value]) => '<div class="card"><div class="label">' + escapeHtml(label) + '</div><div class="value">' + escapeHtml(value) + '</div></div>').join("");
      }
      function renderLeads(rows) {
        const banks = [...new Set(rows.map((row) => row.currentBank).filter(Boolean))].sort();
        const current = bank.value;
        bank.innerHTML = '<option value="">All banks</option>' + banks.map((item) => '<option>' + escapeHtml(item) + '</option>').join("");
        bank.value = current;
        leads.innerHTML = rows.map((row) => '<tr><td>' + escapeHtml(row.createdAt) + '</td><td>' + escapeHtml(row.name) + '</td><td>' + escapeHtml(row.email) + '</td><td>' + escapeHtml(row.phone) + '</td><td>' + escapeHtml(row.currentBank) + '</td><td>' + money.format(row.inputsJson?.loanBalance || 0) + '</td><td>' + Number(row.outputsJson?.dtiEstimate || 0).toFixed(2) + 'x</td></tr>').join("");
      }
      function pct(value) { return Math.round(Number(value || 0) * 1000) / 10 + "%"; }
      function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
      refresh.addEventListener("click", load);
      search.addEventListener("input", () => setTimeout(load, 150));
      bank.addEventListener("change", load);
      load();
    </script>
  </body>
</html>`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createTrimRateServer();
  server.listen(DEFAULT_PORT, "0.0.0.0", () => {
    console.log(`TrimRate backend listening on http://127.0.0.1:${DEFAULT_PORT}`);
  });
}
