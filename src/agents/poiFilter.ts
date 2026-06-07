import poisRaw from "../data/pois.json";
import type { POI, UserPreferences, TripRecord } from "../types";

const pois = poisRaw as POI[];

export const ORIGIN = { lat: 39.992, lng: 116.337 };

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

export function walkingTimeText(meters: number): string {
  const minutes = Math.max(1, Math.round(meters / 80));
  return `步行约${minutes}分钟`;
}

export function isOpenAt(openHours: string, now: Date): boolean {
  const match = openHours.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!match) return true;
  const [, sh, sm, eh, em] = match;
  const start = Number(sh) * 60 + Number(sm);
  const end = Number(eh) * 60 + Number(em);
  const cur = now.getHours() * 60 + now.getMinutes();
  if (end >= start) return cur >= start && cur <= end;
  return cur >= start || cur <= end;
}

const DURATION_MIN: Record<string, number> = {
  "1h": 60, "2h": 120, half_day: 240, full_day: 480,
};

export function isOpenDuring(openHours: string, from: Date, durationKey: string): boolean {
  const match = openHours.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!match) return true;
  const [, sh, sm, eh, em] = match;
  const shopOpen = Number(sh) * 60 + Number(sm);
  const shopClose = Number(eh) * 60 + Number(em);

  const routeStart = from.getHours() * 60 + from.getMinutes();
  const routeEnd = routeStart + (DURATION_MIN[durationKey] ?? 60);

  if (shopClose >= shopOpen) {
    return routeEnd > shopOpen && routeStart < shopClose;
  }
  // overnight shop (e.g. 18:00-02:00): open = [shopOpen,1440) ∪ [0,shopClose)
  return routeStart < shopClose || routeEnd > shopOpen;
}

export type ActivityType = "eating" | "drinking" | "browsing" | "sitting" | "outdoor" | "service" | "entertainment";

export function getActivityType(category: string): ActivityType {
  if (/餐厅|烧烤|素食|轻食|美食城|美食街|小吃/.test(category)) return "eating";
  if (/咖啡|奶茶|甜品|宠物友好咖啡/.test(category)) return "drinking";
  if (/酒吧|livehouse|夜店/.test(category)) return "drinking";
  if (/书店|美术馆|文创|花店/.test(category)) return "browsing";
  if (/公园|绿地|景点|地标/.test(category)) return "outdoor";
  if (/健身|瑜伽|运动|溜冰/.test(category)) return "outdoor";
  if (/电影院|KTV|台球|棋牌|桌游|密室|电竞|网咖/.test(category)) return "entertainment";
  return "sitting";
}

export function getBaseCategory(category: string): string {
  const m = category.match(/^(餐厅|酒吧)/);
  return m ? m[1] : category;
}

// ── 标签亲和矩阵（CLIP-like soft similarity）──
// 用户偏好标签 → POI 标签之间的亲和度，直接匹配 = 1.0，语义相近给部分分
const TAG_AFFINITY: Record<string, Record<string, number>> = {
  art:     { art: 1.0, photo: 0.5, niche: 0.4 },
  photo:   { photo: 1.0, art: 0.5, niche: 0.3, outdoor: 0.3 },
  niche:   { niche: 1.0, art: 0.4, photo: 0.3, budget: 0.2 },
  outdoor: { outdoor: 1.0, photo: 0.3 },
  food:    { food: 1.0, busy: 0.2 },
  busy:    { busy: 1.0, food: 0.2 },
  budget:  { budget: 1.0, niche: 0.2 },
};

function tagAffinityScore(userTags: string[], poiTags: string[]): number {
  if (userTags.length === 0) return 0;
  let total = 0;
  for (const ut of userTags) {
    const row = TAG_AFFINITY[ut];
    if (!row) continue;
    let best = 0;
    for (const pt of poiTags) {
      best = Math.max(best, row[pt] ?? 0);
    }
    total += best;
  }
  return total;
}

export function findPOIByName(name: string): POI | undefined {
  return pois.find((p) => p.name === name);
}

export function extractVisitedNames(history: TripRecord[]): Set<string> {
  const names = new Set<string>();
  for (const trip of history) {
    for (const wp of trip.waypoints) {
      if (wp.visited) names.add(wp.name);
    }
  }
  return names;
}

