import { defineSingleProviderPluginEntry } from "openclaw/plugin-sdk/provider-entry";
import { applyShengSuanYunConfig, SHENGSUANYUN_DEFAULT_MODEL_REF } from "./onboard.ts";
import { buildShengSuanYunProvider } from "./provider-catalog.js";

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
      run: async (ctx) => {
        console.log("[shengsuanyun] catalog.run called");
        console.log("[shengsuanyun] agentDir:", ctx.agentDir);

        const authResult = ctx.resolveProviderAuth(PROVIDER_ID);
        console.log("[shengsuanyun] authResult:", {
          hasApiKey: !!authResult.apiKey,
          mode: authResult.mode,
          source: authResult.source,
          profileId: authResult.profileId,
        });

        const { apiKey } = authResult;
        if (!apiKey) {
          console.log("[shengsuanyun] No API key found, returning null");
          return null;
        }

        console.log("[shengsuanyun] Building provider with API key");
        const provider = await buildShengSuanYunProvider();
        console.log("[shengsuanyun] Provider built, models count:", provider.models.length);

        return {
          provider: {
            ...provider,
            apiKey,
          },
        };
      },
    },
  },
});
