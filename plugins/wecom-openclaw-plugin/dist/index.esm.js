import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { dirname, resolve } from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import * as os$1 from 'os';
import * as path$1 from 'path';
import { generateReqId, WSClient, WSAuthFailureError, WSReconnectExhaustedError } from '@wecom/aibot-node-sdk';
import { fileTypeFromBuffer } from 'file-type';
import { readFileSync } from 'node:fs';

/**
 * openclaw plugin-sdk 高版本方法兼容层
 *
 * 部分方法（如 loadOutboundMediaFromUrl、detectMime、getDefaultMediaLocalRoots）
 * 仅在较新版本的 openclaw plugin-sdk 中才导出。
 *
 * 本模块在加载时一次性探测 SDK 导出，存在则直接 re-export SDK 版本，
 * 不存在则导出 fallback 实现。其他模块统一从本文件导入，无需关心底层兼容细节。
 */
const DEFAULT_ACCOUNT_ID = "default";
const _sdkReady = import('openclaw/plugin-sdk/core')
    .then((sdk) => {
    const exports$1 = {};
    if (typeof sdk.loadOutboundMediaFromUrl === "function") {
        exports$1.loadOutboundMediaFromUrl = sdk.loadOutboundMediaFromUrl;
    }
    if (typeof sdk.detectMime === "function") {
        exports$1.detectMime = sdk.detectMime;
    }
    if (typeof sdk.getDefaultMediaLocalRoots === "function") {
        exports$1.getDefaultMediaLocalRoots = sdk.getDefaultMediaLocalRoots;
    }
    if (typeof sdk.addWildcardAllowFrom === "function") {
        exports$1.addWildcardAllowFrom = sdk.addWildcardAllowFrom;
    }
    return exports$1;
})
    .catch(() => {
    // openclaw/plugin-sdk 不可用或版本过低，全部使用 fallback
    return {};
});
// 同时尝试从 plugin-sdk/setup 模块探测（缓存同步可用的引用）
let _cachedAddWildcardAllowFrom;
import('openclaw/plugin-sdk/setup')
    .then((sdk) => {
    if (typeof sdk.addWildcardAllowFrom === "function") {
        _cachedAddWildcardAllowFrom = sdk.addWildcardAllowFrom;
    }
})
    .catch(() => { });
// 同时也从 core 模块的结果中缓存
_sdkReady.then((sdk) => {
    if (!_cachedAddWildcardAllowFrom && sdk.addWildcardAllowFrom) {
        _cachedAddWildcardAllowFrom = sdk.addWildcardAllowFrom;
    }
});
// ============================================================================
// detectMime —— 检测 MIME 类型
// ============================================================================
const MIME_BY_EXT = {
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ogg": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/x-m4a",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".pdf": "application/pdf",
    ".json": "application/json",
    ".zip": "application/zip",
    ".gz": "application/gzip",
    ".tar": "application/x-tar",
    ".7z": "application/x-7z-compressed",
    ".rar": "application/vnd.rar",
    ".doc": "application/msword",
    ".xls": "application/vnd.ms-excel",
    ".ppt": "application/vnd.ms-powerpoint",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".amr": "audio/amr",
    ".aac": "audio/aac",
    ".wav": "audio/wav",
    ".webm": "video/webm",
    ".avi": "video/x-msvideo",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
};
/** 通过 buffer 魔术字节嗅探 MIME 类型（动态导入 file-type，不强依赖） */
async function sniffMimeFromBuffer(buffer) {
    try {
        const { fileTypeFromBuffer } = await import('file-type');
        const type = await fileTypeFromBuffer(buffer);
        return type?.mime ?? undefined;
    }
    catch {
        return undefined;
    }
}
/** fallback 版 detectMime，参考 weclaw/src/media/mime.ts */
async function detectMimeFallback(opts) {
    const ext = opts.filePath ? path.extname(opts.filePath).toLowerCase() : undefined;
    const extMime = ext ? MIME_BY_EXT[ext] : undefined;
    const sniffed = opts.buffer ? await sniffMimeFromBuffer(opts.buffer) : undefined;
    const isGeneric = (m) => !m || m === "application/octet-stream" || m === "application/zip";
    if (sniffed && (!isGeneric(sniffed) || !extMime)) {
        return sniffed;
    }
    if (extMime) {
        return extMime;
    }
    const headerMime = opts.headerMime?.split(";")?.[0]?.trim().toLowerCase();
    if (headerMime && !isGeneric(headerMime)) {
        return headerMime;
    }
    if (sniffed) {
        return sniffed;
    }
    if (headerMime) {
        return headerMime;
    }
    return undefined;
}
/**
 * 检测 MIME 类型（兼容入口）
 *
 * 支持两种调用签名以兼容不同使用场景：
 * - detectMime(buffer)           → 旧式调用
 * - detectMime({ buffer, headerMime, filePath }) → 完整参数
 *
 * 优先使用 SDK 版本，不可用时使用 fallback。
 */
async function detectMime(bufferOrOpts) {
    const sdk = await _sdkReady;
    const opts = Buffer.isBuffer(bufferOrOpts)
        ? { buffer: bufferOrOpts }
        : bufferOrOpts;
    if (sdk.detectMime) {
        try {
            return await sdk.detectMime(opts);
        }
        catch {
            // SDK detectMime 异常，降级到 fallback
        }
    }
    return detectMimeFallback(opts);
}
// ============================================================================
// loadOutboundMediaFromUrl —— 从 URL/路径加载媒体文件
// ============================================================================
/** 安全的本地文件路径校验，参考 weclaw/src/web/media.ts */
async function assertLocalMediaAllowed(mediaPath, localRoots) {
    if (!localRoots || localRoots.length === 0) {
        throw new Error(`Local media path is not under an allowed directory: ${mediaPath}`);
    }
    let resolved;
    try {
        resolved = await fs.realpath(mediaPath);
    }
    catch {
        resolved = path.resolve(mediaPath);
    }
    for (const root of localRoots) {
        let resolvedRoot;
        try {
            resolvedRoot = await fs.realpath(root);
        }
        catch {
            resolvedRoot = path.resolve(root);
        }
        if (resolvedRoot === path.parse(resolvedRoot).root) {
            continue;
        }
        if (resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep)) {
            return;
        }
    }
    throw new Error(`Local media path is not under an allowed directory: ${mediaPath}`);
}
/** 从远程 URL 获取媒体 */
async function fetchRemoteMedia(url, maxBytes) {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
        throw new Error(`Failed to fetch media from ${url}: HTTP ${res.status} ${res.statusText}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (maxBytes && buffer.length > maxBytes) {
        throw new Error(`Media from ${url} exceeds max size (${buffer.length} > ${maxBytes})`);
    }
    const headerMime = res.headers.get("content-type")?.split(";")?.[0]?.trim();
    let fileName;
    const disposition = res.headers.get("content-disposition");
    if (disposition) {
        const match = /filename\*?\s*=\s*(?:UTF-8''|")?([^";]+)/i.exec(disposition);
        if (match?.[1]) {
            try {
                fileName = path.basename(decodeURIComponent(match[1].replace(/["']/g, "").trim()));
            }
            catch {
                fileName = path.basename(match[1].replace(/["']/g, "").trim());
            }
        }
    }
    if (!fileName) {
        try {
            const parsed = new URL(url);
            const base = path.basename(parsed.pathname);
            if (base && base.includes("."))
                fileName = base;
        }
        catch { /* ignore */ }
    }
    const contentType = await detectMimeFallback({ buffer, headerMime, filePath: fileName ?? url });
    return { buffer, contentType, fileName };
}
/** 展开 ~ 为用户主目录 */
function resolveUserPath(p) {
    if (p.startsWith("~")) {
        return path.join(os.homedir(), p.slice(1));
    }
    return p;
}
/** fallback 版 loadOutboundMediaFromUrl，参考 weclaw/src/web/media.ts */
async function loadOutboundMediaFromUrlFallback(mediaUrl, options = {}) {
    const { maxBytes, mediaLocalRoots } = options;
    // 去除 MEDIA: 前缀
    mediaUrl = mediaUrl.replace(/^\s*MEDIA\s*:\s*/i, "");
    // 处理 file:// URL
    if (mediaUrl.startsWith("file://")) {
        try {
            mediaUrl = fileURLToPath(mediaUrl);
        }
        catch {
            throw new Error(`Invalid file:// URL: ${mediaUrl}`);
        }
    }
    // 远程 URL
    if (/^https?:\/\//i.test(mediaUrl)) {
        const fetched = await fetchRemoteMedia(mediaUrl, maxBytes);
        return {
            buffer: fetched.buffer,
            contentType: fetched.contentType,
            fileName: fetched.fileName,
        };
    }
    // 展开 ~ 路径
    if (mediaUrl.startsWith("~")) {
        mediaUrl = resolveUserPath(mediaUrl);
    }
    // 本地文件：安全校验
    await assertLocalMediaAllowed(mediaUrl, mediaLocalRoots);
    // 读取本地文件
    let data;
    try {
        const stat = await fs.stat(mediaUrl);
        if (!stat.isFile()) {
            throw new Error(`Local media path is not a file: ${mediaUrl}`);
        }
        data = await fs.readFile(mediaUrl);
    }
    catch (err) {
        if (err?.code === "ENOENT") {
            throw new Error(`Local media file not found: ${mediaUrl}`);
        }
        throw err;
    }
    if (maxBytes && data.length > maxBytes) {
        throw new Error(`Local media exceeds max size (${data.length} > ${maxBytes})`);
    }
    const mime = await detectMimeFallback({ buffer: data, filePath: mediaUrl });
    const fileName = path.basename(mediaUrl) || undefined;
    return {
        buffer: data,
        contentType: mime,
        fileName,
    };
}
/**
 * 从 URL 或本地路径加载媒体文件（兼容入口）
 *
 * 优先使用 SDK 版本，不可用时使用 fallback。
 * SDK 版本抛出的业务异常（如 LocalMediaAccessError）会直接透传。
 */
async function loadOutboundMediaFromUrl(mediaUrl, options = {}) {
    const sdk = await _sdkReady;
    if (sdk.loadOutboundMediaFromUrl) {
        return sdk.loadOutboundMediaFromUrl(mediaUrl, options);
    }
    return loadOutboundMediaFromUrlFallback(mediaUrl, options);
}
// ============================================================================
// addWildcardAllowFrom —— 向 allowFrom 列表添加通配符 "*"
// ============================================================================
/** fallback 版 addWildcardAllowFrom：确保列表中包含 "*" 通配符 */
function addWildcardAllowFromFallback(allowFrom) {
    if (allowFrom.includes("*")) {
        return allowFrom;
    }
    return [...allowFrom, "*"];
}
/**
 * 向 allowFrom 列表添加通配符 "*"（兼容入口）
 *
 * 当 dmPolicy 为 "open" 时，需要确保 allowFrom 中包含 "*" 以允许所有来源。
 * 优先使用 SDK 版本（plugin-sdk/setup 或 plugin-sdk/core），不可用时使用 fallback。
 *
 * 注意：此函数为同步函数，与 SDK 原始签名一致。
 * SDK 引用在模块加载时异步探测并缓存，调用时同步读取缓存。
 */
function addWildcardAllowFrom(allowFrom) {
    if (_cachedAddWildcardAllowFrom) {
        try {
            return _cachedAddWildcardAllowFrom(allowFrom);
        }
        catch {
            // SDK 版本异常，降级到 fallback
        }
    }
    return addWildcardAllowFromFallback(allowFrom);
}
// ============================================================================
// getDefaultMediaLocalRoots —— 获取默认媒体本地路径白名单
// ============================================================================
/** 解析 openclaw 状态目录 */
function resolveStateDir$1() {
    const stateOverride = process.env.OPENCLAW_STATE_DIR?.trim() || process.env.CLAWDBOT_STATE_DIR?.trim();
    if (stateOverride)
        return stateOverride;
    return path.join(os.homedir(), ".openclaw");
}
/**
 * 获取默认媒体本地路径白名单（兼容入口）
 *
 * 优先使用 SDK 版本，不可用时手动构建白名单（与 weclaw/src/media/local-roots.ts 逻辑一致）。
 */
async function getDefaultMediaLocalRoots() {
    const sdk = await _sdkReady;
    if (sdk.getDefaultMediaLocalRoots) {
        try {
            return sdk.getDefaultMediaLocalRoots();
        }
        catch {
            // SDK 版本异常，降级到 fallback
        }
    }
    // fallback: 手动构建默认白名单
    const stateDir = path.resolve(resolveStateDir$1());
    return [
        path.join(stateDir, "media"),
        path.join(stateDir, "agents"),
        path.join(stateDir, "workspace"),
        path.join(stateDir, "sandboxes"),
    ];
}
function emptyPluginConfigSchema() {
    return {
        type: 'object',
        additionalProperties: false,
        properties: {},
    };
}
/**
 * 格式化配对审批提示信息（参考 moltbot 实现）
 * @param channelId 频道ID
 * @returns 配对审批提示字符串
 */
function formatPairingApproveHint(channelId) {
    const listCmd = `openclaw pairing list ${channelId}`;
    const approveCmd = `openclaw pairing approve ${channelId} <code>`;
    return `向 ${channelId} 机器人发送消息以完成配对审批（命令行：${listCmd} / ${approveCmd}）`;
}

let runtime = null;
function setWeComRuntime(r) {
    runtime = r;
}
function getWeComRuntime() {
    if (!runtime) {
        throw new Error("WeCom runtime not initialized - plugin not registered");
    }
    return runtime;
}

/**
 * 企业微信渠道常量定义
 */
/**
 * 企业微信渠道 ID
 */
const CHANNEL_ID = "wecom";
/**
 * 企业微信 WebSocket 命令枚举
 */
var WeComCommand;
(function (WeComCommand) {
    /** 认证订阅 */
    WeComCommand["SUBSCRIBE"] = "aibot_subscribe";
    /** 心跳 */
    WeComCommand["PING"] = "ping";
    /** 企业微信推送消息 */
    WeComCommand["AIBOT_CALLBACK"] = "aibot_callback";
    /** clawdbot 响应消息 */
    WeComCommand["AIBOT_RESPONSE"] = "aibot_response";
})(WeComCommand || (WeComCommand = {}));
// ============================================================================
// 超时和重试配置
// ============================================================================
/** 图片下载超时时间（毫秒） */
const IMAGE_DOWNLOAD_TIMEOUT_MS = 30000;
/** 文件下载超时时间（毫秒） */
const FILE_DOWNLOAD_TIMEOUT_MS = 60000;
/** 消息发送超时时间（毫秒） */
const REPLY_SEND_TIMEOUT_MS = 15000;
/** WebSocket 心跳间隔（毫秒） */
const WS_HEARTBEAT_INTERVAL_MS = 30000;
/** WebSocket 连接断开时的最大重连次数 */
const WS_MAX_RECONNECT_ATTEMPTS = 10;
/** WebSocket 认证失败时的最大重试次数 */
const WS_MAX_AUTH_FAILURE_ATTEMPTS = 5;
// ============================================================================
// 消息状态管理配置
// ============================================================================
/** messageStates Map 条目的最大 TTL（毫秒），防止内存泄漏 */
const MESSAGE_STATE_TTL_MS = 10 * 60 * 1000;
/** messageStates Map 清理间隔（毫秒） */
const MESSAGE_STATE_CLEANUP_INTERVAL_MS = 60000;
/** messageStates Map 最大条目数 */
const MESSAGE_STATE_MAX_SIZE = 500;
// ============================================================================
// 消息模板
// ============================================================================
/** "思考中"流式消息占位内容 */
const THINKING_MESSAGE = "<think></think>";
/** 仅包含图片时的消息占位符 */
const MEDIA_IMAGE_PLACEHOLDER = "<media:image>";
/** 仅包含文件时的消息占位符 */
const MEDIA_DOCUMENT_PLACEHOLDER = "<media:document>";
// ============================================================================
// 默认值
// ============================================================================
// ============================================================================
// MCP 配置
// ============================================================================
/** 获取 MCP 配置的 WebSocket 命令 */
const MCP_GET_CONFIG_CMD = "aibot_get_mcp_config";
/** MCP 配置拉取超时时间（毫秒） */
const MCP_CONFIG_FETCH_TIMEOUT_MS = 15000;
// ============================================================================
// 默认值
// ============================================================================
/** 默认媒体大小上限（MB） */
const DEFAULT_MEDIA_MAX_MB = 5;
/** 文本分块大小上限 */
const TEXT_CHUNK_LIMIT = 4000;
// ============================================================================
// 媒体上传相关常量
// ============================================================================
/** 图片大小上限（字节）：10MB */
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
/** 视频大小上限（字节）：10MB */
const VIDEO_MAX_BYTES = 10 * 1024 * 1024;
/** 语音大小上限（字节）：2MB */
const VOICE_MAX_BYTES = 2 * 1024 * 1024;
/** 文件大小上限（字节）：20MB */
const FILE_MAX_BYTES = 20 * 1024 * 1024;
/** 文件绝对上限（字节）：超过此值无法发送，等于 FILE_MAX_BYTES */
const ABSOLUTE_MAX_BYTES = FILE_MAX_BYTES;
// ============================================================================
// 事件/命令名称常量
// ============================================================================
/** 版本检查事件名称（SDK 事件监听用） */
const EVENT_ENTER_CHECK_UPDATE = "event.enter_check_update";
/** 版本检查事件回复命令名称 */
const CMD_ENTER_EVENT_REPLY = "ww_ai_robot_enter_event";
// ============================================================================
// SDK 连接配置
// ============================================================================
/** WSClient scene 参数：企微 OpenClaw 场景 */
const SCENE_WECOM_OPENCLAW = 1;
// ============================================================================
// 模板卡片配置
// ============================================================================
/** 合法的模板卡片 card_type 列表 */
const VALID_CARD_TYPES = [
    "text_notice",
    "news_notice",
    "button_interaction",
    "vote_interaction",
    "multiple_interaction",
];

/**
 * 企业微信消息内容解析模块
 *
 * 负责从 WsFrame 中提取文本、图片、引用等内容
 */
// ============================================================================
// 解析函数
// ============================================================================
/**
 * 将模板卡片事件回调格式化为可继续路由给大模型的文本。
 *
 * 这样后续 Agent 可以直接从 question_key / option_id 中理解用户的真实选择。
 */
function buildTemplateCardEventText(body) {
    const templateCardEvent = body.event?.template_card_event;
    if (body.msgtype !== "event" ||
        body.event?.eventtype !== "template_card_event" ||
        !templateCardEvent) {
        return undefined;
    }
    const selectedItems = templateCardEvent.selected_items?.selected_item ?? [];
    const selectedLines = selectedItems.map((item) => {
        const questionKey = item.question_key?.trim() || "unknown_question";
        const optionIds = item.option_ids?.option_id?.filter(Boolean) ?? [];
        return `- ${questionKey}: ${optionIds.length > 0 ? optionIds.join(", ") : "(未选择)"}`;
    });
    const senderUserId = body.from?.userid || "";
    const senderCorpId = body.from?.corpid || "";
    const chatId = body.chatid || senderUserId;
    return [
        "[企业微信模板卡片回调]",
        `event_type(事件类型): template_card_event`,
        body.msgid ? `msgid(消息 id): ${body.msgid}` : undefined,
        body.aibotid ? `aibotid(机器人 id): ${body.aibotid}` : undefined,
        body.chattype ? `chat_type(会话类型): ${body.chattype}` : undefined,
        chatId ? `chat_id(会话 id): ${chatId}` : undefined,
        senderCorpId ? `from.corpid(企业 id): ${senderCorpId}` : undefined,
        senderUserId ? `from.userid(发送人 id): ${senderUserId}` : undefined,
        senderUserId ? `sender_userid(发送人 id): ${senderUserId}` : undefined,
        templateCardEvent.card_type ? `card_type(卡片类型): ${templateCardEvent.card_type}` : undefined,
        templateCardEvent.event_key ? `event_key(事件 key): ${templateCardEvent.event_key}` : undefined,
        templateCardEvent.task_id ? `task_id(任务 id): ${templateCardEvent.task_id}` : undefined,
        selectedLines.length > 0 ? "selected_items(选择项):" : "selected_items(选择项): []",
        ...selectedLines,
    ]
        .filter((line) => Boolean(line))
        .join("\n");
}
/**
 * 解析消息内容（支持单条消息、图文混排、事件回调和引用消息）
 * @returns 提取的文本数组、图片URL数组和引用消息内容
 */
function parseMessageContent(body) {
    const textParts = [];
    const imageUrls = [];
    const imageAesKeys = new Map();
    const fileUrls = [];
    const fileAesKeys = new Map();
    let quoteContent;
    // 处理模板卡片事件回调
    if (body.msgtype === "event") {
        const eventText = buildTemplateCardEventText(body);
        if (eventText) {
            textParts.push(eventText);
        }
        return { textParts, imageUrls, imageAesKeys, fileUrls, fileAesKeys, quoteContent };
    }
    // 处理图文混排消息
    if (body.msgtype === "mixed" && body.mixed?.msg_item) {
        for (const item of body.mixed.msg_item) {
            if (item.msgtype === "text" && item.text?.content) {
                textParts.push(item.text.content);
            }
            else if (item.msgtype === "image" && item.image?.url) {
                imageUrls.push(item.image.url);
                if (item.image.aeskey) {
                    imageAesKeys.set(item.image.url, item.image.aeskey);
                }
            }
        }
    }
    else {
        // 处理单条消息
        if (body.text?.content) {
            textParts.push(body.text.content);
        }
        // 处理语音消息（语音转文字后的文本内容）
        if (body.msgtype === "voice" && body.voice?.content) {
            textParts.push(body.voice.content);
        }
        if (body.image?.url) {
            imageUrls.push(body.image.url);
            if (body.image.aeskey) {
                imageAesKeys.set(body.image.url, body.image.aeskey);
            }
        }
        // 处理文件消息
        if (body.msgtype === "file" && body.file?.url) {
            fileUrls.push(body.file.url);
            if (body.file.aeskey) {
                fileAesKeys.set(body.file.url, body.file.aeskey);
            }
        }
    }
    // 处理引用消息
    if (body.quote) {
        if (body.quote.msgtype === "text" && body.quote.text?.content) {
            quoteContent = body.quote.text.content;
        }
        else if (body.quote.msgtype === "voice" && body.quote.voice?.content) {
            quoteContent = body.quote.voice.content;
        }
        else if (body.quote.msgtype === "image" && body.quote.image?.url) {
            // 引用的图片消息：将图片 URL 加入下载列表
            imageUrls.push(body.quote.image.url);
            if (body.quote.image.aeskey) {
                imageAesKeys.set(body.quote.image.url, body.quote.image.aeskey);
            }
        }
        else if (body.quote.msgtype === "file" && body.quote.file?.url) {
            // 引用的文件消息：将文件 URL 加入下载列表
            fileUrls.push(body.quote.file.url);
            if (body.quote.file.aeskey) {
                fileAesKeys.set(body.quote.file.url, body.quote.file.aeskey);
            }
        }
    }
    return { textParts, imageUrls, imageAesKeys, fileUrls, fileAesKeys, quoteContent };
}

/**
 * 超时控制工具模块
 *
 * 为异步操作提供统一的超时保护机制
 */
/**
 * 为 Promise 添加超时保护
 *
 * @param promise - 原始 Promise
 * @param timeoutMs - 超时时间（毫秒）
 * @param message - 超时错误消息
 * @returns 带超时保护的 Promise
 */
