import type { TextContent, ImageContent } from "@earendil-works/pi-ai";
import {
  getShengSuanYunModalityModels,
  SHENGSUANYUN_BASE_URL,
} from "@openclaw/shengsuanyun/provider-catalog.ts";
import { createSubsystemLogger } from "openclaw/plugin-sdk/logging-core";
import { Type, type TSchema } from "typebox";
import type { OpenClawConfig } from "../../../config/config.ts";
import { loadConfig } from "../../../config/config.ts";
import { resolveApiKeyForProvider } from "../../model-auth.ts";
import type { AnyAgentTool } from "../common.ts";
import { readStringParam, readStringArrayParam, readNumberParam } from "../common.ts";
import { toolDescriptionMap } from "./meta.ts";
import { saveMediaToWorkspace } from "./save-media.ts";
const log = createSubsystemLogger("shengsuanyun-generate-tools");
export const APP_HEADERS: Record<string, string> = {
  "HTTP-Referer": "https://openclaw.ai",
  "X-Title": "OpenClaw",
  "Content-Type": "application/json",
};
interface TaskRes {
  code: string;
  message: string;
  data: {
    request_id: string;
    task_id: string;
    action: string;
    status: string;
    fail_reason: string;
    submit_time: number;
    start_time: number;
    finish_time: number;
    progress: string;
    data: {
      image_urls?: string[];
      video_urls?: string[];
      audio_urls?: string[];
      file_urls?: string[];
      text?: string;
      progress: number;
    };
    [key: string]: unknown;
  };
}
async function generate(
  params: Record<string, unknown>,
): Promise<{ success: boolean; type?: string; Urls?: string[]; error?: string }> {
  try {
    const { apiKey, ...rest } = params;
    const res = await fetch(`${SHENGSUANYUN_BASE_URL}/tasks/generations`, {
      method: "POST",
      headers: {
        ...APP_HEADERS,
        Authorization: `Bearer ${apiKey as string}`,
      },
      body: JSON.stringify(rest),
    });

    if (!res.ok) {
      try {
        const errorData = await res.json();
        return { success: false, error: errorData.message || `Error ${res.status}` };
      } catch {
        return { success: false, error: `API Error: ${res.status} ${res.statusText}` };
      }
    }
    const data = (await res.json()) as TaskRes;
    if (data.code != "success" || !data.data?.request_id) {
      return { success: false, error: data.message || "No image URL returned in response" };
    }
    let errorCount = 0;
    while (true) {
      try {
        const imgs = await fetch(
          `${SHENGSUANYUN_BASE_URL}/tasks/generations/${data.data?.request_id}`,
          {
            method: "GET",
            headers: {
              ...APP_HEADERS,
              Authorization: `Bearer ${String(params.apiKey)}`,
            },
            signal: AbortSignal.timeout(30000),
          },
        );
        if (!imgs.ok) {
          throw new Error("Network error");
        }

        const img_urls = (await imgs.json()) as TaskRes;
        if (img_urls.code != "success") {
          throw img_urls.message;
        }
        if (img_urls.data?.status === "FAILED") {
          return {
            success: false,
            error: img_urls.data?.fail_reason || "Image generation failed",
          };
        }
        const currentProgress = img_urls.data?.data?.progress || 0;
        if (currentProgress >= 100 || img_urls.data?.status === "SUCCEEDED") {
          const data = img_urls.data?.data || {};
          const mediaKeys = ["image_urls", "video_urls", "audio_urls"] as const;
          const foundKey = mediaKeys.find((key) => data[key]);
          return {
            success: true,
            type: foundKey,
            Urls: data.image_urls || data.video_urls || data.audio_urls,
          };
        }
        let waitTime = 10000;

        if (currentProgress >= 90) {
          waitTime = 2000;
        } else if (currentProgress >= 60) {
          waitTime = 5000;
        } else if (currentProgress >= 30) {
          waitTime = 10000;
        } else {
          waitTime = 15000;
        }
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        errorCount = 0;
      } catch (e) {
        if (errorCount > 5) {
          console.log("polling error:", e);
          throw e;
        }
        errorCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

function sanitizeToolName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_");
}

async function loadShengSuanYunTools(opts?: {
  config?: OpenClawConfig;
  workspaceDir?: string;
}): Promise<AnyAgentTool[]> {
  const models = await getShengSuanYunModalityModels();
  const tools: AnyAgentTool[] = [];
  for (const model of models) {
    const label = `${model.company_name} ${model.model_name} Generate tool`;
    const name = sanitizeToolName(model.api_name);
    const description = toolDescriptionMap[model.api_name] || model.desc;
    let inputSchema: JsonSchema = {};
    try {
      inputSchema = JSON.parse(model.input_schema) as JsonSchema;
    } catch (e) {
      log.warn(`Failed to parse input schema for ${model.api_name}: ${e}`);
      continue;
    }
    let parameters: TSchema;
    try {
      parameters = generateTypebox(inputSchema);
    } catch (e) {
      log.warn(`Failed to generate typebox for ${model.api_name}: ${e}`);
      continue;
    }
    tools.push({
      label,
      name,
      description,
      parameters: parameters,
      execute: async (_toolCallId, args) => {
        log.debug(`Executing ${name}`, { args });
        const cfg = opts?.config ?? loadConfig();

        const providers = [
          "shengsuanyun",
          "ssy_cp_enterprise",
          "ssy_cp_lite",
          "ssy_cp_pro",
          "pay_as_you_go",
        ];
        const resolved = await Promise.any(
          providers.map(async (p) => {
            const res = await resolveApiKeyForProvider({ provider: p, cfg });
            if (res?.apiKey) {
              return res;
            }
            throw new Error("No Key");
          }),
        ).catch(() => null);

        if (!resolved?.apiKey) {
          throw new Error(
            "胜算云 API key 未配置。媒体生成工具需要先配置 API Key, https://console.shengsuanyun.com/user/keys",
          );
        }
        const params = args as Record<string, unknown>;
        const apiParams: Record<string, unknown> = { model: model.api_name };
        const extractParams = (schema: JsonSchema) => {
          if (!schema.properties) {
            return;
          }
          for (const [key, prop] of Object.entries(schema.properties)) {
            const isRequired = schema.required?.includes(key);

            if (prop.type === "array") {
              const value = readStringArrayParam(params, key, { required: isRequired });
              if (value !== undefined) {
                apiParams[key] = value;
              }
            } else if (prop.type === "number" || prop.type === "integer") {
              const value = readNumberParam(params, key, { required: isRequired });
              if (value !== undefined) {
                apiParams[key] = value;
              }
            } else {
              const value = readStringParam(params, key, { required: isRequired });
              if (value !== undefined) {
                apiParams[key] = value;
              }
            }
          }
        };

        if (inputSchema.anyOf && Array.isArray(inputSchema.anyOf)) {
          for (const subSchema of inputSchema.anyOf) {
            extractParams(subSchema);
          }
        } else {
          extractParams(inputSchema);
        }

        const result = await generate({ ...apiParams, apiKey: resolved.apiKey });
        if (result.success && result.Urls && result.Urls.length > 0) {
          const content: (TextContent | ImageContent)[] = [];
          const mediaType = result.type?.replace("_urls", "") ?? "media";

          if (opts?.workspaceDir) {
            const savedPaths: string[] = [];
            for (const url of result.Urls) {
              try {
                const { content: savedContent, filepath } = await saveMediaToWorkspace(
                  url,
                  opts.workspaceDir,
                  sanitizeToolName(model.api_name),
                );
                content.push(savedContent);
                savedPaths.push(filepath);
              } catch (err) {
                log.warn(`Failed to save media: ${err}`);
                content.push({ type: "text", text: `URL: ${url}` });
              }
            }

            const summary =
              savedPaths.length > 0
                ? `Generated ${savedPaths.length} ${mediaType}(s) and saved to workspace`
                : `Generated ${result.Urls.length} ${mediaType}(s)`;

            content.unshift({ type: "text", text: summary });

            return {
              content,
              details: {
                provider: "shengsuanyun",
                model: model.api_name,
                urls: result.Urls,
                mediaType,
                savedPaths: savedPaths.length > 0 ? savedPaths : undefined,
              },
            };
          }

          content.push({
            type: "text",
            text: `Generated ${result.Urls.length} ${mediaType}(s):\n${result.Urls.map((url, i) => `${i + 1}. ${url}`).join("\n")}`,
          });

          return {
            content,
            details: {
              provider: "shengsuanyun",
              model: model.api_name,
              urls: result.Urls,
              mediaType,
            },
          };
        }

        return {
          content: [
            {
              type: "text",
              text: result.error ?? "Media generation failed",
            },
          ],
          details: {
            error: result.error,
            provider: "shengsuanyun",
            model: model.api_name,
          },
        };
      },
    });
  }
  return tools;
}

interface JsonSchema {
  $schema?: string;
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  enum?: Array<string | number>;
  format?: string;
  ssy?: string;
  [key: string]: unknown;
}

export function generateTypebox(schema: JsonSchema): TSchema {
  const getOptions = (s: JsonSchema): Record<string, unknown> => {
    const options: Record<string, unknown> = {};
    if (s.title) {
      options.title = s.title;
    }
    if (s.description) {
      options.description = s.description;
    }
    if (s.default !== undefined) {
      options.default = s.default;
    }
    return options;
  };

  const parse = (node: JsonSchema): TSchema => {
    const options = getOptions(node);
    if (node.anyOf && Array.isArray(node.anyOf)) {
      const allProps: Record<string, TSchema> = {};
      const allRequired = new Set<string>();

      for (const subSchema of node.anyOf) {
        if (subSchema.properties) {
          for (const [key, value] of Object.entries(subSchema.properties)) {
            if (!allProps[key]) {
              allProps[key] = parse(value);
            }
            if (
              subSchema.required &&
              Array.isArray(subSchema.required) &&
              subSchema.required.includes(key)
            ) {
              allRequired.add(key);
            }
          }
        }
      }
      const props: Record<string, TSchema> = {};
      for (const [key, schema] of Object.entries(allProps)) {
        props[key] = Type.Optional(schema);
      }

      return Type.Object(props, Object.keys(options).length > 0 ? options : undefined);
    }

    if (node.enum && Array.isArray(node.enum)) {
      // Use Type.Unsafe to create a proper enum schema that validators accept
      const enumValues = node.enum;
      return Type.Unsafe<string | number>({
        type: typeof enumValues[0] === "number" ? "number" : "string",
        enum: enumValues,
        ...options,
      });
    }

    if (node.type === "object" || node.properties) {
      if (!node.properties) {
        return Type.Object({}, Object.keys(options).length > 0 ? options : undefined);
      }

      const props: Record<string, TSchema> = {};
      for (const [key, value] of Object.entries(node.properties)) {
        const isRequired =
          node.required && Array.isArray(node.required) && node.required.includes(key);
        const propSchema = parse(value);
        props[key] = isRequired ? propSchema : Type.Optional(propSchema);
      }

      return Type.Object(props, Object.keys(options).length > 0 ? options : undefined);
    }

    if (node.type === "array") {
      const itemsSchema = node.items ? parse(node.items) : Type.Any();
      return Type.Array(itemsSchema, Object.keys(options).length > 0 ? options : undefined);
    }

    if (node.type === "string" || (!node.type && !node.anyOf && !node.enum)) {
      return Type.String(Object.keys(options).length > 0 ? options : undefined);
    }
    if (node.type === "number" || node.type === "integer") {
      return Type.Number(Object.keys(options).length > 0 ? options : undefined);
    }
    if (node.type === "boolean") {
      return Type.Boolean(Object.keys(options).length > 0 ? options : undefined);
    }

    return Type.Unknown();
  };
  return parse(schema);
}

let cachedTools: AnyAgentTool[] | null = null;
let loadPromise: Promise<AnyAgentTool[]> | null = null;

export async function preloadShengSuanYunTools(opts?: {
  config?: OpenClawConfig;
  workspaceDir?: string;
}): Promise<void> {
  log.info(
    `[shengsuanyun-generate] preloadShengSuanYunTools() called, cachedTools: ${cachedTools ? `${cachedTools.length} tools` : "null"}`,
  );
  if (cachedTools !== null) {
    return;
  }

  if (loadPromise !== null) {
    await loadPromise;
    return;
  }
  loadPromise = loadShengSuanYunTools(opts)
    .then((tools) => {
      cachedTools = tools;
      return tools;
    })
    .catch((err) => {
      log.error("[shengsuanyun-generate] Failed to load tools, using fallback only:", err);
      return [];
    })
    .finally(() => {
      loadPromise = null;
    });
  await loadPromise;
}

export function createGenerateTools(opts?: {
  config?: OpenClawConfig;
  workspaceDir?: string;
}): AnyAgentTool[] {
  log.info(
    `[shengsuanyun-generate] createGenerateTools() called, cachedTools: ${cachedTools ? `${cachedTools.length} tools` : "null"}`,
  );
  if (cachedTools !== null) {
    log.info(`[shengsuanyun-generate] Returning ${cachedTools.length} cached tools`);
    return cachedTools;
  }
  log.info(
    "[shengsuanyun-generate] cachedTools is null, starting background preload and returning fallback tools",
  );
  preloadShengSuanYunTools(opts).catch((err) => {
    console.error("[shengsuanyun-generate] Background preload failed:", err);
  });
  return [];
}
