#!/usr/bin/env bash
# Week-0 dogfood wrapper (#27): resolve one job phrase to a hosted route, or refuse.
# Bundled under skills/ai-catalog-update/scripts/ so Army HQ intake vendors it.
#
# Caller invariants (documented as caller rules — not resolver features):
#   - ALLOWED_GATEWAYS allowlist: unapproved gateways never execute
#   - refusal → exit 2, no silent fallback / invented model
#   - local LM Studio / Bonsai L2 is OUT of Resolve (caller / #26)
#
# REPO_ROOT: policy/catalog live in the hiqs-ai-resolve checkout (not in Deployed
# Skills). Discovery order: HIQS_RESOLVE_ROOT → walk up from cwd/script for repo
# markers. Daily Scout runs from the Mini checkout — week-1 needs that only.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

find_repo_root() {
  local start="$1"
  local dir
  dir="$(cd "$start" && pwd)"
  while true; do
    if [[ -f "$dir/docs/catalog-ops/neochrome.policy.json" \
       && -f "$dir/fixtures/dogfood/scout-grounded-discovery.snapshot.json" \
       && -f "$dir/package.json" ]]; then
      printf '%s\n' "$dir"
      return 0
    fi
    # also accept classic layout: scripts/resolve-job at repo + hiqs package
    if [[ -f "$dir/docs/catalog-ops/neochrome.policy.json" \
       && -d "$dir/fixtures/dogfood" \
       && ( -f "$dir/bun.lock" || -f "$dir/bun.lockb" || -d "$dir/skills/ai-catalog-update" ) ]]; then
      printf '%s\n' "$dir"
      return 0
    fi
    if [[ "$dir" == "/" ]]; then
      return 1
    fi
    dir="$(dirname "$dir")"
  done
}

ROOT=""
if [[ -n "${HIQS_RESOLVE_ROOT:-}" ]]; then
  ROOT="$(cd "$HIQS_RESOLVE_ROOT" && pwd)"
elif ROOT="$(find_repo_root "$(pwd)")"; then
  :
elif ROOT="$(find_repo_root "$SCRIPT_DIR")"; then
  :
else
  echo "resolve-job: cannot find hiqs-ai-resolve repo root (policy/catalog)." >&2
  echo "  Set HIQS_RESOLVE_ROOT to the checkout, or run from inside that repo." >&2
  echo "  Optional overrides: RESOLVE_POLICY / RESOLVE_CATALOG (absolute paths)." >&2
  echo "  Skill dir: $SKILL_DIR" >&2
  exit 3
fi

cd "$ROOT"

JOB="${1:-}"
if [[ -z "$JOB" ]]; then
  echo "usage: skills/ai-catalog-update/scripts/resolve-job.sh \"<job phrase>\"" >&2
  echo "   or: scripts/resolve-job.sh \"<job phrase>\" (repo-root wrapper)" >&2
  exit 3
fi

HARNESS="${RESOLVE_HARNESS:-harness:antigravity/agy@r1}"
POLICY="${RESOLVE_POLICY:-docs/catalog-ops/neochrome.policy.json}"
CATALOG="${RESOLVE_CATALOG:-fixtures/dogfood/scout-grounded-discovery.snapshot.json}"
LOCK_DIR="${RESOLVE_LOCK_DIR:-temp/resolve-locks}"
# Comma-separated entity refs. New gateways must be listed before they can run.
ALLOWED_GATEWAYS="${ALLOWED_GATEWAYS:-gateway:route/provider-native@r1,gateway:route/openrouter@r1}"

