#!/usr/bin/env bash
# Default grounded discovery for ai-catalog-update via Antigravity CLI (agy).
# Uses Google OAuth session (not GEMINI_API_KEY). Prefer this over gemini-search.ts.
set -euo pipefail

AGY_BIN="${AGY_BIN:-$(command -v agy || true)}"
MODEL="${AGY_MODEL:-gemini-3.8-flash-medium}"
EFFORT="${AGY_EFFORT:-medium}"
TIMEOUT="${AGY_PRINT_TIMEOUT:-3m}"
# Headless catalog runs cannot answer interactive permission prompts.
# Prefer AGY_SKIP_PERMISSIONS=0 once a tight permissions.allow rule exists.
SKIP_PERMS="${AGY_SKIP_PERMISSIONS:-1}"

CATEGORY_PROMPTS_models='What are the most notable new AI frontier and open-weight models released recently? List model family, release date, organization, and provide primary source links (official announcement, Hugging Face, or documentation).'
CATEGORY_PROMPTS_chinese_models='What are recent new Chinese AI LLM and reasoning models released by labs like DeepSeek, Qwen / Alibaba, Zhipu AI / GLM, Moonshot AI / Kimi, MiniMax, Baichuan, 01.AI, Tencent, or Baidu? Provide release date, organization, model id, and official links.'
CATEGORY_PROMPTS_international_models='What are recent notable international AI models released outside the US and China (e.g. Mistral AI, Aleph Alpha, AI21 Labs, Sakana AI, Naver, Kyutai)? Provide model names, release dates, and primary source links.'
CATEGORY_PROMPTS_harnesses='What are recent or popular AI coding agent harnesses, agent CLIs, IDE extensions, or agent execution frameworks (e.g. Claude Code, Gemini CLI, Codex, OpenCode, Aider, Cline, Roo Code, Continue, Goose, Amp, Droid, Crush)? List repo/package name, execution mode (cli/library/ide_extension), and official GitHub or documentation links.'
CATEGORY_PROMPTS_services='What are notable AI-enabled developer services, managed inference platforms, and LLM gateways (e.g. OpenRouter, Portkey, LiteLLM, Cloudflare AI Gateway, Baseten, Together AI, Fireworks)? Provide service name, operator, key features, and official documentation links.'
CATEGORY_PROMPTS_gateways='What are the top LLM gateways and API proxy routers for AI models? List operator, API endpoints, supported transports, and official documentation URLs.'

usage() {
  cat <<'USAGE'
Usage:
  scripts/agy-search.sh "<query>"
  scripts/agy-search.sh --category <models|chinese-models|international-models|harnesses|services|gateways>

Env:
  AGY_BIN, AGY_MODEL (default gemini-3.8-flash-medium), AGY_EFFORT, AGY_PRINT_TIMEOUT,
  AGY_SKIP_PERMISSIONS (default 1 for headless scout)

Requires: Antigravity CLI (`agy`) signed in via Google OAuth.
USAGE
}

if [[ $# -eq 0 || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "$AGY_BIN" || ! -x "$AGY_BIN" ]]; then
  echo '{"error":"agy not found on PATH. Install Antigravity CLI and sign in."}' >&2
  exit 1
fi

QUERY=""
if [[ "${1:-}" == "--category" ]]; then
  CAT="${2:-}"
  case "$CAT" in
    models) QUERY="$CATEGORY_PROMPTS_models" ;;
    chinese-models) QUERY="$CATEGORY_PROMPTS_chinese_models" ;;
    international-models) QUERY="$CATEGORY_PROMPTS_international_models" ;;
    harnesses) QUERY="$CATEGORY_PROMPTS_harnesses" ;;
    services) QUERY="$CATEGORY_PROMPTS_services" ;;
    gateways) QUERY="$CATEGORY_PROMPTS_gateways" ;;
    *) QUERY="Find recent AI developments in category: ${CAT}" ;;
  esac
else
  QUERY="$*"
fi

PREFIX='You are the discovery helper for HiQS AI Resolve catalog ops. Use web search and URL fetch only (no file edits, no shell writes). Return concrete entities with official primary URLs. Prefer recent releases. Do not invent links.'
FULL_PROMPT="${PREFIX}

${QUERY}"

ARGS=(
  --print="$FULL_PROMPT"
  --model="$MODEL"
  --effort="$EFFORT"
  --output-format=text
  --print-timeout="$TIMEOUT"
  --mode=plan
)
if [[ "$SKIP_PERMS" == "1" || "$SKIP_PERMS" == "true" ]]; then
  ARGS+=(--dangerously-skip-permissions)
fi

exec "$AGY_BIN" "${ARGS[@]}"
