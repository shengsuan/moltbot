import { modelKey } from "../agents/model-selection.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import type { SecretInput } from "../config/types.secrets.js";
import { ensureApiKeyFromEnvOrPrompt } from "../plugins/provider-auth-input.js";
import type { RuntimeEnv } from "../runtime.js";
import { fetchWithTimeout } from "../utils/fetch-timeout.js";
import { normalizeSecretInput } from "../utils/normalize-secret-input.js";
import type { WizardPrompter } from "../wizard/prompts.js";
import {
  applyCustomApiConfig,
  buildAnthropicVerificationProbeRequest,
  buildEndpointIdFromUrl,
  buildOpenAiVerificationProbeRequest,
  normalizeEndpointId,
  normalizeOptionalProviderApiKey,
  resolveCustomModelAliasError,
  resolveCustomModelImageInputInference,
  resolveCustomProviderId,
  type CustomApiCompatibility,
  type CustomApiResult,
} from "./onboard-custom-config.js";
export {
  applyCustomApiConfig,
  buildAnthropicVerificationProbeRequest,
  buildOpenAiVerificationProbeRequest,
  CustomApiError,
  inferCustomModelSupportsImageInput,
  parseNonInteractiveCustomApiFlags,
  resolveCustomModelImageInputInference,
  resolveCustomProviderId,
  type ApplyCustomApiConfigParams,
  type CustomApiCompatibility,
  type CustomApiErrorCode,
  type CustomModelImageInputInference,
  type CustomApiResult,
  type ParseNonInteractiveCustomApiFlagsParams,
  type ParsedNonInteractiveCustomApiFlags,
  type ResolveCustomProviderIdParams,
  type ResolvedCustomProviderId,
} from "./onboard-custom-config.js";
import type { SecretInputMode } from "./onboard-types.js";

const VERIFY_TIMEOUT_MS = 30_000;
type CustomApiCompatibilityChoice = CustomApiCompatibility | "unknown";

const COMPATIBILITY_OPTIONS: Array<{
  value: CustomApiCompatibilityChoice;
  label: string;
  hint: string;
}> = [
  {
    value: "openai",
    label: "OpenAI 兼容",
    hint: "使用 /chat/completions",
  },
  {
    value: "anthropic",
    label: "Anthropic 兼容",
    hint: "使用 /messages",
  },
  {
    value: "unknown",
    label: "未知（自动检测）",
    hint: "先探测 OpenAI 然后 Anthropic 端点",
  },
];

function formatVerificationError(error: unknown): string {
  if (!error) {
    return "unknown error";
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "unknown error";
  }
}

type VerificationResult = {
  ok: boolean;
  status?: number;
  error?: unknown;
};

async function requestVerification(params: {
  endpoint: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}): Promise<VerificationResult> {
  try {
    const res = await fetchWithTimeout(
      params.endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...params.headers,
        },
        body: JSON.stringify(params.body),
      },
      VERIFY_TIMEOUT_MS,
    );
    return { ok: res.ok, status: res.status };
  } catch (error) {
    return { ok: false, error };
  }
}

async function requestOpenAiVerification(params: {
  baseUrl: string;
  apiKey: string;
  modelId: string;
}): Promise<VerificationResult> {
  return await requestVerification(buildOpenAiVerificationProbeRequest(params));
}

async function requestAnthropicVerification(params: {
  baseUrl: string;
  apiKey: string;
  modelId: string;
}): Promise<VerificationResult> {
  return await requestVerification(buildAnthropicVerificationProbeRequest(params));
}

