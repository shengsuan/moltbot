// OpenClaw Gateway client facade.
// Wraps the shared gateway-client package with OpenClaw host dependencies.
import {
  GatewayClient as BaseGatewayClient,
  GATEWAY_CLOSE_CODE_HINTS as BASE_GATEWAY_CLOSE_CODE_HINTS,
  GatewayClientRequestError as BaseGatewayClientRequestError,
  describeGatewayCloseCode as baseDescribeGatewayCloseCode,
  isGatewayConnectAssemblyError as baseIsGatewayConnectAssemblyError,
  resolveGatewayClientConnectChallengeTimeoutMs as baseResolveGatewayClientConnectChallengeTimeoutMs,
} from "../../packages/gateway-client/src/index.js";
import type {
  GatewayClientMode,
  GatewayClientName,
} from "../../packages/gateway-protocol/src/client-info.js";
import type { EventFrame, HelloOk } from "../../packages/gateway-protocol/src/index.js";
import {
  clearDeviceAuthToken,
  loadDeviceAuthToken,
  storeDeviceAuthToken,
} from "../infra/device-auth-store.js";
import type { DeviceIdentity } from "../infra/device-identity.js";
import {
  loadOrCreateDeviceIdentity,
  publicKeyRawBase64UrlFromPem,
  signDevicePayload,
} from "../infra/device-identity.js";
import {
  ensureInheritedManagedProxyRoutingActive,
  registerManagedProxyGatewayLoopbackBypass,
} from "../infra/net/proxy/proxy-lifecycle.js";
import { normalizeFingerprint } from "../infra/tls/fingerprint.js";
import { logDebug, logError } from "../logger.js";
import { redactToolPayloadText } from "../logging/redact.js";
import { VERSION } from "../version.js";

export type DeviceAuthTokenRecord = {
  token?: string;
  scopes?: string[];
};

export type GatewayClientHostDeps = {
  loadOrCreateDeviceIdentity?: () => DeviceIdentity | undefined;
  signDevicePayload?: (privateKeyPem: string, payload: string) => string;
  publicKeyRawBase64UrlFromPem?: (publicKeyPem: string) => string;
  loadDeviceAuthToken?: (params: {
    deviceId: string;
    role: string;
    env?: NodeJS.ProcessEnv;
  }) => DeviceAuthTokenRecord | null;
  storeDeviceAuthToken?: (params: {
    deviceId: string;
    role: string;
    token: string;
    scopes: string[];
    env?: NodeJS.ProcessEnv;
  }) => void;
  clearDeviceAuthToken?: (params: {
    deviceId: string;
    role: string;
    env?: NodeJS.ProcessEnv;
  }) => void;
  beforeConnect?: () => void;
  registerGatewayLoopbackBypass?: (url: string) => (() => void) | undefined;
  logDebug?: (message: string) => void;
  logError?: (message: string) => void;
  redactForLog?: (message: string) => string;
  normalizeTlsFingerprint?: (fingerprint: string | undefined) => string;
};

export type GatewayClientRequestOptions = {
  expectFinal?: boolean;
  timeoutMs?: number | null;
  signal?: AbortSignal;
  onAccepted?: (payload: unknown) => void;
};

export type GatewayReconnectPausedInfo = {
  code: number;
  reason: string;
  detailCode: string | null;
};

type GatewayClientErrorShape = {
  message: string;
  code?: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
};

export const GATEWAY_CLOSE_CODE_HINTS: Readonly<Record<number, string>> =
  BASE_GATEWAY_CLOSE_CODE_HINTS;

export const GatewayClientRequestError = BaseGatewayClientRequestError as unknown as {
  new (error: GatewayClientErrorShape): Error & {
    readonly gatewayCode: string;
    readonly details?: unknown;
    readonly retryable: boolean;
    readonly retryAfterMs?: number;
  };
};

export type GatewayClientRequestError = InstanceType<typeof GatewayClientRequestError>;

export function describeGatewayCloseCode(code: number): string | undefined {
  return baseDescribeGatewayCloseCode(code);
}

export function isGatewayConnectAssemblyError(value: unknown): value is Error {
  return baseIsGatewayConnectAssemblyError(value);
}

export type GatewayClientOptions = {
  url?: string;
  connectChallengeTimeoutMs?: number;
  /** @deprecated Use connectChallengeTimeoutMs. */
  connectDelayMs?: number;
  preauthHandshakeTimeoutMs?: number;
  tickWatchMinIntervalMs?: number;
  tickWatchTimeoutMs?: number;
  requestTimeoutMs?: number;
  token?: string;
  bootstrapToken?: string;
  deviceToken?: string;
  password?: string;
  approvalRuntimeToken?: string;
  instanceId?: string;
  clientName?: GatewayClientName;
  clientDisplayName?: string;
  clientVersion?: string;
  platform?: string;
  deviceFamily?: string;
  mode?: GatewayClientMode;
  role?: string;
  scopes?: string[];
  caps?: string[];
  commands?: string[];
  permissions?: Record<string, boolean>;
  pathEnv?: string;
  env?: NodeJS.ProcessEnv;
  deviceIdentity?: DeviceIdentity | null;
  hostDeps?: GatewayClientHostDeps;
  minProtocol?: number;
  maxProtocol?: number;
  tlsFingerprint?: string;
  onEvent?: (evt: EventFrame) => void;
  onHelloOk?: (hello: HelloOk) => void;
  onConnectError?: (err: Error) => void;
  onReconnectPaused?: (info: GatewayReconnectPausedInfo) => void;
  onClose?: (code: number, reason: string) => void;
  onGap?: (info: { expected: number; received: number }) => void;
};

