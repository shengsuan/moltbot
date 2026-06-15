// Shared prompt wrappers and section metadata for the configure wizard.
import {
  confirm as clackConfirm,
  intro as clackIntro,
  outro as clackOutro,
  password as clackPassword,
  select as clackSelect,
  text as clackText,
} from "@clack/prompts";
import { normalizeStringEntries } from "@openclaw/normalization-core/string-normalization";
import {
  stylePromptHint,
  stylePromptMessage,
  stylePromptTitle,
} from "../../packages/terminal-core/src/prompt-style.js";

export const CONFIGURE_WIZARD_SECTIONS = [
  "workspace",
  "model",
  "web",
  "gateway",
  "daemon",
  "channels",
  "plugins",
  "skills",
  "health",
] as const;

export type WizardSection = (typeof CONFIGURE_WIZARD_SECTIONS)[number];

/** Parse repeated `--section` values into known configure wizard sections and invalid entries. */
export function parseConfigureWizardSections(raw: unknown): {
  sections: WizardSection[];
  invalid: string[];
} {
  const sectionsRaw: string[] = Array.isArray(raw) ? normalizeStringEntries(raw) : [];
  if (sectionsRaw.length === 0) {
    return { sections: [], invalid: [] };
  }

  const invalid = sectionsRaw.filter((s) => !CONFIGURE_WIZARD_SECTIONS.includes(s as never));
  const sections = sectionsRaw.filter((s): s is WizardSection =>
    CONFIGURE_WIZARD_SECTIONS.includes(s as never),
  );
  return { sections, invalid };
}

export type ChannelsWizardMode = "configure" | "remove";

export type ConfigureWizardParams = {
  command: "configure" | "update";
  sections?: WizardSection[];
};

export const CONFIGURE_SECTION_OPTIONS: Array<{
  value: WizardSection;
  label: string;
  hint: string;
}> = [
  { value: "workspace", label: "工作空间", hint: "设置工作空间和会话目录" },
  { value: "model", label: "模型", hint: "选择供应商和凭证" },
  { value: "web", label: "网页工具", hint: "配置 Brave 搜索和网页获取" },
  { value: "gateway", label: "网关", hint: "配置端口、绑定地址、认证和 Tailscale" },
  {
    value: "daemon",
    label: "后台服务",
    hint: "安装/管理后台服务",
  },
  {
    value: "channels",
    label: "频道",
    hint: "链接 WhatsApp/Telegram 等和默认设置",
  },
  { value: "plugins", label: "Plugins", hint: "设置插件 (sandbox, tools, 等.)" },
  { value: "skills", label: "Skills", hint: "安装/启用工作空间技能" },
  {
    value: "health",
    label: "健康检查",
    hint: "运行网关和频道检查",
  },
];

/** Styled configure wizard intro wrapper. */
export const intro = (message: string) => clackIntro(stylePromptTitle(message) ?? message);
/** Styled configure wizard outro wrapper. */
export const outro = (message: string) => clackOutro(stylePromptTitle(message) ?? message);
/** Styled text prompt wrapper. */
export const text = (params: Parameters<typeof clackText>[0]) =>
  clackText({
    ...params,
    message: stylePromptMessage(params.message),
  });
/** Styled confirm prompt wrapper. */
export const confirm = (params: Parameters<typeof clackConfirm>[0]) =>
  clackConfirm({
    ...params,
    message: stylePromptMessage(params.message),
  });
/** Styled select prompt wrapper that also normalizes option hints. */
export const select = <T>(params: Parameters<typeof clackSelect<T>>[0]) =>
  clackSelect({
    ...params,
    message: stylePromptMessage(params.message),
    options: params.options.map((opt) =>
      opt.hint === undefined ? opt : { ...opt, hint: stylePromptHint(opt.hint) },
    ),
  });
/** Styled password prompt wrapper. */
export const password = (params: Parameters<typeof clackPassword>[0]) =>
  clackPassword({
    ...params,
    message: stylePromptMessage(params.message),
  });