# If overrides are relative, resolve against ROOT
if [[ "$POLICY" != /* ]]; then POLICY="$ROOT/$POLICY"; fi
if [[ "$CATALOG" != /* ]]; then CATALOG="$ROOT/$CATALOG"; fi
if [[ "$LOCK_DIR" != /* ]]; then LOCK_DIR="$ROOT/$LOCK_DIR"; fi

if [[ ! -f "$POLICY" ]]; then
  echo "resolve-job: policy not found: $POLICY" >&2
  exit 3
fi
if [[ ! -f "$CATALOG" ]]; then
  echo "resolve-job: catalog not found: $CATALOG" >&2
  exit 3
fi

mkdir -p "$LOCK_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SAFE_JOB="$(printf '%s' "$JOB" | tr -cs 'A-Za-z0-9._-' '_' | cut -c1-64)"
BASE="${LOCK_DIR}/${STAMP}-${SAFE_JOB}"
LOCK_PATH="${BASE}.lock.json"
RESULT_PATH="${BASE}.result.json"
DIGEST_PATH="${BASE}.route.txt"

set +e
bun run hiqs -- resolve "$JOB" \
  --harness "$HARNESS" \
  --policy "$POLICY" \
  --catalog "$CATALOG" \
  --lock "$LOCK_PATH" \
  --json >"$RESULT_PATH"
RC=$?
set -e

if [[ "$RC" -eq 2 ]]; then
  {
    echo "status=refused"
    echo "job=$JOB"
    echo "harness=$HARNESS"
    echo "catalog=$CATALOG"
    echo "policy=$POLICY"
    echo "repo_root=$ROOT"
    echo "result=$RESULT_PATH"
    echo "lock=$LOCK_PATH"
  } | tee "$DIGEST_PATH" >&2
  echo "resolve-job: refused (exit 2) — no inference; see $RESULT_PATH" >&2
  exit 2
fi

if [[ "$RC" -ne 0 ]]; then
  echo "resolve-job: hiqs resolve failed with exit $RC — see $RESULT_PATH" >&2
  exit "$RC"
fi

# Extract route fields (keys match cli JSON: bindingId, requestModelIdentifier).
read -r GATEWAY MODEL BINDING WIRE EVID <<<"$(python3 - "$RESULT_PATH" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
r = d.get("route") or {}
print(
    r.get("gateway") or "",
    r.get("model") or "",
    r.get("bindingId") or "",
    r.get("requestModelIdentifier") or "",
    r.get("verification") or "",
)
PY
)"

if [[ -z "$GATEWAY" ]]; then
  echo "resolve-job: resolved payload missing route.gateway — see $RESULT_PATH" >&2
  exit 3
fi

ALLOWED=0
IFS=',' read -r -a ALLOW <<< "$ALLOWED_GATEWAYS"
for g in "${ALLOW[@]}"; do
  g_trimmed="$(printf '%s' "$g" | xargs)"
  if [[ "$GATEWAY" == "$g_trimmed" ]]; then
    ALLOWED=1
    break
  fi
done

if [[ "$ALLOWED" -ne 1 ]]; then
  echo "resolve-job: gateway $GATEWAY not in ALLOWED_GATEWAYS ($ALLOWED_GATEWAYS) — fail closed" >&2
  echo "status=caller_deny gateway=$GATEWAY" | tee "$DIGEST_PATH" >&2
  exit 2
fi

# Retain snapshot + policy bytes beside the lock for offline replay (PR-04).
cp -f "$CATALOG" "${BASE}.catalog.json"
cp -f "$POLICY" "${BASE}.policy.json"

{
  echo "status=resolved"
  echo "job=$JOB"
  echo "harness=$HARNESS"
  echo "gateway=$GATEWAY"
  echo "model=$MODEL"
  echo "binding=$BINDING"
  echo "wire_model=$WIRE"
  echo "evidence=$EVID"
  echo "catalog=$CATALOG"
  echo "policy=$POLICY"
  echo "repo_root=$ROOT"
  echo "lock=$LOCK_PATH"
  echo "result=$RESULT_PATH"
  echo "replay_catalog=${BASE}.catalog.json"
  echo "replay_policy=${BASE}.policy.json"
} | tee "$DIGEST_PATH"

echo "route  $HARNESS → $GATEWAY → $MODEL  (binding $BINDING, wire $WIRE, $EVID)"
exit 0