export type GatewayClientConnectionMetadata = {
  clientName?: GatewayClientName;
  hasDeviceIdentity: boolean;
  mode?: GatewayClientMode;
  preauthHandshakeTimeoutMs?: number;
};

function createOpenClawGatewayClientHostDeps(
  overrides?: GatewayClientHostDeps,
): GatewayClientHostDeps {
  return {
    // This wrapper is the only place the package reaches into OpenClaw runtime
    // state. Keep device identity, token storage, proxy, and redaction here.
    loadOrCreateDeviceIdentity,
    signDevicePayload,
    publicKeyRawBase64UrlFromPem,
    loadDeviceAuthToken,
    storeDeviceAuthToken,
    clearDeviceAuthToken,
    beforeConnect: ensureInheritedManagedProxyRoutingActive,
    registerGatewayLoopbackBypass: registerManagedProxyGatewayLoopbackBypass,
    normalizeTlsFingerprint: (fingerprint) => normalizeFingerprint(fingerprint ?? ""),
    logDebug,
    logError,
    redactForLog: redactToolPayloadText,
    ...overrides,
  };
}

export function resolveGatewayClientConnectChallengeTimeoutMs(
  opts: Pick<
    GatewayClientOptions,
    "connectChallengeTimeoutMs" | "connectDelayMs" | "preauthHandshakeTimeoutMs"
  >,
): number {
  return baseResolveGatewayClientConnectChallengeTimeoutMs(opts);
}

export class GatewayClient {
  #client: BaseGatewayClient;

