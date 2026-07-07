import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export const COLLECTIONS = [
  "visitors",
  "sessions",
  "events",
  "step_completions",
  "calculator_runs",
  "rate_snapshots",
  "ocr_snapshots",
  "leads",
  "lead_exports",
  "admin_users"
];

export function createDataStore({ dataDir = join(process.cwd(), "data") } = {}) {
  const collectionPath = (collection) => {
    assertCollection(collection);
    return join(dataDir, `${collection}.json`);
  };

  async function init() {
    await mkdir(dataDir, { recursive: true });
    await Promise.all(
      COLLECTIONS.map(async (collection) => {
        const filePath = collectionPath(collection);
        try {
          await readFile(filePath, "utf8");
        } catch {
          await writeJsonFile(filePath, []);
        }
      })
    );
  }

  async function all(collection) {
    await init();
    const filePath = collectionPath(collection);
    try {
      const content = await readFile(filePath, "utf8");
      const parsed = JSON.parse(content || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function replace(collection, rows) {
    await init();
    await writeJsonFile(collectionPath(collection), rows);
    return rows;
  }

  async function insert(collection, row) {
    const rows = await all(collection);
    const now = new Date().toISOString();
    const next = {
      id: row.id || `${collection.slice(0, -1) || collection}_${randomUUID()}`,
      createdAt: row.createdAt || now,
      ...row
    };
    rows.push(next);
    await replace(collection, rows);
    return next;
  }

  async function upsert(collection, predicate, rowFactory) {
    const rows = await all(collection);
    const index = rows.findIndex(predicate);
    const now = new Date().toISOString();

    if (index >= 0) {
      rows[index] = {
        ...rows[index],
        ...rowFactory(rows[index]),
        updatedAt: now
      };
      await replace(collection, rows);
      return rows[index];
    }

    const next = {
      id: `${collection.slice(0, -1) || collection}_${randomUUID()}`,
      createdAt: now,
      ...rowFactory(null)
    };
    rows.push(next);
    await replace(collection, rows);
    return next;
  }

  return {
    dataDir,
    init,
    all,
    replace,
    insert,
    upsert
  };
}

function assertCollection(collection) {
  if (!COLLECTIONS.includes(collection)) {
    throw new Error(`Unknown collection: ${collection}`);
  }
}

async function writeJsonFile(filePath, rows) {
  await mkdir(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  await rename(tmpPath, filePath);
}
