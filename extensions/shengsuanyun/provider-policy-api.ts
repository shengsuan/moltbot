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

    // Config normalization can strip the public /api/v1 suffix; restore it.
    // (Both matched variants differ from expectedBase, so the correction always fires.)
    if (
      trimmed === "https://router.shengsuanyun.com/v1" ||
      trimmed === "https://router.shengsuanyun.com"
    ) {
      return {
        ...providerConfig,
        baseUrl: expectedBase,
      };
    }
  }

  return undefined; // No changes needed
}
