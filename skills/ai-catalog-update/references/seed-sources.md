# Seed Content Sources & Search Categories

This document defines the primary intelligence feeds, YouTube channels, and Google search discovery categories for the `ai-catalog-update` workflow.

---

## 1. Primary Seed Content Locations

| Source | URL | Primary Focus | Discovery Targets |
| --- | --- | --- | --- |
| **Artificial Analysis** | `https://artificialanalysis.ai` | Model leaderboards, quality indices, token pricing, latency benchmarks, host provider availability | New frontier models, open weight benchmarks, hosted model variants, provider latency |
| **The Rundown AI** | `https://www.therundown.ai` | Daily AI industry news, product launches, lab announcements | Breaking model releases, major version jumps, AI platform launches |
| **CloudZero LLM Gateways** | `https://www.cloudzero.com/blog/llm-gateways/` | Technical analysis of LLM routing architectures, enterprise gateway features | LLM gateways (Portkey, LiteLLM, Cloudflare AI Gateway, Martian, TrueFoundry, etc.) |
| **Simon Willison’s Weblog** | `https://simonwillison.net` | Engineering deep-dives, CLI tools, local models, prompt engineering, agent harnesses | Coding harnesses (llm CLI, datasette, open harnesses), open weight releases, developer tools |
| **YouTube Local LLM Intelligence** | `https://youtube.com` | Video teardowns, local inference benchmarks, GGUF/EXL2 testing, Ollama/LM Studio tutorials | Local-first models, quantized checkpoints, local runtimes, on-device agents |
| **Raindrop.io** | personal library via API | Curated bookmarks tagged for catalog ops | Models, harnesses, gateways, services the operator explicitly tagged |

---

## 1b. Raindrop lead rules

- **Auth**: `~/secrets/raindrop-local-mac-sync.txt` with `access_token=...` (required). Optional `refresh_token`, `client_id`, `client_secret` for refresh. Never commit or print tokens.
- **Include tags** (any one): `model`, `harness`, `gateway`, `service` — map 1:1 to registry kinds.
- **Lookback**: last **14 days** by `created` / `lastUpdate` (override with `--days`).
- **Role**: seed leads only. Bookmarked URLs are not payload truth; verify on primary sources before drafting.
- **Helper**: `bun skills/ai-catalog-update/scripts/raindrop-leads.ts [--json]`

## 2. Six Search & Discovery Categories

### Category 1: New AI Models
- **Scope**: Frontier foundation models and major open weights from US and global leaders.
- **Search Queries**:
  - `site:artificialanalysis.ai new models`
  - `"model release" OpenAI Anthropic Google Meta xAI Cohere`
  - `new frontier LLM release 2025 2026`
- **Primary Source Verification**: Official provider announcement blog posts, provider API documentation, official Hugging Face organization pages.

### Category 2: Chinese New Models
- **Scope**: Frontier LLMs, reasoning models, and multimodal architectures from Chinese research labs and tech giants.
- **Key Labs & Namespaces**:
  - `deepseek` (DeepSeek-V3, DeepSeek-R1, DeepSeek-Coder)
  - `qwen` / Alibaba Cloud (Qwen 2.5, Qwen-Max, Qwen-Plus, Qwen-VL, QwQ)
  - `z-ai` / Zhipu AI (GLM-4, GLM-4-Plus, GLM-4-Flash, GLM-Zero)
  - `moonshotai` (Kimi, Moonshot v1)
  - `minimax` (MiniMax-Text-01, MiniMax-01)
  - `baichuan` (Baichuan 4, Baichuan-Omni)
  - `01-ai` (Yi-1.5, Yi-Lightning)
  - `tencent` (Hunyuan-Large, Hunyuan-Standard)
  - `baidu` (ERNIE 4.0 Turbo, ERNIE Speed)
  - `stepfun` (Step-1, Step-2)
- **Search Queries**:
  - `"DeepSeek" OR "Qwen" OR "GLM-4" OR "MiniMax" OR "Moonshot" new model release`
  - `China frontier LLM tracker 2025 2026`
- **Primary Source Verification**: Official lab GitHub repos, Hugging Face orgs (`deepseek-ai`, `Qwen`, `THUDM`), lab API platforms.

