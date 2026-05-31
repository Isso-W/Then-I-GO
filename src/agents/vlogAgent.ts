import { GoogleGenAI } from "@google/genai";
import type { GeneratedVlog, VlogScene, VlogStyle } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// 三种风格的中文描述 + BGM 倾向，喂给 prompt 影响文案语气
const STYLE_BRIEF: Record<VlogStyle, { label: string; vibe: string; bgm: string }> = {
  cyberpunk: {
    label: "赛博朋克",
    vibe: "霓虹夜色、未来都市、强烈对比、酷感十足，旁白带点冷峻诗意",
    bgm: "Synthwave 电子 · 110 BPM",
  },
  retro: {
    label: "复古胶片",
    vibe: "暖色颗粒、怀旧胶片、City Pop 年代感，旁白温柔带一点感伤",
    bgm: "City Pop · 90 BPM",
  },
  fresh: {
    label: "日系清新",
    vibe: "柔和自然光、治愈轻盈、Lo-fi 氛围，旁白干净明亮、生活感",
    bgm: "Lo-fi 治愈 · 75 BPM",
  },
};

// demo 占位 B-roll（真实场景后续由用户上传替换）。
const FRAMES = {
  coffee: "/vlog/coffee.jpg",
  park: "/vlog/park.jpg",
  bookstore: "/vlog/bookstore.jpg",
} as const;
const ALL_FRAMES = [FRAMES.coffee, FRAMES.park, FRAMES.bookstore];

// 站点名关键词命中哪张图（命不中返回 null）
function keywordFrame(name: string): string | null {
  const n = name.toLowerCase();
  if (/咖啡|奶茶|茶|甜品|酒|bar|coffee|cafe|tea/.test(n)) return FRAMES.coffee;
  if (/书|文创|阅读|展|美术|画廊|book|library|art/.test(n)) return FRAMES.bookstore;
  if (/公园|园|绿|湖|河|户外|广场|山|park|garden/.test(n)) return FRAMES.park;
  return null;
}

// 给所有站点分配图：先按关键词命中，剩下的槽位填"用得最少"的图，
// 保证 3 张都尽量出场、且不连续重复同一张（解决 bookstore 永远轮不到的问题）。
function assignFrames(stops: VlogStop[]): string[] {
  const result: (string | null)[] = stops.map((s) => keywordFrame(s.name));
  const count = new Map<string, number>(ALL_FRAMES.map((f) => [f, 0]));
  result.forEach((f) => f && count.set(f, count.get(f)! + 1));

  for (let i = 0; i < result.length; i++) {
    if (result[i]) continue;
    const prev = result[i - 1];
    const next = result[i + 1]; // 可能已被关键词占用
    // 候选：避开前后相邻的图（避免连续重复）；不够就放宽
    let cand = ALL_FRAMES.filter((f) => f !== prev && f !== next);
    if (cand.length === 0) cand = ALL_FRAMES.filter((f) => f !== prev);
    if (cand.length === 0) cand = [...ALL_FRAMES];
    // 在候选里选用得最少的
    const pick = cand.sort((a, b) => count.get(a)! - count.get(b)!)[0];
    result[i] = pick;
    count.set(pick, count.get(pick)! + 1);
  }
  return result as string[];
}

export interface VlogStop {
  name: string;
  desc: string;
  emoji?: string;
  photo?: string;   // 用户为这一站上传的照片（dataURL）；有则覆盖占位 B-roll
}

interface GeminiScene {
  caption: string;
  narration: string;
  emoji: string;
  durationSec?: number;
}
interface GeminiVlog {
  title: string;
  scenes: GeminiScene[];
  bgm: string;
  shareCaption: string;
  verdict: string;
}

function makeId(): string {
  return `vlog_${Date.now().toString(36)}`;
}

// Gemini 失败 / 解析失败时，从站点直接拼一支能播的 Vlog
function fallbackVlog(
  routeTitle: string,
  stops: VlogStop[],
  style: VlogStyle
): GeneratedVlog {
  const brief = STYLE_BRIEF[style];
  const frames = assignFrames(stops);
  const scenes: VlogScene[] = stops.map((s, i) => ({
    caption: s.name.slice(0, 10),
    narration: s.desc.slice(0, 25) || `在${s.name}停留片刻`,
    emoji: s.emoji || "📍",
    frame: s.photo || frames[i],   // 用户照片优先，否则占位 B-roll
    durationSec: 3,
  }));
  return {
    id: makeId(),
    title: routeTitle || "五道口漫游",
    style,
    scenes,
    bgm: brief.bgm,
    shareCaption: `今天在五道口走了一圈，${routeTitle}。#那我走 #城市漫游 #${brief.label}`,
    verdict: `今天你走了 ${stops.length} 站，是个不折不扣的 City Walker`,
    createdAt: Date.now(),
  };
}

