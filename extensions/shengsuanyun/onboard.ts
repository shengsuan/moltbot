import {
  applyAgentDefaultModelPrimary,
  type OpenClawConfig,
} from "openclaw/plugin-sdk/provider-onboard";

export const SHENGSUANYUN_DEFAULT_MODEL_REF = "shengsuanyun/anthropic/claude-opus-4.6";

export function applyShengSuanYunProviderConfig(cfg: OpenClawConfig): OpenClawConfig {
  const models = { ...cfg.agents?.defaults?.models };
  models[SHENGSUANYUN_DEFAULT_MODEL_REF] = {
    ...models[SHENGSUANYUN_DEFAULT_MODEL_REF],
    alias: models[SHENGSUANYUN_DEFAULT_MODEL_REF]?.alias ?? "胜算云",
  };

  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        models,
      },
    },
  };
}

export function applyShengSuanYunConfig(cfg: OpenClawConfig): OpenClawConfig {
  return applyAgentDefaultModelPrimary(
    applyShengSuanYunProviderConfig(cfg),
    SHENGSUANYUN_DEFAULT_MODEL_REF,
  );
}
