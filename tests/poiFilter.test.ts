import { describe, it, expect } from "vitest";
import {
  filterCandidates,
  distanceMeters,
  walkingTimeText,
  isOpenAt,
  scorePOI,
  ORIGIN,
  pickUnknownPOIs,
} from "../src/agents/poiFilter";
import type { POI, UserPreferences } from "../src/types";

// 工厂：生成默认 POI，单测里只覆盖需要变化的字段
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
  ...overrides,
});

// 一个"中午 12 点"的固定时刻，方便测营业时间
const NOON = new Date("2026-05-25T12:00:00");
const MIDNIGHT_AM_1 = new Date("2026-05-25T01:00:00");
const MORNING_10 = new Date("2026-05-25T10:00:00");

describe("distanceMeters (Haversine 普适不变量)", () => {
  it("同一点距离为 0", () => {
    expect(distanceMeters(ORIGIN, ORIGIN)).toBe(0);
  });

  it("对称：d(A,B) == d(B,A)", () => {
    const a = { lat: 39.99, lng: 116.33 };
    const b = { lat: 40.01, lng: 116.36 };
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
  });

  it("1 度纬度 ≈ 111.195 km（地理常数，验证公式而不是验证自己）", () => {
    const d = distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    // R=6371000 时 πR/180 = 111194.93m
    expect(d).toBeGreaterThan(111000);
    expect(d).toBeLessThan(111400);
  });

  it("正数距离（不会返回负数）", () => {
    const d = distanceMeters(ORIGIN, { lat: ORIGIN.lat + 0.01, lng: ORIGIN.lng + 0.01 });
    expect(d).toBeGreaterThan(0);
  });
});

describe("walkingTimeText", () => {
  it("0 米也至少 1 分钟（不返回 0 分钟）", () => {
    expect(walkingTimeText(0)).toMatch(/步行约1分钟/);
  });

  it("800 米约 10 分钟（80m/min 步速）", () => {
    expect(walkingTimeText(800)).toBe("步行约10分钟");
  });

  it("总以'步行约'开头", () => {
    for (const m of [50, 500, 5000]) {
      expect(walkingTimeText(m)).toMatch(/^步行约/);
    }
  });
});

describe("isOpenAt", () => {
  it("正常区间内为 true", () => {
    expect(isOpenAt("08:00-20:00", MORNING_10)).toBe(true);
  });

  it("正常区间外为 false", () => {
    expect(isOpenAt("08:00-20:00", new Date("2026-05-25T22:00:00"))).toBe(false);
  });

  it("起点时刻 inclusive", () => {
    expect(isOpenAt("10:00-20:00", MORNING_10)).toBe(true);
  });

  it("终点时刻 inclusive", () => {
    expect(isOpenAt("08:00-12:00", NOON)).toBe(true);
  });

  it("跨午夜：18:00-02:00 在 20:00 营业", () => {
    expect(isOpenAt("18:00-02:00", new Date("2026-05-25T20:00:00"))).toBe(true);
  });

  it("跨午夜：18:00-02:00 在凌晨 01:00 营业", () => {
    expect(isOpenAt("18:00-02:00", MIDNIGHT_AM_1)).toBe(true);
  });

  it("跨午夜：18:00-02:00 在白天 10:00 关闭", () => {
    expect(isOpenAt("18:00-02:00", MORNING_10)).toBe(false);
  });

  it("跨午夜：18:00-02:00 在 00:00 仍开（边界）", () => {
    expect(isOpenAt("18:00-02:00", new Date("2026-05-25T00:00:00"))).toBe(true);
  });

  it("格式无法解析时降级为 true（不让数据脏导致全过滤掉）", () => {
    expect(isOpenAt("营业中", NOON)).toBe(true);
    expect(isOpenAt("", NOON)).toBe(true);
  });
});

describe("scorePOI", () => {
  it("rating 越高分越高（其他相同）", () => {
    const prefs = makePrefs();
    const low = makePOI({ rating: 3.0 });
    const high = makePOI({ rating: 4.8 });
    expect(scorePOI(high, prefs)).toBeGreaterThan(scorePOI(low, prefs));
  });

  it("心情匹配加 0.5", () => {
    const prefs = makePrefs({ mood: "relax" });
    const noMatch = makePOI({ rating: 4.0, mood_match: [] });
    const match = makePOI({ rating: 4.0, mood_match: ["relax"] });
    expect(scorePOI(match, prefs) - scorePOI(noMatch, prefs)).toBeCloseTo(0.5, 5);
  });

  it("距离远的扣分（同 rating 同心情，近的得分高）", () => {
    const prefs = makePrefs();
    const near = makePOI({ rating: 4.0, lat: ORIGIN.lat, lng: ORIGIN.lng });
    const far = makePOI({
      rating: 4.0,
      lat: ORIGIN.lat + 0.05,
      lng: ORIGIN.lng + 0.05,
    });
    expect(scorePOI(near, prefs)).toBeGreaterThan(scorePOI(far, prefs));
  });
});

