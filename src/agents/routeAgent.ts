import { GoogleGenAI } from "@google/genai";
import type { UserPreferences, GeneratedRoute } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// 把用户选的 id 翻译成中文，方便放进 prompt
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

export async function generateRoute(prefs: UserPreferences): Promise<GeneratedRoute> {
  const prompt = `
你是一个城市探索助手，专门为用户生成个性化的周末散步路线。

用户当前信息：
- 心情：${MOOD_LABELS[prefs.mood] ?? prefs.mood}
- 游玩时长：${DURATION_LABELS[prefs.duration] ?? prefs.duration}
- 出行方式：${TRANSPORT_LABELS[prefs.transport] ?? prefs.transport}
- 偏好标签：${prefs.special.map(s => SPECIAL_LABELS[s] ?? s).join("、") || "无特殊偏好"}
- 餐饮偏好：${prefs.foodPreference.map(f => FOOD_LABELS[f] ?? f).join("、") || "无特殊偏好"}
- 安排程度：${INTENSITY_LABELS[prefs.intensity] ?? prefs.intensity}

请生成一条有 2~3 个打卡点的路线。

严格按照以下 JSON 格式返回，不要有任何其他文字：
{
  "title": "路线标题（10字以内，有意境）",
  "waypoints": [
    {
      "name": "地点名称",
      "description": "这个地点的故事或氛围描述（30字以内）",
      "task": "到达后的打卡任务提示（20字以内）",
      "reward": "完成后的奖励描述（如：美团单车7天卡、餐饮券8折）",
      "emoji": "一个代表这个地点的 emoji",
      "distanceText": "距离描述（如：步行约8分钟）"
    }
  ]
}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: prompt,
  });

  const text = response.text ?? "";

  // 从返回文本中提取 JSON（防止 Gemini 多说了一些文字）
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Gemini 返回的格式不对，没找到 JSON");
  }

  return JSON.parse(jsonMatch[0]) as GeneratedRoute;
}
