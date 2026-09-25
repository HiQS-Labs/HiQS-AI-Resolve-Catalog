#!/usr/bin/env bun
/**
 * Discovery helper for the ai-catalog-update skill.
 * Pulls recent Raindrop.io bookmarks tagged as catalog leads.
 *
 * Auth: reads ~/secrets/raindrop-local-mac-sync.txt (or RAINDROP_SECRETS_FILE).
 * Required: access_token (Bearer); also accepts Token=/token=. Optional: refresh_token + client_id + client_secret
 * for automatic refresh on 401 (test tokens may not need refresh).
 *
 * Default filters (overridable via flags / env):
 *   tags: model, harness, gateway, service  (any one match)
 *   lookback: 14 days (by created or lastUpdate)
 *
 * Usage:
 *   bun skills/ai-catalog-update/scripts/raindrop-leads.ts
 *   bun skills/ai-catalog-update/scripts/raindrop-leads.ts --days 7
 *   bun skills/ai-catalog-update/scripts/raindrop-leads.ts --tags model,harness
 *   bun skills/ai-catalog-update/scripts/raindrop-leads.ts --json
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const API = "https://api.raindrop.io/rest/v1";
const TOKEN_URL = "https://raindrop.io/oauth/access_token";
const DEFAULT_TAGS = ["model", "harness", "gateway", "service"];
const DEFAULT_DAYS = 14;
const TAG_TO_KIND: Record<string, string> = {
  model: "model",
  harness: "harness",
  gateway: "gateway",
  service: "service",
};

type Secrets = Record<string, string>;

type Raindrop = {
  _id: number;
  title?: string;
  link?: string;
  excerpt?: string;
  note?: string;
  domain?: string;
  tags?: string[];
  created?: string;
  lastUpdate?: string;
  type?: string;
  collectionId?: number;
};

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function secretsPath(): string {
  return (
    process.env["RAINDROP_SECRETS_FILE"] ??
    join(homedir(), "secrets", "raindrop-local-mac-sync.txt")
  );
}

function loadSecrets(path: string): Secrets {
  if (!existsSync(path)) die(`Raindrop secrets file not found: ${path}`);
  const out: Secrets = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    out[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
  }
  return out;
}

function writeSecrets(path: string, secrets: Secrets): void {
  const lines = Object.entries(secrets).map(([k, v]) => `${k}=${v}`);
  writeFileSync(path, lines.join("\n") + "\n", { mode: 0o600 });
}

function parseArgs(argv: string[]) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(`Usage: bun raindrop-leads.ts [--days N] [--tags a,b] [--json]
Default tags: ${DEFAULT_TAGS.join(", ")}
Default days: ${DEFAULT_DAYS}
Secrets: ${secretsPath()}
Env: RAINDROP_SECRETS_FILE, RAINDROP_TAGS, RAINDROP_DAYS`);
    process.exit(0);
  }
  let days = Number(process.env["RAINDROP_DAYS"] ?? DEFAULT_DAYS);
  let tags = (process.env["RAINDROP_TAGS"] ?? DEFAULT_TAGS.join(","))
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--days" && argv[i + 1]) {
      days = Number(argv[++i]);
    } else if (a === "--tags" && argv[i + 1]) {
      tags = argv[++i].split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    } else if (a === "--json") {
      json = true;
    } else {
      die(`Unknown arg: ${a}`);
    }
  }
  if (!Number.isFinite(days) || days <= 0) die(`Invalid --days: ${days}`);
  if (tags.length === 0) die("No tags configured");
  return { days, tags, json };
}

function matchedKinds(tags: string[], wanted: string[]): string[] {
  const set = new Set(tags.map((t) => t.toLowerCase()));
  const kinds: string[] = [];
  for (const t of wanted) {
    if (set.has(t) && TAG_TO_KIND[t]) kinds.push(TAG_TO_KIND[t]);
  }
  return [...new Set(kinds)];
}

function itemTime(r: Raindrop): number {
  const raw = r.lastUpdate || r.created;
  const ms = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(ms) ? ms : 0;
}

async function refreshAccessToken(secrets: Secrets, path: string): Promise<string> {
  const { client_id, client_secret, refresh_token } = secrets;
  if (!client_id || !client_secret || !refresh_token) {
    die(
      "access_token rejected and refresh is not possible. Add access_token to the secrets file (Raindrop app Test token works), or include refresh_token with client_id/client_secret.",
    );
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id,
      client_secret,
      refresh_token,
    }),
  });
  const body = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
  };
  if (!res.ok || !body.access_token) {
    die(`Raindrop token refresh failed (${res.status}): ${body.error ?? JSON.stringify(body)}`);
  }
  secrets.access_token = body.access_token;
  if (body.refresh_token) secrets.refresh_token = body.refresh_token;
  try {
    writeSecrets(path, secrets);
  } catch {
    // Non-fatal: still use the refreshed token this run.
  }
  return body.access_token;
}

async function apiGet(
  path: string,
  token: string,
  secrets: Secrets,
  secretsFile: string,
): Promise<unknown> {
  const once = async (bearer: string) =>
    fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });

  let res = await once(token);
  if (res.status === 401) {
    const next = await refreshAccessToken(secrets, secretsFile);
    res = await once(next);
  }
  if (!res.ok) {
    const text = await res.text();
    die(`Raindrop API ${path} failed (${res.status}): ${text.slice(0, 400)}`);
  }
  return res.json();
}

async function fetchLeads(days: number, tags: string[], secrets: Secrets, secretsFile: string) {
  let token = (
    secrets.access_token ||
    secrets.Token ||
    secrets.token ||
    secrets.RAINDROP_TOKEN ||
    secrets.raindrop_token ||
    ""
  ).trim();
  if (!token) {
    die(
      `Missing access_token in ${secretsFile}. Add access_token=... (or Token=...). Raindrop App Console → Test token is fine for personal use.`,
    );
  }
  // Normalize alias keys so refresh write-back keeps a canonical name.
  secrets.access_token = token;

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const leads: Array<{
    id: number;
    title: string;
    url: string;
    domain: string;
    tags: string[];
    kinds: string[];
    excerpt: string;
    note: string;
    created: string;
    lastUpdate: string;
  }> = [];

  // Page newest-first; stop once items fall outside the lookback window.
  for (let page = 0; page < 40; page++) {
    const data = (await apiGet(
      `/raindrops/0?perpage=50&page=${page}&sort=-created`,
      token,
      secrets,
      secretsFile,
    )) as { items?: Raindrop[]; result?: boolean };

    // Token may have been refreshed inside apiGet.
    token = secrets.access_token ?? token;

    const items = data.items ?? [];
    if (items.length === 0) break;

    let newestOnPageOutside = true;
    for (const item of items) {
      const ts = itemTime(item);
      if (ts >= cutoff) newestOnPageOutside = false;
      if (ts < cutoff) continue;
      const itemTags = (item.tags ?? []).map((t) => String(t));
      const kinds = matchedKinds(itemTags, tags);
      if (kinds.length === 0) continue;
      leads.push({
        id: item._id,
        title: item.title ?? "",
        url: item.link ?? "",
        domain: item.domain ?? "",
        tags: itemTags,
        kinds,
        excerpt: item.excerpt ?? "",
        note: item.note ?? "",
        created: item.created ?? "",
        lastUpdate: item.lastUpdate ?? "",
      });
    }

    if (items.length < 50) break;
    // If every item on this page is older than the cutoff, further pages are older too.
    if (newestOnPageOutside) break;
  }

  leads.sort((a, b) => Date.parse(b.lastUpdate || b.created) - Date.parse(a.lastUpdate || a.created));
  return leads;
}

async function main() {
  const { days, tags, json } = parseArgs(process.argv.slice(2));
  const path = secretsPath();
  const secrets = loadSecrets(path);
  const leads = await fetchLeads(days, tags, secrets, path);

  if (json) {
    console.log(
      JSON.stringify(
        {
          source: "raindrop",
          lookbackDays: days,
          tags,
          count: leads.length,
          leads,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`Raindrop leads (tags: ${tags.join(", ")}; last ${days}d): ${leads.length}`);
  for (const lead of leads) {
    console.log(
      `- [${lead.kinds.join("|")}] ${lead.title || "(untitled)"} — ${lead.url} (tags: ${lead.tags.join(", ")})`,
    );
  }
}

await main();
