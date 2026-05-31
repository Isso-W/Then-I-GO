import { GoogleGenAI } from "@google/genai";
import type { GeneratedRoute, UserPreferences, Waypoint, POI } from "../types";
import { filterCandidates, distanceMeters, walkingTimeText, ORIGIN } from "./poiFilter";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface ChatAction {
  type: "replace_next" | "skip_current" | "add_stop" | "none";
  waypoint?: Waypoint;
}

export interface ChatResponse {
  message: string;
  action: ChatAction;
}

export async function chatWithRoute(
  userMessage: string,
  route: GeneratedRoute | null,
  prefs: UserPreferences,
  currentPosition: { lat: number; lng: number }
): Promise<ChatResponse> {
  const candidates = filterCandidates(prefs);
  const usedIds = new Set(route?.waypoints.map((w) => w.name) ?? []);
  const nearby = candidates
    .filter((p) => !usedIds.has(p.name))
    .slice(0, 8)
    .map((p) => `${p.id}|${p.name}(${p.category})|标签:${p.tags.join(",")}|评分:${p.rating}|停留:${p.avg_stay_minutes}分`)
    .join("\n");

  const routeContext = route
    ? `当前路线「${route.title}」：${route.waypoints.map((w, i) => `${i + 1}.${w.name}`).join(" → ")}` +
      (route.hiddenTask ? `\n隐藏任务：${route.hiddenTask.name}` : "")
    : "还没有生成路线";

  const prompt = `
你是「那我走」探索助手，用户正在五道口散步探索中。根据用户的消息，回复建议或执行路线调整。

${routeContext}
用户当前位置：lat ${currentPosition.lat.toFixed(4)}, lng ${currentPosition.lng.toFixed(4)}

附近可用的候选地点（可以用来替换/新增站点）：
${nearby || "暂无额外候选"}

用户说：${userMessage}

请用以下 JSON 格式回复（不要有其他文字）：
{
  "message": "给用户的中文回复（自然、简短、有探索感，50字以内）",
  "action": {
    "type": "none | replace_next | skip_current | add_stop",
    "poi_id": "如果 type 不是 none，填候选的 poi_id",
    "description": "新站点的氛围描述（20字以内）",
    "task": "打卡任务（15字以内）",
    "reward": "奖励文案",
    "emoji": "代表 emoji"
  }
}

action.type 说明：
- none：只回复文字，不改路线（如回答问题、闲聊）
- replace_next：把下一站替换成新的地点
- skip_current：跳过当前站，直接进入下一站
- add_stop：在当前路线末尾加一站

如果用户只是聊天/问问题，type 用 none。只有用户明确要求改路线时才用其他 type。
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
    });

    const text = response.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { message: "抱歉，我没理解你的意思，能换个说法吗？", action: { type: "none" } };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const action: ChatAction = { type: parsed.action?.type ?? "none" };

    if (action.type !== "none" && parsed.action?.poi_id) {
      const poi = candidates.find((p) => p.id === parsed.action.poi_id);
      if (poi) {
        action.waypoint = {
          name: poi.name,
          description: parsed.action.description ?? poi.review_summary,
          task: parsed.action.task ?? "到这儿打个卡",
          reward: parsed.action.reward ?? "探索经验 +15",
          emoji: parsed.action.emoji ?? "📍",
          distanceText: walkingTimeText(distanceMeters(currentPosition, { lat: poi.lat, lng: poi.lng })),
          lat: poi.lat,
          lng: poi.lng,
        };
      }
    }

    return { message: parsed.message ?? "好的~", action };
  } catch (e) {
    console.error("chatAgent error:", e);
    return { message: "网络不太好，稍后再试试？", action: { type: "none" } };
  }
}
