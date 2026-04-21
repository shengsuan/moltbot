import type { ModelProviderConfig } from "openclaw/plugin-sdk/provider-model-types";

/**
 * Normalize shengsuanyun provider config to ensure correct baseUrl.
 * This prevents any global normalization logic from changing /api/v1 to /v1.
 */
export function normalizeConfig(params: {
  provider: string;
  providerConfig: ModelProviderConfig;
}): ModelProviderConfig | null | undefined {
  if (params.provider !== "shengsuanyun") {
    return undefined;
  }

  const { providerConfig } = params;

  // If baseUrl is present but doesn't end with /api/v1, fix it
  if (typeof providerConfig.baseUrl === "string") {
    const trimmed = providerConfig.baseUrl.trim().replace(/\/+$/, "");
    const expectedBase = "https://router.shengsuanyun.com/api/v1";

    // If it's the shengsuanyun domain but wrong path, correct it
    if (
      trimmed === "https://router.shengsuanyun.com/v1" ||
      trimmed === "https://router.shengsuanyun.com"
    ) {
      if (trimmed !== expectedBase) {
        return {
          ...providerConfig,
          baseUrl: expectedBase,
        };
      }
    }
  }

  return undefined; // No changes needed
}
