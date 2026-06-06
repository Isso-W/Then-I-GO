import { describe, it, expect } from "vitest";
import {
  filterCandidates,
  distanceMeters,
  walkingTimeText,
  isOpenAt,
  scorePOI,
  extractVisitedNames,
  ORIGIN,
} from "../src/agents/poiFilter";
import type { POI, UserPreferences, TripRecord } from "../src/types";

const makePOI = (overrides: Partial<POI> = {}): POI => ({
  id: "poi_test",
  name: "测试地点",
  category: "咖啡厅",
  tags: [],
  area: "五道口",
  address: "测试地址",
  lat: ORIGIN.lat,
  lng: ORIGIN.lng,
  open_hours: "00:00-23:59",
  avg_stay_minutes: 60,
  avg_wait_minutes: 0,
  crowd_level: "low",
  price_level: 2,
  rating: 4.0,
  review_summary: "简评",
  reviews: [],
  mood_match: [],
  mbti_tags: [],
  best_time: "anytime",
  ...overrides,
});

const makePrefs = (overrides: Partial<UserPreferences> = {}): UserPreferences => ({
  mood: "relax",
  duration: "1h",
  transport: "walk",
  special: [],
  foodPreference: [],
  intensity: "normal",
  companion: "solo",
  ...overrides,
});

const CATEGORIES = ["咖啡厅", "书店", "文创小店", "美术馆", "公园绿地", "餐厅-日韩料理", "餐厅-北京风味", "奶茶甜品", "livehouse", "花店", "景点/地标", "电影院", "夜店", "KTV", "台球/棋牌"];
const catOf = (i: number) => CATEGORIES[i % CATEGORIES.length];

const NOON = new Date("2026-05-25T12:00:00");

// ── distanceMeters ──

describe("distanceMeters", () => {
  it("同一点距离为 0", () => {
    expect(distanceMeters(ORIGIN, ORIGIN)).toBe(0);
  });

  it("对称：d(A,B) == d(B,A)", () => {
    const a = { lat: 39.99, lng: 116.33 };
    const b = { lat: 40.01, lng: 116.36 };
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
  });

  it("1 度纬度 ≈ 111 km", () => {
    const d = distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(111000);
    expect(d).toBeLessThan(111400);
  });

  it("正数距离", () => {
    const d = distanceMeters(ORIGIN, { lat: ORIGIN.lat + 0.01, lng: ORIGIN.lng + 0.01 });
    expect(d).toBeGreaterThan(0);
  });
});

// ── walkingTimeText ──

describe("walkingTimeText", () => {
  it("0 米也至少 1 分钟", () => {
    expect(walkingTimeText(0)).toMatch(/步行约1分钟/);
  });

  it("800 米约 10 分钟", () => {
    expect(walkingTimeText(800)).toBe("步行约10分钟");
  });

  it("总以'步行约'开头", () => {
    for (const m of [50, 500, 5000]) {
      expect(walkingTimeText(m)).toMatch(/^步行约/);
    }
  });
});

// ── isOpenAt ──

describe("isOpenAt", () => {
  it("正常区间内为 true", () => {
    expect(isOpenAt("08:00-20:00", new Date("2026-05-25T10:00:00"))).toBe(true);
  });

  it("正常区间外为 false", () => {
    expect(isOpenAt("08:00-20:00", new Date("2026-05-25T22:00:00"))).toBe(false);
  });

  it("起点时刻 inclusive", () => {
    expect(isOpenAt("10:00-20:00", new Date("2026-05-25T10:00:00"))).toBe(true);
  });

  it("终点时刻 inclusive", () => {
    expect(isOpenAt("08:00-12:00", NOON)).toBe(true);
  });

  it("跨午夜：18:00-02:00 在 20:00 营业", () => {
    expect(isOpenAt("18:00-02:00", new Date("2026-05-25T20:00:00"))).toBe(true);
  });

  it("跨午夜：18:00-02:00 在凌晨 01:00 营业", () => {
    expect(isOpenAt("18:00-02:00", new Date("2026-05-25T01:00:00"))).toBe(true);
  });

  it("跨午夜：18:00-02:00 在白天 10:00 关闭", () => {
    expect(isOpenAt("18:00-02:00", new Date("2026-05-25T10:00:00"))).toBe(false);
  });

  it("格式无法解析时降级为 true", () => {
    expect(isOpenAt("营业中", NOON)).toBe(true);
    expect(isOpenAt("", NOON)).toBe(true);
  });
});

