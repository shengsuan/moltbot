import fs from "node:fs/promises";
import path from "node:path";
import { describeCodexNativeWebSearch } from "../agents/codex-native-web-search.shared.js";
import { DEFAULT_BOOTSTRAP_FILENAME } from "../agents/workspace.js";
import { formatCliCommand } from "../cli/command-format.js";
import {
  buildGatewayInstallPlan,
  gatewayInstallErrorHint,
} from "../commands/daemon-install-helpers.js";
import {
  DEFAULT_GATEWAY_DAEMON_RUNTIME,
  GATEWAY_DAEMON_RUNTIME_OPTIONS,
} from "../commands/daemon-runtime.js";
import { resolveGatewayInstallToken } from "../commands/gateway-install-token.js";
import { formatHealthCheckFailure } from "../commands/health-format.js";
import { healthCommand } from "../commands/health.js";
import {
  detectBrowserOpenSupport,
  formatControlUiSshHint,
  openUrl,
  probeGatewayReachable,
  waitForGatewayReachable,
  resolveControlUiLinks,
} from "../commands/onboard-helpers.js";
import type { OnboardOptions } from "../commands/onboard-types.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { describeGatewayServiceRestart, resolveGatewayService } from "../daemon/service.js";
import { isSystemdUserServiceAvailable } from "../daemon/systemd.js";
import { ensureControlUiAssetsBuilt } from "../infra/control-ui-assets.js";
import { formatErrorMessage } from "../infra/errors.js";
import type { RuntimeEnv } from "../runtime.js";
import { restoreTerminalState } from "../terminal/restore.js";
import { runTui } from "../tui/tui.js";
import { resolveUserPath } from "../utils.js";
import { listConfiguredWebSearchProviders } from "../web-search/runtime.js";
import type { WizardPrompter } from "./prompts.js";
import { setupWizardShellCompletion } from "./setup.completion.js";
import { resolveSetupSecretInputString } from "./setup.secret-input.js";
import type { GatewayWizardSettings, WizardFlow } from "./setup.types.js";

type FinalizeOnboardingOptions = {
  flow: WizardFlow;
  opts: OnboardOptions;
  baseConfig: OpenClawConfig;
  nextConfig: OpenClawConfig;
  workspaceDir: string;
  settings: GatewayWizardSettings;
  prompter: WizardPrompter;
  runtime: RuntimeEnv;
};

