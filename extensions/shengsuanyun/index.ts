import { defineSingleProviderPluginEntry } from "openclaw/plugin-sdk/provider-entry";
import { buildShengSuanYunImageGenerationProvider } from "./image-generation-provider.js";
import { applyShengSuanYunConfig, SHENGSUANYUN_DEFAULT_MODEL_REF } from "./onboard.js";
import { runShengSuanYunCatalog, runShengSuanYunStaticCatalog } from "./provider-discovery.js";
const PROVIDER_ID = "shengsuanyun";

export default defineSingleProviderPluginEntry({
  id: PROVIDER_ID,
  name: "胜算云",
  description: "添加胜算云模型提供插件",
  provider: {
    label: "胜算云",
    docsPath: "/providers/shengsuanyun",
    auth: [
      {
        methodId: "api-key",
        label: "胜算云 API key",
        hint: "API key",
        optionKey: "shengsuanyunApiKey",
        flagName: "--shengsuanyun-api-key",
        envVar: "SHENGSUANYUN_API_KEY",
        promptMessage: "请输入胜算云 API key",
        defaultModel: SHENGSUANYUN_DEFAULT_MODEL_REF,
        applyConfig: (cfg) => applyShengSuanYunConfig(cfg),
        wizard: {
          choiceId: "shengsuanyun-api-key",
          choiceLabel: "胜算云 API key",
          groupId: "shengsuanyun",
          groupLabel: "胜算云",
          groupHint: "API key",
        },
      },
    ],
    catalog: {
      order: "profile",
      // Canonical catalog gate lives in provider-discovery.ts (the manifest's
      // providerCatalogEntry): /models listing is public, key optional.
      // staticRun serves the cached snapshot so mandatory startup (entries-only
      // discovery) keeps provider facts without network.
      run: runShengSuanYunCatalog,
      staticRun: () => runShengSuanYunStaticCatalog(),
    },
  },
  register(api) {
    api.registerImageGenerationProvider(buildShengSuanYunImageGenerationProvider());
  },
});
