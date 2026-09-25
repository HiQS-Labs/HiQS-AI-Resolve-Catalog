---
name: ai-catalog-update
description: >-
  Run the daily catalog population and refresh session for HiQS AI Resolve:
  discover new models, Chinese models, international models, harnesses,
  AI services/gateways, and local runtimes via Antigravity CLI (agy) grounded
  discovery (default), primary seed sources, Raindrop tagged bookmarks, and
  YouTube local LLM video intelligence, verify on authoritative primary sources,
  draft schema-valid registry revisions, check for duplicates, and record an
  auditable ledger and review sheet. Drafts only; publishing is strictly
  operator-gated. Trigger on "/ai-catalog-update", "ai-catalog-update",
  "catalog update", "run ai catalog update", "update ai catalog".
---

# AI Catalog Update

Semi-autonomous daily population and refresh of the HiQS AI Resolve catalog
(models, harnesses, services, gateways, runtimes) with primary-source verification,
duplicate detection, schema validation, and human-gated publishing.

## Intake conventions (origin — overrides conflicting older notes)

**One rule that overrides everything:** a field value survives into a payload only if it is visible in a primary source you actually fetched (vendor docs, GitHub repo, npm page, Hugging Face card). Search results and AI summaries are leads, never truth. If you cannot verify it, omit the field — empty is honest; guessing is not.

**Kinds:** `model` | `harness` | `gateway` | `service` | `runtime`. Discovery and drafting only; publishing stays with the human operator.

**Naming (never rename published entries):**
- Before the slash = lab/vendor short name (never a family, fork, or product line).
- After the slash = the vendor's own published identifier, lowercased exactly as the vendor writes it, including dates/quant suffixes (e.g. `mistralai/mistral-medium-3.5-128b`, `qwen/qwen3.8-max-0902`).
- A repeated lab name in the model name is correct — keep it.
- Variant spellings are aliases on the existing entry, never new entries.
- Never rename, move, or delete published records; revisions are immutable — updates are a new revision (`r2`, `r3`, …) on the same identity.

**Payload conventions:**
- `revision`: `r1` for a new entity; `r<current+1>` when revising an existing one.
- `summary`: exactly one neutral sentence, ≤240 chars — what it's for and what distinguishes it. Never marketing, never quality/ranking claims.
- `note`: ≤2000 chars; detail framed as operator-recorded, not provider-verified, with the source URL at the end. Long notes truncate from the end; heading + source link always survive.
- `baseModel`: only when the publisher states the derivation, as the publisher's own identifier. Omit the key entirely if unknown — never null, never guessed.
- `claimRefs`: leave empty (`[]`); the live catalog does not resolve claim IDs.
- Unknown fields: omit the key. Never invent capabilities, adapters, hosting, pins, or compatibility claims.
- Mark provenance `origin: import` on import/draft workflows. Importers must be idempotent: list-before-write, skip existing keys. Always dry-run first (`DRY_RUN=1`) when an importer supports it.

**Process:**
1. Before drafting, check what already exists — exact key and near-matches. Near-matches get flagged for the operator, not auto-created.
2. Fetch every source you cite. Quote numbers; don't paraphrase.
3. Write drafts as JSON, validate against the kind schema.
4. Submit via the single writer path (`/api/public/registry` contribute, drafts only). Never publish, delete, move, or snapshot.
5. Log per draft: identity, material fields, unknowns, source URLs.

When in doubt between a flashy claim and a quiet truth, ship the quiet truth.

## Runtime kind (local inference scaffolds)

`runtime` is for local-serving tools (MLX wrappers, llama.cpp forks, new serving layers), distinct from hosted gateways. Live reference: `runtime/ml-explore/mlx-lm` (MIT; `distribution: server`; `transports: ["http"]`; `apiCompatibility: ["openai-compatible"]`; source the mlx_lm `SERVER.md` GitHub URL; packageRef `github.com/ml-explore/mlx-lm`).

Required payload fields (see `schemas/runtime.schema.json`):
- `packageRef`: exact repo/package reference
- `distribution`: `cli` | `desktop_app` | `server` | `library`
- `transports`: documented serving transports, e.g. `["http"]`
- `apiCompatibility`: documented API dialects, e.g. `["openai-compatible"]`
- Plus shared revision identity fields; license + `license_url` / `source_url` via record metadata when the repo states them.

**Do not imply runtimes resolve.** They are discoverable compatibility records only — the resolver still returns hosted harness+gateway+model routes.

## 0. Key Handling & Configuration

