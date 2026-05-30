import { GoogleGenAI } from "@google/genai";
import type { UserPreferences, UserProfile, GeneratedRoute, POI, Waypoint } from "../types";
import {
  filterCandidates,
  distanceMeters,
  walkingTimeText,
  pickUnknownPOIs,
  ORIGIN,
} from "./poiFilter";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const MOOD_LABELS: Record<string, string> = {
  happy: "开心", tired: "疲惫", bored: "无聊",
  relax: "想放松", explore: "想探索", hungry: "想吃好的",
};
const DURATION_LABELS: Record<string, string> = {
  "30min": "30分钟", "1h": "1小时", "2h": "2小时", half_day: "半天",
};
const TRANSPORT_LABELS: Record<string, string> = {
  walk: "步行", bus: "公交/地铁",
};
const SPECIAL_LABELS: Record<string, string> = {
  art: "文艺", outdoor: "户外", food: "美食", busy: "热闹",
  family: "亲子", photo: "拍照", niche: "小众", budget: "省钱",
};
const FOOD_LABELS: Record<string, string> = {
  light: "清淡", spicy: "麻辣", western: "西式", coffee: "甜品咖啡",
};
const INTENSITY_LABELS: Record<string, string> = {
  relaxed: "轻松带路", normal: "正常探索", "don't_think": "别让我思考（全权安排）",
};

// 时长 → 期望打卡点数量
const DURATION_TO_WAYPOINTS: Record<string, number> = {
  "30min": 1,
  "1h": 2,
  "2h": 3,
  half_day: 4,
};

interface GeminiSelection {
  poi_id: string;
  description: string;
  task: string;
  reward: string;
  emoji: string;
}
interface GeminiResponse {
  title: string;
  selections: GeminiSelection[];
  hidden?: GeminiSelection;
}

function buildCandidateBlock(candidates: POI[]): string {
  return candidates
    .map((p) => {
      const dist = Math.round(
        distanceMeters(ORIGIN, { lat: p.lat, lng: p.lng })
      );
      return `- ${p.id} | ${p.name}（${p.category}）| 标签:${p.tags.join(",")} | 评分:${p.rating} | 平均停留:${p.avg_stay_minutes}分 | 距起点:${dist}米
  简评:${p.review_summary}`;
    })
    .join("\n");
}

function hydrate(sel: GeminiSelection, poi: POI): Waypoint {
  const dist = distanceMeters(ORIGIN, { lat: poi.lat, lng: poi.lng });
  return {
    name: poi.name,
    description: sel.description,
    task: sel.task,
    reward: sel.reward,
    emoji: sel.emoji,
    distanceText: walkingTimeText(dist),
    lat: poi.lat,
    lng: poi.lng,
  };
}

