import type { ProviderCatalogContext } from "openclaw/plugin-sdk/provider-catalog-shared";
import { buildShengSuanYunProvider } from "./provider-catalog.js";

const PROVIDER_ID = "shengsuanyun";

type ShengSuanYunProviderPlugin = {
  id: string;
  label: string;
  docsPath: string;
  auth: [];
  catalog: {
    order: "profile";
    run: (ctx: ProviderCatalogContext) => ReturnType<typeof runShengSuanYunCatalog>;
  };
};

async function runShengSuanYunCatalog(ctx: ProviderCatalogContext) {
  const authResult = ctx.resolveProviderAuth(PROVIDER_ID);
  const { apiKey } = authResult;
  if (!apiKey) {
    // console.log("[shengsuanyun] No API key found, returning null");
    return null;
  }
  const provider = await buildShengSuanYunProvider();
  return {
    provider: {
      ...provider,
      apiKey,
    },
  };
}

export const shengsuanyunProviderDiscovery: ShengSuanYunProviderPlugin = {
  id: PROVIDER_ID,
  label: "胜算云",
  docsPath: "/providers/shengsuanyun",
  auth: [],
  catalog: {
    order: "profile",
    run: runShengSuanYunCatalog,
  },
};

export default shengsuanyunProviderDiscovery;