  constructor(opts: GatewayClientOptions) {
    // Inject host deps here so the reusable package stays decoupled from
    // OpenClaw device identity, token storage, proxy routing, and logging.
    this.#client = new BaseGatewayClient({
      ...opts,
<<<<<<< HEAD
      deviceIdentity:
        opts.deviceIdentity === null
          ? undefined
          : (opts.deviceIdentity ?? loadOrCreateDeviceIdentity()),
    };
    this.requestTimeoutMs =
      typeof opts.requestTimeoutMs === "number" && Number.isFinite(opts.requestTimeoutMs)
        ? resolveSafeTimeoutDelayMs(opts.requestTimeoutMs)
        : 30_000;
  }

  start() {
    if (this.closed) {
      return;
    }
    this.clearReconnectTimer();
    this.clearConnectChallengeTimeout();
    this.connectNonce = null;
    this.connectSent = false;
    const url = this.opts.url ?? DEFAULT_GATEWAY_CLIENT_URL;
    if (this.opts.tlsFingerprint && !url.startsWith("wss://")) {
      this.notifyConnectError(new Error("gateway tls fingerprint requires wss:// gateway url"));
      return;
    }

    const allowPrivateWs = process.env.OPENCLAW_ALLOW_INSECURE_PRIVATE_WS === "1";
    // Security check: block ALL plaintext ws:// to non-loopback addresses (CWE-319, CVSS 9.8)
    // This protects both credentials AND chat/conversation data from MITM attacks.
    // Device tokens may be loaded later in sendConnect(), so we block regardless of hasCredentials.
    if (!isSecureWebSocketUrl(url, { allowPrivateWs })) {
      // Safe hostname extraction - avoid throwing on malformed URLs in error path
      let displayHost = url;
      try {
        displayHost = new URL(url).hostname || url;
      } catch {
        // Use raw URL if parsing fails
      }
      const error = new Error(
        `安全错误： 无法明文连接到 "${displayHost}" ws://. ` +
          "凭证和聊天数据都可能被网络拦截。" +
          "使用 wss:// 对于远程 URL。安全默认值：保持 gateway.bind=loopback 并通过 SSH 隧道连接。 " +
          "(ssh -N -L 18789:127.0.0.1:18789 user@gateway-host), 或使用 Tailscale Serve/Funnel. " +
          (allowPrivateWs
            ? ""
            : "紧急呼叫（仅限受信任的专用网络）：设置 OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=1。") +
          "运行 `openclaw doctor --fix` 获取指导。",
      );
      this.notifyConnectError(error);
      return;
    }
    // Allow node screen snapshots and other large responses.
    ensureInheritedManagedProxyRoutingActive();
    const wsOptions: FingerprintCheckingClientOptions = {
      maxPayload: 25 * 1024 * 1024,
    };
    if (url.startsWith("wss://") && this.opts.tlsFingerprint) {
      wsOptions.rejectUnauthorized = false;
      wsOptions.checkServerIdentity = (_hostValue: string, cert: CertMeta) => {
        const fingerprintValue =
          typeof cert === "object" && cert && "fingerprint256" in cert
            ? ((cert as { fingerprint256?: string }).fingerprint256 ?? "")
            : "";
        const fingerprint = normalizeFingerprint(
          typeof fingerprintValue === "string" ? fingerprintValue : "",
        );
        const expected = normalizeFingerprint(this.opts.tlsFingerprint ?? "");
        if (!expected) {
          return undefined;
        }
        if (!fingerprint) {
          return new Error("Missing server TLS fingerprint");
        }
        if (fingerprint !== expected) {
          return new Error("Server TLS fingerprint mismatch");
        }
        return undefined;
      };
    }
    let ws: WebSocket;
    const unregisterGatewayLoopbackBypass = registerManagedProxyGatewayLoopbackBypass(url);
    try {
      ws = new WebSocket(url, wsOptions as ClientOptions);
    } catch (error) {
      this.notifyConnectError(error instanceof Error ? error : new Error(String(error)));
      return;
    } finally {
      unregisterGatewayLoopbackBypass?.();
    }
    this.ws = ws;
    this.socketOpened = false;
    this.connectNonce = null;
    this.connectSent = false;
    this.clearConnectChallengeTimeout();

    ws.on("open", () => {
      this.socketOpened = true;
      if (url.startsWith("wss://") && this.opts.tlsFingerprint) {
        const tlsError = this.validateTlsFingerprint();
        if (tlsError) {
          this.notifyConnectError(tlsError);
          this.ws?.close(1008, tlsError.message);
          return;
        }
      }
      this.beginPreauthHandshake();
    });
    ws.on("message", (data) => this.handleMessage(rawDataToString(data)));
    ws.on("close", (code, reason) => {
      const reasonText = rawDataToString(reason);
      const connectErrorDetailCode = this.pendingConnectErrorDetailCode;
      const connectErrorDetails = this.pendingConnectErrorDetails;
      this.pendingConnectErrorDetailCode = null;
      this.pendingConnectErrorDetails = null;
      if (this.ws === ws) {
        this.ws = null;
      }
      this.socketOpened = false;
      this.resolvePendingStop(ws);
      if (this.pendingStartupReconnectDelayMs !== null) {
        this.scheduleReconnect();
        return;
      }
      // Clear persisted device auth state only when device-token auth was active.
      // Shared token/password failures can return the same close reason but should
      // not erase a valid cached device token.
      if (
        code === 1008 &&
        normalizeLowercaseStringOrEmpty(reasonText).includes("device token mismatch") &&
        !this.opts.token &&
        !this.opts.password &&
        this.opts.deviceIdentity
      ) {
        const deviceId = this.opts.deviceIdentity.deviceId;
        const role = this.opts.role ?? "operator";
        try {
          clearDeviceAuthToken({ deviceId, role, env: this.opts.env });
          logDebug(`cleared stale device-auth token for device ${deviceId}`);
        } catch (err) {
          logDebug(
            `failed clearing stale device-auth token for device ${deviceId}: ${String(err)}`,
          );
        }
      }
      this.flushPendingErrors(new Error(`gateway closed (${code}): ${reasonText}`));
      if (
        this.shouldPauseReconnectAfterAuthFailure({
          detailCode: connectErrorDetailCode,
          details: connectErrorDetails,
        })
      ) {
        this.opts.onReconnectPaused?.({
          code,
          reason: reasonText,
          detailCode: connectErrorDetailCode,
        });
        this.opts.onClose?.(code, reasonText);
        return;
      }
      this.scheduleReconnect();
      this.opts.onClose?.(code, reasonText);
    });
    ws.on("error", (err) => {
      logDebug(`gateway client error: ${formatGatewayClientErrorForLog(err)}`);
      if (!this.connectSent) {
        this.notifyConnectError(err instanceof Error ? err : new Error(String(err)));
      }
=======
      clientVersion: opts.clientVersion ?? VERSION,
      hostDeps: createOpenClawGatewayClientHostDeps(opts.hostDeps),
>>>>>>> fd7e1815006a67575bd749309c1377ff3bff5d15
    });
  }

  start(): void {
    this.#client.start();
  }

  stop(): void {
    this.#client.stop();
  }

  stopAndWait(opts?: { timeoutMs?: number }): Promise<void> {
    return this.#client.stopAndWait(opts);
  }

  request<T = Record<string, unknown>>(
    method: string,
    params?: unknown,
    opts?: GatewayClientRequestOptions,
  ): Promise<T> {
    return this.#client.request<T>(method, params, opts);
  }

  getConnectionMetadata(): GatewayClientConnectionMetadata {
    const opts = (this.#client as unknown as { opts: GatewayClientOptions }).opts;
    return {
      clientName: opts.clientName,
      hasDeviceIdentity: Boolean(opts.deviceIdentity),
      mode: opts.mode,
      preauthHandshakeTimeoutMs: opts.preauthHandshakeTimeoutMs,
    };
  }
}

export type { DeviceIdentity };
