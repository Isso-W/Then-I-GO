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
const routeTwo: GeneratedRoute = { title: "test", waypoints: [wp0, wp1] };
const routeOne: GeneratedRoute = { title: "test", waypoints: [wp0] };

describe("positionFromStep（step → 位置 映射）", () => {
  it("没有路线时永远返回 origin", () => {
    expect(positionFromStep("checkin_initial", null, ORIGIN)).toEqual(ORIGIN);
    expect(positionFromStep("checkin_next", null, ORIGIN)).toEqual(ORIGIN);
  });

  it("空 waypoints 数组等同没路线", () => {
    const empty: GeneratedRoute = { title: "x", waypoints: [] };
    expect(positionFromStep("checkin_initial", empty, ORIGIN)).toEqual(ORIGIN);
  });

  it("intro / preference / gear_confirmation / initial → 仍在 origin", () => {
    const steps: ExploreStep[] = [
      "intro",
      "preference_selection",
      "gear_confirmation",
      "initial",
    ];
    for (const s of steps) {
      expect(positionFromStep(s, routeTwo, ORIGIN)).toEqual(ORIGIN);
    }
  });

  it("checkin_initial 及'在 wp0 附近的所有 step' → 位置 = wp0", () => {
    const wp0Steps: ExploreStep[] = [
      "checkin_initial",
      "hidden_found",
      "hidden_active",
      "checkin_hidden",
      "reward_hidden",
      "next_objective",
    ];
    for (const s of wp0Steps) {
      expect(positionFromStep(s, routeTwo, ORIGIN)).toEqual({
        lat: wp0.lat,
        lng: wp0.lng,
      });
    }
  });

  it("checkin_next / vlog_ready / achievement_unlock → 位置 = wp1", () => {
    const wp1Steps: ExploreStep[] = [
      "checkin_next",
      "vlog_ready",
      "achievement_unlock",
    ];
    for (const s of wp1Steps) {
      expect(positionFromStep(s, routeTwo, ORIGIN)).toEqual({
        lat: wp1.lat,
        lng: wp1.lng,
      });
    }
  });

  it("路线只有 1 个 waypoint 时，wp1 阶段退回 wp0（不会越界）", () => {
    expect(positionFromStep("checkin_next", routeOne, ORIGIN)).toEqual({
      lat: wp0.lat,
      lng: wp0.lng,
    });
  });

  it("origin 参数被尊重（不是硬编码五道口）", () => {
    const customOrigin = { lat: 39.9087, lng: 116.3975 }; // 北京天安门（区别于默认五道口）
    expect(positionFromStep("intro", routeTwo, customOrigin)).toEqual(customOrigin);
  });

  it("返回的对象只包含 lat/lng（不泄露 Waypoint 其他字段）", () => {
    const pos = positionFromStep("checkin_initial", routeTwo, ORIGIN);
    expect(Object.keys(pos).sort()).toEqual(["lat", "lng"]);
  });
});