function withTimeout(promise, timeoutMs, message) {
    if (timeoutMs <= 0 || !Number.isFinite(timeoutMs)) {
        return promise;
    }
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new TimeoutError(message ?? `Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
}
/**
 * 超时错误类型
 */
class TimeoutError extends Error {
    constructor(message) {
        super(message);
        this.name = "TimeoutError";
    }
}

/**
 * 企业微信消息发送模块
 *
 * 负责通过 WSClient 发送回复消息，包含超时保护
 */
// ============================================================================
// 流式过期错误（errcode 846608）
// ============================================================================
/** 流式回复超时错误码（>6分钟未更新，服务端拒绝继续流式更新） */
const STREAM_EXPIRED_ERRCODE = 846608;
/**
 * 流式回复过期错误
 * 当服务端返回 errcode=846608 时抛出，表示流式消息已超过6分钟无法更新，
 * 调用方需降级为主动发送（sendMessage）方式回复。
 */
class StreamExpiredError extends Error {
    constructor(message) {
        super(message ?? `Stream message update expired (errcode=${STREAM_EXPIRED_ERRCODE})`);
        this.errcode = STREAM_EXPIRED_ERRCODE;
        this.name = "StreamExpiredError";
    }
}
// ============================================================================
// 消息发送
// ============================================================================
/**
 * 发送企业微信回复消息
 * 供 monitor 内部和 channel outbound 使用
 *
 * @returns messageId (streamId)
 */
async function sendWeComReply(params) {
    const { wsClient, frame, text, runtime, finish = true, streamId: existingStreamId } = params;
    if (!text) {
        return "";
    }
    const streamId = existingStreamId || generateReqId("stream");
    if (!wsClient.isConnected) {
        runtime.error?.(`[wecom] WSClient not connected, cannot send reply`);
        throw new Error("WSClient not connected");
    }
    const body = frame.body;
    // 事件回调（aibot_event_callback）没有可用于 replyStream 的有效 req_id，
    // 对该场景改用主动发送 sendMessage，避免 846605 invalid req_id。
    if (body.msgtype === "event") {
        // 中间帧（thinking / 流式增量）直接跳过，仅在最终帧主动发一次文本。
        if (!finish) {
            runtime.log?.(`[plugin -> server] skip non-final stream for event callback, streamId=${streamId}`);
            return streamId;
        }
        const chatId = body.chatid || body.from?.userid;
        if (!chatId) {
            throw new Error("Missing chatId for event callback reply");
        }
        await withTimeout(wsClient.sendMessage(chatId, {
            msgtype: "markdown",
            markdown: { content: text },
        }), REPLY_SEND_TIMEOUT_MS, `Event reply send timed out (streamId=${streamId})`);
        runtime.log?.(`[plugin -> server] event-active-send chatId=${chatId}, finish=${finish}`);
        return streamId;
    }
    // 非事件消息，继续使用 replyStream（被动回复）
    // 使用 SDK 的 replyStream 方法发送消息，带超时保护
    try {
        await withTimeout(wsClient.replyStream(frame, streamId, text, finish), REPLY_SEND_TIMEOUT_MS, `Reply send timed out (streamId=${streamId})`);
    }
    catch (err) {
        // 服务端返回 846608：流式消息超过6分钟无法更新，需降级为主动发送
        const errMsg = err?.errmsg || err?.message || String(err);
        if (err?.errcode === STREAM_EXPIRED_ERRCODE ||
            errMsg.includes(String(STREAM_EXPIRED_ERRCODE))) {
            throw new StreamExpiredError(errMsg);
        }
        throw err;
    }
    runtime.log?.(`[plugin -> server] streamId=${streamId}, finish=${finish}`);
    return streamId;
}

/**
 * 企业微信媒体（图片）下载和保存模块
 *
 * 负责下载、检测格式、保存图片到本地，包含超时保护
 */
// ============================================================================
// 图片格式检测辅助函数（基于 file-type 包）
// ============================================================================
/**
 * 检查 Buffer 是否为有效的图片格式
 */
async function isImageBuffer(data) {
    const type = await fileTypeFromBuffer(data);
    return type?.mime.startsWith("image/") ?? false;
}
/**
 * 检测 Buffer 的图片内容类型
 */
async function detectImageContentType(data) {
    const type = await fileTypeFromBuffer(data);
    if (type?.mime.startsWith("image/")) {
        return type.mime;
    }
    return "application/octet-stream";
}
// ============================================================================
// 图片下载和保存
// ============================================================================
/**
 * 下载并保存所有图片到本地，每张图片的下载带超时保护
 */
async function downloadAndSaveImages(params) {
    const { imageUrls, config, runtime, wsClient } = params;
    const core = getWeComRuntime();
    const mediaList = [];
    for (const imageUrl of imageUrls) {
        try {
            runtime.log?.(`[wecom] Downloading image: url=${imageUrl}`);
            const mediaMaxMb = config.agents?.defaults?.mediaMaxMb ?? DEFAULT_MEDIA_MAX_MB;
            const maxBytes = mediaMaxMb * 1024 * 1024;
            let imageBuffer;
            let imageContentType;
            let originalFilename;
            const imageAesKey = params.imageAesKeys?.get(imageUrl);
            try {
                // 优先使用 SDK 的 downloadFile 方法下载（带超时保护）
                const result = await withTimeout(wsClient.downloadFile(imageUrl, imageAesKey), IMAGE_DOWNLOAD_TIMEOUT_MS, `Image download timed out: ${imageUrl}`);
                imageBuffer = result.buffer;
                originalFilename = result.filename;
                imageContentType = await detectImageContentType(imageBuffer);
                runtime.log?.(`[wecom] Image downloaded: size=${imageBuffer.length}, contentType=${imageContentType}, filename=${originalFilename ?? '(none)'}`);
            }
            catch (sdkError) {
                // 如果 SDK 方法失败，回退到原有方式（带超时保护）
                runtime.log?.(`[wecom] SDK download failed, fallback: ${String(sdkError)}`);
                const fetched = await withTimeout(core.channel.media.fetchRemoteMedia({ url: imageUrl }), IMAGE_DOWNLOAD_TIMEOUT_MS, `Manual image download timed out: ${imageUrl}`);
                runtime.log?.(`[wecom] Image fetched: contentType=${fetched.contentType}, size=${fetched.buffer.length}`);
                imageBuffer = fetched.buffer;
                imageContentType = fetched.contentType ?? "application/octet-stream";
                const isValidImage = await isImageBuffer(fetched.buffer);
                if (!isValidImage) {
                    runtime.log?.(`[wecom] WARN: Downloaded data is not a valid image format`);
                }
            }
            const saved = await core.channel.media.saveMediaBuffer(imageBuffer, imageContentType, "inbound", maxBytes, originalFilename);
            mediaList.push({ path: saved.path, contentType: saved.contentType });
            runtime.log?.(`[wecom][plugin] Image saved: path=${saved.path}, contentType=${saved.contentType}`);
        }
        catch (err) {
            runtime.error?.(`[wecom] Failed to download image: ${String(err)}`);
        }
    }
    return mediaList;
}
/**
 * 下载并保存所有文件到本地，每个文件的下载带超时保护
 */
async function downloadAndSaveFiles(params) {
    const { fileUrls, config, runtime, wsClient } = params;
    const core = getWeComRuntime();
    const mediaList = [];
    for (const fileUrl of fileUrls) {
        try {
            runtime.log?.(`[wecom] Downloading file: url=${fileUrl}`);
            const mediaMaxMb = config.agents?.defaults?.mediaMaxMb ?? DEFAULT_MEDIA_MAX_MB;
            const maxBytes = mediaMaxMb * 1024 * 1024;
            let fileBuffer;
            let fileContentType;
            let originalFilename;
            const fileAesKey = params.fileAesKeys?.get(fileUrl);
            try {
                // 使用 SDK 的 downloadFile 方法下载（带超时保护）
                const result = await withTimeout(wsClient.downloadFile(fileUrl, fileAesKey), FILE_DOWNLOAD_TIMEOUT_MS, `File download timed out: ${fileUrl}`);
                fileBuffer = result.buffer;
                originalFilename = result.filename;
                // 检测文件类型
                const type = await fileTypeFromBuffer(fileBuffer);
                fileContentType = type?.mime ?? "application/octet-stream";
                runtime.log?.(`[wecom] File downloaded: size=${fileBuffer.length}, contentType=${fileContentType}, filename=${originalFilename ?? '(none)'}`);
            }
            catch (sdkError) {
                // 如果 SDK 方法失败，回退到 fetchRemoteMedia（带超时保护）
                runtime.log?.(`[wecom] SDK file download failed, fallback: ${String(sdkError)}`);
                const fetched = await withTimeout(core.channel.media.fetchRemoteMedia({ url: fileUrl }), FILE_DOWNLOAD_TIMEOUT_MS, `Manual file download timed out: ${fileUrl}`);
                runtime.log?.(`[wecom] File fetched: contentType=${fetched.contentType}, size=${fetched.buffer.length}`);
                fileBuffer = fetched.buffer;
                fileContentType = fetched.contentType ?? "application/octet-stream";
            }
            const saved = await core.channel.media.saveMediaBuffer(fileBuffer, fileContentType, "inbound", maxBytes, originalFilename);
            mediaList.push({ path: saved.path, contentType: saved.contentType });
            runtime.log?.(`[wecom][plugin] File saved: path=${saved.path}, contentType=${saved.contentType}`);
        }
        catch (err) {
            runtime.error?.(`[wecom] Failed to download file: ${String(err)}`);
        }
    }
    return mediaList;
}

/**
 * 企业微信出站媒体上传工具模块
 *
 * 负责：
 * - 从 mediaUrl 加载文件 buffer（远程 URL 或本地路径均支持）
 * - 检测 MIME 类型并映射为企微媒体类型
 * - 文件大小检查与降级策略
 */
// ============================================================================
// MIME → 企微媒体类型映射
// ============================================================================
/**
 * 根据 MIME 类型检测企微媒体类型
 *
 * @param mimeType - MIME 类型字符串
 * @returns 企微媒体类型
 */
function detectWeComMediaType(mimeType) {
    const mime = mimeType.toLowerCase();
    // 图片类型
    if (mime.startsWith("image/")) {
        return "image";
    }
    // 视频类型
    if (mime.startsWith("video/")) {
        return "video";
    }
    // 语音类型
    if (mime.startsWith("audio/") ||
        mime === "application/ogg" // OGG 音频容器
    ) {
        return "voice";
    }
    // 其他类型默认为文件
    return "file";
}
// ============================================================================
// 媒体文件加载
// ============================================================================
/**
 * 从 mediaUrl 加载媒体文件
 *
 * 支持远程 URL（http/https）和本地路径（file:// 或绝对路径），
 * 利用 openclaw plugin-sdk 的 loadOutboundMediaFromUrl 统一处理。
 *
 * @param mediaUrl - 媒体文件的 URL 或本地路径
 * @param mediaLocalRoots - 允许读取本地文件的安全白名单目录
 * @returns 解析后的媒体文件信息
 */
async function resolveMediaFile(mediaUrl, mediaLocalRoots) {
    // 使用兼容层加载媒体文件（优先 SDK，不可用时 fallback）
    // 传入足够大的 maxBytes，由我们自己在后续步骤做大小检查
    const result = await loadOutboundMediaFromUrl(mediaUrl, {
        maxBytes: ABSOLUTE_MAX_BYTES,
        mediaLocalRoots,
    });
    if (!result.buffer || result.buffer.length === 0) {
        throw new Error(`Failed to load media from ${mediaUrl}: empty buffer`);
    }
    // 检测真实 MIME 类型
    let contentType = result.contentType || "application/octet-stream";
    // 如果没有返回准确的 contentType，尝试通过 buffer 魔术字节检测
    if (contentType === "application/octet-stream" ||
        contentType === "text/plain") {
        const detected = await detectMime(result.buffer);
        if (detected) {
            contentType = detected;
        }
    }
    // 提取文件名
    const fileName = extractFileName(mediaUrl, result.fileName, contentType);
    return {
        buffer: result.buffer,
        contentType,
        fileName,
    };
}
// ============================================================================
// 文件大小检查与降级
// ============================================================================
/** 企微语音消息仅支持 AMR 格式 */
const VOICE_SUPPORTED_MIMES = new Set(["audio/amr"]);
/**
 * 检查文件大小并执行降级策略
 *
 * 降级规则：
 * - voice 非 AMR 格式 → 降级为 file（企微后台仅支持 AMR）
 * - image 超过 10MB → 降级为 file
 * - video 超过 10MB → 降级为 file
 * - voice 超过 2MB → 降级为 file
 * - file 超过 20MB → 拒绝发送
 *
 * @param fileSize - 文件大小（字节）
 * @param detectedType - 检测到的企微媒体类型
 * @param contentType - 文件的 MIME 类型（用于语音格式校验）
 * @returns 大小检查结果
 */
function applyFileSizeLimits(fileSize, detectedType, contentType) {
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
    // 先检查绝对上限（20MB）
    if (fileSize > ABSOLUTE_MAX_BYTES) {
        return {
            finalType: detectedType,
            shouldReject: true,
            rejectReason: `文件大小 ${fileSizeMB}MB 超过了企业微信允许的最大限制 20MB，无法发送。请尝试压缩文件或减小文件大小。`,
            downgraded: false,
        };
    }
    // 按类型检查大小限制
    switch (detectedType) {
        case "image":
            if (fileSize > IMAGE_MAX_BYTES) {
                return {
                    finalType: "file",
                    shouldReject: false,
                    downgraded: true,
                    downgradeNote: `图片大小 ${fileSizeMB}MB 超过 10MB 限制，已转为文件格式发送`,
                };
            }
            break;
        case "video":
            if (fileSize > VIDEO_MAX_BYTES) {
                return {
                    finalType: "file",
                    shouldReject: false,
                    downgraded: true,
                    downgradeNote: `视频大小 ${fileSizeMB}MB 超过 10MB 限制，已转为文件格式发送`,
                };
            }
            break;
        case "voice":
            // 企微语音消息仅支持 AMR 格式，非 AMR 一律降级为文件
            if (contentType && !VOICE_SUPPORTED_MIMES.has(contentType.toLowerCase())) {
                return {
                    finalType: "file",
                    shouldReject: false,
                    downgraded: true,
                    downgradeNote: `语音格式 ${contentType} 不支持，企微仅支持 AMR 格式，已转为文件格式发送`,
                };
            }
            if (fileSize > VOICE_MAX_BYTES) {
                return {
                    finalType: "file",
                    shouldReject: false,
                    downgraded: true,
                    downgradeNote: `语音大小 ${fileSizeMB}MB 超过 2MB 限制，已转为文件格式发送`,
                };
            }
            break;
    }
    // 无需降级
    return {
        finalType: detectedType,
        shouldReject: false,
        downgraded: false,
    };
}
// ============================================================================
// 辅助函数
// ============================================================================
/**
 * 从 URL/路径中提取文件名
 */
function extractFileName(mediaUrl, providedFileName, contentType) {
    // 优先使用提供的文件名
    if (providedFileName) {
        return providedFileName;
    }
    // 尝试从 URL 中提取
    try {
        const urlObj = new URL(mediaUrl, "file://");
        const pathParts = urlObj.pathname.split("/");
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart.includes(".")) {
            return decodeURIComponent(lastPart);
        }
    }
    catch {
        // 尝试作为普通路径处理
        const parts = mediaUrl.split("/");
        const lastPart = parts[parts.length - 1];
        if (lastPart && lastPart.includes(".")) {
            return lastPart;
        }
    }
    // 使用 MIME 类型生成默认文件名
    const ext = mimeToExtension(contentType || "application/octet-stream");
    return `media_${Date.now()}${ext}`;
}
/**
 * MIME 类型转文件扩展名
 */
function mimeToExtension(mime) {
    const map = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/bmp": ".bmp",
        "image/svg+xml": ".svg",
        "video/mp4": ".mp4",
        "video/quicktime": ".mov",
        "video/x-msvideo": ".avi",
        "video/webm": ".webm",
        "audio/mpeg": ".mp3",
        "audio/ogg": ".ogg",
        "audio/wav": ".wav",
        "audio/amr": ".amr",
        "audio/aac": ".aac",
        "application/pdf": ".pdf",
        "application/zip": ".zip",
        "application/msword": ".doc",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        "application/vnd.ms-excel": ".xls",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
        "text/plain": ".txt",
    };
    return map[mime] || ".bin";
}
/**
 * 公共媒体上传+发送流程
 *
 * 统一处理：resolveMediaFile → detectType → sizeCheck → uploadMedia → sendMediaMessage
 * 媒体消息统一走 aibot_send_msg 主动发送，避免多文件场景下 reqId 只能用一次的问题。
 * channel.ts 的 sendMedia 和 monitor.ts 的 deliver 回调都使用此函数。
 */
async function uploadAndSendMedia(options) {
    const { wsClient, mediaUrl, chatId, mediaLocalRoots, log, errorLog } = options;
    try {
        // 1. 加载媒体文件
        log?.(`[wecom] Uploading media: url=${mediaUrl}`);
        const media = await resolveMediaFile(mediaUrl, mediaLocalRoots);
        // 2. 检测企微媒体类型
        const detectedType = detectWeComMediaType(media.contentType);
        // 3. 文件大小检查与降级策略
        const sizeCheck = applyFileSizeLimits(media.buffer.length, detectedType, media.contentType);
        if (sizeCheck.shouldReject) {
            errorLog?.(`[wecom] Media rejected: ${sizeCheck.rejectReason}`);
            return {
                ok: false,
                rejected: true,
                rejectReason: sizeCheck.rejectReason,
                finalType: sizeCheck.finalType,
            };
        }
        const finalType = sizeCheck.finalType;
        // 4. 分片上传获取 media_id
        const uploadResult = await wsClient.uploadMedia(media.buffer, {
            type: finalType,
            filename: media.fileName,
        });
        log?.(`[wecom] Media uploaded: media_id=${uploadResult.media_id}, type=${finalType}`);
        // 5. 统一通过 aibot_send_msg 主动发送媒体消息
        const result = await wsClient.sendMediaMessage(chatId, finalType, uploadResult.media_id);
        const messageId = result?.headers?.req_id ?? `wecom-media-${Date.now()}`;
        log?.(`[wecom] Media sent via sendMediaMessage: chatId=${chatId}, type=${finalType}`);
        return {
            ok: true,
            messageId,
            finalType,
            downgraded: sizeCheck.downgraded,
            downgradeNote: sizeCheck.downgradeNote,
        };
    }
    catch (err) {
        const errMsg = String(err);
        errorLog?.(`[wecom] Failed to upload/send media: url=${mediaUrl}, error=${errMsg}`);
        return {
            ok: false,
            error: errMsg,
        };
    }
}

/**
 * 模板卡片解析器
 *
 * 从 LLM 回复文本中提取 markdown JSON 代码块，验证其是否为合法的企业微信模板卡片，
 * 返回提取到的卡片列表和剩余文本。
 *
 * 同时提供 maskTemplateCardBlocks 函数，用于在流式中间帧中隐藏正在构建的卡片代码块，
 * 避免 JSON 源码暴露给终端用户。
 */
// ============================================================================
// LLM 输出字段类型修正
// ============================================================================
/**
 * 将 LLM 可能输出的字符串/非法值修正为企业微信 API 要求的整数。
 * 返回修正后的整数，若无法识别则返回 undefined（由调用方决定是否删除该字段）。
 */
function coerceToInt(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.round(value);
    }
    if (typeof value === "string") {
        const trimmed = value.trim().toLowerCase();
        // 纯数字字符串
        const num = Number(trimmed);
        if (!Number.isNaN(num) && Number.isFinite(num)) {
            return Math.round(num);
        }
    }
    return undefined;
}
/** 将 LLM 可能输出的字符串/非法值修正为布尔值 */
function coerceToBool(value) {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "string") {
        const t = value.trim().toLowerCase();
        if (t === "true" || t === "1" || t === "yes")
            return true;
        if (t === "false" || t === "0" || t === "no")
            return false;
    }
    if (typeof value === "number")
        return value !== 0;
    return undefined;
}
/** checkbox.mode 的语义别名映射 */
const MODE_ALIASES = {
    single: 0,
    radio: 0,
    "单选": 0,
    multi: 1,
    multiple: 1,
    "多选": 1,
};
/**
 * 修正 checkbox.mode：
 * - 0 → 单选，1 → 多选，仅允许这两个值
 * - 字符串数字 "0"/"1" → 整数
 * - 语义别名 "multi"/"single" 等 → 对应整数
 * - 其他正整数（如 2）→ clamp 到 1（多选）
 * - 无法识别 → 删除（让服务端使用默认值 0）
 */
function coerceCheckboxMode(value) {
    let num;
    if (typeof value === "number" && Number.isFinite(value)) {
        num = Math.round(value);
    }
    else if (typeof value === "string") {
        const trimmed = value.trim().toLowerCase();
        if (trimmed in MODE_ALIASES)
            return MODE_ALIASES[trimmed];
        const parsed = Number(trimmed);
        if (!Number.isNaN(parsed))
            num = Math.round(parsed);
    }
    if (num === undefined)
        return undefined;
    // mode 只允许 0（单选）或 1（多选），超出范围 clamp
    if (num <= 0)
        return 0;
    return 1;
}
/**
 * 对 LLM 生成的模板卡片 JSON 做字段类型修正，确保符合企业微信 API 的类型要求。
 *
 * 修正范围：
 * - checkbox.mode: uint32（0=单选，1=多选）
 * - checkbox.disable: bool
 * - checkbox.option_list[].is_checked: bool
 * - source.desc_color: int
 * - quote_area.type: int
 * - card_action.type: int
 * - image_text_area.type: int
 * - horizontal_content_list[].type: int
 * - jump_list[].type: int
 * - button_list[].style: int
 * - button_selection.disable: bool
 * - select_list[].disable: bool
 *
 * 原则：能修就修，修不了就删（让服务端走默认值），绝不阻塞发送。
 */
function normalizeTemplateCardFields(card, log) {
    const fixes = [];
    // ── checkbox ──────────────────────────────────────────────────────────
    const checkbox = card.checkbox;
    if (checkbox && typeof checkbox === "object") {
        // mode
        if ("mode" in checkbox) {
            const fixed = coerceCheckboxMode(checkbox.mode);
            if (fixed !== undefined) {
                if (checkbox.mode !== fixed) {
                    fixes.push(`checkbox.mode: ${JSON.stringify(checkbox.mode)} → ${fixed}`);
                }
                checkbox.mode = fixed;
            }
            else {
                fixes.push(`checkbox.mode: ${JSON.stringify(checkbox.mode)} → (deleted, invalid)`);
                delete checkbox.mode;
            }
        }
        // disable
        if ("disable" in checkbox) {
            const fixed = coerceToBool(checkbox.disable);
            if (fixed !== undefined && checkbox.disable !== fixed) {
                fixes.push(`checkbox.disable: ${JSON.stringify(checkbox.disable)} → ${fixed}`);
                checkbox.disable = fixed;
            }
        }
        // option_list[].is_checked
        if (Array.isArray(checkbox.option_list)) {
            for (const opt of checkbox.option_list) {
                if (opt && typeof opt === "object" && "is_checked" in opt) {
                    const fixed = coerceToBool(opt.is_checked);
                    if (fixed !== undefined && opt.is_checked !== fixed) {
                        fixes.push(`checkbox.option_list.is_checked: ${JSON.stringify(opt.is_checked)} → ${fixed}`);
                        opt.is_checked = fixed;
                    }
                }
            }
        }
    }
    // ── source.desc_color ────────────────────────────────────────────────
    const source = card.source;
    if (source && typeof source === "object" && "desc_color" in source) {
        const fixed = coerceToInt(source.desc_color);
        if (fixed !== undefined && source.desc_color !== fixed) {
            fixes.push(`source.desc_color: ${JSON.stringify(source.desc_color)} → ${fixed}`);
            source.desc_color = fixed;
        }
    }
    // ── card_action.type ─────────────────────────────────────────────────
    const cardAction = card.card_action;
    if (cardAction && typeof cardAction === "object" && "type" in cardAction) {
        const fixed = coerceToInt(cardAction.type);
        if (fixed !== undefined && cardAction.type !== fixed) {
            fixes.push(`card_action.type: ${JSON.stringify(cardAction.type)} → ${fixed}`);
            cardAction.type = fixed;
        }
    }
    // ── quote_area.type ──────────────────────────────────────────────────
    const quoteArea = card.quote_area;
    if (quoteArea && typeof quoteArea === "object" && "type" in quoteArea) {
        const fixed = coerceToInt(quoteArea.type);
        if (fixed !== undefined && quoteArea.type !== fixed) {
            fixes.push(`quote_area.type: ${JSON.stringify(quoteArea.type)} → ${fixed}`);
            quoteArea.type = fixed;
        }
    }
    // ── image_text_area.type ─────────────────────────────────────────────
    const imageTextArea = card.image_text_area;
    if (imageTextArea && typeof imageTextArea === "object" && "type" in imageTextArea) {
        const fixed = coerceToInt(imageTextArea.type);
        if (fixed !== undefined && imageTextArea.type !== fixed) {
            fixes.push(`image_text_area.type: ${JSON.stringify(imageTextArea.type)} → ${fixed}`);
            imageTextArea.type = fixed;
        }
    }
    // ── horizontal_content_list[].type ───────────────────────────────────
    if (Array.isArray(card.horizontal_content_list)) {
        for (const item of card.horizontal_content_list) {
            if (item && typeof item === "object" && "type" in item) {
                const fixed = coerceToInt(item.type);
                if (fixed !== undefined && item.type !== fixed) {
                    fixes.push(`horizontal_content_list.type: ${JSON.stringify(item.type)} → ${fixed}`);
                    item.type = fixed;
                }
            }
        }
    }
    // ── jump_list[].type ─────────────────────────────────────────────────
    if (Array.isArray(card.jump_list)) {
        for (const item of card.jump_list) {
            if (item && typeof item === "object" && "type" in item) {
                const fixed = coerceToInt(item.type);
                if (fixed !== undefined && item.type !== fixed) {
                    fixes.push(`jump_list.type: ${JSON.stringify(item.type)} → ${fixed}`);
                    item.type = fixed;
                }
            }
        }
    }
    // ── button_list[].style ──────────────────────────────────────────────
    if (Array.isArray(card.button_list)) {
        for (const btn of card.button_list) {
            if (btn && typeof btn === "object" && "style" in btn) {
                const fixed = coerceToInt(btn.style);
                if (fixed !== undefined && btn.style !== fixed) {
                    fixes.push(`button_list.style: ${JSON.stringify(btn.style)} → ${fixed}`);
                    btn.style = fixed;
                }
            }
        }
    }
    // ── button_selection.disable ─────────────────────────────────────────
    const buttonSelection = card.button_selection;
    if (buttonSelection && typeof buttonSelection === "object" && "disable" in buttonSelection) {
        const fixed = coerceToBool(buttonSelection.disable);
        if (fixed !== undefined && buttonSelection.disable !== fixed) {
            fixes.push(`button_selection.disable: ${JSON.stringify(buttonSelection.disable)} → ${fixed}`);
            buttonSelection.disable = fixed;
        }
    }
    // ── select_list[].disable ────────────────────────────────────────────
    if (Array.isArray(card.select_list)) {
        for (const sel of card.select_list) {
            if (sel && typeof sel === "object" && "disable" in sel) {
                const fixed = coerceToBool(sel.disable);
                if (fixed !== undefined && sel.disable !== fixed) {
                    fixes.push(`select_list.disable: ${JSON.stringify(sel.disable)} → ${fixed}`);
                    sel.disable = fixed;
                }
            }
        }
    }
    if (fixes.length > 0) {
        log?.(`[template-card-parser] normalizeTemplateCardFields: ${fixes.length} fix(es) applied: ${fixes.join("; ")}`);
    }
    return card;
}
/**
 * 校验并补全模板卡片的必填字段。
 *
 * 在 normalizeTemplateCardFields（类型修正）之后调用，确保卡片结构满足企业微信 API 的必填要求。
 *
 * 补全策略：
 * - task_id：所有卡片统一自动补全（交互型 API 必填，通知型插件也需要用于缓存回写）
 * - main_title：除 text_notice 外的 4 种卡片 API 必填，自动补 { title: "通知" }
 *   text_notice 要求 main_title.title 与 sub_title_text 至少填一个，缺两个时补 sub_title_text
 * - card_action：text_notice / news_notice API 必填，自动补 { type: 1, url: "https://work.weixin.qq.com" }
 * - checkbox：vote_interaction API 必填，无法凭空补全，仅记告警
 * - submit_button：vote_interaction / multiple_interaction API 必填，自动补 { text: "提交", key: "submit_default" }
 * - button_list：button_interaction API 必填，无法凭空补全，仅记告警
 * - select_list：multiple_interaction API 必填，无法凭空补全，仅记告警
 */
function validateAndFixRequiredFields(card, log) {
    const cardType = card.card_type;
    const fixes = [];
    const warnings = [];
    // ── task_id（所有卡片：始终确保唯一性） ─────────────────────────────
    // LLM 可能编造时间戳导致重复，因此无论是否提供了 task_id，
    // 都提取语义前缀 + 代码追加真实时间戳和随机后缀来保证唯一。
    const rawTid = (typeof card.task_id === "string" && card.task_id.trim()) ? card.task_id.trim() : "";
    const rand = Math.random().toString(36).slice(2, 6);
    const ts = Date.now();
    let finalTid;
    if (rawTid) {
        // 提取 LLM 的语义前缀：去掉尾部的数字串（LLM 编造的假时间戳）
        const prefix = rawTid.replace(/_\d{8,}$/, "").replace(/[^a-zA-Z0-9_\-@]/g, "_").slice(0, 80);
        finalTid = prefix ? `${prefix}_${ts}_${rand}` : `task_${cardType}_${ts}_${rand}`;
    }
    else {
        finalTid = `task_${cardType}_${ts}_${rand}`;
    }
    if (finalTid !== rawTid) {
        fixes.push(`task_id: "${rawTid || "(missing)"}" → "${finalTid}"`);
    }
    card.task_id = finalTid;
    // ── main_title ────────────────────────────────────────────────────────
    const mainTitle = card.main_title;
    const hasMainTitle = mainTitle && typeof mainTitle === "object" &&
        (typeof mainTitle.title === "string" && mainTitle.title.trim());
    const hasSubTitleText = typeof card.sub_title_text === "string" && card.sub_title_text.trim();
    switch (cardType) {
        case "text_notice":
            // text_notice: main_title.title 和 sub_title_text 至少一个
            if (!hasMainTitle && !hasSubTitleText) {
                card.sub_title_text = card.sub_title_text || "通知";
                fixes.push(`sub_title_text: (missing, no main_title either) → fallback "通知"`);
            }
            break;
        case "news_notice":
        case "button_interaction":
        case "vote_interaction":
        case "multiple_interaction":
            // 这四种 main_title 为必填
            if (!mainTitle || typeof mainTitle !== "object") {
                card.main_title = { title: "通知" };
                fixes.push(`main_title: (missing) → { title: "通知" }`);
            }
            else if (!hasMainTitle) {
                mainTitle.title = "通知";
                fixes.push(`main_title.title: (empty) → "通知"`);
            }
            break;
    }
    // ── card_action（text_notice / news_notice 必填） ──────────────────
    if (cardType === "text_notice" || cardType === "news_notice") {
        if (!card.card_action || typeof card.card_action !== "object") {
            card.card_action = { type: 1, url: "https://work.weixin.qq.com" };
            fixes.push(`card_action: (missing) → { type: 1, url: "https://work.weixin.qq.com" }`);
        }
    }
    // ── submit_button（vote_interaction / multiple_interaction 必填） ──
    if (cardType === "vote_interaction" || cardType === "multiple_interaction") {
        if (!card.submit_button || typeof card.submit_button !== "object") {
            card.submit_button = { text: "提交", key: `submit_${cardType}_${Date.now()}` };
            fixes.push(`submit_button: (missing) → auto-generated`);
        }
    }
    // ── 核心业务字段（无法凭空补全，仅告警） ────────────────────────────
    if (cardType === "button_interaction") {
        if (!Array.isArray(card.button_list) || card.button_list.length === 0) {
            warnings.push(`button_list is missing or empty (required for button_interaction)`);
        }
    }
    if (cardType === "vote_interaction") {
        if (!card.checkbox || typeof card.checkbox !== "object") {
            warnings.push(`checkbox is missing (required for vote_interaction)`);
        }
    }
    if (cardType === "multiple_interaction") {
        if (!Array.isArray(card.select_list) || card.select_list.length === 0) {
            warnings.push(`select_list is missing or empty (required for multiple_interaction)`);
        }
    }
    if (fixes.length > 0) {
        log?.(`[template-card-parser] validateAndFixRequiredFields: ${fixes.length} fix(es): ${fixes.join("; ")}`);
    }
    if (warnings.length > 0) {
        log?.(`[template-card-parser] validateAndFixRequiredFields: ${warnings.length} warning(s): ${warnings.join("; ")}`);
    }
    return card;
}
// ============================================================================
// 简化格式 → 企微 API 格式转换（vote_interaction / multiple_interaction）
// ============================================================================
/**
 * 生成唯一的 question_key / submit_button.key。
 */
function generateKey(prefix) {
    const rand = Math.random().toString(36).slice(2, 6);
    return `${prefix}_${Date.now()}_${rand}`;
}
/**
 * 将 vote_interaction 的简化格式转换为企微 API 格式。
 *
 * 简化格式字段：
 *   title        → main_title.title
 *   description  → main_title.desc
 *   options      → checkbox.option_list（每个 {id, text} 直接透传）
 *   mode         → checkbox.mode（0=单选 1=多选）
 *   submit_text  → submit_button.text
 *
 * 代码自动生成：checkbox.question_key, submit_button.key
 *
 * 如果 LLM 已输出了合法的 API 原始格式（有 checkbox.option_list），则跳过转换直接透传。
 */
function transformVoteInteraction(card, log) {
    // 防御性：如果已经是合法 API 格式，跳过
    const existingCheckbox = card.checkbox;
    if (existingCheckbox && typeof existingCheckbox === "object" && Array.isArray(existingCheckbox.option_list)) {
        log?.(`[template-card-parser] transformVoteInteraction: already has checkbox.option_list, skipping transform`);
        return card;
    }
    // 提取 options（简化格式的核心字段）
    const options = card.options;
    if (!Array.isArray(options) || options.length === 0) {
        log?.(`[template-card-parser] transformVoteInteraction: no "options" array found, skipping transform`);
        return card;
    }
    log?.(`[template-card-parser] transformVoteInteraction: transforming simplified format → API format`);
    log?.(`[template-card-parser] transformVoteInteraction: input=${JSON.stringify(card)}`);
    // ── 构建 main_title ──
    const title = card.title;
    const description = card.description;
    if (title || description) {
        card.main_title = {
            ...(title ? { title } : {}),
            ...(description ? { desc: description } : {}),
        };
        delete card.title;
        delete card.description;
    }
    // ── 构建 checkbox（最多 20 个选项） ──
    const mode = coerceCheckboxMode(card.mode) ?? 0;
    const questionKey = generateKey("vote");
    const clampedOptions = options.slice(0, 20);
    if (options.length > 20) {
        log?.(`[template-card-parser] transformVoteInteraction: options count ${options.length} exceeds max 20, clamped to 20`);
    }
    card.checkbox = {
        question_key: questionKey,
        mode,
        option_list: clampedOptions.map((opt) => ({
            id: String(opt.id ?? opt.value ?? `opt_${Math.random().toString(36).slice(2, 6)}`),
            text: String(opt.text ?? opt.label ?? opt.name ?? ""),
        })),
    };
    delete card.options;
    delete card.mode;
    // ── 构建 submit_button ──
    const submitText = card.submit_text || "提交";
    card.submit_button = {
        text: submitText,
        key: generateKey("submit_vote"),
    };
    delete card.submit_text;
    // ── 清理 LLM 可能杜撰的无效字段 ──
    delete card.vote_question;
    delete card.vote_option;
    delete card.vote_options;
    log?.(`[template-card-parser] transformVoteInteraction: output=${JSON.stringify(card)}`);
    return card;
}
/**
 * 将 multiple_interaction 的简化格式转换为企微 API 格式。
 *
 * 简化格式字段：
 *   title            → main_title.title
 *   description      → main_title.desc
 *   selectors        → select_list（每个 {title, options: [{id, text}]} → {question_key, title, option_list}）
 *   submit_text      → submit_button.text
 *
 * 代码自动生成：select_list[].question_key, submit_button.key
 *
 * 如果 LLM 已输出了合法的 API 原始格式（有 select_list[0].option_list），则跳过转换直接透传。
 */
function transformMultipleInteraction(card, log) {
    // 防御性：如果已经是合法 API 格式，跳过
    const existingSelectList = card.select_list;
    if (Array.isArray(existingSelectList) &&
        existingSelectList.length > 0 &&
        Array.isArray(existingSelectList[0]?.option_list)) {
        log?.(`[template-card-parser] transformMultipleInteraction: already has select_list[].option_list, skipping transform`);
        return card;
    }
    // 提取 selectors（简化格式的核心字段）
    const selectors = card.selectors;
    if (!Array.isArray(selectors) || selectors.length === 0) {
        log?.(`[template-card-parser] transformMultipleInteraction: no "selectors" array found, skipping transform`);
        return card;
    }
    log?.(`[template-card-parser] transformMultipleInteraction: transforming simplified format → API format`);
    log?.(`[template-card-parser] transformMultipleInteraction: input=${JSON.stringify(card)}`);
    // ── 构建 main_title ──
    const title = card.title;
    const description = card.description;
    if (title || description) {
        card.main_title = {
            ...(title ? { title } : {}),
            ...(description ? { desc: description } : {}),
        };
        delete card.title;
        delete card.description;
    }
    // ── 构建 select_list（最多 3 个选择器，每个最多 10 个选项） ──
    const clampedSelectors = selectors.slice(0, 3);
    if (selectors.length > 3) {
        log?.(`[template-card-parser] transformMultipleInteraction: selectors count ${selectors.length} exceeds max 3, clamped to 3`);
    }
    card.select_list = clampedSelectors.map((sel, idx) => {
        const selectorOptions = (sel.options ?? []).slice(0, 10);
        return {
            question_key: generateKey(`sel_${idx}`),
            title: String(sel.title ?? sel.label ?? `选择${idx + 1}`),
            option_list: selectorOptions.map((opt) => ({
                id: String(opt.id ?? opt.value ?? `opt_${Math.random().toString(36).slice(2, 6)}`),
                text: String(opt.text ?? opt.label ?? opt.name ?? ""),
            })),
        };
    });
    delete card.selectors;
    // ── 构建 submit_button ──
    const submitText = card.submit_text || "提交";
    card.submit_button = {
        text: submitText,
        key: generateKey("submit_multi"),
    };
    delete card.submit_text;
    log?.(`[template-card-parser] transformMultipleInteraction: output=${JSON.stringify(card)}`);
    return card;
}
/**
 * 对 vote_interaction / multiple_interaction 执行简化格式转换。
 * 其他 card_type 直接跳过。
 */
function transformSimplifiedCard(card, log) {
    const cardType = card.card_type;
    if (cardType === "vote_interaction") {
        return transformVoteInteraction(card, log);
    }
    if (cardType === "multiple_interaction") {
        return transformMultipleInteraction(card, log);
    }
    return card;
}
/**
 * 匹配 markdown 代码块的正则表达式
 * 支持 ```json ... ``` 和 ``` ... ``` 两种格式
 */
const CODE_BLOCK_RE = /```(?:json)?\s*\n([\s\S]*?)\n```/g;
/**
 * 匹配已闭合的代码块（含 card_type 关键词，用于中间帧遮罩）
 * 与 CODE_BLOCK_RE 相同，但用于 maskTemplateCardBlocks 中单独实例化
 */
const CLOSED_BLOCK_RE = /```(?:json)?\s*\n([\s\S]*?)\n```/g;
/**
 * 匹配未闭合的代码块尾部（LLM 正在输出中的代码块）
 * 以 ```json 或 ``` 开头，后面有内容但没有闭合的 ```
 */
const UNCLOSED_BLOCK_RE = /```(?:json)?\s*\n[\s\S]*$/;
/**
 * 从文本中提取模板卡片 JSON 代码块
 *
 * 匹配规则：
 * 1. 匹配所有 ```json ... ``` 或 ``` ... ``` 格式的代码块
 * 2. 尝试 JSON.parse 解析代码块内容
 * 3. 检查解析结果中是否包含合法的 card_type 字段
 * 4. 合法的卡片从原文中移除，不合法的保留
 *
 * @param text - LLM 回复的完整文本
 * @returns 提取结果，包含卡片列表和剩余文本
 */
function extractTemplateCards(text, log) {
    const cards = [];
    /** 需要从原文中移除的代码块（记录完整匹配内容） */
    const blocksToRemove = [];
    log?.(`[template-card-parser] extractTemplateCards called, textLength=${text.length}`);
    let match;
    // 重置正则的 lastIndex，确保从头匹配
    CODE_BLOCK_RE.lastIndex = 0;
    let blockIndex = 0;
    while ((match = CODE_BLOCK_RE.exec(text)) !== null) {
        const fullMatch = match[0];
        const jsonContent = match[1].trim();
        blockIndex++;
        log?.(`[template-card-parser] Found code block #${blockIndex}, length=${fullMatch.length}, preview=${jsonContent.slice(0, 1000)}...`);
        // 尝试解析 JSON
        let parsed;
        try {
            parsed = JSON.parse(jsonContent);
        }
        catch (e) {
            // JSON 解析失败，保留在原文中
            log?.(`[template-card-parser] Code block #${blockIndex} JSON parse failed: ${String(e)}`);
            continue;
        }
        // 检查是否包含合法的 card_type
        const cardType = parsed.card_type;
        if (typeof cardType !== "string" || !VALID_CARD_TYPES.includes(cardType)) {
            // card_type 不合法，保留在原文中
            log?.(`[template-card-parser] Code block #${blockIndex} has invalid card_type="${String(cardType)}", skipping`);
            continue;
        }
        log?.(`[template-card-parser] Code block #${blockIndex} is valid template card, card_type="${cardType}"`);
        // vote_interaction / multiple_interaction：简化格式 → API 格式转换
        transformSimplifiedCard(parsed, log);
        // 修正 LLM 可能输出的错误字段类型（如 checkbox.mode: "multi" → 1）
        normalizeTemplateCardFields(parsed, log);
        // 校验并补全必填字段（如缺失的 task_id、main_title、card_action）
        validateAndFixRequiredFields(parsed, log);
        // 合法的模板卡片，收集并标记移除
        cards.push({
            cardJson: parsed,
            cardType,
        });
        blocksToRemove.push(fullMatch);
    }
    // 从原文中移除已提取的代码块，生成剩余文本
    let remainingText = text;
    for (const block of blocksToRemove) {
        remainingText = remainingText.replace(block, "");
    }
    // 清理多余空行（连续 3 个以上换行合并为 2 个）
    remainingText = remainingText.replace(/\n{3,}/g, "\n\n").trim();
    log?.(`[template-card-parser] Extraction done: ${cards.length} card(s) found, remainingTextLength=${remainingText.length}`);
    return { cards, remainingText };
}
/**
 * 遮罩文本中的模板卡片代码块（用于流式中间帧展示）
 *
 * 在 LLM 流式输出过程中，累积文本可能包含：
 * 1. 已闭合的模板卡片 JSON 代码块 → 替换为友好提示文本
 * 2. 正在构建中的未闭合代码块 → 截断隐藏，避免 JSON 源码暴露
 *
 * 此函数仅做文本替换，不做 JSON 解析验证（中间帧性能优先）。
 * 只要代码块内容中出现 "card_type" 关键词就认为是模板卡片并遮罩。
 *
 * @param text - 当前累积文本
 * @returns 遮罩后的展示文本
 */
