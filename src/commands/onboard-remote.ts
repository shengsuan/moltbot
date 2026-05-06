import type { OpenClawConfig } from "../config/types.openclaw.js";
import type { SecretInput } from "../config/types.secrets.js";
import { isSecureWebSocketUrl } from "../gateway/net.js";
import { discoverGatewayBeacons, type GatewayBonjourBeacon } from "../infra/bonjour-discovery.js";
import {
  buildGatewayDiscoveryLabel,
  buildGatewayDiscoveryTarget,
} from "../infra/gateway-discovery-targets.js";
import { resolveWideAreaDiscoveryDomain } from "../infra/widearea-dns.js";
import { resolveSecretInputModeForEnvSelection } from "../plugins/provider-auth-mode.js";
import { promptSecretRefForSetup } from "../plugins/provider-auth-ref.js";
import { maskApiKey } from "../utils/mask-api-key.js";
import type { WizardPrompter } from "../wizard/prompts.js";
import { detectBinary } from "./onboard-helpers.js";
import type { SecretInputMode } from "./onboard-types.js";

const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:18789";

function buildLabel(beacon: GatewayBonjourBeacon): string {
  return buildGatewayDiscoveryLabel(beacon);
}

function ensureWsUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_GATEWAY_URL;
  }
  return trimmed;
}

function validateGatewayWebSocketUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed.startsWith("ws://") && !trimmed.startsWith("wss://")) {
    return "URL 必须以 ws:// or wss:// 开头";
  }
  if (
    !isSecureWebSocketUrl(trimmed, {
      allowPrivateWs: process.env.OPENCLAW_ALLOW_INSECURE_PRIVATE_WS === "1",
    })
  ) {
    return (
      "远程主机使用 wss:// , 或 ws://127.0.0.1/localhost 通过 SSH tunnel. " +
      "私有可信任网络使用 Break-glass: OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=1."
    );
  }
  return undefined;
}