export async function finalizeSetupWizard(
  options: FinalizeOnboardingOptions,
): Promise<{ launchedTui: boolean }> {
  const { flow, opts, baseConfig, nextConfig, settings, prompter, runtime } = options;
  let gatewayProbe: { ok: boolean; detail?: string } = { ok: true };

  const withWizardProgress = async <T>(
    label: string,
    options: { doneMessage?: string | (() => string | undefined) },
    work: (progress: { update: (message: string) => void }) => Promise<T>,
  ): Promise<T> => {
    const progress = prompter.progress(label);
    try {
      return await work(progress);
    } finally {
      progress.stop(
        typeof options.doneMessage === "function" ? options.doneMessage() : options.doneMessage,
      );
    }
  };

  const systemdAvailable =
    process.platform === "linux" ? await isSystemdUserServiceAvailable() : true;
  if (process.platform === "linux" && !systemdAvailable) {
    await prompter.note("Systemd 用户服务不可用。跳过持久化检查和服务安装。", "Systemd");
  }

  if (process.platform === "linux" && systemdAvailable) {
    const { ensureSystemdUserLingerInteractive } = await import("../commands/systemd-linger.js");
    await ensureSystemdUserLingerInteractive({
      runtime,
      prompter: {
        confirm: prompter.confirm,
        note: prompter.note,
      },
      reason:
        "Linux 安装默认使用 systemd 用户服务。如果没有持久化，systemd 会在注销/空闲时停止用户会话并终止网关。",
      requireConfirm: false,
    });
  }

  const explicitInstallDaemon =
    typeof opts.installDaemon === "boolean" ? opts.installDaemon : undefined;
  let installDaemon: boolean;
  if (explicitInstallDaemon !== undefined) {
    installDaemon = explicitInstallDaemon;
  } else if (process.platform === "linux" && !systemdAvailable) {
    installDaemon = false;
  } else if (flow === "quickstart") {
    installDaemon = true;
  } else {
    installDaemon = await prompter.confirm({
      message: "安装网关服务（推荐）",
      initialValue: true,
    });
  }

  if (process.platform === "linux" && !systemdAvailable && installDaemon) {
    await prompter.note(
      "Systemd 用户服务不可用；跳过服务安装。请使用您的容器管理程序或 `docker compose up -d`。",
      "网关服务",
    );
    installDaemon = false;
  }

  if (installDaemon) {
    const daemonRuntime =
      flow === "quickstart"
        ? DEFAULT_GATEWAY_DAEMON_RUNTIME
        : await prompter.select({
            message: "网关服务运行时",
            options: GATEWAY_DAEMON_RUNTIME_OPTIONS,
            initialValue: opts.daemonRuntime ?? DEFAULT_GATEWAY_DAEMON_RUNTIME,
          });
    if (flow === "quickstart") {
      await prompter.note(
        "快速开始使用 Node 作为网关服务运行时（稳定 + 受支持）。",
        "网关服务运行时",
      );
    }
    const service = resolveGatewayService();
    const loaded = await service.isLoaded({ env: process.env });
    let restartWasScheduled = false;
    if (loaded) {
      const action = await prompter.select({
        message: "网关服务已安装",
        options: [
          { value: "restart", label: "重启" },
          { value: "reinstall", label: "重新安装" },
          { value: "skip", label: "跳过" },
        ],
      });
      if (action === "restart") {
        let restartDoneMessage = "Gateway 服务已经重启.";
        await withWizardProgress(
          "Gateway 服务",
          { doneMessage: () => restartDoneMessage },
          async (progress) => {
            progress.update("重启 Gateway 服务");
            const restartResult = await service.restart({
              env: process.env,
              stdout: process.stdout,
            });
            const restartStatus = describeGatewayServiceRestart("Gateway", restartResult);
            restartDoneMessage = restartStatus.progressMessage;
            restartWasScheduled = restartStatus.scheduled;
          },
        );
      } else if (action === "reinstall") {
        await withWizardProgress(
          "网关服务",
          { doneMessage: "网关服务已卸载。" },
          async (progress) => {
            progress.update("正在卸载网关服务…");
            await service.uninstall({ env: process.env, stdout: process.stdout });
          },
        );
      }
    }

    if (
      !loaded ||
      (!restartWasScheduled && loaded && !(await service.isLoaded({ env: process.env })))
    ) {
      const progress = prompter.progress("Gateway 服务");
      let installError: string | null = null;
      try {
        progress.update("正在准备 Gateway 服务");
        const tokenResolution = await resolveGatewayInstallToken({
          config: nextConfig,
          env: process.env,
        });
        for (const warning of tokenResolution.warnings) {
          await prompter.note(warning, "Gateway 服务");
        }
        if (tokenResolution.unavailableReason) {
          installError = [
            "Gateway 安装被阻止:",
            tokenResolution.unavailableReason,
            "修复网关认证配置/令牌输入并重新运行设置。",
          ].join(" ");
        } else {
          const { programArguments, workingDirectory, environment } = await buildGatewayInstallPlan(
            {
              env: process.env,
              port: settings.port,
              runtime: daemonRuntime,
              warn: (message, title) => prompter.note(message, title),
              config: nextConfig,
            },
          );

          progress.update("正在安装 Gateway 服务…");
          await service.install({
            env: process.env,
            stdout: process.stdout,
            programArguments,
            workingDirectory,
            environment,
          });
        }
      } catch (err) {
        installError = formatErrorMessage(err);
      } finally {
        progress.stop(installError ? "网关服务安装失败。" : "网关服务已安装。");
      }
      if (installError) {
        await prompter.note(`网关服务安装失败: ${installError}`, "网关");
        await prompter.note(gatewayInstallErrorHint(), "网关");
      }
    }
  }

  if (!opts.skipHealth) {
    const probeLinks = resolveControlUiLinks({
      bind: nextConfig.gateway?.bind ?? "loopback",
      port: settings.port,
      customBindHost: nextConfig.gateway?.customBindHost,
      basePath: undefined,
    });
    // Daemon install/restart can briefly flap the WS; wait a bit so health check doesn't false-fail.
    gatewayProbe = await waitForGatewayReachable({
      url: probeLinks.wsUrl,
      token: settings.gatewayToken,
      deadlineMs: 15_000,
    });
    if (gatewayProbe.ok) {
      try {
        await healthCommand({ json: false, timeoutMs: 10_000 }, runtime);
      } catch (err) {
        runtime.error(formatHealthCheckFailure(err));
        await prompter.note(
          [
            "Docs:",
            "https://docs.openclaw.ai/gateway/health",
            "https://docs.openclaw.ai/gateway/troubleshooting",
          ].join("\n"),
          "Health check help",
        );
      }
    } else if (installDaemon) {
      runtime.error(
        formatHealthCheckFailure(
          new Error(
            gatewayProbe.detail ?? `gateway did not become reachable at ${probeLinks.wsUrl}`,
          ),
        ),
      );
      await prompter.note(
        [
          "文档:",
          "https://docs.openclaw.ai/gateway/health",
          "https://docs.openclaw.ai/gateway/troubleshooting",
        ].join("\n"),
        "健康检查帮助",
      );
    } else {
      await prompter.note(
        [
          "尚未检测到网关.",
          "安装程序未安装网关服务，因此不会有后台网关。",
          `现在启动: ${formatCliCommand("openclaw gateway run")}`,
          `或运行此命令安装网关服务: ${formatCliCommand("openclaw onboard --install-daemon")}`,
          `或跳过此探测: ${formatCliCommand("openclaw onboard --skip-health")}`,
        ].join("\n"),
        "网关",
      );
    }
  }

  const controlUiEnabled =
    nextConfig.gateway?.controlUi?.enabled ?? baseConfig.gateway?.controlUi?.enabled ?? true;
  if (!opts.skipUi && controlUiEnabled) {
    const controlUiAssets = await ensureControlUiAssetsBuilt(runtime);
    if (!controlUiAssets.ok && controlUiAssets.message) {
      runtime.error(controlUiAssets.message);
    }
  }

  await prompter.note(
    [
      "添加节点以获得额外功能：",
      "- macOS 应用（系统 + 通知）",
      "- iOS 应用（摄像头/画布）",
      "- Android 应用（摄像头/画布）",
    ].join("\n"),
    "可选应用",
  );

  const controlUiBasePath =
    nextConfig.gateway?.controlUi?.basePath ?? baseConfig.gateway?.controlUi?.basePath;
  const links = resolveControlUiLinks({
    bind: settings.bind,
    port: settings.port,
    customBindHost: settings.customBindHost,
    basePath: controlUiBasePath,
  });
  const authedUrl =
    settings.authMode === "token" && settings.gatewayToken
      ? `${links.httpUrl}#token=${encodeURIComponent(settings.gatewayToken)}`
      : links.httpUrl;
  let resolvedGatewayPassword = "";
  if (settings.authMode === "password") {
    try {
      resolvedGatewayPassword =
        (await resolveSetupSecretInputString({
          config: nextConfig,
          value: nextConfig.gateway?.auth?.password,
          path: "gateway.auth.password",
          env: process.env,
        })) ?? "";
    } catch (error) {
      await prompter.note(
        [
          "无法解析认证所需的 gateway.auth.password SecretRef。",
          formatErrorMessage(error),
        ].join("\n"),
        "网关认证",
      );
    }
  }

  if (opts.skipHealth || !gatewayProbe.ok) {
    gatewayProbe = await probeGatewayReachable({
      url: links.wsUrl,
      token: settings.authMode === "token" ? settings.gatewayToken : undefined,
      password: settings.authMode === "password" ? resolvedGatewayPassword : "",
    });
  }
  const gatewayStatusLine = gatewayProbe.ok
    ? "网关: 可访问"
    : `网关: 未检测到${gatewayProbe.detail ? ` (${gatewayProbe.detail})` : ""}`;
  const bootstrapPath = path.join(
    resolveUserPath(options.workspaceDir),
    DEFAULT_BOOTSTRAP_FILENAME,
  );
  const hasBootstrap = await fs
    .access(bootstrapPath)
    .then(() => true)
    .catch(() => false);

  await prompter.note(
    [
      `Web UI: ${links.httpUrl}`,
      settings.authMode === "token" && settings.gatewayToken
        ? `Web UI（带令牌）: ${authedUrl}`
        : undefined,
      `网关 WS: ${links.wsUrl}`,
      gatewayStatusLine,
      "文档: https://docs.openclaw.ai/web/control-ui",
    ]
      .filter(Boolean)
      .join("\n"),
    "控制 UI",
  );

  let controlUiOpened = false;
  let controlUiOpenHint: string | undefined;
  let seededInBackground = false;
  let hatchChoice: "tui" | "web" | "later" | null = null;
  let launchedTui = false;

  if (!opts.skipUi && gatewayProbe.ok) {
    if (hasBootstrap) {
      await prompter.note(
        [
          "这是让您的代理成为您自己的关键行动。",
          "请花时间仔细考虑。",
          "您告诉它的越多，体验就会越好。",
          '我们将发送："醒来吧，我的朋友！"',
        ].join("\n"),
        "启动 TUI（最佳选择！）",
      );
    }

    await prompter.note(
      [
        "网关令牌：网关 + 控制 UI 的共享身份验证。",
        "存储在：$OPENCLAW_CONFIG_PATH（默认：~/.openclaw/openclaw.json）中的 gateway.auth.token，或 OPENCLAW_GATEWAY_TOKEN 中。",
        `查看令牌: ${formatCliCommand("openclaw config get gateway.auth.token")}`,
        `生成令牌: ${formatCliCommand("openclaw doctor --generate-gateway-token")}`,
        "Web UI 会将当前标签页的仪表盘 URL 令牌保存在内存中，并在加载完成后从 URL 中移除这些令牌。",
        `随时打开仪表盘: ${formatCliCommand("openclaw dashboard --no-open")}`,
        "如果出现提示：将令牌粘贴到 Control UI 设置中（或使用令牌化的仪表板 URL）。",
      ].join("\n"),
      "令牌",
    );

    hatchChoice = await prompter.select({
      message: "您想如何孵化您的机器人？",
      options: [
        { value: "tui", label: "在 TUI 中孵化（推荐）" },
        { value: "web", label: "打开 Web UI" },
        { value: "later", label: "稍后再做" },
      ],
      initialValue: "tui",
    });

    if (hatchChoice === "tui") {
      restoreTerminalState("pre-setup tui", { resumeStdinIfPaused: true });
      await runTui({
        url: links.wsUrl,
        token: settings.authMode === "token" ? settings.gatewayToken : undefined,
        password: settings.authMode === "password" ? resolvedGatewayPassword : "",
        // Safety: setup TUI should not auto-deliver to lastProvider/lastTo.
        deliver: false,
        message: hasBootstrap ? "醒来吧，我的朋友！" : undefined,
      });
      launchedTui = true;
    } else if (hatchChoice === "web") {
      const browserSupport = await detectBrowserOpenSupport();
      if (browserSupport.ok) {
        controlUiOpened = await openUrl(authedUrl);
        if (!controlUiOpened) {
          controlUiOpenHint = formatControlUiSshHint({
            port: settings.port,
            basePath: controlUiBasePath,
            token: settings.authMode === "token" ? settings.gatewayToken : undefined,
          });
        }
      } else {
        controlUiOpenHint = formatControlUiSshHint({
          port: settings.port,
          basePath: controlUiBasePath,
          token: settings.authMode === "token" ? settings.gatewayToken : undefined,
        });
      }
      await prompter.note(
        [
          `仪表板链接（带令牌）: ${authedUrl}`,
          controlUiOpened
            ? "已在浏览器中打开。保留该标签页以控制 OpenClaw。"
            : "在本机的浏览器中复制/粘贴此 URL 以控制 OpenClaw。",
          controlUiOpenHint,
        ]
          .filter(Boolean)
          .join("\n"),
        "仪表板已就绪",
      );
    } else {
      await prompter.note(`准备好后: ${formatCliCommand("openclaw dashboard --no-open")}`, "稍后");
    }
  } else if (opts.skipUi) {
    await prompter.note("跳过控制 UI/TUI 提示。", "控制 UI");
  }

  await prompter.note(
    ["备份您的代理工作空间。", "文档: https://docs.openclaw.ai/concepts/agent-workspace"].join(
      "\n",
    ),
    "工作空间备份",
  );

  await prompter.note(
    "在您的计算机上运行代理是有风险的 — 加固您的设置: https://docs.openclaw.ai/security",
    "安全",
  );

  await setupWizardShellCompletion({ flow, prompter });

  const shouldOpenControlUi =
    !opts.skipUi &&
    gatewayProbe.ok &&
    settings.authMode === "token" &&
    Boolean(settings.gatewayToken) &&
    hatchChoice === null;
  if (shouldOpenControlUi) {
    const browserSupport = await detectBrowserOpenSupport();
    if (browserSupport.ok) {
      controlUiOpened = await openUrl(authedUrl);
      if (!controlUiOpened) {
        controlUiOpenHint = formatControlUiSshHint({
          port: settings.port,
          basePath: controlUiBasePath,
          token: settings.gatewayToken,
        });
      }
    } else {
      controlUiOpenHint = formatControlUiSshHint({
        port: settings.port,
        basePath: controlUiBasePath,
        token: settings.gatewayToken,
      });
    }

    await prompter.note(
      [
        `仪表板链接（带令牌）: ${authedUrl}`,
        controlUiOpened
          ? "已在浏览器中打开。保留该标签页以控制 OpenClaw。"
          : "在本机的浏览器中复制/粘贴此 URL 以控制 OpenClaw。",
        controlUiOpenHint,
      ]
        .filter(Boolean)
        .join("\n"),
      "仪表板已就绪",
    );
  }

  const codexNativeSummary = describeCodexNativeWebSearch(nextConfig);
  const webSearchProvider = nextConfig.tools?.web?.search?.provider;
  const webSearchEnabled = nextConfig.tools?.web?.search?.enabled;
  const configuredSearchProviders = listConfiguredWebSearchProviders({ config: nextConfig });
  if (webSearchProvider) {
    const { resolveExistingKey, hasExistingKey, hasKeyInEnv } =
      await import("../commands/onboard-search.js");
    const entry = configuredSearchProviders.find((e) => e.id === webSearchProvider);
    const label = entry?.label ?? webSearchProvider;
    const storedKey = entry ? resolveExistingKey(nextConfig, webSearchProvider) : undefined;
    const keyConfigured = entry ? hasExistingKey(nextConfig, webSearchProvider) : false;
    const envAvailable = entry ? hasKeyInEnv(entry) : false;
    const hasKey = keyConfigured || envAvailable;
    const keySource = storedKey
      ? "API key: 保存到配置文件中。"
      : keyConfigured
        ? "API key: 通过密钥引用进行配置。"
        : envAvailable
          ? `API key: 通过环境变量提供 ${entry?.envVars.join(" / ")}`
          : undefined;
    if (!entry) {
      await prompter.note(
        [
          `Web search provider ${label} is selected but unavailable under the current plugin policy.`,
          "web_search will not work until the provider is re-enabled or a different provider is selected.",
          `  ${formatCliCommand("openclaw configure --section web")}`,
          "",
          "Docs: https://docs.openclaw.ai/tools/web",
        ].join("\n"),
        "Web search",
      );
    } else if (webSearchEnabled !== false && hasKey) {
      await prompter.note(
        [
          "网络搜索功能已启用，因此您的代理人可以在需要时在线查找信息。",
          "",
          `供应商: ${label}`,
          ...(keySource ? [keySource] : []),
          "Docs: https://docs.openclaw.ai/tools/web",
        ].join("\n"),
        "网络搜索",
      );
    } else if (!hasKey) {
      await prompter.note(
        [
          `供应商 ${label} 被选中但未找到 API key.`,
          "web_search 将不会工作直到添加密钥。",
          `  ${formatCliCommand("openclaw configure --section web")}`,
          "",
          `在以下位置获取您的 API key: ${entry?.signupUrl ?? "https://docs.openclaw.ai/tools/web"}`,
          "Docs: https://docs.openclaw.ai/tools/web",
        ].join("\n"),
        "网络搜索",
      );
    } else {
      await prompter.note(
        [
          `网络搜索 (${label}) 已配置但已禁用。`,
          `重新启用: ${formatCliCommand("openclaw configure --section web")}`,
          "",
          "Docs: https://docs.openclaw.ai/tools/web",
        ].join("\n"),
        "网络搜索",
      );
    }
  } else {
    // Legacy configs may have a working key (e.g. apiKey or BRAVE_API_KEY) without
    // an explicit provider. Runtime auto-detects these, so avoid saying "skipped".
    const { hasExistingKey, hasKeyInEnv } = await import("../commands/onboard-search.js");
    const legacyDetected = configuredSearchProviders.find(
      (e) => hasExistingKey(nextConfig, e.id) || hasKeyInEnv(e),
    );
    if (legacyDetected) {
      await prompter.note(
        [
          `网络搜索可通过 ${legacyDetected.label} 使用（自动检测）。`,
          "Docs: https://docs.openclaw.ai/tools/web",
        ].join("\n"),
        "网络搜索",
      );
    } else if (codexNativeSummary) {
      await prompter.note(
        [
          "Managed web search provider was skipped.",
          codexNativeSummary,
          "Docs: https://docs.openclaw.ai/tools/web",
        ].join("\n"),
        "Web search",
      );
    } else {
      await prompter.note(
        [
          "网络搜索被跳过。您可以稍后启用它:",
          `  ${formatCliCommand("openclaw configure --section web")}`,
          "",
          "Docs: https://docs.openclaw.ai/tools/web",
        ].join("\n"),
        "网络搜索",
      );
    }
  }

  if (codexNativeSummary) {
    await prompter.note(
      [
        codexNativeSummary,
        "Used only for Codex-capable models.",
        "Docs: https://docs.openclaw.ai/tools/web",
      ].join("\n"),
      "Codex native search",
    );
  }

  await prompter.note(
    '接下来做什么: https://openclaw.ai/showcase ("人们正在构建什么")。',
    "接下来做什么",
  );

  await prompter.outro(
    controlUiOpened
      ? "配置完成。仪表板已打开；保留该标签页以控制 OpenClaw。"
      : seededInBackground
        ? "配置完成。Web UI 已在后台初始化；随时使用上面的仪表板链接打开它。"
        : "配置完成。使用上面的仪表板链接控制 OpenClaw。",
  );

  return { launchedTui };
}
