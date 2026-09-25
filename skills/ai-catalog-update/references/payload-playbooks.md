# Payload Playbooks — AI Catalog Update

Checklists, rules, and field guidelines for constructing valid JSON payloads for the HiQS AI Resolve registry (`schemas/*.schema.json`).

---

## 1. Shared Base Fields (All Kinds)

Every payload must supply:

| Field | Type | Rule |
| --- | --- | --- |
| `namespace` | string | Lowercase letters, numbers, hyphens (`^[a-z0-9][a-z0-9-]*$`). Canonical provider/org. |
| `id` | string | Lowercase letters, numbers, dots, hyphens, underscores (`^[a-z0-9][a-z0-9._-]*$`). |
| `revision` | string | `r1` for new entities; increment (`r2`, `r3`) when revising existing records. |
| `label` | string | Human-readable upstream display name (e.g. `DeepSeek-V3`, `Roo Code`). |
| `lifecycle` | string | `active`, `deprecated`, or `withdrawn`. |
| `recordedBy` | string | Maintainer email (from `cli-writer.txt`). |
| `recordedAt` | string | Current ISO-8601 UTC timestamp of record capture (`YYYY-MM-DDTHH:MM:SS.000Z`). |
| `claimRefs` | string[] | Array of claim IDs. If none, use honest empty `[]`. Never put URLs here. |
| `layer` | string | Const `"published"`. |
| `kind` | string | Const `"model"`, `"harness"`, `"service"`, `"gateway"`, or `"runtime"`. |

---

## 2. Model Playbook (`schemas/model.schema.json`)

```json
{
  "namespace": "deepseek",
  "id": "deepseek-v3",
  "revision": "r1",
  "label": "DeepSeek V3",
  "lifecycle": "active",
  "recordedBy": "maintainer@example.com",
  "recordedAt": "2026-09-15T00:00:00.000Z",
  "claimRefs": [],
  "layer": "published",
  "kind": "model",
  "family": "DeepSeek-V3",
  "releaseLabel": "2024-12",
  "pinStrength": "provider_release",
  "hosted": true
}
```

### Specific Fields:
- `family`: Upstream model family or lineage.
- `releaseLabel`: Release date or upstream release tag (e.g. `2024-12`, `v3.0`).
- `pinStrength`:
  - `"artifact_digest"`: Exact model weight SHA/digest is pinned.
  - `"provider_release"`: Pinned to specific named version/checkpoint from provider.
  - `"mutable_alias"`: Unpinned rolling alias (e.g., `latest`).
  - `"unknown"`: Pin strength cannot be determined.
- `artifactDigest`: (Optional) Authoritative digest string if verified.
- `hosted`: `true` if hosted API endpoint exists; `false` if weights-only/local.
- Note: Hugging Face URLs go in the submission `--note` or separate `set-hf-url` CLI call, not inside the immutable revision payload.

### Common Model Namespaces:
- **US Frontier**: `openai`, `anthropic`, `google`, `meta`, `xai`, `cohere`
- **Chinese Labs**: `deepseek`, `qwen` (Alibaba), `z-ai` (Zhipu AI / GLM), `moonshotai` (Kimi), `minimax`, `baichuan`, `01-ai` (Yi), `tencent` (Hunyuan), `baidu` (Ernie), `stepfun`
- **International**: `mistralai`, `aleph-alpha`, `ai21`, `sakana-ai`, `naver`, `kyutai`

---

## 3. Harness Playbook (`schemas/harness.schema.json`)

```json
{
  "namespace": "rooveterinaryinc",
  "id": "roo-code",
  "revision": "r1",
  "label": "Roo Code",
  "lifecycle": "active",
  "recordedBy": "maintainer@example.com",
  "recordedAt": "2026-09-15T00:00:00.000Z",
  "claimRefs": [],
  "layer": "published",
  "kind": "harness",
  "packageRef": "https://github.com/RooVetGit/Roo-Code",
  "executionMode": "ide_extension",
  "adapters": ["openai", "anthropic", "openrouter", "ollama"],
  "capabilities": ["code_generation", "tool_calling", "terminal_execution", "diff_editing"]
}
```

### Specific Fields:
- `packageRef`: Exact repository URL or package specifier (e.g. `npm:@anthropic-ai/claude-code`, `https://github.com/cline/cline`).
- `executionMode`: `"cli"`, `"library"`, or `"ide_extension"`.
- `adapters`: Array of verified provider adapters or API formats documented upstream (e.g. `["openai", "anthropic", "gemini", "bedrock", "ollama"]`).
- `capabilities`: Documented capabilities only (e.g. `["code_editing", "terminal_execution", "browser_automation", "tool_use"]`).

---

## 4. Service Playbook (`schemas/service.schema.json`)

```json
{
  "namespace": "together-ai",
  "id": "inference-engine",
  "revision": "r1",
  "label": "Together AI Inference Engine",
  "lifecycle": "active",
  "recordedBy": "maintainer@example.com",
  "recordedAt": "2026-09-15T00:00:00.000Z",
  "claimRefs": [],
  "layer": "published",
  "kind": "service",
  "productScope": "Serverless and dedicated inference platform for open-source foundation models",
  "operations": [
    {
      "name": "chat_completions",
      "description": "OpenAI-compatible chat completions endpoint",
      "modelUsages": [
        {
          "role": "generation",
          "exposure": "configurable",
          "modelRef": null,
          "claimRefs": []
        }
      ]
    }
  ]
}
```

### Specific Fields:
- `productScope`: Concise description of the service scope.
- `operations`: Array of operations with `name`, `description`, and `modelUsages`.
  - `exposure`: `"fixed"`, `"configurable"`, or `"undisclosed"`.
  - `modelRef`: Versioned model reference (e.g. `model:meta/llama-3.3-70b-instruct@r1`) or `null`.

---

## 5. Gateway Playbook (`schemas/gateway.schema.json`)

```json
{
  "namespace": "portkey",
  "id": "ai-gateway",
  "revision": "r1",
  "label": "Portkey AI Gateway",
  "lifecycle": "active",
  "recordedBy": "maintainer@example.com",
  "recordedAt": "2026-09-15T00:00:00.000Z",
  "claimRefs": [],
  "layer": "published",
  "kind": "gateway",
  "apiRevision": "v1",
  "operator": "Portkey",
  "transports": ["https", "grpc"]
}
```

### Specific Fields:
- `apiRevision`: Documented API version/revision (e.g. `"v1"`, `"2024-01-01"`).
- `operator`: Organization operating the gateway.
- `transports`: Supported network protocols (e.g. `["https"]`).

---

## 6. Review Notes & Verification Checklist

When drafting the contribution note (`--note "<sources>"`):
1. Must include at least 1–2 authoritative primary source URLs (e.g. `https://github.com/...`, `https://docs.anthropic.com/...`).
2. Include brief description of what was verified.
3. Example: `--note "Verified from official docs https://docs.continue.dev and repo https://github.com/continuedev/continue"`
