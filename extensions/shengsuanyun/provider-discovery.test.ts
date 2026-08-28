// Regression: ShengSuanYun's /models listing is public, so the live catalog must
// return the provider with discovered models even when no API key is configured.
// The old `if (!apiKey) return null` gate emptied the whole catalog and surfaced
// as "Unknown model" for configured default models.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./provider-catalog.js", () => ({
  buildShengSuanYunProvider: async () => ({
    baseUrl: "https://router.shengsuanyun.com/api/v1",
    api: "anthropic-messages",
    models: [
      {
        id: "anthropic/claude-haiku-4.5",
        name: "Claude Haiku 4.5",
        reasoning: false,
        input: ["text", "image"],
        contextWindow: 200000,
        maxTokens: 64000,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      },
    ],
  }),
  buildCachedShengSuanYunProvider: async () => ({
    baseUrl: "https://router.shengsuanyun.com/api/v1",
    api: "anthropic-messages",
    models: [
      {
        id: "anthropic/claude-haiku-4.5",
        name: "Claude Haiku 4.5",
        reasoning: false,
        input: ["text", "image"],
        contextWindow: 200000,
        maxTokens: 64000,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      },
    ],
  }),
}));

import { shengsuanyunProviderDiscovery } from "./provider-discovery.js";

const noKeyCtx = { resolveProviderAuth: () => ({ apiKey: undefined }) } as never;
const withKeyCtx = { resolveProviderAuth: () => ({ apiKey: "sk-test" }) } as never;
const staticCtx = {} as never;

describe("shengsuanyunProviderDiscovery catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the provider with discovered models when no API key is configured", async () => {
    const result = await shengsuanyunProviderDiscovery.catalog.run(noKeyCtx);
    expect(result?.provider?.baseUrl).toBe("https://router.shengsuanyun.com/api/v1");
    expect(result?.provider?.models.map((model) => model.id)).toContain(
      "anthropic/claude-haiku-4.5",
    );
    expect(result?.provider?.apiKey).toBeUndefined();
  });

  it("attaches the API key when auth resolves one", async () => {
    const result = await shengsuanyunProviderDiscovery.catalog.run(withKeyCtx);
    expect(result?.provider?.apiKey).toBe("sk-test");
    expect(result?.provider?.models.map((model) => model.id)).toContain(
      "anthropic/claude-haiku-4.5",
    );
  });

  it("static catalog serves cached models without auth or network", async () => {
    const result = await shengsuanyunProviderDiscovery.staticCatalog?.run(staticCtx);
    expect(result?.provider?.baseUrl).toBe("https://router.shengsuanyun.com/api/v1");
    expect(result?.provider?.models.map((model) => model.id)).toContain(
      "anthropic/claude-haiku-4.5",
    );
  });
});
