// Implements `openclaw channels status` with gateway status and config-only fallback.
import { redactSensitiveUrlLikeString } from "@openclaw/net-policy/redact-sensitive-url";
import { normalizeOptionalLowercaseString } from "@openclaw/normalization-core/string-coerce";
import {
  formatCliFailureLines,
  isExpectedCliError,
  isGatewayCredentialsCliError,
} from "../../cli/failure-output.js";
import { parseTimeoutMsWithFallback } from "../../cli/parse-timeout.js";
import { withProgress } from "../../cli/progress.js";
import { callGateway } from "../../gateway/call.js";
import { isGatewaySecretRefUnavailableError } from "../../gateway/credentials.js";
import { formatErrorMessage } from "../../infra/errors.js";
import { defaultRuntime, type RuntimeEnv, writeRuntimeJson } from "../../runtime.js";
import { createLazyRuntimeModule } from "../../shared/lazy-runtime.js";

const loadChannelsStatusRuntime = createLazyRuntimeModule(() => import("./status.runtime.js"));

export type ChannelsStatusOptions = {
  channel?: string;
  json?: boolean;
  probe?: boolean;
  timeout?: string;
};

function redactGatewayUrlSecretsInText(text: string): string {
  return text.replace(/\b(?:wss?|https?):\/\/[^\s"'<>]+/gi, (rawUrl) => {
    return redactSensitiveUrlLikeString(rawUrl);
  });
}

function formatChannelsStatusError(err: unknown): string {
  return redactGatewayUrlSecretsInText(formatErrorMessage(err));
}

