import { describe, it, expect } from "vitest";
import { wantsBranch, commitBranchChoice, pickContrastingPair } from "../src/lib/branch";
import type { GeneratedRoute, POI, UserPreferences, Waypoint } from "../src/types";

const makeWp = (overrides: Partial<Waypoint> = {}): Waypoint => ({
  name: "wp",
  description: "",
  task: "",
  reward: "",
  emoji: "📍",
  distanceText: "",
  lat: 0,
  lng: 0,
  ...overrides,
});

const makePOI = (overrides: Partial<POI> = {}): POI => ({
  id: "p",
  name: "n",
  category: "咖啡厅",
  tags: [],
  area: "五道口",
  address: "",
  lat: 0,
  lng: 0,
  open_hours: "00:00-23:59",
  avg_stay_minutes: 60,
  avg_wait_minutes: 0,
  crowd_level: "low",
  price_level: 2,
  rating: 4,
  review_summary: "",
  reviews: [],
  mood_match: [],
  mbti_tags: [],
  best_time: "",
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

describe("wantsBranch", () => {
  it("别让我思考 → 不分叉", () => {
    expect(wantsBranch(makePrefs({ intensity: "don't_think" }), 2)).toBe(false);
  });
  it("正常探索 + ≥2 站 → 分叉", () => {
    expect(wantsBranch(makePrefs({ intensity: "normal" }), 2)).toBe(true);
  });
  it("不足 2 站 → 不分叉", () => {
    expect(wantsBranch(makePrefs({ intensity: "normal" }), 1)).toBe(false);
  });
});

describe("commitBranchChoice", () => {
  const a = makeWp({ name: "A", lat: 1, lng: 1 });
  const b = makeWp({ name: "B", lat: 2, lng: 2 });
  const first = makeWp({ name: "first", lat: 0, lng: 0 });
  const route: GeneratedRoute = {
    title: "t",
    waypoints: [first],
    branch: { axis: "?", options: [a, b] },
  };

  it("选 index=1 → waypoints[1] = options[1]，waypoints[0] 不变", () => {
    const out = commitBranchChoice(route, 1);
    expect(out.waypoints[1]).toEqual(b);
    expect(out.waypoints[0]).toEqual(first);
  });
  it("选 index=0 → waypoints[1] = options[0]", () => {
    expect(commitBranchChoice(route, 0).waypoints[1]).toEqual(a);
  });
  it("不可变：返回新对象，原 route 未被修改", () => {
    const out = commitBranchChoice(route, 1);
    expect(out).not.toBe(route);
    expect(route.waypoints.length).toBe(1);
  });
  it("没有 branch → 原样返回（同一引用）", () => {
    const plain: GeneratedRoute = { title: "t", waypoints: [first] };
    expect(commitBranchChoice(plain, 0)).toBe(plain);
  });
  it("index 越界 → 原样返回", () => {
    expect(commitBranchChoice(route, 5)).toBe(route);
  });
});

describe("pickContrastingPair", () => {
  it("优先 crowd_level low vs high", () => {
    const pool = [
      makePOI({ id: "lo", crowd_level: "low" }),
      makePOI({ id: "mid", crowd_level: "medium" }),
      makePOI({ id: "hi", crowd_level: "high" }),
    ];
    const pair = pickContrastingPair(pool, new Set());
    expect(pair).not.toBeNull();
    expect([pair![0].id, pair![1].id].sort()).toEqual(["hi", "lo"]);
  });
  it("没有 low/high 对时退到 category 不同", () => {
    const pool = [
      makePOI({ id: "a", crowd_level: "medium", category: "咖啡厅" }),
      makePOI({ id: "b", crowd_level: "medium", category: "书店" }),
    ];
    const pair = pickContrastingPair(pool, new Set());
    expect(pair).not.toBeNull();
    expect(pair![0].category).not.toBe(pair![1].category);
  });
  it("排除 excludeIds 后不足 2 个 → null", () => {
    const pool = [
      makePOI({ id: "a", crowd_level: "low" }),
      makePOI({ id: "b", crowd_level: "high" }),
    ];
    expect(pickContrastingPair(pool, new Set(["a"]))).toBeNull();
  });
  it("候选不足 2 → null", () => {
    expect(pickContrastingPair([makePOI({ id: "a" })], new Set())).toBeNull();
  });
});