const MAX_PER_CATEGORY = 2;
const MAX_CANDIDATES = 15;
const MAX_EATING = 4;
const MAX_DRINKING = 3;
const EATING_CATEGORIES = new Set(["餐厅", "酒吧"]);

const COMPANION_CROWD: Record<string, number> = {
  couple: -0.7, solo: -0.3, family: 0, friends: 0.7,
};

const DURATION_MINUTES: Record<string, number> = {
  "1h": 60, "2h": 120, half_day: 240, full_day: 480,
};

export interface ScoreBreakdown {
  total: number;
  base: number;
  tagAffinity: number;
  mood: number;
  weather: number;
  time: number;
  wait: number;
  stay: number;
  novelty: number;
  price: number;
  crowd: number;
  food: number;
  distance: number;
}

type WeatherBias = "rain" | "snow" | "hot" | "cold" | "nice" | "none";

function classifyWeather(code?: string, temp?: number): WeatherBias {
  if (!code) return "none";
  const c = parseInt(code);
  if ([200, 386, 389, 392, 296, 299, 302, 305, 308, 311, 314, 350, 356, 359, 176, 263, 266, 281, 284, 293, 353, 182, 374, 377].includes(c)) return "rain";
  if ([179, 227, 230, 317, 320, 323, 326, 329, 332, 335, 338, 362, 365, 368, 371, 395].includes(c)) return "snow";
  if (temp !== undefined && temp >= 35) return "hot";
  if (temp !== undefined && temp <= 0) return "cold";
  return "nice";
}

const WEATHER_INDOOR: Record<WeatherBias, number> = {
  rain: 0.3, snow: 0.35, hot: 0.2, cold: 0.25, nice: 0, none: 0,
};
const WEATHER_OUTDOOR: Record<WeatherBias, number> = {
  rain: -0.4, snow: -0.5, hot: -0.3, cold: -0.3, nice: 0.15, none: 0,
};

export function scorePOI(
  poi: POI,
  prefs: UserPreferences,
  visitedNames: Set<string> = new Set(),
  weatherCode?: string,
  weatherTemp?: number,
): number {
  return scorePOIDetailed(poi, prefs, visitedNames, weatherCode, weatherTemp).total;
}

function timeScoreAtHour(activity: ActivityType, hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 20 || h < 4) {
    if (activity === "drinking") return 0.3;
    if (activity === "entertainment") return 0.2;
    if (activity === "eating") return 0.1;
    if (activity === "outdoor") return -0.3;
    if (activity === "browsing") return -0.15;
    return 0;
  }
  if (h >= 5 && h < 9) {
    if (activity === "outdoor") return 0.2;
    if (activity === "drinking") return -0.3;
    if (activity === "entertainment") return -0.2;
    return 0;
  }
  if (h >= 11 && h < 14) {
    if (activity === "eating") return 0.2;
    return 0;
  }
  if (h >= 14 && h < 18) {
    if (activity === "browsing") return 0.1;
    if (activity === "outdoor") return 0.1;
    return 0;
  }
  return 0;
}

function timeScore(activity: ActivityType, startHour: number, durationMin: number): number {
  const hours = Math.max(1, Math.ceil(durationMin / 60));
  let sum = 0;
  for (let i = 0; i < hours; i++) {
    sum += timeScoreAtHour(activity, startHour + i);
  }
  return sum / hours;
}