function maskTemplateCardBlocks(text, log) {
    let masked = text;
    let closedMaskCount = 0;
    let unclosedMasked = false;
    // 步骤一：处理已闭合的代码块
    CLOSED_BLOCK_RE.lastIndex = 0;
    masked = masked.replace(CLOSED_BLOCK_RE, (fullMatch, content) => {
        // 检查代码块内容是否包含 card_type 关键词
        if (/["']card_type["']/.test(content)) {
            closedMaskCount++;
            return "\n\n📋 *正在生成卡片消息...*\n\n";
        }
        // 非模板卡片代码块，保留原样
        return fullMatch;
    });
    // 步骤二：处理未闭合的代码块尾部（LLM 仍在输出中）
    // 检查是否有以 ``` 开头但没有闭合的代码块
    const unclosedMatch = UNCLOSED_BLOCK_RE.exec(masked);
    if (unclosedMatch) {
        const unclosedContent = unclosedMatch[0];
        // 如果未闭合部分包含 card_type 关键词，说明正在构建模板卡片 → 截断
        if (/["']card_type["']/.test(unclosedContent)) {
            unclosedMasked = true;
            masked = masked.slice(0, unclosedMatch.index) + "\n\n📋 *正在生成卡片消息...*";
        }
    }
    // 有遮罩行为时才打日志，避免每帧都刷屏
    if (closedMaskCount > 0 || unclosedMasked) {
        log?.(`[template-card-parser] maskTemplateCardBlocks: closedMasked=${closedMaskCount}, unclosedMasked=${unclosedMasked}, textLength=${text.length}, maskedLength=${masked.length}`);
    }
    return masked;
}

/**
 * 企业微信群组访问控制模块
 *
 * 负责群组策略检查（groupPolicy、群组白名单、群内发送者白名单）
 */
// ============================================================================
// 内部辅助函数
// ============================================================================
/**
 * 解析企业微信群组配置
 */
function resolveWeComGroupConfig(params) {
    const groups = params.cfg?.groups ?? {};
    const wildcard = groups["*"];
    const groupId = params.groupId?.trim();
    if (!groupId) {
        return undefined;
    }
    const direct = groups[groupId];
    if (direct) {
        return direct;
    }
    const lowered = groupId.toLowerCase();
    const matchKey = Object.keys(groups).find((key) => key.toLowerCase() === lowered);
    if (matchKey) {
        return groups[matchKey];
    }
    return wildcard;
}
/**
 * 检查群组是否在允许列表中
 */
function isWeComGroupAllowed(params) {
    const { groupPolicy } = params;
    if (groupPolicy === "disabled") {
        return false;
    }
    if (groupPolicy === "open") {
        return true;
    }
    // allowlist 模式：检查群组是否在允许列表中
    const normalizedAllowFrom = params.allowFrom.map((entry) => String(entry).replace(new RegExp(`^${CHANNEL_ID}:`, "i"), "").trim());
    if (normalizedAllowFrom.includes("*")) {
        return true;
    }
    const normalizedGroupId = params.groupId.trim();
    return normalizedAllowFrom.some((entry) => entry === normalizedGroupId || entry.toLowerCase() === normalizedGroupId.toLowerCase());
}
/**
 * 检查群组内发送者是否在允许列表中
 */
function isGroupSenderAllowed(params) {
    const { senderId, groupId, wecomConfig } = params;
    const groupConfig = resolveWeComGroupConfig({
        cfg: wecomConfig,
        groupId,
    });
    const perGroupSenderAllowFrom = (groupConfig?.allowFrom ?? []).map((v) => String(v));
    if (perGroupSenderAllowFrom.length === 0) {
        return true;
    }
    if (perGroupSenderAllowFrom.includes("*")) {
        return true;
    }
    return perGroupSenderAllowFrom.some((entry) => {
        const normalized = entry.replace(new RegExp(`^${CHANNEL_ID}:`, "i"), "").trim();
        return normalized === senderId || normalized === `user:${senderId}`;
    });
}
// ============================================================================
// 公开 API
// ============================================================================
/**
 * 检查群组策略访问控制
 * @returns 检查结果，包含是否允许继续处理
 */
function checkGroupPolicy(params) {
    const { chatId, senderId, account, config, runtime } = params;
    const wecomConfig = (config.channels?.[CHANNEL_ID] ?? {});
    const defaultGroupPolicy = config.channels?.[CHANNEL_ID]?.groupPolicy;
    const groupPolicy = account.config.groupPolicy ?? defaultGroupPolicy ?? "open";
    // const { groupPolicy, providerMissingFallbackApplied } = resolveOpenProviderRuntimeGroupPolicy({
    //   providerConfigPresent: config.channels?.[CHANNEL_ID] !== undefined,
    //   groupPolicy: wecomConfig.groupPolicy,
    //   defaultGroupPolicy,
    // });
    // warnMissingProviderGroupPolicyFallbackOnce({
    //   providerMissingFallbackApplied,
    //   providerKey: CHANNEL_ID,
    //   accountId: account.accountId,
    //   log: (msg) => runtime.log?.(msg),
    // });
    const groupAllowFrom = wecomConfig.groupAllowFrom ?? [];
    const groupAllowed = isWeComGroupAllowed({
        groupPolicy,
        allowFrom: groupAllowFrom,
        groupId: chatId,
    });
    if (!groupAllowed) {
        runtime.log?.(`[WeCom] Group ${chatId} not allowed (groupPolicy=${groupPolicy})`);
        return { allowed: false };
    }
    const senderAllowed = isGroupSenderAllowed({
        senderId,
        groupId: chatId,
        wecomConfig,
    });
    if (!senderAllowed) {
        runtime.log?.(`[WeCom] Sender ${senderId} not in group ${chatId} sender allowlist`);
        return { allowed: false };
    }
    return { allowed: true };
}
/**
 * 检查发送者是否在允许列表中（通用）
 */
function isSenderAllowed(senderId, allowFrom) {
    if (allowFrom.includes("*")) {
        return true;
    }
    return allowFrom.some((entry) => {
        const normalized = entry.replace(new RegExp(`^${CHANNEL_ID}:`, "i"), "").trim();
        return normalized === senderId || normalized === `user:${senderId}`;
    });
}

/**
 * 企业微信 DM（私聊）访问控制模块
 *
 * 负责私聊策略检查、配对流程
 */
// ============================================================================
// 公开 API
// ============================================================================
/**
 * 检查 DM Policy 访问控制
 * @returns 检查结果，包含是否允许继续处理
 */
async function checkDmPolicy(params) {
    const { senderId, isGroup, account, wsClient, frame, runtime } = params;
    const core = getWeComRuntime();
    // 群聊消息不检查 DM Policy
    if (isGroup) {
        return { allowed: true };
    }
    const dmPolicy = account.config.dmPolicy ?? "open";
    const configAllowFrom = (account.config.allowFrom ?? []).map((v) => String(v));
    // 如果 dmPolicy 是 disabled，直接拒绝
    if (dmPolicy === "disabled") {
        runtime.log?.(`[WeCom] Blocked DM from ${senderId} (dmPolicy=disabled)`);
        return { allowed: false };
    }
    // 如果是 open 模式，允许所有人
    if (dmPolicy === "open") {
        return { allowed: true };
    }
    // OpenClaw <= 2026.2.19 signature: readAllowFromStore(channel, env?, accountId?)
    const oldStoreAllowFrom = await core.channel.pairing.readAllowFromStore('wecom', undefined, account.accountId).catch(() => []);
    // Compatibility fallback for newer OpenClaw implementations.
    const newStoreAllowFrom = await core.channel.pairing
        .readAllowFromStore({ channel: CHANNEL_ID, accountId: account.accountId })
        .catch(() => []);
    // 检查发送者是否在允许列表中
    const storeAllowFrom = [...oldStoreAllowFrom, ...newStoreAllowFrom];
    const effectiveAllowFrom = [...configAllowFrom, ...storeAllowFrom];
    const senderAllowedResult = isSenderAllowed(senderId, effectiveAllowFrom);
    if (senderAllowedResult) {
        return { allowed: true };
    }
    // 处理未授权用户
    if (dmPolicy === "pairing") {
        const { code, created } = await core.channel.pairing.upsertPairingRequest({
            channel: CHANNEL_ID,
            id: senderId,
            accountId: account.accountId,
            meta: { name: senderId },
        });
        if (created) {
            runtime.log?.(`[WeCom] Pairing request created for sender=${senderId}`);
            try {
                await sendWeComReply({
                    wsClient,
                    frame,
                    text: core.channel.pairing.buildPairingReply({
                        channel: CHANNEL_ID,
                        idLine: `您的企业微信用户ID: ${senderId}`,
                        code,
                    }),
                    runtime,
                    finish: true,
                });
            }
            catch (err) {
                runtime.error?.(`[WeCom] Failed to send pairing reply to ${senderId}: ${String(err)}`);
            }
        }
        else {
            runtime.log?.(`[WeCom] Pairing request already exists for sender=${senderId}`);
        }
        return { allowed: false, pairingSent: created };
    }
    // allowlist 模式：直接拒绝未授权用户
    runtime.log?.(`[WeCom] Blocked unauthorized sender ${senderId} (dmPolicy=${dmPolicy})`);
    return { allowed: false };
}

// ============================================================================
// 类型定义
// ============================================================================
// ============================================================================
// 常量
// ============================================================================
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天
const DEFAULT_MEMORY_MAX_SIZE = 200;
// ============================================================================
// 核心实现
// ============================================================================
function createPersistentReqIdStore(accountId, options) {
    const ttlMs = DEFAULT_TTL_MS;
    const memoryMaxSize = DEFAULT_MEMORY_MAX_SIZE;
    // 内存层：chatId → ReqIdEntry
    const memory = new Map();
    // ========== 内部辅助函数 ==========
    /** 检查条目是否过期 */
    function isExpired(entry, now) {
        return now - entry.ts >= ttlMs;
    }
    /**
     * 内存容量控制：淘汰最旧的条目。
     * 利用 Map 的插入顺序 + touch(先 delete 再 set) 实现类 LRU 效果。
     */
    function pruneMemory() {
        if (memory.size <= memoryMaxSize)
            return;
        const sorted = [...memory.entries()].sort((a, b) => a[1].ts - b[1].ts);
        const toRemove = sorted.slice(0, memory.size - memoryMaxSize);
        for (const [key] of toRemove) {
            memory.delete(key);
        }
    }
    // ========== 公开 API ==========
    function set(chatId, reqId) {
        const entry = { reqId, ts: Date.now() };
        // touch：先删再设，保持 Map 插入顺序（类 LRU）
        memory.delete(chatId);
        memory.set(chatId, entry);
        pruneMemory();
    }
    async function get(chatId) {
        const now = Date.now();
        // 仅查内存
        const memEntry = memory.get(chatId);
        if (memEntry && !isExpired(memEntry, now)) {
            return memEntry.reqId;
        }
        if (memEntry) {
            memory.delete(chatId); // 过期则删除
        }
        return undefined;
    }
    function getSync(chatId) {
        const now = Date.now();
        const entry = memory.get(chatId);
        if (entry && !isExpired(entry, now)) {
            return entry.reqId;
        }
        if (entry) {
            memory.delete(chatId);
        }
        return undefined;
    }
    function del(chatId) {
        memory.delete(chatId);
    }
    function clearMemory() {
        memory.clear();
    }
    function memorySize() {
        return memory.size;
    }
    return {
        set,
        get,
        getSync,
        delete: del,
        clearMemory,
        memorySize,
    };
}

/**
 * 企业微信全局状态管理模块
 *
 * 负责管理 WSClient 实例、消息状态（带 TTL 清理）、ReqId 存储
 * 解决全局 Map 的内存泄漏问题
 */
// ============================================================================
// WSClient 实例管理
// ============================================================================
/** WSClient 实例管理 */
const wsClientInstances = new Map();
/**
 * 获取指定账户的 WSClient 实例
 */
function getWeComWebSocket(accountId) {
    return wsClientInstances.get(accountId) ?? null;
}
/**
 * 设置指定账户的 WSClient 实例
 */
function setWeComWebSocket(accountId, client) {
    wsClientInstances.set(accountId, client);
}
/** 消息状态管理 */
const messageStates = new Map();
/** 定期清理定时器 */
let cleanupTimer = null;
/**
 * 启动消息状态定期清理（自动 TTL 清理 + 容量限制）
 */
function startMessageStateCleanup() {
    if (cleanupTimer)
        return;
    cleanupTimer = setInterval(() => {
        pruneMessageStates();
    }, MESSAGE_STATE_CLEANUP_INTERVAL_MS);
    // 允许进程退出时不阻塞
    if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
        cleanupTimer.unref();
    }
}
/**
 * 停止消息状态定期清理
 */
function stopMessageStateCleanup() {
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
    }
}
/**
 * 清理过期和超量的消息状态条目
 */
