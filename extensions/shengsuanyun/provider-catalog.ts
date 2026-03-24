import {
  discoverShengSuanYunModels,
  type ModelProviderConfig,
  SHENGSUANYUN_BASE_URL,
} from "openclaw/plugin-sdk/provider-models";

export async function buildShengSuanYunProvider(): Promise<ModelProviderConfig> {
  const models = await discoverShengSuanYunModels();
  return {
    baseUrl: SHENGSUANYUN_BASE_URL,
    api: "openai-completions",
    models,
  };
}