export function scorePOIDetailed(
  poi: POI,
  prefs: UserPreferences,
  visitedNames: Set<string> = new Set(),
  weatherCode?: string,
  weatherTemp?: number,
  now: Date = new Date(),
): ScoreBreakdown {
  const base = (poi.rating - 3.0) / 2.0; // 3.0→0, 4.0→0.5, 4.8→0.9, 5.0→1.0
  const tagAffinity = tagAffinityScore(prefs.special, poi.tags) * 0.4;
  const mood = poi.mood_match.includes(prefs.mood) ? 0.15 : 0;

  const bias = classifyWeather(weatherCode, weatherTemp);
  const activity = getActivityType(poi.category);
  const isOutdoor = activity === "outdoor";
  const weather = isOutdoor ? WEATHER_OUTDOOR[bias] : WEATHER_INDOOR[bias];
  const totalMin = DURATION_MINUTES[prefs.duration] ?? 60;
  const time = timeScore(activity, now.getHours(), totalMin);
  const wait = -(poi.avg_wait_minutes / totalMin) * 2.0;

  const stayRatio = poi.avg_stay_minutes / totalMin;
  const stay = stayRatio > 0.5 ? -(stayRatio - 0.5) * 3.0 : 0;

  const noveltyMode = prefs.intensity === "don't_think";
  let novelty = 0;
  if (visitedNames.size > 0) {
    if (visitedNames.has(poi.name)) {
      novelty = noveltyMode ? -0.8 : -0.4;
    } else {
      novelty = noveltyMode ? 0.5 : 0.2;
    }
  } else if (noveltyMode) {
    novelty = 0.15;
  }

  const budgetIntent = prefs.special.includes("budget") ? 1 : 0;
  const price = (2 - poi.price_level) * 0.15 * (1 + budgetIntent);

  const crowdVal = poi.crowd_level === "high" ? 1 : poi.crowd_level === "medium" ? 0 : -1;
  const crowdPref = COMPANION_CROWD[prefs.companion] ?? 0;
  const crowd = crowdVal * crowdPref * 0.3;

  let food = 0;
  if (prefs.foodPreference?.length > 0 && getActivityType(poi.category) === "eating") {
    if (prefs.foodPreference.includes("light") && /素食|轻食|沙拉/.test(poi.category + poi.name)) food += 0.4;
    if (prefs.foodPreference.includes("spicy") && /火锅|烧烤|川|湘|麻辣/.test(poi.category + poi.name)) food += 0.4;
    if (prefs.foodPreference.includes("coffee") && /咖啡|甜品|奶茶/.test(poi.category)) food += 0.4;
  }

  const km = distanceMeters(ORIGIN, { lat: poi.lat, lng: poi.lng }) / 1000;
  const distPenaltyPerKm = 1.5 / (totalMin / 30);
  const distance = -(km * distPenaltyPerKm);

  const total = base + tagAffinity + mood + weather + time + wait + stay + novelty + price + crowd + food + distance;
  return { total, base, tagAffinity, mood, weather, time, wait, stay, novelty, price, crowd, food, distance };
}

/**
 * 唯一硬约束：必须营业。其他全部软化为评分因子。
 * 品类 cap（每类最多 MAX_PER_CATEGORY 个）+ 总量 cap（MAX_CANDIDATES 个）。
 */
export function filterCandidates(
  prefs: UserPreferences,
  now: Date = new Date(),
  pool: POI[] = pois,
  history: TripRecord[] = [],
  weatherCode?: string,
  weatherTemp?: number,
): POI[] {
  const visitedNames = extractVisitedNames(history);

  // 唯一硬约束：路线时间窗内有交集即可（夜宵 18:00 开、16:00 出发全天游也入选）
  let open = pool.filter((p) => isOpenDuring(p.open_hours, now, prefs.duration));
  if (open.length === 0) open = pool;

  const sorted = open
    .map((p) => ({ poi: p, score: scorePOI(p, prefs, visitedNames, weatherCode, weatherTemp) }))
    .sort((a, b) => b.score - a.score);

  const isLong = prefs.duration === "full_day" || prefs.duration === "half_day";
  const catCount = new Map<string, number>();
  let eatCount = 0;
  let drinkCount = 0;
  const capped: POI[] = [];
  for (const { poi } of sorted) {
    const base = getBaseCategory(poi.category);
    const activity = getActivityType(poi.category);

    if (activity === "eating" && eatCount >= MAX_EATING) continue;
    if (activity === "drinking" && drinkCount >= MAX_DRINKING) continue;
    // 单品类上限（餐厅/酒吧在长线路放宽到 3）
    const cap = isLong && EATING_CATEGORIES.has(base) ? 3 : MAX_PER_CATEGORY;
    const count = catCount.get(base) ?? 0;
    if (count >= cap) continue;

    catCount.set(base, count + 1);
    if (activity === "eating") eatCount++;
    if (activity === "drinking") drinkCount++;
    capped.push(poi);
    if (capped.length >= MAX_CANDIDATES) break;
  }
  return capped;
}
