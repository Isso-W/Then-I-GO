import type { GeneratedRoute, POI, UserPreferences } from "../types";

/**
 * 是否给这条路线加一个 A/B 分叉。
 * - 选了"别让我思考（全权安排）"的用户 → 不分叉，纯线性（尊重"别让我选"）
 * - 不足 2 站（如 30 分钟）→ 没有"第二站"可分叉
 */
export function wantsBranch(prefs: UserPreferences, stopCount: number): boolean {
  return prefs.intensity !== "don't_think" && stopCount >= 2;
}

/**
 * 把分叉的选中项写回 waypoints[1]，返回新 route（不可变更新）。
 * 没有 branch 或 index 越界时原样返回。选完即汇入既有线性主线。
 */
export function commitBranchChoice(route: GeneratedRoute, index: number): GeneratedRoute {
  if (!route.branch) return route;
  const option = route.branch.options[index];
  if (!option) return route;
  const waypoints = [...route.waypoints];
  waypoints[1] = option;
  return { ...route, waypoints };
}

/**
 * 兜底选两个气质相反的候选（Gemini 没给出合法 branch 时用）。
 * 优先 crowd_level low vs high，其次 category 不同，再不行就拿前两个。
 * 排除已用作 waypoint / 隐藏任务的 POI。候选不足 2 个 → null。
 */
export function pickContrastingPair(
  candidates: POI[],
  excludeIds: Set<string>
): [POI, POI] | null {
  const pool = candidates.filter((p) => !excludeIds.has(p.id));
  if (pool.length < 2) return null;

  const low = pool.find((p) => p.crowd_level === "low");
  const high = pool.find((p) => p.crowd_level === "high");
  if (low && high && low.id !== high.id) return [low, high];

  const first = pool[0];
  const diffCategory = pool.find((p) => p.id !== first.id && p.category !== first.category);
  if (diffCategory) return [first, diffCategory];

  return [pool[0], pool[1]];
}