export async function generateRoute(
  prefs: UserPreferences,
  profile: UserProfile | null = null
): Promise<GeneratedRoute> {
  const candidates = filterCandidates(prefs);
  if (candidates.length === 0) {
    throw new Error("没有可用的 POI 候选");
  }

  const targetCount = DURATION_TO_WAYPOINTS[prefs.duration] ?? 2;
  const actualCount = Math.min(targetCount, candidates.length);

  // 长期属性（冷启动收集）和当下偏好分两块写进 prompt
  const profileLines: string[] = [];
  if (profile?.mbti) profileLines.push(`- MBTI 人格：${profile.mbti}`);
  if (profile?.interests && profile.interests.length > 0) {
    profileLines.push(
      `- 长期兴趣：${profile.interests.map((s) => SPECIAL_LABELS[s] ?? s).join("、")}`
    );
  }
  const profileBlock = profileLines.length > 0
    ? `\n用户长期属性（影响整体文案语气和选址倾向）：\n${profileLines.join("\n")}\n`
    : "";

  const prompt = `
你是一个城市探索助手，为用户从下面的候选地点里挑选 ${actualCount} 个组成一条五道口周末散步路线。
${profileBlock}
用户当下偏好：
- 心情：${MOOD_LABELS[prefs.mood] ?? prefs.mood}
- 游玩时长：${DURATION_LABELS[prefs.duration] ?? prefs.duration}
- 出行方式：${TRANSPORT_LABELS[prefs.transport] ?? prefs.transport}
- 偏好标签：${prefs.special.map(s => SPECIAL_LABELS[s] ?? s).join("、") || "无特殊偏好"}
- 餐饮偏好：${prefs.foodPreference.map(f => FOOD_LABELS[f] ?? f).join("、") || "无特殊偏好"}
- 安排程度：${INTENSITY_LABELS[prefs.intensity] ?? prefs.intensity}

候选地点（必须从这里选，不要编造）：
${buildCandidateBlock(candidates)}

任务：
1. 从候选里挑选 ${actualCount} 个 poi_id，按推荐游玩顺序排列
2. 给每个挑选的地点写故事氛围、打卡任务、奖励文案、emoji
3. 写一个 10 字以内有意境的路线标题
4. 另外再选 1 个与上面都不同的地点作为"隐藏任务"（藏在附近的惊喜坐标），同样写神秘氛围/打卡任务/奖励/emoji，放进 hidden 字段

严格按照以下 JSON 格式返回，不要有任何其他文字：
{
  "title": "路线标题",
  "selections": [
    {
      "poi_id": "候选列表里的 id（如 poi_001）",
      "description": "这个地点的故事或氛围描述（30字以内）",
      "task": "到达后的打卡任务提示（20字以内）",
      "reward": "完成后的奖励（如：美团单车7天卡、餐饮券8折）",
      "emoji": "一个代表这个地点的 emoji"
    }
  ],
  "hidden": {
    "poi_id": "另一个与 selections 都不同的候选 id",
    "description": "隐藏地点的神秘氛围描述（30字以内）",
    "task": "隐藏打卡任务提示（20字以内）",
    "reward": "隐藏奖励（如：限定徽章、隐藏菜单券）",
    "emoji": "一个代表这个地点的 emoji"
  }
}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: prompt,
  });

  const text = response.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Gemini 返回的格式不对，没找到 JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]) as GeminiResponse;
  const byId = new Map(candidates.map((p) => [p.id, p]));

  const usedIds = new Set<string>();
  const waypoints: Waypoint[] = [];
  for (const sel of parsed.selections ?? []) {
    const poi = byId.get(sel.poi_id);
    if (!poi || usedIds.has(sel.poi_id)) continue; // 幻觉 id 或重复就跳过
    usedIds.add(sel.poi_id);
    waypoints.push(hydrate(sel, poi));
  }

  // Gemini 全跳过了的兜底：拿前 N 个候选直接生成简易 waypoint
  if (waypoints.length === 0) {
    candidates.slice(0, actualCount).forEach((poi) => {
      usedIds.add(poi.id);
      waypoints.push({
        name: poi.name,
        description: poi.review_summary,
        task: "到达后打个卡吧",
        reward: "探索经验 +10",
        emoji: "📍",
        distanceText: walkingTimeText(
          distanceMeters(ORIGIN, { lat: poi.lat, lng: poi.lng })
        ),
        lat: poi.lat,
        lng: poi.lng,
      });
    });
  }

  // 隐藏任务：优先用 Gemini 选的 hidden（须是另一个有效候选），否则取第一个未用候选兜底
  let hiddenTask: Waypoint | undefined;
  const hsel = parsed.hidden;
  if (hsel && byId.has(hsel.poi_id) && !usedIds.has(hsel.poi_id)) {
    hiddenTask = hydrate(hsel, byId.get(hsel.poi_id)!);
    usedIds.add(hsel.poi_id);
  } else {
    const leftover = candidates.find((p) => !usedIds.has(p.id));
    if (leftover) {
      hiddenTask = {
        name: leftover.name,
        description: leftover.review_summary,
        task: "找到这个隐藏坐标，完成一次特别打卡",
        reward: "隐藏奖励 +50 XP",
        emoji: "✨",
        distanceText: walkingTimeText(
          distanceMeters(ORIGIN, { lat: leftover.lat, lng: leftover.lng })
        ),
        lat: leftover.lat,
        lng: leftover.lng,
      };
      usedIds.add(leftover.id);
    }
  }

  // 未探索标记：剩余候选里取最多 3 个坐标，地图上渲染成"?"
  const unknownPOIs = pickUnknownPOIs(candidates, usedIds, 3);

  return {
    title: parsed.title ?? "五道口漫游",
    waypoints,
    hiddenTask,
    unknownPOIs,
  };
}