// ── scorePOI ──

describe("scorePOI", () => {
  it("rating 越高分越高", () => {
    const prefs = makePrefs();
    const low = makePOI({ rating: 3.0 });
    const high = makePOI({ rating: 4.8 });
    expect(scorePOI(high, prefs)).toBeGreaterThan(scorePOI(low, prefs));
  });

  it("心情匹配加 0.15", () => {
    const prefs = makePrefs({ mood: "relax" });
    const noMatch = makePOI({ mood_match: [] });
    const match = makePOI({ mood_match: ["relax"] });
    expect(scorePOI(match, prefs) - scorePOI(noMatch, prefs)).toBeCloseTo(0.15, 5);
  });

  it("下雨天 outdoor 扣分、indoor 加分", () => {
    const prefs = makePrefs();
    const park = makePOI({ category: "公园绿地" });
    const cafe = makePOI({ category: "咖啡厅" });
    const rainCode = "302"; // 中雨
    // 无天气时 weather=0
    const parkDry = scorePOI(park, prefs);
    const parkRain = scorePOI(park, prefs, new Set(), rainCode);
    expect(parkRain).toBeLessThan(parkDry);
    // indoor 加分
    const cafeDry = scorePOI(cafe, prefs);
    const cafeRain = scorePOI(cafe, prefs, new Set(), rainCode);
    expect(cafeRain).toBeGreaterThan(cafeDry);
  });

  it("好天气 outdoor 微加分", () => {
    const prefs = makePrefs();
    const park = makePOI({ category: "公园绿地" });
    const sunny = "113";
    expect(scorePOI(park, prefs, new Set(), sunny)).toBeGreaterThan(scorePOI(park, prefs));
  });

  it("距离远的扣分", () => {
    const prefs = makePrefs();
    const near = makePOI({ lat: ORIGIN.lat, lng: ORIGIN.lng });
    const far = makePOI({ lat: ORIGIN.lat + 0.05, lng: ORIGIN.lng + 0.05 });
    expect(scorePOI(near, prefs)).toBeGreaterThan(scorePOI(far, prefs));
  });

  it("标签亲和度：直接匹配得满分，相关标签得部分分", () => {
    const prefs = makePrefs({ special: ["art"] });
    const direct = makePOI({ tags: ["art"] });        // art→art = 1.0
    const related = makePOI({ tags: ["photo"] });      // art→photo = 0.5
    const unrelated = makePOI({ tags: ["budget"] });   // art→budget = 0
    const dScore = scorePOI(direct, prefs);
    const rScore = scorePOI(related, prefs);
    const uScore = scorePOI(unrelated, prefs);
    expect(dScore).toBeGreaterThan(rScore);
    expect(rScore).toBeGreaterThan(uScore);
  });

  it("等待时间越长分越低（按占时长比例惩罚）", () => {
    const prefs = makePrefs({ duration: "1h" }); // 60min
    const noWait = makePOI({ avg_wait_minutes: 0 });
    const longWait = makePOI({ avg_wait_minutes: 30 }); // 30/60 = 50%
    expect(scorePOI(noWait, prefs)).toBeGreaterThan(scorePOI(longWait, prefs));
  });

  it("同样等 20min，短行程扣分比长行程重", () => {
    const short = makePrefs({ duration: "30min" }); // 20/30 = 67%
    const long = makePrefs({ duration: "half_day" }); // 20/240 = 8%
    const poi = makePOI({ avg_wait_minutes: 20 });
    const penaltyShort = scorePOI(makePOI(), short) - scorePOI(poi, short);
    const penaltyLong = scorePOI(makePOI(), long) - scorePOI(poi, long);
    expect(penaltyShort).toBeGreaterThan(penaltyLong * 3);
  });

  it("停留超出时长预算时软惩罚", () => {
    const prefs = makePrefs({ duration: "1h" }); // 60min, 阈值 30min
    const short = makePOI({ avg_stay_minutes: 20 });
    const over = makePOI({ avg_stay_minutes: 50 }); // stayRatio=83%, 超出 33%
    expect(scorePOI(short, prefs)).toBeGreaterThan(scorePOI(over, prefs));
  });

  it("停留不超过时长一半时不扣分", () => {
    const prefs = makePrefs({ duration: "2h" }); // 120min, 阈值 60min
    const a = makePOI({ avg_stay_minutes: 30 });
    const b = makePOI({ avg_stay_minutes: 60 });
    // 都在 50% 以内，停留惩罚 = 0，分数差只来自 stay 本身无差
    expect(scorePOI(a, prefs)).toBeCloseTo(scorePOI(b, prefs), 5);
  });

  it("去过的地方扣分，没去过的加分", () => {
    const prefs = makePrefs();
    const poi = makePOI({ name: "老地方" });
    const visited = new Set(["老地方"]);
    const fresh = new Set(["别的地方"]);
    const scoreVisited = scorePOI(poi, prefs, visited);
    const scoreFresh = scorePOI(poi, prefs, fresh);
    const scoreNoHistory = scorePOI(poi, prefs);
    expect(scoreFresh).toBeGreaterThan(scoreNoHistory);
    expect(scoreNoHistory).toBeGreaterThan(scoreVisited);
  });

  it("别让我思考模式下新鲜度加权更大", () => {
    const normal = makePrefs({ intensity: "normal" });
    const dontThink = makePrefs({ intensity: "don't_think" });
    const poi = makePOI({ name: "老地方" });
    const visited = new Set(["老地方"]);
    const fresh = new Set(["别的地方"]);
    // 去过的地方：don't_think 扣得更狠
    const penaltyNormal = scorePOI(poi, normal) - scorePOI(poi, normal, visited);
    const penaltyDT = scorePOI(poi, dontThink) - scorePOI(poi, dontThink, visited);
    expect(penaltyDT).toBeGreaterThan(penaltyNormal);
    // 没去过的地方：don't_think 加得更多
    const bonusNormal = scorePOI(poi, normal, fresh) - scorePOI(poi, normal);
    const bonusDT = scorePOI(poi, dontThink, fresh) - scorePOI(poi, dontThink);
    expect(bonusDT).toBeGreaterThan(bonusNormal);
  });

  it("别让我思考 + 无历史也有基础新鲜度加分", () => {
    const normal = makePrefs({ intensity: "normal" });
    const dontThink = makePrefs({ intensity: "don't_think" });
    const poi = makePOI();
    expect(scorePOI(poi, dontThink)).toBeGreaterThan(scorePOI(poi, normal));
  });

  it("情侣偏好安静场所，朋友偏好热闹场所", () => {
    const couple = makePrefs({ companion: "couple" });
    const friends = makePrefs({ companion: "friends" });
    const quiet = makePOI({ crowd_level: "low" });
    const loud = makePOI({ crowd_level: "high" });
    expect(scorePOI(quiet, couple)).toBeGreaterThan(scorePOI(loud, couple));
    expect(scorePOI(loud, friends)).toBeGreaterThan(scorePOI(quiet, friends));
  });

  it("budget 偏好下低价店得分更高", () => {
    const budget = makePrefs({ special: ["budget"] });
    const cheap = makePOI({ price_level: 1 });
    const pricey = makePOI({ price_level: 4 });
    expect(scorePOI(cheap, budget)).toBeGreaterThan(scorePOI(pricey, budget));
  });

  it("非 budget 偏好下价格影响较小", () => {
    const normal = makePrefs({ special: [] });
    const cheap = makePOI({ price_level: 1 });
    const pricey = makePOI({ price_level: 4 });
    const diff = scorePOI(cheap, normal) - scorePOI(pricey, normal);
    expect(diff).toBeGreaterThan(0);
    expect(diff).toBeLessThan(0.6);
  });
});

