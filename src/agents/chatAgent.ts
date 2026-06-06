import { generateContent } from "../lib/gemini";
import type { GeneratedRoute, UserPreferences, Waypoint, TripRecord } from "../types";
import { filterCandidates, distanceMeters, walkingTimeText, getBaseCategory, findPOIByName } from "./poiFilter";

export interface ChatAction {
  type: "replace_current" | "skip_current" | "add_stop" | "none";
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
  currentPosition: { lat: number; lng: number },
  waypointIndex: number = 0,
  history: TripRecord[] = [],
  weatherCode?: string,
  weatherTemp?: number,
): Promise<ChatResponse> {
  const candidates = filterCandidates(prefs, new Date(), undefined, history, weatherCode, weatherTemp);
  const usedNames = new Set(route?.waypoints.map((w) => w.name) ?? []);

  // 收集路线中已有的品类（排除当前站，因为替换当前站时允许同品类）
  const routeCategories = new Set<string>();
  route?.waypoints.forEach((w, i) => {
    if (i === waypointIndex) return;
    const poi = findPOIByName(w.name);
    if (poi) routeCategories.add(getBaseCategory(poi.category));
  });
  if (route?.hiddenTask) {
    const hp = findPOIByName(route.hiddenTask.name);
    if (hp) routeCategories.add(getBaseCategory(hp.category));
  }

  const nearby = candidates
    .filter((p) => !usedNames.has(p.name) && !routeCategories.has(getBaseCategory(p.category)))
    .slice(0, 8)
    .map((p) => `${p.id}|${p.name}(${p.category})|标签:${p.tags.join(",")}|评分:${p.rating}|停留:${p.avg_stay_minutes}分`)
    .join("\n");

  const currentStop = route?.waypoints[waypointIndex];
  const routeContext = route
    ? `当前路线「${route.title}」：${route.waypoints.map((w, i) => `${i === waypointIndex ? "→" : ""}${i + 1}.${w.name}`).join(" → ")}` +
      `\n当前正在前往第${waypointIndex + 1}站：${currentStop?.name ?? "未知"}` +
      (route.hiddenTask ? `\n隐藏任务：${route.hiddenTask.name}` : "")
    : "还没有生成路线";

  const remainingStops = (route?.waypoints.length ?? 0) - waypointIndex;

  console.groupCollapsed("💬 chatAgent 候选过滤");
  console.log("路线品类（锁定）:", [...routeCategories]);
  console.log("已用名字:", [...usedNames]);
  console.log(`候选 ${candidates.length} → 去重后 ${nearby.split("\n").filter(Boolean).length} 个`);
  console.log("候选列表:\n" + (nearby || "(空)"));
  console.groupEnd();

  const prompt = `
你是「那我走」探索助手，用户正在五道口散步探索中。根据用户的消息，回复建议或执行路线调整。

${routeContext}
剩余站点数：${remainingStops}
用户当前位置：lat ${currentPosition.lat.toFixed(4)}, lng ${currentPosition.lng.toFixed(4)}

附近可用的候选地点（可以用来替换/新增站点）：
${nearby || "暂无额外候选"}

用户说：${userMessage}

action.type 选择规则（严格遵守）：
1. replace_current：用户对当前站不满意、想换地方、不想去这个、想去别的类型 → 从候选里选一个替换。只要候选列表不为空就优先用这个，不要跳过。
2. skip_current：用户明确说"跳过""不去了""算了"且不需要替代 → 才用。仅剩 1 站时禁止跳过。
3. add_stop：用户想多去一个地方、还想再逛 → 末尾加一站。
4. none：闲聊、问路、问问题 → 只回文字。

回复要求：
- message 必须提到具体地点名，不要说"惊喜""神秘"之类的模糊话
- 如果是 replace_current，message 里要说明新地点是什么、为什么推荐
- 如果是 skip_current，message 里要说明下一站去哪
- 30字以内，说人话，别用感叹号堆砌

JSON 格式（不要有其他文字）：
{
  "message": "回复文案",
  "action": {
    "type": "none | replace_current | skip_current | add_stop",
    "poi_id": "候选的 poi_id（skip_current 和 none 不需要）",
    "description": "新站点氛围描述（20字以内）",
    "task": "打卡任务（15字以内）",
    "reward": "¥金额+券名（如¥15饮品抵扣券）",
    "emoji": "代表 emoji"
  }
}
`;

  console.groupCollapsed("📤 chatAgent prompt");
  console.log(prompt);
  console.groupEnd();

  try {
    const text = await generateContent("gemini-2.5-flash-lite", prompt);

    console.groupCollapsed("📥 chatAgent Gemini 返回");
    console.log(text);
    console.groupEnd();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("💬 chatAgent: 无法解析 JSON");
      return { message: "抱歉，我没理解你的意思，能换个说法吗？", action: { type: "none" } };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    let rawType: string = parsed.action?.type ?? "none";
    if (rawType === "replace_next") rawType = "replace_current";
    const action: ChatAction = { type: rawType as ChatAction["type"] };

    if (action.type !== "none" && action.type !== "skip_current" && parsed.action?.poi_id) {
      const poi = candidates.find((p) => p.id === parsed.action.poi_id);
      if (poi) {
        action.waypoint = {
          name: poi.name,
          description: parsed.action.description ?? poi.review_summary,
          task: parsed.action.task ?? "到这儿打个卡",
          reward: parsed.action.reward ?? "¥10探索优惠券",
          emoji: parsed.action.emoji ?? "📍",
          distanceText: walkingTimeText(distanceMeters(currentPosition, { lat: poi.lat, lng: poi.lng })),
          lat: poi.lat,
          lng: poi.lng,
          category: poi.category,
        };
      } else {
        console.warn(`💬 chatAgent: poi_id "${parsed.action.poi_id}" 未在候选中找到`);
      }
    }

    if (action.type === "skip_current" && remainingStops <= 1) {
      action.type = "none";
      console.log("💬 chatAgent: 仅剩 1 站，拦截 skip_current");
      return { message: "这已经是最后一站了，坚持走完吧", action };
    }

    console.log(`💬 chatAgent 结果: action=${action.type}`, action.waypoint ? `→ ${action.waypoint.name}` : "", `| message="${parsed.message}"`);

    return { message: parsed.message ?? "好的~", action };
  } catch (e) {
    console.error("chatAgent error:", e);
    return { message: "网络不太好，稍后再试试？", action: { type: "none" } };
  }
}