async function promptBaseUrlAndKey(params: {
  prompter: WizardPrompter;
  config: OpenClawConfig;
  secretInputMode?: SecretInputMode;
  initialBaseUrl?: string;
}): Promise<{ baseUrl: string; apiKey?: SecretInput; resolvedApiKey: string }> {
  const baseUrlInput = await params.prompter.text({
    message: "API Base URL",
    initialValue: params.initialBaseUrl,
    placeholder: "https://api.example.com/v1",
    validate: (val) => {
      return URL.canParse(val) ? undefined : "Please enter a valid URL (e.g. http://...)";
    },
  });
  const baseUrl = baseUrlInput.trim();
  const providerHint = buildEndpointIdFromUrl(baseUrl) || "custom";
  let apiKeyInput: SecretInput | undefined;
  const resolvedApiKey = await ensureApiKeyFromEnvOrPrompt({
    config: params.config,
    provider: providerHint,
    envLabel: "CUSTOM_API_KEY",
    promptMessage: "API 密钥（如不需要请留空）",
    normalize: normalizeSecretInput,
    validate: () => undefined,
    prompter: params.prompter,
    secretInputMode: params.secretInputMode,
    setCredential: async (apiKey) => {
      apiKeyInput = apiKey;
    },
  });
  return {
    baseUrl,
    apiKey: normalizeOptionalProviderApiKey(apiKeyInput),
    resolvedApiKey: normalizeSecretInput(resolvedApiKey),
  };
}

type CustomApiRetryChoice = "baseUrl" | "model" | "both";

async function promptCustomApiRetryChoice(prompter: WizardPrompter): Promise<CustomApiRetryChoice> {
  return await prompter.select({
    message: "您想更改什么？",
    options: [
      { value: "baseUrl", label: "更改基础 URL" },
      { value: "model", label: "更改模型" },
      { value: "both", label: "更改基础 URL 和模型" },
    ],
  });
}

async function promptCustomApiModelId(prompter: WizardPrompter): Promise<string> {
  return (
    await prompter.text({
      message: "模型 ID",
      placeholder: "例如 llama3、claude-3-7-sonnet",
      validate: (val) => (val.trim() ? undefined : "模型 ID 是必填项"),
    })
  ).trim();
}

async function applyCustomApiRetryChoice(params: {
  prompter: WizardPrompter;
  config: OpenClawConfig;
  secretInputMode?: SecretInputMode;
  retryChoice: CustomApiRetryChoice;
  current: { baseUrl: string; apiKey?: SecretInput; resolvedApiKey: string; modelId: string };
}): Promise<{ baseUrl: string; apiKey?: SecretInput; resolvedApiKey: string; modelId: string }> {
  let { baseUrl, apiKey, resolvedApiKey, modelId } = params.current;
  if (params.retryChoice === "baseUrl" || params.retryChoice === "both") {
    const retryInput = await promptBaseUrlAndKey({
      prompter: params.prompter,
      config: params.config,
      secretInputMode: params.secretInputMode,
      initialBaseUrl: baseUrl,
    });
    baseUrl = retryInput.baseUrl;
    apiKey = retryInput.apiKey;
    resolvedApiKey = retryInput.resolvedApiKey;
  }
  if (params.retryChoice === "model" || params.retryChoice === "both") {
    modelId = await promptCustomApiModelId(params.prompter);
  }
  return { baseUrl, apiKey, resolvedApiKey, modelId };
}