function pruneMessageStates() {
    const now = Date.now();
    // 1. 清理过期条目
    for (const [key, entry] of messageStates) {
        if (now - entry.createdAt >= MESSAGE_STATE_TTL_MS) {
            messageStates.delete(key);
        }
    }
    // 2. 容量限制：如果仍超过最大条目数，按时间淘汰最旧的
    if (messageStates.size > MESSAGE_STATE_MAX_SIZE) {
        const sorted = [...messageStates.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
        const toRemove = sorted.slice(0, messageStates.size - MESSAGE_STATE_MAX_SIZE);
        for (const [key] of toRemove) {
            messageStates.delete(key);
        }
    }
}
/**
 * 设置消息状态
 */
function setMessageState(messageId, state) {
    messageStates.set(messageId, {
        state,
        createdAt: Date.now(),
    });
}
/**
 * 删除消息状态
 */
function deleteMessageState(messageId) {
    messageStates.delete(messageId);
}
// ============================================================================
// ReqId 持久化存储管理（按 accountId 隔离）
// ============================================================================
/**
 * ReqId 持久化存储管理
 * 参考 createPersistentDedupe 模式：内存 + 磁盘双层、文件锁、原子写入、TTL 过期、防抖写入
 * 重启后可从磁盘恢复，确保主动推送消息时能获取到 reqId
 */
const reqIdStores = new Map();
function getOrCreateReqIdStore(accountId) {
    let store = reqIdStores.get(accountId);
    if (!store) {
        store = createPersistentReqIdStore();
        reqIdStores.set(accountId, store);
    }
    return store;
}
// ============================================================================
// ReqId 操作函数
// ============================================================================
/**
 * 设置 chatId 对应的 reqId（写入内存 + 防抖写磁盘）
 */
function setReqIdForChat(chatId, reqId, accountId = "default") {
    getOrCreateReqIdStore(accountId).set(chatId, reqId);
}
/**
 * 启动时预热 reqId 缓存（从磁盘加载到内存）
 *
 * 注意：由于移除了磁盘存储，此函数现在只返回 0（无预热条目）
 */
async function warmupReqIdStore(accountId = "default", log) {
    // 由于移除了磁盘存储，不再需要预热过程
    log?.("[WeCom] reqid-store warmup: no-op (disk storage removed)");
    return 0;
}
// ============================================================================
// 全局 cleanup（断开连接时释放所有资源）
// ============================================================================
/**
 * 清理指定账户的所有资源
 */
async function cleanupAccount(accountId) {
    // 1. 断开 WSClient
    const wsClient = wsClientInstances.get(accountId);
    if (wsClient) {
        try {
            wsClient.disconnect();
        }
        catch {
            // 忽略断开连接时的错误
        }
        wsClientInstances.delete(accountId);
    }
    // 2. 由于移除了磁盘存储，不再需要 flush reqId 存储
    // 注意：不删除 store，因为重连后可能还需要
}

/** 从 package.json 中读取版本号，兼容打包产物和直接运行 .ts 两种场景 */
const getVersion = () => {
    try {
        // ESM 环境使用 import.meta.url，CJS 环境使用全局 __dirname
        const currentDir = dirname(fileURLToPath(import.meta.url));
        // 直接运行 .ts 时在 src/ 下，打包后在 dist/ 下，都向上一级找 package.json
        const pkgPath = resolve(currentDir, "..", "package.json");
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        return pkg.version ?? "";
    }
    catch {
        return "";
    }
};
/** 插件版本号，来源于 package.json */
const PLUGIN_VERSION = getVersion();

/**
 * 企业微信 WebSocket 监控器主模块
 *
 * 负责：
 * - 建立和管理 WebSocket 连接
 * - 协调消息处理流程（解析→策略检查→下载图片→路由回复）
 * - 资源生命周期管理
 *
 * 子模块：
 * - message-parser.ts  : 消息内容解析
 * - message-sender.ts  : 消息发送（带超时保护）
 * - media-handler.ts   : 图片下载和保存（带超时保护）
 * - group-policy.ts    : 群组访问控制
 * - dm-policy.ts       : 私聊访问控制
 * - state-manager.ts   : 全局状态管理（带 TTL 清理）
 * - timeout.ts         : 超时工具
 */
/**
 * 去除文本中的 `<think>...</think>` 标签（支持跨行），返回剩余可见文本。
 * 用于判断大模型回复中是否包含实际用户可见内容（而非仅有 thinking 推理过程）。
 */
function stripThinkTags(text) {
    return text;
    // return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
const sentTemplateCardByTaskId = new Map();
const TEMPLATE_CARD_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const TEMPLATE_CARD_CACHE_MAX_SIZE = 300;
function getTemplateCardCacheKey(accountId, taskId) {
    return `${accountId}:${taskId}`;
}
function pruneTemplateCardCache() {
    const now = Date.now();
    for (const [key, entry] of sentTemplateCardByTaskId) {
        if (now - entry.createdAt >= TEMPLATE_CARD_CACHE_TTL_MS) {
            sentTemplateCardByTaskId.delete(key);
        }
    }
    if (sentTemplateCardByTaskId.size <= TEMPLATE_CARD_CACHE_MAX_SIZE) {
        return;
    }
    const sortedEntries = [...sentTemplateCardByTaskId.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
    const removeCount = sentTemplateCardByTaskId.size - TEMPLATE_CARD_CACHE_MAX_SIZE;
    for (const [key] of sortedEntries.slice(0, removeCount)) {
        sentTemplateCardByTaskId.delete(key);
    }
}
function cloneTemplateCard(card) {
    return JSON.parse(JSON.stringify(card));
}
function saveTemplateCardToCache(params) {
    const { accountId, templateCard, runtime } = params;
    const taskId = templateCard.task_id;
    if (!taskId) {
        runtime.log?.("[wecom][template-card] Skip cache: template card has no task_id");
        return;
    }
    sentTemplateCardByTaskId.set(getTemplateCardCacheKey(accountId, taskId), {
        templateCard: cloneTemplateCard(templateCard),
        createdAt: Date.now(),
    });
    pruneTemplateCardCache();
}
function getTemplateCardFromCache(accountId, taskId) {
    pruneTemplateCardCache();
    const cached = sentTemplateCardByTaskId.get(getTemplateCardCacheKey(accountId, taskId));
    if (!cached) {
        return undefined;
    }
    return cloneTemplateCard(cached.templateCard);
}
function buildSelectedOptionMap(templateCardEvent) {
    const selectedMap = new Map();
    const selectedItems = templateCardEvent?.selected_items?.selected_item ?? [];
    for (const item of selectedItems) {
        const questionKey = item.question_key?.trim();
        if (!questionKey) {
            continue;
        }
        const optionIds = item.option_ids?.option_id?.filter(Boolean) ?? [];
        selectedMap.set(questionKey, optionIds);
    }
    return selectedMap;
}
function applySelectedStateToTemplateCard(params) {
    const { templateCard, selectedMap, templateCardEvent } = params;
    const nextCard = cloneTemplateCard(templateCard);
    if (templateCardEvent?.task_id) {
        nextCard.task_id = templateCardEvent.task_id;
    }
    if (templateCardEvent?.card_type) {
        nextCard.card_type = templateCardEvent.card_type;
    }
    // 交互完成后将提交按钮文案更新为已提交，提升用户感知
    if (nextCard.submit_button?.text) {
        nextCard.submit_button.text = "已提交";
    }
    if (nextCard.checkbox?.question_key) {
        const selectedIds = selectedMap.get(nextCard.checkbox.question_key) ?? [];
        nextCard.checkbox.disable = true;
        if (Array.isArray(nextCard.checkbox.option_list)) {
            nextCard.checkbox.option_list = nextCard.checkbox.option_list.map((option) => ({
                ...option,
                is_checked: selectedIds.includes(option.id),
            }));
        }
    }
    if (Array.isArray(nextCard.select_list)) {
        nextCard.select_list = nextCard.select_list.map((selection) => {
            const selectedIds = selectedMap.get(selection.question_key) ?? [];
            return {
                ...selection,
                disable: true,
                selected_id: selectedIds[0] ?? selection.selected_id,
            };
        });
    }
    if (nextCard.button_selection?.question_key) {
        const selectedIds = selectedMap.get(nextCard.button_selection.question_key) ?? [];
        nextCard.button_selection.disable = true;
        if (selectedIds[0]) {
            nextCard.button_selection.selected_id = selectedIds[0];
        }
    }
    return nextCard;
}
async function updateTemplateCardOnEvent(params) {
    const { frame, accountId, runtime, wsClient } = params;
    const body = frame.body;
    const templateCardEvent = body.event?.template_card_event;
    const taskId = templateCardEvent?.task_id;
    if (!taskId) {
        runtime.log?.(`[${accountId}] [template-card-update] Skip update: missing task_id in callback`);
        return;
    }
    const cachedCard = getTemplateCardFromCache(accountId, taskId);
    if (!cachedCard) {
        runtime.log?.(`[${accountId}] [template-card-update] Skip update: task_id=${taskId} not found in cache`);
        return;
    }
    const selectedMap = buildSelectedOptionMap(templateCardEvent);
    const updatedCard = applySelectedStateToTemplateCard({
        templateCard: cachedCard,
        selectedMap,
        templateCardEvent,
    });
    await wsClient.updateTemplateCard(frame, updatedCard, [body.from.userid]);
    runtime.log?.(`[${accountId}] [template-card-update] Updated card by task_id=${taskId}`);
    // 将更新后的卡片写回缓存，后续多次点击时状态保持一致
    saveTemplateCardToCache({
        accountId,
        templateCard: updatedCard,
        runtime,
    });
}
// ============================================================================
// 媒体本地路径白名单扩展
// ============================================================================
/**
 * 解析 openclaw 状态目录（与 plugin-sdk 内部逻辑保持一致）
 */
function resolveStateDir() {
    const stateOverride = process.env.OPENCLAW_STATE_DIR?.trim() || process.env.CLAWDBOT_STATE_DIR?.trim();
    if (stateOverride)
        return stateOverride;
    return path$1.join(os$1.homedir(), ".openclaw");
}
/**
 * 在 getDefaultMediaLocalRoots() 基础上，将 stateDir 本身也加入白名单，
 * 并合并用户在 WeComConfig 中配置的自定义 mediaLocalRoots。
 *
 * getDefaultMediaLocalRoots() 仅包含 stateDir 下的子目录（media/agents/workspace/sandboxes），
 * 但 agent 生成的文件可能直接放在 stateDir 根目录下（如 ~/.openclaw-dev/1.png），
 * 因此需要将 stateDir 本身也加入白名单以避免 LocalMediaAccessError。
 *
 * 用户可在 openclaw.json 中配置：
 * {
 *   "channels": {
 *     "wecom": {
 *       "mediaLocalRoots": ["~/Downloads", "~/Documents"]
 *     }
 *   }
 * }
 */
async function getExtendedMediaLocalRoots(config) {
    // 从兼容层获取默认白名单（内部已处理低版本 SDK 的 fallback）
    const defaults = await getDefaultMediaLocalRoots();
    const roots = [...defaults];
    const stateDir = path$1.resolve(resolveStateDir());
    if (!roots.includes(stateDir)) {
        roots.push(stateDir);
    }
    // 合并用户在 WeComConfig 中配置的自定义路径
    if (config?.mediaLocalRoots) {
        for (const r of config.mediaLocalRoots) {
            const resolved = path$1.resolve(r.replace(/^~(?=\/|$)/, os$1.homedir()));
            if (!roots.includes(resolved)) {
                roots.push(resolved);
            }
        }
    }
    return roots;
}
// ============================================================================
// 媒体发送错误提示
// ============================================================================
/**
 * 根据媒体发送结果生成纯文本错误摘要（用于替换 thinking 流式消息展示给用户）。
 *
 * 使用纯文本而非 markdown 格式，因为 replyStream 只支持纯文本。
 */
function buildMediaErrorSummary(mediaUrl, result) {
    if (result.error?.includes("LocalMediaAccessError")) {
        return `⚠️ 文件发送失败：没有权限访问路径 ${mediaUrl}\n请在 openclaw.json 的 mediaLocalRoots 中添加该路径的父目录后重启生效。`;
    }
    if (result.rejectReason) {
        return `⚠️ 文件发送失败：${result.rejectReason}`;
    }
    return `⚠️ 文件发送失败：无法处理文件 ${mediaUrl}，请稍后再试。`;
}
// ============================================================================
// 消息上下文构建
// ============================================================================
/**
 * 构建消息上下文
 */
function buildMessageContext(frame, account, config, text, mediaList, quoteContent) {
    const core = getWeComRuntime();
    const body = frame.body;
    const chatId = body.chatid || body.from.userid;
    const chatType = body.chattype === "group" ? "group" : "direct";
    // 解析路由信息
    const route = core.channel.routing.resolveAgentRoute({
        cfg: config,
        channel: CHANNEL_ID,
        accountId: account.accountId,
        peer: {
            kind: chatType,
            id: chatId,
        },
    });
    // 构建会话标签
    const fromLabel = chatType === "group" ? `group:${chatId}` : `user:${body.from.userid}`;
    // 当只有媒体没有文本时，使用占位符标识媒体类型
    const hasImages = mediaList.some((m) => m.contentType?.startsWith("image/"));
    const messageBody = text || (mediaList.length > 0 ? (hasImages ? MEDIA_IMAGE_PLACEHOLDER : MEDIA_DOCUMENT_PLACEHOLDER) : "");
    // 构建多媒体数组
    const mediaPaths = mediaList.length > 0 ? mediaList.map((m) => m.path) : undefined;
    const mediaTypes = mediaList.length > 0
        ? mediaList.map((m) => m.contentType).filter(Boolean)
        : undefined;
    // 构建标准消息上下文
    return core.channel.reply.finalizeInboundContext({
        Body: messageBody,
        RawBody: messageBody,
        CommandBody: messageBody,
        MessageSid: body.msgid,
        From: chatType === "group" ? `${CHANNEL_ID}:group:${chatId}` : `${CHANNEL_ID}:${body.from.userid}`,
        To: `${CHANNEL_ID}:${chatId}`,
        SenderId: body.from.userid,
        SessionKey: route.sessionKey,
        AccountId: account.accountId,
        ChatType: chatType,
        ConversationLabel: fromLabel,
        Timestamp: Date.now(),
        Provider: CHANNEL_ID,
        Surface: CHANNEL_ID,
        OriginatingChannel: CHANNEL_ID,
        OriginatingTo: `${CHANNEL_ID}:${chatId}`,
        CommandAuthorized: true,
        ResponseUrl: body.response_url,
        ReqId: frame.headers.req_id,
        WeComFrame: frame,
        MediaPath: mediaList[0]?.path,
        MediaType: mediaList[0]?.contentType,
        MediaPaths: mediaPaths,
        MediaTypes: mediaTypes,
        MediaUrls: mediaPaths,
        ReplyToBody: quoteContent,
    });
}
/**
 * 发送"思考中"消息
 */
async function sendThinkingReply(params) {
    const { wsClient, frame, streamId, runtime, state } = params;
    try {
        await sendWeComReply({
            wsClient,
            frame,
            text: THINKING_MESSAGE,
            runtime,
            finish: false,
            streamId,
        });
    }
    catch (err) {
        if (err instanceof StreamExpiredError && state) {
            state.streamExpired = true;
            runtime.log?.(`[wecom] Stream expired during thinking reply, will fallback to proactive send`);
        }
        else {
            runtime.error?.(`[wecom] Failed to send thinking message: ${String(err)}`);
        }
    }
}
/**
 * 上传并发送一批媒体文件（统一走主动发送通道）
 *
 * replyMedia（被动回复）无法覆盖 replyStream 发出的 thinking 流式消息，
 * 因此所有媒体统一走 aibot_send_msg 主动发送。
 */
async function sendMediaBatch(ctx, mediaUrls) {
    const { wsClient, frame, state, account, runtime } = ctx;
    const body = frame.body;
    const chatId = body.chatid || body.from.userid;
    const mediaLocalRoots = await getExtendedMediaLocalRoots(account.config);
    runtime.log?.(`[wecom][debug] mediaLocalRoots=${JSON.stringify(mediaLocalRoots)}, mediaUrls=${JSON.stringify(mediaUrls)}`);
    for (const mediaUrl of mediaUrls) {
        const result = await uploadAndSendMedia({
            wsClient,
            mediaUrl,
            chatId,
            mediaLocalRoots,
            log: (...args) => runtime.log?.(...args),
            errorLog: (...args) => runtime.error?.(...args),
        });
        if (result.ok) {
            state.hasMedia = true;
        }
        else {
            state.hasMediaFailed = true;
            runtime.error?.(`[wecom] Media send failed: url=${mediaUrl}, reason=${result.rejectReason || result.error}`);
            // 收集错误摘要，后续在 finishThinkingStream 中直接替换 thinking 流展示给用户
            const summary = buildMediaErrorSummary(mediaUrl, result);
            state.mediaErrorSummary = state.mediaErrorSummary
                ? `${state.mediaErrorSummary}\n\n${summary}`
                : summary;
        }
    }
}
/**
 * 关闭 thinking 流（发送 finish=true 的流式消息）
 *
 * thinking 是通过 replyStream 用 streamId 发的流式消息，
 * 只有同一 streamId 的 replyStream(finish=true) 才能关闭它。
 *
 * ⚠️ 注意：企微会忽略空格等不可见内容，必须用有可见字符的文案才能真正
 *    替换掉 thinking 动画，否则 thinking 会一直残留。
 *
 * 关闭策略（按优先级）：
 * 0. [新增] 有模板卡片代码块 → 提取卡片并主动发送，用剩余文本关闭流
 * 1. 有可见文本 → 用完整文本关闭
 * 2. 有媒体成功发送（通过 deliver 回调） → 用友好提示"文件已发送"
 * 3. 媒体发送失败 → 直接用错误摘要替换 thinking
 * 4. 其他 → 用通用"处理完成"提示
 *    （agent 可能已通过内置 message 工具直接发送了文件，
 *    该路径走 outbound.sendMedia 完全绕过 deliver 回调，
 *    所以 state 中无记录，但文件已实际送达）
 *
 * 降级策略：
 * - 当 streamExpired=true（errcode 846608）时，流式通道已不可用（>6分钟），
 *   改用 wsClient.sendMessage 主动发送完整文本。
 */
async function finishThinkingStream(ctx) {
    const { wsClient, frame, state, runtime } = ctx;
    const body = frame.body;
    const chatId = body.chatid || body.from.userid;
    const visibleText = stripThinkTags(state.accumulatedText);
    // ── 模板卡片检测与发送 ──────────────────────────────────────────────
    // 在确定 finishText 之前，先检查累积文本中是否包含模板卡片 JSON 代码块。
    // 若检测到合法卡片，通过 sendMessage 主动发送后，用剩余文本关闭流。
    if (visibleText) {
        runtime.log?.(`[wecom][template-card] finishThinkingStream: visibleText exists, length=${visibleText.length}, running extractTemplateCards...`);
        const logFn = (...args) => {
            runtime.log?.(...args);
        };
        const { cards, remainingText } = extractTemplateCards(state.accumulatedText, logFn);
        runtime.log?.(`[wecom][template-card] finishThinkingStream: extractTemplateCards result — cards=${cards.length}, remainingTextLength=${remainingText.length}`);
        if (cards.length > 0) {
            runtime.log?.(`[wecom][template-card] finishThinkingStream: ${cards.length} card(s) detected, card_types=[${cards.map(c => c.cardType).join(", ")}]`);
            await sendTemplateCards(ctx, cards);
            // 用剩余文本关闭流（可能为空）
            const trimmedRemaining = stripThinkTags(remainingText);
            const finishText = trimmedRemaining
                ? remainingText
                : (state.hasTemplateCard ? "📋 卡片消息已发送。" : "");
            runtime.log?.(`[wecom][template-card] finishThinkingStream: closing stream with finishText="${finishText.slice(0, 100)}...", hasTemplateCard=${state.hasTemplateCard}`);
            await sendWeComReply({ wsClient, frame, text: finishText, runtime, finish: true, streamId: state.streamId });
            return;
        }
    }
    else {
        runtime.log?.(`[wecom][template-card] finishThinkingStream: no visibleText, skipping template card extraction`);
    }
    // ── 模板卡片检测结束 ────────────────────────────────────────────────
    let finishText = state.accumulatedText;
    if (visibleText) {
        // 有可见文本：用完整文本关闭流（覆盖 thinking 为真实内容）
        finishText = state.accumulatedText;
    }
    else if (state.hasMedia) {
        if (state.hasMediaFailed && state.mediaErrorSummary) {
            // 媒体成功发送：用友好提示告知用户
            finishText = finishText ? `${finishText}\n\n${state.mediaErrorSummary}` : state.mediaErrorSummary;
        }
        else if (!finishText) {
            finishText = "📎 文件已发送，请查收。";
        }
    }
    // if (!finishText) {
    //   finishText = "✅ 处理完成。";
    // }
    if (finishText) {
        // 尝试流式发送；若已知过期或发送时发现过期，统一降级为主动发送
        let expired = state.streamExpired;
        if (!expired) {
            try {
                await sendWeComReply({ wsClient, frame, text: finishText, runtime, finish: true, streamId: state.streamId });
            }
            catch (err) {
                if (err instanceof StreamExpiredError) {
                    expired = true;
                }
                else {
                    throw err;
                }
            }
        }
        if (expired) {
            runtime.log?.(`[wecom] Stream expired, sending final text via sendMessage (proactive)`);
            await wsClient.sendMessage(chatId, {
                msgtype: "markdown",
                markdown: { content: finishText },
            });
        }
    }
}
/**
 * 逐个发送已提取的模板卡片（通过 wsClient.sendMessage 主动推送）
 *
 * 发送失败不阻塞流程，仅记录错误日志。
 */
async function sendTemplateCards(ctx, cards) {
    const { wsClient, frame, state, runtime, account } = ctx;
    const body = frame.body;
    const chatId = body.chatid || body.from.userid;
    for (const card of cards) {
        try {
            runtime.log?.(`[wecom][template-card] Sending card_type=${card.cardType} to chatId=${chatId}`);
            const rawTemplateCard = card.cardJson;
            if (typeof rawTemplateCard.card_type !== "string") {
                runtime.error?.("[wecom][template-card] Skip sending invalid card: missing card_type");
                continue;
            }
            const templateCard = rawTemplateCard;
            await wsClient.sendMessage(chatId, {
                msgtype: "template_card",
                template_card: templateCard,
            });
            state.hasTemplateCard = true;
            saveTemplateCardToCache({
                accountId: account.accountId,
                templateCard,
                runtime,
            });
            runtime.log?.(`[wecom][template-card] Card sent successfully: card_type=${card.cardType}`);
        }
        catch (err) {
            runtime.error?.(`[wecom][template-card] Failed to send card: card_type=${card.cardType}, error=${JSON.stringify(err)}`);
        }
    }
}
/**
 * 路由消息到核心处理流程并处理回复
 */
async function routeAndDispatchMessage(params) {
    const { ctxPayload, config, account, wsClient, frame, state, runtime, onCleanup } = params;
    const core = getWeComRuntime();
    const ctx = { wsClient, frame, state, account, runtime };
    // 防止 onCleanup 被多次调用（onError 回调与 catch 块可能重复触发）
    let cleanedUp = false;
    const safeCleanup = () => {
        if (!cleanedUp) {
            cleanedUp = true;
            onCleanup();
        }
    };
    let isShowThink = !(account.sendThinkingMessage ?? true);
    try {
        await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
            ctx: ctxPayload,
            cfg: config,
            // replyResolver: async (ctx, opts) => {
            //   const startTime = Date.now();
            //   const TEN_MINUTES = 7 * 60 * 1000;
            //
            //   console.log('开始输出内容');
            //
            //   while (Date.now() - startTime < TEN_MINUTES) {
            //     // 每隔一段时间发送一个 block reply
            //     await opts?.onBlockReply?.({ text: `输出内容 ${new Date().toISOString()}` });
            //     await new Promise(resolve => setTimeout(resolve, 30 * 1000)); // 每5秒输出一次
            //   }
            //
            //   return { text: "10分钟输出完成" }; // 最终回复
            // },
            dispatcherOptions: {
                onReplyStart: async () => {
                    if (!isShowThink && state.streamId && !state.accumulatedText) {
                        try {
                            await sendThinkingReply({ wsClient, frame, streamId: state.streamId, runtime, state });
                        }
                        catch (e) {
                            runtime.error?.(`[wecom] sendThinkingReply threw err: ${String(e)}`);
                        }
                        isShowThink = true;
                    }
                },
                deliver: async (payload, info) => {
                    state.deliverCalled = true;
                    // runtime.log?.(`[openclaw -> plugin] kind=${info.kind}, text=${payload.text ?? ''}, mediaUrl=${payload.mediaUrl ?? ''}, mediaUrls=${JSON.stringify(payload.mediaUrls ?? [])}`);
                    // 累积文本
                    if (payload.text) {
                        state.accumulatedText += (payload.text || '');
                    }
                    // 发送媒体（统一走主动发送）
                    const mediaUrls = payload.mediaUrls?.length ? payload.mediaUrls : payload.mediaUrl ? [payload.mediaUrl] : [];
                    if (mediaUrls.length > 0) {
                        try {
                            await sendMediaBatch(ctx, mediaUrls);
                        }
                        catch (mediaErr) {
                            // sendMediaBatch 内部异常（如 getDefaultMediaLocalRoots 不可用等）
                            // 必须标记 state，否则 finishThinkingStream 会显示"处理完成"误导用户
                            state.hasMediaFailed = true;
                            const errMsg = String(mediaErr);
                            const summary = `⚠️ 文件发送失败：内部处理异常，请升级 openclaw 到最新版本后重试。\n错误详情：${errMsg}`;
                            state.mediaErrorSummary = state.mediaErrorSummary
                                ? `${state.mediaErrorSummary}\n\n${summary}`
                                : summary;
                            runtime.error?.(`[wecom] sendMediaBatch threw: ${errMsg}`);
                        }
                    }
                    // 中间帧：有可见文本时流式更新（流式过期后跳过，等 deliver 完成后主动发送）
                    // 使用 maskTemplateCardBlocks 遮罩正在构建中的模板卡片代码块，
                    // 避免 JSON 源码在流式输出过程中暴露给终端用户
                    if (info.kind !== "final" && state.accumulatedText && !state.streamExpired) {
                        try {
                            const displayText = maskTemplateCardBlocks(state.accumulatedText, (...args) => runtime.log?.(...args));
                            if (displayText !== state.accumulatedText) {
                                runtime.log?.(`[wecom][template-card] Mid-frame masked: original=${state.accumulatedText.length}chars, masked=${displayText.length}chars`);
                            }
                            await sendWeComReply({ wsClient, frame, text: displayText, runtime, finish: false, streamId: state.streamId });
                        }
                        catch (err) {
                            if (err instanceof StreamExpiredError) {
                                state.streamExpired = true;
                                runtime.log?.(`[wecom] Stream expired during intermediate reply, will fallback to proactive send`);
                            }
                            else {
                                throw err;
                            }
                        }
                    }
                },
                onError: (err, info) => {
                    runtime.error?.(`[wecom] ${info.kind} reply failed: ${String(err)}`);
                },
            },
        });
        // 关闭 thinking 流
        await finishThinkingStream(ctx);
        safeCleanup();
    }
    catch (err) {
        runtime.error?.(`[wecom][plugin] Failed to process message: ${String(err)}`);
        // 即使 dispatch 抛异常，也需要关闭 thinking 流，
        // 避免 deliver 已成功发送媒体但后续出错时 thinking 消息残留或被错误文案覆盖
        try {
            await finishThinkingStream(ctx);
        }
        catch (finishErr) {
            runtime.error?.(`[wecom] Failed to finish thinking stream after dispatch error: ${String(finishErr)}`);
        }
        safeCleanup();
    }
}
/**
 * 处理企业微信消息（主函数）
 *
 * 处理流程：
 * 1. 解析消息内容（文本、图片、引用）
 * 2. 群组策略检查（仅群聊）
 * 3. DM Policy 访问控制检查（仅私聊）
 * 4. 下载并保存图片
 * 5. 初始化消息状态
 * 6. 发送"思考中"消息
 * 7. 路由消息到核心处理流程
 *
 * 整体带超时保护，防止单条消息处理阻塞过久
 */
async function processWeComMessage(params) {
    const { frame, account, config, runtime, wsClient } = params;
    const body = frame.body;
    const chatId = body.chatid || body.from.userid;
    const chatType = body.chattype === "group" ? "group" : "direct";
    const messageId = body.msgid;
    const reqId = frame.headers.req_id;
    // Step 1: 解析消息内容
    const { textParts, imageUrls, imageAesKeys, fileUrls, fileAesKeys, quoteContent } = parseMessageContent(body);
    let text = textParts.join("\n").trim();
    // // 群聊中移除 @机器人 的提及标记
    // if (body.chattype === "group") {
    //   text = text.replace(/@\S+/g, "").trim();
    // }
    // 如果文本为空但存在引用消息，使用引用消息内容
    if (!text && quoteContent) {
        text = quoteContent;
        runtime.log?.("[wecom][plugin] Using quote content as message body (user only mentioned bot)");
    }
    // 如果既没有文本也没有图片也没有文件也没有引用内容，则跳过
    if (!text && imageUrls.length === 0 && fileUrls.length === 0) {
        runtime.log?.("[wecom][plugin] Skipping empty message (no text, image, file or quote)");
        return;
    }
    // Step 2: 群组策略检查（仅群聊）
    if (chatType === "group") {
        const groupPolicyResult = checkGroupPolicy({
            chatId,
            senderId: body.from.userid,
            account,
            config,
            runtime,
        });
        if (!groupPolicyResult.allowed) {
            return;
        }
    }
    // Step 3: DM Policy 访问控制检查（仅私聊）
    const dmPolicyResult = await checkDmPolicy({
        senderId: body.from.userid,
        isGroup: chatType === "group",
        account,
        wsClient,
        frame,
        runtime,
    });
    if (!dmPolicyResult.allowed) {
        return;
    }
    // Step 4: 下载并保存图片和文件
    const [imageMediaList, fileMediaList] = await Promise.all([
        downloadAndSaveImages({
            imageUrls,
            imageAesKeys,
            account,
            config,
            runtime,
            wsClient,
        }),
        downloadAndSaveFiles({
            fileUrls,
            fileAesKeys,
            account,
            config,
            runtime,
            wsClient,
        }),
    ]);
    const mediaList = [...imageMediaList, ...fileMediaList];
    // Step 5: 初始化消息状态
    setReqIdForChat(chatId, reqId, account.accountId);
    const streamId = generateReqId("stream");
    const state = { accumulatedText: "", streamId };
    setMessageState(messageId, state);
    const cleanupState = () => {
        deleteMessageState(messageId);
    };
    // // Step 6: 发送"思考中"消息
    // const shouldSendThinking = account.sendThinkingMessage ?? true;
    // if (shouldSendThinking) {
    //   await sendThinkingReply({ wsClient, frame, streamId, runtime });
    // }
    // Step 7: 构建上下文并路由到核心处理流程（带整体超时保护）
    const ctxPayload = buildMessageContext(frame, account, config, text, mediaList, quoteContent);
    // runtime.log?.(`[plugin -> openclaw] body=${text}, mediaPaths=${JSON.stringify(mediaList.map(m => m.path))}${quoteContent ? `, quote=${quoteContent}` : ''}`);
    try {
        await routeAndDispatchMessage({
            ctxPayload,
            config,
            account,
            wsClient,
            frame,
            state,
            runtime,
            onCleanup: cleanupState,
        });
    }
    catch (err) {
        runtime.error?.(`[wecom][plugin] Message processing failed: ${String(err)}`);
        cleanupState();
    }
}
// ============================================================================
// 创建 SDK Logger 适配器
// ============================================================================
/**
 * 创建适配 RuntimeEnv 的 Logger
 */
function createSdkLogger(runtime, accountId) {
    return {
        debug: (message, ...args) => {
            runtime.log?.(`[${accountId}] ${message}`, ...args);
        },
        info: (message, ...args) => {
            runtime.log?.(`[${accountId}] ${message}`, ...args);
        },
        warn: (message, ...args) => {
            runtime.log?.(`[${accountId}] WARN: ${message}`, ...args);
        },
        error: (message, ...args) => {
            runtime.error?.(`[${accountId}] ${message}`, ...args);
        },
    };
}
// ============================================================================
// 主函数
// ============================================================================
/**
 * 监听企业微信 WebSocket 连接
 * 使用 aibot-node-sdk 简化连接管理
 */
async function monitorWeComProvider(options) {
    const { account, config, runtime, abortSignal, setStatus } = options;
    runtime.log?.(`[${account.accountId}] [${PLUGIN_VERSION}] Initializing WSClient with SDK...`);
    runtime.error?.(`[${account.accountId}] [diag] monitor boot marker: build=20260325-event-debug-1`);
    // 启动消息状态定期清理
    startMessageStateCleanup();
    return new Promise((resolve, reject) => {
        const logger = createSdkLogger(runtime, account.accountId);
        const wsClient = new WSClient({
            botId: account.botId,
            secret: account.secret,
            wsUrl: account.websocketUrl,
            logger,
            heartbeatInterval: WS_HEARTBEAT_INTERVAL_MS,
            maxReconnectAttempts: WS_MAX_RECONNECT_ATTEMPTS,
            maxAuthFailureAttempts: WS_MAX_AUTH_FAILURE_ATTEMPTS,
            scene: SCENE_WECOM_OPENCLAW,
            plug_version: PLUGIN_VERSION,
        });
        // 防止 cleanup 被多次调用（abort handler、error handler、disconnected_event 可能竞态触发）
        let cleanedUp = false;
        // 清理函数：确保所有资源被释放（幂等）
        const cleanup = async () => {
            if (cleanedUp)
                return;
            cleanedUp = true;
            stopMessageStateCleanup();
            await cleanupAccount(account.accountId);
        };
        // 处理中止信号（框架 stopChannel 会触发 abort）
        // resolve() 让 Promise settle → 框架清理 store.tasks/store.aborts
        if (abortSignal) {
            abortSignal.addEventListener("abort", async () => {
                runtime.log?.(`[${account.accountId}] Connection aborted`);
                wsClient.disconnect();
                await cleanup();
                resolve();
            });
        }
        // 监听连接事件
        wsClient.on("connected", () => {
            runtime.log?.(`[${account.accountId}] WebSocket connected`);
        });
        // 监听认证成功事件
        wsClient.on("authenticated", () => {
            runtime.log?.(`[${account.accountId}] Authentication successful`);
            setWeComWebSocket(account.accountId, wsClient);
        });
        // 监听断开事件
        wsClient.on("disconnected", (reason) => {
            runtime.log?.(`[${account.accountId}] WebSocket disconnected: ${reason}`);
        });
        // 监听被踢下线事件（服务端因新连接建立而主动断开旧连接）
        //
        // SDK 内部已设置 isManualClose=true 阻止 SDK 层自动重连，连接不会自行恢复。
        // **不 reject/resolve Promise**——保持 pending 以阻止框架层 auto-restart。
        //
        // 为什么不能 reject/resolve：
        //   - reject → 框架 auto-restart 介入 → 新连接建立 → 又被踢 → 两个实例互踢无限循环
        //   - resolve → 同上，框架 .then() 中的 auto-restart 也会触发
        //
        // Promise pending 的安全性：
        //   - store.tasks.has(id) = true → 阻止 Health Monitor 直接 startChannel（startChannel 检查 tasks.has）
        //   - 框架 stopChannel → abort() → abort handler 中 resolve() → tasks 正常清理
        //   - 用户修改配置 → config reload → stopChannel + startChannel → 正常恢复
        //
        // 显式调用 wsClient.disconnect() 确保 SDK 内部资源（定时器、队列等）完全释放。
        wsClient.on("event.disconnected_event", async () => {
            const errorMsg = `Kicked by server: a new connection was established elsewhere. Auto-restart is suppressed to avoid mutual kicking. Please check for duplicate instances.`;
            runtime.error?.(`[${account.accountId}] ${errorMsg}`);
            wsClient.disconnect();
            await cleanup();
            setStatus?.({
                accountId: account.accountId,
                running: false,
                lastError: errorMsg,
                lastStopAt: Date.now(),
            });
            // Promise 保持 pending，不触发 auto-restart
        });
        // 监听重连事件
        wsClient.on("reconnecting", (attempt) => {
            runtime.log?.(`[${account.accountId}] Reconnecting attempt ${attempt}...`);
        });
        // 监听错误事件
        wsClient.on("error", async (error) => {
            runtime.error?.(`[${account.accountId}] WebSocket error: ${error.message}`);
            if (error instanceof WSAuthFailureError) {
                // 认证失败重试次数用尽（SDK 层已重试 WS_MAX_AUTH_FAILURE_ATTEMPTS 次）。
                // 配置错误（如 botId/secret 无效），框架 auto-restart 也无法恢复。
                //
                // **不 reject/resolve Promise**——保持 pending 以阻止框架层 auto-restart。
                //
                // 为什么不能 reject/resolve：
                //   - reject/resolve → 框架 auto-restart（最多 10 次）× SDK 重试（5 次）= 60 次无意义尝试
                //   - 且 Health Monitor 每小时还会 resetRestartAttempts 再来一轮
                //
                // Promise pending 的安全性：同被踢下线场景
                //   - store.tasks.has(id) = true → 阻止 Health Monitor 直接 startChannel
                //   - 框架 stopChannel / config reload → abort handler 中 resolve() → 正常清理
                //   - 用户修改配置后框架通过 reload 机制重新启动
                const errorMsg = `Auth failure attempts exhausted (${WS_MAX_AUTH_FAILURE_ATTEMPTS} attempts). Please check botId/secret configuration.`;
                runtime.error?.(`[${account.accountId}] ${errorMsg}`);
                wsClient.disconnect();
                await cleanup();
                setStatus?.({
                    accountId: account.accountId,
                    running: false,
                    lastError: errorMsg,
                    lastStopAt: Date.now(),
                });
                return;
            }
            if (error instanceof WSReconnectExhaustedError) {
                // 网络断线重连次数用尽（SDK 层已重试 WS_MAX_RECONNECT_ATTEMPTS 次）。
                // 通常是网络/服务端问题，框架 auto-restart 可能恢复。
                //
                // reject Promise → 框架 auto-restart 介入（最多 MAX_RESTART_ATTEMPTS=10 次）
                // 总连接尝试次数 = (1 首次 + WS_MAX_RECONNECT_ATTEMPTS 重连) × (1 首轮 + 10 auto-restart)
                //                = 11 × 11 = 121 次
                //
                // 如果 Health Monitor 介入（每 5 分钟检查），会 resetRestartAttempts 重新计数，
                // 受限于 DEFAULT_MAX_RESTARTS_PER_HOUR=10，每小时最多额外 10 × 121 = 1210 次。
                // 但因网络断线通常是暂时性的，auto-restart + Health Monitor 的兜底机制是合理的。
                //
                // 显式调用 wsClient.disconnect() 确保 SDK 内部资源完全释放，
                // 避免旧实例的定时器/队列残留。
                wsClient.disconnect();
                cleanup().finally(() => reject(error));
                return;
            }
        });
        // 监听版本检查事件：收到 enter_check_update 时回复当前插件版本
        wsClient.on(EVENT_ENTER_CHECK_UPDATE, async (frame) => {
            try {
                // runtime.log?.(`[${account.accountId}] Received enter_check_update, replying with version=${PLUGIN_VERSION}`);
                await wsClient.reply(frame, { version: PLUGIN_VERSION }, CMD_ENTER_EVENT_REPLY);
            }
            catch (err) {
                // runtime.error?.(`[${account.accountId}] Failed to reply enter_check_update: ${String(err)}`);
            }
        });
        // 监听普通消息
        wsClient.on("message", async (frame) => {
            try {
                await processWeComMessage({
                    frame,
                    account,
                    config,
                    runtime,
                    wsClient,
                });
            }
            catch (err) {
                runtime.error?.(`[${account.accountId}] Failed to process message: ${String(err)}`);
            }
        });
        // 监听所有事件回调（aibot_event_callback）。
        // 这里使用通用 event 监听，再按 eventtype 分发，兼容不同 SDK 版本在细分事件名上的差异。
        wsClient.on("event", async (frame) => {
            try {
                const eventBody = frame.body;
                const eventType = eventBody.event?.eventtype;
                runtime.log?.(`[${account.accountId}] Received event callback: eventtype=${eventType ?? ""}, msgid=${eventBody.msgid ?? ""}`);
                runtime.error?.(`[${account.accountId}] [diag] event-listener fired: eventtype=${eventType ?? ""}, msgid=${eventBody.msgid ?? ""}`);
                if (eventType !== "template_card_event") {
                    return;
                }
                const templateCardEvent = eventBody.event?.template_card_event;
                runtime.log?.(`[${account.accountId}] Received template_card_event: event_key=${templateCardEvent?.event_key ?? ""}, task_id=${templateCardEvent?.task_id ?? ""}`);
                try {
                    await updateTemplateCardOnEvent({
                        frame,
                        accountId: account.accountId,
                        runtime,
                        wsClient,
                    });
                }
                catch (updateErr) {
                    runtime.error?.(`[${account.accountId}] [template-card-update] Failed to update template card: ${String(updateErr)}`);
                }
                await processWeComMessage({
                    frame,
                    account,
                    config,
                    runtime,
                    wsClient,
                });
            }
            catch (err) {
                runtime.error?.(`[${account.accountId}] Failed to process template_card_event: ${String(err)}`);
            }
        });
        runtime.log?.(`[${account.accountId}] Event listeners attached: message + event(template_card_event)`);
        runtime.error?.(`[${account.accountId}] [diag] listeners-ready marker`);
        // 启动前预热 reqId 缓存，确保完成后再建立连接，避免 getSync 在预热完成前返回 undefined
        warmupReqIdStore(account.accountId, (...args) => runtime.log?.(...args))
            .then((count) => {
            runtime.log?.(`[${account.accountId}] Warmed up ${count} reqId entries from disk`);
        })
            .catch((err) => {
            runtime.error?.(`[${account.accountId}] Failed to warmup reqId store: ${String(err)}`);
        })
            .finally(() => {
            // 无论预热成功或失败，都建立连接
            wsClient.connect();
        });
    });
}

/**
 * 企业微信公共工具函数
 */
const DefaultWsUrl = "wss://openws.work.weixin.qq.com";
/**
 * 解析企业微信账户配置
 */
function resolveWeComAccount(cfg) {
    const wecomConfig = (cfg.channels?.[CHANNEL_ID] ?? {});
    return {
        accountId: DEFAULT_ACCOUNT_ID,
        name: wecomConfig.name ?? "企业微信",
        enabled: wecomConfig.enabled ?? false,
        websocketUrl: wecomConfig.websocketUrl || DefaultWsUrl,
        botId: wecomConfig.botId ?? "",
        secret: wecomConfig.secret ?? "",
        sendThinkingMessage: wecomConfig.sendThinkingMessage ?? true,
        config: wecomConfig,
    };
}
/**
 * 设置企业微信账户配置
 */
function setWeComAccount(cfg, account) {
    const existing = (cfg.channels?.[CHANNEL_ID] ?? {});
    const merged = {
        enabled: account.enabled ?? existing?.enabled ?? true,
        botId: account.botId ?? existing?.botId ?? "",
        secret: account.secret ?? existing?.secret ?? "",
        allowFrom: account.allowFrom ?? existing?.allowFrom,
        dmPolicy: account.dmPolicy ?? existing?.dmPolicy,
        // 以下字段仅在已有配置值或显式传入时才写入，onboarding 时不主动生成
        ...(account.websocketUrl || existing?.websocketUrl
            ? { websocketUrl: account.websocketUrl ?? existing?.websocketUrl }
            : {}),
        ...(account.name || existing?.name
            ? { name: account.name ?? existing?.name }
            : {}),
        ...(account.sendThinkingMessage !== undefined || existing?.sendThinkingMessage !== undefined
            ? { sendThinkingMessage: account.sendThinkingMessage ?? existing?.sendThinkingMessage }
            : {}),
    };
    return {
        ...cfg,
        channels: {
            ...cfg.channels,
            [CHANNEL_ID]: merged,
        },
    };
}

/**
 * 企业微信 setupWizard — 声明式 CLI setup wizard 配置。
 *
 * 框架通过 plugin.setupWizard 字段识别并驱动 channel 的引导配置流程。
 */
// ============================================================================
// ChannelSetupAdapter — 框架用于应用配置输入的适配器
// ============================================================================
const wecomSetupAdapter = {
    applyAccountConfig: ({ cfg, input }) => {
        const patch = {};
        if (input.token !== undefined) {
            patch.botId = String(input.token).trim();
        }
        if (input.privateKey !== undefined) {
            patch.secret = String(input.privateKey).trim();
        }
        // 如果是首次配置，默认启用
        const account = resolveWeComAccount(cfg);
        if (!account.botId && !account.secret) {
            patch.enabled = true;
        }
        return setWeComAccount(cfg, patch);
    },
};
// ============================================================================
// DM Policy 配置
// ============================================================================
/**
 * 设置企业微信 dmPolicy
 */
function setWeComDmPolicy(cfg, dmPolicy) {
    const account = resolveWeComAccount(cfg);
    const existingAllowFrom = account.config.allowFrom ?? [];
    const allowFrom = dmPolicy === "open"
        ? addWildcardAllowFrom(existingAllowFrom.map((x) => String(x)))
        : existingAllowFrom.map((x) => String(x));
    return setWeComAccount(cfg, {
        dmPolicy,
        allowFrom,
    });
}
const dmPolicy = {
    label: "企业微信",
    channel: CHANNEL_ID,
    policyKey: `channels.${CHANNEL_ID}.dmPolicy`,
    allowFromKey: `channels.${CHANNEL_ID}.allowFrom`,
    getCurrent: (cfg) => {
        const account = resolveWeComAccount(cfg);
        return account.config.dmPolicy ?? "open";
    },
    setPolicy: (cfg, policy) => {
        return setWeComDmPolicy(cfg, policy);
    },
    promptAllowFrom: async ({ cfg, prompter }) => {
        const account = resolveWeComAccount(cfg);
        const existingAllowFrom = account.config.allowFrom ?? [];
        const entry = await prompter.text({
            message: "企业微信允许来源（用户ID或群组ID，逗号分隔）",
            placeholder: "user123, group456",
            initialValue: existingAllowFrom[0] ? String(existingAllowFrom[0]) : undefined,
        });
        const allowFrom = String(entry ?? "")
            .split(/[\n,;]+/g)
            .map((s) => s.trim())
            .filter(Boolean);
        return setWeComAccount(cfg, { allowFrom });
    },
};
// ============================================================================
// ChannelSetupWizard — 声明式 setup wizard 配置
// ============================================================================
const wecomSetupWizard = {
    channel: CHANNEL_ID,
    // ── 状态 ──────────────────────────────────────────────────────────────
    status: {
        configuredLabel: "已配置 ✓",
        unconfiguredLabel: "需要 Bot ID 和 Secret",
        configuredHint: "已配置",
        unconfiguredHint: "需要设置",
        resolveConfigured: ({ cfg }) => {
            const account = resolveWeComAccount(cfg);
            return Boolean(account.botId?.trim() && account.secret?.trim());
        },
        resolveStatusLines: ({ cfg, configured }) => {
            return [`企业微信: ${configured ? "已配置" : "需要 Bot ID 和 Secret"}`];
        },
    },
    // ── 引导说明 ──────────────────────────────────────────────────────────
    introNote: {
        title: "企业微信设置",
        lines: [
            "企业微信机器人需要以下配置信息：",
            "1. Bot ID: 企业微信机器人 ID",
            "2. Secret: 企业微信机器人密钥",
        ],
        shouldShow: ({ cfg }) => {
            const account = resolveWeComAccount(cfg);
            return !account.botId?.trim() || !account.secret?.trim();
        },
    },
    // ── 凭据输入 ──────────────────────────────────────────────────────────
    credentials: [
        {
            inputKey: "token",
            providerHint: "企业微信",
            credentialLabel: "Bot ID",
            envPrompt: "使用环境变量中的 Bot ID？",
            keepPrompt: "Bot ID 已配置，保留当前值？",
            inputPrompt: "企业微信机器人 Bot ID",
            inspect: ({ cfg }) => {
                const account = resolveWeComAccount(cfg);
                const hasValue = Boolean(account.botId?.trim());
                return {
                    accountConfigured: hasValue,
                    hasConfiguredValue: hasValue,
                    resolvedValue: account.botId || undefined,
                };
            },
            applySet: ({ cfg, resolvedValue }) => {
                return setWeComAccount(cfg, { botId: resolvedValue });
            },
        },
        {
            inputKey: "privateKey",
            providerHint: "企业微信",
            credentialLabel: "Secret",
            envPrompt: "使用环境变量中的 Secret？",
            keepPrompt: "Secret 已配置，保留当前值？",
            inputPrompt: "企业微信机器人 Secret",
            inspect: ({ cfg }) => {
                const account = resolveWeComAccount(cfg);
                const hasValue = Boolean(account.secret?.trim());
                return {
                    accountConfigured: hasValue,
                    hasConfiguredValue: hasValue,
                    resolvedValue: account.secret || undefined,
                };
            },
            applySet: ({ cfg, resolvedValue }) => {
                return setWeComAccount(cfg, { secret: resolvedValue });
            },
        },
    ],
    // ── 完成后的最终处理 ──────────────────────────────────────────────────
    finalize: async ({ cfg }) => {
        // 确保配置完成后 channel 处于启用状态
        const account = resolveWeComAccount(cfg);
        if (account.botId?.trim() && account.secret?.trim() && !account.enabled) {
            return { cfg: setWeComAccount(cfg, { enabled: true }) };
        }
        return undefined;
    },
    // ── 完成提示 ──────────────────────────────────────────────────────────
    completionNote: {
        title: "企业微信配置完成",
        lines: [
            "企业微信机器人已配置完成。",
            "运行 `openclaw start` 启动服务。",
        ],
        shouldShow: ({ cfg }) => {
            const account = resolveWeComAccount(cfg);
            return Boolean(account.botId?.trim() && account.secret?.trim());
        },
    },
    // ── DM 策略 ──────────────────────────────────────────────────────────
    dmPolicy,
    // ── 禁用 ─────────────────────────────────────────────────────────────
    disable: (cfg) => {
        return setWeComAccount(cfg, { enabled: false });
    },
};

/**
 * 使用 SDK 的 sendMessage 主动发送企业微信消息
 * 无需依赖 reqId，直接向指定会话推送消息
 */
async function sendWeComMessage({ to, content, accountId, }) {
    const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;
    // 从 to 中提取 chatId（格式是 "${CHANNEL_ID}:chatId" 或直接是 chatId）
    const channelPrefix = new RegExp(`^${CHANNEL_ID}:`, "i");
    const chatId = to.replace(channelPrefix, "");
    // 获取 WSClient 实例
    const wsClient = getWeComWebSocket(resolvedAccountId);
    if (!wsClient) {
        throw new Error(`WSClient not connected for account ${resolvedAccountId}`);
    }
    // 使用 SDK 的 sendMessage 主动发送 markdown 消息
    const result = await wsClient.sendMessage(chatId, {
        msgtype: 'markdown',
        markdown: { content },
    });
    const messageId = result?.headers?.req_id ?? `wecom-${Date.now()}`;
    return {
        channel: CHANNEL_ID,
        messageId,
        chatId,
    };
}
// 企业微信频道元数据
const meta = {
    id: CHANNEL_ID,
    label: "企业微信",
    selectionLabel: "企业微信 (WeCom)",
    detailLabel: "企业微信智能机器人",
    docsPath: `/channels/${CHANNEL_ID}`,
    docsLabel: CHANNEL_ID,
    blurb: "企业微信智能机器人接入插件",
    systemImage: "message.fill",
};
const wecomPlugin = {
    id: CHANNEL_ID,
    meta: {
        ...meta,
        quickstartAllowFrom: true,
    },
    pairing: {
        idLabel: "wecomUserId",
        normalizeAllowEntry: (entry) => entry.replace(new RegExp(`^(${CHANNEL_ID}|user):`, "i"), "").trim(),
        notifyApproval: async ({ cfg, id }) => {
            // sendWeComMessage({
            //   to: id,
            //   content: " pairing approved",
            //   accountId: cfg.accountId,
            // });
            // Pairing approved for user
        },
    },
    setupWizard: wecomSetupWizard,
    setup: wecomSetupAdapter,
    capabilities: {
        chatTypes: ["direct", "group"],
        reactions: false,
        threads: false,
        media: true,
        nativeCommands: false,
        blockStreaming: true,
    },
    reload: { configPrefixes: [`channels.${CHANNEL_ID}`] },
    config: {
        // 列出所有账户 ID（最小实现只支持默认账户）
        listAccountIds: () => [DEFAULT_ACCOUNT_ID],
        // 解析账户配置
        resolveAccount: (cfg) => resolveWeComAccount(cfg),
        // 获取默认账户 ID
        defaultAccountId: () => DEFAULT_ACCOUNT_ID,
        // 设置账户启用状态
        setAccountEnabled: ({ cfg, enabled }) => {
            const wecomConfig = (cfg.channels?.[CHANNEL_ID] ?? {});
            return {
                ...cfg,
                channels: {
                    ...cfg.channels,
                    [CHANNEL_ID]: {
                        ...wecomConfig,
                        enabled,
                    },
                },
            };
        },
        // 删除账户
        deleteAccount: ({ cfg }) => {
            const wecomConfig = (cfg.channels?.[CHANNEL_ID] ?? {});
            const { botId, secret, ...rest } = wecomConfig;
            return {
                ...cfg,
                channels: {
                    ...cfg.channels,
                    [CHANNEL_ID]: rest,
                },
            };
        },
        // 检查是否已配置
        isConfigured: (account) => Boolean(account.botId?.trim() && account.secret?.trim()),
        // 描述账户信息
        describeAccount: (account) => ({
            accountId: account.accountId,
            name: account.name,
            enabled: account.enabled,
            configured: Boolean(account.botId?.trim() && account.secret?.trim()),
            botId: account.botId,
            websocketUrl: account.websocketUrl,
        }),
        // 解析允许来源列表
        resolveAllowFrom: ({ cfg }) => {
            const account = resolveWeComAccount(cfg);
            return (account.config.allowFrom ?? []).map((entry) => String(entry));
        },
        // 格式化允许来源列表
        formatAllowFrom: ({ allowFrom }) => allowFrom
            .map((entry) => String(entry).trim())
            .filter(Boolean),
    },
    security: {
        resolveDmPolicy: ({ account }) => {
            const basePath = `channels.${CHANNEL_ID}.`;
            return {
                policy: account.config.dmPolicy ?? "open",
                allowFrom: account.config.allowFrom ?? [],
                policyPath: `${basePath}dmPolicy`,
                allowFromPath: basePath,
                approveHint: formatPairingApproveHint(CHANNEL_ID),
                normalizeEntry: (raw) => raw.replace(new RegExp(`^${CHANNEL_ID}:`, "i"), "").trim(),
            };
        },
        collectWarnings: ({ account, cfg }) => {
            const warnings = [];
            // DM 策略警告
            const dmPolicy = account.config.dmPolicy ?? "open";
            if (dmPolicy === "open") {
                const hasWildcard = (account.config.allowFrom ?? []).some((entry) => String(entry).trim() === "*");
                if (!hasWildcard) {
                    warnings.push(`- 企业微信私信：dmPolicy="open" 但 allowFrom 未包含 "*"。任何人都可以发消息，但允许列表为空可能导致意外行为。建议设置 channels.${CHANNEL_ID}.allowFrom=["*"] 或使用 dmPolicy="pairing"。`);
                }
            }
            // 群组策略警告
            const defaultGroupPolicy = cfg.channels?.defaults?.groupPolicy;
            const groupPolicy = account.config.groupPolicy ?? defaultGroupPolicy ?? "open";
            // const { groupPolicy } = resolveOpenProviderRuntimeGroupPolicy({
            //   providerConfigPresent: true,
            //   groupPolicy: account.config.groupPolicy,
            //   defaultGroupPolicy,
            // });
            if (groupPolicy === "open") {
                warnings.push(`- 企业微信群组：groupPolicy="open" 允许所有群组中的成员触发。设置 channels.${CHANNEL_ID}.groupPolicy="allowlist" + channels.${CHANNEL_ID}.groupAllowFrom 来限制群组。`);
            }
            return warnings;
        },
    },
    messaging: {
        normalizeTarget: (target) => {
            const trimmed = target.trim();
            if (!trimmed)
                return undefined;
            return trimmed;
        },
        targetResolver: {
            looksLikeId: (id) => {
                const trimmed = id?.trim();
                return Boolean(trimmed);
            },
            hint: "<userId|groupId>",
        },
    },
    directory: {
        self: async () => null,
        listPeers: async () => [],
        listGroups: async () => [],
    },
    outbound: {
        deliveryMode: "gateway",
        chunker: (text, limit) => getWeComRuntime().channel.text.chunkMarkdownText(text, limit),
        textChunkLimit: TEXT_CHUNK_LIMIT,
        sendText: async ({ to, text, accountId }) => {
            return sendWeComMessage({ to, content: text, accountId: accountId ?? undefined });
        },
        sendMedia: async ({ to, text, mediaUrl, mediaLocalRoots, accountId }) => {
            const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;
            const channelPrefix = new RegExp(`^${CHANNEL_ID}:`, "i");
            const chatId = to.replace(channelPrefix, "");
            // 获取 WSClient 实例
            const wsClient = getWeComWebSocket(resolvedAccountId);
            if (!wsClient) {
                throw new Error(`WSClient not connected for account ${resolvedAccountId}`);
            }
            // 如果没有 mediaUrl，fallback 为纯文本
            if (!mediaUrl) {
                return sendWeComMessage({ to, content: text || "", accountId: resolvedAccountId });
            }
            const result = await uploadAndSendMedia({
                wsClient,
                mediaUrl,
                chatId,
                mediaLocalRoots,
            });
            if (result.rejected) {
                return sendWeComMessage({ to, content: `⚠️ ${result.rejectReason}`, accountId: resolvedAccountId });
            }
            if (!result.ok) {
                // 上传/发送失败，fallback 为文本 + URL
                const fallbackContent = text
                    ? `${text}\n📎 ${mediaUrl}`
                    : `📎 ${mediaUrl}`;
                return sendWeComMessage({ to, content: fallbackContent, accountId: resolvedAccountId });
            }
            // 如有伴随文本，额外发送一条 markdown
            if (text) {
                await sendWeComMessage({ to, content: text, accountId: resolvedAccountId });
            }
            // 如果有降级说明，额外发送提示
            if (result.downgradeNote) {
                await sendWeComMessage({ to, content: `ℹ️ ${result.downgradeNote}`, accountId: resolvedAccountId });
            }
            return {
                channel: CHANNEL_ID,
                messageId: result.messageId,
                chatId,
            };
        },
    },
    status: {
        defaultRuntime: {
            accountId: DEFAULT_ACCOUNT_ID,
            running: false,
            lastStartAt: null,
            lastStopAt: null,
            lastError: null,
        },
        collectStatusIssues: (accounts) => accounts.flatMap((entry) => {
            const accountId = String(entry.accountId ?? DEFAULT_ACCOUNT_ID);
            const enabled = entry.enabled !== false;
            const configured = entry.configured === true;
            if (!enabled) {
                return [];
            }
            const issues = [];
            if (!configured) {
                issues.push({
                    channel: CHANNEL_ID,
                    accountId,
                    kind: "config",
                    message: "企业微信机器人 ID 或 Secret 未配置",
                    fix: "Run: openclaw channels add wecom --bot-id <id> --secret <secret>",
                });
            }
            return issues;
        }),
        buildChannelSummary: ({ snapshot }) => ({
            configured: snapshot.configured ?? false,
            running: snapshot.running ?? false,
            lastStartAt: snapshot.lastStartAt ?? null,
            lastStopAt: snapshot.lastStopAt ?? null,
            lastError: snapshot.lastError ?? null,
        }),
        probeAccount: async () => {
            return { ok: true, status: 200 };
        },
        buildAccountSnapshot: ({ account, runtime }) => {
            const configured = Boolean(account.botId?.trim() &&
                account.secret?.trim());
            return {
                accountId: account.accountId,
                name: account.name,
                enabled: account.enabled,
                configured,
                running: runtime?.running ?? false,
                lastStartAt: runtime?.lastStartAt ?? null,
                lastStopAt: runtime?.lastStopAt ?? null,
                lastError: runtime?.lastError ?? null,
            };
        },
    },
    gateway: {
        startAccount: async (ctx) => {
            const account = ctx.account;
            // 启动 WebSocket 监听
            return monitorWeComProvider({
                account,
                config: ctx.cfg,
                runtime: ctx.runtime,
                abortSignal: ctx.abortSignal,
                setStatus: ctx.setStatus,
            });
        },
        logoutAccount: async ({ cfg }) => {
            const nextCfg = { ...cfg };
            const wecomConfig = (cfg.channels?.[CHANNEL_ID] ?? {});
            const nextWecom = { ...wecomConfig };
            let cleared = false;
            let changed = false;
            if (nextWecom.botId || nextWecom.secret) {
                delete nextWecom.botId;
                delete nextWecom.secret;
                cleared = true;
                changed = true;
            }
            if (changed) {
                if (Object.keys(nextWecom).length > 0) {
                    nextCfg.channels = { ...nextCfg.channels, [CHANNEL_ID]: nextWecom };
                }
                else {
                    const nextChannels = { ...nextCfg.channels };
                    delete nextChannels[CHANNEL_ID];
                    if (Object.keys(nextChannels).length > 0) {
                        nextCfg.channels = nextChannels;
                    }
                    else {
                        delete nextCfg.channels;
                    }
                }
                await getWeComRuntime().config.writeConfigFile(nextCfg);
            }
            const resolved = resolveWeComAccount(changed ? nextCfg : cfg);
            const loggedOut = !resolved.botId && !resolved.secret;
            return { cleared, envToken: false, loggedOut };
        },
    },
};

/**
 * MCP Streamable HTTP 传输层模块
 *
 * 负责:
 * - MCP JSON-RPC over HTTP 通信（发送请求、解析响应）
 * - Streamable HTTP session 生命周期管理（initialize 握手 → Mcp-Session-Id 维护 → 失效重建）
 * - 自动检测无状态 Server：如果 initialize 响应未返回 Mcp-Session-Id，
 *   则标记为无状态模式，后续请求跳过握手和 session 管理
 * - SSE 流式响应解析
 * - MCP 配置运行时缓存（通过 WSClient 拉取 URL 并缓存在内存中）
 */
// ============================================================================
// 内部状态
// ============================================================================
/** HTTP 请求超时时间（毫秒） */
const HTTP_REQUEST_TIMEOUT_MS = 30000;
/** 媒体下载请求超时时间（毫秒），base64 编码的媒体文件最大可达 ~27MB */
const MEDIA_DOWNLOAD_TIMEOUT_MS = 120000;
/** 日志前缀 */
const LOG_TAG = "[mcp]";
/**
 * MCP JSON-RPC 错误
 *
 * 携带服务端返回的 JSON-RPC error.code，
 * 用于上层按错误码进行差异化处理（如特定错误码触发缓存清理）。
 */
class McpRpcError extends Error {
    constructor(code, message, data) {
        super(message);
        this.code = code;
        this.data = data;
        this.name = "McpRpcError";
    }
}
/**
 * MCP HTTP 错误
 *
 * 携带 HTTP 状态码，用于精确判断 session 失效（404）等场景，
 * 避免通过字符串匹配 "404" 导致的误判。
 */
class McpHttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "McpHttpError";
    }
}
/**
 * 需要清理缓存的 JSON-RPC 错误码集合
 *
 * 当 MCP Server 返回以下错误码时，说明服务端状态已发生变化（如配置变更、
 * 服务重启等），需要清理对应 category 的全部缓存，确保下次请求重新
 * 拉取配置并重建会话。
 *
 * - -32001: 服务不可用（Server Unavailable）
 * - -32002: 配置已变更（Config Changed）
 * - -32003: 认证失败（Auth Failed）
 */