describe("filterCandidates 渐进降级", () => {
  it("strict 阶段命中 ≥5 时停在 strict，不再放宽", () => {
    const pool = Array.from({ length: 6 }, (_, i) =>
      makePOI({ id: `s${i}`, tags: ["art"], avg_wait_minutes: 0, rating: 4.0 + i * 0.1 })
    );
    const prefs = makePrefs({ special: ["art"] });
    const result = filterCandidates(prefs, NOON, pool);
    expect(result.length).toBe(6);
  });

  it("严格阶段不足 5 但放宽 wait 后充足时，使用 no_wait 阶段", () => {
    // 4 个完全匹配 + 6 个除了 wait 超标外都匹配
    const pool: POI[] = [
      ...Array.from({ length: 4 }, (_, i) =>
        makePOI({ id: `ok${i}`, tags: ["art"], avg_wait_minutes: 0 })
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        makePOI({ id: `slow${i}`, tags: ["art"], avg_wait_minutes: 99 })
      ),
    ];
    const prefs = makePrefs({ special: ["art"] });
    const result = filterCandidates(prefs, NOON, pool);
    // strict 只有 4 < 5，会放宽到 no_wait（包含全部 10），截断 top 10
    expect(result.length).toBe(10);
    // 应该包含 wait 高的 POI（证明放宽生效）
    expect(result.some((p) => p.id.startsWith("slow"))).toBe(true);
  });

  it("tags 完全不匹配但有同时段开放的 POI 时，降到 no_tags 阶段", () => {
    const pool = Array.from({ length: 8 }, (_, i) =>
      makePOI({ id: `n${i}`, tags: ["food"], avg_wait_minutes: 0 })
    );
    const prefs = makePrefs({ special: ["art"] }); // 与 pool 标签零交集
    const result = filterCandidates(prefs, NOON, pool);
    expect(result.length).toBe(8); // 全部因为放宽到 no_tags 通过
  });

  it("所有 POI 都关门时，降到 all 阶段（兜底返回）", () => {
    const pool = Array.from({ length: 6 }, (_, i) =>
      makePOI({ id: `closed${i}`, open_hours: "03:00-04:00" })
    );
    const prefs = makePrefs();
    const result = filterCandidates(prefs, NOON, pool); // 12:00 都关
    expect(result.length).toBe(6); // all 阶段不再过滤营业时间
  });

  it("空池返回空数组", () => {
    expect(filterCandidates(makePrefs(), NOON, [])).toEqual([]);
  });

  it("超过 10 个候选时截断到 10", () => {
    const pool = Array.from({ length: 15 }, (_, i) =>
      makePOI({ id: `m${i}`, tags: ["art"], rating: 3.0 + i * 0.1 })
    );
    const prefs = makePrefs({ special: ["art"] });
    const result = filterCandidates(prefs, NOON, pool);
    expect(result.length).toBe(10);
  });

  it("结果按 score 降序排列", () => {
    const pool = [
      makePOI({ id: "low", tags: ["art"], rating: 3.0 }),
      makePOI({ id: "mid", tags: ["art"], rating: 4.0 }),
      makePOI({ id: "high", tags: ["art"], rating: 4.9 }),
    ];
    // 池子小于 MIN_ACCEPTABLE，会一路放宽到 all，但 rating 排序应该保持
    const prefs = makePrefs({ special: ["art"] });
    const result = filterCandidates(prefs, NOON, pool);
    expect(result.map((p) => p.id)).toEqual(["high", "mid", "low"]);
  });

  it("prefs.special 为空时不按标签过滤（验收任意 POI）", () => {
    const pool = Array.from({ length: 6 }, (_, i) =>
      makePOI({ id: `x${i}`, tags: ["whatever"] })
    );
    const prefs = makePrefs({ special: [] });
    const result = filterCandidates(prefs, NOON, pool);
    expect(result.length).toBe(6);
  });
});

describe("pickUnknownPOIs", () => {
  it("排除 excludeIds 中的 POI", () => {
    const pool = [makePOI({ id: "a" }), makePOI({ id: "b" }), makePOI({ id: "c" })];
    const result = pickUnknownPOIs(pool, new Set(["a"]), 5);
    expect(result.length).toBe(2); // b, c
  });

  it("最多返回 n 个", () => {
    const pool = Array.from({ length: 6 }, (_, i) => makePOI({ id: `u${i}` }));
    expect(pickUnknownPOIs(pool, new Set(), 3).length).toBe(3);
  });

  it("只暴露 lat/lng（不剧透其他字段）", () => {
    const pool = [makePOI({ id: "a", lat: 39.99, lng: 116.34 })];
    const result = pickUnknownPOIs(pool, new Set(), 1);
    expect(Object.keys(result[0]).sort()).toEqual(["lat", "lng"]);
    expect(result[0]).toEqual({ lat: 39.99, lng: 116.34 });
  });

  it("全部被排除时返回空数组", () => {
    const pool = [makePOI({ id: "a" }), makePOI({ id: "b" })];
    expect(pickUnknownPOIs(pool, new Set(["a", "b"]), 3)).toEqual([]);
  });

  it("保持候选既有顺序（确定性）", () => {
    const pool = [
      makePOI({ id: "x", lat: 1, lng: 1 }),
      makePOI({ id: "y", lat: 2, lng: 2 }),
    ];
    expect(pickUnknownPOIs(pool, new Set(), 2)).toEqual([
      { lat: 1, lng: 1 },
      { lat: 2, lng: 2 },
    ]);
  });
});