### Category 3: International New Models
- **Scope**: Foundational and open-weight models originating outside the US and China.
- **Key Labs & Namespaces**:
  - `mistralai` (Mistral Large 2, Pixtral, Mistral NeMo, Codestral, Ministral)
  - `aleph-alpha` (Luminous)
  - `ai21` (Jamba 1.5 Mini/Large)
  - `sakana-ai` (Evo-Merge, Japanese LLMs)
  - `naver` (HyperCLOVA X)
  - `kyutai` (Moshi voice foundation model)
  - `tii` / UAE (Falcon 2, Falcon 180B)
- **Search Queries**:
  - `Mistral AI OR AI21 OR Sakana AI OR Kyutai new model release`
  - `European LLM open weights release`
- **Primary Source Verification**: Mistral documentation / HF org (`mistralai`), AI21 developer platform, Kyutai research releases.

### Category 4: New AI Harnesses
- **Scope**: Coding agent CLIs, IDE extensions, autonomous development harnesses, and agent execution runtimes.
- **Key Targets**:
  - `anthropic/claude-code`: CLI coding assistant
  - `google/gemini-cli`: Google Gemini CLI harness
  - `openai/codex`: Codex execution environment
  - `sst/opencode`: Open-source AI coding tool
  - `paul-gauthier/aider`: Terminal AI pair programmer
  - `cline/cline`: Autonomous coding agent for VS Code
  - `rooveterinaryinc/roo-code`: Community-driven fork of Cline with multi-mode agentic support
  - `continuedev/continue`: Open-source AI code assistant for VS Code & JetBrains
  - `block/goose`: On-machine agent harness from Block
  - `sourcegraph/amp`: Sourcegraph agent harness
  - `factory-ai/droid`: Factory Droid software development harness
  - `anomaly/crush`: Terminal-based workspace agent
- **Search Queries**:
  - `site:simonwillison.net "coding agent" OR "CLI"`
  - `AI coding agent harness GitHub CLI VSCode extension 2025 2026`
  - `trending AI agent CLI repository github`
- **Primary Source Verification**: Official GitHub repository `README.md`, release tags, package definitions (`package.json`, `pyproject.toml`), documentation sites.

### Category 5: New AI Services & Gateways
- **Scope**: Managed inference backends, model routing gateways, and AI proxy services.
- **Key Targets**:
  - `openrouter` (OpenRouter unified routing API)
  - `portkey` (Portkey AI Gateway)
  - `litellm` (LiteLLM Proxy server)
  - `cloudflare` (Cloudflare AI Gateway)
  - `baseten` (Baseten model deployment)
  - `together-ai` (Together AI inference platform)
  - `fireworks` (Fireworks AI inference engine)
  - `martian` (Martian Model Router)
  - `unify` (Unify AI router)
- **Search Queries**:
  - `site:cloudzero.com/blog/llm-gateways/`
  - `LLM gateway proxy routing platform 2025 2026`
- **Primary Source Verification**: Vendor product documentation, API documentation, GitHub open source proxy repos.

### Category 6: YouTube Local LLM Intelligence & Local Runtimes
- **Scope**: New local LLMs, GGUF/EXL2 quantization releases, Ollama modelfiles, and local runtime tooling featured in creator reviews and technical tutorials.
- **Key Channels & Creators to Track**:
  - Matthew Berman (`@matthew_berman`)
  - Wes Roth (`@WesRoth`)
  - WorldofAI (`@WorldofAI`)
  - Prompt Engineering (`@PromptEngineering`)
  - AI Explained (`@AIExplained`)
  - Fireship (`@Fireship`)
  - NetworkChuck (`@NetworkChuck`)
  - AI Jason (`@AIJason`)
- **Search Queries**:
  - `site:youtube.com ("Matthew Berman" OR "Wes Roth" OR "WorldofAI" OR "Prompt Engineering") "local LLM" OR "Ollama" 2025 2026`
  - `site:youtube.com "best local LLM" OR "new local LLM" "Ollama" OR "LM Studio" review 2025 2026`
  - `site:youtube.com "run locally" "llama.cpp" OR "vLLM" OR "Ollama" model release`
- **Verification Discipline for Video Leads**:
  1. Extract the exact model name, parameter size, architecture, and creator claim from the video title/description/transcript.
  2. Locate the primary source: official Hugging Face model card (e.g. `https://huggingface.co/...`), Ollama model library entry (`https://ollama.com/library/...`), or GitHub release.
  3. Validate `hosted: false` (or `true` if hosted endpoints also exist) and set `pinStrength: "artifact_digest"` or `"provider_release"`.
