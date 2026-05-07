import fs from "node:fs";
import path from "node:path";
import { type ModelProviderConfig } from "openclaw/plugin-sdk/provider-model-shared";
import type { ModelDefinitionConfig } from "openclaw/plugin-sdk/provider-model-shared";
import { createSubsystemLogger } from "openclaw/plugin-sdk/runtime-env";
import { resolveStateDir } from "openclaw/plugin-sdk/state-paths";

export const SHENGSUANYUN_BASE_URL = "https://test-router.claw.shengsuanyun.com/api/v1";
export const SHENGSUANYUN_MODALITIES_BASE_URL = "https://api.shengsuanyun.com/modelrouter";

const log = createSubsystemLogger("models");
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getCachePath(name: string) {
  const stateDir = resolveStateDir();
  return path.join(stateDir, "agents", `${name}.json`);
}

type CacheWrap<T> = { timestamp: number; data: T };

function loadCache<T>(name: string): T | null {
  try {
    const p = getCachePath(name);
    if (!fs.existsSync(p)) {
      return null;
    }
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw) as CacheWrap<T>;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      return null;
    }
    return parsed.data;
  } catch (e) {
    log.warn(`load cache ${name} failed: ${String(e)}`);
    return null;
  }
}

function saveCache<T>(name: string, data: T) {
  try {
    const p = getCachePath(name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const payload: CacheWrap<T> = { timestamp: Date.now(), data };
    fs.writeFileSync(p, JSON.stringify(payload), "utf-8");
  } catch (e) {
    log.warn(`save cache ${name} failed: ${String(e)}`);
  }
}

export interface ShengSuanYunModel {
  id: string;
  name: string;
  description: string;
  max_tokens: number;
  context_window: number;
  architecture: { input: string };
  support_apis: string[];
  pricing: {
    prompt: number;
    completion: number;
    cache: number;
  };
}

export interface ShengSuanYunModelsResponse {
  data: ShengSuanYunModel[];
  success: boolean;
}

function isReasoningModel(m: ShengSuanYunModel) {
  const s = `${m.id} ${m.name} ${m.description}`.toLowerCase();
  return /thinking|reason|r1/.test(s);
}

function supportsVision(m: ShengSuanYunModel) {
  const i = (m.architecture?.input ?? "").toLowerCase();
  return i.includes("image") || i.includes("vision") || i === "text+image->text";
}

function mapModels(list: ShengSuanYunModel[]): ModelDefinitionConfig[] {
  return list
    .filter((m) => Array.isArray(m.support_apis) && m.support_apis.includes("/v1/messages"))
    .map((m) => ({
      id: m.id,
      name: m.name,
      reasoning: isReasoningModel(m),
      api: "openai-completions",
      input: supportsVision(m) ? ["text", "image"] : ["text"],
      cost: {
        input: m.pricing.prompt,
        output: m.pricing.completion,
        cacheRead: m.pricing.cache,
        cacheWrite: m.pricing.cache,
      },
      contextWindow: m.context_window || 128000,
      maxTokens: m.max_tokens || 8192,
    }));
}

export async function discoverShengSuanYunModels(): Promise<ModelDefinitionConfig[]> {
  const cacheKey = "ssy_models";

  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return loadCache<ModelDefinitionConfig[]>(cacheKey) ?? [];
  }

  try {
    const res = await fetch(`${SHENGSUANYUN_BASE_URL}/models`, {
      signal: AbortSignal.timeout(50000),
    });
    await tryRes(res);

    const json = (await res.json()) as ShengSuanYunModelsResponse;
    if (!json.success || !Array.isArray(json.data)) {
      throw new Error("invalid response");
    }

    const mapped = mapModels(json.data);
    if (mapped.length > 0) {
      saveCache(cacheKey, mapped);
      return mapped;
    }
    return loadCache<ModelDefinitionConfig[]>(cacheKey) ?? [];
  } catch (e) {
    log.warn(`discover models failed: ${String(e)}`);
    return loadCache<ModelDefinitionConfig[]>(cacheKey) ?? [];
  }
}

export type MModel = {
  id: number;
  company_name: string;
  model_name: string;
  api_name: string;
  class_names: string[];
  desc: string;
  input_schema: string;
  output_schema: string;
  example: unknown;
  pricing: unknown;
};

interface ShengSuanYunModalitiesResponse {
  code: number;
  data: { infos: { id: number }[] };
}

export async function getShengSuanYunModalityModels(): Promise<MModel[]> {
  const cacheKey = "ssy_modalities";
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return loadCache<MModel[]>(cacheKey) ?? [];
  }
  const cached = loadCache<MModel[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const res = await fetch(
      `${SHENGSUANYUN_MODALITIES_BASE_URL}/modalities/list?page=1&page_size=200`,
      { signal: AbortSignal.timeout(30000) },
    );
    await tryRes(res);
    const json = (await res.json()) as ShengSuanYunModalitiesResponse;
    if (json.code !== 0 || !Array.isArray(json.data?.infos)) {
      throw new Error("invalid");
    }

    const ids = json.data.infos.map((i) => i.id);
    const results: MModel[] = [];

    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const items = await Promise.all(
        batch.map(async (id) => {
          try {
            const r = await fetch(
              `${SHENGSUANYUN_MODALITIES_BASE_URL}/modalities/info?model_id=${id}`,
              { signal: AbortSignal.timeout(60000) },
            );
            if (!r.ok) {
              return null;
            }
            const j = await r.json();
            return j.code === 0 && j.data ? j.data : null;
          } catch {
            return null;
          }
        }),
      );

      results.push(...(items.filter(Boolean) as MModel[]));
      if (i + 10 < ids.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    if (results.length) {
      saveCache(cacheKey, results);
    }
    return results.length ? results : (cached ?? []);
  } catch (e) {
    log.warn(`modalities fetch failed: ${String(e)}`);
    return cached ?? [];
  }
}

export async function buildShengSuanYunProvider(): Promise<ModelProviderConfig> {
  const models = await discoverShengSuanYunModels();
  return {
    baseUrl: SHENGSUANYUN_BASE_URL,
    api: "anthropic-messages",
    models,
    headers: {
      "HTTP-Referer": "https://openclaw.ai",
      "X-Title": "OpenClaw",
    },
  };
}

async function tryRes(res: Response) {
  if (res.ok) {
    return;
  }
  let errorDetail = "";
  try {
    const errorData = await res.json();
    errorDetail = errorData?.message || errorData?.error || JSON.stringify(errorData);
  } catch {
    errorDetail = await res.text();
  }

  const errorMessage = errorDetail
    ? `API Error (${res.status}): ${errorDetail}`
    : `HTTP Error: ${res.status} ${res.statusText}`;
  throw new Error(errorMessage);
}
