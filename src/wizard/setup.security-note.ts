import chalk from "chalk";
import { formatCliCommand } from "../cli/command-format.js";

export const SECURITY_NOTE_TITLE = "安全免责声明";

export const SECURITY_CONFIRM_MESSAGE =
  "我明白此项功能默认仅供个人使用；若需用于共享或多用户环境，则必须进行锁定配置。是否继续？";

const heading = (text: string) => chalk.bold(text);

export const SECURITY_NOTE_MESSAGE = [
  "OpenClaw 是一个个人兴趣项目，目前仍处于 Beta 测试阶段。请预料到可能存在一些 bug。",
  "默认情况下，OpenClaw 是一个个人代理：即一个受信任的操作员边界。",
  "如果已启用工具，此机器人可以读取文件并执行操作。",
  "糟糕的提示可能会诱导它做出不安全的行为。",
  "",
  "OpenClaw 默认并非敌对的多租户边界。",
  "如果多位用户能够向同一位具备工具能力的代理发送消息，他们将共享该代理被授予的工具权限。",
  "",
  "如果您不熟悉安全加固和访问控制，请勿运行 OpenClaw。",
  "在启用工具或将其暴露于互联网之前，请寻求有经验人士的协助。",
  "",
  heading("推荐配置"),
  "- Pairing/allowlists + 门控.",
  "- 多用户/共享收件箱：拆分信任边界（独立网关/凭据；理想情况下，应使用独立的操作系统用户/主机）。",
  "- Sandbox + least-privilege tools.",
  "- 共享收件箱：隔离私信会话（session.dmScope：按频道/对等方隔离），并最大限度地限制工具访问权限。",
  "- 避免将机密置于代理可访问的文件系统中。",
  "- 对于任何配备工具或非受信收件箱的机器人，请使用当前可用的最强模型。",
  "",
  heading("定期运行"),
  formatCliCommand("openclaw security audit --deep"),
  formatCliCommand("openclaw security audit --fix"),
  "",
  heading("了解功多"),
  "- https://docs.openclaw.ai/gateway/security",
].join("\n");
