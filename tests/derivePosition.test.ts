import { describe, it, expect } from "vitest";
import { positionFromStep } from "../src/lib/derivePosition";
import { ORIGIN } from "../src/components/mapProjection";
import type { ExploreStep, GeneratedRoute, Waypoint } from "../src/types";

const makeWp = (overrides: Partial<Waypoint>): Waypoint => ({
  name: "Test",
  description: "",
  task: "",
  reward: "",
  emoji: "📍",
  distanceText: "",
  lat: 0,
  lng: 0,
  ...overrides,
});

const wp0 = makeWp({ lat: 40.001, lng: 116.330 });
const wp1 = makeWp({ lat: 39.985, lng: 116.345 });
const wp2 = makeWp({ lat: 39.990, lng: 116.350 });
const hidden = makeWp({ lat: 39.995, lng: 116.340 });
const routeTwo: GeneratedRoute = { title: "test", waypoints: [wp0, wp1] };
const routeThree: GeneratedRoute = { title: "test", waypoints: [wp0, wp1, wp2], hiddenTask: hidden };
const routeOne: GeneratedRoute = { title: "test", waypoints: [wp0] };

describe("positionFromStep", () => {
  it("没有路线时永远返回 origin", () => {
    expect(positionFromStep("checkin_initial", null, ORIGIN)).toEqual(ORIGIN);
    expect(positionFromStep("next_objective", null, ORIGIN)).toEqual(ORIGIN);
  });

  it("空 waypoints 等同没路线", () => {
    const empty: GeneratedRoute = { title: "x", waypoints: [] };
    expect(positionFromStep("initial", empty, ORIGIN)).toEqual(ORIGIN);
  });

  it("initial = 用户在 origin（出发点）", () => {
    expect(positionFromStep("initial", routeTwo, ORIGIN, 0)).toEqual(ORIGIN);
  });

  it("checkin_initial = 到达了 waypoints[waypointIndex]", () => {
    expect(positionFromStep("checkin_initial", routeTwo, ORIGIN, 0)).toEqual({ lat: wp0.lat, lng: wp0.lng });
  });

  it("hidden steps = 在隐藏任务位置", () => {
    for (const s of ["hidden_found", "hidden_active", "checkin_hidden", "reward_hidden"] as ExploreStep[]) {
      expect(positionFromStep(s, routeThree, ORIGIN, 0)).toEqual({ lat: hidden.lat, lng: hidden.lng });
    }
  });

  it("next_objective = 在上一站（还没走到下一站）", () => {
    // waypointIndex=1 → 用户在 wp[0]
    expect(positionFromStep("next_objective", routeThree, ORIGIN, 1)).toEqual({ lat: wp0.lat, lng: wp0.lng });
    // waypointIndex=2 → 用户在 wp[1]
    expect(positionFromStep("next_objective", routeThree, ORIGIN, 2)).toEqual({ lat: wp1.lat, lng: wp1.lng });
    // waypointIndex=0 → 用户在 origin
    expect(positionFromStep("next_objective", routeTwo, ORIGIN, 0)).toEqual(ORIGIN);
  });

  it("checkin_next = 到达了 waypoints[waypointIndex]", () => {
    expect(positionFromStep("checkin_next", routeThree, ORIGIN, 1)).toEqual({ lat: wp1.lat, lng: wp1.lng });
    expect(positionFromStep("checkin_next", routeThree, ORIGIN, 2)).toEqual({ lat: wp2.lat, lng: wp2.lng });
  });

  it("achievement_unlock = 最后一站", () => {
    expect(positionFromStep("achievement_unlock", routeThree, ORIGIN, 2)).toEqual({ lat: wp2.lat, lng: wp2.lng });
  });

  it("单 waypoint 路线不越界", () => {
    expect(positionFromStep("checkin_next", routeOne, ORIGIN, 0)).toEqual({ lat: wp0.lat, lng: wp0.lng });
  });

  it("origin 参数被尊重", () => {
    const custom = { lat: 39.9087, lng: 116.3975 };
    expect(positionFromStep("intro", routeTwo, custom)).toEqual(custom);
  });

  it("返回的对象只包含 lat/lng", () => {
    const pos = positionFromStep("checkin_initial", routeTwo, ORIGIN, 0);
    expect(Object.keys(pos).sort()).toEqual(["lat", "lng"]);
  });
});
