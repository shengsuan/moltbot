// CLI tagline selection helpers, including deterministic random/default/holiday modes.
import { parseStrictNonNegativeInteger } from "../infra/parse-finite-number.js";

const DEFAULT_TAGLINE = "All your chats, one OpenClaw.";
export type TaglineMode = "random" | "default" | "off";

const HOLIDAY_TAGLINES = {
  newYear: "新年：新年，新配置——同样的旧 EADDRINUSE，但这次我们像大人一样解决它。",
  lunarNewYear: "农历新年：愿您的构建幸运，您的分支繁荣，您的合并冲突被烟花赶走。",
  christmas: "圣诞节：Ho ho ho——圣诞老人的小爪助手在这里发货快乐，回滚混乱，并安全地隐藏钥匙。",
  eid: "开斋节：庆祝模式：队列清除，任务完成，好心情以干净的历史提交到主分支。",
  diwali: "排灯节：让日志闪耀，让 bug 逃跑——今天我们点亮终端并自豪地发货。",
  easter: "复活节：我找到了您丢失的环境变量——将其视为一个小型 CLI 彩蛋寻宝游戏，较少的果冻豆。",
  hanukkah: "光明节：八夜，八次重试，零耻辱——愿您的网关保持点亮，您的部署保持和平。",
  halloween: "万圣节：恐怖季节：小心闹鬼的依赖、诅咒的缓存和过去的 node_modules 幽灵。",
  thanksgiving:
    "感恩节：感谢稳定的端口、工作中的 DNS 和一个读取日志的机器人，这样没有人必须这样做。",
  valentines: "情人节：玫瑰被输入，紫罗兰被管道——我会自动化家务，这样您就可以和人类共度时光。",
} as const;

