import { generateContent } from "../lib/gemini";
import type { GeneratedRoute, UserPreferences } from "../types";

export interface ReviewIssue {
  type: "ai_review";
  description: string;
}

export interface ReviewResult {
  passed: boolean;
  issues: ReviewIssue[];
}

export async function reviewRoute(
  route: GeneratedRoute,
  waypointCategories: string[],
  prefs: UserPreferences
): Promise<ReviewResult> {
  const stopsDesc = route.waypoints
    .map((w, i) => `第${i + 1}站: ${w.name}（${waypointCategories[i] ?? "未知"}）— ${w.description}`)
    .join("\n");

  const now = new Date();
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;

  const prompt = `
你是路线体验顾问。审查以下五道口散步路线是否合理。

路线：
${stopsDesc}
${route.hiddenTask ? `隐藏任务: ${route.hiddenTask.name}（${waypointCategories[route.waypoints.length] ?? "未知"}）` : ""}

当前时间：${timeStr}
用户偏好：心情=${prefs.mood}，时长=${prefs.duration}，安排程度=${prefs.intensity}

请逐条检查以下维度，列出所有不合理之处：
1. 品类多样性：连续两站是否同类型（如连续两家餐厅、连续两家咖啡厅）？整条路线是否品类太集中？
2. 活动节奏：吃完大餐后紧接剧烈户外运动不合理，应该先安排轻松的活动（逛书店、散步等）
3. 时间合理性：当前时间是否适合路线中的所有地点（如上午安排酒吧、深夜安排美术馆都不合理）
4. 体验递进：路线节奏是否单调（全程都是安静/全程都是热闘），还是有起伏变化
5. 综合常识：有没有其他不合理的地方（如连逛三家小卖铺、全程都在吃等）

只返回 JSON，不要其他文字：
{ "passed": true, "issues": [] }
或
{ "passed": false, "issues": ["具体问题描述1", "具体问题描述2"] }
`;

  try {
    const text = await generateContent("gemini-2.5-flash-lite", prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { passed: true, issues: [] };

    const parsed = JSON.parse(jsonMatch[0]);
    const issues: ReviewIssue[] = (parsed.issues ?? []).map((desc: string) => ({
      type: "ai_review" as const,
      description: desc,
    }));
    return { passed: !!parsed.passed && issues.length === 0, issues };
  } catch (e) {
    console.error("AI 审查失败，跳过：", e);
    return { passed: true, issues: [] };
  }
}
