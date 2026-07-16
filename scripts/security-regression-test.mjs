import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { authenticateAdmin, requireCron } from "../serverless/core.js";

const originalEmail = process.env.ADMIN_EMAIL;
const originalPassword = process.env.ADMIN_PASSWORD;
const originalCron = process.env.CRON_SECRET;

try {
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_PASSWORD;
  assert.equal(authenticateAdmin("", ""), false, "empty admin environment must not permit a login");

  process.env.ADMIN_EMAIL = "admin@example.co.nz";
  process.env.ADMIN_PASSWORD = "long-test-password";
  assert.equal(authenticateAdmin("admin@example.co.nz", "long-test-password"), true, "configured admin credentials work");
  assert.equal(authenticateAdmin("admin@example.co.nz", "wrong-password"), false, "wrong password is rejected");

  process.env.CRON_SECRET = "cron-test-secret";
  assert.equal(requireCron({ headers: { authorization: "Bearer cron-test-secret" }, query: {} }), true, "cron bearer secret works");
  assert.equal(requireCron({ headers: {}, query: { secret: "cron-test-secret" } }), false, "cron secret is never accepted in a URL");

  const refreshSource = readFileSync(new URL("../serverless/core.js", import.meta.url), "utf8");
  assert.match(refreshSource, /Rates API did not return all five required banks\./, "daily rate health check rejects incomplete five-bank provider data");
  assert.doesNotMatch(refreshSource, /SUPABASE_SERVICE_ROLE_KEY/, "rate health check does not depend on Supabase");
  console.log("Security regression test passed");
} finally {
  if (originalEmail === undefined) delete process.env.ADMIN_EMAIL; else process.env.ADMIN_EMAIL = originalEmail;
  if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = originalPassword;
  if (originalCron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = originalCron;
}
