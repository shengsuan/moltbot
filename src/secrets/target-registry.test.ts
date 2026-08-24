/** Tests core secret target registry queries without plugin discovery. */
import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import {
  buildTalkTestProviderConfig,
  TALK_TEST_PROVIDER_API_KEY_PATH,
  TALK_TEST_PROVIDER_ID,
} from "../test-utils/talk-test-provider.js";
import {
  discoverConfigSecretTargetsByIds,
  resolveConfigSecretTargetByPath,
  resolveSecretPlanTargetByPathCore,
} from "./target-registry.js";

vi.mock("../plugins/plugin-metadata-snapshot.js", () => ({
  resolvePluginMetadataSnapshot: () => ({ plugins: [] }),
}));

describe("secret target registry", () => {
  it("supports filtered discovery by target ids", () => {
    const config = {
      ...buildTalkTestProviderConfig({ source: "env", provider: "default", id: "TALK_API_KEY" }),
      gateway: {
        remote: {
          token: { source: "env" as const, provider: "default", id: "REMOTE_TOKEN" },
        },
      },
    } satisfies OpenClawConfig;

    const targets = discoverConfigSecretTargetsByIds(config, new Set(["talk.providers.*.apiKey"]));

    expect(targets).toHaveLength(1);
    expect(targets[0]?.entry?.id).toBe("talk.providers.*.apiKey");
    expect(targets[0]?.providerId).toBe(TALK_TEST_PROVIDER_ID);
    expect(targets[0]?.path).toBe(TALK_TEST_PROVIDER_API_KEY_PATH);
  });

  it("resolves talk realtime provider api key targets", () => {
    const target = resolveConfigSecretTargetByPath([
      "talk",
      "realtime",
      "providers",
      "openai",
      "apiKey",
    ]);

    expect(target?.entry?.id).toBe("talk.realtime.providers.*.apiKey");
    expect(target?.providerId).toBe("openai");
  });

  it("returns null when no config target path matches", () => {
    const target = resolveConfigSecretTargetByPath(["gateway", "auth", "mode"]);

    expect(target).toBeNull();
  });

  it("resolves plan targets by owning config document", () => {
    const configTarget = resolveSecretPlanTargetByPathCore({
      configFile: "openclaw.json",
      pathSegments: ["models", "providers", "openai", "apiKey"],
    });
    const authProfileTarget = resolveSecretPlanTargetByPathCore({
      configFile: "auth-profile-store",
      pathSegments: ["profiles", "openai:default", "key"],
    });

<<<<<<< HEAD
    const target = resolveConfigSecretTargetByPath([
      "plugins",
      "entries",
      "exa",
      "config",
      "webSearch",
      "apiKey",
    ]);

    expect(target?.entry?.id).toBe("plugins.entries.exa.config.webSearch.apiKey");

    const fetchTarget = resolveConfigSecretTargetByPath([
      "plugins",
      "entries",
      "firecrawl",
      "config",
      "webFetch",
      "apiKey",
    ]);
    expect(fetchTarget?.entry?.id).toBe("plugins.entries.firecrawl.config.webFetch.apiKey");
  });

  it("derives bundled plugin SecretInput contract target paths from plugin manifests", () => {
    const coreTargetIds = new Set(getCoreSecretTargetRegistry().map((entry) => entry.id));
    expect(coreTargetIds.has("plugins.entries.voice-call.config.twilio.authToken")).toBe(false);
    expect(coreTargetIds.has("plugins.entries.codex.config.appServer.authToken")).toBe(false);

    const target = resolveConfigSecretTargetByPath([
      "plugins",
      "entries",
      "voice-call",
      "config",
      "tts",
      "providers",
      "elevenlabs",
      "apiKey",
    ]);

    expect(target?.entry?.id).toBe("plugins.entries.voice-call.config.tts.providers.*.apiKey");

    const codexAuthTarget = resolveConfigSecretTargetByPath([
      "plugins",
      "entries",
      "codex",
      "config",
      "appServer",
      "authToken",
    ]);
    expect(codexAuthTarget?.entry?.id).toBe("plugins.entries.codex.config.appServer.authToken");

    const codexHeaderTarget = resolveConfigSecretTargetByPath([
      "plugins",
      "entries",
      "codex",
      "config",
      "appServer",
      "headers",
      "x-codex-client-session-token",
    ]);
    expect(codexHeaderTarget?.entry?.id).toBe("plugins.entries.codex.config.appServer.headers.*");
=======
    expect(configTarget?.entry.targetType).toBe("models.providers.apiKey");
    expect(configTarget?.providerId).toBe("openai");
    expect(authProfileTarget?.entry.targetType).toBe("auth-profiles.api_key.key");
>>>>>>> 17abdfc78c89ec69e972abf7979462757f2402fb
  });
});
