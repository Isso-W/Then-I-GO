import poisRaw from "../data/pois.json";
import type { POI, UserPreferences } from "../types";

const pois = poisRaw as POI[];

// 五道口地铁站坐标，作为所有距离计算的原点
export const ORIGIN = { lat: 39.992, lng: 116.337 };

// Haversine 公式算两点间地表距离（米）
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 步行约 80m/min，把米换成"步行约 N 分钟"
export function walkingTimeText(meters: number): string {
  const minutes = Math.max(1, Math.round(meters / 80));
  return `步行约${minutes}分钟`;
}

// "08:00-20:00" / "18:00-02:00" → 判断 now 是否在区间内（支持跨午夜）
export function isOpenAt(openHours: string, now: Date): boolean {
  const match = openHours.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!match) return true; // 解析不了就当一直开
  const [, sh, sm, eh, em] = match;
  const start = Number(sh) * 60 + Number(sm);
  const end = Number(eh) * 60 + Number(em);
  const cur = now.getHours() * 60 + now.getMinutes();
  if (end >= start) return cur >= start && cur <= end;
  // 跨午夜：开 18:00-02:00 意味着 cur ≥ 18:00 或 cur ≤ 02:00
  return cur >= start || cur <= end;
}

const WAIT_THRESHOLD_MIN = 15;
const MAX_CANDIDATES = 10;
const MIN_ACCEPTABLE = 5;

// 评分：rating + 心情匹配加成 - 距离惩罚（每公里 -0.1）
export function scorePOI(poi: POI, prefs: UserPreferences): number {
  let score = poi.rating;
  if (poi.mood_match.includes(prefs.mood)) score += 0.5;
  const km = distanceMeters(ORIGIN, { lat: poi.lat, lng: poi.lng }) / 1000;
  score -= km * 0.1;
  return score;
}

type FilterStage = "strict" | "no_wait" | "no_tags" | "all";

function applyFilters(
  prefs: UserPreferences,
  now: Date,
  stage: FilterStage,
  pool: POI[]
): POI[] {
  return pool.filter((poi) => {
    if (stage !== "all" && !isOpenAt(poi.open_hours, now)) return false;
    if (stage === "strict" && poi.avg_wait_minutes > WAIT_THRESHOLD_MIN) return false;
    if ((stage === "strict" || stage === "no_wait") && prefs.special.length > 0) {
      const overlap = poi.tags.some((t) => prefs.special.includes(t));
      if (!overlap) return false;
    }
    return true;
  });
}

/**
 * 返回候选 POI 列表（已排序，最多 10 条）。
 * 候选不足 5 个时按 strict → no_wait → no_tags → all 逐步放宽。
 * 测试时可传入合成 pool 替代真实 pois.json。
 */
export function filterCandidates(
  prefs: UserPreferences,
  now: Date = new Date(),
  pool: POI[] = pois
): POI[] {
  const stages: FilterStage[] = ["strict", "no_wait", "no_tags", "all"];
  for (const stage of stages) {
    const matched = applyFilters(prefs, now, stage, pool);
    if (matched.length >= MIN_ACCEPTABLE || stage === "all") {
      return matched
        .map((p) => ({ poi: p, score: scorePOI(p, prefs) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_CANDIDATES)
        .map((x) => x.poi);
    }
  }
  return [];
}

/**
 * 从候选里挑若干"未探索"标记的坐标（排除已用作 waypoint / 隐藏任务的 POI）。
 * 纯函数、确定性：按候选既有顺序取前 n 个未排除的。地图上渲染成"?"。
 */
export function pickUnknownPOIs(
  candidates: POI[],
  excludeIds: Set<string>,
  n: number
): { lat: number; lng: number }[] {
  const out: { lat: number; lng: number }[] = [];
  for (const p of candidates) {
    if (excludeIds.has(p.id)) continue;
    out.push({ lat: p.lat, lng: p.lng });
    if (out.length >= n) break;
  }
  return out;
}
