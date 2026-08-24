// Verifies generated config documentation baselines stay stable.
<<<<<<< HEAD
import { describe, expect, it } from "vitest";
import { collectConfigDocBaselineEntries, dedupeConfigDocBaselineEntries } from "./doc-baseline.js";
=======
import { describe, expect, it, vi } from "vitest";
import { renderConfigDocBaselineArtifacts } from "./doc-baseline.js";

vi.mock("./doc-baseline.runtime.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./doc-baseline.runtime.js")>();
  return {
    ...actual,
    loadPluginManifestRegistry: () => ({ plugins: [] }),
    collectChannelSchemaMetadata: () => [],
    collectPluginSchemaMetadata: () => [],
    buildConfigSchema: () => ({
      schema: {
        type: "object",
        properties: {
          tupleValues: {
            type: "array",
            items: [
              { type: "string", enum: ["alpha"] },
              { type: "number", enum: [42] },
            ],
          },
        },
      },
      uiHints: {},
      version: "test",
      generatedAt: "test",
    }),
  };
});
>>>>>>> 17abdfc78c89ec69e972abf7979462757f2402fb

describe("config doc baseline", () => {
  it("merges tuple item metadata through the public renderer", async () => {
    const { baseline } = await renderConfigDocBaselineArtifacts();

    expect(baseline.coreEntries).toEqual([
      {
        path: "tupleValues",
        kind: "core",
        type: "array",
        required: false,
        deprecated: false,
        sensitive: false,
        tags: [],
        hasChildren: true,
      },
      {
        path: "tupleValues.*",
        kind: "core",
        type: ["number", "string"],
        required: false,
        enumValues: ["alpha", 42],
        deprecated: false,
        sensitive: false,
        tags: [],
        hasChildren: false,
      },
    ]);
  });
});
