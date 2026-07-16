import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canPersistPublicData, deploymentEnvironment, isProductionEnvironment } from "../serverless/core.js";

const original = { trimrate: process.env.TRIMRATE_ENV, vercel: process.env.VERCEL_ENV, writes: process.env.TRIMRATE_ALLOW_NONPROD_WRITES };
try {
  process.env.TRIMRATE_ENV = "preview"; delete process.env.VERCEL_ENV; delete process.env.TRIMRATE_ALLOW_NONPROD_WRITES;
  assert.equal(deploymentEnvironment(), "preview"); assert.equal(isProductionEnvironment(), false); assert.equal(canPersistPublicData(), false);
  process.env.TRIMRATE_ENV = "production";
  assert.equal(canPersistPublicData(), true);
  const cron = readFileSync(new URL("../api/cron.js", import.meta.url), "utf8");
  const publicApi = readFileSync(new URL("../api/public.js", import.meta.url), "utf8");
  assert.match(cron, /Cron jobs are disabled outside production/);
  assert.match(publicApi, /Preview submission accepted but not stored/);
  assert.match(publicApi, /canPersistPublicData/);
  console.log("Deployment safeguards test passed");
} finally { for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key === "trimrate" ? "TRIMRATE_ENV" : key === "vercel" ? "VERCEL_ENV" : "TRIMRATE_ALLOW_NONPROD_WRITES"]; else process.env[key === "trimrate" ? "TRIMRATE_ENV" : key === "vercel" ? "VERCEL_ENV" : "TRIMRATE_ALLOW_NONPROD_WRITES"] = value; } }