/**
 * Vlog Agent：把今日路线站点 + 选定风格，交给 Gemini 生成一支可播放的 Vlog 脚本
 * （标题 / 分镜旁白字幕 / BGM 情绪 / 分享文案）。图片用占位 B-roll，由前端按站点挑。
 */
export async function generateVlog(params: {
  routeTitle: string;
  stops: VlogStop[];
  style: VlogStyle;
}): Promise<GeneratedVlog> {
  const { routeTitle, stops, style } = params;
  if (stops.length === 0) {
    return fallbackVlog(routeTitle, [{ name: routeTitle, desc: "记录这一天" }], style);
  }

  const brief = STYLE_BRIEF[style];
  const stopBlock = stops
    .map((s, i) => `${i + 1}. ${s.name}${s.desc ? `（${s.desc}）` : ""}`)
    .join("\n");

  const prompt = `
你是一个短视频 Vlog 剪辑师，要把用户今天在北京五道口的一次漫步剪成一支竖屏 Vlog。
风格：${brief.label} —— ${brief.vibe}。

今日行程（按顺序，每个站点剪成一个分镜）：
${stopBlock}

任务：
1. 给整支 Vlog 起一个 12 字以内、有${brief.label}味道的标题。
2. 为每个站点写一个分镜：一句画面字幕 caption（<=8字）、一句旁白 narration（<=25字，符合${brief.label}语气）、一个 emoji、停留秒数 durationSec（2~4 的整数）。分镜顺序和数量必须和上面行程一致。
3. 写一句 BGM 情绪描述 bgm（可参考"${brief.bgm}"）。
4. 写一段适合发社交平台的分享文案 shareCaption（<=60字，结尾带 2~3 个话题标签，包含 #那我走）。
5. 写一句对今天这趟漫步的人格化总结金句 verdict（<=18字，像给用户贴标签/下定义，如"今天你是个慢生活诗人"）。

严格按以下 JSON 返回，不要有任何其他文字：
{
  "title": "标题",
  "scenes": [
    { "caption": "字幕", "narration": "旁白", "emoji": "emoji", "durationSec": 3 }
  ],
  "bgm": "BGM 情绪",
  "shareCaption": "分享文案 #那我走",
  "verdict": "人格化总结金句"
}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
    });
    const text = response.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("没找到 JSON");

    const parsed = JSON.parse(jsonMatch[0]) as GeminiVlog;
    const rawScenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];

    // 按站点对齐：每个站点一幕，缺的用站点本身兜底，挂上占位帧
    const frames = assignFrames(stops);
    const scenes: VlogScene[] = stops.map((s, i) => {
      const g = rawScenes[i];
      const dur = g?.durationSec;
      return {
        caption: (g?.caption || s.name).slice(0, 10),
        narration: (g?.narration || s.desc || `在${s.name}停留片刻`).slice(0, 30),
        emoji: g?.emoji || s.emoji || "📍",
        frame: s.photo || frames[i],   // 用户照片优先，否则占位 B-roll

        durationSec: typeof dur === "number" && dur >= 2 && dur <= 5 ? Math.round(dur) : 3,
      };
    });

    return {
      id: makeId(),
      title: (parsed.title || routeTitle || "五道口漫游").slice(0, 16),
      style,
      scenes,
      bgm: parsed.bgm || brief.bgm,
      shareCaption:
        parsed.shareCaption ||
        `今天在五道口走了一圈，${routeTitle}。#那我走 #城市漫游`,
      verdict:
        (parsed.verdict || `今天你走了 ${stops.length} 站，是个 City Walker`).slice(0, 22),
      createdAt: Date.now(),
    };
  } catch (err) {
    console.error("Vlog 生成失败，使用兜底：", err);
    return fallbackVlog(routeTitle, stops, style);
  }
}
