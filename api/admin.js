import { adminCookie, authenticateAdmin, canUseAdminTest, clearedAdminCookie, createAdminSession, deploymentEnvironment, isAdmin, json, method, refreshMarketRates, safeError } from "../serverless/core.js";

export default async function handler(request, response) {
  const path = request.query?.path || "page";
  if (path === "login") return login(request, response);
  if (path === "logout") return logout(request, response);
  if (!isAdmin(request)) {
    if (path === "page" || path === "") return html(response, loginPage());
    return json(response, 401, { error: "Admin sign-in required." });
  }
  if (path === "refresh-market-rates") return checkRates(request, response);
  if (path === "test-status") return status(request, response);
  if (path === "page" || path === "") return html(response, dashboard());
  if (path === "test-page" && canUseAdminTest()) return html(response, testPage());
  return json(response, 404, { error: "Not found." });
}

function login(request, response) {
  if (!method(request, response, "POST")) return;
  if (!authenticateAdmin(request.body?.email, request.body?.password)) return json(response, 401, { error: "Invalid email or password." });
  const session = createAdminSession();
  response.setHeader("set-cookie", adminCookie(session.value, session.expires));
  return json(response, 200, { ok: true });
}
function logout(request, response) {
  if (!method(request, response, "POST")) return;
  response.setHeader("set-cookie", clearedAdminCookie());
  return json(response, 200, { ok: true });
}
async function checkRates(request, response) {
  if (!method(request, response, "POST")) return;
  try { return json(response, 200, { ok: true, result: await refreshMarketRates() }); }
  catch (error) { console.error("market-rate check", error); return safeError(response); }
}
function status(request, response) {
  if (!method(request, response, "GET")) return;
  return json(response, 200, {
    environment: deploymentEnvironment(),
    dataStore: process.env.GOOGLE_SHEETS_WEBHOOK_URL && process.env.GOOGLE_SHEETS_WEBHOOK_SECRET ? "Google Sheets webhook configured" : "Google Sheets webhook not configured",
    rates: "Calculator reads the five-bank Rates API directly; the daily cron checks provider health.",
    ocr: "Built-in published snapshot",
    writesEnabled: deploymentEnvironment() === "production" || process.env.TRIMRATE_ALLOW_NONPROD_WRITES === "true"
  });
}
function html(response, body) {
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.status(200).send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>TrimRate Admin</title><style>body{margin:0;background:#f7f5f0;color:#17221a;font:16px system-ui,sans-serif}main{max-width:760px;margin:0 auto;padding:40px 20px}section{background:#fff;border:1px solid #ddd7cc;border-radius:12px;padding:20px;margin:16px 0}button,a{border:1px solid #1a5b3a;background:#1a5b3a;color:#fff;border-radius:7px;padding:10px 14px;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}button.secondary{background:#fff;color:#1a5b3a}pre{white-space:pre-wrap;background:#f6f6f3;padding:12px;border-radius:8px}</style><main>${body}</main></html>`);
}
function dashboard() { return `<h1>TrimRate Admin</h1><section><h2>Data exports</h2><p>Leads and calculator activity are stored in the private <strong>TrimRate Data</strong> Google Sheet. Export either tab directly as Excel or CSV from Google Sheets.</p><p>The application no longer uses Supabase.</p></section><section><h2>Five-bank rate check</h2><p>The calculator reads Rates API directly. Vercel checks that ANZ, ASB, BNZ, Kiwibank, and Westpac are available each day.</p><button id="check">Run check now</button><pre id="result">Not checked yet.</pre></section><form id="logout"><button class="secondary">Sign out</button></form><script>check.onclick=async()=>{result.textContent='Checking…';const r=await fetch('/api/admin/refresh-market-rates',{method:'POST'});result.textContent=JSON.stringify(await r.json(),null,2)};logout.onsubmit=async e=>{e.preventDefault();await fetch('/api/admin/logout',{method:'POST'});location='/admin'}</script>`; }
function loginPage() { return `<h1>TrimRate Admin</h1><section><form id="login"><label>Email<br><input name="email" type="email" required></label><br><label>Password<br><input name="password" type="password" required></label><br><button>Sign in</button><p id="error"></p></form></section><script>login.onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(login));const r=await fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});if(r.ok)location='/admin';else error.textContent=(await r.json()).error||'Sign-in failed.'}</script>`; }
function testPage() { return `<h1>TrimRate diagnostic</h1><p><a href="/admin">Back to admin</a></p><pre id="result">Checking…</pre><script>fetch('/api/admin/test-status').then(r=>r.json()).then(x=>result.textContent=JSON.stringify(x,null,2)).catch(e=>result.textContent=e.message)</script>`; }