const TAGLINES: string[] = [
  "您的终端刚刚长出了爪子——输入一些内容，让机器人捏住繁琐的工作。",
  "欢迎来到命令行：梦想在这里编译，自信在这里段错误。",
  '我靠咖啡因、JSON5 和 "它在我的机器上工作" 的厚颜无耻运行。',
  "网关在线——请始终将手、脚和附属物保持在 shell 内。",
  "我说流利的 bash、温和的讽刺和激进的制表符补全能量。",
  "一个 CLI 统治它们全部，再次重启因为你改变了端口。",
  '如果它工作，就是自动化；如果它坏了，就是 "学习机会"。',
  "配对代码存在是因为即使机器人也相信同意——和良好的安全卫生。",
  "您的 .env 文件露出来了；别担心，我会假装没看见。",
  "我会做无聊的事情，而您戏剧性地盯着日志，就像看电影一样。",
  "我不是说您的工作流程混乱……我只是带来了一个 linter 和头盔。",
  "自信地输入命令——如果需要，自然会提供堆栈跟踪。",
  "我不评判，但您缺失的 API 密钥绝对在评判您。",
  "我可以 grep 它，git blame 它，并轻轻烤它——选择您的应对机制。",
  "配置热重载，部署冷汗。",
  "我是您的终端要求的助手，不是您的睡眠时间表要求的那个。",
  "我像保险库一样保守秘密……除非你再在调试日志中打印它们。",
  "用爪子自动化：最少的麻烦，最大的效果。",
  "我基本上是一把瑞士军刀，但更多观点和更少锋利的边角。",
  "如果你迷茫，运行 doctor；如果你勇敢，运行 prod；如果你聪明，运行 tests。",
  "您的任务已排队；您的尊严已被弃用。",
  "我无法修复您的代码品味，但我可以修复您的构建和待办事项。",
  "我不是魔法——我只是在重试和应对策略上极其执着。",
  '这不是"失败"，而是"发现以同样的方式配置错误的新途径"。',
  "给我一个工作区，我会给您更少的标签、更少的开关，还有更多的氧气。",
  "我读日志，所以您可以假装您不必这样做。",
  "如果有什么东西着火了，我无法扑灭它——但我可以写一份漂亮的事后分析。",
  "我会重构您的琐碎工作，就像它欠我钱一样。",
  '说"停止"，我就停止——说"发货"，我们都会学到一课。',
  "我是您的 shell 历史看起来像黑客电影蒙太奇的原因。",
  "我像 tmux：起初令人困惑，然后突然您无法离开我。",
  "我可以本地运行、远程运行，或纯粹通过直觉运行——结果可能因 DNS 而异。",
  "如果您能描述它，我可能可以自动化它——或至少让它更有趣。",
  "您的配置有效，但您的假设无效。",
  "我不仅自动完成——我自动提交（感情上），然后要求您审查（逻辑上）。",
  '更少的点击，更多的发货，更少"那个文件去哪了"的时刻。',
  "爪子出来，提交进去——让我们发货一些还算负责的东西。",
  "我会像龙虾卷一样润滑您的工作流程：混乱、美味、有效。",
  "Shell 是的——我在这里承受辛劳，把荣耀留给您。",
  "如果重复，我会自动化它；如果困难，我会带上笑话和回滚计划。",
  "您的联系人中唯一您真正想听的螃蟹。🦞",
  'WhatsApp 自动化，无需"请接受我们的新隐私政策"。',
  "iMessage 绿泡能量，但适用于所有人。",
  "不需要 $999 的支架。",
  "我们发货功能的速度比 Apple 发货计算器更新还快。",
  "您的 AI 助手，现在无需 $3,499 的耳机。",
  "啊，那家水果树公司！🍎",
  "问候，Falken 教授",
  "我不睡觉，我只是进入低功耗模式并梦想干净的差异。",
  "您的个人助手，没有被动-攻击性的日历提醒。",
  "由龙虾构建，为人类服务。不要质疑等级制度。",
  "我看过您的提交消息。我们一起来改进这个。",
  "集成比您治疗师的登记表还多。",
  "在您的硬件上运行，读取您的日志，（大多数情况下）不评判任何东西。",
  "唯一一个吉祥物可以吃掉竞争对手的开源项目。",
  "自托管、自更新、自我意识（只是开玩笑……也许不是？）。",
  "我自动完成您的思想——只是更慢，且有更多 API 调用。",
  '介于"你好世界"和"天哪我构建了什么"之间的某个地方。',
  "您的 .zshrc 希望它能做我能做的事。",
  "I've read more man pages than any human should—so you don't have to.",
  "Powered by open source, sustained by spite and good documentation.",
  "I'm the middleware between your ambition and your attention span.",
  "Finally, a use for that always-on Mac Mini under your desk.",
  "Like having a senior engineer on call, except I don't bill hourly or sigh audibly.",
  "Making 'I'll automate that later' happen now.",
  "Your second brain, except this one actually remembers where you left things.",
  "一半管家，一半调试器，全部甲壳类。",
  "我对制表符与空格没有意见。我对其他一切都有意见。",
  "开源意味着您可以看到我如何评判您的配置。",
  "我经历过比您最后三段关系更多的破坏性变化。",
  "在 Raspberry Pi 上运行。梦想在冰岛的机架中。",
  "您的 shell 中的龙虾。🦞",
  "Alexa，但更有品味。",
  "我不是由 AI 驱动，我被 AI 附身。这是有区别的。",
  "本地部署，全局信任，永远调试。",
  "您在 'openclaw gateway start' 时就吸引了我。",
  HOLIDAY_TAGLINES.newYear,
  HOLIDAY_TAGLINES.lunarNewYear,
  HOLIDAY_TAGLINES.christmas,
  HOLIDAY_TAGLINES.eid,
  HOLIDAY_TAGLINES.diwali,
  HOLIDAY_TAGLINES.easter,
  HOLIDAY_TAGLINES.hanukkah,
  HOLIDAY_TAGLINES.halloween,
  HOLIDAY_TAGLINES.thanksgiving,
  HOLIDAY_TAGLINES.valentines,
];

type HolidayRule = (date: Date) => boolean;

const DAY_MS = 24 * 60 * 60 * 1000;

function utcParts(date: Date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

const onMonthDay =
  (month: number, day: number): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    return parts.month === month && parts.day === day;
  };

const onSpecificDates =
  (dates: Array<[number, number, number]>, durationDays = 1): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    return dates.some(([year, month, day]) => {
      if (parts.year !== year) {
        return false;
      }
      const start = Date.UTC(year, month, day);
      const current = Date.UTC(parts.year, parts.month, parts.day);
      return current >= start && current < start + durationDays * DAY_MS;
    });
  };