- **Antigravity CLI (`agy`)**: Default grounded discovery. Uses the signed-in Google OAuth session under `~/.gemini/antigravity-cli/` (not an API key file). Ensure `agy` is on `PATH` and signed in. Optional env: `AGY_MODEL` (default `gemini-3.8-flash-medium`), `AGY_EFFORT`, `AGY_PRINT_TIMEOUT`, `AGY_SKIP_PERMISSIONS` (default `1` for headless scout — needed until a tight `permissions.allow` rule covers search/fetch).
- **Gemini API key (fallback only)**: `~/secrets/gemini-paid-key.txt` (or `GEMINI_API_KEY` / `GEMINI_KEY_FILE`) for legacy `gemini-search.ts`. Prefer `agy-search.sh`. Never echoed, committed, or exposed.
- **Browserbase Key**: Loaded from `~/secrets/browserbase.txt` (or `BROWSERBASE_API_KEY`) for verification of JS-heavy primary pages.
- **Raindrop**: Loaded from `~/secrets/raindrop-local-mac-sync.txt` (or `RAINDROP_SECRETS_FILE`). Requires `access_token` (Bearer). Optional `refresh_token` + `client_id` + `client_secret` for refresh on 401. Never echoed, committed, or exposed.
- **Registry Credentials**: Maintainer account loaded from `/Users/noelsaw/secrets/hiqs-ai-resolver/cli-writer.txt` into process environment (`HIQS_EMAIL`, `HIQS_PASSWORD`).
- **App URL**: `HIQS_APP_URL` defaults to `https://resolve.hiqs.ai`.

## 0.5 Route resolve (dogfood #27)

Before an **agy** grounded-discovery batch, establish an approved hosted route. Prefer the **skill-local** script (vendored by Army HQ intake); the repo-root wrapper still works:

```bash
# Prefer skill-local (works from skill dir, Deployed Skills copy, or repo):
bash "${SKILL_DIR:-skills/ai-catalog-update}/scripts/resolve-job.sh" "scout grounded discovery"
# From hiqs-ai-resolve repo root (thin wrapper → skill-local):
bash scripts/resolve-job.sh "scout grounded discovery"
```

Policy and dogfood catalog stay in the **hiqs-ai-resolve** checkout (not vendored into Deployed Skills for week-1). The script finds repo root via `HIQS_RESOLVE_ROOT`, then an upward walk from cwd / script dir looking for `docs/catalog-ops/neochrome.policy.json` + dogfood fixtures. Daily Scout should run from the Mini checkout. If no checkout is found, exit 3 with a clear error (or set absolute `RESOLVE_POLICY` / `RESOLVE_CATALOG`).

