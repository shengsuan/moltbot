// Verifies that a bundled provider with a live catalog (providerCatalogEntry)
// contributes its discovered models to the implicit provider set even without
// a configured API key (ShengSuanYun's /models listing is public), and that no
// key material is attached when auth resolves empty.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginMetadataSnapshotOwnerMaps } from "../plugins/plugin-metadata-snapshot.js";
import type { ProviderPlugin } from "../plugins/types.js";

const mocks = vi.hoisted(() => ({
  prepareProviderStaticCatalog: vi.fn(),
  resolveRuntimePluginDiscoveryProviders: vi.fn(),
  runProviderCatalog: vi.fn(),
  runProviderStaticCatalog: vi.fn(),
}));

vi.mock("../plugins/provider-discovery.js", () => ({
  resolveRuntimePluginDiscoveryProviders: mocks.resolveRuntimePluginDiscoveryProviders,
  runProviderCatalog: mocks.runProviderCatalog,
  runProviderStaticCatalog: mocks.runProviderStaticCatalog,
  groupPluginDiscoveryProvidersByOrder: (providers: ProviderPlugin[]) => ({
    // shengsuanyun's catalog runs in the profile order group.
    simple: [],
    profile: providers,
    paired: [],
    late: [],
  }),
  normalizePluginDiscoveryResult: ({
    provider,
    result,
  }: {
    provider: ProviderPlugin;
    result?: { provider?: unknown; providers?: Record<string, unknown> } | null;
  }) => result?.providers ?? (result?.provider ? { [provider.id]: result.provider } : {}),
  prepareProviderStaticCatalog: mocks.prepareProviderStaticCatalog,
}));

import { resolveImplicitProviders } from "./models-config.providers.implicit.js";

function buildShengSuanYunLiveProvider(): ProviderPlugin {
  // Mirrors the extension's catalog contract: public /models listing, key optional,
  // plus a static catalog serving the cached snapshot for mandatory startup.
  const discoveredModels = [
    {
      id: "anthropic/claude-haiku-4.5",
      name: "Claude Haiku 4.5",
      reasoning: false,
      input: ["text", "image"] as ("text" | "image")[],
      contextWindow: 200000,
      maxTokens: 64000,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    },
  ];
  return {
    id: "shengsuanyun",
    label: "胜算云",
    auth: [],
    catalog: {
      order: "profile",
      run: async (ctx) => {
        const { apiKey } = ctx.resolveProviderAuth("shengsuanyun");
        return {
          provider: {
            baseUrl: "https://router.shengsuanyun.com/api/v1",
            api: "anthropic-messages" as const,
            models: discoveredModels,
            ...(apiKey ? { apiKey } : {}),
          },
        };
      },
    },
    staticCatalog: {
      order: "profile",
      run: async () => ({
        provider: {
          baseUrl: "https://router.shengsuanyun.com/api/v1",
          api: "anthropic-messages" as const,
          models: discoveredModels,
        },
      }),
    },
  };
}

function metadataOwners(): PluginMetadataSnapshotOwnerMaps {
  return {
    channels: new Map(),
    channelConfigs: new Map(),
    providers: new Map(),
    modelCatalogProviders: new Map(),
    cliBackends: new Map(),
    setupProviders: new Map(),
    commandAliases: new Map(),
    contracts: new Map(),
  };
}

describe("shengsuanyun implicit provider with live catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRuntimePluginDiscoveryProviders.mockResolvedValue([
      buildShengSuanYunLiveProvider(),
    ]);
    // Live catalogs run the provider's own discovery; mirror the single-params call shape.
    mocks.runProviderCatalog.mockImplementation(
      async (params: { provider: ProviderPlugin }) =>
        params.provider.catalog?.run?.({
          resolveProviderAuth: () => ({ apiKey: undefined }),
        } as never) ?? null,
    );
    // Mirror the real runProviderStaticCatalog: invoke the provider's static catalog hook.
    mocks.runProviderStaticCatalog.mockImplementation(
      async (params: { provider: ProviderPlugin }) =>
        params.provider.staticCatalog?.run({
          config: {},
          env: {},
          resolveProviderApiKey: () => ({ apiKey: undefined }),
          resolveProviderAuth: () => ({ apiKey: undefined, mode: "none", source: "none" }),
        } as never) ?? null,
    );
    mocks.prepareProviderStaticCatalog.mockResolvedValue(null);
  });

  it("registers shengsuanyun and its discovered models without an API key", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "openclaw-ssy-test-"));

    const providers = await resolveImplicitProviders({
      agentDir,
      config: {},
      env: {} as NodeJS.ProcessEnv,
      explicitProviders: {},
      pluginMetadataSnapshot: {
        index: { plugins: [] } as never,
        manifestRegistry: { plugins: [], diagnostics: [] } as never,
        owners: metadataOwners(),
      } as never,
      providerDiscoveryProviderIds: ["shengsuanyun"],
      providerDiscoveryTimeoutMs: 10_000,
    });

    const provider = providers?.shengsuanyun;
    expect(provider).toBeDefined();
    expect(provider?.baseUrl).toBe("https://router.shengsuanyun.com/api/v1");
    expect(provider?.models?.map((m) => m.id)).toContain("anthropic/claude-haiku-4.5");
    expect(provider?.apiKey).toBeUndefined();
    // Live catalog hit means the static fallback must stay untouched.
    expect(mocks.runProviderStaticCatalog).not.toHaveBeenCalled();
  });

  it("registers shengsuanyun from its static catalog in entries-only startup mode", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "openclaw-ssy-test-"));

    const providers = await resolveImplicitProviders({
      agentDir,
      config: {},
      env: {} as NodeJS.ProcessEnv,
      explicitProviders: {},
      pluginMetadataSnapshot: {
        index: { plugins: [] } as never,
        manifestRegistry: { plugins: [], diagnostics: [] } as never,
        owners: metadataOwners(),
      } as never,
      providerDiscoveryProviderIds: ["shengsuanyun"],
      providerDiscoveryEntriesOnly: true,
      providerDiscoveryTimeoutMs: 10_000,
    });

    const provider = providers?.shengsuanyun;
    expect(provider).toBeDefined();
    expect(provider?.baseUrl).toBe("https://router.shengsuanyun.com/api/v1");
    expect(provider?.models?.map((m) => m.id)).toContain("anthropic/claude-haiku-4.5");
    // Mandatory startup must not execute live discovery.
    expect(mocks.runProviderCatalog).not.toHaveBeenCalled();
  });
});
