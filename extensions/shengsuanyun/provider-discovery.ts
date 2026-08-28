import type { ProviderCatalogContext } from "openclaw/plugin-sdk/provider-catalog-shared";
import type { ProviderPlugin } from "openclaw/plugin-sdk/provider-model-shared";
import { buildCachedShengSuanYunProvider, buildShengSuanYunProvider } from "./provider-catalog.js";

const PROVIDER_ID = "shengsuanyun";

export async function runShengSuanYunCatalog(ctx: ProviderCatalogContext) {
  const authResult = ctx.resolveProviderAuth(PROVIDER_ID);
  // /models listing is public; keep the catalog populated without a key and
  // attach the key only when present so requests can authenticate.
  const provider = await buildShengSuanYunProvider();
  return {
    provider: {
      ...provider,
      ...(authResult.apiKey ? { apiKey: authResult.apiKey } : {}),
    },
  };
}

export async function runShengSuanYunStaticCatalog() {
  // Cached snapshot only: mandatory startup (entries-only discovery) must not
  // execute network fetches, so cold caches surface an empty model list until
  // the live catalog runs once.
  return { provider: await buildCachedShengSuanYunProvider() };
}

export const shengsuanyunProviderDiscovery: ProviderPlugin = {
  id: PROVIDER_ID,
  label: "胜算云",
  docsPath: "/providers/shengsuanyun",
  auth: [],
  catalog: {
    order: "profile",
    run: runShengSuanYunCatalog,
  },
  staticCatalog: {
    order: "profile",
    run: runShengSuanYunStaticCatalog,
  },
};

export default shengsuanyunProviderDiscovery;
