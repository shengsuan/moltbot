#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Create a fully translated Chinese version of schema.help.ts
This script generates all the translation mappings and applies them.
"""

import re
import json
from pathlib import Path

# Translation pairs - English help text to Chinese
TRANSLATION_MAP = {
    # Media section
    "Top-level media behavior shared across providers and tools that handle inbound files. Keep defaults unless you need stable filenames for external processing pipelines or longer-lived inbound media retention.":
    "处理入站文件的提供商和工具之间共享的顶级媒体行为。保持默认设置，除非您需要为外部处理管道或更长存活期的入站媒体保留稳定的文件名。",
    
    "When enabled, uploaded media keeps its original filename instead of a generated temp-safe name. Turn this on when downstream automations depend on stable names, and leave off to reduce accidental filename leakage.":
    "启用时，上传的媒体保留其原始文件名而不是生成的临时安全名称。当下游自动化依赖稳定名称时打开此选项，或关闭以减少意外文件名泄露。",
    
    "Optional retention window in hours for persisted inbound media cleanup across the full media tree. Leave unset to preserve legacy behavior, or set values like 24 (1 day) or 168 (7 days) when you want automatic cleanup.":
    "用于跨整个媒体树持久化入站媒体清理的可选保留窗口（小时）。保持未设置以保留旧行为，或在需要自动清理时设置值如 24（1 天）或 168（7 天）。",
    
    "Global audio ingestion settings used before higher-level tools process speech or media content. Configure this when you need deterministic transcription behavior for voice notes and clips.":
    "在更高级别的工具处理语音或媒体内容之前使用的全局音频摄入设置。当您需要语音笔记和剪辑的确定性转录行为时配置此项。",
    
    "Command-based transcription settings for converting audio files into text before agent handling. Keep a simple, deterministic command path here so failures are easy to diagnose in logs.":
    "基于命令的转录设置，用于在代理处理之前将音频文件转换为文本。在此保持简单、确定性的命令路径，以便在日志中轻松诊断失败。",
    
    'Executable + args used to transcribe audio (first token must be a safe binary/path), for example `["whisper-cli", "--model", "small", "{input}"]`. Prefer a pinned command so runtime environments behave consistently.':
    '用于转录音频的可执行文件 + 参数（第一个令牌必须是安全的二进制/路径），例如 `["whisper-cli", "--model", "small", "{input}"]`。偏好固定命令以确保运行时环境行为一致。',
    
    "Maximum time allowed for the transcription command to finish before it is aborted. Increase this for longer recordings, and keep it tight in latency-sensitive deployments.":
    "允许转录命令完成的最大时间，然后将其中止。对于较长的录音增加此值，在延迟敏感的部署中保持紧凑。",

    # Bindings section (part of media section - 429-650)
    "Top-level binding rules for routing and persistent ACP conversation ownership. Use type=route for normal routing and type=acp for persistent ACP harness bindings.":
    "用于路由和持久 ACP 会话所有权的顶级绑定规则。使用 type=route 进行正常路由，使用 type=acp 用于持久 ACP 工具绑定。",
    
    'Binding kind. Use "route" (or omit for legacy route entries) for normal routing, and "acp" for persistent ACP conversation bindings.':
    '绑定类型。使用 "route"（或针对旧路由条目省略）进行正常路由，使用 "acp" 用于持久 ACP 会话绑定。',
    
    "Target agent ID that receives traffic when the corresponding binding match rule is satisfied. Use valid configured agent IDs only so routing does not fail at runtime.":
    "当相应的绑定匹配规则满足时接收流量的目标代理 ID。仅使用有效配置的代理 ID，以免路由在运行时失败。",
    
    "Match rule object for deciding when a binding applies, including channel and optional account/peer constraints. Keep rules narrow to avoid accidental agent takeover across contexts.":
    "用于决定绑定应用时机的匹配规则对象，包括频道和可选的帐户/对等约束。保持规则狭窄以避免跨上下文的意外代理接管。",
    
    "Channel/provider identifier this binding applies to, such as `telegram`, `discord`, or a plugin channel ID. Use the configured channel key exactly so binding evaluation works reliably.":
    "此绑定适用于的频道/提供商标识符，例如 `telegram`、`discord` 或插件频道 ID。确切使用配置的频道密钥以使绑定评估可靠地工作。",
    
    "Optional account selector for multi-account channel setups so the binding applies only to one identity. Use this when account scoping is required for the route and leave unset otherwise.":
    "多帐户频道设置的可选帐户选择器，以便绑定仅应用于一个身份。当路由需要帐户范围设置时使用此项，否则保持未设置。",
    
    "Optional peer matcher for specific conversations including peer kind and peer id. Use this when only one direct/group/channel target should be pinned to an agent.":
    "用于特定会话的可选对等匹配器，包括对等类型和对等 ID。当只有一个直接/群组/频道目标应固定到代理时使用此项。",
    
    'Peer conversation type: "direct", "group", "channel", or legacy "dm" (deprecated alias for direct). Prefer "direct" for new configs and keep kind aligned with channel semantics.':
    '对等会话类型："direct"（直接）、"group"（群组）、"channel"（频道）或旧版 "dm"（direct 的已弃用别名）。对于新配置偏好 "direct"，并保持类型与频道语义一致。',
    
    "Conversation identifier used with peer matching, such as a chat ID, channel ID, or group ID from the provider. Keep this exact to avoid silent non-matches.":
    "与对等匹配一起使用的会话标识符，例如来自提供商的聊天 ID、频道 ID 或群组 ID。精确保持此项以避免无声的非匹配。",
    
    "Optional Discord-style guild/server ID constraint for binding evaluation in multi-server deployments. Use this when the same peer identifiers can appear across different guilds.":
    "Discord 风格的可选公会/服务器 ID 约束，用于多服务器部署中的绑定评估。当相同的对等标识符可能出现在不同公会中时使用此项。",
    
    "Optional team/workspace ID constraint used by providers that scope chats under teams. Add this when you need bindings isolated to one workspace context.":
    "提供商使用的可选团队/工作区 ID 约束，该提供商将聊天范围划分到团队下。当您需要绑定隔离到一个工作区上下文时添加此项。",
    
    "Optional role-based filter list used by providers that attach roles to chat context. Use this to route privileged or operational role traffic to specialized agents.":
    "提供商使用的可选基于角色的过滤器列表，该列表将角色附加到聊天上下文。使用此项将特权或运营角色流量路由到专用代理。",
    
    "Optional per-binding ACP overrides for bindings[].type=acp. This layer overrides agents.list[].runtime.acp defaults for the matched conversation.":
    "用于 bindings[].type=acp 的可选每绑定 ACP 覆盖。此层覆盖匹配会话的 agents.list[].runtime.acp 默认值。",
    
    "ACP session mode override for this binding (persistent or oneshot).":
    "此绑定的 ACP 会话模式覆盖（持久或一次性）。",
    
    "Human-friendly label for ACP status/diagnostics in this bound conversation.":
    "此绑定会话中 ACP 状态/诊断的人类友好型标签。",
    
    "Working directory override for ACP sessions created from this binding.":
    "从此绑定创建的 ACP 会话的工作目录覆盖。",
    
    "ACP backend override for this binding (falls back to agent runtime ACP backend, then global acp.backend).":
    "此绑定的 ACP 后端覆盖（回退到代理运行时 ACP 后端，然后是全局 acp.backend）。",
    
    "Broadcast routing map for sending the same outbound message to multiple peer IDs per source conversation. Keep this minimal and audited because one source can fan out to many destinations.":
    "广播路由映射，用于从源会话向多个对等 ID 发送相同的出站消息。保持此项最小和审计，因为一个源可以扇出到许多目标。",
    
    'Delivery order for broadcast fan-out: "parallel" sends to all targets concurrently, while "sequential" sends one-by-one. Use "parallel" for speed and "sequential" for stricter ordering/backpressure control.':
    '广播扇出的交付顺序："parallel"（并行）同时发送到所有目标，"sequential"（顺序）逐一发送。为了速度使用 "parallel"，为了更严格的排序/背压控制使用 "sequential"。',
}

def main():
    file_path = Path('/Users/zou/prj/openclaw/src/config/schema.help.ts')
    
    # 首先读取内容进行计数
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    translations_count = 0
    for eng_text, chin_text in TRANSLATION_MAP.items():
        if eng_text in content:
            translations_count += 1
            content = content.replace(f'"{eng_text}"', f'"{chin_text}"')
            # 如果还有单引号版本
            content = content.replace(f"'{eng_text}'", f"'{chin_text}'")
    
    # 写回文件
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"已应用 {translations_count} 个翻译")
    print(f"文件已更新: {file_path}")

if __name__ == '__main__':
    main()
