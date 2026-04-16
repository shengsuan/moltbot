import { MEDIA_AUDIO_FIELD_HELP } from "./media-audio-field-metadata.js";
import { describeTalkSilenceTimeoutDefaults } from "./talk-defaults.js";

export const FIELD_HELP: Record<string, string> = {
  meta: "由 OpenClaw 自动维护的元数据字段，用于记录此配置文件的写入/版本历史。保持这些值由系统管理，除非调试迁移历史，否则避免手动编辑。",
  "meta.lastTouchedVersion": "OpenClaw 写入配置时自动设置。",
  "meta.lastTouchedAt": "最后一次配置写入的 ISO 时间戳（自动设置）。",
  env: "环境导入和覆盖设置，用于为网关进程提供运行时变量。使用此部分来控制 shell 环境加载和显式变量注入行为。",
  "env.shellEnv":
    "Shell 环境导入控制，用于在启动时从登录 shell 加载变量。当您依赖于配置文件中定义的密钥或 PATH 自定义时，请保持启用。",
  "env.shellEnv.enabled":
    "启用在启动初始化期间从用户 shell 配置文件加载环境变量。在开发机器上保持启用，或在具有显式环境管理的锁定服务环境中禁用。",
  "env.shellEnv.timeoutMs":
    "在应用回退行为之前，允许 shell 环境解析的最大时间（毫秒）。使用更短的超时以加快启动速度，或在 shell 初始化较重时增加。",
  "env.vars":
    "显式键/值环境变量覆盖，合并到 OpenClaw 的运行时进程环境中。使用此方法进行确定性环境配置，而不是仅依赖 shell 配置文件的副作用。",
  wizard:
    "Setup wizard state tracking fields that record the most recent guided setup run details. Keep these fields for observability and troubleshooting of setup flows across upgrades.",
  "wizard.lastRunAt":
    "ISO timestamp for when the setup wizard most recently completed on this host. Use this to confirm setup recency during support and operational audits.",
  "wizard.lastRunVersion":
    "OpenClaw version recorded at the time of the most recent wizard run on this config. Use this when diagnosing behavior differences across version-to-version setup changes.",
  "wizard.lastRunCommit":
    "Source commit identifier recorded for the last wizard execution in development builds. Use this to correlate setup behavior with exact source state during debugging.",
  "wizard.lastRunCommand":
    "Command invocation recorded for the latest wizard run to preserve execution context. Use this to reproduce setup steps when verifying setup regressions.",
  "wizard.lastRunMode":
    'Wizard execution mode recorded as "local" or "remote" for the most recent setup flow. Use this to understand whether setup targeted direct local runtime or remote gateway topology.',
  diagnostics:
    "诊断控制，用于在调试期间进行有针对性的追踪、遥测导出和缓存检查。生产中保持基线诊断最少，仅在调查问题时启用更深层的信号。",
  "diagnostics.otel":
    "OpenTelemetry 导出设置，用于由网关组件发出的跟踪、指标和日志。在与集中式可观察性后端和分布式追踪管道集成时使用此选项。",
  "diagnostics.cacheTrace":
    "缓存跟踪日志设置，用于观察嵌入式运行中的缓存决策和有效载荷上下文。暂时启用此选项进行调试，然后禁用以减少敏感日志占用。",
  logging:
    "日志行为控制，包括严重级别、输出目的地、格式化和敏感数据删除。保持级别和删除的严格程度足以用于生产，同时保留有用的诊断。",
  "logging.level":
    '运行时记录器输出的主日志级别阈值："silent"、"fatal"、"error"、"warn"、"info"、"debug" 或 "trace"。生产中保持"info"或"warn"，仅在调查期间使用 debug/trace。',
  "logging.file":
    "用于持久化日志输出的可选文件路径，除了或代替控制台日志。使用受管的可写路径，并将保留/轮换与您的运营政策对齐。",
  "logging.consoleLevel":
    '控制台特定的日志阈值："silent"、"fatal"、"error"、"warn"、"info"、"debug" 或 "trace"，用于终端输出控制。使用此项保持本地控制台更安静，同时保持更丰富的文件日志记录（如果需要）。',
  "logging.consoleStyle":
    '控制台输出格式风格："pretty"、"compact" 或 "json"，取决于操作员和摄入需求。为机器解析管道使用 json，为人为优先的终端工作流使用 pretty/compact。',
  "logging.redactSensitive":
    '敏感删除模式："off" 禁用内置遮蔽，而 "tools" 删除敏感工具/配置有效载荷字段。在共享日志中保持 "tools"，除非您有隔离的安全日志接收器。',
  "logging.redactPatterns":
    "在发出/存储之前应用于日志输出的其他自定义删除正则表达式模式。使用此项屏蔽组织特定的令牌和内置删除规则未涵盖的标识符。",
  cli: "CLI 演示控制，用于本地命令输出行为，如横幅和标语风格。使用此部分保持启动输出与操作员偏好一致，而无需更改运行时行为。",
  "cli.banner":
    "CLI 启动横幅控制，包括标题/版本行和标语风格行为。保持横幅启用以进行快速版本/上下文检查，然后将标语模式调整到您的首选噪声级别。",
  "cli.banner.taglineMode":
    'CLI 启动横幅中的标语风格控制："random"（默认）从轮换标语池中选择，"default" 始终显示中立的默认标语，"off" 隐藏标语文本同时保持横幅版本行。',
  update:
    "更新频道和启动检查行为，用于保持 OpenClaw 运行时版本最新。在生产中使用保守频道，仅在受控环境中使用更实验性的频道。",
  "update.channel": '网关安装的更新频道（"stable"、"beta" 或 "dev"）。',
  "update.checkOnStart": "网关启动时检查 npm 更新（默认：true）。",
  "update.auto.enabled": "为包安装启用后台自动更新（默认：false）。",
  "update.auto.stableDelayHours": "稳定频道自动应用开始前的最小延迟（默认：6）。",
  "update.auto.stableJitterHours": "稳定频道推出额外扩展窗口（小时）（默认：12）。",
  "update.auto.betaCheckIntervalHours": "测试版频道检查运行的频率（小时）（默认：1）。",
  gateway:
    "网关运行时接口，用于绑定模式、认证、控制 UI、远程传输和运营安全控制。保持保守的默认设置，除非您打算将网关暴露到受信任的本地接口之外。",
  "gateway.port":
    "网关侦听器用于 API、控制 UI 和通道面向入口路径的 TCP 端口。使用专用端口并避免与反向代理或本地开发者服务冲突。",
  "gateway.mode":
    '网关操作模式："local" 在此主机上运行通道和代理运行时，"remote" 通过远程传输连接。除非您打算运行分离的远程网关拓扑，否则保持 "local"。',
  "gateway.bind":
    '网络绑定配置文件："auto"、"lan"、"loopback"、"custom" 或 "tailnet"，用于控制接口暴露。除非外部客户端必须连接，否则保持 "loopback" 或 "auto" 以实现最安全的本地操作。',
  "gateway.customBindHost":
    "当 gateway.bind 设置为 custom 时用于手动接口目标的显式绑定主机/IP。使用精确地址并避免通配符绑定，除非需要外部暴露。",
  "gateway.controlUi":
    "控制 UI 托管设置，包括启用、路径和浏览器源/认证加固行为。在互联网面向部署之前，保持 UI 暴露最少并配合强认证控制。",
  "gateway.controlUi.enabled":
    "当为 true 时启用从网关 HTTP 进程提供网关控制 UI。保持启用以进行本地管理，当外部控制接口取代它时禁用。",
  "gateway.auth":
    "网关 HTTP/WebSocket 访问的认证策略，包括模式、凭证、受信任代理行为和速率限制。为每个非环回部署保持启用认证。",
  "gateway.auth.mode":
    '网关认证模式："none"、"token"、"password" 或 "trusted-proxy"，取决于您的边界架构。对于直接暴露使用 token/password，对于受信任的身份感知代理后面仅使用 trusted-proxy。',
  "gateway.auth.allowTailscale":
    "当配置时允许受信任的 Tailscale 身份路径满足网关认证检查。仅当您的 tailnet 身份态势强并且操作员工作流依赖时使用。",
  "gateway.auth.rateLimit":
    "登录/认证尝试限流控制，以降低网关边界处的凭证暴力破解风险。在暴露的环境中保持启用并将阈值调整到您的流量基线。",
  "gateway.auth.trustedProxy":
    "受信任代理认证标头映射，用于上游身份提供者注入用户声明。仅在已知代理 CIDR 和严格标头允许列表下使用，以防止虚假身份标头。",
  "gateway.trustedProxies":
    "被允许提供转发客户端身份标头的上游代理的 CIDR/IP 允许列表。保持此列表范围缩小，以便不受信任的跳数无法模拟用户。",
  "gateway.allowRealIpFallback":
    "当在代理场景中缺少 x-forwarded-for 时启用 x-real-ip 回退。除非您的入口堆栈需要此兼容性行为，否则保持禁用。",
  "gateway.tools":
    "网关级别的工具暴露允许/拒绝策略，可独立于代理/工具配置文件限制运行时工具可用性。使用此策略进行粗糙紧急控制和生产加固。",
  "gateway.tools.allow":
    "当您想在运行时提供一小部分工具时的显式网关级别工具允许列表。在锁定环境中使用此项，其中工具范围必须严格控制。",
  "gateway.tools.deny":
    "显式网关级别工具拒绝列表，即使下层政策允许也会阻止风险工具。使用拒绝规则进行紧急响应和纵深防卫加固。",
  "gateway.channelHealthCheckMinutes":
    "Interval in minutes for automatic channel health probing and status updates. Use lower intervals for faster detection, or higher intervals to reduce periodic probe noise.",
  "gateway.channelStaleEventThresholdMinutes":
    "How many minutes a connected channel can go without receiving any event before the health monitor treats it as a stale socket and triggers a restart. Default: 30.",
  "gateway.channelMaxRestartsPerHour":
    "Maximum number of health-monitor-initiated channel restarts allowed within a rolling one-hour window. Once hit, further restarts are skipped until the window expires. Default: 10.",
  "gateway.tailscale":
    "Tailscale 集成设置，用于 Serve/Funnel 暴露和网关启动/退出时的生命周期处理。除非您的部署有意依赖 Tailscale 入口，否则保持关闭。",
  "gateway.tailscale.mode":
    '使用 Tailscale 发布模式："off"、"serve" 或 "funnel" 用于私有或公共暴露路径。对 tailnet 专用访问使用 "serve"，仅在需要公共互联网可达性时使用 "funnel"。',
  "gateway.tailscale.resetOnExit":
    "在网关退出时重置 Tailscale Serve/Funnel 状态，以避免关闭后的陈旧发布路由。除非另一个控制器在网关外管理发布生命周期，否则保持启用。",
  "gateway.remote":
    "远程网关连接设置，用于当此实例代理到另一个运行时主机时的直接或 SSH 传输。仅在有意配置分离主机操作时使用远程模式。",
  "gateway.remote.transport":
    '远程连接传输："direct" 使用配置的 URL 连接，"ssh" 通过 SSH 进行隧道。当您需要加密隧道语义而不暴露远程端口时使用 SSH。',
  "gateway.reload":
    "实时配置重新加载策略，用于编辑的应用方式和何时触发完整重启。保持混合行为以实现最安全的运营更新，除非调试重新加载内部。",
  "gateway.tls":
    "TLS 证书和密钥设置，用于直接在网关进程中终止 HTTPS。在生产中使用显式证书并避免在不受信任的网络上明文暴露。",
  "gateway.tls.enabled":
    "启用网关侦听器处的 TLS 终止，以便客户端直接通过 HTTPS/WSS 连接。对于直接互联网暴露或任何不受信任的网络边界保持启用。",
  "gateway.tls.autoGenerate":
    "当未配置显式文件时自动生成本地 TLS 证书/密钥对。仅用于本地/开发设置，并将其替换为生产流量的真实证书。",
  "gateway.tls.certPath":
    "启用 TLS 时网关使用的 TLS 证书文件的文件系统路径。使用受管的证书路径，并保持续订自动化与此位置对齐。",
  "gateway.tls.keyPath":
    "启用 TLS 时网关使用的 TLS 私钥文件的文件系统路径。保持此密钥文件权限限制并根据您的安全策略轮换。",
  "gateway.tls.caPath":
    "用于客户端验证或网关边界处的自定义信任链要求的可选 CA 包路径。当私有 PKI 或自定义证书链成为部署的一部分时使用此项。",
  "gateway.http":
    "网关 HTTP API 配置分组端点切换和传输面向 API 暴露控制。仅保持必需的端点启用以减少攻击面。",
  "gateway.http.endpoints":
    "网关 API 接口下的 HTTP 端点功能切换，用于兼容性路由和可选集成。有意启用端点并在推出后监控访问模式。",
  "gateway.http.securityHeaders":
    "网关进程本身应用的可选 HTTP 响应安全标头。当 TLS 在反向代理处终止时，倾向于在反向代理处设置这些选项。",
  "gateway.http.securityHeaders.strictTransportSecurity":
    "Strict-Transport-Security 响应标头的值。仅在您完全控制的 HTTPS 源上设置；使用 false 显式禁用。",
  "gateway.remote.url": "远程网关 WebSocket URL（ws:// 或 wss://）。",
  "gateway.remote.token":
    "用于在令牌认证部署中向远程网关认证此客户端的持有者令牌。通过密钥/环境变量替换存储并与远程网关认证更改一起轮换。",
  "gateway.remote.password":
    "启用密码模式时用于远程网关认证的密码凭证。保持此密钥由外部管理并避免在提交的配置中明文值。",
  "gateway.remote.tlsFingerprint": "远程网关的预期 sha256 TLS 指纹（固定以避免中间人攻击）。",
  "gateway.remote.sshTarget":
    "Remote gateway over SSH (tunnels the gateway port to localhost). Format: user@host or user@host:port.",
  "gateway.remote.sshIdentity": "Optional SSH identity file path (passed to ssh -i).",
  "talk.provider": 'Active Talk provider id (for example "acme-speech").',
  "talk.providers":
    "Provider-specific Talk settings keyed by provider id. During migration, prefer this over legacy talk.* keys.",
  "talk.providers.*": "Provider-owned Talk config fields for the matching provider id.",
  "talk.providers.*.apiKey": "Provider API key for Talk mode.", // pragma: allowlist secret
  "talk.interruptOnSpeech":
    "如果为 true（默认），在 Talk 模式下用户开始说话时停止助手语音。保持启用以进行会话轮流。",
  "talk.silenceTimeoutMs": `用户沉默的毫秒数，然后 Talk 模式完成并发送当前转录。保持未设置以保持平台默认暂停窗口（${describeTalkSilenceTimeoutDefaults()}）。`,
  acp: "ACP 运行时控制，用于启用调度、选择后端、限制允许的代理目标和调整流式转轮投影行为。",
  "acp.enabled": "全局 ACP 功能门控。除非配置了 ACP 运行时 + 策略，否则保持禁用。",
  "acp.dispatch.enabled":
    "ACP 会话转的独立调度门（默认：true）。设置为 false 以保持 ACP 命令可用同时阻止 ACP 转执行。",
  "acp.backend": "默认 ACP 运行时后端 id（例如：acpx）。必须与已注册的 ACP 运行时插件后端匹配。",
  "acp.defaultAgent": "当 ACP 生成不指定显式目标时使用的回退 ACP 目标代理 id。",
  "acp.allowedAgents":
    "允许 ACP 运行时会话的 ACP 目标代理 id 允许列表。空值意味着没有额外的允许列表限制。",
  "acp.maxConcurrentSessions": "此网关进程中最大并发活跃 ACP 会话数。",
  "acp.stream": "ACP 流式投影控制，用于块大小、元数据可见性和重复数据删除交付行为。",
  "acp.stream.coalesceIdleMs": "在发出块回复之前，ACP 流式文本的合并器空闲刷新窗口（毫秒）。",
  "acp.stream.maxChunkChars": "ACP 流式块投影的最大块大小，在分割为多个块回复之前。",
  "acp.stream.repeatSuppression":
    "当为 true（默认）时，在转中抑制重复的 ACP 状态/工具投影行，同时保持原始 ACP 事件不变。",
  "acp.stream.deliveryMode":
    "ACP 交付风格：live 逐步流式投影输出，final_only 在终端转事件前缓冲所有投影的 ACP 输出。",
  "acp.stream.hiddenBoundarySeparator":
    "当隐藏的 ACP 工具生命周期事件发生时，在下一个可见助手文本前插入的分隔符（none|space|newline|paragraph）。默认：paragraph。",
  "acp.stream.maxOutputChars": "在发出截断通知之前，每个 ACP 转投影的最大助手输出字符数。",
  "acp.stream.maxSessionUpdateChars": "投影的 ACP 会话/更新行（工具/状态更新）的最大字符数。",
  "acp.stream.tagVisibility":
    "ACP 投影的每个 sessionUpdate 可见性覆盖（例如 usage_update、available_commands_update）。",
  "acp.runtime.ttlMinutes": "ACP 会话工作者的空闲运行时 TTL（分钟），在合格清理前。",
  "acp.runtime.installCommand":
    "Optional operator install/setup command shown by `/acp install` and `/acp doctor` when ACP backend wiring is missing.",
  "agents.list.*.skills":
    "Optional allowlist of skills for this agent. If omitted, the agent inherits agents.defaults.skills when set; otherwise skills stay unrestricted. Set [] for no skills. An explicit list fully replaces inherited defaults instead of merging with them.",
  "agents.list[].skills":
    "Optional allowlist of skills for this agent. If omitted, the agent inherits agents.defaults.skills when set; otherwise skills stay unrestricted. Set [] for no skills. An explicit list fully replaces inherited defaults instead of merging with them.",
  agents:
    "代理运行时配置根，涵盖用于路由和执行上下文的默认值和显式代理条目。保持此部分明确，以便模型/工具行为跨多代理工作流保持可预测。",
  "agents.defaults":
    "Shared default settings inherited by agents unless overridden per entry in agents.list. Use defaults to enforce consistent baseline behavior and reduce duplicated per-agent configuration.",
  "agents.defaults.skills":
    "Optional default skill allowlist inherited by agents that omit agents.list[].skills. Omit for unrestricted skills, set [] to give inheriting agents no skills, and remember explicit agents.list[].skills replaces this default instead of merging with it.",
  "agents.list":
    "Explicit list of configured agents with IDs and optional overrides for model, tools, identity, and workspace. Keep IDs stable over time so bindings, approvals, and session routing remain deterministic.",
  "agents.list[].thinkingDefault":
    "Optional per-agent default thinking level. Overrides agents.defaults.thinkingDefault for this agent when no per-message or session override is set.",
  "agents.list[].reasoningDefault":
    "Optional per-agent default reasoning visibility (on|off|stream). Applies when no per-message or session reasoning override is set.",
  "agents.list[].fastModeDefault":
    "Optional per-agent default for fast mode. Applies when no per-message or session fast-mode override is set.",
  "agents.list[].runtime":
    "此代理的可选运行时描述符。使用嵌入式获得默认 OpenClaw 执行或 acp 获得外部 ACP 工具默认值。",
  "agents.list[].runtime.type":
    '此代理的运行时类型："embedded"（默认 OpenClaw 运行时）或 "acp"（ACP 工具默认值）。',
  "agents.list[].runtime.acp":
    "当 runtime.type=acp 时此代理的 ACP 运行时默认值。绑定级别 ACP 覆盖仍按对话优先。",
  "agents.list[].runtime.acp.agent":
    "Optional ACP harness agent id to use for this OpenClaw agent (for example codex, claude, cursor, gemini, openclaw).",
  "agents.list[].runtime.acp.backend":
    "Optional ACP backend override for this agent's ACP sessions (falls back to global acp.backend).",
  "agents.list[].runtime.acp.mode":
    "Optional ACP session mode default for this agent (persistent or oneshot).",
  "agents.list[].runtime.acp.cwd":
    "Optional default working directory for this agent's ACP sessions.",
  "agents.list[].identity.avatar":
    "Avatar image path (relative to the agent workspace only) or a remote URL/data URL.",
  "agents.defaults.heartbeat.suppressToolErrorWarnings":
    "Suppress tool error warning payloads during heartbeat runs.",
  "agents.list[].heartbeat.suppressToolErrorWarnings":
    "Suppress tool error warning payloads during heartbeat runs.",
  "agents.defaults.heartbeat.timeoutSeconds":
    "Maximum time in seconds allowed for a heartbeat agent turn before it is aborted. Leave unset to use agents.defaults.timeoutSeconds.",
  "agents.list[].heartbeat.timeoutSeconds":
    "Per-agent maximum time in seconds allowed for a heartbeat agent turn before it is aborted. Leave unset to inherit the merged heartbeat/default agent timeout.",
  browser:
    "浏览器运行时控制，用于本地或远程 CDP 附件、配置文件路由和屏幕截图/快照行为。保持默认值，除非您的自动化工作流需要自定义浏览器传输设置。",
  "browser.enabled":
    "在网关中启用浏览器功能接线，以便浏览器工具和 CDP 驱动的工作流可以运行。禁用浏览器自动化不需要时禁用以减少表面积和启动工作。",
  "browser.cdpUrl":
    "用于附加到外部管理的浏览器实例的远程 CDP websocket URL。为集中式浏览器主机使用此项，并保持 URL 访问限制在受信任的网络路径。",
  "browser.color":
    "用于浏览器配置文件/UI 提示的默认重音色，其中显示彩色身份提示。使用一致的颜色帮助操作员快速识别活跃的浏览器配置文件上下文。",
  "browser.executablePath":
    "当自动发现对于您的主机环境不足够时的显式浏览器可执行路径。使用绝对稳定路径，以便启动行为跨重启保持确定性。",
  "browser.headless":
    "当本地启动器启动浏览器实例时强制浏览器以无头模式启动。保持服务器环境中的无头启用，并仅在需要可见 UI 调试时禁用。",
  "browser.noSandbox":
    "禁用 Chromium 沙箱隔离标志以用于在运行时沙箱故障的环境。尽可能保持此关闭，因为进程隔离保护减少了。",
  "browser.attachOnly":
    "将浏览器模式限制为仅附件行为，无需启动本地浏览器进程。当所有浏览器会话由远程 CDP 提供商外部管理时使用。",
  "browser.cdpPortRangeStart":
    "用于自动分配的浏览器配置文件端口的启动本地 CDP 端口。当主机级端口默认值与其他本地服务冲突时增加此项。",
  "browser.defaultProfile":
    "Default browser profile name selected when callers do not explicitly choose a profile. Use a stable low-privilege profile as the default to reduce accidental cross-context state use.",
  "browser.profiles":
    "命名的浏览器配置文件连接映射，用于显式路由到 CDP 端口或 URL，带有可选的元数据。保持配置文件名称一致，并避免重叠的端点定义。",
  "browser.profiles.*.cdpPort":
    "按配置文件连接到浏览器实例时使用的本地 CDP 端口。为每个配置文件使用唯一端口以避免连接冲突。",
  "browser.profiles.*.cdpUrl":
    "Per-profile CDP websocket URL used for explicit remote browser routing by profile name. Use this when profile connections terminate on remote hosts or tunnels.",
  "browser.profiles.*.userDataDir":
    "Per-profile Chromium user data directory for existing-session attachment through Chrome DevTools MCP. Use this for host-local Brave, Edge, Chromium, or non-default Chrome profiles when the built-in auto-connect path would pick the wrong browser data directory.",
  "browser.profiles.*.driver":
    'Per-profile browser driver mode. Use "openclaw" (or legacy "clawd") for CDP-based profiles, or use "existing-session" for host-local Chrome DevTools MCP attachment.',
  "browser.profiles.*.attachOnly":
    "按配置文件仅附件覆盖，跳过本地浏览器启动并仅附加到现有 CDP 端点。当一个配置文件由外部管理但其他配置文件在本地启动时有用。",
  "browser.profiles.*.color":
    "按配置文件重音色用于仪表板和浏览器相关 UI 提示中的视觉区分。为高信号操作员识别活跃配置文件使用不同的颜色。",
  "browser.evaluateEnabled":
    "启用浏览器端评估辅助程序以支持运行时脚本评估功能。禁用浏览器端评估，除非您的工作流需要超出快照/导航的评估语义。",
  "browser.snapshotDefaults":
    "调用者未提供显式快照选项时使用的默认快照捕获配置。为跨通道和自动化路径的一致捕获行为调整此项。",
  "browser.snapshotDefaults.mode":
    "默认快照提取模式控制页面内容如何转换为代理消费。选择在可读性、保真度和令牌占用之间取得平衡的模式。",
  "browser.ssrfPolicy":
    "Server-side request forgery guardrail settings for browser/network fetch paths that could reach internal hosts. Keep restrictive defaults in production and open only explicitly approved targets.",
  "browser.ssrfPolicy.dangerouslyAllowPrivateNetwork":
    "Allows access to private-network address ranges from browser tooling. Default is disabled when unset; enable only for explicitly trusted private-network destinations.",
  "browser.ssrfPolicy.allowedHostnames":
    "浏览器/网络请求上 SSRF 策略检查的显式主机名允许列表异常。保持此列表最少，并定期审查条目以避免陈旧的宽泛访问。",
  "browser.ssrfPolicy.hostnameAllowlist":
    "SSRF 策略消费者使用的遗留/替代主机名允许列表字段，用于显式主机异常。使用稳定的精确主机名并避免通配符样式的宽泛模式。",
  "browser.remoteCdpTimeoutMs":
    "连接到远程 CDP 端点的超时时间（毫秒），然后浏览器附加尝试失败。为高延迟隧道增加此项，或为更快的故障检测降低。",
  "browser.remoteCdpHandshakeTimeoutMs":
    "连接后 CDP 握手就绪检查的超时时间（毫秒），针对远程浏览器目标。为启动缓慢的远程浏览器增加此项，并在自动化循环中快速故障时降低。",
  "discovery.mdns.mode":
    'mDNS 广播模式（"minimal" 默认、"full" 包括 cliPath/sshPort、"off" 禁用 mDNS）。',
  discovery:
    "本地服务发现设置、mDNS 广播和可选的广域存在信号。保持发现范围限于预期网络，以避免泄露服务元数据。",
  "discovery.wideArea":
    "广域发现配置分组，用于在本地链接范围之外暴露发现信号。仅在部署有意需要跨站点网关存在聚合时启用。",
  "discovery.wideArea.enabled":
    "Enables wide-area discovery signaling when your environment needs non-local gateway discovery. Keep disabled unless cross-network discovery is operationally required.",
  "discovery.wideArea.domain":
    "Optional unicast DNS-SD domain for wide-area discovery, such as openclaw.internal. Use this when you intentionally publish gateway discovery beyond local mDNS scopes.",
  "discovery.mdns":
    "mDNS 发现配置分组，用于本地网络广告和发现行为调整。在常规 LAN 发现中保持最小模式，除非需要额外元数据。",
  tools:
    "全局工具访问策略和跨 web、exec、media、消息传递和提升表面的功能配置。使用此部分在广泛推出前限制风险功能。",
  "tools.allow":
    "绝对工具允许列表，为严格环境替换基于配置文件的默认值。仅在您有意运行精心选择的工具功能子集时使用。",
  "tools.deny":
    "全局工具拒绝列表，即使配置文件或提供商规则允许也会阻止列出的工具。使用拒绝规则进行紧急锁定和长期纵深防卫。",
  "tools.web":
    "网络工具策略分组，用于搜索/获取提供商、限制和回退行为调整。保持启用的设置与 API 密钥可用性和出站网络策略对齐。",
  "tools.exec":
    "Exec 工具策略分组，用于 shell 执行主机、安全模式、批准行为和运行时绑定。在生产中保持保守的默认设置，并加强提升执行路径。",
  "tools.exec.host":
    'Selects execution target strategy for shell commands. Use "auto" for runtime-aware behavior (sandbox when available, otherwise gateway), or pin sandbox/gateway/node explicitly when you need a fixed surface.',
  "tools.exec.security":
    "执行安全态势选择器控制命令执行的沙箱/批准期望。对于不受信任的提示保持严格安全模式，仅对受信任的操作员工作流放宽。",
  "tools.exec.ask":
    "当 exec 命令需要人类确认才能运行时的批准策略。在共享通道中使用更严格的 ask 行为，在私人操作员上下文中使用低摩擦设置。",
  "tools.exec.node":
    "当命令执行通过连接的节点委托时，exec 工具的节点绑定配置。仅在需要多节点路由时使用显式节点绑定。",
  "tools.agentToAgent":
    "允许代理对代理工具调用的策略，并限制哪些目标代理可以到达。保持禁用或严格范围，除非有意启用跨代理编排。",
  "tools.agentToAgent.enabled":
    "启用 agent_to_agent 工具表面，以便一个代理可以在运行时调用另一个代理。在简单部署中保持关闭，仅在编排价值超过复杂性时启用。",
  "tools.agentToAgent.allow":
    "Allowlist of target agent IDs permitted for agent_to_agent calls when orchestration is enabled. Use explicit allowlists to avoid uncontrolled cross-agent call graphs.",
  "tools.experimental":
    "Experimental built-in tool flags. Keep these off by default and enable only when you are intentionally testing a preview surface.",
  "tools.experimental.planTool":
    "Enable the experimental structured `update_plan` tool for non-trivial multi-step work tracking. Leave this off unless you explicitly want the tool outside strict-agentic embedded Pi runs.",
  "tools.elevated":
    "提升工具访问控制，用于只应从受信任发送者到达的特权命令表面。除非操作员工作流明确需要提升的操作，否则保持禁用。",
  "tools.elevated.enabled":
    "当发送方和策略检查通过时启用提升工具执行路径。在公共/共享通道中保持禁用，仅对受信任的所有者运营上下文启用。",
  "tools.elevated.allowFrom":
    "提升工具的发送方允许规则，通常由通道/提供商身份格式键控。使用狭隘的显式身份，以便提升命令不能由无意的用户触发。",
  "tools.subagents":
    "生成的子代理的工具策略包装，限制或展开与父默认值相比的工具可用性。使用此项保持委派的代理功能范围限于任务意图。",
  "tools.subagents.tools":
    "应用于生成子代理运行时的允许/拒绝工具策略，用于各子代理加固。当子代理运行半自主工作流时保持范围比父范围更小。",
  "tools.sandbox":
    "沙箱代理执行的工具策略包装，以便沙箱运行可以有不同的功能边界。使用此项在沙箱上下文中强制实施更强的安全性。",
  "tools.sandbox.tools":
    "当代理在沙箱执行环境中运行时应用的允许/拒绝工具策略。保持策略最少，以便沙箱任务无法升级为不必要的外部操作。",
  web: "Web 通道运行时设置，用于在操作基于 web 的聊天表面时的心跳和重新连接行为。使用调整到您的网络可靠性配置文件和预期正常运行时间需求的重新连接值。",
  "web.enabled":
    "启用 Web 通道运行时和相关 websocket 生命周期行为。当 Web 聊天未使用时保持禁用以减少活跃的连接管理开销。",
  "web.heartbeatSeconds":
    "用于 Web 通道连接和活跃性维护的心跳间隔（秒）。使用较短的间隔以进行更快的检测，或使用较长的间隔以减少保活聊天。",
  "web.reconnect":
    "Web 通道在传输故障后重新连接尝试的重新连接回退策略。保持有界重试和抖动调整以避免雷鸣羊群重新连接行为。",
  "web.reconnect.initialMs":
    "断开连接后第一次重试前的初始重新连接延迟（毫秒）。使用适度的延迟以快速恢复，而不会立即重试风暴。",
  "web.reconnect.maxMs":
    "最大重新连接回退上限（毫秒），以在重复失败时约束重试延迟增长。使用合理的上限，以便在长期中断后恢复保持及时。",
  "web.reconnect.factor":
    "Web 通道重试循环中重新连接尝试之间使用的指数回退乘数。保持因子大于 1 并使用抖动调整以实现稳定的大队重新连接行为。",
  "web.reconnect.jitter":
    "应用于重新连接延迟的随机化因子（0-1），以在中断事件后反同步客户端。在多客户端部署中保持非零抖动以减少同步峰值。",
  "web.reconnect.maxAttempts":
    "在放弃当前故障序列之前的最大重新连接尝试次数（0 表示无重试）。为自动化敏感环境中的受控故障处理使用有限的上限。",
  canvasHost:
    "Canvas 主机设置，用于提供 canvas 资产和 canvas 启用工作流使用的本地实时重新加载行为。除非 canvas 托管资产被主动使用，否则保持禁用。",
  "canvasHost.enabled":
    "启用 canvas 主机服务器进程和用于提供 canvas 文件的路由。当 canvas 工作流处于非活跃状态时保持禁用以减少暴露的本地服务。",
  "canvasHost.root":
    "由 canvas 主机为 canvas 内容和静态资产提供的文件系统根目录。使用专用目录，避免宽泛的回购根目录以实现最小特权文件暴露。",
  "canvasHost.port":
    "启用 canvas 托管时 canvas 主机 HTTP 服务器使用的 TCP 端口。选择无冲突的端口并根据防火墙/代理策略对齐。",
  "canvasHost.liveReload":
    "启用开发工作流期间 canvas 资产的自动实时重新加载行为。在生产类环境中保持禁用，其中偏好确定性输出。",
  talk: "Talk 模式语音合成设置，用于语音身份、模型选择、输出格式和中断行为。使用此部分优化人为面向的语音用户体验同时控制延迟和成本。",
  "gateway.auth.token": "默认网关访问所需（除非使用 Tailscale Serve 身份）；非环回绑定所需。",
  "gateway.auth.password": "Tailscale 漏斗所需。",
  "agents.defaults.sandbox.browser.network":
    "沙箱浏览器容器的 Docker 网络（默认：openclaw-sandbox-browser）。如果需要更严格的隔离，避免桥接。",
  "agents.list[].sandbox.browser.network": "沙箱浏览器 Docker 网络的各代理覆盖。",
  "agents.defaults.sandbox.docker.dangerouslyAllowContainerNamespaceJoin":
    "危险的破玻法覆盖，允许沙箱 Docker 网络模式容器:<id>。这加入另一个容器命名空间并削弱沙箱隔离。",
  "agents.list[].sandbox.docker.dangerouslyAllowContainerNamespaceJoin":
    "沙箱 Docker 网络模式中的容器命名空间联接的各代理危险覆盖。",
  "agents.defaults.sandbox.browser.cdpSourceRange":
    "Optional CIDR allowlist for container-edge CDP ingress (for example 172.21.0.1/32).",
  "agents.list[].sandbox.browser.cdpSourceRange":
    "Per-agent override for CDP source CIDR allowlist.",
  "gateway.controlUi.basePath":
    "Optional URL prefix where the Control UI is served (e.g. /openclaw).",
  "gateway.controlUi.root":
    "Optional filesystem root for Control UI assets (defaults to dist/control-ui).",
  "gateway.controlUi.embedSandbox":
    'Iframe sandbox policy for hosted Control UI embeds. "strict" disables scripts, "scripts" allows interactive embeds while keeping origin isolation (default), and "trusted" adds `allow-same-origin` for same-site documents that intentionally need stronger privileges.',
  "gateway.controlUi.allowExternalEmbedUrls":
    "DANGEROUS toggle that allows hosted embeds to load absolute external http(s) URLs. Keep this off unless your Control UI intentionally embeds trusted third-party pages; hosted /__openclaw__/canvas and /__openclaw__/a2ui documents do not need it.",
  "gateway.controlUi.allowedOrigins":
    'Allowed browser origins for Control UI/WebChat websocket connections (full origins only, e.g. https://control.example.com). Required for non-loopback Control UI deployments unless dangerous Host-header fallback is explicitly enabled. Setting ["*"] means allow any browser origin and should be avoided outside tightly controlled local testing.',
  "gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback":
    "危险切换，为控制 UI/WebChat websocket 检查启用基于 Host 标头的源回退。当您的部署有意依赖 Host 标头源政策时支持此模式；显式 gateway.controlUi.allowedOrigins 仍是推荐的加固默认值。",
  "gateway.controlUi.allowInsecureAuth":
    "当您必须运行非标准设置时，松散对控制 UI 的严格浏览器认证检查。除非您信任您的网络和代理路径，否则保持此关闭，因为模拟风险更高。",
  "gateway.controlUi.dangerouslyDisableDeviceAuth":
    "Disables Control UI device identity checks and relies on token/password only. Use only for short-lived debugging on trusted networks, then turn it off immediately.",
  "gateway.push":
    "Push-delivery settings used by the gateway when it needs to wake or notify paired devices. Configure relay-backed APNs here for official iOS builds; direct APNs auth remains env-based for local/manual builds.",
  "gateway.push.apns":
    "APNs delivery settings for iOS devices paired to this gateway. Use relay settings for official/TestFlight builds that register through the external push relay.",
  "gateway.push.apns.relay":
    "External relay settings for relay-backed APNs sends. The gateway uses this relay for push.test, wake nudges, and reconnect wakes after a paired official iOS build publishes a relay-backed registration.",
  "gateway.push.apns.relay.baseUrl":
    "Base HTTPS URL for the external APNs relay service used by official/TestFlight iOS builds. Keep this aligned with the relay URL baked into the iOS build so registration and send traffic hit the same deployment.",
  "gateway.push.apns.relay.timeoutMs":
    "Timeout in milliseconds for relay send requests from the gateway to the APNs relay (default: 10000). Increase for slower relays or networks, or lower to fail wake attempts faster.",
  "gateway.http.endpoints.chatCompletions.enabled":
    "启用 OpenAI 兼容的 `POST /v1/chat/completions` 端点（默认：false）。",
  "gateway.http.endpoints.chatCompletions.maxBodyBytes":
    "`/v1/chat/completions` 的最大请求体大小（字节）（默认：20MB）。",
  "gateway.http.endpoints.chatCompletions.maxImageParts":
    "从最新用户消息接受的 `image_url` 部分的最大数量（默认：8）。",
  "gateway.http.endpoints.chatCompletions.maxTotalImageBytes":
    "一个请求中所有 `image_url` 部分的最大累积解码字节数（默认：20MB）。",
  "gateway.http.endpoints.chatCompletions.images":
    "OpenAI 兼容 `image_url` 部分的图像获取/验证控制。",
  "gateway.http.endpoints.chatCompletions.images.allowUrl":
    "Allow server-side URL fetches for `image_url` parts (default: false; data URIs remain supported). Set this to `false` to disable URL fetching entirely.",
  "gateway.http.endpoints.chatCompletions.images.urlAllowlist":
    "Optional hostname allowlist for `image_url` URL fetches; supports exact hosts and `*.example.com` wildcards. Empty or omitted lists mean no hostname allowlist restriction.",
  "gateway.http.endpoints.chatCompletions.images.allowedMimes":
    "`image_url` 部分允许的 MIME 类型（不区分大小写的列表）。",
  "gateway.http.endpoints.chatCompletions.images.maxBytes":
    "每个获取/解码的 `image_url` 图像最大字节数（默认：10MB）。",
  "gateway.http.endpoints.chatCompletions.images.maxRedirects":
    "获取 `image_url` URL 时允许的最大 HTTP 重定向数（默认：3）。",
  "gateway.http.endpoints.chatCompletions.images.timeoutMs":
    "`image_url` URL 获取的超时（毫秒）（默认：10000）。",
  "gateway.reload.mode":
    'Controls how config edits are applied: "off" ignores live edits, "restart" always restarts, "hot" applies in-process, and "hybrid" tries hot then restarts if required. Keep "hybrid" for safest routine updates.',
  "gateway.reload.debounceMs": "Debounce window (ms) before applying config changes.",
  "gateway.reload.deferralTimeoutMs":
    "Maximum time (ms) to wait for in-flight operations to complete before forcing a SIGUSR1 restart. Default: 300000 (5 minutes). Lower values risk aborting active subagent LLM calls.",
  "gateway.nodes.browser.mode":
    '节点浏览器路由（"auto" = 选择单个连接的浏览器节点、"manual" = 需要节点参数、"off" = 禁用）。',
  "gateway.nodes.browser.node": "将浏览器路由固定到特定节点 id 或名称（可选）。",
  "gateway.nodes.allowCommands":
    "超出网关默认值的额外 node.invoke 命令允许（命令字符串数组）。在此启用危险命令是对安全敏感的覆盖，由 `openclaw security audit` 标记。",
  "gateway.nodes.denyCommands":
    "Node command names to block even if present in node claims or default allowlist (exact command-name matching only, e.g. `system.run`; does not inspect shell text inside that command).",
  "gateway.webchat.chatHistoryMaxChars":
    "Max characters per text field in chat.history responses before truncation (default: 12000).",
  nodeHost:
    "节点主机控制，用于从此网关节点向其他节点或客户端暴露的功能。保持默认值，除非您有意在节点网络中代理本地功能。",
  "nodeHost.browserProxy":
    "网络代理设置分组，用于通过节点路由暴露本地浏览器控制。仅当远程节点工作流需要您的本地浏览器配置文件时启用。",
  "nodeHost.browserProxy.enabled":
    "通过节点代理路由暴露本地浏览器控制服务器，以便远程客户端可以使用此主机的浏览器功能。除非远程自动化明确依赖，否则保持禁用。",
  "nodeHost.browserProxy.allowProfiles":
    "Optional allowlist of browser profile names exposed through node proxy routing. Leave empty to preserve the default full profile surface, including profile create/delete routes. When set, OpenClaw enforces least-privilege profile access and blocks persistent profile create/delete through the proxy.",
  media:
    "顶级媒体行为是所有处理入站文件的提供商和工具共享的。除非您需要为外部处理管道使用稳定的文件名或需要更长时间保留入站媒体文件，否则请保留默认设置。",
  "media.preserveFilenames":
    "启用此功能后，上传的媒体文件将保留其原始文件名，而不是生成的临时安全名称。如果下游自动化流程依赖于稳定的文件名，请启用此功能；如果要减少意外泄露文件名的情况，请禁用此功能。",
  "media.ttlHours":
    "可选择设置持久化入站媒体清理的保留时间窗口（以小时为单位），该窗口适用于整个媒体树。留空可保留原有行为，如需自动清理，可设置 24（1 天）或 168（7 天）等值。",
  audio:
    "全局音频采集设置，用于在更高级别的工具处理语音或媒体内容之前进行设置。当您需要对语音笔记和片段进行确定性的转录时，请配置此设置。",
  "audio.transcription":
    "用于在代理处理之前将音频文件转换为文本的基于命令的转录设置。请保持命令路径简单且确定性，以便于在日志中诊断故障。",
  "audio.transcription.command":
    '用于转录音频的可执行文件 + 参数（第一个标记必须是安全的二进制文件/路径），例如 `["whisper-cli", "--model", "small", "{input}"]`。建议使用固定命令，以确保运行时环境行为一致。',
  "audio.transcription.timeoutSeconds":
    "转录命令完成的最长时间限制。对于较长的录音，请增加此值；对于对延迟要求较高的部署环境，请保持此值较低。",
  bindings:
    "用于路由和持久 ACP 会话所有权的顶级绑定规则。使用 type=route 进行普通路由绑定，使用 type=acp 进行持久 ACP 会话绑定。",
  "bindings[].type":
    "绑定类型。对于普通路由，请使用“route”（或省略以用于旧版路由条目）；对于持久性 ACP 会话绑定，请使用“acp”。",
  "bindings[].agentId":
    "当满足相应的绑定匹配规则时，目标代理 ID 将接收流量。仅使用已配置的有效代理 ID，以避免运行时路由失败。",
  "bindings[].match":
    "绑定规则对象，用于决定绑定何时生效，包括频道和可选的账户/对等方约束。保持规则范围狭窄以避免意外的跨上下文代理接管。",
  "bindings[].match.channel":
    "此绑定适用的频道/提供商标识符，如 `telegram`、`discord` 或插件频道 ID。精确使用配置的频道密钥以确保绑定评估可靠。",
  "bindings[].match.accountId":
    "可选的账户选择器，用于多账户频道设置，使绑定仅适用于一个身份。当需要对路由进行账户范围控制时使用此选项，否则保持未设置。",
  "bindings[].match.peer":
    "可选的对等方匹配器，用于特定对话，包括对等方类型和对等方 ID。当仅一个直接/群组/频道目标应固定到代理时使用此选项。",
  "bindings[].match.peer.kind":
    '对等方对话类型："direct"（直接）、"group"（群组）、"channel"（频道）或旧版 "dm"（已弃用的直接别名）。新配置优先使用 "direct"，保持类型与频道语义对齐。',
  "bindings[].match.peer.id":
    "与对等方匹配一起使用的对话标识符，如聊天 ID、频道 ID 或来自提供商的群组 ID。保持精确以避免静默不匹配。",
  "bindings[].match.guildId":
    "可选的 Discord 风格公会/服务器 ID 约束，用于多服务器部署中的绑定评估。当相同的对等方标识符可能出现在不同公会中时使用此选项。",
  "bindings[].match.teamId":
    "可选的团队/工作区 ID 约束，由在团队下进行聊天范围的提供商使用。当需要将绑定隔离到一个工作区上下文时添加此选项。",
  "bindings[].match.roles":
    "可选的基于角色的过滤列表，由向聊天上下文附加角色的提供商使用。使用此选项将特权或运营角色流量路由到专门的代理。",
  "bindings[].acp":
    "绑定类型为 acp 时的可选每绑定 ACP 覆盖。此层覆盖匹配的对话的 agents.list[].runtime.acp 默认值。",
  "bindings[].acp.mode": "此绑定的 ACP 会话模式覆盖（persistent 或 oneshot）。",
  "bindings[].acp.label": "用于此绑定对话中 ACP 状态/诊断的人类友好标签。",
  "bindings[].acp.cwd": "从此绑定创建的 ACP 会话的工作目录覆盖。",
  "bindings[].acp.backend":
    "此绑定的 ACP 后端覆盖（回退到代理运行时 ACP 后端，然后是全局 acp.backend）。",
  broadcast:
    "广播路由映射，用于向每个源对话的多个对等方 ID 发送相同的出站消息。保持此功能最少且已审计，因为一个源可以扇出到许多目标。",
  "broadcast.strategy":
    '广播扇出的传递顺序："parallel"（并行）同时发送到所有目标，"sequential"（顺序）一次发送一个。为了速度使用 "parallel"，为了更严格的顺序/背压控制使用 "sequential"。',
  "broadcast.*":
    "每源广播目标列表，其中每个密钥是源对等方 ID，值是目标对等方 ID 数组。保持列表意图明确以避免意外的消息放大。",
  "diagnostics.flags":
    '按标志启用有针对性的诊断日志（例如 ["telegram.http"]）。支持通配符如 "telegram.*" 或 "*"。',
  "diagnostics.enabled":
    "诊断仪表输出的主切换，用于日志和遥测布线路径。为了正常的可观察性保持启用，仅在非常受限的环境中禁用。",
  "diagnostics.stuckSessionWarnMs":
    "毫秒级年龄阈值，用于在会话保持处理状态时发出卡住会话警告。对于长多工具轮次增加此值以减少误报；减少此值以获得更快的挂起检测。",
  "diagnostics.otel.enabled":
    "启用 OpenTelemetry 导出管道，用于基于配置的端点/协议设置的迹线、指标和日志。除非您的收集器端点和身份验证已完全配置，否则保持禁用。",
  "diagnostics.otel.endpoint":
    "OpenTelemetry 导出传输使用的收集器端点 URL，包括方案和端口。使用可达且受信任的收集器端点，并在推出后监控摄取错误。",
  "diagnostics.otel.protocol":
    '用于遥测导出的 OTel 传输协议："http/protobuf" 或 "grpc"，取决于收集器支持。使用您的可观察性后端期望的协议以避免遥测负载丢失。',
  "diagnostics.otel.headers":
    "随 OpenTelemetry 导出请求发送的附加 HTTP/gRPC 元数据标头，通常用于租户身份验证或路由。将秘密保存在环境支持的值中，避免不必要的标头扩展。",
  "diagnostics.otel.serviceName":
    "在遥测资源属性中报告的服务名称，用于在可观察性后端中标识此网关实例。使用稳定的名称，以便仪表板和警报在部署间保持一致。",
  "diagnostics.otel.traces":
    "启用到配置的 OpenTelemetry 收集器端点的迹线信号导出。当需要延迟/调试跟踪时保持启用，如果仅需要指标/日志则禁用。",
  "diagnostics.otel.metrics":
    "启用到配置的 OpenTelemetry 收集器端点的指标信号导出。为运行时健康仪表板保持启用，仅在指标数量必须最小化时禁用。",
  "diagnostics.otel.logs":
    "启用通过 OpenTelemetry 的日志信号导出，除了本地日志接收器。当需要跨服务和代理的集中式日志关联时使用此选项。",
  "diagnostics.otel.sampleRate":
    "迹线采样率（0-1），控制多少迹线流量被导出到可观察性后端。较低的速率降低开销/成本，较高的速率提高调试保真度。",
  "diagnostics.otel.flushIntervalMs":
    "以毫秒为单位的间隔，用于从缓冲区定期刷新遥测到收集器。增加以减少导出聊天，或降低以在活跃事件响应期间获得更快的可见性。",
  "diagnostics.cacheTrace.enabled": "记录嵌入式代理运行的缓存迹线快照（默认值：false）。",
  "diagnostics.cacheTrace.filePath":
    "JSONL output path for cache trace logs (default: $OPENCLAW_STATE_DIR/logs/cache-trace.jsonl).",
  "diagnostics.cacheTrace.includeMessages":
    "Include full message payloads in trace output (default: true).",
  "diagnostics.cacheTrace.includePrompt": "Include prompt text in trace output (default: true).",
  "diagnostics.cacheTrace.includeSystem": "Include system prompt in trace output (default: true).",
  "tools.exec.applyPatch.enabled":
    "Enable or disable apply_patch for OpenAI and OpenAI Codex models when allowed by tool policy (default: true).",
  "tools.exec.applyPatch.workspaceOnly":
    "将 apply_patch 路径限制在工作区目录中（默认值：true）。设置为 false 允许在工作区外写入（危险）。",
  "tools.exec.applyPatch.allowModels":
    'Optional allowlist of model ids (e.g. "gpt-5.4" or "openai/gpt-5.4").',
  "tools.loopDetection.enabled":
    "Enable repetitive tool-call loop detection and backoff safety checks (default: false).",
  "tools.loopDetection.historySize": "Tool history window size for loop detection (default: 30).",
  "tools.loopDetection.warningThreshold":
    "Warning threshold for repetitive patterns when detector is enabled (default: 10).",
  "tools.loopDetection.unknownToolThreshold":
    "Block repeated calls to the same unavailable tool after this many misses (default: 10).",
  "tools.loopDetection.criticalThreshold":
    "Critical threshold for repetitive patterns when detector is enabled (default: 20).",
  "tools.loopDetection.globalCircuitBreakerThreshold":
    "Global no-progress breaker threshold (default: 30).",
  "tools.loopDetection.detectors.genericRepeat":
    "启用通用重复相同工具/相同参数循环检测（默认值：true）。",
  "tools.loopDetection.detectors.knownPollNoProgress":
    "启用已知轮询工具无进度循环检测（默认值：true）。",
  "tools.loopDetection.detectors.pingPong": "启用 ping-pong 循环检测（默认值：true）。",
  "tools.exec.notifyOnExit":
    "当为真（默认）时，后台 exec 会话退出和节点 exec 生命周期事件在退出时会排队系统事件并请求心跳。",
  "tools.exec.notifyOnExitEmptySuccess":
    "When true, successful backgrounded exec exits with empty output still enqueue a completion system event (default: false).",
  "tools.exec.pathPrepend": "Directories to prepend to PATH for exec runs (gateway/sandbox).",
  "tools.exec.safeBins":
    "Allow stdin-only safe binaries to run without explicit allowlist entries.",
  "tools.exec.strictInlineEval":
    "Require explicit approval for interpreter inline-eval forms such as `python -c`, `node -e`, `ruby -e`, or `osascript -e`. Prevents silent allowlist reuse and downgrades allow-always to ask-each-time for those forms.",
  "tools.exec.safeBinTrustedDirs":
    "为安全二进制文件路径检查信任的其他显式目录（PATH 条目从不自动信任）。",
  "tools.exec.safeBinProfiles":
    "可选的每二进制文件安全二进制文件配置文件（位置限制 + 允许/拒绝标志）。",
  "tools.profile":
    "全局工具配置文件名称，用于在应用允许/拒绝覆盖前选择预定义的工具策略基线。将其用于跨代理的一致环境态势，并保持配置文件名称稳定。",
  "tools.alsoAllow":
    "额外的工具白名单条目，合并到所选工具配置文件和默认策略之上。保持此列表小且明确，以便审计可以快速识别意图的策略异常。",
  "tools.byProvider":
    "按频道/提供商 ID 键控的每提供商工具允许/拒绝覆盖，用于按表面定制功能。当一个提供商需要比全局工具策略更严格的控制时使用此选项。",
  "agents.list[].tools.profile":
    "当一个代理需要不同的功能基线时，用于工具配置文件选择的每代理覆盖。谨慎使用此选项，以便代理间的策略差异保持意图且可审查。",
  "agents.list[].tools.alsoAllow":
    "在全局和配置文件策略之上的每代理添加工具白名单。保持范围狭窄以避免专专代理上的意外权限扩展。",
  "agents.list[].tools.byProvider":
    "用于频道范围功能控制的每代理提供商特定工具策略覆盖。当单个代理需要对一个提供商的限制比对其他提供商更紧密时使用此选项。",
  "tools.exec.approvalRunningNoticeMs":
    "在 exec 批准被授予后显示进行中通知前的延迟（毫秒）。增加以减少快速命令的闪烁，或降低以加快操作员反馈。",
  "tools.links.enabled":
    "启用自动链接理解预处理，以便 URL 可在代理推理前被总结。为了更丰富的上下文保持启用，当需要严格的最少处理时禁用。",
  "tools.links.maxLinks":
    "在链接理解期间每轮扩展的最大链接数。使用较低的值来控制聊天线程中的延迟/成本，当多链接上下文至关重要时使用较高的值。",
  "tools.links.timeoutSeconds":
    "每链接理解超时预算（秒），然后跳过未解决的链接。保持此界限有限以避免在外部站点缓慢或无法到达时出现长停顿。",
  "tools.links.models":
    "用于链接理解任务的首选模型列表，在支持时按顺序评估为回退。首先使用轻量级模型进行常规总结，仅在需要时使用较重的模型。",
  "tools.links.scope":
    "控制相对于对话上下文和消息类型何时运行链接理解。保持范围保守以避免在不可操作的链接的消息上不必要的获取。",
  "tools.media.models":
    "当未设置模态特定模型列表时，媒体理解工具使用的共享回退模型列表。保持与可用多模态提供商对齐以避免运行时回退混乱。",
  "tools.media.concurrency":
    "Maximum number of concurrent media understanding operations per turn across image, audio, and video tasks. Lower this in resource-constrained deployments to prevent CPU/network saturation.",
  "tools.media.asyncCompletion.directSend":
    "Enable direct channel sends for completed async music/video generation tasks instead of relying on the requester session wake path. Default off so detached media completion keeps the legacy model-delivery flow unless you opt in.",
  "tools.media.image.enabled":
    "启用图像理解，以便附加或引用的图像可被解释为文本上下文。如果需要仅文本操作或想避免图像处理成本，则禁用。",
  "tools.media.image.maxBytes":
    "在项目被策略跳过或截断之前接受的最大图像负载大小（字节）。保持限制对您的提供商上限和基础设施带宽现实。",
  "tools.media.image.maxChars":
    "模型响应规范化后从图像理解输出返回的最大字符数。使用较紧的限制以减少提示膨胀，较大的限制用于详细密集型 OCR 任务。",
  "tools.media.image.prompt":
    "用于图像理解请求的指令模板，用于塑造提取风格和详细程度。保持提示确定性，以便输出在轮次和频道间保持一致。",
  "tools.media.image.timeoutSeconds":
    "每个图像理解请求的超时时间（秒），然后中止。为高分辨率分析增加，为延迟敏感的操作员工作流降低。",
  "tools.media.image.attachments":
    "图像输入的附件处理策略，包括哪些消息附件符合图像分析条件。在不受信任的频道中使用限制性设置以减少意外处理。",
  "tools.media.image.models":
    "特别用于图像理解的有序模型偏好，当您想覆盖共享媒体模型时。将最可靠的多模态模型放在首位以减少回退尝试。",
  "tools.media.image.scope":
    "何时尝试图像理解的范围选择器（例如仅显式请求与更广泛的自动检测）。在繁忙的频道中保持狭窄范围以控制令牌和 API 花费。",
  ...MEDIA_AUDIO_FIELD_HELP,
  "tools.media.video.enabled":
    "启用视频理解，以便片段可被总结为文本用于下游推理和响应。当视频处理超出策略或对您的部署来说太昂贵时禁用。",
  "tools.media.video.maxBytes":
    "在策略拒绝或修剪发生前接受的最大视频负载大小（字节）。调整到提供商和基础设施限制以避免重复的超时/故障循环。",
  "tools.media.video.maxChars":
    "从视频理解输出中保留的最大字符数以控制提示增长。为密集场景描述提高，当首选简洁总结时降低。",
  "tools.media.video.prompt":
    "视频理解的指令模板，描述所需摘要粒度和焦点区域。保持此稳定，以便输出质量在模型/提供商回退间保持可预测。",
  "tools.media.video.timeoutSeconds":
    "每个视频理解请求的超时时间（秒），然后取消。在交互式频道中使用保守值，为离线或批量处理使用较长值。",
  "tools.media.video.attachments":
    "视频分析的附件资格政策，定义哪些消息文件可触发视频处理。在共享频道中保持明确以防止意外的大型媒体工作负载。",
  "tools.media.video.models":
    "特别用于视频理解的有序模型偏好，然后应用共享媒体回退。优先使用对强多模态视频支持的模型以最小化降级摘要。",
  "tools.media.video.scope":
    "范围选择器，控制在传入事件间何时尝试视频理解。在嘈杂频道中保持狭窄范围，仅在视频解释是工作流核心时扩展。",
  "skills.load.watch":
    "启用技能定义变更的文件系统监视，以便可在不完全进程重启的情况下应用更新。在开发工作流中保持启用，在不可变生产映像中禁用。",
  "skills.load.watchDebounceMs":
    "防抖窗口（毫秒），用于在重新加载逻辑运行前合并快速技能文件变更。增加以减少频繁写入上的重新加载混乱，或降低以获得更快的编辑反馈。",
  approvals:
    "Approval routing controls for forwarding exec and plugin approval requests to chat destinations outside the originating session. Keep these disabled unless operators need explicit out-of-band approval visibility.",
  "approvals.exec":
    "组 exec 批准转发行为，包括启用、路由模式、过滤器和显式目标。当批准提示必须到达运营频道而不仅是源线程时在此配置。",
  "approvals.exec.enabled":
    "启用 exec 批准请求转发到配置的传递目标（默认值：false）。在低风险设置中保持禁用，仅当人工批准响应者需要频道可见提示时启用。",
  "approvals.exec.mode":
    '控制批准提示的发送位置："session"（会话）使用源聊天，"targets"（目标）使用配置的目标，"both"（两者）发送到两个路径。使用 "session" 作为基线，仅当运营工作流需要冗余时扩展。',
  "approvals.exec.agentFilter":
    '可选的符合转发批准条件的代理 ID 白名单，例如 `["primary", "ops-agent"]`。使用此限制转发爆炸半径并避免通知无关代理的频道。',
  "approvals.exec.sessionFilter":
    '可选的会话密钥过滤器，匹配为子字符串或正则表达式风格模式，例如 `["discord:", "^agent:ops:"]`。使用狭窄模式以便仅将预期的批准上下文转发到共享目标。',
  "approvals.exec.targets":
    "当转发模式包含目标时使用的显式传递目标，各带有频道和目标详情。保持目标列表最小权限并在启用广泛转发前验证每个目标。",
  "approvals.exec.targets[].channel":
    "用于转发批准传递的频道/提供商 ID，如 discord、slack 或插件频道 ID。仅使用有效的频道 ID 以便批准不会因未知路由而静默失败。",
  "approvals.exec.targets[].to":
    "目标频道内的目标标识符（频道 ID、用户 ID 或线程根，取决于提供商）。验证每个提供商的语义，因为目标格式在频道集成中不同。",
  "approvals.exec.targets[].accountId":
    "可选的账户选择器，用于多账户频道设置，当批准必须通过特定账户上下文路由时。仅当目标频道有多个配置身份时使用此选项。",
  "approvals.exec.targets[].threadId":
    "Optional thread/topic target for channels that support threaded delivery of forwarded approvals. Use this to keep approval traffic contained in operational threads instead of main channels.",
  "approvals.plugin":
    "Groups plugin-approval forwarding behavior including enablement, routing mode, filters, and explicit targets. Independent of exec approval forwarding. Configure here when plugin approval prompts must reach operational channels.",
  "approvals.plugin.enabled":
    "Enables forwarding of plugin approval requests to configured delivery destinations (default: false). Independent of approvals.exec.enabled.",
  "approvals.plugin.mode":
    'Controls where plugin approval prompts are sent: "session" uses origin chat, "targets" uses configured targets, and "both" sends to both paths.',
  "approvals.plugin.agentFilter":
    'Optional allowlist of agent IDs eligible for forwarded plugin approvals, for example `["primary", "ops-agent"]`. Use this to limit forwarding blast radius.',
  "approvals.plugin.sessionFilter":
    'Optional session-key filters matched as substring or regex-style patterns, for example `["discord:", "^agent:ops:"]`. Use narrow patterns so only intended approval contexts are forwarded.',
  "approvals.plugin.targets":
    "Explicit delivery targets used when plugin approval forwarding mode includes targets, each with channel and destination details.",
  "approvals.plugin.targets[].channel":
    "Channel/provider ID used for forwarded plugin approval delivery, such as discord, slack, or a plugin channel id.",
  "approvals.plugin.targets[].to":
    "Destination identifier inside the target channel (channel ID, user ID, or thread root depending on provider).",
  "approvals.plugin.targets[].accountId":
    "Optional account selector for multi-account channel setups when plugin approvals must route through a specific account context.",
  "approvals.plugin.targets[].threadId":
    "Optional thread/topic target for channels that support threaded delivery of forwarded plugin approvals.",
  "tools.fs.workspaceOnly":
    "将文件系统工具（读/写/编辑/apply_patch）限制在工作区目录中（默认值：false）。",
  "tools.sessions.visibility":
    '控制哪些会话可由 sessions_list/sessions_history/sessions_send 目标。（"tree" 默认 = 当前会话 + 衍生子代理会话；"self" = 仅当前；"agent" = 当前代理 ID 中的任何会话；"all" = 任何会话；跨代理仍需要 tools.agentToAgent）。',
  "tools.message.allowCrossContextSend": "旧版覆盖：允许跨所有提供商的跨上下文发送。",
  "tools.message.crossContext.allowWithinProvider":
    "Allow sends to other channels within the same provider (default: true).",
  "tools.message.crossContext.allowAcrossProviders":
    "Allow sends across different providers (default: false).",
  "tools.message.crossContext.marker.enabled":
    "Add a visible origin marker when sending cross-context (default: true).",
  "tools.message.crossContext.marker.prefix":
    'Text prefix for cross-context markers (supports "{channel}").',
  "tools.message.crossContext.marker.suffix":
    'Text suffix for cross-context markers (supports "{channel}").',
  "tools.message.broadcast.enabled": "Enable broadcast action (default: true).",
  "tools.web.search.enabled":
    "Enable managed web_search and optional Codex-native search for eligible models.",
  "tools.web.search.provider":
    "Search provider id. Auto-detected from available API keys if omitted.",
  "tools.web.search.maxResults": "Number of results to return (1-10).",
  "tools.web.search.timeoutSeconds": "Timeout in seconds for web_search requests.",
  "tools.web.search.cacheTtlMinutes": "Cache TTL in minutes for web_search results.",
  "tools.web.search.openaiCodex.enabled":
    "Enable native Codex web search for Codex-capable models.",
  "tools.web.search.openaiCodex.mode":
    'Native Codex web search mode: "cached" (default) or "live".',
  "tools.web.search.openaiCodex.allowedDomains":
    "Optional domain allowlist passed to the native Codex web_search tool.",
  "tools.web.search.openaiCodex.contextSize":
    'Native Codex search context size hint: "low", "medium", or "high".',
  "tools.web.search.openaiCodex.userLocation.country":
    "Approximate country sent to native Codex web search.",
  "tools.web.search.openaiCodex.userLocation.region":
    "Approximate region/state sent to native Codex web search.",
  "tools.web.search.openaiCodex.userLocation.city":
    "Approximate city sent to native Codex web search.",
  "tools.web.search.openaiCodex.userLocation.timezone":
    "Approximate timezone sent to native Codex web search.",
  "tools.web.search.brave.mode":
    'Brave Search mode: "web" (URL results) or "llm-context" (pre-extracted page content for LLM grounding).',
  "tools.web.fetch.enabled": "Enable the web_fetch tool (lightweight HTTP fetch).",
  "tools.web.fetch.maxChars": "Max characters returned by web_fetch (truncated).",
  "tools.web.fetch.maxCharsCap":
    "Hard cap for web_fetch maxChars (applies to config and tool calls).",
  "tools.web.fetch.maxResponseBytes": "Max download size before truncation.",
  "tools.web.fetch.provider": "Web fetch fallback provider id.",
  "tools.web.fetch.timeoutSeconds": "Timeout in seconds for web_fetch requests.",
  "tools.web.fetch.cacheTtlMinutes": "Cache TTL in minutes for web_fetch results.",
  "tools.web.fetch.maxRedirects": "Maximum redirects allowed for web_fetch (default: 3).",
  "tools.web.fetch.userAgent": "Override User-Agent header for web_fetch requests.",
  "tools.web.fetch.readability":
    "Use Readability to extract main content from HTML (fallbacks to basic HTML cleanup).",
  "tools.web.fetch.ssrfPolicy":
    "Scoped SSRF policy overrides for web_fetch. Keep this narrow and opt in only for known local-network proxy environments.",
  "tools.web.fetch.ssrfPolicy.allowRfc2544BenchmarkRange":
    "Allow RFC 2544 benchmark-range IPs (198.18.0.0/15) for fake-IP proxy compatibility such as Clash or Surge.",
  models:
    "模型目录根用于提供商定义、合并/替换行为和可选的 Bedrock 发现集成。在依赖生产故障转移路径之前保持提供商定义明确和经过验证。",
  "models.mode":
    '控制提供商目录行为："merge"（合并）保留内置提供商并覆盖您的自定义提供商，"replace"（替换）仅使用您配置的提供商。在 "merge" 中，匹配的提供商 ID 保留非空的 agent models.json baseUrl 值，而 apiKey 值仅在当前 config/auth-profile 上下文中提供商未被 SecretRef 管理时保留；SecretRef 管理的提供商从当前源标记刷新 apiKey，匹配的模型 contextWindow/maxTokens 使用明确和隐含条目之间的较高值。',
  "models.providers":
    "由提供商 ID 键控的提供商映射，包含连接/身份验证设置和具体模型定义。使用稳定的提供商密钥以便来自代理和工具的引用在环境间保持可移植。",
  "models.providers.*.baseUrl":
    "提供商端点的基本 URL，用于为该提供商条目提供模型请求。使用 HTTPS 端点并在需要时通过配置模板保持 URL 特定于环境。",
  "models.providers.*.apiKey":
    "当提供商需要直接密钥身份验证时用于基于 API 密钥的身份验证的提供商凭证。使用秘密/环境替换并避免在提交的配置文件中存储真实密钥。",
  "models.providers.*.auth":
    '选择提供商身份验证风格："api-key"（API 密钥）用于 API 密钥身份验证，"token"（令牌）用于持有者令牌身份验证，"oauth"（OAuth）用于 OAuth 凭证，"aws-sdk"（AWS SDK）用于 AWS 凭证解析。将其与您的提供商要求匹配。',
  "models.providers.*.api":
    "提供商 API 适配器选择，控制模型调用的请求/响应兼容性处理。使用与您的上游提供商协议匹配的适配器以避免功能不匹配。",
  "models.providers.*.injectNumCtxForOpenAICompat":
    "控制 OpenClaw 是否为配置了 OpenAI 兼容适配器（`openai-completions`）的 Ollama 提供商注入 `options.num_ctx`。默认为 true。仅当您的代理/上游拒绝未知的 `options` 负载字段时设置为 false。",
  "models.providers.*.headers":
    "合并到提供商请求中的静态 HTTP 标头，用于租户路由、代理身份验证或自定义网关要求。谨慎使用此选项并将敏感标头值保存在秘密中。",
  "models.providers.*.authHeader":
    "When true, credentials are sent via the HTTP Authorization header even if alternate auth is possible. Use this only when your provider or proxy explicitly requires Authorization forwarding.",
  "models.providers.*.request":
    "Optional request overrides for model-provider requests, including extra headers, auth overrides, proxy routing, TLS client settings, and optional allowPrivateNetwork for trusted self-hosted endpoints. Use these only when your upstream or enterprise network path requires transport customization.",
  "models.providers.*.request.headers":
    "Extra headers merged into provider requests after default attribution and auth resolution.",
  "models.providers.*.request.auth":
    "Override provider request authentication behavior for this provider.",
  "models.providers.*.request.auth.mode":
    'Auth override mode: "provider-default", "authorization-bearer", or "header".',
  "models.providers.*.request.auth.token":
    "Bearer token used when auth mode is authorization-bearer.",
  "models.providers.*.request.auth.headerName":
    "Custom auth header name used when auth mode is header.",
  "models.providers.*.request.auth.value":
    "Custom auth header value used when auth mode is header.",
  "models.providers.*.request.auth.prefix":
    "Optional prefix prepended to request.auth.value when auth mode is header.",
  "models.providers.*.request.proxy":
    'Optional proxy override for model-provider requests. Use "env-proxy" to honor environment proxy settings or "explicit-proxy" to route through a specific proxy URL.',
  "models.providers.*.request.proxy.mode":
    'Proxy override mode for model-provider requests: "env-proxy" or "explicit-proxy".',
  "models.providers.*.request.proxy.url":
    "Explicit proxy URL used when request.proxy.mode is explicit-proxy. Credentials embedded in the URL are treated as sensitive and redacted from snapshots.",
  "models.providers.*.request.proxy.tls":
    "Optional TLS settings used when connecting to the configured proxy.",
  "models.providers.*.request.proxy.tls.ca":
    "Custom CA bundle used to verify the proxy TLS certificate chain.",
  "models.providers.*.request.proxy.tls.cert":
    "Client TLS certificate presented to the proxy when mutual TLS is required.",
  "models.providers.*.request.proxy.tls.key":
    "Private key paired with request.proxy.tls.cert for proxy mutual TLS.",
  "models.providers.*.request.proxy.tls.passphrase":
    "Optional passphrase used to decrypt request.proxy.tls.key.",
  "models.providers.*.request.proxy.tls.serverName":
    "Optional SNI/server-name override used when establishing TLS to the proxy.",
  "models.providers.*.request.proxy.tls.insecureSkipVerify":
    "Skips proxy TLS certificate verification. Use only for controlled development environments.",
  "models.providers.*.request.tls":
    "Optional TLS settings used when connecting directly to the upstream model endpoint.",
  "models.providers.*.request.tls.ca":
    "Custom CA bundle used to verify the upstream TLS certificate chain.",
  "models.providers.*.request.tls.cert":
    "Client TLS certificate presented to the upstream endpoint when mutual TLS is required.",
  "models.providers.*.request.tls.key":
    "Private key paired with request.tls.cert for upstream mutual TLS.",
  "models.providers.*.request.tls.passphrase":
    "Optional passphrase used to decrypt request.tls.key.",
  "models.providers.*.request.tls.serverName":
    "Optional SNI/server-name override used when establishing upstream TLS.",
  "models.providers.*.request.tls.insecureSkipVerify":
    "Skips upstream TLS certificate verification. Use only for controlled development environments.",
  "models.providers.*.request.allowPrivateNetwork":
    "When true, allow HTTPS to the model base URL when DNS resolves to private, CGNAT, or similar ranges, via the provider HTTP fetch guard (fetchWithSsrFGuard). OpenAI Responses WebSocket reuses request for headers/TLS but does not use that fetch SSRF path. Use only for operator-controlled self-hosted OpenAI-compatible endpoints (LAN, overlay, split DNS). Default is false.",
  "models.providers.*.models":
    "Declared model list for a provider including identifiers, metadata, and optional compatibility/cost hints. Keep IDs exact to provider catalog values so selection and fallback resolve correctly.",
  auth: "Authentication profile root used for multi-profile provider credentials and cooldown-based failover ordering. Keep profiles minimal and explicit so automatic failover behavior stays auditable.",
  "channels.matrix.allowBots":
    'Allow messages from other configured Matrix bot accounts to trigger replies (default: false). Set "mentions" to only accept bot messages that visibly mention this bot.',
  "channels.mattermost.botToken":
    "Bot token from Mattermost System Console -> Integrations -> Bot Accounts.",
  "channels.mattermost.baseUrl":
    "Base URL for your Mattermost server (e.g., https://chat.example.com).",
  "channels.mattermost.chatmode":
    '对通道消息上提及("oncall")、触发字符(">""!")("onchar")或每条消息("onmessage")时进行回复。',
  "channels.mattermost.oncharPrefixes": '触发 onchar 模式的前缀（默认：[">", "!"]）。',
  "channels.mattermost.requireMention": "在通道中响应前需要 @mention（默认：true）。",
  "auth.profiles": "命名认证配置文件（提供商 + 模式 + 可选电子邮件）。",
  "auth.order": "按提供商的有序认证配置文件 ID（用于自动故障转移）。",
  "auth.cooldowns":
    "冷却/回退控制，用于在与计费相关的故障和重试窗口后临时配置文件抑制。使用这些防止快速重新选择仍被阻止的配置文件。",
  "auth.cooldowns.billingBackoffHours":
    "Base backoff (hours) when a profile fails due to billing/insufficient credits (default: 5).",
  "auth.cooldowns.billingBackoffHoursByProvider":
    "Optional per-provider overrides for billing backoff (hours).",
  "auth.cooldowns.billingMaxHours": "Cap (hours) for billing backoff (default: 24).",
  "auth.cooldowns.authPermanentBackoffMinutes":
    "Base backoff (minutes) for high-confidence auth_permanent failures (default: 10). Keep this shorter than billing so providers recover automatically after transient upstream auth incidents.",
  "auth.cooldowns.authPermanentMaxMinutes":
    "Cap (minutes) for auth_permanent backoff (default: 60).",
  "auth.cooldowns.failureWindowHours": "Failure window (hours) for backoff counters (default: 24).",
  "auth.cooldowns.overloadedProfileRotations":
    "Maximum same-provider auth-profile rotations allowed for overloaded errors before switching to model fallback (default: 1).",
  "auth.cooldowns.overloadedBackoffMs":
    "Fixed delay in milliseconds before retrying an overloaded provider/profile rotation (default: 0).",
  "auth.cooldowns.rateLimitedProfileRotations":
    "Maximum same-provider auth-profile rotations allowed for rate-limit errors before switching to model fallback (default: 1).",
  "agents.defaults.workspace":
    "Default workspace path exposed to agent runtime tools for filesystem context and repo-aware behavior. Set this explicitly when running from wrappers so path resolution stays deterministic.",
  "agents.defaults.contextInjection":
    'Controls when workspace bootstrap files are injected into the system prompt: "always" (default) or "continuation-skip" for safe continuation turns after a completed assistant response.',
  "agents.defaults.bootstrapMaxChars":
    "在截断前注入系统提示的每个工作区引导文件的最大字符数（默认：20000）。",
  "agents.defaults.bootstrapTotalMaxChars":
    "Max total characters across all injected workspace bootstrap files (default: 150000).",
  "agents.defaults.localModelMode":
    'Local-model prompt profile: "default" keeps the standard tool surface, while "lean" drops heavyweight non-essential tools for smaller or weaker models.',
  "agents.defaults.bootstrapPromptTruncationWarning":
    'Inject agent-visible warning text when bootstrap files are truncated: "off", "once" (default), or "always".',
  "agents.defaults.startupContext":
    'Runtime-owned first-turn prelude for bare "/new" and "/reset". Use this to control whether recent daily memory files are preloaded into the first prompt instead of asking the model to decide what to read.',
  "agents.defaults.startupContext.enabled":
    "Enable the startup-context prelude for bare session resets (default: true). Disable this to fall back to prompt-only behavior with no runtime-loaded daily memory.",
  "agents.defaults.startupContext.applyOn":
    'Chooses which bare reset commands get startup context: include "new", "reset", or both (default: ["new","reset"]).',
  "agents.defaults.startupContext.dailyMemoryDays":
    "Number of dated memory files to load counting backward from today in the configured user timezone (default: 2 for today + yesterday).",
  "agents.defaults.startupContext.maxFileBytes":
    "Maximum bytes allowed per daily memory file when building startup context (default: 16384). Files over this boundary-safe read limit are skipped.",
  "agents.defaults.startupContext.maxFileChars":
    "Maximum characters retained from each loaded daily memory file in the startup prelude (default: 2000).",
  "agents.defaults.startupContext.maxTotalChars":
    "Maximum total characters retained across all loaded daily memory files in the startup prelude (default: 4500). Additional files are truncated from the prelude once this cap is reached.",
  "agents.defaults.repoRoot":
    "Optional repository root shown in the system prompt runtime line (overrides auto-detect).",
  "agents.defaults.envelopeTimezone":
    '消息信封的时区（"utc"、"local"、"user" 或 IANA 时区字符串）。',
  "agents.defaults.envelopeTimestamp": '在消息信封中包括绝对时间戳（"on" 或 "off"）。',
  "agents.defaults.envelopeElapsed": '在消息信封中包括已用时间（"on" 或 "off"）。',
  "agents.defaults.models": "已配置的模型目录（键是完整的提供商/模型 ID）。",
  "agents.defaults.memorySearch": "在 MEMORY.md 和 memory/*.md 上的向量搜索（支持各代理覆盖）。",
  "agents.defaults.memorySearch.enabled":
    "此代理配置文件上内存搜索索引和检索行为的主切换。保持启用以进行语义召回，当您想要完全无状态响应时禁用。",
  "agents.defaults.memorySearch.sources":
    '选择哪些源被索引："memory" 读取 MEMORY.md + 内存文件，"sessions" 包括转录历史。除非您需要来自先前聊天转录的召回，否则保持 ["memory"]。',
  "agents.defaults.memorySearch.extraPaths":
    "Adds extra directories or .md files to the memory index beyond default memory files. Use this when key reference docs live elsewhere in your repo; when multimodal memory is enabled, matching image/audio files under these paths are also eligible for indexing.",
  "agents.defaults.memorySearch.qmd":
    "Use this when one agent should query another agent's transcript collections; QMD-specific extra collections let you opt into cross-agent memory search without flattening everything into one shared namespace.",
  "agents.defaults.memorySearch.qmd.extraCollections":
    "Use this when you need directional transcript search across agents; add collections here to scope QMD recalls without creating a shared global transcript namespace.",
  "agents.defaults.memorySearch.qmd.extraCollections.path":
    "Use an absolute or workspace-relative filesystem path for the extra QMD collection; keep it pointed at the transcript directory or note folder you actually want this agent to search.",
  "agents.defaults.memorySearch.qmd.extraCollections.name":
    "Preserves the configured collection label only when the path points outside the agent workspace; paths inside the workspace stay agent-scoped even if a name is provided. Use this for shared cross-agent transcript roots that live outside the workspace.",
  "agents.defaults.memorySearch.qmd.extraCollections.pattern":
    "Use a glob pattern to restrict which files inside the collection are indexed; keep the default `**/*.md` unless you need a narrower subset.",
  "agents.defaults.memorySearch.multimodal":
    'Optional multimodal memory settings for indexing image and audio files from configured extra paths. Keep this off unless your embedding model explicitly supports cross-modal embeddings, and set `memorySearch.fallback` to "none" while it is enabled. Matching files are uploaded to the configured remote embedding provider during indexing.',
  "agents.defaults.memorySearch.multimodal.enabled":
    "Enables image/audio memory indexing from extraPaths. This currently requires Gemini embedding-2, keeps the default memory roots Markdown-only, disables memory-search fallback providers, and uploads matching binary content to the configured remote embedding provider.",
  "agents.defaults.memorySearch.multimodal.modalities":
    'Selects which multimodal file types are indexed from extraPaths: "image", "audio", or "all". Keep this narrow to avoid indexing large binary corpora unintentionally.',
  "agents.defaults.memorySearch.multimodal.maxFileBytes":
    "Sets the maximum bytes allowed per multimodal file before it is skipped during memory indexing. Use this to cap upload cost and indexing latency, or raise it for short high-quality audio clips.",
  "agents.defaults.memorySearch.experimental.sessionMemory":
    "将会话转录索引到内存搜索中，以便响应可以参考先前的聊天转轮。除非需要转录召回并且您接受更大的索引变化，否则将此保持关闭。",
  "agents.defaults.memorySearch.provider":
    'Selects the embedding backend used to build/query memory vectors: "openai", "gemini", "voyage", "mistral", "bedrock", "lmstudio", "ollama", or "local". Keep your most reliable provider here and configure fallback for resilience.',
  "agents.defaults.memorySearch.model":
    "Embedding model override used by the selected memory provider when a non-default model is required. Set this only when you need explicit recall quality/cost tuning beyond provider defaults.",
  "agents.defaults.memorySearch.outputDimensionality":
    "Provider-specific output vector size override for memory embeddings. Gemini embedding-2 supports 768, 1536, or 3072; Bedrock families such as Titan V2, Cohere V4, and Nova expose their own allowed sizes. Expect a full reindex when you change it because stored vector dimensions must stay consistent.",
  "agents.defaults.memorySearch.remote.baseUrl":
    "覆盖嵌入 API 端点，如 OpenAI 兼容代理或自定义 Gemini 基本 URL。仅在通过您自己的网关或供应商端点进行路由时使用此项；否则保持提供商默认值。",
  "agents.defaults.memorySearch.remote.apiKey":
    "为内存索引和查询时嵌入使用的远程嵌入调用提供专用 API 密钥。当内存嵌入应使用不同于全局默认值或环境变量的凭证时使用此项。",
  "agents.defaults.memorySearch.remote.headers":
    "添加到远程嵌入请求的自定义 HTTP 标头，与提供商默认值合并。对代理认证和租户路由标头使用此项，并保持值最少以避免泄露敏感元数据。",
  "agents.defaults.memorySearch.remote.batch.enabled":
    "支持时启用提供商批处理 API 以进行嵌入作业（OpenAI/Gemini），改进较大索引运行的吞吐量。除非调试提供商批处理故障或运行非常小的工作负载，否则保持此启用。",
  "agents.defaults.memorySearch.remote.batch.wait":
    "在索引操作完成之前等待批处理嵌入作业完全完成。为确定性索引状态保持此启用；仅在您接受延迟一致性时禁用。",
  "agents.defaults.memorySearch.remote.batch.concurrency":
    "限制在索引期间同时运行多少嵌入批处理作业（默认：2）。小心地增加以加快批量索引，但要注意提供商速率限制和队列错误。",
  "agents.defaults.memorySearch.remote.batch.pollIntervalMs":
    "系统轮询提供商 API 以获取批处理作业状态的频率（毫秒）（默认：2000）。使用更长的间隔以减少 API 聊天，或使用更短的间隔以加快完成检测。",
  "agents.defaults.memorySearch.remote.batch.timeoutMinutes":
    "设置完整嵌入批处理操作的最大等待时间（分钟）（默认：60）。为非常大的语料库或较慢的提供商增加，并在自动化繁重的流程中快速故障时降低。",
  "agents.defaults.memorySearch.local.modelPath":
    "为本地内存搜索指定本地嵌入模型源，如 GGUF 文件路径或 `hf:` URI。仅在提供商为 `local` 时使用此项，并在大型索引重建前验证模型兼容性。",
  "agents.defaults.memorySearch.fallback":
    'Backup provider used when primary embeddings fail: "openai", "gemini", "voyage", "mistral", "bedrock", "lmstudio", "ollama", "local", or "none". Set a real fallback for production reliability; use "none" only if you prefer explicit failures.',
  "agents.defaults.memorySearch.store.path":
    "设置针对每个代理在磁盘上存储 SQLite 内存索引的位置。保持默认 `~/.openclaw/memory/{agentId}.sqlite`，除非您需要自定义存储放置或备份策略对齐。",
  "agents.defaults.memorySearch.store.vector.enabled":
    "启用内存搜索中使用的 sqlite-vec 扩展，用于向量相似性查询（默认：true）。为正常语义召回保持此启用；仅为调试或仅回退操作禁用。",
  "agents.defaults.memorySearch.store.vector.extensionPath":
    "覆盖自动发现的 sqlite-vec 扩展库路径（`.dylib`、`.so` 或 `.dll`）。当您的运行时无法自动找到 sqlite-vec 或您锁定已知良好的构建时使用此项。",
  "agents.defaults.memorySearch.chunking.tokens":
    "在嵌入/索引前分割内存源时使用的块大小（令牌）。增加以获得每个块更广泛的上下文，或降低以改进精确查找上的精度。",
  "agents.defaults.memorySearch.chunking.overlap":
    "相邻内存块之间的令牌重叠，以在分割边界附近保持上下文连续性。使用适度的重叠以减少边界遗漏，而不会过度积极地扩大索引大小。",
  "agents.defaults.memorySearch.query.maxResults":
    "在下游重新排名和提示注入前从搜索返回的最大内存命中数。提高以进行更广泛的召回，或降低以获得更紧凑的提示和更快的响应。",
  "agents.defaults.memorySearch.query.minScore":
    "在最终召回输出中包括内存结果的最小相关性分数阈值。增加以减少弱/嘈杂匹配，或在需要更多容许检索时降低。",
  "agents.defaults.memorySearch.query.hybrid.enabled":
    "将 BM25 关键字匹配与向量相似性相结合，以在混合精确 + 语义查询上获得更好的召回。除非您隔离排名行为以进行故障排除，否则保持启用。",
  "agents.defaults.memorySearch.query.hybrid.vectorWeight":
    "控制语义相似性如何强烈影响混合排名（0-1）。当释义匹配比精确术语更重要时增加；为更严格的关键字强调降低。",
  "agents.defaults.memorySearch.query.hybrid.textWeight":
    "控制 BM25 关键字相关性如何强烈影响混合排名（0-1）。为精确术语匹配增加；当语义匹配应排名更高时降低。",
  "agents.defaults.memorySearch.query.hybrid.candidateMultiplier":
    "在重新排名前扩展候选池（默认：4）。为有噪声语料库上的更好召回提高此项，但期望更多计算和稍微较慢的搜索。",
  "agents.defaults.memorySearch.query.hybrid.mmr.enabled":
    "添加 MMR 重新排名以多样化结果并减少单个答案窗口中的近重复代码段。当召回看起来重复时启用；为严格的分数排序保持关闭。",
  "agents.defaults.memorySearch.query.hybrid.mmr.lambda":
    "设置 MMR 相关性与多样性平衡（0 = 最多样、1 = 最相关、默认：0.7）。较低的值减少重复；较高的值保持紧凑相关但可能重复。",
  "agents.defaults.memorySearch.query.hybrid.temporalDecay.enabled":
    "应用新近衰减，以便较新的内存在分数接近时超过较旧的内存。当及时性很重要时启用；为无时间参考知识保持关闭。",
  "agents.defaults.memorySearch.query.hybrid.temporalDecay.halfLifeDays":
    "控制启用时间衰减时较旧内存失去排名的速度（半衰期（天），默认：30）。较低值更积极地优先考虑最近的上下文。",
  "agents.defaults.memorySearch.cache.enabled":
    "在 SQLite 中缓存计算的块嵌入，以便重新索引和增量更新运行得更快（默认：true）。除非调查缓存正确性或最小化磁盘使用，否则保持此启用。",
  memory: "内存后端配置（全局）。",
  "memory.backend":
    '选择全局内存引擎："builtin" 使用 OpenClaw 内存内部，"qmd" 使用 QMD 边车管道。除非有意操作 QMD，否则保持 "builtin"。',
  "memory.citations":
    '在回复中控制引用可见性："auto" 在有用时显示引用、"on" 始终显示、"off" 隐藏。为平衡的信噪比默认保持 "auto"。',
  "memory.qmd.command":
    "设置 QMD 后端使用的 `qmd` 二进制可执行路径（默认：从 PATH 解析）。当存在多个 qmd 安装或 PATH 在环境中不同时使用绝对路径。",
  "memory.qmd.mcporter":
    "通过 mcporter（MCP 运行时）路由 QMD 工作，而不是为每个调用生成 `qmd`。在大模型上冷启动很昂贵时使用此项；为更简单的本地设置保持直接进程模式。",
  "memory.qmd.mcporter.enabled":
    "通过 mcporter 守护进程路由 QMD，而不是按请求生成 qmd，减少较大模型的冷启动开销。除非 mcporter 已安装和配置，否则保持禁用。",
  "memory.qmd.mcporter.serverName":
    "用于 QMD 调用的 mcporter 服务器目标（默认：qmd）。仅在您的 mcporter 设置为 qmd mcp 保活使用自定义服务器名称时更改。",
  "memory.qmd.mcporter.startDaemon":
    "启用 mcporter 支持的 QMD 模式时自动启动 mcporter 守护进程（默认：true）。除非进程生命周期由您的服务监督员外部管理，否则保持启用。",
  "memory.qmd.searchMode":
    'Selects the QMD retrieval path: "query" uses standard query flow, "search" uses search-oriented retrieval, and "vsearch" emphasizes vector retrieval. Keep default unless tuning relevance quality.',
  "memory.qmd.searchTool":
    "Overrides the exact mcporter tool name used for QMD searches while preserving `searchMode` as the semantic retrieval mode. Use this only when your QMD MCP server exposes a custom tool such as `hybrid_search` and keep it unset for the normal built-in tool mapping.",
  "memory.qmd.includeDefaultMemory":
    "自动将默认内存文件（MEMORY.md 和 memory/**/*.md）索引到 QMD 集合中。除非您只想通过显式自定义路径控制索引，否则保持启用。",
  "memory.qmd.paths":
    "添加要包括在 QMD 索引中的自定义目录或文件，每个都带有可选名称和 glob 模式。为超出默认内存路径的项目特定知识位置使用此项。",
  "memory.qmd.paths.path":
    "定义 QMD 应扫描的根位置，使用绝对路径或 `~` 相对路径。使用稳定目录，以便集合身份不会在环境中漂移。",
  "memory.qmd.paths.pattern":
    "使用 glob 模式筛选每个索引根下的文件，默认为 `**/*.md`。使用较窄的模式以减少噪音和索引成本，当目录包含混合文件类型时。",
  "memory.qmd.paths.name":
    "为索引的路径设置稳定的集合名称，而不是从文件系统位置推导。当路径在计算机间变化但您想要一致的集合身份时使用。",
  "memory.qmd.sessions.enabled":
    "将会话转录索引到 QMD，以便召回可以包括先前的对话内容（实验性，默认：false）。仅在需要转录内存并且您接受较大的索引变侵时启用。",
  "memory.qmd.sessions.exportDir":
    "在 QMD 索引前覆盖关联会话导出的写入位置。当默认状态存储受限或导出必须落在受管卷上时使用此项。",
  "memory.qmd.sessions.retentionDays":
    "定义导出的会话文件在自动修剪前保留多长时间（天）（默认：无限）。为存储卫生或合规保留政策设置有限值。",
  "memory.qmd.update.interval":
    "设置 QMD 从源内容刷新索引的频率（持续时间字符串，默认：5m）。较短的间隔改进新鲜度，但增加后台 CPU 和 I/O。",
  "memory.qmd.update.debounceMs":
    "在重新索引运行前连续 QMD 刷新尝试之间的最小延迟（毫秒）（默认：15000）。如果频繁文件更改导致更新鞭打或不必要的后台负载，增加此项。",
  "memory.qmd.update.onBoot":
    "在网关启动期间一次运行初始 QMD 更新（默认：true）。保持启用以便召回从新鲜基线开始；仅在启动速度比立即新鲜更重要时禁用。",
  "memory.qmd.update.waitForBootSync":
    "阻止启动完成，直到初始启动时 QMD 同步完成（默认：false）。当您需要在提供流量前完全最新的召回时启用，启用时对更快启动保持关闭。",
  "memory.qmd.update.embedInterval":
    "设置 QMD 重新计算嵌入的频率（持续时间字符串，默认：60m；设置 0 以禁用定期嵌入）。较低的间隔改进新鲜度，但增加嵌入工作负载和成本。",
  "memory.qmd.update.commandTimeoutMs":
    "为 QMD 维护命令（如集合列表/添加）设置超时（毫秒）（默认：30000）。在较慢的磁盘或远程文件系统上运行时增加。",
  "memory.qmd.update.updateTimeoutMs":
    "为每个 `qmd update` 循环设置最大运行时间（毫秒）（默认：120000）。为较大的集合提高此项；当您想要自动化中的快速故障检测时降低。",
  "memory.qmd.update.embedTimeoutMs":
    "为每个 `qmd embed` 循环设置最大运行时间（毫秒）（默认：120000）。为较重的嵌入工作负载或较慢的硬件增加，并在紧的 SLA 下快速故障时降低。",
  "memory.qmd.limits.maxResults":
    "限制为每个召回请求返回到代理循环的 QMD 命中数量（默认：6）。为更广泛的召回上下文提高，或降低以保持提示更紧凑和更快。",
  "memory.qmd.limits.maxSnippetChars":
    "为从 QMD 命中提取的每结果代码段长度（字符）设置上限（默认：700）。当提示快速浮起时降低此项，仅当答案持续错过关键细节时提高。",
  "memory.qmd.limits.maxInjectedChars":
    "限制多少 QMD 文本可以注入一个转中。使用较低值控制提示浮起和延迟；仅在上下文持续被截断时提高。",
  "memory.qmd.limits.timeoutMs":
    "为每个查询 QMD 搜索超时设置超时（毫秒）（默认：4000）。为较大的索引或较慢的环境增加，并降低以保持请求延迟约束。",
  "memory.qmd.scope":
    "定义哪些会话/通道有资格进行 QMD 召回，使用 session.sendPolicy 样式规则。保持默认的仅直接范围，除非您有意想要跨聊天内存共享。",
  "agents.defaults.memorySearch.cache.maxEntries":
    "为存储在 SQLite 中用于内存搜索的缓存嵌入设置一个尽力而为的上限。当控制磁盘增长比峰值重新索引速度更重要时，请使用此选项。",
  "agents.defaults.memorySearch.sync.onSessionStart":
    "会话开始时触发内存索引同步，以便早期回合能够看到最新的内存内容。如果启动时的内存新鲜度比初始回合延迟更重要，请保持启用状态。",
  "agents.defaults.memorySearch.sync.onSearch":
    "使用延迟同步，在检测到内容更改后安排搜索时的重新索引。启用此功能可降低空闲开销，如果需要在任何查询之前预先同步索引，则禁用此功能。",
  "agents.defaults.memorySearch.sync.watch":
    "监视内存文件并根据文件更改事件（chokidar）安排索引更新。启用此功能可获得近乎实时的更新；如果监视操作过于频繁，则在非常大的工作区中禁用此功能。",
  "agents.defaults.memorySearch.sync.watchDebounceMs":
    "用于在重新索引运行前合并快速文件监视事件的防抖窗口（以毫秒为单位）。增加此值可减少频繁写入文件的频繁更改，降低此值可加快文件更新速度。",
  "agents.defaults.memorySearch.sync.sessions.deltaBytes":
    "会话记录更改触发重新索引之前，至少需要添加这么多新字节（默认值：100000）。增加此值可减少频繁的小幅重新索引，降低此值可加快记录更新速度。",
  "agents.defaults.memorySearch.sync.sessions.deltaMessages":
    "Requires at least this many appended transcript messages before reindex is triggered (default: 50). Lower this for near-real-time transcript recall, or raise it to reduce indexing churn.",
  "agents.defaults.memorySearch.sync.sessions.postCompactionForce":
    "Forces a session memory-search reindex after compaction-triggered transcript updates (default: true). Keep enabled when compacted summaries must be immediately searchable, or disable to reduce write-time indexing pressure.",
  ui: "UI presentation settings for accenting and assistant identity shown in control surfaces. Use this for branding and readability customization without changing runtime behavior.",
  "ui.seamColor":
    "Primary accent color used by UI surfaces for emphasis, badges, and visual identity cues. Use high-contrast values that remain readable across light/dark themes.",
  "ui.assistant":
    "设置助手在用户界面中显示的名称和头像的身份标识。请确保这些值与您面向客服人员的角色和支持预期保持一致。",
  "ui.assistant.name":
    "在用户界面视图、聊天窗口和状态栏中显示的助手名称。请保持此名称稳定，以便客服人员能够可靠地识别当前处于活动状态的助手角色。",
  "ui.assistant.avatar":
    "UI界面中使用的助手头像图像来源（URL、路径或数据URI，取决于运行时支持情况）。使用可信资源和一致的品牌尺寸，以确保渲染效果清晰。",
  plugins:
    "插件系统控制功能，用于启用扩展、限制加载范围、配置条目和跟踪安装情况。在生产环境中，应明确插件策略并遵循最小权限原则。",
  "plugins.enabled":
    "启动和配置重新加载期间全局启用或禁用插件/扩展加载（默认值：true）。仅当部署需要扩展功能时才保持启用状态。",
  "plugins.allow":
    "Optional allowlist of plugin IDs; when set, only listed plugins are eligible to load. Configured bundled chat channels can still activate their bundled plugin when the channel is explicitly enabled in config. Use this to enforce approved extension inventories in controlled environments.",
  "plugins.deny":
    "可选的插件 ID 黑名单，即使白名单或路径中包含它们也会被阻止。使用拒绝规则进行紧急回滚，并对有风险的插件实施硬性阻止。",
  "plugins.load":
    "插件加载器配置组，用于指定插件的文件系统发现路径。务必明确指定加载路径并定期检查，以避免意外加载不受信任的扩展程序。",
  "plugins.load.paths":
    "除了内置默认设置外，加载器还会扫描其他插件文件或目录。请使用专用的扩展目录，并避免使用包含无关可执行内容的宽泛路径。",
  "plugins.slots":
    "选择哪些插件拥有独占的运行时槽位（例如内存），从而确保只有一个插件提供该功能。使用显式槽位所有权可以避免行为冲突的提供程序重叠。",
  "plugins.slots.memory": "通过 ID 选择当前活动的内存插件，或选择“无”以禁用内存插件。",
  "plugins.slots.contextEngine":
    "通过 ID 选择当前活动的上下文引擎插件，以确保只有一个插件提供上下文编排行为。",
  "plugins.entries":
    "按插件 ID 键入的每个插件设置，包括启用状态和插件特定的运行时配置有效载荷。使用此功能进行范围内的插件调优，而无需更改全局加载器策略。",
  "plugins.entries.*.enabled":
    "特定条目的插件启用覆盖，应用于全局插件策略之上（需要重启）。使用此功能在不同环境中逐步部署插件 rollout。",
  "plugins.entries.*.hooks":
    "针对核心强制执行的安全门，可对每个插件进行类型化的钩子策略控制。使用此功能可在不禁用整个插件的情况下，限制高影响的钩子类别。",
  "plugins.entries.*.hooks.allowPromptInjection":
    "Controls whether this plugin may mutate prompts through typed hooks. Set false to block `before_prompt_build` and ignore prompt-mutating fields from legacy `before_agent_start`, while preserving legacy `modelOverride` and `providerOverride` behavior.",
  "plugins.entries.*.subagent":
    "Per-plugin subagent runtime controls for model override trust and allowlists. Keep this unset unless a plugin must explicitly steer subagent model selection.",
  "plugins.entries.*.subagent.allowModelOverride":
    "Explicitly allows this plugin to request provider/model overrides in background subagent runs. Keep false unless the plugin is trusted to steer model selection.",
  "plugins.entries.*.subagent.allowedModels":
    'Allowed override targets for trusted plugin subagent runs as canonical "provider/model" refs. Use "*" only when you intentionally allow any model.',
  "plugins.entries.*.apiKey":
    "可选的 API 密钥字段，供那些接受在入口设置中直接配置密钥的插件使用。请使用 secret/env 替换，避免将真实凭据提交到配置文件中。",
  "plugins.entries.*.env":
    "每个插件的环境变量映射仅注入到该插件的运行时上下文中。使用此功能可以将提供程序凭据限定于单个插件，而不是共享全局进程环境。",
  "plugins.entries.*.config":
    "Plugin-defined configuration payload interpreted by that plugin's own schema and validation rules. Use only documented fields from the plugin to prevent ignored or invalid settings.",
  "plugins.installs":
    "CLI-managed install metadata (used by `openclaw plugins update` to locate install sources).",
  "plugins.installs.*.source": 'Install source ("npm", "archive", or "path").',
  "plugins.installs.*.spec": "Original npm spec used for install (if source is npm).",
  "plugins.installs.*.sourcePath": "Original archive/path used for install (if any).",
  "plugins.installs.*.installPath": "Resolved install directory for the installed plugin bundle.",
  "plugins.installs.*.version": "Version recorded at install time (if available).",
  "plugins.installs.*.resolvedName": "Resolved npm package name from the fetched artifact.",
  "plugins.installs.*.resolvedVersion":
    "Resolved npm package version from the fetched artifact (useful for non-pinned specs).",
  "plugins.installs.*.resolvedSpec":
    "Resolved exact npm spec (<name>@<version>) from the fetched artifact.",
  "plugins.installs.*.integrity":
    "Resolved npm dist integrity hash for the fetched artifact (if reported by npm).",
  "plugins.installs.*.shasum":
    "Resolved npm dist shasum for the fetched artifact (if reported by npm).",
  "plugins.installs.*.resolvedAt":
    "ISO timestamp when npm package metadata was last resolved for this install record.",
  "plugins.installs.*.installedAt": "ISO timestamp of last install/update.",
  "plugins.installs.*.marketplaceName":
    "Marketplace display name recorded for marketplace-backed plugin installs (if available).",
  "plugins.installs.*.marketplaceSource":
    "Original marketplace source used to resolve the install (for example a repo path or Git URL).",
  "plugins.installs.*.marketplacePlugin":
    "Plugin entry name inside the source marketplace, used for later updates.",
  "agents.list.*.identity.avatar":
    "Agent avatar (workspace-relative path, http(s) URL, or data URI).",
  "agents.defaults.model.primary": "Primary model (provider/model).",
  "agents.defaults.model.fallbacks":
    "Ordered fallback models (provider/model). Used when the primary model fails.",
  "agents.defaults.embeddedHarness":
    "Default embedded agent harness policy. Use runtime=auto for plugin harness selection, runtime=pi for built-in PI, or a registered harness id such as codex.",
  "agents.defaults.embeddedHarness.runtime":
    "Embedded harness runtime: auto, pi, or a registered plugin harness id such as codex.",
  "agents.defaults.embeddedHarness.fallback":
    "Embedded harness fallback when no plugin harness matches or an auto-selected plugin harness fails before side effects. Set none to disable automatic PI fallback.",
  "agents.list.*.embeddedHarness":
    "Per-agent embedded harness policy override. Use fallback=none to make this agent fail instead of falling back to PI.",
  "agents.list.*.embeddedHarness.runtime":
    "Per-agent embedded harness runtime: auto, pi, or a registered plugin harness id such as codex.",
  "agents.list.*.embeddedHarness.fallback":
    "Per-agent embedded harness fallback. Set none to disable automatic PI fallback for this agent.",
  "agents.defaults.imageModel.primary":
    "Optional image model (provider/model) used when the primary model lacks image input.",
  "agents.defaults.imageModel.fallbacks": "Ordered fallback image models (provider/model).",
  "agents.defaults.imageGenerationModel.primary":
    "Optional image-generation model (provider/model) used by the shared image generation capability.",
  "agents.defaults.imageGenerationModel.fallbacks":
    "Ordered fallback image-generation models (provider/model).",
  "agents.defaults.videoGenerationModel.primary":
    "Optional video-generation model (provider/model) used by the shared video generation capability.",
  "agents.defaults.videoGenerationModel.fallbacks":
    "Ordered fallback video-generation models (provider/model).",
  "agents.defaults.musicGenerationModel.primary":
    "Optional music-generation model (provider/model) used by the shared music generation capability.",
  "agents.defaults.musicGenerationModel.fallbacks":
    "Ordered fallback music-generation models (provider/model).",
  "agents.defaults.mediaGenerationAutoProviderFallback":
    "When true (default), shared image, music, and video generation automatically appends other auth-backed provider defaults after explicit primary/fallback refs. Set false to disable implicit cross-provider fallback while keeping explicit fallbacks.",
  "agents.defaults.pdfModel.primary":
    "PDF 分析工具的可选 PDF 模型（提供程序/模型）。默认为 imageModel，其次为 sessionmodel。",
  "agents.defaults.pdfModel.fallbacks": "有序的备用 PDF 模型（提供商/模型）。",
  "agents.defaults.pdfMaxBytesMb": "PDF 工具的最大 PDF 文件大小（以兆字节为单位）（默认值：10）。",
  "agents.defaults.pdfMaxPages": "PDF 工具处理的最大 PDF 页面数（默认值：20）。",
  "agents.defaults.imageMaxDimensionPx":
    "净化对话/工具结果图像有效负载时的最大图像边长（以像素为单位）（默认值：1200）。",
  "agents.defaults.cliBackends": "可选的 CLI 后端，用于仅文本回退（claude-cli 等）。",
  "agents.defaults.compaction":
    "当上下文接近令牌限制时，可进行压缩调整，包括历史记录共享、预留空间和压缩前内存刷新行为。当长时间运行的会话需要在紧凑的上下文窗口内保持稳定连续性时，请使用此功能。",
  "agents.defaults.compaction.mode":
    'Compaction strategy mode: "default" uses baseline behavior, while "safeguard" applies stricter guardrails to preserve recent context. Keep "default" unless you observe aggressive history loss near limit boundaries.',
  "agents.defaults.compaction.provider":
    "Id of a registered compaction provider plugin used for summarization. When set and the provider is registered, its summarize() method is called instead of the built-in summarizeInStages pipeline. Falls back to built-in on provider failure. Leave unset to use the default built-in summarization.",
  "agents.defaults.compaction.reserveTokens":
    "压缩运行后，会预留令牌空间用于生成回复和工具输出。对于需要执行大量详细操作或工具密集型任务的会话，应使用更高的预留空间；而当最大化保留历史记录更为重要时，则应使用更低的预留空间。",
  "agents.defaults.compaction.keepRecentTokens":
    "压缩过程中保留最近会话窗口的最小令牌预算。使用较高的值可以保证即时上下文的连续性，而较低的值则可以保留更多的长尾历史记录。",
  "agents.defaults.compaction.reserveTokensFloor":
    "Pi 压缩路径中对 reserveToken 强制执行最低数量限制（0 表示禁用此限制）。使用非零最低数量限制可避免在代币数量估计波动的情况下过度压缩。",
  "agents.defaults.compaction.maxHistoryShare":
    "压缩后保留历史数据所允许的最大上下文预算比例（范围 0.1-0.9）。较低的比例可获得更大的生成空间，较高的比例可获得更深层次的历史连续性。",
  "agents.defaults.compaction.identifierPolicy":
    "压缩摘要的标识符保留策略：“严格”会添加内置的不透明标识符保留指南（默认），“关闭”会禁用此前缀，“自定义”则使用 identifierInstructions。除非有特定的兼容性需求，否则请保持“严格”设置。",
  "agents.defaults.compaction.identifierInstructions":
    '当 identifierPolicy="custom" 时，使用自定义标识符保留指令文本。保持此指令明确且注重安全性，以防止压缩摘要重写不透明的 ID、URL、主机或端口。',
  "agents.defaults.compaction.recentTurnsPreserve":
    "在安全摘要之外，保留最近用户/助手对话的完整轮次数量（默认值：3）。提高此值可保留最近的完整对话上下文，降低此值可最大限度地节省压缩空间。",
  "agents.defaults.compaction.qualityGuard":
    "可选的质量审核重试设置，用于生成安全压缩摘要。除非您明确希望在检查失败时进行摘要审核和一次性重新生成，否则请保持禁用状态。",
  "agents.defaults.compaction.qualityGuard.enabled":
    "启用摘要质量审核和再生重试以进行保护压缩。默认值：false，因此仅保护模式不会触发重试行为。",
  "agents.defaults.compaction.qualityGuard.maxRetries":
    "Maximum number of regeneration retries after a failed safeguard summary quality audit. Use small values to bound extra latency and token cost.",
  "agents.defaults.compaction.postIndexSync":
    'Controls post-compaction session memory reindex mode: "off", "async", or "await" (default: "async"). Use "await" for strongest freshness, "async" for lower compaction latency, and "off" only when session-memory sync is handled elsewhere.',
  "agents.defaults.compaction.postCompactionSections":
    'AGENTS.md H2/H3 section names re-injected after compaction so the agent reruns critical startup guidance. Leave unset to use "Session Startup"/"Red Lines" with legacy fallback to "Every Session"/"Safety"; set to [] to disable reinjection entirely.',
  "agents.defaults.compaction.timeoutSeconds":
    "Maximum time in seconds allowed for a single compaction operation before it is aborted (default: 900). Increase this for very large sessions that need more time to summarize, or decrease it to fail faster on unresponsive models.",
  "agents.defaults.compaction.model":
    "Optional provider/model override used only for compaction summarization. Set this when you want compaction to run on a different model than the session default, and leave it unset to keep using the primary agent model.",
  "agents.defaults.compaction.truncateAfterCompaction":
    "When enabled, rewrites the session JSONL file after compaction to remove entries that were summarized. Prevents unbounded file growth in long-running sessions with many compaction cycles. Default: false.",
  "agents.defaults.compaction.notifyUser":
    "When enabled, sends a brief compaction notice to the user (e.g. '🧹 Compacting context...') when compaction starts. Disabled by default to keep compaction silent and non-intrusive.",
  "agents.defaults.compaction.memoryFlush":
    "预压缩内存刷新设置会在进行大量内存压缩之前执行一次主动内存写入操作。长时间会话期间请保持启用状态，以便在进行大幅度内存修剪之前保留关键上下文信息。",
  "agents.defaults.compaction.memoryFlush.enabled":
    "启用此功能后，运行时会在接近令牌限制时执行更严格的历史记录缩减，此时会进行预压缩内存刷新。除非您在资源受限的环境中有意禁用内存副作用，否则请保持启用状态。",
  "agents.defaults.compaction.memoryFlush.softThresholdTokens":
    "距离压缩阈值（以令牌为单位）的距离，超过该阈值将触发压缩前的内存刷新操作。使用较早的阈值可以提高持久化安全性，而使用较晚的阈值则可以降低刷新频率。",
  "agents.defaults.compaction.memoryFlush.forceFlushTranscriptBytes":
    "当转录文件大小达到此阈值（字节或类似“2mb”的字符串）时，强制执行压缩前内存刷新。即使令牌计数器过期，使用此功能也能防止长时间会话挂起；设置为 0 可禁用此功能。",
  "agents.defaults.compaction.memoryFlush.prompt":
    "此用户提示模板用于生成内存候选文件时执行预压缩内存刷新操作。仅当您需要超出默认内存刷新行为的自定义提取指令时才使用此模板。",
  "agents.defaults.compaction.memoryFlush.systemPrompt":
    "系统提示覆盖预压缩内存刷新指令，以控制提取方式和安全限制。请谨慎使用，确保自定义指令不会降低内存质量或泄露敏感信息。",
  "agents.defaults.embeddedPi":
    "嵌入式 Pi 运行器强化控制，用于控制如何在 OpenClaw 会话中信任和应用工作区本地 Pi 设置。",
  "agents.defaults.embeddedPi.projectSettingsPolicy":
    'How embedded Pi handles workspace-local `.pi/config/settings.json`: "sanitize" (default) strips shellPath/shellCommandPrefix, "ignore" disables project settings entirely, and "trusted" applies project settings as-is.',
  "agents.defaults.embeddedPi.executionContract":
    'Embedded Pi execution contract: "default" keeps the standard runner behavior, while "strict-agentic" keeps OpenAI/OpenAI Codex GPT-5-family runs acting until they hit a real blocker instead of stopping at plans or filler.',
  "agents.list[].embeddedPi":
    "Optional per-agent embedded Pi overrides. Use this to opt specific agents into stricter GPT-5 execution behavior without changing the global default.",
  "agents.list[].embeddedPi.executionContract":
    'Optional per-agent embedded Pi execution contract override. Set "strict-agentic" to keep that agent acting through plan-only turns on OpenAI/OpenAI Codex GPT-5-family runs, or "default" to inherit the standard runner behavior.',
  "agents.defaults.humanDelay.mode": 'Delay style for block replies ("off", "natural", "custom").',
  "agents.defaults.humanDelay.minMs": "Minimum delay in ms for custom humanDelay (default: 800).",
  "agents.defaults.humanDelay.maxMs": "Maximum delay in ms for custom humanDelay (default: 2500).",
  commands:
    "控制聊天命令界面、所有者权限设置以及跨服务提供商的高级命令访问权限。除非您需要更严格的操作员控制或更广泛的命令权限，否则请保留默认设置。",
  "commands.native":
    "将原生斜杠/菜单命令注册到支持命令注册的频道（例如 Discord、Slack、Telegram）。除非您有意运行纯文本命令工作流程，否则请保持启用状态以便于发现。",
  "commands.nativeSkills":
    "注册原生技能命令，以便用户在支持的提供商命令菜单中直接调用技能。请与您的技能策略保持一致，确保公开的命令符合操作员的预期。",
  "commands.text":
    "除了原生命令界面外，此功能还允许在聊天输入中解析文本命令（如有）。为了兼容不支持原生命令注册的频道，请保持此功能启用。",
  "commands.bash":
    "允许 bash 聊天命令（`!`；`/bash` 别名）运行主机 shell 命令（默认值：false；需要 tools.elevated）。",
  "commands.bashForegroundMs":
    "How long bash waits before backgrounding (default: 2000; 0 backgrounds immediately).",
  "commands.config": "Allow /config chat command to read/write config on disk (default: false).",
  "commands.mcp":
    "Allow /mcp chat command to manage OpenClaw MCP server config under mcp.servers (default: false).",
  "commands.plugins":
    "Allow /plugins chat command to list discovered plugins and toggle plugin enablement in config (default: false).",
  "commands.debug": "Allow /debug chat command for runtime-only overrides (default: false).",
  "commands.restart": "Allow /restart and gateway restart tool actions (default: true).",
  "commands.useAccessGroups": "Enforce access-group allowlists/policies for commands.",
  "commands.ownerAllowFrom":
    "为仅限所有者使用的工具/命令设置明确的所有者允许列表。使用频道原生 ID（可选择性地添加前缀，例如“whatsapp:+15551234567”）。“*”将被忽略。",
  "commands.ownerDisplay":
    "控制系统提示符中所有者 ID 的显示方式。允许的值：raw、hash。默认值：raw。",
  "commands.ownerDisplaySecret":
    "当 ownerDisplay=hash 时，用于对所有者 ID 进行 HMAC 哈希处理的可选密钥。建议使用环境变量替换。",
  "commands.allowFrom":
    "Defines elevated command allow rules by channel and sender for owner-level command surfaces. Use narrow provider-specific identities so privileged commands are not exposed to broad chat audiences.",
  mcp: "Global MCP server definitions managed by OpenClaw. Embedded Pi and other runtime adapters can consume these servers without storing them inside Pi-owned project settings.",
  "mcp.servers":
    "Named MCP server definitions. OpenClaw stores them in its own config and runtime adapters decide which transports are supported at execution time.",
  session:
    "全局会话路由、重置、传递策略和维护控制，用于对话历史行为。除非您需要更严格的隔离、保留或传递约束，否则请保留默认设置。",
  "session.scope":
    '设置基本会话分组策略："per-sender" 按发送者隔离，"global" 在每个频道上下文中共享一个会话。除非有意使用共享上下文，否则请保持 "per-sender" 以确保更安全的多用户行为。',
  "session.dmScope":
    '私信会话范围："main" 保持连续性，而 "per-peer"、"per-channel-peer" 和 "per-account-channel-peer" 增加隔离。在共享收件箱或多个账户部署中使用隔离模式。',
  "session.identityLinks":
    "将规范身份映射到提供商前缀的对等 ID，以便等效用户解析到一个私信线程（示例：telegram:123456）。当同一人类出现在多个频道或账户中时使用此功能。",
  "session.resetTriggers":
    "列出在传入内容中匹配时强制重置会话的消息触发器。谨慎使用明确的重置短语，以避免在正常对话过程中意外丢失上下文。",
  "session.idleMinutes":
    "在分钟内应用传统的空闲重置窗口，用于跨不活动间隙的会话复用行为。仅用于兼容性，并优先考虑在 session.reset/session.resetByType 下的结构化重置策略。",
  "session.reset":
    "定义在没有特定类型或通道的覆盖规则时使用的默认重置策略对象。请先设置此对象，然后仅在行为必须不同时才使用 resetByType 或 resetByChannel。",
  "session.reset.mode":
    "选择重置策略：“每日”重置会在设定的时间重置，“空闲”重置会在不活动时间段后重置。每个策略保留一种清除模式，以避免出现意外的上下文切换模式。",
  "session.reset.atHour":
    "设置每日重置模式的本地时间范围（0-23），以便会话按预期时间滚动。与 mode=daily 一起使用，并根据操作员的时区预期进行调整，以实现易于理解的行为。",
  "session.reset.idleMinutes":
    "设置空闲模式下重置前的非活动窗口，也可作为每日模式的辅助保护措施。使用较大的值可保持连续性，使用较小的值则可创建生命周期较短的线程。",
  "session.resetByType":
    "当默认设置不足以满足需求时，可按聊天类型（私聊、群组、对话）覆盖重置行为。当群组/对话的重置频率与私聊不同时，请使用此选项。",
  "session.resetByType.direct":
    "定义私聊的重置策略，并取代该类型的基本 session.reset 配置。请使用此配置作为标准的私聊重置策略，而不是使用旧的 dm 别名。",
  "session.resetByType.dm":
    "已弃用的直接重置行为别名，保留此别名是为了向后兼容旧配置。请改用 session.resetByType.direct，以确保未来工具和验证的一致性。",
  "session.resetByType.group":
    "定义群聊会话的重置策略，群聊会话的连续性和噪音模式与私聊不同。如果上下文漂移成为问题，则对繁忙的群组使用较短的空闲窗口。",
  "session.resetByType.thread":
    "定义线程作用域会话的重置策略，包括专注的频道线程工作流程。当线程会话应该比其他聊天类型更快或更慢过期时使用此选项。",
  "session.resetByChannel":
    "提供按频道特定的重置覆盖，通过提供商/频道 ID 键控，以实现细粒度的行为控制。仅在某个频道需要超出类型级别策略的异常重置行为时使用。",
  "session.store":
    "设置用于在重启后保留会话记录的会话存储文件路径。仅当需要自定义磁盘布局、备份路由或挂载卷存储时才使用显式路径。",
  "session.typingIntervalSeconds":
    "控制在支持输入的频道中准备回复时重复显示输入指示器的间隔。增加此值可减少频繁的提示信息，减少此值可获得更积极的输入反馈。",
  "session.typingMode":
    '控制输入提示行为时机："never"(从不)、"instant"(立即)、"thinking"(思考中)或"message"(消息)。在高流量频道中保持保守模式以避免不必要的输入提示噪音。',
  "session.parentForkMaxTokens":
    "线程/会话继承分叉允许的最大父会话令牌计数。如果父会话超过此值，OpenClaw 将启动新的线程会话而不是分叉；设置为 0 可禁用此保护。",
  "session.mainKey":
    '当 dmScope 或路由逻辑指向"main"时，覆盖用于连续性的规范主会话密钥。仅在需要自定义会话锚定时使用稳定值。',
  "session.sendPolicy":
    "使用针对频道、chatType 和密钥前缀的允许/拒绝规则控制跨会话发送权限。用这个在复杂环境中限制会话工具可以发送消息的位置。",
  "session.sendPolicy.default":
    '设置没有 sendPolicy 规则匹配时的回退操作："allow"(允许)或"deny"(拒绝)。对于简单设置保持"allow"，或在需要为每个目标明确允许规则时选择"deny"。',
  "session.sendPolicy.rules":
    '在默认操作之前评估的有序允许/拒绝规则，例如 `{ action: "deny", match: { channel: "discord" } }`。最具体的规则放在最前面，以免宽泛规则掩盖异常。',
  "session.sendPolicy.rules[].action":
    '定义规则决定为"allow"(允许)或"deny"(拒绝)，当对应的匹配条件满足时。使用拒绝优先的顺序在通过明确允许异常执行严格边界时。',
  "session.sendPolicy.rules[].match":
    "定义可选的规则匹配条件，可以组合频道、chatType 和密钥前缀约束。保持匹配窄范围以维持策略意图清晰且调试简洁。",
  "session.sendPolicy.rules[].match.channel":
    "将规则应用与特定频道/提供商 id 匹配(例如 discord、telegram、slack)。当一个频道应该独立于其他频道允许或拒绝传递时使用此功能。",
  "session.sendPolicy.rules[].match.chatType":
    "将规则应用与聊天类型匹配(direct(直接)、group(群组)、thread(线程))以便行为根据对话形式变化。当 DM 和群组目标需要不同的安全边界时使用此功能。",
  "session.sendPolicy.rules[].match.keyPrefix":
    "在策略消费者中的内部密钥规范化步骤后与规范化会话密钥前缀匹配。用于一般前缀控制，当需要精确全密钥匹配时优先使用 rawKeyPrefix。",
  "session.sendPolicy.rules[].match.rawKeyPrefix":
    "与原始、未规范化的会话密钥前缀匹配以进行精确全密钥策略定位。当规范化 keyPrefix 太宽泛且需要代理前缀或传输特定精度时使用此功能。",
  "session.agentToAgent":
    "对代理间会话交换的控制进行分组，包括回复链接上的循环防止限制。除非运行具有严格轮次上限的高级代理间自动化，否则保持默认值。",
  "session.agentToAgent.maxPingPongTurns":
    "请求者和目标代理之间在代理间交换中的最大回复轮次(0-5)。使用较低的值来硬限制闲聊循环并保持可预测的运行完成。",
  "session.threadBindings":
    "支持线程焦点工作流的提供商之间线程绑定会话路由行为的共享默认值。在此配置全局默认值，仅在行为不同时按频道覆盖。",
  "session.threadBindings.enabled":
    "线程绑定会话路由功能和焦点线程传递行为的全局主开关。对于现代线程工作流保持启用状态，除非需要全局禁用线程绑定。",
  "session.threadBindings.idleHours":
    "跨提供商/频道的线程绑定会话不活跃窗口默认值，以小时计(0 禁用空闲自动取消焦点)。默认值：24。",
  "session.threadBindings.maxAgeHours":
    "跨提供商/频道的线程绑定会话可选硬最大年龄，以小时计(0 禁用硬上限)。默认值：0。",
  "session.maintenance":
    "自动会话存储维护控制，用于清除年龄、条目上限和文件轮换行为。在警告模式下启动以观察影响，然后在阈值调整后强制执行。",
  "session.maintenance.mode":
    '确定维护策略是仅报告("warn"(警告))还是主动应用("enforce"(强制))。在推出期间保持"warn"，验证安全阈值后切换到"enforce"。',
  "session.maintenance.pruneAfter":
    "在维护过程中删除超过此持续时间的条目(例如 `30d` 或 `12h`)。使用此作为主要年龄保留控制并将其与数据保留策略对齐。",
  "session.maintenance.pruneDays":
    "已弃用的年龄保留字段，为了向后兼容使用日数计数的旧配置而保留。改用 session.maintenance.pruneAfter 以便持续时间语法和行为一致。",
  "session.maintenance.maxEntries":
    "限制会话存储中保留的总会话条目数以防止随时间无限增长。对受限制的环境使用较低限制，或在需要更长历史记录时使用较高限制。",
  "session.maintenance.rotateBytes":
    "当文件大小超过阈值(如 `10mb` 或 `1gb`)时轮换会话存储。用于限制单个文件增长并使备份/恢复操作保持可管理。",
  "session.maintenance.resetArchiveRetention":
    "重置记录档案(`*.reset.<timestamp>`)的保留期。接受持续时间(例如 `30d`)或 `false` 以禁用清除。默认为 pruneAfter 以防重置工件无限增长。",
  "session.maintenance.maxDiskBytes":
    "可选的每代理会话目录磁盘预算(例如 `500mb`)。使用此限制每个代理的会话存储；超过时，警告模式报告压力，强制模式执行最旧优先清除。",
  "session.maintenance.highWaterBytes":
    "磁盘预算清除后的目标大小(高水位标记)。默认为 maxDiskBytes 的 80%；显式设置以在受限磁盘上实现更紧密的回收行为。",
  cron: "存储的 cron 作业、运行并发、传递回退和运行会话保留的全局调度程序设置。除非对作业量进行扩展或集成外部网钩接收器，否则保持默认值。",
  "cron.enabled":
    "启用由网关管理的存储调度的 cron 作业执行。对于正常的提醒/自动化流保持启用，仅在要暂停所有 cron 执行而不删除作业时禁用。",
  "cron.store":
    "cron 作业存储文件的路径，用于跨重启持久化计划作业。仅在需要自定义存储布局、备份或挂载卷时设置显式路径。",
  "cron.maxConcurrentRuns":
    "限制多个计划同时激活时可以同时执行的 cron 作业数。使用较低的值来保护重负载下的 CPU/内存，或谨慎提高以获得更高的吞吐量。",
  "cron.retry":
    "覆盖单次作业在发生临时错误(速率限制、过载、网络、server_error)时的默认重试策略。省略以使用默认值：maxAttempts 3、backoffMs [30000, 60000, 300000]、重试所有临时类型。",
  "cron.retry.maxAttempts": "单次作业在临时错误时的最大重试次数，达到后永久禁用(默认值：3)。",
  "cron.retry.backoffMs":
    "每次重试尝试的退避延迟(毫秒)(默认值：[30000, 60000, 300000])。使用较短的值以加快重试。",
  "cron.retry.retryOn":
    "重试的错误类型：rate_limit(速率限制)、overloaded(过载)、network(网络)、timeout(超时)、server_error(服务器错误)。使用此限制哪些错误触发重试；省略以重试所有临时类型。",
  "cron.webhook":
    '已弃用的旧版回退网钩 URL，仅用于具有 `notify=true` 的旧作业。迁移到使用 `delivery.mode="webhook"` 加 `delivery.to` 的按作业传递，并避免依赖此全局字段。',
  "cron.webhookToken":
    "使用网钩模式时附加到 cron 网钩 POST 传递的不记名令牌。优先使用秘密/环境替换，如果共享网钩端点是互联网可达的，请定期轮换此令牌。",
  "cron.sessionRetention":
    "控制已完成的 cron 运行会话在清除前保留多长时间(`24h`、`7d`、`1h30m`或 `false` 禁用清除；默认值：`24h`)。使用较短的保留期以减少高频率计划的存储增长。",
  "cron.runLog":
    "每个作业 cron 运行历史文件的清除控制，位于 `cron/runs/<jobId>.jsonl`，包括大小和行保留。",
  "cron.runLog.maxBytes":
    "在重写以保持最后 keepLines 条目前 cron 运行日志文件的最大字节数(例如 `2mb`，默认 `2000000`)。",
  "cron.runLog.keepLines":
    "当文件超过 maxBytes 时保留的尾部运行日志行数(默认 `2000`)。增加以获得更长的取证历史记录或降低以获得更小的磁盘占用。",
  hooks:
    "入站 webhook 自动化表面，用于将外部事件映射到 OpenClaw 中的唤醒或代理操作。在向受信任网络之外公开之前，使用明确的令牌/会话/代理控制将其锁定。",
  "hooks.enabled":
    "启用网钩端点和入站网钩请求的映射执行管道。除非主动将外部事件路由到网关中，否则保持禁用状态。",
  "hooks.path":
    "网钩端点在网关控制服务器上使用的 HTTP 路径(例如 `/hooks`)。使用不容易猜测的路径并将其与令牌验证相结合以实现纵深防御。",
  "hooks.token":
    "Shared bearer token checked by hooks ingress for request authentication before mappings run. Treat holders as full-trust callers for the hook ingress surface, not as a separate non-owner role. Use environment substitution and rotate regularly when webhook endpoints are internet-accessible.",
  "hooks.defaultSessionKey":
    "当请求未通过允许的通道提供会话密钥时，用于网钩传递的回退会话密钥。使用稳定但作用域化的密钥以避免混合无关的自动化对话。",
  "hooks.allowRequestSessionKey":
    "当为真时，允许调用方在网钩请求中提供会话密钥，启用调用方控制的路由。除非受信任的集成方明确需要自定义会话线程化，否则保持为假。",
  "hooks.allowedSessionKeyPrefixes":
    "启用调用方提供的密钥时接受的会话密钥前缀的允许列表。使用窄前缀以防止任意会话密钥注入。",
  "hooks.allowedAgentIds":
    "Allowlist of agent IDs that hook mappings are allowed to target when selecting execution agents. Use this to constrain automation events to dedicated service agents and reduce blast radius if a hook token is exposed.",
  "hooks.maxBodyBytes":
    "在请求被拒绝之前处理的最大网钩负载大小(字节)。保持这个范围有界以减少滥用风险并在突发集成下保护内存使用。",
  "hooks.presets":
    "在加载时应用的命名网钩预设包，用于播种标准映射和行为默认值。保持预设使用显式以便操作员可以审计哪些自动化处于活跃状态。",
  "hooks.transformsDir":
    "由映射变换 transform.module 路径引用的网钩变换模块的基本目录。使用受控的仓库目录以便动态导入保持可审查和可预测。",
  "hooks.mappings":
    "有序映射规则，匹配入站网钩请求并选择唤醒或代理操作，可选传递路由。使用特定映射优先以避免宽泛模式规则捕获所有内容。",
  "hooks.mappings[].id":
    "网钩映射条目的可选稳定标识符，用于审计、故障排除和目标更新。使用唯一 ID 以便日志和配置差异可以明确引用映射。",
  "hooks.mappings[].match":
    "映射匹配谓词的分组对象，如路径和源，在应用操作路由之前。保持匹配条件具体以便无关的网钩流量不会触发自动化。",
  "hooks.mappings[].match.path":
    "网钩映射的路径匹配条件，通常与入站请求路径进行比较。使用此按网钩端点路径系列分割自动化行为。",
  "hooks.mappings[].match.source":
    "网钩映射的源匹配条件，通常由受信任的上游元数据或适配器逻辑设置。使用稳定的源标识符以便路由在重试中保持确定性。",
  "hooks.mappings[].action":
    '映射操作类型："wake"(唤醒)触发代理唤醒流程，而"agent"(代理)直接发送给代理处理。对于立即执行使用"agent"，当心跳驱动处理首选时使用"wake"。',
  "hooks.mappings[].wakeMode":
    '唤醒调度模式："now"(现在)立即唤醒，而"next-heartbeat"(下一个心跳)延迟到下一个心跳周期。对低优先级自动化使用延迟模式，可容忍轻微延迟。',
  "hooks.mappings[].name":
    "在诊断和面向操作员的配置 UI 中使用的人类可读的映射显示名称。保持名称简洁和描述性以便在事件审查期间路由意图明显。",
  "hooks.mappings[].agentId":
    "映射执行的目标代理 ID，当操作路由不应使用默认值时。使用专用自动化代理将网钩行为与交互式操作员会话隔离。",
  "hooks.mappings[].sessionKey":
    "映射传递消息的显式会话密钥覆盖以控制线程连续性。使用稳定的作用域化密钥以便重复事件关联而不会泄漏到无关的对话中。",
  "hooks.mappings[].messageTemplate":
    "用于将结构化映射输入合成到发送到目标操作路径的最终消息内容的模板。保持模板确定性以便下游解析和行为保持稳定。",
  "hooks.mappings[].textTemplate":
    "当不需要或不支持富有效载呈现时使用的仅文本回退模板。使用此提供简洁、一致的摘要字符串以用于聊天传递表面。",
  "hooks.mappings[].deliver":
    "控制映射执行结果是否返回传递到频道目标与默认处理。对于不应发布面向用户的输出的背景自动化禁用传递。",
  "hooks.mappings[].allowUnsafeExternalContent":
    "当为真时，映射内容可在生成的消息中包括较少清理的外部负载数据。默认保持为假，仅对具有已审查变换逻辑的受信任源启用。",
  "hooks.mappings[].channel":
    '映射输出的传递频道覆盖(例如"last"(最后)、"telegram"(电报)、"discord"(不和)、"slack"(Slack)、"signal"(信号)、"imessage"(iMessage)或"msteams"(Microsoft Teams))。保持频道覆盖明确以避免意外的跨频道发送。',
  "hooks.mappings[].to":
    "映射回复应路由到固定目标时所选频道内的目标标识符。在启用生产映射之前验证提供商特定的目标格式。",
  "hooks.mappings[].model":
    "当自动化应使用与代理默认值不同的模型时，映射触发的运行的可选模型覆盖。谨慎使用此功能以便行为在映射执行中保持可预测。",
  "hooks.mappings[].thinking":
    "映射触发的运行的可选思考工作量覆盖，以调整延迟与推理深度。对高容量网钩保持较低或最少，除非明确需要更深的推理。",
  "hooks.mappings[].timeoutSeconds":
    "映射操作执行允许的最大运行时间，然后应用超时处理。对高容量网钩源使用更紧密的限制以防止队列堆积。",
  "hooks.mappings[].transform":
    "变换配置块定义在映射操作处理之前的模块/导出预处理。仅从已审查的代码路径使用变换，并保持行为确定性以用于可重复的自动化。",
  "hooks.mappings[].transform.module":
    "从 hooks.transformsDir 加载的相对变换模块路径以在传递前重写传入负载。保持模块本地、已审查且无路径遍历模式。",
  "hooks.mappings[].transform.export":
    "从变换模块调用的命名导出；省略时默认为模块默认导出。当一个文件托管多个变换处理程序时设置此选项。",
  "hooks.gmail":
    "用于 Pub/Sub 通知和可选本地回调服务的 Gmail 推送集成设置。尽可能将其作用范围限制在专用 Gmail 自动化帐户。",
  "hooks.gmail.account":
    "此网钩集成中用于 Gmail 监视/订阅操作的 Google 帐户标识符。使用专用自动化邮箱帐户以隔离操作权限。",
  "hooks.gmail.label":
    "可选 Gmail 标签过滤器，限制哪些标记消息触发网钩事件。保持过滤器窄范围以避免用无关的收件箱流量淹没自动化。",
  "hooks.gmail.topic":
    "此帐户的此 Gmail 监视用于发布变更通知的 Google Pub/Sub 主题名称。在启用监视前确保主题 IAM 授予 Gmail 发布访问权限。",
  "hooks.gmail.subscription":
    "网关使用的 Pub/Sub 订阅以接收来自配置主题的 Gmail 变更通知。保持订阅所有权清晰以便多个使用者不会意外竞争。",
  "hooks.gmail.hookUrl":
    "Gmail 或中介调用的公共回调 URL 以将通知传递到此网钩管道。使用令牌验证保护此 URL 并限制网络暴露。",
  "hooks.gmail.includeBody":
    "当为真时，获取并包括电子邮件正文内容以用于下游映射/代理处理。仅在需要正文文本时保持为真，因为这会增加负载大小和敏感性。",
  "hooks.gmail.allowUnsafeExternalContent":
    "在启用时允许较少清理的外部 Gmail 内容传入处理。对于默认安全性保持禁用状态，仅对具有受控变换的受信任邮件流启用。",
  "hooks.gmail.serve":
    "本地回调服务器设置块，用于直接接收 Gmail 通知而无需单独的入口层。仅当此进程应自身终止网钩流量时启用。",
  "hooks.gmail.pushToken":
    "Gmail 推送网钩回调前需要的共享秘密令牌，然后再处理通知。使用环境替换，如果回调端点暴露于外部，请定期轮换。",
  "hooks.gmail.maxBytes":
    "启用 includeBody 时每个事件处理的最大 Gmail 负载字节数。保持保守限制以减少超大消息处理成本和风险。",
  "hooks.gmail.renewEveryMinutes":
    "Gmail 监视订阅的续期频率(分钟)以防止过期。设置在提供商过期窗口下方，并在日志中监视续期失败。",
  "hooks.gmail.serve.bind":
    "启用服务模式时本地 Gmail 回调 HTTP 服务器的绑定地址。除非有意需要外部入口，否则保持仅本地环回。",
  "hooks.gmail.serve.port":
    "启用服务模式时本地 Gmail 回调 HTTP 服务器的端口。使用专用端口以避免与网关/控制接口冲突。",
  "hooks.gmail.serve.path":
    "本地 Gmail 回调服务器上接受推送通知的 HTTP 路径。保持此与订阅配置一致以避免丢弃的事件。",
  "hooks.gmail.tailscale.mode":
    'Gmail 回调的 Tailscale 暴露模式："off"(关闭)、"serve"(服务)或"funnel"(漏斗)。使用"serve"进行私有 tailnet 传递，仅当需要公共互联网入口时使用"funnel"。',
  "hooks.gmail.tailscale":
    "Tailscale 暴露配置块，用于通过启用时的服务/漏斗路由发布 Gmail 回调。在启用任何公共入口路径之前使用私有 tailnet 模式。",
  "hooks.gmail.tailscale.path":
    "启用时由 Tailscale 服务/漏斗发布的用于 Gmail 回调转发的路径。保持其与 Gmail 网钩配置对齐以便请求到达预期处理程序。",
  "hooks.gmail.tailscale.target":
    "Tailscale 服务/漏斗转发的本地服务目标(例如 http://127.0.0.1:8787)。使用明确的本地环回目标以避免模糊的路由。",
  "hooks.gmail.model":
    "邮箱自动化应使用专用模型行为时，Gmail 触发的运行的可选模型覆盖。保持取消设置以继承代理默认值，除非邮箱任务需要专业化。",
  "hooks.gmail.thinking":
    'Gmail 驱动的代理运行的思考工作量覆盖："off"(关闭)、"minimal"(最少)、"low"(低)、"medium"(中)或"high"(高)。对例程收件箱自动化保持适度默认值以控制成本和延迟。',
  "hooks.internal":
    "从模块路径加载的捆绑/自定义事件处理程序的内部网钩运行时设置。将其用于受信任的进程内自动化并保持处理程序加载紧密作用域。",
  "hooks.internal.enabled":
    "Enables processing for internal hooks and configured entries in the internal hook runtime. Keep disabled unless internal hooks are intentionally configured.",
  "hooks.internal.entries":
    "已配置的内部网钩条目记录，用于注册具体运行时处理程序和元数据。保持条目明确并版本化以便生产行为可审计。",
  "hooks.internal.load":
    "内部网钩加载程序设置，控制处理程序模块在启动时的发现位置。使用受限的加载根以减少意外的模块冲突或隐藏。",
  "hooks.internal.load.extraDirs":
    "除了默认加载路径之外搜索的内部网钩模块的其他目录。保持此功能最少且受控以减少意外的模块隐藏。",
  "hooks.internal.installs":
    "内部网钩模块的安装元数据，包括源和已解决的工件以用于可重复部署。将其用作操作谱系并避免手动漂移编辑。",
  messages:
    "消息格式化、确认、队列、去抖和状态反应行为，用于入站/出站聊天流。当频道响应性或消息 UX 需要调整时使用此部分。",
  "messages.messagePrefix":
    "在入站用户消息传递给代理运行时之前前置的前缀文本。谨慎使用此功能来获取频道上下文标记，并保持其在会话中的稳定性。",
  "messages.responsePrefix":
    "在发送到频道之前前置到出站助手回复的前缀文本。用于轻量级品牌/上下文标记并避免减少内容密度的长前缀。",
  "messages.groupChat":
    "群组消息处理控制，包括提及触发和历史记录窗口大小。保持提及模式窄范围以便群组频道不会在每条消息上触发。",
  "messages.groupChat.mentionPatterns":
    "Safe case-insensitive regex patterns used to detect explicit mentions/trigger phrases in group chats. Use precise patterns to reduce false positives in high-volume channels; invalid or unsafe nested-repetition patterns are ignored.",
  "messages.groupChat.historyLimit":
    "每转加载为群组会话上下文的最大先前群组消息数。使用较高的值来获得更丰富的连续性，或使用较低的值来加快和获得更便宜的响应。",
  "messages.queue":
    "入站消息队列策略，用于在处理轮次之前缓冲突发。为繁忙频道调整此选项，其中顺序处理或批处理行为很重要。",
  "messages.queue.mode":
    '队列行为模式："steer"(转向)、"followup"(跟进)、"collect"(收集)、"steer-backlog"(转向积压)、"steer+backlog"(转向+积压)、"queue"(队列)或"interrupt"(中断)。保持保守模式除非打算需要主动中断/积压语义。',
  "messages.queue.byChannel":
    "Per-channel queue mode overrides keyed by provider id (for example telegram, discord, slack). Use this when one channel’s traffic pattern needs different queue behavior than global defaults.",
  "messages.queue.debounceMs":
    "全局队列去抖动窗口(毫秒)，然后再处理缓冲的入站消息。使用较高的值来合并快速突发，或使用较低的值来减少响应延迟。",
  "messages.queue.debounceMsByChannel":
    "按提供商 id 关键的队列行为的每频道去抖动覆盖。使用此为不同的聊天表面使用不同的步调独立调整突发处理。",
  "messages.queue.cap":
    "在应用删除策略之前保留的最大排队入站项目数。在嘈杂频道中保持上限范围内，以便内存使用保持可预测。",
  "messages.queue.drop":
    '超过队列上限时的删除策略："old"(旧的)、"new"(新的)或"summarize"(总结)。保留意图时使用总结，或当首选确定性删除时使用旧的/新的。',
  "messages.inbound":
    "直接入站去抖动设置，在队列/轮次处理开始之前使用。为来自同一发件人的提供商特定快速消息突发配置此选项。",
  "messages.inbound.byChannel":
    "按提供商 id(毫秒)关键的每频道入站去抖动覆盖。在某些提供商比其他提供商更积极地发送消息片段时使用此功能。",
  "messages.removeAckAfterReply":
    "在启用时在最终回复传递后移除确认反应。在频道中保持启用状态，其中持久 ack 反应创建混乱以获得更清洁的 UX。",
  "messages.tts":
    "Text-to-speech policy for reading agent replies aloud on supported voice or audio surfaces. Keep disabled unless voice playback is part of your operator/user workflow.",
  "messages.tts.providers":
    "Provider-specific TTS settings keyed by speech provider id. Use this instead of bundled provider-specific top-level keys so speech plugins stay decoupled from core config schema.",
  "messages.tts.providers.*":
    "Provider-specific TTS configuration for one speech provider id. Keep fields scoped to the plugin that owns that provider.",
  "messages.tts.providers.*.apiKey":
    "Provider API key used by that speech provider when its plugin requires authenticated TTS access.", // pragma: allowlist secret
  channels:
    "Channel provider configurations plus shared defaults that control access policies, heartbeat visibility, and per-surface behavior. Keep defaults centralized and override per provider only where required.",
  "channels.mattermost":
    "Mattermost channel provider configuration for bot credentials, base URL, and message trigger modes. Keep mention/trigger rules strict in high-volume team channels.",
  "channels.defaults":
    "应用于未设置特定于提供商的设置的提供商时的默认频道行为。使用此在按提供商调整之前强制执行一致的基线策略。",
  "channels.defaults.groupPolicy":
    'Default group policy across channels: "open", "disabled", or "allowlist". Keep "allowlist" for safer production setups unless broad group participation is intentional.',
  "channels.defaults.contextVisibility":
    'Default supplemental context visibility for fetched quote/thread/history content: "all" (keep all context), "allowlist" (only allowlisted senders), or "allowlist_quote" (allowlist + keep explicit quotes).',
  "channels.defaults.heartbeat":
    "默认心跳可见性设置，用于提供商/频道发出的状态消息。全局调整此选项以减少嘈杂的健康状态更新，同时保持警报可见。",
  "channels.defaults.heartbeat.showOk":
    "在频道状态输出中为真时显示健康的/OK 心跳状态条目。在嘈杂的环境中保持为假，仅当操作员需要明确的健康确认时启用。",
  "channels.defaults.heartbeat.showAlerts":
    "当为真时显示已降级/错误心跳警报，以便操作员频道及时表现问题。在生产中保持启用状态，以便破损的频道状态是可见的。",
  "channels.defaults.heartbeat.useIndicator":
    "Enables concise indicator-style heartbeat rendering instead of verbose status text where supported. Use indicator mode for dense dashboards with many active channels.",
  "agents.defaults.heartbeat.includeSystemPromptSection":
    "Includes the default agent's ## Heartbeats system prompt section when true. Turn this off to keep heartbeat runtime behavior while omitting the heartbeat prompt instructions from the agent system prompt.",
  "agents.list.*.heartbeat.includeSystemPromptSection":
    "Per-agent override for whether the default agent's ## Heartbeats system prompt section is injected. Use false to keep heartbeat runtime behavior but omit the heartbeat prompt instructions from that agent's system prompt.",
  "agents.defaults.heartbeat.directPolicy":
    '控制心跳传递是否可能针对直接/DM 聊天："allow"(允许)(默认)允许 DM 传递，"block"(阻止)禁止直接目标发送。',
  "agents.list.*.heartbeat.directPolicy":
    'Per-agent override for heartbeat direct/DM delivery policy; use "block" for agents that should only send heartbeat alerts to non-DM destinations.',
  "channels.mattermost.configWrites":
    "Allow Mattermost to write config in response to channel events/commands (default: true).",
  "channels.modelByChannel":
    "Map provider -> channel id -> model override (values are provider/model or aliases).",
  "messages.suppressToolErrors":
    "当为真时，禁止向用户显示 ⚠️ 工具错误警告。代理已在上下文中看到错误并可以重试。默认值：false。",
  "messages.ackReaction": "用于确认入站消息的表情符号反应(空值禁用)。",
  "messages.ackReactionScope":
    '何时发送 ack 反应("group-mentions"(群组提及)、"group-all"(群组全部)、"direct"(直接)、"all"(全部)、"off"(关闭)、"none"(无))。"off"/"none"完全禁用 ack 反应。',
  "messages.statusReactions":
    "生命周期状态反应，在代理取得进展时更新触发消息上的表情符号(queued(排队) → thinking(思考) → tool(工具) → done(完成)/error(错误))。",
  "messages.statusReactions.enabled":
    "Enable lifecycle status reactions on supported channels. Slack and Discord treat unset as enabled when ack reactions are active; Telegram requires this to be true before lifecycle reactions are used.",
  "messages.statusReactions.emojis":
    "Override default status reaction emojis. Keys: thinking, compacting, tool, coding, web, done, error, stallSoft, stallHard. Must be valid Telegram reaction emojis.",
  "messages.statusReactions.timing":
    "Override default timing. Keys: debounceMs (700), stallSoftMs (25000), stallHardMs (60000), doneHoldMs (1500), errorHoldMs (2500).",
  "messages.inbound.debounceMs":
    "Debounce window (ms) for batching rapid inbound messages from the same sender (0 to disable).",
};
