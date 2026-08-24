// Onboard hooks tests cover the default internal-hook config mutation behavior.
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { enableDefaultOnboardingInternalHooks } from "./onboard-hooks.js";

describe("onboard-hooks", () => {
  describe("enableDefaultOnboardingInternalHooks", () => {
    it("enables only the bundled session-memory entry by default", () => {
      const result = enableDefaultOnboardingInternalHooks({});

      expect(result.hooks?.internal?.enabled).toBeUndefined();
      expect(result.hooks?.internal?.entries).toEqual({
        "session-memory": { enabled: true },
      });
<<<<<<< HEAD
      expect(prompter.note).toHaveBeenCalledTimes(2);
      expect(prompter.multiselect).toHaveBeenCalledWith({
        message: "Enable hooks?",
        options: [
          { value: "__skip__", label: "暂时跳过" },
          {
            value: "session-memory",
            label: "💾 session-memory",
            hint: "Save session context to memory when /new or /reset command is issued",
          },
          {
            value: "command-logger",
            label: "📝 command-logger",
            hint: "Log all command events to a centralized audit file",
          },
        ],
      });
=======
>>>>>>> 17abdfc78c89ec69e972abf7979462757f2402fb
    });

    it("preserves explicit internal hook disablement", () => {
      const cfg: OpenClawConfig = {
        hooks: {
          internal: {
            enabled: false,
          },
        },
      };

      expect(enableDefaultOnboardingInternalHooks(cfg)).toBe(cfg);
    });

    it("preserves an explicit session-memory disablement", () => {
      const cfg: OpenClawConfig = {
        hooks: {
          internal: {
            entries: {
              "session-memory": { enabled: false },
            },
          },
        },
      };

      expect(enableDefaultOnboardingInternalHooks(cfg)).toBe(cfg);
    });

    it("preserves existing per-hook settings when enabling session-memory", () => {
      const result = enableDefaultOnboardingInternalHooks({
        hooks: {
          internal: {
            entries: {
              "session-memory": {
                messages: 25,
              },
            },
          },
        },
      });

      expect(result.hooks?.internal?.entries?.["session-memory"]).toEqual({
        enabled: true,
        messages: 25,
      });
    });
  });
});
