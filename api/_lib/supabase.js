const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function config() {
  if (!url || !serviceKey) throw new Error("Supabase server environment is not configured.");
  return { url: url.replace(/\/$/, ""), serviceKey };
}

export async function supabase(path, options = {}) {
  const settings = config();
  const response = await fetch(`${settings.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: settings.serviceKey,
      authorization: `Bearer ${settings.serviceKey}`,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}): ${text.slice(0, 300)}`);
  return data;
}

export function insert(table, row) {
  return supabase(table, { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify(row) });
}

export function select(table, query = "") {
  return supabase(`${table}${query ? `?${query}` : ""}`);
}