export async function promptCustomApiConfig(params: {
  prompter: WizardPrompter;
  runtime: RuntimeEnv;
  config: OpenClawConfig;
  secretInputMode?: SecretInputMode;
}): Promise<CustomApiResult> {
  const { prompter, runtime, config } = params;

  const baseInput = await promptBaseUrlAndKey({
    prompter,
    config,
    secretInputMode: params.secretInputMode,
  });
  let baseUrl = baseInput.baseUrl;
  let apiKey = baseInput.apiKey;
  let resolvedApiKey = baseInput.resolvedApiKey;

  const compatibilityChoice = await prompter.select({
    message: "端点兼容性",
    options: COMPATIBILITY_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      hint: option.hint,
    })),
  });

  let modelId = await promptCustomApiModelId(prompter);

  let compatibility: CustomApiCompatibility | null =
    compatibilityChoice === "unknown" ? null : compatibilityChoice;

  while (true) {
    let verifiedFromProbe = false;
    if (!compatibility) {
      const probeSpinner = prompter.progress("正在检测端点类型…");
      const openaiProbe = await requestOpenAiVerification({
        baseUrl,
        apiKey: resolvedApiKey,
        modelId,
      });
      if (openaiProbe.ok) {
        probeSpinner.stop("检测到 OpenAI 兼容端点。");
        compatibility = "openai";
        verifiedFromProbe = true;
      } else {
        const anthropicProbe = await requestAnthropicVerification({
          baseUrl,
          apiKey: resolvedApiKey,
          modelId,
        });
        if (anthropicProbe.ok) {
          probeSpinner.stop("检测到 Anthropic 兼容端点。");
          compatibility = "anthropic";
          verifiedFromProbe = true;
        } else {
          probeSpinner.stop("无法检测端点类型。");
          await prompter.note("此端点未响应 OpenAI 或 Anthropic 样式的请求。", "端点检测");
          const retryChoice = await promptCustomApiRetryChoice(prompter);
          ({ baseUrl, apiKey, resolvedApiKey, modelId } = await applyCustomApiRetryChoice({
            prompter,
            config,
            secretInputMode: params.secretInputMode,
            retryChoice,
            current: { baseUrl, apiKey, resolvedApiKey, modelId },
          }));
          continue;
        }
      }
    }

    if (verifiedFromProbe) {
      break;
    }

    const verifySpinner = prompter.progress("正在验证…");
    const result =
      compatibility === "anthropic"
        ? await requestAnthropicVerification({ baseUrl, apiKey: resolvedApiKey, modelId })
        : await requestOpenAiVerification({ baseUrl, apiKey: resolvedApiKey, modelId });
    if (result.ok) {
      verifySpinner.stop("验证成功。");
      break;
    }
    if (result.status !== undefined) {
      verifySpinner.stop(`验证失败：状态 ${result.status}`);
    } else {
      verifySpinner.stop(`验证失败：${formatVerificationError(result.error)}`);
    }
    const retryChoice = await promptCustomApiRetryChoice(prompter);
    ({ baseUrl, apiKey, resolvedApiKey, modelId } = await applyCustomApiRetryChoice({
      prompter,
      config,
      secretInputMode: params.secretInputMode,
      retryChoice,
      current: { baseUrl, apiKey, resolvedApiKey, modelId },
    }));
    if (compatibilityChoice === "unknown") {
      compatibility = null;
    }
  }

  const suggestedId = buildEndpointIdFromUrl(baseUrl);
  const providerIdInput = await prompter.text({
    message: "端点 ID",
    initialValue: suggestedId,
    placeholder: "custom",
    validate: (value) => {
      const normalized = normalizeEndpointId(value);
      if (!normalized) {
        return "端点 ID 是必填项。";
      }
      return undefined;
    },
  });
  const aliasInput = await prompter.text({
    message: "模型别名（可选）",
    placeholder: "例如 local、ollama",
    initialValue: "",
    validate: (value) => {
      const resolvedProvider = resolveCustomProviderId({
        config,
        baseUrl,
        providerId: providerIdInput,
      });
      const modelRef = modelKey(resolvedProvider.providerId, modelId);
      return resolveCustomModelAliasError({ raw: value, cfg: config, modelRef });
    },
  });
  const imageInputInference = resolveCustomModelImageInputInference(modelId);
  const supportsImageInput =
    imageInputInference.confidence === "known"
      ? imageInputInference.supportsImageInput
      : await prompter.confirm({
          message: "Does this model support image input?",
          initialValue: imageInputInference.supportsImageInput,
        });
  const resolvedCompatibility = compatibility ?? "openai";
  const result = applyCustomApiConfig({
    config,
    baseUrl,
    modelId,
    compatibility: resolvedCompatibility,
    apiKey,
    providerId: providerIdInput,
    alias: aliasInput,
    supportsImageInput,
  });

  if (result.providerIdRenamedFrom && result.providerId) {
    await prompter.note(
      `端点 ID "${result.providerIdRenamedFrom}" 已用于不同的基础 URL。使用 "${result.providerId}"。`,
      "端点 ID",
    );
  }

  runtime.log(`已配置自定义提供商：${result.providerId}/${result.modelId}`);
  return result;
}