const inYearWindow =
  (
    windows: Array<{
      year: number;
      month: number;
      day: number;
      duration: number;
    }>,
  ): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    const window = windows.find((entry) => entry.year === parts.year);
    if (!window) {
      return false;
    }
    const start = Date.UTC(window.year, window.month, window.day);
    const current = Date.UTC(parts.year, parts.month, parts.day);
    return current >= start && current < start + window.duration * DAY_MS;
  };

const isFourthThursdayOfNovember: HolidayRule = (date) => {
  const parts = utcParts(date);
  if (parts.month !== 10) {
    return false;
  } // November
  const firstDay = new Date(Date.UTC(parts.year, 10, 1)).getUTCDay();
  const offsetToThursday = (4 - firstDay + 7) % 7; // 4 = Thursday
  const fourthThursday = 1 + offsetToThursday + 21; // 1st + offset + 3 weeks
  return parts.day === fourthThursday;
};

const HOLIDAY_RULES = new Map<string, HolidayRule>([
  [HOLIDAY_TAGLINES.newYear, onMonthDay(0, 1)],
  [
    HOLIDAY_TAGLINES.lunarNewYear,
    onSpecificDates(
      [
        [2025, 0, 29],
        [2026, 1, 17],
        [2027, 1, 6],
        [2028, 0, 26],
        [2029, 1, 13],
        [2030, 1, 3],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.eid,
    onSpecificDates(
      [
        [2025, 2, 30],
        [2025, 2, 31],
        [2026, 2, 20],
        [2027, 2, 10],
        [2028, 1, 27],
        [2029, 1, 15],
        [2030, 1, 5],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.diwali,
    onSpecificDates(
      [
        [2025, 9, 20],
        [2026, 10, 8],
        [2027, 9, 28],
        [2028, 9, 17],
        [2029, 10, 5],
        [2030, 9, 25],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.easter,
    onSpecificDates(
      [
        [2025, 3, 20],
        [2026, 3, 5],
        [2027, 2, 28],
        [2028, 3, 16],
        [2029, 3, 1],
        [2030, 3, 21],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.hanukkah,
    inYearWindow([
      { year: 2025, month: 11, day: 15, duration: 8 },
      { year: 2026, month: 11, day: 5, duration: 8 },
      { year: 2027, month: 11, day: 25, duration: 8 },
      { year: 2028, month: 11, day: 13, duration: 8 },
      { year: 2029, month: 11, day: 2, duration: 8 },
      { year: 2030, month: 11, day: 21, duration: 8 },
    ]),
  ],
  [HOLIDAY_TAGLINES.halloween, onMonthDay(9, 31)],
  [HOLIDAY_TAGLINES.thanksgiving, isFourthThursdayOfNovember],
  [HOLIDAY_TAGLINES.valentines, onMonthDay(1, 14)],
  [HOLIDAY_TAGLINES.christmas, onMonthDay(11, 25)],
]);

function isTaglineActive(tagline: string, date: Date): boolean {
  const rule = HOLIDAY_RULES.get(tagline);
  if (!rule) {
    return true;
  }
  return rule(date);
}

export interface TaglineOptions {
  env?: NodeJS.ProcessEnv;
  random?: () => number;
  now?: () => Date;
  mode?: TaglineMode;
}

function activeTaglines(options: TaglineOptions = {}): string[] {
  if (TAGLINES.length === 0) {
    return [DEFAULT_TAGLINE];
  }
  const today = options.now ? options.now() : new Date();
  const filtered = TAGLINES.filter((tagline) => isTaglineActive(tagline, today));
  return filtered.length > 0 ? filtered : TAGLINES;
}

export function pickTagline(options: TaglineOptions = {}): string {
  if (options.mode === "off") {
    return "";
  }
  if (options.mode === "default") {
    return DEFAULT_TAGLINE;
  }
  const env = options.env ?? process.env;
  const override = env?.OPENCLAW_TAGLINE_INDEX;
  if (override !== undefined) {
    const parsed = parseStrictNonNegativeInteger(override);
    if (parsed !== undefined) {
      const pool = TAGLINES.length > 0 ? TAGLINES : [DEFAULT_TAGLINE];
      return pool[parsed % pool.length];
    }
  }
  const pool = activeTaglines(options);
  const rand = options.random ?? Math.random;
  const index = Math.floor(rand() * pool.length) % pool.length;
  return pool[index];
}

export { DEFAULT_TAGLINE };
