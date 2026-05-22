import { defineSingleProviderPluginEntry } from "openclaw/plugin-sdk/provider-entry";
import { normalizeLowercaseStringOrEmpty } from "openclaw/plugin-sdk/text-runtime";
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
        const authResult = ctx.resolveProviderAuth(PROVIDER_ID);
        const { apiKey } = authResult;
        if (!apiKey) {
          return null;
        }
        const provider = await buildShengSuanYunProvider();
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