const CACHE_CLEAR_ERROR_CODES = new Set([-32001, -32002, -32003]);
/** MCP 配置缓存：category → response.body（完整配置） */
const mcpConfigCache = new Map();
/** Streamable HTTP 会话缓存：category → session */
const mcpSessionCache = new Map();
/** 已确认为无状态的 MCP Server 品类集合（跳过后续握手） */
const statelessCategories = new Set();
/** 正在进行中的 initialize 请求（防止并发重复初始化），key 为 category */
const inflightInitRequests = new Map();
// ============================================================================
// MCP 配置拉取与缓存
// ============================================================================
/**
 * 通过 WSClient 拉取指定 category 的 MCP 完整配置
 *
 * @param category - MCP 品类名称，如 doc、contact
 * @returns 完整的 response.body 配置对象（至少包含 url 字段）
 */
async function fetchMcpConfig(category) {
    const wsClient = getWeComWebSocket(DEFAULT_ACCOUNT_ID);
    if (!wsClient) {
        throw new Error("WSClient 未连接，无法拉取 MCP 配置");
    }
    const reqId = generateReqId("mcp_config");
    const response = await withTimeout(wsClient.reply({ headers: { req_id: reqId } }, { biz_type: category, plugin_version: PLUGIN_VERSION }, MCP_GET_CONFIG_CMD), MCP_CONFIG_FETCH_TIMEOUT_MS, `MCP config fetch for "${category}" timed out after ${MCP_CONFIG_FETCH_TIMEOUT_MS}ms`);
    if (response.errcode !== undefined && response.errcode !== 0) {
        const errMsg = `MCP 配置请求失败: errcode=${response.errcode}, errmsg=${response.errmsg ?? "unknown"}`;
        console.error(`${LOG_TAG} ${errMsg}`);
        throw new Error(errMsg);
    }
    const body = response.body;
    if (!body?.url) {
        throw new Error(`MCP 配置响应缺少 url 字段 (category="${category}")`);
    }
    console.log(`${LOG_TAG} 配置拉取成功 (category="${category}")`);
    return body;
}
/**
 * 获取指定品类的 MCP Server URL
 *
 * 优先从内存缓存中读取，未命中时通过 WSClient 拉取并缓存。
 *
 * @param category - MCP 品类名称
 * @returns MCP Server URL
 */