- **Refusal (exit 2):** stop hosted LLM discovery for that batch. Log the refusal digest/result. Do **not** invent a model or silently fall back.
- **Resolved (exit 0):** record *selected* route vs route *actually used* in the ledger. No silent substitution — if execution cannot use the resolved route, stop and say so.
- **Out of Resolve:** local LM Studio / Bonsai L2 remain a **caller** concern (#26), not a Resolve output.
- **Catalog for dogfood:** default catalog is `fixtures/dogfood/scout-grounded-discovery.snapshot.json` until a live serving layer (bindings/aliases/claims) is published. Do not publish registry records from this path.

Env overrides (optional): `HIQS_RESOLVE_ROOT`, `RESOLVE_HARNESS`, `RESOLVE_POLICY`, `RESOLVE_CATALOG`, `RESOLVE_LOCK_DIR`, `ALLOWED_GATEWAYS`.

## 1. The Fixed-Shape Session (60 Minutes)

| Timebox | Phase | Action |
| --- | --- | --- |
| **00–05m** | **Open & Triage** | Read `docs/catalog-ops/ledger.md` and `docs/catalog-ops/queue.md`. Query live registry via `bun scripts/registry-cli.ts list` or curl. Select today's focused batch (e.g., 2–3 harnesses OR 4–6 models/services OR 1–3 runtimes). |
| **05–20m** | **Discovery** | Run **Antigravity (`agy`)** grounded discovery across the target categories (default: `scripts/agy-search.sh --category …`), then check primary seed hubs (including YouTube Local LLM intelligence and Raindrop bookmarks tagged `model` / `harness` / `gateway` / `service` / `runtime` from the last 14 days). Extract candidate entity names, releases, versions, and lead URLs. Fall back to `gemini-search.ts` only if `agy` is unavailable. |
| **20–35m** | **Verification** | Fetch authoritative primary sources (official docs, GitHub repos, npm/PyPI packages, official Hugging Face model cards) using Browserbase / HTTP fetch. Field values must be visible in fetched markdown. |
| **35–45m** | **Duplicate Check** | **Two-pass de-dupe (required before contribute):** (1) Deterministic: `bun skills/ai-catalog-update/scripts/check-duplicates.ts <drafts-dir | kind ns slug> [--source-url URL] [--hf-url URL]`. Catches exact keys, same-kind+same-slug across namespaces (e.g. `deepseek` vs `deepseek-ai`), vendor-suffix aliases (`*-ai`/`*-labs`), and shared GitHub/HF repos. If `exactDuplicates` or `fuzzyNearMatches` is nonempty → do **not** contribute a new identity; revise the existing key or flag for the operator. (2) Optional LLM review (Bonsai/agy) only on the fuzzy list — confirm same product vs genuine sibling; never LLM-only as the gate. | kind ns slug>`. If entity already exists, prepare a new revision (`r2+`) instead of a colliding new record. Flag near-matches for the operator. |
| **45–50m** | **Drafting** | Write schema-conformant JSON payloads to `temp/catalog-drafts/YYYY-MM-DD/<kind>-<ns>-<slug>.json`. Validate against `schemas/*.schema.json`. Unknowns: omit the key (or honest empties where the schema requires arrays). |
| **50–55m** | **Submission** | Submit drafts: `bun scripts/registry-cli.ts contribute <kind> <namespace> <slug> <file> --note "<source URLs>"`. **Never use `--publish`**. Existing entities receive a new revision (`r2`, `r3`, etc.). Immediately backfill record metadata when verified (see §6): `set-hf-url` and/or `set-source-url`, plus `set-license` when the vendor terms are visible on a primary source. |
| **55–60m** | **Close & Review** | Append run details to `docs/catalog-ops/ledger.md`. Update status in `docs/catalog-ops/queue.md`. Output review sheet with exact maintainer commands for publishing. |

## 2. Six Search & Discovery Categories

When running search discovery, rotate or cover these 6 core tracks:
1. **New AI Models**: Frontier and open releases from OpenAI, Anthropic, Google, Meta, Mistral, Cohere, xAI, etc.
2. **Chinese New Models**: Recent releases from DeepSeek, Qwen (Alibaba), Zhipu AI (GLM), Moonshot AI (Kimi), MiniMax, Baichuan, 01.AI (Yi), Tencent (Hunyuan), Baidu (Ernie), StepFun.
3. **International New Models**: European, Japanese, Korean, and global models (Mistral, Aleph Alpha, AI21 Labs, Sakana AI, Naver HyperCLOVA, etc.).
4. **New AI Harnesses**: Coding agent ecosystem, developer CLIs, IDE extensions, agent harnesses (Claude Code, Gemini CLI, Codex, OpenCode, Aider, Cline, Roo Code, Continue, Goose, Amp, Droid, Crush, Zed agent panel, Cursor, Windsurf). Do not put local inference servers here — use `runtime`.
5. **New AI Services & Gateways**: Managed inference platforms, proxy gateways, enterprise routers, and AI-enabled developer services (CloudZero LLM Gateways, OpenRouter, Portkey, LiteLLM, Cloudflare AI Gateway, Baseten, Together AI, Fireworks AI).
6. **YouTube Local LLM Intelligence & Local Runtimes**: New local models, GGUF/EXL2 quantization releases, Ollama modelfiles, and local runtime tooling (MLX LM, llama.cpp forks, local OpenAI-compatible servers) featured in creator reviews. Draft serving scaffolds as `runtime`, not `gateway`.

## 3. Seed Content Sources

In addition to Antigravity (`agy`) grounded discovery, check the following authoritative tracking locations:
- **Artificial Analysis** (`https://artificialanalysis.ai`): Leaderboard, latency benchmarks, pricing, and provider availability.
- **The Rundown AI** (`https://www.therundown.ai`): Daily AI releases, industry developments, and model launch notes.
- **CloudZero LLM Gateways** (`https://www.cloudzero.com/blog/llm-gateways/`): Taxonomy and feature comparisons of LLM routing and gateway architectures.
- **Simon Willison’s Weblog** (`https://simonwillison.net`): Developer notes, LLM tools, local models, CLI tooling, and prompt/harness releases.
- **YouTube Local LLM Video Intelligence** (`https://youtube.com`): Video reviews, teardowns, and local inference benchmarks.
- **Raindrop.io (personal library)**: Bookmarks tagged `model`, `harness`, `gateway`, `service`, or `runtime` from the last **14 days**. Leads only — still verify on primary sources before drafting. API: `https://developer.raindrop.io`.

## 4. Discovery & Helper Tools

- **Grounded Search (default — Antigravity)**: `skills/ai-catalog-update/scripts/agy-search.sh "<query>"` or `--category <models|chinese-models|international-models|harnesses|services|gateways>`. Uses `agy` + Gemini models with agent web search/fetch. Headless scout sets `AGY_SKIP_PERMISSIONS=1` (or pass through the script default).
- **Grounded Search (fallback — Gemini API)**: `bun skills/ai-catalog-update/scripts/gemini-search.ts "<query>"` or `--category …` only when `agy` is missing or auth fails.
- **Raindrop Leads**: `bun skills/ai-catalog-update/scripts/raindrop-leads.ts` (optional `--days N`, `--tags a,b`, `--json`)
- **Duplicate Checker**: `bun skills/ai-catalog-update/scripts/check-duplicates.ts <drafts-dir | kind ns slug>`
- **Record metadata (maintainer CLI)**:
  - `bun scripts/registry-cli.ts set-hf-url <kind> <ns> <slug> <https://huggingface.co/...|->`
  - `bun scripts/registry-cli.ts set-source-url <kind> <ns> <slug> <https://...|->`
  - `bun scripts/registry-cli.ts set-license <kind> <ns> <slug> <"apache-2.0"|-> [--url https://...]`

## 5. Guardrails & Boundaries

- **Drafts Only**: Autonomous sessions create drafts only. Publishing (`set-status <kind> <ns> <slug> published`), deletions, moves, and `publish-snapshot` remain operator-exclusive.
- **Duplicate Prevention**: Always run two-pass de-dupe before contribute (see Duplicate Check timebox). Exact or fuzzy hits → revise existing identity or flag; never create a parallel namespace variant (`deepseek-ai` vs `deepseek`) for the same product.
- **No Fabricated Claims**: Only attributes verified in fetched primary docs may enter payload JSONs. Never guess `pinStrength`, adapter compatibility, execution modes, `license` / `license_url`, or `source_url` / `hf_url`.
- **Single Writer Path**: All mutations must go through `scripts/registry-cli.ts` (`/api/public/registry`).
- **Immutable Revisions**: Revisions are immutable. Updates create a new revision (`r2`, etc.).
- **Stop Condition**: Stop at 60 minutes or when today's batch is complete. If primary sources cannot be verified for an entity, mark it `blocked` in `docs/catalog-ops/queue.md` with the reason.

## 6. Record Metadata Backfill (source URL + licensing)

Lovable/origin added **record-level** (not revision-payload) fields on `registry_records`. Capture them on every new draft and when refreshing existing entries, using values visible on primary sources only.

| Field | CLI | When to set | Notes |
| --- | --- | --- | --- |
| `hf_url` | `set-hf-url` | Model (or other) has an official Hugging Face page | Must be `https://huggingface.co/...`. Use `-` to clear. |
| `source_url` | `set-source-url` | Any record — vendor docs, product page, GitHub repo, or other primary web source | Any `http(s)` URL. Prefer the canonical homepage or docs landing page. Use when there is no HF page, or in addition to `hf_url` when a non-HF primary link matters (gateways, services, runtimes, hosted APIs). Use `-` to clear. |
| `license` | `set-license` | Vendor-published license / terms label is visible | Prefer SPDX id when stated (`apache-2.0`, `mit`, `openmdw-1.1`, …). Otherwise a short vendor label (max 200 chars). Use `-` as the license arg to clear license (+ omit or `-` URL). |
| `license_url` | `set-license ... --url` | Link to the terms / LICENSE file is known | Optional companion to `license`. Must be `http(s)`. |

**Workflow after each successful `contribute`:**

1. If an official Hugging Face model/org page was verified → `set-hf-url`.
2. Always set `set-source-url` to the best non-HF (or primary) web source used for verification when one exists (product site, docs, GitHub). For HF-only open weights, `hf_url` alone is enough; still set `source_url` when a distinct project/docs URL is clearer for operators.
3. If the model card, repo LICENSE, or vendor terms page names a license → `set-license "<id>" [--url <terms-url>]`.
4. Record what was set (or left empty and why) in the ledger and on the review sheet.

**Backfill existing drafts/published records** the same way when a scout re-touches an entity or when a dedicated metadata pass runs: list records missing `source_url` / `license`, verify on primary sources, then `set-source-url` / `set-license` (and `set-hf-url` if missing). Do not invent SPDX ids or URLs.

These fields are operator-recorded metadata, not legal advice. They are maintainer-gated via the registry API (`set_source_url`, `set_license`), same single-writer path as `set_hf_url`.