export async function promptRemoteGatewayConfig(
  cfg: OpenClawConfig,
  prompter: WizardPrompter,
  options?: { secretInputMode?: SecretInputMode },
): Promise<OpenClawConfig> {
  let selectedBeacon: GatewayBonjourBeacon | null = null;
  let suggestedUrl = cfg.gateway?.remote?.url ?? DEFAULT_GATEWAY_URL;
  let discoveryTlsFingerprint: string | undefined;
  let trustedDiscoveryUrl: string | undefined;

  const hasBonjourTool = (await detectBinary("dns-sd")) || (await detectBinary("avahi-browse"));
  const wantsDiscover = hasBonjourTool
    ? await prompter.confirm({
        message: "搜索本地局域网的 gateway?",
        initialValue: true,
      })
    : false;

  if (!hasBonjourTool) {
    await prompter.note(
      [
        "搜索需要 dns-sd (macOS) 或 avahi-browse (Linux).",
        "文档: https://docs.openclaw.ai/gateway/discovery",
      ].join("\n"),
      "搜索",
    );
  }

  if (wantsDiscover) {
    const wideAreaDomain = resolveWideAreaDiscoveryDomain({
      configDomain: cfg.discovery?.wideArea?.domain,
    });
    const spin = prompter.progress("正在搜索 gateways…");
    const beacons = await discoverGatewayBeacons({ timeoutMs: 2000, wideAreaDomain });
    spin.stop(beacons.length > 0 ? `找到 ${beacons.length} 个gateway(s)` : "未发现 gateways");

    if (beacons.length > 0) {
      const selection = await prompter.select({
        message: "选择 gateway",
        options: [
          ...beacons.map((beacon, index) => ({
            value: String(index),
            label: buildLabel(beacon),
          })),
          { value: "manual", label: "输入 URL" },
        ],
      });
      if (selection !== "manual") {
        const idx = Number.parseInt(selection, 10);
        selectedBeacon = Number.isFinite(idx) ? (beacons[idx] ?? null) : null;
      }
    }
  }

  if (selectedBeacon) {
    const target = buildGatewayDiscoveryTarget(selectedBeacon);
    if (target.endpoint) {
      const { host, port } = target.endpoint;
      const mode = await prompter.select({
        message: "链接方式",
        options: [
          {
            value: "direct",
            label: `直连 gateway WS (${host}:${port})`,
          },
          { value: "ssh", label: "SSH tunnel (loopback)" },
        ],
      });
      if (mode === "direct") {
        suggestedUrl = `wss://${host}:${port}`;
        const fingerprint = target.endpoint.gatewayTlsFingerprintSha256;
        const trusted = await prompter.confirm({
          message: `信任此 gateway? Host: ${host}:${port} TLS fingerprint: ${fingerprint ?? "未公开宣传（连接不会被固定）"}`,
          initialValue: false,
        });
        if (trusted) {
          discoveryTlsFingerprint = fingerprint;
          trustedDiscoveryUrl = suggestedUrl;
          await prompter.note(
            [
              "直接远程访问默认使用TLS协议。",
              `Using: ${suggestedUrl}`,
              ...(fingerprint ? [`TLS pin: ${fingerprint}`] : []),
              "如果您的网关仅支持环回，请选择 SSH 隧道并保留 ws://127.0.0.1:18789.",
            ].join("\n"),
            "Direct remote",
          );
        } else {
          // Clear the discovered endpoint so the manual prompt falls back to a safe default.
          suggestedUrl = DEFAULT_GATEWAY_URL;
        }
      } else {
        suggestedUrl = DEFAULT_GATEWAY_URL;
        await prompter.note(
          [
            "使用 CLI 前请先建立隧道：",
            `ssh -N -L 18789:127.0.0.1:18789 <user>@${host}${target.sshPort ? ` -p ${target.sshPort}` : ""}`,
            "文档: https://docs.openclaw.ai/gateway/remote",
          ].join("\n"),
          "SSH 隧道",
        );
      }
    }
  }

  const urlInput = await prompter.text({
    message: "Gateway WebSocket URL",
    initialValue: suggestedUrl,
    validate: (value) => validateGatewayWebSocketUrl(value),
  });
  const url = ensureWsUrl(urlInput);
  const pinnedDiscoveryFingerprint =
    discoveryTlsFingerprint && url === trustedDiscoveryUrl ? discoveryTlsFingerprint : undefined;

  const authChoice = await prompter.select({
    message: "Gateway 认证",
    options: [
      { value: "token", label: "Token (recommended)" },
      { value: "password", label: "密码" },
      { value: "off", label: "无认证" },
    ],
  });

  let token: SecretInput | undefined = cfg.gateway?.remote?.token;
  let password: SecretInput | undefined = cfg.gateway?.remote?.password;
  if (authChoice === "token") {
    const selectedMode = await resolveSecretInputModeForEnvSelection({
      prompter,
      explicitMode: options?.secretInputMode,
      copy: {
        modeMessage: "您希望如何提供此网关令牌?",
        plaintextLabel: "输入 token ",
        plaintextHint: "保存 token 到 OpenClaw 配置文件",
      },
    });
    if (selectedMode === "ref") {
      const resolved = await promptSecretRefForSetup({
        provider: "gateway-remote-token",
        config: cfg,
        prompter,
        preferredEnvVar: "OPENCLAW_GATEWAY_TOKEN",
        copy: {
          sourceMessage: "gateway token 保存在哪里?",
          envVarPlaceholder: "OPENCLAW_GATEWAY_TOKEN",
        },
      });
      token = resolved.ref;
    } else {
      const existingToken = typeof token === "string" ? token : undefined;
      if (
        existingToken &&
        (await prompter.confirm({
          message: `Use existing gateway token (${maskApiKey(existingToken)})?`,
          initialValue: true,
        }))
      ) {
        token = existingToken;
      } else {
        token = (
          await prompter.text({
            message: "Gateway token",
            validate: (value) => (value?.trim() ? undefined : "Required"),
            sensitive: true,
          })
        ).trim();
      }
    }
    password = undefined;
  } else if (authChoice === "password") {
    const selectedMode = await resolveSecretInputModeForEnvSelection({
      prompter,
      explicitMode: options?.secretInputMode,
      copy: {
        modeMessage: "您想如何提供此网关密码?",
        plaintextLabel: "现在输入密码",
        plaintextHint: "密码保存到 OpenClaw 配置文件中",
      },
    });
    if (selectedMode === "ref") {
      const resolved = await promptSecretRefForSetup({
        provider: "gateway-remote-password",
        config: cfg,
        prompter,
        preferredEnvVar: "OPENCLAW_GATEWAY_PASSWORD",
        copy: {
          sourceMessage: "gateway 密码保存在哪里?",
          envVarPlaceholder: "OPENCLAW_GATEWAY_PASSWORD",
        },
      });
      password = resolved.ref;
    } else {
      const existingPassword = typeof password === "string" ? password : undefined;
      if (
        existingPassword &&
        (await prompter.confirm({
          message: `Use existing gateway password (${maskApiKey(existingPassword)})?`,
          initialValue: true,
        }))
      ) {
        password = existingPassword;
      } else {
        password = (
          await prompter.text({
            message: "Gateway password",
            validate: (value) => (value?.trim() ? undefined : "Required"),
            sensitive: true,
          })
        ).trim();
      }
    }
    token = undefined;
  } else {
    token = undefined;
    password = undefined;
  }

  return {
    ...cfg,
    gateway: {
      ...cfg.gateway,
      mode: "remote",
      remote: {
        url,
        ...(token !== undefined ? { token } : {}),
        ...(password !== undefined ? { password } : {}),
        ...(pinnedDiscoveryFingerprint ? { tlsFingerprint: pinnedDiscoveryFingerprint } : {}),
      },
    },
  };
}
