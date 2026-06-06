import { generateContent } from "../lib/gemini";
import type { UserPreferences, UserProfile, GeneratedRoute, POI, Waypoint, TripRecord } from "../types";
import {
  filterCandidates,
  scorePOIDetailed,
  extractVisitedNames,
  isOpenAt,
  distanceMeters,
  walkingTimeText,
  findPOIByName,
  ORIGIN,
} from "./poiFilter";
import { reviewRoute, checkOpenHours, type ReviewResult, type ClosedStop } from "./routeReviewer";

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
  photo: "拍照", niche: "小众", budget: "省钱",
};
const FOOD_LABELS: Record<string, string> = {
  light: "清淡", spicy: "麻辣", western: "西式", coffee: "甜品咖啡",
};
const INTENSITY_LABELS: Record<string, string> = {
  normal: "正常探索", "don't_think": "别让我思考（全权安排）",
};
const COMPANION_LABELS: Record<string, string> = {
  solo: "独自一人", couple: "情侣约会", friends: "朋友同行", family: "家庭出游",
};

// 时长 → 期望打卡点数量
const DURATION_TO_WAYPOINTS: Record<string, number> = {
  "1h": 1,
  "2h": 1,
  half_day: 2,
  full_day: 3,
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
}

function buildHistorySummary(history: TripRecord[]): string {
  const recent = history.slice(0, 5);
  if (recent.length === 0) return "";

  const lines: string[] = [];

  const visited = recent.flatMap((t) => t.waypoints.filter((w) => w.visited).map((w) => w.name));
  const skipped = recent.flatMap((t) => t.waypoints.filter((w) => !w.visited).map((w) => w.name));
  if (visited.length > 0) lines.push(`- 最近去过：${[...new Set(visited)].slice(0, 6).join("、")}`);
  if (skipped.length > 0) lines.push(`- 跳过/不感兴趣：${[...new Set(skipped)].slice(0, 4).join("、")}`);

  const reactions = recent.filter((t) => t.reaction).map((t) => t.reaction);
  if (reactions.length > 0) lines.push(`- 反馈倾向：${reactions.join(" ")}`);

  const chatCount = recent.reduce((n, t) => n + t.chatActions.length, 0);
  if (chatCount > 0) lines.push(`- 曾 ${chatCount} 次通过聊天调整路线`);

  if (lines.length === 0) return "";
  return `\n用户历史探索记录（避免重复推荐不满意的地点）：\n${lines.join("\n")}\n`;
}

const CATEGORY_REWARDS: Record<string, string> = {
  咖啡厅: "¥15饮品抵扣券",
  书店: "¥20购书折扣券",
  文创小店: "¥10手作体验券",
  美术馆: "¥15展览折扣券",
  餐厅: "¥20餐饮代金券",
  奶茶甜品: "¥8奶茶抵扣券",
  电竞网咖: "¥15上机时长券",
  livehouse: "¥30演出折扣券",
  公园绿地: "¥5骑行体验券",
  花店: "¥15鲜花折扣券",
  夜宵烧烤: "¥25烧烤代金券",
  酒吧: "¥20特调鸡尾酒券",
  宠物友好咖啡: "¥12饮品抵扣券",
  健身瑜伽: "¥30单次体验券",
  景点地标: "¥10纪念品折扣券",
  夜店: "¥50入场优惠券",
  KTV: "¥30欢唱时长券",
  电影院: "¥25电影兑换券",
  美食城: "¥15美食代金券",
  美食街: "¥10小吃品尝券",
  台球棋牌: "¥20免费开台券",
  桌游密室: "¥35密室体验券",
  运动娱乐: "¥25运动体验券",
};

function rewardHint(category: string): string {
  for (const [key, hint] of Object.entries(CATEGORY_REWARDS)) {
    if (category.includes(key) || key.replace("/", "").split("").some(c => category.includes(c) && c.length > 1)) {
      return hint;
    }
  }
  const base = category.match(/^(餐厅|酒吧)/);
  if (base) return CATEGORY_REWARDS[base[1]] ?? "¥5骑行体验券";
  const fallbacks = ["¥5骑行体验券", "¥10打车优惠券"];
  return fallbacks[category.length % 2];
}