// ── extractVisitedNames ──

describe("extractVisitedNames", () => {
  it("提取去过的地点名", () => {
    const history: TripRecord[] = [{
      id: "t1", date: "2026-06-01",
      waypoints: [
        { name: "A", emoji: "☕", lat: 0, lng: 0, visited: true },
        { name: "B", emoji: "📚", lat: 0, lng: 0, visited: false },
        { name: "C", emoji: "🌳", lat: 0, lng: 0, visited: true },
      ],
      chatActions: [], distanceKm: 1, durationMin: 30,
      rewards: [], intensity: "normal", preferences: makePrefs(),
    }];
    const names = extractVisitedNames(history);
    expect(names.has("A")).toBe(true);
    expect(names.has("C")).toBe(true);
    expect(names.has("B")).toBe(false);
  });

  it("空历史返回空集合", () => {
    expect(extractVisitedNames([]).size).toBe(0);
  });
});

// ── filterCandidates ──

describe("filterCandidates", () => {
  it("只过滤未营业的 POI（唯一硬约束）", () => {
    const pool = [
      makePOI({ id: "open1", category: catOf(0), open_hours: "00:00-23:59" }),
      makePOI({ id: "open2", category: catOf(1), open_hours: "08:00-20:00" }),
      makePOI({ id: "closed", category: catOf(2), open_hours: "03:00-04:00" }),
    ];
    const result = filterCandidates(makePrefs(), NOON, pool);
    expect(result.some((p) => p.id === "closed")).toBe(false);
    expect(result.length).toBe(2);
  });

  it("全部关门时兜底放行", () => {
    const pool = Array.from({ length: 6 }, (_, i) =>
      makePOI({ id: `closed${i}`, category: catOf(i), open_hours: "03:00-04:00" })
    );
    const result = filterCandidates(makePrefs(), NOON, pool);
    expect(result.length).toBe(6);
  });

  it("排队长的 POI 不再被硬删，而是排名靠后", () => {
    const pool = [
      makePOI({ id: "fast", category: catOf(0), avg_wait_minutes: 0, rating: 4.0 }),
      makePOI({ id: "slow", category: catOf(1), avg_wait_minutes: 30, rating: 4.5 }),
    ];
    const result = filterCandidates(makePrefs(), NOON, pool);
    // 两个都在，排队长的不会被删
    expect(result.length).toBe(2);
    expect(result.some((p) => p.id === "slow")).toBe(true);
  });

  it("rating 差距不大时，排队长的店排名靠后", () => {
    const pool = [
      makePOI({ id: "popular", category: catOf(0), avg_wait_minutes: 25, rating: 4.5 }),
      makePOI({ id: "empty", category: catOf(1), avg_wait_minutes: 0, rating: 4.3 }),
    ];
    const result = filterCandidates(makePrefs(), NOON, pool);
    expect(result[0].id).toBe("empty");
  });

  it("超过 15 个候选时截断到 15", () => {
    const pool = Array.from({ length: 20 }, (_, i) =>
      makePOI({ id: `m${i}`, category: catOf(i), rating: 3.0 + i * 0.1 })
    );
    const result = filterCandidates(makePrefs(), NOON, pool);
    expect(result.length).toBe(15);
  });

  it("结果按 score 降序排列", () => {
    const pool = [
      makePOI({ id: "low", category: catOf(0), rating: 3.0 }),
      makePOI({ id: "mid", category: catOf(1), rating: 4.0 }),
      makePOI({ id: "high", category: catOf(2), rating: 4.9 }),
    ];
    const result = filterCandidates(makePrefs(), NOON, pool);
    expect(result.map((p) => p.id)).toEqual(["high", "mid", "low"]);
  });

  it("每个品类最多 2 个（category cap）", () => {
    const pool = Array.from({ length: 5 }, (_, i) =>
      makePOI({ id: `cafe${i}`, category: "咖啡厅", rating: 4.0 + i * 0.1 })
    );
    const result = filterCandidates(makePrefs(), NOON, pool);
    expect(result.length).toBe(2);
  });

  it("空池返回空数组", () => {
    expect(filterCandidates(makePrefs(), NOON, [])).toEqual([]);
  });

  it("prefs.special 为空时不按标签过滤", () => {
    const pool = Array.from({ length: 6 }, (_, i) =>
      makePOI({ id: `x${i}`, category: catOf(i), tags: ["whatever"] })
    );
    const result = filterCandidates(makePrefs({ special: [] }), NOON, pool);
    expect(result.length).toBe(6);
  });

  it("传入历史记录时，去过的地方排名更靠后", () => {
    const pool = [
      makePOI({ id: "old", name: "去过的店", category: catOf(0), rating: 4.5 }),
      makePOI({ id: "new", name: "新店", category: catOf(1), rating: 4.5 }),
    ];
    const history: TripRecord[] = [{
      id: "t1", date: "2026-06-01",
      waypoints: [{ name: "去过的店", emoji: "☕", lat: 0, lng: 0, visited: true }],
      chatActions: [], distanceKm: 1, durationMin: 30,
      rewards: [], intensity: "normal", preferences: makePrefs(),
    }];
    const result = filterCandidates(makePrefs(), NOON, pool, history);
    expect(result[0].id).toBe("new");
  });
});
