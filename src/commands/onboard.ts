import { formatCliCommand } from "../cli/command-format.js";
import { readConfigFileSnapshot } from "../config/config.js";
import { assertSupportedRuntime } from "../infra/runtime-guard.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { resolveUserPath } from "../utils.js";
import {
  formatDeprecatedNonInteractiveAuthChoiceError,
  isDeprecatedAuthChoice,
  normalizeLegacyOnboardAuthChoice,
  resolveDeprecatedAuthChoiceReplacement,
} from "./auth-choice-legacy.js";
import { DEFAULT_WORKSPACE, handleReset } from "./onboard-helpers.js";
import { runInteractiveSetup } from "./onboard-interactive.js";
import { runNonInteractiveSetup } from "./onboard-non-interactive.js";
import type { OnboardOptions, ResetScope } from "./onboard-types.js";

const VALID_RESET_SCOPES = new Set<ResetScope>(["config", "config+creds+sessions", "full"]);

export async function setupWizardCommand(
  opts: OnboardOptions,
  runtime: RuntimeEnv = defaultRuntime,
) {
  assertSupportedRuntime(runtime);
  const originalAuthChoice = opts.authChoice;
  const normalizedAuthChoice = normalizeLegacyOnboardAuthChoice(originalAuthChoice, {
    env: process.env,
  });
  if (opts.nonInteractive && isDeprecatedAuthChoice(originalAuthChoice, { env: process.env })) {
    runtime.error(
      formatDeprecatedNonInteractiveAuthChoiceError(originalAuthChoice, {
        env: process.env,
      })!,
    );
    runtime.exit(1);
    return;
  }
  if (isDeprecatedAuthChoice(originalAuthChoice, { env: process.env })) {
    runtime.log(
      resolveDeprecatedAuthChoiceReplacement(originalAuthChoice, { env: process.env })!.message,
    );
  }
  const flow = opts.flow === "manual" ? ("advanced" as const) : opts.flow;
  const normalizedOpts =
    normalizedAuthChoice === opts.authChoice && flow === opts.flow
      ? opts
      : { ...opts, authChoice: normalizedAuthChoice, flow };
  if (
    normalizedOpts.secretInputMode &&
    normalizedOpts.secretInputMode !== "plaintext" && // pragma: allowlist secret
    normalizedOpts.secretInputMode !== "ref" // pragma: allowlist secret
  ) {
    runtime.error('无效的 --secret-input-mode。请使用 "plaintext" 或 "ref"。');
    runtime.exit(1);
    return;
  }

  if (normalizedOpts.resetScope && !VALID_RESET_SCOPES.has(normalizedOpts.resetScope)) {
    runtime.error('无效的 --reset-scope。请使用 "config"、"config+creds+sessions" 或 "full"。');
    runtime.exit(1);
    return;
  }

  if (normalizedOpts.nonInteractive && normalizedOpts.acceptRisk !== true) {
    runtime.error(
      [
        "非交互式设置需要明确告知风险。",
        "阅读: https://docs.openclaw.ai/security",
        `重新运行命令: ${formatCliCommand("openclaw onboard --non-interactive --accept-risk ...")}`,
      ].join("\n"),
    );
    runtime.exit(1);
    return;
  }

  if (normalizedOpts.reset) {
    const snapshot = await readConfigFileSnapshot();
    const baseConfig = snapshot.valid ? (snapshot.sourceConfig ?? snapshot.config) : {};
    const workspaceDefault =
      normalizedOpts.workspace ?? baseConfig.agents?.defaults?.workspace ?? DEFAULT_WORKSPACE;
    const resetScope: ResetScope = normalizedOpts.resetScope ?? "config+creds+sessions";
    await handleReset(resetScope, resolveUserPath(workspaceDefault), runtime);
  }

  if (process.platform === "win32") {
    runtime.log(
      [
        "检测到 Windows 系统 - OpenClaw 在 WSL2 上运行良好！",
        "原生 Windows 系统可能比较棘手。",
        "快速安装：wsl --install（一条命令，一次重启）",
        "指南: https://docs.openclaw.ai/windows",
      ].join("\n"),
    );
  }

  if (normalizedOpts.nonInteractive) {
    await runNonInteractiveSetup(normalizedOpts, runtime);
    return;
  }

  await runInteractiveSetup(normalizedOpts, runtime);
}

export const onboardCommand = setupWizardCommand;

export type { OnboardOptions } from "./onboard-types.js";