function buildCandidateBlock(candidates: POI[]): string {
  return candidates
    .map((p) => {
      const dist = Math.round(distanceMeters(ORIGIN, { lat: p.lat, lng: p.lng }));
      return `- ${p.id} | ${p.name}（${p.category}）| 营业:${p.open_hours} | 距起点:${dist}米 | 停留:${p.avg_stay_minutes}分 | 推荐奖励:${rewardHint(p.category)}
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
    category: poi.category,
  };
}

interface GenerateContext {
  candidates: POI[];
  byId: Map<string, POI>;
  prefs: UserPreferences;
  profile: UserProfile | null;
  history: TripRecord[];
  selectionCount: number;
}

function estimateSlots(now: Date, durationKey: string, stopCount: number): string {
  const durMin = ({ "1h": 60, "2h": 120, half_day: 240, full_day: 480 } as Record<string, number>)[durationKey] ?? 60;
  const slotMin = Math.round(durMin / stopCount);
  const startMin = now.getHours() * 60 + now.getMinutes();
  const lines: string[] = [];
  for (let i = 0; i < stopCount; i++) {
    const arrMin = startMin + slotMin * i + 15; // +15 = 步行估算
    const h = Math.floor(arrMin / 60) % 24;
    const m = arrMin % 60;
    const label = i < stopCount - 1 ? `第${i + 1}站` : `隐藏站`;
    lines.push(`- ${label}: 约 ${h}:${String(m).padStart(2, "0")} 到达`);
  }
  return lines.join("\n");
}

function mealHint(now: Date, durationKey: string): string {
  const h = now.getHours();
  const durMin = ({ "1h": 60, "2h": 120, half_day: 240, full_day: 480 } as Record<string, number>)[durationKey] ?? 60;
  const endH = h + durMin / 60;
  const spans: string[] = [];
  if ((h <= 12 && endH >= 11) || (h >= 11 && h <= 13)) spans.push("午餐时段(11:00-13:00)");
  if ((h <= 19 && endH >= 17) || (h >= 17 && h <= 19)) spans.push("晚餐时段(17:00-19:00)");
  if (spans.length === 0) return "";
  return `\n⏰ 路线时段覆盖 ${spans.join(" 和 ")}，请在对应时段安排一个**正餐**类地点（餐厅/火锅/东北菜/日韩料理/小吃/美食城/夜宵烧烤等能吃饱的地方），让用户在饭点吃上饭。注意：咖啡厅、奶茶甜品、面包蛋糕、宠物咖啡等不算正餐，不能替代饭点的餐饮安排。\n`;
}

function buildPrompt(ctx: GenerateContext, revisionNote?: string): string {
  const { prefs, profile, history, candidates, selectionCount } = ctx;

  const now = new Date();
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;

  const profileLines: string[] = [];
  if (profile?.name) profileLines.push(`- 昵称：${profile.name}`);
  if (profile?.gender) {
    const genderLabel = profile.gender === "male" ? "男" : profile.gender === "female" ? "女" : "保密";
    if (genderLabel !== "保密") profileLines.push(`- 性别：${genderLabel}`);
  }
  if (profile?.mbti) profileLines.push(`- MBTI 人格：${profile.mbti}`);
  if (profile?.interests && profile.interests.length > 0) {
    profileLines.push(`- 长期兴趣：${profile.interests.map((s) => SPECIAL_LABELS[s] ?? s).join("、")}`);
  }
  const profileBlock = profileLines.length > 0
    ? `\n用户长期属性（影响整体文案语气和选址倾向）：\n${profileLines.join("\n")}\n`
    : "";
  const historyBlock = buildHistorySummary(history);

  const totalSelections = selectionCount + 1; // +1 for hidden task
  const tasks = [
    `从候选里挑选 ${totalSelections} 个 poi_id，尽量选距离相近的地点，品类要多样（不要连续选同类型地点）`,
    `给每个挑选的地点写故事氛围、打卡任务、奖励文案（格式"¥金额+券名"如"¥20餐饮代金券"，参考推荐奖励字段的金额；不发徽章）、emoji`,
    `写一个 10 字以内有意境的路线标题`,
    `selections 中除了主路线站点外，还需要一个"隐藏惊喜站"——它会在用户完成第一站后触发，所以**隐藏站必须在地理上靠近第一站**（距离 < 500m）。隐藏站的奖励要比其他站更好（限定折扣/稀缺优惠券），任务要有趣且有一点小挑战。隐藏站的奖励必须与该地点品类相关（参考其"推荐奖励"字段），不要给不相关的奖励。在 JSON 中把隐藏站放在 selections 的最后一个`,
  ];
  const taskBlock = tasks.map((t, i) => `${i + 1}. ${t}`).join("\n");

  const revisionBlock = revisionNote
    ? `\n⚠️ 上一版路线有以下问题，这次必须避免：\n${revisionNote}\n`
    : "";

  return `
你是一个城市探索助手，为用户从下面的候选地点里挑选地点组成一条五道口周末散步路线。
${profileBlock}${historyBlock}${revisionBlock}
当前时间：${timeStr}

用户当下偏好：
- 心情：${MOOD_LABELS[prefs.mood] ?? prefs.mood}
- 游玩时长：${DURATION_LABELS[prefs.duration] ?? prefs.duration}
- 出行方式：${TRANSPORT_LABELS[prefs.transport] ?? prefs.transport}
- 偏好标签：${prefs.special.map(s => SPECIAL_LABELS[s] ?? s).join("、") || "无特殊偏好"}
- 餐饮偏好：${prefs.foodPreference.map(f => FOOD_LABELS[f] ?? f).join("、") || "无特殊偏好"}
- 安排程度：${INTENSITY_LABELS[prefs.intensity] ?? prefs.intensity}
- 同行人：${COMPANION_LABELS[prefs.companion] ?? prefs.companion ?? "独自一人"}
${mealHint(now, prefs.duration)}

候选地点（必须从这里选，不要编造；尽量选距离相近的地点，路线顺序由后续审查调整）：
${buildCandidateBlock(candidates)}

注意营业时间：用户从 ${timeStr} 出发。各站位预估到达时间：
${estimateSlots(now, prefs.duration, totalSelections)}
请确保每个站点在对应的预估到达时间仍在营业（对照候选的"营业"字段）。

任务：
${taskBlock}

严格按照以下 JSON 格式返回，不要有任何其他文字：
{
  "title": "路线标题",
  "selections": [
    {
      "poi_id": "候选列表里的 id（如 poi_001）",
      "description": "这个地点的故事或氛围描述（30字以内）",
      "task": "到达后的打卡任务提示（20字以内）",
      "reward": "¥金额+券名（如¥20餐饮代金券；参考候选的'推荐奖励'字段的金额和类型，不发徽章）",
      "emoji": "一个代表这个地点的 emoji"
    }
  ]
}
注意：最后一个 selection 是隐藏惊喜站，它必须在地理上靠近第一站（完成第一站后才触发），reward 更好（限定折扣/稀缺优惠券），task 有趣有挑战。奖励只发优惠券/代金券，不发徽章，必须与该地点品类相关。
`;
}

function parseAndHydrate(
  text: string,
  ctx: GenerateContext
): GeneratedRoute {
  const { candidates, byId } = ctx;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Gemini 返回的格式不对，没找到 JSON");

  const parsed = JSON.parse(jsonMatch[0]) as GeminiResponse;
  const usedIds = new Set<string>();
  const waypoints: Waypoint[] = [];
  const maxSelections = ctx.selectionCount + 1; // +1 隐藏任务
  for (const sel of parsed.selections ?? []) {
    if (waypoints.length >= maxSelections) break;
    const poi = byId.get(sel.poi_id);
    if (!poi || usedIds.has(sel.poi_id)) continue;
    usedIds.add(sel.poi_id);
    waypoints.push(hydrate(sel, poi));
  }

  if (waypoints.length === 0) {
    candidates.slice(0, ctx.selectionCount).forEach((poi) => {
      usedIds.add(poi.id);
      waypoints.push({
        name: poi.name, description: poi.review_summary,
        task: "到达后打个卡吧", reward: "¥5骑行体验券", emoji: "📍",
        distanceText: walkingTimeText(distanceMeters(ORIGIN, { lat: poi.lat, lng: poi.lng })),
        lat: poi.lat, lng: poi.lng, category: poi.category,
      });
    });
  }

  return { title: parsed.title ?? "五道口漫游", waypoints };
}

function resolveCategories(route: GeneratedRoute): string[] {
  return route.waypoints.map((w) => findPOIByName(w.name)?.category ?? "未知");
}

async function swapClosedStop(
  closed: ClosedStop,
  pool: POI[],
  original: Waypoint,
): Promise<Waypoint | null> {
  // 筛出到达时间营业的候选
  const arrDate = new Date();
  const [h, m] = closed.arrivalTime.split(":").map(Number);
  arrDate.setHours(h, m, 0, 0);
  const openPool = pool.filter(p => isOpenAt(p.open_hours, arrDate));
  if (openPool.length === 0) return null;

  const candidateLines = openPool.slice(0, 8).map(p =>
    `- ${p.id} | ${p.name}（${p.category}）| 营业:${p.open_hours} | 推荐奖励:${rewardHint(p.category)}\n  简评:${p.review_summary}`
  ).join("\n");

  const prompt = `
你是城市探索助手。路线中"${closed.name}"预计 ${closed.arrivalTime} 到达，但该店 ${closed.openHours} 营业，届时已打烊。
请从以下候选中选一个替补地点，写故事/任务/奖励：

${candidateLines}

严格按以下 JSON 返回，不要其他文字：
{
  "poi_id": "候选id",
  "description": "故事氛围描述（30字以内）",
  "task": "打卡任务提示（20字以内）",
  "reward": "¥金额+券名（参考推荐奖励）",
  "emoji": "一个 emoji"
}
`;

  try {
    const text = await generateContent("gemini-2.5-flash-lite", prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const sel = JSON.parse(jsonMatch[0]) as GeminiSelection;
    const poi = openPool.find(p => p.id === sel.poi_id);
    if (!poi) return null;
    console.log(`🔄 换补 LLM: ${closed.name} → ${poi.name}`);
    return hydrate(sel, poi);
  } catch (e) {
    console.warn("换补 LLM 调用失败:", e);
    // 确定性兜底：直接选第一个营业的
    const fallback = openPool[0];
    return {
      name: fallback.name,
      description: fallback.review_summary,
      task: "到达后打个卡吧",
      reward: rewardHint(fallback.category),
      emoji: "📍",
      distanceText: walkingTimeText(distanceMeters(ORIGIN, { lat: fallback.lat, lng: fallback.lng })),
      lat: fallback.lat, lng: fallback.lng, category: fallback.category,
    };
  }
}

export async function generateRoute(
  prefs: UserPreferences,
  profile: UserProfile | null = null,
  history: TripRecord[] = [],
  weatherCode?: string,
  weatherTemp?: number,
): Promise<GeneratedRoute> {
  const candidates = filterCandidates(prefs, new Date(), undefined, history, weatherCode, weatherTemp);
  if (candidates.length === 0) throw new Error("没有可用的 POI 候选");

  const targetCount = DURATION_TO_WAYPOINTS[prefs.duration] ?? 2;
  const actualCount = Math.min(targetCount, candidates.length);
  const selectionCount = actualCount;
  const byId = new Map(candidates.map((p) => [p.id, p]));

  const ctx: GenerateContext = { candidates, byId, prefs, profile, history, selectionCount };

  const visitedNames = extractVisitedNames(history);
  const now = new Date();
  const candidateIds = new Set(candidates.map(p => p.id));
  const allPois: POI[] = (await import("../data/pois.json")).default as POI[];
  const allScored = allPois
    .map(p => {
      const b = scorePOIDetailed(p, prefs, visitedNames, weatherCode, weatherTemp);
      return {
        "✓": candidateIds.has(p.id) ? "✓" : "",
        open: isOpenAt(p.open_hours, now) ? "✓" : "✗",
        id: p.id, name: p.name, category: p.category,
        total: +b.total.toFixed(2),
        base: +b.base.toFixed(2),
        tag: +b.tagAffinity.toFixed(2),
        mood: +b.mood.toFixed(2),
        wthr: +b.weather.toFixed(2),
        time: +b.time.toFixed(2),
        wait: +b.wait.toFixed(2),
        stay: +b.stay.toFixed(2),
        novelty: +b.novelty.toFixed(2),
        price: +b.price.toFixed(2),
        crowd: +b.crowd.toFixed(2),
        food: +b.food.toFixed(2),
        dist: +b.distance.toFixed(2),
      };
    })
    .sort((a, b) => b.total - a.total);
  console.log(`📋 POI 全局评分排名 (top 20, ✓=入选, open=当前营业):`);
  console.table(allScored.slice(0, 20));

  const candidateScored = candidates.map(p => {
    const b = scorePOIDetailed(p, prefs, visitedNames, weatherCode, weatherTemp);
    return {
      id: p.id, name: p.name, category: p.category,
      total: +b.total.toFixed(2),
      tag: +b.tagAffinity.toFixed(2),
      mood: +b.mood.toFixed(2),
      wthr: +b.weather.toFixed(2),
      time: +b.time.toFixed(2),
    };
  });
  console.log(`📋 实际候选（${candidates.length} 个，发给 Gemini）:`);
  console.table(candidateScored);

  // ── ReAct 循环：生成 → 审查 → 修正（最多 1 轮）──
  const prompt1 = buildPrompt(ctx);
  console.groupCollapsed("📤 routeAgent prompt (第1轮)");
  console.log(prompt1);
  console.groupEnd();

  const text1 = await generateContent("gemini-2.5-flash-lite", prompt1);
  console.groupCollapsed("📥 Gemini 原始返回 (第1轮)");
  console.log(text1);
  console.groupEnd();

  let route = parseAndHydrate(text1, ctx);
  console.log("🗺️ 解析结果:", {
    title: route.title,
    waypoints: route.waypoints.map(w => `${w.emoji} ${w.name} → ${w.reward}`),
  });

  const categories = resolveCategories(route);
  let review: ReviewResult = { passed: true, issues: [], action: "pass" };
  try {
    review = await reviewRoute(route, categories, prefs);
  } catch (e) {
    console.warn("路线审查出错，跳过：", e);
  }

  if (review.action === "reorder" && review.reorder && review.reorder.length > 0) {
    console.log("🔀 ReAct: 应用审查建议的站点顺序", review.reorder);
    const nameMap = new Map(route.waypoints.map(w => [w.name, w]));

    const reordered: Waypoint[] = [];
    for (const name of review.reorder) {
      const wp = nameMap.get(name);
      if (wp) reordered.push(wp);
    }

    if (reordered.length === route.waypoints.length) {
      route.waypoints = reordered;
      console.log("✅ ReAct: 站点顺序已调整:", route.waypoints.map(w => w.name));
    } else {
      console.warn("⚠️ reorder 名字不完全匹配，跳过调整");
    }
  } else if (review.action === "reselect") {
    console.log("🔄 ReAct: 选点不合理，重新生成…", review.issues.map((i) => i.description));
    const revisionNote = review.issues.map((i) => `- ${i.description}`).join("\n");
    const prompt2 = buildPrompt(ctx, revisionNote);
    console.groupCollapsed("📤 routeAgent prompt (重选轮)");
    console.log(prompt2);
    console.groupEnd();
    try {
      const text2 = await generateContent("gemini-2.5-flash-lite", prompt2);
      console.groupCollapsed("📥 Gemini 原始返回 (重选轮)");
      console.log(text2);
      console.groupEnd();
      route = parseAndHydrate(text2, ctx);
      console.log("🗺️ 重选后解析结果:", {
        title: route.title,
        waypoints: route.waypoints.map(w => `${w.emoji} ${w.name} → ${w.reward}`),
      });

      // 重选后再审查一轮（只做 reorder，不再触发第三次重选）
      try {
        const cats2 = resolveCategories(route);
        const review2 = await reviewRoute(route, cats2, prefs);
        if (review2.action === "reorder" && review2.reorder && review2.reorder.length === route.waypoints.length) {
          const nameMap2 = new Map(route.waypoints.map(w => [w.name, w]));
          const reordered2: Waypoint[] = [];
          for (const name of review2.reorder) {
            const wp = nameMap2.get(name);
            if (wp) reordered2.push(wp);
          }
          if (reordered2.length === route.waypoints.length) {
            route.waypoints = reordered2;
            console.log("🔀 ReAct 2nd: 重选后调序:", route.waypoints.map(w => w.name));
          }
        } else if (review2.action === "pass") {
          console.log("✅ 重选后审查通过");
        } else {
          console.warn("⚠️ 重选后仍不合理，使用当前结果");
        }
      } catch (e) {
        console.warn("重选后审查出错，跳过：", e);
      }
    } catch (e) {
      console.warn("重选调用失败，使用原始路线：", e);
    }
  } else {
    console.log("✅ 路线审查通过");
  }

  // ── 确定性营业时间校验 + LLM 换补 ──
  const closedStops = checkOpenHours(route.waypoints);
  console.groupCollapsed("🚪 营业时间校验（确定性预检）");
  console.table(route.waypoints.map((w, i) => {
    const cs = closedStops.find(c => c.index === i);
    const poi = findPOIByName(w.name);
    return {
      站点: `第${i + 1}站 ${w.name}`,
      营业时间: poi?.open_hours ?? "未知",
      预计到达: cs?.arrivalTime ?? "—",
      状态: cs ? "❌ 已打烊" : "✅ 营业中",
    };
  }));
  console.groupEnd();
  if (closedStops.length > 0) {
    console.log(`🚪 ${closedStops.length} 个站点到达时已打烊，启动 LLM 换补…`);
    const usedNames = new Set(route.waypoints.map(w => w.name));
    for (const cs of closedStops) {
      const openPool = candidates.filter(p => !usedNames.has(p.name));
      const replacement = await swapClosedStop(cs, openPool, route.waypoints[cs.index]);
      if (replacement) {
        console.log(`🔄 换补成功: ${cs.name}(${cs.openHours}, ${cs.arrivalTime}到) → ${replacement.name}`);
        usedNames.delete(route.waypoints[cs.index].name);
        usedNames.add(replacement.name);
        route.waypoints[cs.index] = replacement;
      } else {
        console.warn(`⚠️ 换补失败: ${cs.name}，候选池无该时段营业的替补，保留原站`);
      }
    }
  } else {
    console.log("✅ 所有站点在预计到达时均在营业");
  }

  // 审查完成后，取排序后的最后一站作为隐藏任务（reviewer 决定的尾站）
  if (route.waypoints.length > 1) {
    route.hiddenTask = route.waypoints.pop()!;
    console.log("🎯 隐藏任务:", route.hiddenTask.name, "| 主路线:", route.waypoints.map(w => w.name));
  } else if (route.waypoints.length === 1) {
    const usedNames = new Set(route.waypoints.map(w => w.name));
    const leftover = candidates.find(p => !usedNames.has(p.name));
    if (leftover) {
      route.hiddenTask = {
        name: leftover.name, description: leftover.review_summary,
        task: "找到这个隐藏坐标，完成一次特别打卡", reward: "¥50隐藏限定优惠券", emoji: "✨",
        distanceText: walkingTimeText(distanceMeters(ORIGIN, { lat: leftover.lat, lng: leftover.lng })),
        lat: leftover.lat, lng: leftover.lng,
      };
      console.log("🎯 隐藏任务(兜底):", route.hiddenTask.name);
    }
  }

  return route;
}