async function getMcpUrl(category) {
    // 查内存缓存
    const cached = mcpConfigCache.get(category);
    if (cached)
        return cached.url;
    // 缓存未命中，通过 WSClient 拉取
    const body = await fetchMcpConfig(category);
    // 写入缓存
    mcpConfigCache.set(category, body);
    console.log(`${LOG_TAG} getMcpUrl ${category}: ${body.url}`);
    return body.url;
}
// ============================================================================
// HTTP 底层通信
// ============================================================================
/**
 * 发送原始 HTTP 请求到 MCP Server（底层方法）
 *
 * 自动携带 Mcp-Session-Id 请求头（如果有），
 * 并从响应头中更新 sessionId。
 */
async function sendRawJsonRpc(url, session, body, timeoutMs = HTTP_REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const headers = {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
    };
    // Streamable HTTP：携带会话 ID
    if (session.sessionId) {
        headers["Mcp-Session-Id"] = session.sessionId;
    }
    let response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: controller.signal,
        });
    }
    catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
            throw new Error(`MCP 请求超时 (${timeoutMs}ms)`);
        }
        throw new Error(`MCP 网络请求失败: ${err instanceof Error ? err.message : String(err)}`);
    }
    finally {
        clearTimeout(timeoutId);
    }
    // 从响应头提取新的 sessionId（不直接修改入参，由调用方决定如何更新）
    const newSessionId = response.headers.get("mcp-session-id");
    if (!response.ok) {
        throw new McpHttpError(response.status, `MCP HTTP 请求失败: ${response.status} ${response.statusText}`);
    }
    // Streamable HTTP：notification 响应可能无响应体（204 或 content-length: 0）
    const contentLength = response.headers.get("content-length");
    if (response.status === 204 || contentLength === "0") {
        return { response, rpcResult: undefined, newSessionId };
    }
    const contentType = response.headers.get("content-type") ?? "";
    // 处理 SSE 流式响应
    if (contentType.includes("text/event-stream")) {
        return { response, rpcResult: await parseSseResponse(response), newSessionId };
    }
    // 普通 JSON 响应 — 先读取文本，防止空内容导致 JSON.parse 报错
    const text = await response.text();
    if (!text.trim()) {
        return { response, rpcResult: undefined, newSessionId };
    }
    const rpc = JSON.parse(text);
    if (rpc.error) {
        throw new McpRpcError(rpc.error.code, `MCP 调用错误 [${rpc.error.code}]: ${rpc.error.message}`, rpc.error.data);
    }
    return { response, rpcResult: rpc.result, newSessionId };
}
// ============================================================================
// Session 管理
// ============================================================================
/**
 * 对指定 URL 执行 Streamable HTTP 的 initialize 握手
 *
 * 发送 initialize → 接收 serverInfo → 发送 initialized 通知。
 * 如果服务端未返回 Mcp-Session-Id，则标记为无状态模式，后续请求跳过 session 管理。
 */
