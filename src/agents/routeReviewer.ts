import { generateContent } from "../lib/gemini";
import { distanceMeters, ORIGIN, findPOIByName, isOpenAt } from "./poiFilter";
import type { GeneratedRoute, UserPreferences, Waypoint } from "../types";

const DURATION_MINUTES: Record<string, number> = {
  "1h": 60, "2h": 120, half_day: 240, full_day: 480,
};
const WALK_SPEED_M_PER_MIN = 80;

export interface ReviewIssue {
  type: "ai_review";
  description: string;
}

export interface ReviewResult {
  passed: boolean;
  issues: ReviewIssue[];
  action: "pass" | "reorder" | "reselect";
  reorder?: string[];
}

function bearingDir(from: { lat: number; lng: number }, to: { lat: number; lng: number }): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
  const x = Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const dirs = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
  return dirs[Math.round(deg / 45) % 8];
}

function buildRouteGeo(waypoints: Waypoint[]): string {
  const lines: string[] = [];
  let prev = ORIGIN;
  for (let i = 0; i < waypoints.length; i++) {
    const cur = { lat: waypoints[i].lat!, lng: waypoints[i].lng! };
    if (!cur.lat || !cur.lng) continue;
    const d = Math.round(distanceMeters(prev, cur));
    const dir = bearingDir(prev, cur);
    const fromLabel = i === 0 ? "起点" : `第${i}站`;
    lines.push(`  ${fromLabel} → 第${i + 1}站(${waypoints[i].name}): ${d}m 向${dir}`);
    prev = cur;
  }
  return lines.join("\n");
}

function buildDistMatrix(waypoints: Waypoint[]): string {
  const allPoints = [
    { lat: ORIGIN.lat, lng: ORIGIN.lng, name: "出发点" },
    ...waypoints.map((w, i) => ({ lat: w.lat!, lng: w.lng!, name: `第${i + 1}站` })),
  ];

  const lines: string[] = [];
  for (let i = 0; i < allPoints.length; i++) {
    const cells = allPoints.map((q, j) => {
      if (j === i) return "      -";
      const a = allPoints[i];
      const b = q;
      if (!a.lat || !b.lat) return "      ?";
      const d = Math.round(distanceMeters(a, b));
      const dir = bearingDir(a, b);
      return `${d}m${dir}`.padStart(7);
    });
    lines.push(`  ${allPoints[i].name}: ${cells.join(" ")}`);
  }
  return lines.join("\n");
}

function computeTotalWalkM(stops: Waypoint[]): number {
  let total = 0;
  let prev = { lat: ORIGIN.lat, lng: ORIGIN.lng };
  for (const s of stops) {
    if (!s.lat || !s.lng) continue;
    total += distanceMeters(prev, { lat: s.lat, lng: s.lng });
    prev = { lat: s.lat, lng: s.lng };
  }
  return Math.round(total);
}

function greedyNearestNeighbor(stops: Waypoint[]): Waypoint[] {
  const remaining = stops.filter((s) => s.lat && s.lng);
  const result: Waypoint[] = [];
  let cur = { lat: ORIGIN.lat, lng: ORIGIN.lng };
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = distanceMeters(cur, { lat: remaining[i].lat!, lng: remaining[i].lng! });
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const picked = remaining.splice(bestIdx, 1)[0];
    result.push(picked);
    cur = { lat: picked.lat!, lng: picked.lng! };
  }
  return result;
}

function estimateTimeMin(waypoints: Waypoint[]): { walkMin: number; stayMin: number; totalMin: number; perStop: { name: string; walkMin: number; stayMin: number }[] } {
  let prev = { lat: ORIGIN.lat, lng: ORIGIN.lng };
  let walkTotal = 0;
  let stayTotal = 0;
  const perStop: { name: string; walkMin: number; stayMin: number }[] = [];
  for (const w of waypoints) {
    const d = distanceMeters(prev, { lat: w.lat, lng: w.lng });
    const wMin = Math.round(d / WALK_SPEED_M_PER_MIN);
    const poi = findPOIByName(w.name);
    const sMin = poi?.avg_stay_minutes ?? 20;
    walkTotal += wMin;
    stayTotal += sMin;
    perStop.push({ name: w.name, walkMin: wMin, stayMin: sMin });
    prev = { lat: w.lat, lng: w.lng };
  }
  return { walkMin: walkTotal, stayMin: stayTotal, totalMin: walkTotal + stayTotal, perStop };
}

