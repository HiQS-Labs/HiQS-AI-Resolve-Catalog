#!/usr/bin/env bun
/**
 * Discovery helper for the ai-catalog-update skill.
 * Calls Gemini 2.5 Flash with Google Search grounding to discover recent AI models,
 * harnesses, services, and gateways with primary citation URLs.
 *
 * Usage:
 *   bun skills/ai-catalog-update/scripts/gemini-search.ts "What are recent new Chinese LLM models?"
 *   bun skills/ai-catalog-update/scripts/gemini-search.ts --category models
 *   bun skills/ai-catalog-update/scripts/gemini-search.ts --category chinese-models
 *   bun skills/ai-catalog-update/scripts/gemini-search.ts --category international-models
 *   bun skills/ai-catalog-update/scripts/gemini-search.ts --category harnesses
 *   bun skills/ai-catalog-update/scripts/gemini-search.ts --category services
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CATEGORY_PROMPTS: Record<string, string> = {
  models:
    "What are the most notable new AI frontier and open-weight models released recently? List model family, release date, organization, and provide primary source links (official announcement, Hugging Face, or documentation).",
  "chinese-models":
    "What are recent new Chinese AI LLM and reasoning models released by labs like DeepSeek, Qwen / Alibaba, Zhipu AI / GLM, Moonshot AI / Kimi, MiniMax, Baichuan, 01.AI, Tencent, or Baidu? Provide release date, organization, model id, and official links.",
  "international-models":
    "What are recent notable international AI models released outside the US and China (e.g. Mistral AI, Aleph Alpha, AI21 Labs, Sakana AI, Naver, Kyutai)? Provide model names, release dates, and primary source links.",
  harnesses:
    "What are recent or popular AI coding agent harnesses, agent CLIs, IDE extensions, or agent execution frameworks (e.g. Claude Code, Gemini CLI, Codex, OpenCode, Aider, Cline, Roo Code, Continue, Goose, Amp, Droid, Crush)? List repo/package name, execution mode (cli/library/ide_extension), and official GitHub or documentation links.",
  services:
    "What are notable AI-enabled developer services, managed inference platforms, and LLM gateways (e.g. OpenRouter, Portkey, LiteLLM, Cloudflare AI Gateway, Baseten, Together AI, Fireworks)? Provide service name, operator, key features, and official documentation links.",
  gateways:
    "What are the top LLM gateways and API proxy routers for AI models? List operator, API endpoints, supported transports, and official documentation URLs.",
};

function resolveKey(): string {
  if (process.env["GEMINI_API_KEY"]) return process.env["GEMINI_API_KEY"].trim();
  const keyFile = process.env["GEMINI_KEY_FILE"] ?? join(homedir(), "secrets", "gemini-paid-key.txt");
  if (existsSync(keyFile)) {
    return readFileSync(keyFile, "utf8").trim();
  }
  throw new Error(`Gemini API key not found in GEMINI_API_KEY or ${keyFile}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: bun gemini-search.ts "<query>" | --category <name>`);
    console.log(`Categories: ${Object.keys(CATEGORY_PROMPTS).join(", ")}`);
    process.exit(0);
  }

  let query = "";
  const catIdx = args.indexOf("--category");
  if (catIdx !== -1 && args[catIdx + 1]) {
    const cat = args[catIdx + 1].toLowerCase();
    query = CATEGORY_PROMPTS[cat] ?? `Find recent AI developments in category: ${cat}`;
  } else {
    query = args.join(" ");
  }

  let apiKey: string;
  try {
    apiKey = resolveKey();
  } catch (err) {
    console.error(JSON.stringify({ error: String(err) }));
    process.exit(1);
  }

  const model = process.env["GEMINI_MODEL"] ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [{ text: query }],
      },
    ],
    tools: [
      {
        google_search: {},
      },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(JSON.stringify({ error: `Gemini API HTTP ${response.status}`, details: errorBody }));
    process.exit(2);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      groundingMetadata?: {
        webSearchQueries?: string[];
        groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
        groundingSupports?: Array<unknown>;
      };
    }>;
  };

  const candidate = data.candidates?.[0];
  const answer = candidate?.content?.parts?.map((p) => p.text).join("\n") ?? "";
  const groundingChunks = candidate?.groundingMetadata?.groundingChunks ?? [];
  const sources = groundingChunks
    .map((c) => ({
      title: c.web?.title ?? "",
      uri: c.web?.uri ?? "",
    }))
    .filter((s) => Boolean(s.uri));

  // Deduplicate sources by uri
  const seen = new Set<string>();
  const dedupedSources = sources.filter((s) => {
    if (seen.has(s.uri)) return false;
    seen.add(s.uri);
    return true;
  });

  const output = {
    query,
    answer,
    sources: dedupedSources,
    webSearchQueries: candidate?.groundingMetadata?.webSearchQueries ?? [],
  };

  console.log(JSON.stringify(output, null, 2));
}

await main().catch((err) => {
  console.error(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
});