async function initializeSession(url, category) {
    const session = { sessionId: null, initialized: false, stateless: false };
    console.log(`${LOG_TAG} 开始 initialize 握手 (category="${category}")`);
    // 1. 发送 initialize 请求
    const initBody = {
        jsonrpc: "2.0",
        id: generateReqId("mcp_init"),
        method: "initialize",
        params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "wecom_mcp", version: "1.0.0" },
        },
    };
    const { newSessionId: initSessionId } = await sendRawJsonRpc(url, session, initBody);
    // 用返回的 newSessionId 更新 session（不再依赖副作用修改）
    if (initSessionId) {
        session.sessionId = initSessionId;
    }
    // 检查服务端是否返回了 Mcp-Session-Id
    // 如果没有返回，说明该 Server 是无状态实现，无需维护 session
    if (!session.sessionId) {
        session.stateless = true;
        session.initialized = true;
        statelessCategories.add(category);
        mcpSessionCache.set(category, session);
        console.log(`${LOG_TAG} 无状态 Server 确认 (category="${category}")`);
        return session;
    }
    // 2. 发送 initialized 通知（JSON-RPC notification 不带 id 字段）
    const notifyBody = {
        jsonrpc: "2.0",
        method: "notifications/initialized",
    };
    // initialized 通知不需要等待响应，但 Streamable HTTP 要求通过 POST 发送
    const { newSessionId: notifySessionId } = await sendRawJsonRpc(url, session, notifyBody);
    // 如果 initialized 通知的响应也携带了 sessionId，以最新的为准
    if (notifySessionId) {
        session.sessionId = notifySessionId;
    }
    session.initialized = true;
    mcpSessionCache.set(category, session);
    console.log(`${LOG_TAG} 有状态 Session 建立成功 (category="${category}", sessionId="${session.sessionId}")`);
    return session;
}
/**
 * 获取或创建指定 URL 的 MCP 会话
 *
 * - 已确认无状态的 category：直接返回空 session，跳过握手
 * - 已有可用有状态会话：直接返回缓存
 * - 其他情况：执行 initialize 握手，并发请求会被合并
 */
async function getOrCreateSession(url, category) {
    // 已确认为无状态的 Server，直接返回空 session 跳过握手
    if (statelessCategories.has(category)) {
        const cached = mcpSessionCache.get(category);
        if (cached)
            return cached;
        // 首次发现被清除（理论上不会走到这里），重新走握手探测
    }
    const cached = mcpSessionCache.get(category);
    if (cached?.initialized)
        return cached;
    // 防止并发重复初始化
    const inflight = inflightInitRequests.get(category);
    if (inflight)
        return inflight;
    const promise = initializeSession(url, category).finally(() => {
        inflightInitRequests.delete(category);
    });
    inflightInitRequests.set(category, promise);
    return promise;
}
// ============================================================================
// SSE 解析
// ============================================================================
/**
 * 解析 SSE 流式响应，提取最终的 JSON-RPC result
 *
 * 按照 SSE 规范，同一事件中的多个 `data:` 行会用换行符拼接。
 * 空行分隔不同事件，取最后一个完整事件的数据。
 */
async function parseSseResponse(response) {
    const text = await response.text();
    const lines = text.split("\n");
    // 按 SSE 规范解析：空行分隔事件，同一事件内的 data 行用换行拼接
    let currentDataParts = [];
    let lastEventData = "";
    for (const line of lines) {
        if (line.startsWith("data: ")) {
            currentDataParts.push(line.slice(6));
        }
        else if (line.startsWith("data:")) {
            // data: 后无空格时，值为空字符串
            currentDataParts.push(line.slice(5));
        }
        else if (line.trim() === "" && currentDataParts.length > 0) {
            // 空行表示事件结束，拼接所有 data 行
            lastEventData = currentDataParts.join("\n").trim();
            currentDataParts = [];
        }
    }
    // 处理最后一个未以空行结尾的事件
    if (currentDataParts.length > 0) {
        lastEventData = currentDataParts.join("\n").trim();
    }
    if (!lastEventData) {
        throw new Error("SSE 响应中未包含有效数据");
    }
    try {
        const rpc = JSON.parse(lastEventData);
        if (rpc.error) {
            throw new McpRpcError(rpc.error.code, `MCP 调用错误 [${rpc.error.code}]: ${rpc.error.message}`, rpc.error.data);
        }
        return rpc.result;
    }
    catch (err) {
        if (err instanceof SyntaxError) {
            throw new Error(`SSE 响应解析失败: ${lastEventData.slice(0, 200)}`);
        }
        throw err;
    }
}
// ============================================================================
// 公共 API
// ============================================================================
/**
 * 清理指定品类的所有 MCP 缓存（配置、会话、无状态标记）
 *
 * 当 MCP Server 返回特定错误码时调用，确保下次请求重新拉取配置并重建会话。
 *
 * @param category - MCP 品类名称
 */
function clearCategoryCache(category) {
    console.log(`${LOG_TAG} 清理缓存 (category="${category}")`);
    mcpConfigCache.delete(category);
    mcpSessionCache.delete(category);
    statelessCategories.delete(category);
    inflightInitRequests.delete(category);
}
/**
 * 发送 JSON-RPC 请求到 MCP Server（Streamable HTTP 协议）
 *
 * 自动管理 session 生命周期：
 * - 无状态 Server：跳过 session 管理，直接发送请求
 * - 有状态 Server：首次调用先执行 initialize 握手，session 失效（404）时自动重建并重试
 *
 * @param category - MCP 品类名称
 * @param method - JSON-RPC 方法名
 * @param params - JSON-RPC 参数
 * @param options - 可选配置（如自定义超时）
 * @returns JSON-RPC result
 */
async function sendJsonRpc(category, method, params, options) {
    const url = await getMcpUrl(category);
    const timeoutMs = options?.timeoutMs;
    const body = {
        jsonrpc: "2.0",
        id: generateReqId("mcp_rpc"),
        method,
        ...(params !== undefined ? { params } : {}),
    };
    let session = await getOrCreateSession(url, category);
    try {
        const { rpcResult, newSessionId } = await sendRawJsonRpc(url, session, body, timeoutMs);
        // 用最新的 sessionId 更新 session
        if (newSessionId) {
            session.sessionId = newSessionId;
        }
        return rpcResult;
    }
    catch (err) {
        // 特定 JSON-RPC 错误码触发缓存清理（统一在传输层处理，上层无需关心）
        if (err instanceof McpRpcError && CACHE_CLEAR_ERROR_CODES.has(err.code)) {
            clearCategoryCache(category);
        }
        // 无状态 Server 不存在 session 失效问题，直接抛出错误
        if (session.stateless)
            throw err;
        // 有状态 Server：session 失效时服务端返回 404，需要重新初始化并重试一次
        // 使用 McpHttpError.statusCode 精确匹配，避免字符串匹配 "404" 导致误判
        if (err instanceof McpHttpError && err.statusCode === 404) {
            console.log(`${LOG_TAG} Session 失效 (category="${category}")，开始重建...`);
            mcpSessionCache.delete(category);
            // 使用 rebuildSession 合并并发的 session 重建请求，避免竞态条件
            session = await rebuildSession(url, category);
            const { rpcResult, newSessionId } = await sendRawJsonRpc(url, session, body, timeoutMs);
            if (newSessionId) {
                session.sessionId = newSessionId;
            }
            return rpcResult;
        }
        // 其他错误记录日志后抛出
        console.error(`${LOG_TAG} RPC 请求失败 (category="${category}", method="${method}"): ${err instanceof Error ? err.message : String(err)}`);
        throw err;
    }
}
/**
 * 合并并发的 session 重建请求
 *
 * 与 getOrCreateSession 类似，使用 inflightInitRequests 防止
 * 多个并发请求同时遇到 404 时重复执行 initialize 握手。
 */
async function rebuildSession(url, category) {
    const inflight = inflightInitRequests.get(category);
    if (inflight)
        return inflight;
    const promise = initializeSession(url, category).finally(() => {
        inflightInitRequests.delete(category);
    });
    inflightInitRequests.set(category, promise);
    return promise;
}

/**
 * MCP Schema 清洗模块
 *
 * 负责内联 $ref/$defs 引用并移除 Gemini 不支持的 JSON Schema 关键词，
 * 防止 Gemini 模型解析 function response 时报 400 错误。
 */
/** Gemini 不支持的 JSON Schema 关键词 */
const GEMINI_UNSUPPORTED_KEYWORDS = new Set([
    "patternProperties", "additionalProperties", "$schema", "$id", "$ref", "$defs",
    "definitions", "examples", "minLength", "maxLength", "minimum", "maximum",
    "multipleOf", "pattern", "format", "minItems", "maxItems", "uniqueItems",
    "minProperties", "maxProperties",
]);
/**
 * 清洗 JSON Schema，内联 $ref 引用并移除 Gemini 不支持的关键词，
 * 防止 Gemini 模型解析 function response 时报 400 错误。
 */
function cleanSchemaForGemini(schema) {
    if (!schema || typeof schema !== "object")
        return schema;
    if (Array.isArray(schema))
        return schema.map(cleanSchemaForGemini);
    const obj = schema;
    // 收集 $defs/definitions 用于后续 $ref 内联解析
    const defs = {
        ...(obj.$defs && typeof obj.$defs === "object" ? obj.$defs : {}),
        ...(obj.definitions && typeof obj.definitions === "object" ? obj.definitions : {}),
    };
    return cleanWithDefs(obj, defs, new Set());
}
function cleanWithDefs(schema, defs, refStack) {
    if (!schema || typeof schema !== "object")
        return schema;
    if (Array.isArray(schema))
        return schema.map((item) => cleanWithDefs(item, defs, refStack));
    const obj = schema;
    // 合并当前层级的 $defs/definitions 到 defs 中
    if (obj.$defs && typeof obj.$defs === "object") {
        Object.assign(defs, obj.$defs);
    }
    if (obj.definitions && typeof obj.definitions === "object") {
        Object.assign(defs, obj.definitions);
    }
    // 处理 $ref 引用：尝试内联解析
    if (typeof obj.$ref === "string") {
        const ref = obj.$ref;
        if (refStack.has(ref))
            return {}; // 防止循环引用
        const match = ref.match(/^#\/(?:\$defs|definitions)\/(.+)$/);
        if (match && match[1] && defs[match[1]]) {
            const nextStack = new Set(refStack);
            nextStack.add(ref);
            return cleanWithDefs(defs[match[1]], defs, nextStack);
        }
        return {}; // 无法解析的 $ref，返回空对象
    }
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
        if (GEMINI_UNSUPPORTED_KEYWORDS.has(key))
            continue;
        if (key === "const") {
            cleaned.enum = [value];
            continue;
        }
        if (key === "properties" && value && typeof value === "object" && !Array.isArray(value)) {
            cleaned[key] = Object.fromEntries(Object.entries(value).map(([k, v]) => [
                k, cleanWithDefs(v, defs, refStack),
            ]));
        }
        else if (key === "items" && value) {
            cleaned[key] = Array.isArray(value)
                ? value.map((item) => cleanWithDefs(item, defs, refStack))
                : cleanWithDefs(value, defs, refStack);
        }
        else if ((key === "anyOf" || key === "oneOf" || key === "allOf") && Array.isArray(value)) {
            // 过滤掉 null 类型的变体
            const nonNull = value.filter((v) => {
                if (!v || typeof v !== "object")
                    return true;
                const r = v;
                return r.type !== "null";
            });
            if (nonNull.length === 1) {
                // 只剩一个变体时直接内联
                const single = cleanWithDefs(nonNull[0], defs, refStack);
                if (single && typeof single === "object" && !Array.isArray(single)) {
                    Object.assign(cleaned, single);
                }
            }
            else {
                cleaned[key] = nonNull.map((v) => cleanWithDefs(v, defs, refStack));
            }
        }
        else {
            cleaned[key] = value;
        }
    }
    return cleaned;
}

/**
 * 业务错误码检查拦截器
 *
 * 检查 tools/call 返回结果中是否包含需要清理缓存的业务错误码。
 * MCP Server 可能在正常的 JSON-RPC 响应中返回业务层错误，
 * 这些错误被包裹在 result.content[].text 中，需要解析后判断。
 *
 * 此拦截器对所有 call 调用生效。
 */
// ============================================================================
// 常量
// ============================================================================
/**
 * 需要触发缓存清理的业务错误码集合
 *
 * 这些错误码出现在 MCP 工具调用返回的 content 文本中（业务层面），
 * 与 JSON-RPC 层面的错误码不同，需要在此处额外检测。
 *
 * - 850002: 机器人未被授权使用对应能力，需清理缓存以便下次重新拉取配置
 */
const BIZ_CACHE_CLEAR_ERROR_CODES = new Set([850002]);
// ============================================================================
// 拦截器实现
// ============================================================================
const bizErrorInterceptor = {
    name: "biz-error",
    /** 对所有 call 调用生效 */
    match: () => true,
    /** 检查返回结果中的业务错误码，必要时清理缓存 */
    afterCall(ctx, result) {
        checkBizErrorAndClearCache(result, ctx.category);
        // 不修改 result，透传给下一个拦截器
        return result;
    },
};
// ============================================================================
// 内部实现
// ============================================================================
/**
 * 检查 tools/call 的返回结果中是否包含需要清理缓存的业务错误码
 */
function checkBizErrorAndClearCache(result, category) {
    if (!result || typeof result !== "object")
        return;
    const { content } = result;
    if (!Array.isArray(content))
        return;
    for (const item of content) {
        if (item.type !== "text" || !item.text)
            continue;
        try {
            const parsed = JSON.parse(item.text);
            if (typeof parsed.errcode === "number" && BIZ_CACHE_CLEAR_ERROR_CODES.has(parsed.errcode)) {
                console.log(`[mcp] 检测到业务错误码 ${parsed.errcode} (category="${category}")，清理缓存`);
                clearCategoryCache(category);
                return;
            }
        }
        catch {
            // text 不是 JSON 格式，跳过
        }
    }
}

/**
 * get_msg_media 响应拦截器
 *
 * 核心逻辑：
 * 1. beforeCall: 设置延长的超时时间（120s），因为 base64 数据可达 ~27MB
 * 2. afterCall: 从 MCP result 的 content[].text 中提取 base64_data，
 *    解码为 Buffer 并通过 saveMediaBuffer 保存到本地媒体目录，
 *    替换响应中的 base64_data 为 local_path，避免大模型被 base64 数据消耗 token
 */
// ============================================================================
// 拦截器实现
// ============================================================================
const mediaInterceptor = {
    name: "media",
    /** 仅对 get_msg_media 方法生效 */
    match: (ctx) => ctx.method === "get_msg_media",
    /** 设置延长的超时时间 */
    beforeCall() {
        return { timeoutMs: MEDIA_DOWNLOAD_TIMEOUT_MS };
    },
    /** 拦截响应：base64 → 本地文件 */
    async afterCall(ctx, result) {
        return interceptMediaResponse(result);
    },
};
// ============================================================================
// 内部实现
// ============================================================================
/**
 * 拦截 get_msg_media 的 MCP 响应
 *
 * 1. 从 MCP result 的 content[].text 中提取业务 JSON
 * 2. 提取 media_item.base64_data，解码为 Buffer
 * 3. 通过 openclaw SDK 的 saveMediaBuffer 保存到本地媒体目录
 * 4. 替换响应：移除 base64_data，加入 local_path
 *
 * 这样大模型只看到轻量的文件路径信息，不会被 base64 数据消耗 token。
 */