export interface ClosedStop {
  index: number;
  name: string;
  openHours: string;
  arrivalTime: string;
}

export function checkOpenHours(waypoints: Waypoint[]): ClosedStop[] {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const timeEst = estimateTimeMin(waypoints);
  let acc = nowMin;
  const closed: ClosedStop[] = [];
  for (let i = 0; i < waypoints.length; i++) {
    acc += timeEst.perStop[i].walkMin;
    const arrDate = new Date(now);
    arrDate.setHours(0, acc, 0, 0);
    const poi = findPOIByName(waypoints[i].name);
    if (poi && !isOpenAt(poi.open_hours, arrDate)) {
      const arrH = Math.floor(acc / 60) % 24;
      const arrM = acc % 60;
      closed.push({ index: i, name: waypoints[i].name, openHours: poi.open_hours, arrivalTime: `${arrH}:${String(arrM).padStart(2, "0")}` });
    }
    acc += timeEst.perStop[i].stayMin;
  }
  return closed;
}

export async function reviewRoute(
  route: GeneratedRoute,
  waypointCategories: string[],
  prefs: UserPreferences
): Promise<ReviewResult> {
  // ── 确定性时间预检：超出预算 50% 直接打回重选，不浪费 AI 调用 ──
  const budgetMin = DURATION_MINUTES[prefs.duration] ?? 60;
  const timeEst = estimateTimeMin(route.waypoints);
  if (timeEst.totalMin > budgetMin * 1.5) {
    const desc = `路线预计耗时 ${timeEst.totalMin} 分钟（步行 ${timeEst.walkMin}min + 停留 ${timeEst.stayMin}min），远超用户预算 ${budgetMin} 分钟`;
    console.log(`⏱️ 时间预检不通过: ${desc}`);
    return { passed: false, issues: [{ type: "ai_review", description: desc }], action: "reselect" };
  }

  const now = new Date();
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const catByName = new Map<string, string>();
  route.waypoints.forEach((w, i) => catByName.set(w.name, waypointCategories[i] ?? "未知"));

  let arrivalAcc = nowMin;
  const stopsDesc = route.waypoints
    .map((w, i) => {
      const cat = catByName.get(w.name) ?? "未知";
      const poi = findPOIByName(w.name);
      const stay = poi?.avg_stay_minutes ?? 20;
      arrivalAcc += timeEst.perStop[i].walkMin;
      const arrH = Math.floor(arrivalAcc / 60) % 24;
      const arrM = arrivalAcc % 60;
      const arrStr = `${arrH}:${String(arrM).padStart(2, "0")}`;
      const openH = poi?.open_hours ?? "未知";
      const line = `第${i + 1}站: ${w.name}（${cat}）营业:${openH} | 预计到达:${arrStr} | 停留:${stay}min`;
      arrivalAcc += stay;
      return line;
    })
    .join("\n");

  const timeDesc = timeEst.perStop.map((s, i) => `  第${i + 1}站 ${s.name}: 步行${s.walkMin}min + 停留${s.stayMin}min`).join("\n");

  const routeGeo = buildRouteGeo(route.waypoints);
  const distMatrix = buildDistMatrix(route.waypoints);

  const greedyOrder = greedyNearestNeighbor(route.waypoints);
  const greedyDesc = greedyOrder.map((w) => `"${w.name}"`).join(", ");
  const greedyDist = computeTotalWalkM(greedyOrder);
  const currentDist = computeTotalWalkM(route.waypoints);

  const stopNames = route.waypoints.map((w) => `"${w.name}"`);

  const prompt = `
你是路线体验顾问。审查以下五道口散步路线，如果站点顺序不合理请给出调整后的顺序。

出发点：五道口地铁站 (${ORIGIN.lat},${ORIGIN.lng})

当前站点顺序：
${stopsDesc}

行进方向：
${routeGeo}

各站间距离和方位：
${distMatrix}

当前总步行距离：${currentDist}m
就近原则参考顺序（贪心最近邻）：[${greedyDesc}]，总步行距离：${greedyDist}m

时间预算：${budgetMin} 分钟
预计耗时：${timeEst.totalMin} 分钟（步行 ${timeEst.walkMin}min + 停留 ${timeEst.stayMin}min）
各站耗时明细：
${timeDesc}

当前时间：${timeStr}

审查维度（按优先级从高到低）：
1. **时间可行性（最高优先）**：预计总耗时不能超过用户时间预算。如果超出预算 20% 以上，应减少站点数量 → 需要重选。
2. **就近原则**：路线必须尽量短，不走回头路。从出发点开始，每一站应该去离当前位置最近的下一个目标，形成单向展开的路径。绝对禁止来回折返。如果当前顺序总距离比参考顺序多出 30% 以上，必须调序。
3. **饭点安排**：根据当前时间和游玩时长估算路线覆盖的时段。如果路线经过午餐(11:00-13:00)或晚餐(17:00-19:00)时段，路线中应有至少一个**正餐**类地点（餐厅/火锅/东北菜/日韩料理/小吃/美食城/夜宵烧烤等能吃饱的地方）。咖啡厅、奶茶甜品、面包蛋糕、宠物咖啡不算正餐。全程无正餐但跨饭点 → 需要重选。
4. 品类多样性：连续两站同类型不合理 → 在不违反就近原则的前提下调整
5. 活动节奏：吃完大餐后不该紧接剧烈运动 → 在不违反就近原则的前提下调整
6. 时间合理性：当前时间不适合某地点（上午去酒吧、深夜去美术馆）→ 该地点选错了，需要重选
7. 综合常识：全程都在吃、选了明显不适合的地点 → 需要重选

判断逻辑：
- 路线合理 → action="pass"
- 顺序不合理 → action="reorder"，给出调整后的完整顺序
- 选点本身不合理 → action="reselect"

只返回 JSON，不要其他文字：

路线合理：
{ "passed": true, "action": "pass", "issues": [] }

顺序不合理，调整后可修复：
{ "passed": false, "action": "reorder", "issues": ["问题描述"], "reorder": [${stopNames.join(", ")}] }
reorder 包含所有站点名，只改变顺序。

选点不合理，需要重选：
{ "passed": false, "action": "reselect", "issues": ["问题描述"] }
`;

  console.groupCollapsed("📤 routeReviewer prompt");
  console.log(prompt);
  console.groupEnd();

  try {
    const text = await generateContent("gemini-2.5-flash-lite", prompt);
    console.groupCollapsed("📥 routeReviewer Gemini 返回");
    console.log(text);
    console.groupEnd();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { passed: true, issues: [], action: "pass" };

    const parsed = JSON.parse(jsonMatch[0]);
    const issues: ReviewIssue[] = (parsed.issues ?? []).map((desc: string) => ({
      type: "ai_review" as const,
      description: desc,
    }));

    const reorder: string[] | undefined = Array.isArray(parsed.reorder) && parsed.reorder.length === route.waypoints.length
      ? parsed.reorder
      : undefined;

    let action: ReviewResult["action"] = "pass";
    if (parsed.action === "reorder" && reorder) {
      action = "reorder";
    } else if (parsed.action === "reselect" || (issues.length > 0 && !reorder)) {
      action = "reselect";
    } else if (issues.length === 0) {
      action = "pass";
    }

    const result: ReviewResult = {
      passed: action === "pass",
      issues,
      action,
      reorder,
    };
    const actionLabel = { pass: "✅ 通过", reorder: "🔀 调序", reselect: "🔄 重选" }[action];
    console.log(
      `🔍 审查结果: ${actionLabel}`,
      issues.map(i => i.description),
    );
    if (reorder) console.log("🔀 建议顺序:", reorder);
    return result;
  } catch (e) {
    console.error("AI 审查失败，跳过：", e);
    return { passed: true, issues: [], action: "pass" };
  }
}
