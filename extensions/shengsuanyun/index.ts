import { emptyPluginConfigSchema, type OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { buildShengSuanYunProvider } from "../../src/agents/models-config.providers.discovery.js";
import {
  createOpenRouterSystemCacheWrapper,
  createOpenRouterWrapper,
  isProxyReasoningUnsupported,
} from "../../src/agents/pi-embedded-runner/proxy-stream-wrappers.ts";
import { SHENGSUANYUN_DEFAULT_MODEL_REF } from "../../src/commands/onboard-auth.credentials.js";
import { applyShengSuanYunConfig } from "../../src/commands/onboard-auth.js";
import { createProviderApiKeyAuthMethod } from "../../src/plugins/provider-api-key-auth.js";

const PROVIDER_ID = "shengsuanyun";

const shengSuanYunPlugin = {
  id: PROVIDER_ID,
  name: "胜算云",
  description: "添加胜算云模型提供插件",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: "胜算云",
      docsPath: "/providers/shengsuanyun",
      envVars: ["SHENGSUANYUN_API_KEY"],
      auth: [
        createProviderApiKeyAuthMethod({
          providerId: PROVIDER_ID,
          methodId: "api-key",
          label: "胜算云 API key",
          hint: "API key",
          optionKey: "shengsuanyunApiKey",
          flagName: "--shengsuanyun-api-key",
          envVar: "SHENGSUANYUN_API_KEY",
          promptMessage: "请输入胜算云 API key",
          defaultModel: SHENGSUANYUN_DEFAULT_MODEL_REF,
          expectedProviders: ["shengsuanyun"],
          applyConfig: (cfg) => applyShengSuanYunConfig(cfg),
          wizard: {
            choiceId: "shengsuanyun-api-key",
            choiceLabel: "胜算云 API key",
            groupId: "shengsuanyun",
            groupLabel: "胜算云",
            groupHint: "API key",
          },
        }),
      ],
      catalog: {
        order: "simple",
        run: async (ctx) => {
          const apiKey = ctx.resolveProviderApiKey(PROVIDER_ID).apiKey;
          if (!apiKey) {
            return null;
          }
          return {
            provider: {
              ...(await buildShengSuanYunProvider()),
              apiKey,
            },
          };
        },
      },

      wrapStreamFn: (ctx) => {
        let streamFn = ctx.streamFn;
        const skipReasoningInjection =
          ctx.modelId === "auto" || isProxyReasoningUnsupported(ctx.modelId);
        const openRouterThinkingLevel = skipReasoningInjection ? undefined : ctx.thinkingLevel;
        streamFn = createOpenRouterWrapper(streamFn, openRouterThinkingLevel);
        streamFn = createOpenRouterSystemCacheWrapper(streamFn);
        return streamFn;
      },
    });
  },
};

export default shengSuanYunPlugin;
