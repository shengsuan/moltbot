// ---- 流式消息常量 ----
/** 流式消息输入模式 */
export const StreamInputMode = {
    /** 每次发送的 content_raw 替换整条消息内容 */
    REPLACE: "replace",
};
/** 流式消息输入状态 */
export const StreamInputState = {
    /** 正文生成中 */
    GENERATING: 1,
    /** 正文生成结束（终结状态） */
    DONE: 10,
};
/** 流式消息内容类型 */
export const StreamContentType = {
    MARKDOWN: "markdown",
};
