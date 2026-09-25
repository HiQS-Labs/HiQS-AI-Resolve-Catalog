#!/usr/bin/env bun
/**
 * Duplicate Checker for HiQS AI Resolve Catalog.
 *
 * Two deterministic passes (no LLM required for the gate):
 *   Pass A — exact + normalized identity collisions
 *   Pass B — near-matches: same slug across namespaces, vendor-suffix
 *            aliases (deepseek vs deepseek-ai), shared GitHub/HF/packageRef
 *
 * LLM review (Bonsai/agy) is optional *after* this script flags near-matches;
 * never use an LLM alone as the de-dupe gate.
 *
 * Usage:
 *   bun skills/ai-catalog-update/scripts/check-duplicates.ts temp/catalog-drafts/2026-09-15/
 *   bun skills/ai-catalog-update/scripts/check-duplicates.ts harness cline cline
 *   bun skills/ai-catalog-update/scripts/check-duplicates.ts harness deepseek-ai deepseek-harness --source-url https://github.com/deepseek-ai/deepseek-harness
 *   bun skills/ai-catalog-update/scripts/check-duplicates.ts --all-live
 *
 * Exit codes: 0 clean or only fuzzy (still report); 2 if exactDuplicates nonempty
 * (caller should revise existing identity, not create a new record).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

interface LiveRecord {
  kind: string;
  namespace: string;
  slug: string;
  status: string;
  current_revision?: number;
  hf_url?: string | null;
  source_url?: string | null;
  updated_at?: string;
}

interface Candidate {
  source: string;
  kind: string;
  namespace: string;
  slug: string;
  label?: string;
  packageRef?: string;
  sourceUrl?: string;
  hfUrl?: string;
}

const REGISTRY_API = process.env["HIQS_API"] ?? "https://resolve.hiqs.ai";

/** Strip punctuation for fuzzy compare */
function normalize(str: string): string {
  return str.toLowerCase().replace(/[-_.\s]/g, "");
}

/**
 * Collapse common vendor suffixes so deepseek-ai ≈ deepseek, foo-labs ≈ foo.
 * Applied after normalize (hyphens already gone), so match trailing tokens.
 */
function vendorStem(ns: string): string {
  const n = normalize(ns);
  return n.replace(/(ai|labs|lab|org|inc|hq|team|research|official)$/i, "") || n;
}