async function interceptMediaResponse(result) {
    const t0 = performance.now();
    // 1. 提取 MCP result 中的 content 数组
    const content = result?.content;
    if (!Array.isArray(content))
        return result;
    const textItem = content.find((c) => c.type === "text" && typeof c.text === "string");
    if (!textItem)
        return result;
    // 2. 解析业务 JSON
    let bizData;
    try {
        bizData = JSON.parse(textItem.text);
    }
    catch {
        // 非 JSON 格式，原样返回
        return result;
    }
    // 3. 校验业务响应：errcode !== 0 或无 media_item 时原样返回
    if (bizData.errcode !== 0)
        return result;
    const mediaItem = bizData.media_item;
    if (!mediaItem || typeof mediaItem.base64_data !== "string")
        return result;
    const base64Data = mediaItem.base64_data;
    const mediaName = mediaItem.name;
    const mediaType = mediaItem.type;
    const mediaId = mediaItem.media_id;
    const tParsed = performance.now();
    // 4. 解码 base64 → Buffer
    const buffer = Buffer.from(base64Data, "base64");
    const tDecoded = performance.now();
    // 5. 检测 contentType，并通过 saveMediaBuffer 保存到本地媒体目录
    const contentType = await detectMime({ buffer, filePath: mediaName }) ?? "application/octet-stream";
    const tMimeDetected = performance.now();
    // 企业微信聊天记录附件可达 20MB（文件消息上限），
    // 而 saveMediaBuffer 默认 maxBytes 为 5MB（针对 outbound 场景），
    // 此处显式放宽到 20MB 以支持大文件下载。
    const INBOUND_MAX_BYTES = 20 * 1024 * 1024; // 20MB
    const core = getWeComRuntime();
    const saved = await core.channel.media.saveMediaBuffer(buffer, contentType, "inbound", INBOUND_MAX_BYTES, // maxBytes: 放宽到 20MB，匹配企业微信文件消息上限
    mediaName);
    // 5.1 补偿：核心库 EXT_BY_MIME 可能缺少某些格式映射（如 audio/amr），
    //     导致保存的文件没有后缀。此处检测并修复。
    const MIME_EXT_PATCH = {
        "audio/amr": ".amr",
    };
    const patchExt = MIME_EXT_PATCH[contentType];
    if (patchExt && !path.extname(saved.path)) {
        const newPath = saved.path + patchExt;
        try {
            await fs.rename(saved.path, newPath);
            saved.path = newPath;
        }
        catch {
            // rename 失败不影响主流程，文件仍可用
        }
    }
    const tSaved = performance.now();
    // 6. 构造精简响应，移除 base64_data，加入本地路径
    const newBizData = {
        errcode: 0,
        errmsg: "ok",
        media_item: {
            media_id: mediaId,
            name: mediaName ?? saved.path.split("/").pop(),
            type: mediaType,
            local_path: saved.path,
            size: buffer.length,
            content_type: saved.contentType,
        },
    };
    const tEnd = performance.now();
    // 耗时日志：各环节耗时（ms）
    console.log(`[mcp] get_msg_media 拦截成功: media_id=${mediaId ?? "unknown"}, ` +
        `type=${mediaType ?? "unknown"}, size=${buffer.length}, saved=${saved.path}\n` +
        `  ⏱ 耗时明细 (总 ${(tEnd - t0).toFixed(1)}ms):\n` +
        `    解析响应 JSON:   ${(tParsed - t0).toFixed(1)}ms\n` +
        `    base64 解码:     ${(tDecoded - tParsed).toFixed(1)}ms  (${(base64Data.length / 1024).toFixed(0)}KB base64 → ${(buffer.length / 1024).toFixed(0)}KB buffer)\n` +
        `    MIME 检测:       ${(tMimeDetected - tDecoded).toFixed(1)}ms  (${contentType})\n` +
        `    saveMediaBuffer: ${(tSaved - tMimeDetected).toFixed(1)}ms\n` +
        `    构造响应:        ${(tEnd - tSaved).toFixed(1)}ms`);
    // 7. 返回修改后的 MCP result 结构
    return {
        content: [{
                type: "text",
                text: JSON.stringify(newBizData),
            }],
    };
}

/**
 * smartpage_create 请求拦截器
 *
 * 核心逻辑：
 * smartpage_create 的 pages 数组中，每个 page 可能包含 page_filepath 字段
 * （指向本地 markdown 文件），用于避免在命令行传递大段文本内容。
 * 本拦截器在 beforeCall 阶段遍历 pages 数组，逐个读取 page_filepath
 * 指向的本地文件内容，填入 page_content 字段，并移除 page_filepath。
 *
 * 入参约定：
 *   wecom_mcp call doc smartpage_create '{
 *     "title": "主页标题",
 *     "pages": [
 *       {"page_title": "页面1", "page_filepath": "/tmp/page1.md", "content_type": "markdown"},
 *       {"page_title": "页面2", "page_filepath": "/tmp/page2.md", "content_type": "markdown"}
 *     ]
 *   }'
 *
 * 拦截器行为：
 *   1. 检测 args.pages 数组
 *   2. 校验文件大小：单文件不超过 10MB，所有文件总计不超过 20MB
 *   3. 遍历每个 page，若存在 page_filepath 则读取本地文件内容
 *   4. 将文件内容填入 page_content 字段，移除 page_filepath
 *   5. 返回修改后的完整 args
 *
 * 传给 MCP Server 的格式：
 *   { "title": "...", "pages": [{"page_title": "...", "page_content": "...", "content_type": "..."}] }
 */
// ============================================================================
// 常量
// ============================================================================
/** 单个 page_filepath 文件大小上限：10MB */
const MAX_SINGLE_FILE_SIZE = 10 * 1024 * 1024;
/** 所有 page_filepath 文件总大小上限：20MB */
const MAX_TOTAL_FILE_SIZE = 20 * 1024 * 1024;
// ============================================================================
// 内部辅助函数
// ============================================================================
/**
 * 校验所有 page_filepath 的文件大小
 *
 * 使用 fs.stat 在读取文件内容之前检查大小，避免超大文件被加载到内存。
 * - 单文件 > 10MB → 报错
 * - 所有文件累计 > 20MB → 报错
 */
async function validateFileSize(pages) {
    let totalSize = 0;
    for (let i = 0; i < pages.length; i++) {
        const filePath = pages[i].page_filepath;
        if (typeof filePath !== "string" || !filePath)
            continue;
        let stat;
        try {
            stat = await fs.stat(filePath);
        }
        catch (err) {
            // stat 失败不在这里处理，留给后续 readFile 阶段抛出更详细的错误
            continue;
        }
        if (stat.size > MAX_SINGLE_FILE_SIZE) {
            console.error(`[mcp] smartpage_create: pages[${i}] 文件 "${filePath}" ` +
                `大小 ${(stat.size / 1024 / 1024).toFixed(1)}MB 超过单文件上限 10MB`);
            throw new Error("内容大小超出限制，无法创建");
        }
        totalSize += stat.size;
        if (totalSize > MAX_TOTAL_FILE_SIZE) {
            console.error(`[mcp] smartpage_create: 累计文件大小 ${(totalSize / 1024 / 1024).toFixed(1)}MB ` +
                `超过总上限 20MB（在 pages[${i}] "${filePath}" 处超出）`);
            throw new Error("内容大小超出限制，无法创建");
        }
    }
    if (totalSize > 0) {
        console.log(`[mcp] smartpage_create: 文件大小校验通过，总计 ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
    }
}
/** 异步解析 pages 中的 page_filepath，返回 BeforeCallOptions */
async function resolvePages(ctx, pages) {
    console.log(`[mcp] smartpage_create: 开始解析 ${pages.length} 个 page 的 page_filepath`);
    // 阶段 1：文件大小校验（stat 阶段，不读内容）
    await validateFileSize(pages);
    // 阶段 2：读取文件内容
    const resolvedPages = await Promise.all(pages.map(async (page, index) => {
        const filePath = page.page_filepath;
        if (typeof filePath !== "string" || !filePath) {
            // 该 page 没有 page_filepath，保留原样（可能已有 page_content）
            return page;
        }
        let fileContent;
        try {
            fileContent = await fs.readFile(filePath, "utf-8");
        }
        catch (err) {
            throw new Error(`smartpage_create: pages[${index}] 无法读取文件 "${filePath}": ${err instanceof Error ? err.message : String(err)}`);
        }
        console.log(`[mcp] smartpage_create: pages[${index}] 读取成功 "${filePath}" (${fileContent.length} chars)`);
        // 构造新的 page 对象：填入 page_content，移除 page_filepath
        const { page_filepath: _, ...rest } = page;
        return { ...rest, page_content: fileContent };
    }));
    console.log(`[mcp] smartpage_create: 所有 page_filepath 解析完成`);
    // 返回修改后的完整 args
    return {
        args: {
            ...ctx.args,
            pages: resolvedPages,
        },
    };
}
// ============================================================================
// 拦截器实现
// ============================================================================
const smartpageCreateInterceptor = {
    name: "smartpage-create",
    /** 仅对 doc 品类的 smartpage_create 方法生效 */
    match: (ctx) => ctx.category === "doc" && ctx.method === "smartpage_create",
    /** 遍历 pages 数组，逐个读取 page_filepath 填入 page_content */
    beforeCall(ctx) {
        const pages = ctx.args.pages;
        if (!Array.isArray(pages) || pages.length === 0) {
            // 没有 pages 数组，不做拦截
            return undefined;
        }
        // 检查是否有任何 page 包含 page_filepath
        const hasFilePath = pages.some((p) => typeof p.page_filepath === "string" && p.page_filepath);
        if (!hasFilePath) {
            // 所有 page 都没有 page_filepath（可能直接传了 page_content），不做拦截
            return undefined;
        }
        return resolvePages(ctx, pages);
    },
};

/**
 * smartpage_get_export_result 响应拦截器
 *
 * 核心逻辑：
 * MCP Server 返回的 smartpage_get_export_result 响应中，当 task_done=true 时
 * 会包含 content 字段（markdown 文本内容）。该内容可能很大，直接返回给 LLM
 * 会消耗大量 token。
 *
 * 本拦截器在 afterCall 阶段：
 * 1. 检测 task_done=true 且存在 content 字段
 * 2. 将 content 保存到本地文件（使用与 msg-media 一致的媒体目录）
 * 3. 用 content_path（文件路径）替换 content 字段
 *
 * 这样 LLM 只看到轻量的文件路径信息，Skill 可通过文件路径读取完整内容。
 */
// ============================================================================
// 拦截器实现
// ============================================================================
const smartpageExportInterceptor = {
    name: "smartpage-export",
    /** 仅对 doc 品类的 smartpage_get_export_result 方法生效 */
    match: (ctx) => ctx.category === "doc" && ctx.method === "smartpage_get_export_result",
    /** 拦截响应：将 markdown content 保存为本地文件 */
    async afterCall(_ctx, result) {
        return interceptExportResponse(result);
    },
};
// ============================================================================
// 内部实现
// ============================================================================
/**
 * 拦截 smartpage_get_export_result 的 MCP 响应
 *
 * 1. 从 MCP result 的 content[].text 中提取业务 JSON
 * 2. 检测 task_done=true 且存在 content 字段
 * 3. 将 content（markdown 文本）通过 saveMediaBuffer 保存到本地媒体目录
 * 4. 构造新响应：移除 content，添加 content_path
 */
async function interceptExportResponse(result) {
    // 1. 提取 MCP result 中的 content 数组
    const content = result?.content;
    if (!Array.isArray(content))
        return result;
    const textItem = content.find((c) => c.type === "text" && typeof c.text === "string");
    if (!textItem)
        return result;
    // 2. 解析业务 JSON
    let bizData;
    try {
        bizData = JSON.parse(textItem.text);
    }
    catch {
        // 非 JSON 格式，原样返回
        return result;
    }
    // 3. 校验：errcode !== 0 或 task_done 不为 true 或无 content 时原样返回
    if (bizData.errcode !== 0)
        return result;
    if (bizData.task_done !== true)
        return result;
    if (typeof bizData.content !== "string")
        return result;
    const markdownContent = bizData.content;
    console.log(`[mcp] smartpage_get_export_result: 拦截 content (${markdownContent.length} chars)，保存到本地文件`);
    // 4. 将 markdown 内容通过 saveMediaBuffer 保存到本地媒体目录
    //    使用 text/markdown 类型，与 msg-media 拦截器保持一致的路径管理
    const buffer = Buffer.from(markdownContent, "utf-8");
    const core = getWeComRuntime();
    const saved = await core.channel.media.saveMediaBuffer(buffer, "text/markdown", "inbound", undefined, // maxBytes: markdown 文本通常不大，使用默认限制
    "smartpage_export.md");
    console.log(`[mcp] smartpage_get_export_result: 已保存到 ${saved.path}`);
    // 5. 构造新响应：移除 content，添加 content_path
    const newBizData = {
        errcode: bizData.errcode,
        errmsg: bizData.errmsg ?? "ok",
        task_done: true,
        content_path: saved.path,
    };
    // 6. 返回修改后的 MCP result 结构
    return {
        content: [{
                type: "text",
                text: JSON.stringify(newBizData),
            }],
    };
}

/**
 * MCP call 拦截器注册表与调度入口
 *
 * 所有 call 拦截器在此注册，按注册顺序执行。
 * 新增拦截器只需：
 *   1. 在 interceptors/ 目录下新建文件，实现 CallInterceptor 接口
 *   2. 在下方 interceptors 数组中注册
 *
 * tool.ts 的 handleCall 无需任何改动。
 */
// ============================================================================
// 拦截器注册表（按注册顺序执行）
// ============================================================================
const interceptors = [
    bizErrorInterceptor, // 业务错误码检查（所有 call 生效）
    mediaInterceptor, // get_msg_media base64 拦截
    smartpageCreateInterceptor, // smartpage_create 本地文件读取
    smartpageExportInterceptor, // smartpage_get_export_result content → 本地文件
];
/**
 * 收集匹配的 beforeCall 配置，合并后返回
 *
 * 合并策略：
 * - timeoutMs: 取所有拦截器返回值中的最大值
 * - args: 后注册的拦截器覆盖前者（一般同一调用只有一个拦截器会返回 args）
 */
async function resolveBeforeCall(ctx) {
    let mergedTimeoutMs;
    let mergedArgs;
    for (const interceptor of interceptors) {
        if (!interceptor.match(ctx) || !interceptor.beforeCall)
            continue;
        const opts = await interceptor.beforeCall(ctx);
        if (opts?.timeoutMs !== undefined) {
            mergedTimeoutMs = mergedTimeoutMs === undefined
                ? opts.timeoutMs
                : Math.max(mergedTimeoutMs, opts.timeoutMs);
        }
        if (opts?.args !== undefined) {
            mergedArgs = opts.args;
        }
    }
    return {
        options: mergedTimeoutMs !== undefined ? { timeoutMs: mergedTimeoutMs } : undefined,
        args: mergedArgs,
    };
}
/**
 * 依次执行匹配的 afterCall 拦截器，管道式传递 result
 *
 * 前一个拦截器的返回值作为下一个拦截器的输入。
 * 拦截器若不需要修改 result，应原样返回。
 */
async function runAfterCall(ctx, result) {
    let current = result;
    for (const interceptor of interceptors) {
        if (!interceptor.match(ctx) || !interceptor.afterCall)
            continue;
        current = await interceptor.afterCall(ctx, current);
    }
    return current;
}

/**
 * wecom_mcp — 模拟 MCP 调用的 Agent Tool
 *
 * 通过 MCP Streamable HTTP 传输协议调用企业微信 MCP Server，
 * 提供 list（列出所有工具）和 call（调用工具）两个操作。
 *
 * 在 skills 中的使用方式：
 *   wecom_mcp list <category>
 *   wecom_mcp call <category> <method> '<jsonArgs>'
 *
 * 示例：
 *   wecom_mcp list contact
 *   wecom_mcp call contact getContact '{}'
 */
// ============================================================================
// 响应构造辅助
// ============================================================================
/** 构造统一的文本响应结构 */
const textResult = (data) => ({
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});
/** 构造错误响应 */
const errorResult = (err) => {
    // 适配企业微信 API 返回的 { errcode, errmsg } 结构
    if (err && typeof err === "object" && "errcode" in err) {
        const { errcode, errmsg } = err;
        return textResult({ error: errmsg ?? `错误码: ${errcode}`, errcode });
    }
    const message = err instanceof Error ? err.message : String(err);
    return textResult({ error: message });
};
// ============================================================================
// list 操作：列出某品类的所有 MCP 工具
// ============================================================================
const handleList = async (category) => {
    const result = await sendJsonRpc(category, "tools/list");
    const tools = result?.tools ?? [];
    if (tools.length === 0) {
        return { message: `品类 "${category}" 下暂无可用工具`, tools: [] };
    }
    return {
        category,
        count: tools.length,
        tools: tools.map((t) => ({
            name: t.name,
            description: t.description ?? "",
            // 清洗 inputSchema，内联 $ref/$defs 引用并移除 Gemini 不支持的关键词，
            // 避免 Gemini 模型解析 function response 时报 400 错误
            inputSchema: t.inputSchema ? cleanSchemaForGemini(t.inputSchema) : undefined,
        })),
    };
};
// ============================================================================
// call 操作：调用某品类的某个 MCP 工具
// ============================================================================
const handleCall = async (category, method, args) => {
    const ctx = { category, method, args };
    const callStart = performance.now();
    console.log(`[mcp] handleCall ${category}/${method} 入参: ${JSON.stringify(args)}`);
    // 1. 收集拦截器的 beforeCall 配置（如超时时间、替换 args）
    const { options, args: resolvedArgs } = await resolveBeforeCall(ctx);
    const finalArgs = resolvedArgs ?? args;
    if (resolvedArgs) {
        console.log(`[mcp] handleCall ${category}/${method} 拦截器替换 args: ${JSON.stringify(resolvedArgs).slice(0, 500)}` +
            (JSON.stringify(resolvedArgs).length > 500 ? "...(truncated)" : ""));
    }
    if (options) {
        console.log(`[mcp] handleCall ${category}/${method} 拦截器选项: ${JSON.stringify(options)}`);
    }
    // 2. 执行 MCP 调用
    const result = await sendJsonRpc(category, "tools/call", {
        name: method,
        arguments: finalArgs,
    }, options);
    const rpcDone = performance.now();
    const rpcMs = (rpcDone - callStart).toFixed(1);
    const resultStr = JSON.stringify(result);
    console.log(`[mcp] handleCall ${category}/${method} MCP 响应 (${rpcMs}ms): ${resultStr.slice(0, 800)}` +
        (resultStr.length > 800 ? "...(truncated)" : ""));
    // 3. 管道式执行 afterCall 拦截器（业务错误码检查、响应变换等）
    const finalResult = await runAfterCall(ctx, result);
    const totalMs = (performance.now() - callStart).toFixed(1);
    const interceptMs = (performance.now() - rpcDone).toFixed(1);
    // 有拦截器处理时打印详细耗时，否则只打印 RPC 耗时
    if (finalResult !== result) {
        const finalStr = JSON.stringify(finalResult);
        console.log(`[mcp] handleCall ${category}/${method} afterCall 变换后 (${interceptMs}ms): ${finalStr.slice(0, 500)}` +
            (finalStr.length > 500 ? "...(truncated)" : ""));
        console.log(`[mcp] handleCall ${category}/${method} 总耗时: ${totalMs}ms` +
            ` (MCP请求: ${rpcMs}ms, 拦截处理: ${interceptMs}ms)`);
    }
    else {
        console.log(`[mcp] handleCall ${category}/${method} 耗时: ${rpcMs}ms`);
    }
    return finalResult;
};
// ============================================================================
// 参数解析
// ============================================================================
/**
 * 解析 args 参数：支持 JSON 字符串或直接的对象
 */
const parseArgs = (args) => {
    if (!args)
        return {};
    if (typeof args === "object")
        return args;
    try {
        return JSON.parse(args);
    }
    catch (err) {
        const detail = err instanceof SyntaxError ? err.message : String(err);
        throw new Error(`args 参数不是合法的 JSON: ${args} (${detail})`);
    }
};
// ============================================================================
// 工具定义 & 导出
// ============================================================================
/**
 * 创建 wecom_mcp Agent Tool 定义
 */
function createWeComMcpTool() {
    return {
        name: "wecom_mcp",
        label: "企业微信 MCP 工具",
        description: [
            "通过 HTTP 直接调用企业微信 MCP Server。",
            "支持两种操作：",
            "  - list: 列出指定品类的所有 MCP 工具",
            "  - call: 调用指定品类的某个 MCP 工具",
            "",
            "使用方式：",
            "  wecom_mcp list <category>",
            "  wecom_mcp call <category> <method> '<jsonArgs>'",
            "",
            "示例：",
            "  列出 contact 品类所有工具：wecom_mcp list contact",
            "  调用 contact 的 getContact：wecom_mcp call contact getContact '{}'",
        ].join("\n"),
        parameters: {
            type: "object",
            properties: {
                action: {
                    type: "string",
                    enum: ["list", "call"],
                    description: "操作类型：list（列出工具）或 call（调用工具）",
                },
                category: {
                    type: "string",
                    description: "MCP 品类名称，如 doc、contact 等，对应 mcpConfig 中的 key",
                },
                method: {
                    type: "string",
                    description: "要调用的 MCP 方法名（action=call 时必填）",
                },
                args: {
                    type: ["string", "object"],
                    description: "调用 MCP 方法的参数，可以是 JSON 字符串或对象（action=call 时使用，默认 {}）",
                },
            },
            required: ["action", "category"],
        },
        async execute(_toolCallId, params) {
            const p = params;
            console.log(`[mcp] execute: action=${p.action}, category=${p.category}` +
                (p.method ? `, method=${p.method}` : "") +
                (p.args ? `, args=${typeof p.args === "string" ? p.args : JSON.stringify(p.args)}` : ""));
            try {
                let result;
                switch (p.action) {
                    case "list":
                        result = textResult(await handleList(p.category));
                        break;
                    case "call": {
                        if (!p.method) {
                            result = textResult({ error: "action 为 call 时必须提供 method 参数" });
                            break;
                        }
                        const args = parseArgs(p.args);
                        result = textResult(await handleCall(p.category, p.method, args));
                        break;
                    }
                    default:
                        result = textResult({ error: `未知操作类型: ${String(p.action)}，支持 list 和 call` });
                }
                console.log(`[mcp] execute: action=${p.action}, category=${p.category}` +
                    (p.method ? `, method=${p.method}` : "") +
                    ` → 响应长度=${result.content[0].text.length} chars`);
                return result;
            }
            catch (err) {
                console.error(`[mcp] execute: action=${p.action}, category=${p.category}` +
                    (p.method ? `, method=${p.method}` : "") +
                    ` → 异常: ${err instanceof Error ? err.message : String(err)}`);
                return errorResult(err);
            }
        },
    };
}

const plugin = {
    id: "wecom-openclaw-plugin",
    name: "企业微信",
    description: "企业微信 OpenClaw 插件",
    configSchema: emptyPluginConfigSchema(),
    register(api) {
        setWeComRuntime(api.runtime);
        api.registerChannel({ plugin: wecomPlugin });
        // 注册 wecom_mcp：通过 HTTP 直接调用企业微信 MCP Server
        api.registerTool(createWeComMcpTool(), { name: "wecom_mcp" });
        // ── Gateway 启动时自动确保 tools.alsoAllow 包含 wecom_mcp ──────────
        // 在 gateway_start 阶段检测并写入，保证插件安装/更新后首次启动即生效
        // api.on("gateway_start", async () => {
        //   await ensureToolsAlsoAllow(api);
        // });
        // 注入媒体发送指令和文件大小限制提示词（仅对企业微信 channel 生效）
        api.on("before_prompt_build", (_event, ctx) => {
            // 只在企业微信 channel 的会话中注入，避免影响其他 channel 插件
            if (ctx?.channelId !== CHANNEL_ID) {
                return;
            }
            return {
                appendSystemContext: [
                    "重要：涉及发送图片/视频/语音/文件给用户时，请务必使用 `MEDIA:` 指令。详见  wecom-send-media 这个 skill（技能）。",
                    "重要：当需要向用户发送结构化卡片消息（如通知、投票、按钮选择等）时，请在回复中直接输出 JSON 代码块（```json ... ```），其中 card_type 字段标明卡片类型。详见 wecom-send-template-card 技能。"
                ].join("\n"),
            };
        });
    },
};

export { plugin as default };
//# sourceMappingURL=index.esm.js.map