<<<<<<< HEAD
function formatEventLoopBits(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.degraded !== true) {
    return null;
  }
  const reasons = Array.isArray(record.reasons)
    ? record.reasons.filter((reason): reason is string => typeof reason === "string")
    : [];
  const delayMaxMs =
    typeof record.delayMaxMs === "number" && Number.isFinite(record.delayMaxMs)
      ? Math.round(record.delayMaxMs)
      : null;
  const utilization =
    typeof record.utilization === "number" && Number.isFinite(record.utilization)
      ? record.utilization
      : null;
  const cpuCoreRatio =
    typeof record.cpuCoreRatio === "number" && Number.isFinite(record.cpuCoreRatio)
      ? record.cpuCoreRatio
      : null;
  return [
    reasons.length ? `reasons=${reasons.join(",")}` : null,
    delayMaxMs != null ? `eventLoopDelayMaxMs=${delayMaxMs}` : null,
    utilization != null ? `eventLoopUtilization=${utilization}` : null,
    cpuCoreRatio != null ? `cpuCoreRatio=${cpuCoreRatio}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

/** Render gateway channel status payloads into terminal-friendly lines. */
export function formatGatewayChannelsStatusLines(payload: Record<string, unknown>): string[] {
  const lines: string[] = [];
  lines.push(theme.success("Gateway reachable."));
  const eventLoopLine = formatEventLoopBits(payload.eventLoop);
  if (eventLoopLine) {
    lines.push(theme.warn(`Gateway event loop degraded: ${eventLoopLine}`));
  }
  const channelLabels =
    payload.channelLabels && typeof payload.channelLabels === "object"
      ? (payload.channelLabels as Record<string, unknown>)
      : {};
  const accountLines = (provider: ChatChannel, accounts: Array<Record<string, unknown>>) =>
    accounts.map((account) => {
      const bits: string[] = [];
      appendEnabledConfiguredLinkedBits(bits, account);
      if (typeof account.running === "boolean") {
        bits.push(account.running ? "运行中" : "已停止");
      }
      if (typeof account.connected === "boolean") {
        bits.push(account.connected ? "已连接" : "未连接");
      }
      const inboundAt =
        typeof account.lastInboundAt === "number" && Number.isFinite(account.lastInboundAt)
          ? account.lastInboundAt
          : null;
      const outboundAt =
        typeof account.lastOutboundAt === "number" && Number.isFinite(account.lastOutboundAt)
          ? account.lastOutboundAt
          : null;
      const transportAt =
        typeof account.lastTransportActivityAt === "number" &&
        Number.isFinite(account.lastTransportActivityAt)
          ? account.lastTransportActivityAt
          : null;
      if (inboundAt) {
        bits.push(`in:${formatTimeAgo(Date.now() - inboundAt)}`);
      }
      if (outboundAt) {
        bits.push(`out:${formatTimeAgo(Date.now() - outboundAt)}`);
      }
      if (transportAt) {
        bits.push(`transport:${formatTimeAgo(Date.now() - transportAt)}`);
      }
      appendModeBit(bits, account);
      const botUsername = (() => {
        const bot = account.bot as { username?: string | null } | undefined;
        const probeBot = (account.probe as { bot?: { username?: string | null } } | undefined)?.bot;
        const raw = bot?.username ?? probeBot?.username ?? "";
        if (typeof raw !== "string") {
          return "";
        }
        const trimmed = raw.trim();
        if (!trimmed) {
          return "";
        }
        return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
      })();
      if (botUsername) {
        bits.push(`bot:${botUsername}`);
      }
      if (typeof account.dmPolicy === "string" && account.dmPolicy.length > 0) {
        bits.push(`dm:${account.dmPolicy}`);
      }
      if (Array.isArray(account.allowFrom) && account.allowFrom.length > 0) {
        bits.push(`allow:${account.allowFrom.slice(0, 2).join(",")}`);
      }
      appendTokenSourceBits(bits, account);
      const application = account.application as
        | { intents?: { messageContent?: string } }
        | undefined;
      const messageContent = application?.intents?.messageContent;
      if (
        typeof messageContent === "string" &&
        messageContent.length > 0 &&
        messageContent !== "enabled"
      ) {
        bits.push(`intents:content=${messageContent}`);
      }
      if (account.allowUnmentionedGroups === true) {
        bits.push("groups:unmentioned");
      }
      if (typeof account.healthState === "string" && account.healthState) {
        bits.push(`health:${account.healthState}`);
      }
      appendBaseUrlBit(bits, account);
      const probe = account.probe as { ok?: boolean } | undefined;
      if (probe && typeof probe.ok === "boolean") {
        bits.push(probe.ok ? "正常工作" : "探测失败");
      }
      const audit = account.audit as { ok?: boolean } | undefined;
      if (audit && typeof audit.ok === "boolean") {
        bits.push(audit.ok ? "审计正常" : "审计失败");
      }
      if (typeof account.lastError === "string" && account.lastError) {
        bits.push(`错误：${account.lastError}`);
      }
      const rawChannelLabel = channelLabels[provider];
      return buildChannelAccountLine(provider, account, bits, {
        channelLabel: typeof rawChannelLabel === "string" ? rawChannelLabel : provider,
      });
    });

  const accountsByChannel = payload.channelAccounts as Record<string, unknown> | undefined;
  const accountPayloads: Partial<Record<string, Array<Record<string, unknown>>>> = {};
  for (const channelId of Object.keys(accountsByChannel ?? {}).toSorted()) {
    const raw = accountsByChannel?.[channelId];
    if (Array.isArray(raw)) {
      accountPayloads[channelId] = raw as Array<Record<string, unknown>>;
    }
  }

  for (const channelId of Object.keys(accountPayloads).toSorted()) {
    const accounts = accountPayloads[channelId];
    if (accounts && accounts.length > 0) {
      lines.push(...accountLines(channelId, accounts));
    }
  }

  lines.push("");
  const issues = collectChannelStatusIssues(payload);
  if (issues.length > 0) {
    lines.push(theme.warn("警告："));
    for (const issue of issues) {
      lines.push(
        `- ${issue.channel} ${issue.accountId}：${issue.message}${issue.fix ? ` (${issue.fix})` : ""}`,
      );
    }
    lines.push(`- 运行：${formatCliCommand("openclaw doctor")}`);
    lines.push("");
  }
  lines.push(
    `提示：${formatDocsLink("/cli#status", "status --deep")} 在状态输出中添加网关健康探测（需要可访问的网关）。`,
  );
  return lines;
}

=======
>>>>>>> 17abdfc78c89ec69e972abf7979462757f2402fb
/** Query gateway channel status, falling back to config-only output when unavailable. */
export async function channelsStatusCommand(
  opts: ChannelsStatusOptions,
  runtime: RuntimeEnv = defaultRuntime,
) {
  const args =
    normalizeOptionalLowercaseString(opts.channel) === "all"
      ? { ...opts, channel: undefined }
      : opts;
  const timeoutMs = parseTimeoutMsWithFallback(opts.timeout, opts.probe ? 30_000 : 10_000, {
    invalidType: "error",
  });
  const statusLabel = opts.probe ? "Checking channel status (probe)…" : "Checking channel status…";
  const shouldLogStatus = opts.json !== true && !process.stderr.isTTY;
  if (shouldLogStatus) {
    runtime.log(statusLabel);
  }
  try {
    const payload = await withProgress(
      {
        label: statusLabel,
        indeterminate: true,
        enabled: opts.json !== true,
      },
      async () => {
        const params: { channel?: string; probe: boolean; timeoutMs: number } = {
          probe: Boolean(opts.probe),
          timeoutMs,
        };
        if (args.channel) {
          params.channel = args.channel;
        }
        return await callGateway({
          method: "channels.status",
          params,
          timeoutMs,
        });
      },
    );
    if (opts.json) {
      writeRuntimeJson(runtime, payload);
      return;
    }
    const { formatGatewayChannelsStatusLines } = await loadChannelsStatusRuntime();
    runtime.log(formatGatewayChannelsStatusLines(payload).join("\n"));
  } catch (err) {
    const safeError = formatChannelsStatusError(err);
    const expectedError = isExpectedCliError(err);
    const gatewayAuthUnavailable =
      isGatewayCredentialsCliError(err) || isGatewaySecretRefUnavailableError(err);
    const expectedErrorOutput = expectedError
      ? formatCliFailureLines({ title: "", error: err }).join("\n")
      : undefined;
    const { renderChannelsStatusFallback } = await loadChannelsStatusRuntime();
    await renderChannelsStatusFallback({
      opts: args,
      runtime,
      safeError,
      gatewayAuthUnavailable,
      expectedErrorOutput,
    });
  }
}