/** Extract github.com/owner/repo (lowercased) from a URL or packageRef-ish string */
function githubRepoKey(raw?: string | null): string | null {
  if (!raw) return null;
  const m = String(raw).match(/github\.com[/:]([^/\s#]+)\/([^/\s#.]+)/i);
  if (!m) return null;
  return `${m[1]!.toLowerCase()}/${m[2]!.toLowerCase().replace(/\.git$/, "")}`;
}

function hfRepoKey(raw?: string | null): string | null {
  if (!raw) return null;
  const m = String(raw).match(/huggingface\.co\/([^/\s#]+)\/([^/\s#]+)/i);
  if (!m) return null;
  return `${m[1]!.toLowerCase()}/${m[2]!.toLowerCase()}`;
}

function packageNorm(raw?: string | null): string | null {
  if (!raw) return null;
  return normalize(String(raw).replace(/^npm:/i, "").replace(/^pypi:/i, "").replace(/^https?:\/\//i, ""));
}

async function fetchLiveRecords(): Promise<LiveRecord[]> {
  try {
    const res = await fetch(`${REGISTRY_API}/api/public/registry?action=list`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { records?: LiveRecord[] };
    return data.records ?? [];
  } catch {
    const proc = Bun.spawn(["curl", "-s", `${REGISTRY_API}/api/public/registry?action=list`], {
      stdout: "pipe",
    });
    const text = await new Response(proc.stdout).text();
    const data = JSON.parse(text) as { records?: LiveRecord[] };
    return data.records ?? [];
  }
}

function parseCliExtras(args: string[]): { sourceUrl?: string; hfUrl?: string; packageRef?: string } {
  const out: { sourceUrl?: string; hfUrl?: string; packageRef?: string } = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--source-url" && args[i + 1]) {
      out.sourceUrl = args[++i];
    } else if (a === "--hf-url" && args[i + 1]) {
      out.hfUrl = args[++i];
    } else if (a === "--package-ref" && args[i + 1]) {
      out.packageRef = args[++i];
    }
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const liveRecords = await fetchLiveRecords();

  const exactMap = new Map<string, LiveRecord>();
  const byKindSlug = new Map<string, LiveRecord[]>();
  const byKindVendorSlug = new Map<string, LiveRecord[]>();
  const byGithub = new Map<string, LiveRecord[]>();
  const byHf = new Map<string, LiveRecord[]>();

  for (const r of liveRecords) {
    const key = `${r.kind}/${r.namespace}/${r.slug}`;
    exactMap.set(key, r);

    const ks = `${r.kind}|${normalize(r.slug)}`;
    (byKindSlug.get(ks) ?? byKindSlug.set(ks, []).get(ks)!).push(r);

    const kvs = `${r.kind}|${vendorStem(r.namespace)}|${normalize(r.slug)}`;
    (byKindVendorSlug.get(kvs) ?? byKindVendorSlug.set(kvs, []).get(kvs)!).push(r);

    const gh = githubRepoKey(r.source_url) ?? githubRepoKey(r.hf_url);
    if (gh) (byGithub.get(gh) ?? byGithub.set(gh, []).get(gh)!).push(r);
    const hf = hfRepoKey(r.hf_url) ?? hfRepoKey(r.source_url);
    if (hf) (byHf.get(hf) ?? byHf.set(hf, []).get(hf)!).push(r);
  }

  if (args.includes("--all-live")) {
    console.log(JSON.stringify({ total: liveRecords.length, records: liveRecords }, null, 2));
    process.exit(0);
  }

  if (args.length === 0) {
    console.log("Usage: bun check-duplicates.ts <drafts-dir | json-file | kind namespace slug> [--source-url URL] [--hf-url URL] [--package-ref REF]");
    console.log(`Live registry has ${liveRecords.length} records loaded.`);
    process.exit(0);
  }

  const extras = parseCliExtras(args);
  const positional = args.filter((a, i, arr) => {
    if (a.startsWith("--")) return false;
    if (i > 0 && ["--source-url", "--hf-url", "--package-ref"].includes(arr[i - 1]!)) return false;
    return true;
  });

  const candidates: Candidate[] = [];
  const targetPath = positional[0]!;

  if (positional.length >= 3 && !targetPath.includes("/") && !targetPath.endsWith(".json")) {
    candidates.push({
      source: "cli",
      kind: positional[0]!,
      namespace: positional[1]!,
      slug: positional[2]!,
      sourceUrl: extras.sourceUrl,
      hfUrl: extras.hfUrl,
      packageRef: extras.packageRef,
    });
  } else if (existsSync(targetPath)) {
    const stat = statSync(targetPath);
    if (stat.isDirectory()) {
      const files = readdirSync(targetPath).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        const full = join(targetPath, file);
        try {
          const content = JSON.parse(readFileSync(full, "utf8"));
          if (content.kind && content.namespace && content.id) {
            candidates.push({
              source: file,
              kind: content.kind,
              namespace: content.namespace,
              slug: content.id,
              label: content.label,
              packageRef: content.packageRef,
              sourceUrl: content.source_url ?? content.sourceUrl,
              hfUrl: content.hf_url ?? content.hfUrl,
            });
          }
        } catch {
          // ignore
        }
      }
    } else {
      const content = JSON.parse(readFileSync(targetPath, "utf8"));
      candidates.push({
        source: targetPath,
        kind: content.kind,
        namespace: content.namespace,
        slug: content.id,
        label: content.label,
        packageRef: content.packageRef,
        sourceUrl: content.source_url ?? content.sourceUrl ?? extras.sourceUrl,
        hfUrl: content.hf_url ?? content.hfUrl ?? extras.hfUrl,
      });
    }
  } else {
    console.error(JSON.stringify({ error: `Path not found: ${targetPath}` }));
    process.exit(1);
  }

  const report = {
    totalChecked: candidates.length,
    liveLoaded: liveRecords.length,
    exactDuplicates: [] as Array<{ candidate: string; existing: string; action: string; reason: string }>,
    fuzzyNearMatches: [] as Array<{
      candidate: string;
      similarExisting: string[];
      reasons: string[];
      action: string;
    }>,
    cleanNewCandidates: [] as string[],
  };

  const idOf = (r: LiveRecord) => `${r.kind}/${r.namespace}/${r.slug}`;

  for (const c of candidates) {
    const key = `${c.kind}/${c.namespace}/${c.slug}`;
    const reasons = new Set<string>();
    const similar = new Map<string, LiveRecord>();

    // Pass A: exact key
    if (exactMap.has(key)) {
      report.exactDuplicates.push({
        candidate: key,
        existing: key,
        action: "Create new revision (r2+) instead of new record",
        reason: "exact_key",
      });
      continue;
    }

    // Pass A: same kind + normalized namespace + normalized slug
    const normNsSlug = liveRecords.filter(
      (r) =>
        r.kind === c.kind &&
        normalize(r.namespace) === normalize(c.namespace) &&
        normalize(r.slug) === normalize(c.slug),
    );
    for (const r of normNsSlug) {
      similar.set(idOf(r), r);
      reasons.add("normalized_ns_slug");
    }

    // Pass B: same kind + same slug, any namespace (deepseek vs deepseek-ai)
    for (const r of byKindSlug.get(`${c.kind}|${normalize(c.slug)}`) ?? []) {
      if (idOf(r) === key) continue;
      similar.set(idOf(r), r);
      reasons.add("same_kind_slug");
    }

    // Pass B: vendor-stem namespace + same slug
    for (const r of byKindVendorSlug.get(`${c.kind}|${vendorStem(c.namespace)}|${normalize(c.slug)}`) ?? []) {
      if (idOf(r) === key) continue;
      similar.set(idOf(r), r);
      reasons.add("vendor_stem_ns_slug");
    }

    // Pass B: shared GitHub repo / HF repo / packageRef
    const gh = githubRepoKey(c.sourceUrl) ?? githubRepoKey(c.packageRef);
    if (gh) {
      for (const r of byGithub.get(gh) ?? []) {
        if (idOf(r) === key) continue;
        similar.set(idOf(r), r);
        reasons.add(`github_repo:${gh}`);
      }
      // also scan live source_url fields not indexed if missing from map
      for (const r of liveRecords) {
        if (r.kind !== c.kind) continue;
        const rg = githubRepoKey(r.source_url);
        if (rg === gh) {
          similar.set(idOf(r), r);
          reasons.add(`github_repo:${gh}`);
        }
      }
    }
    const hf = hfRepoKey(c.hfUrl) ?? hfRepoKey(c.sourceUrl);
    if (hf) {
      for (const r of byHf.get(hf) ?? []) {
        if (idOf(r) === key) continue;
        similar.set(idOf(r), r);
        reasons.add(`hf_repo:${hf}`);
      }
    }
    const pkg = packageNorm(c.packageRef);
    if (pkg) {
      for (const r of liveRecords) {
        if (r.kind !== c.kind) continue;
        // live list rarely has packageRef; match slug/ns blob
        const blob = normalize(`${r.namespace}${r.slug}${r.source_url ?? ""}`);
        if (blob.includes(pkg) || normalize(r.slug) === pkg) {
          // too aggressive if pkg short — only if pkg length >= 4 and equals slug norm or contained in source
          if (pkg.length >= 4 && (normalize(r.slug) === pkg || githubRepoKey(r.source_url) === gh)) {
            similar.set(idOf(r), r);
            reasons.add("package_ref_overlap");
          }
        }
      }
    }

    if (similar.size > 0) {
      report.fuzzyNearMatches.push({
        candidate: key,
        similarExisting: [...similar.keys()],
        reasons: [...reasons],
        action:
          "Flag for operator / revise existing identity — do NOT contribute a new record until cleared",
      });
    } else {
      report.cleanNewCandidates.push(key);
    }
  }

  console.log(JSON.stringify(report, null, 2));
  if (report.exactDuplicates.length > 0) process.exit(2);
}

await main().catch((err) => {
  console.error(JSON.stringify({ error: String(err) }));
  process.exit(1);
});
