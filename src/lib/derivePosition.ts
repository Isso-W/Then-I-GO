import type { ExploreStep, GeneratedRoute } from "../types";
import type { LatLng } from "../components/mapProjection";

const HIDDEN_STEPS: ReadonlySet<ExploreStep> = new Set<ExploreStep>([
  "hidden_found", "hidden_active", "checkin_hidden", "reward_hidden",
]);

const DONE_STEPS: ReadonlySet<ExploreStep> = new Set<ExploreStep>([
  "achievement_unlock",
]);

/**
 * 根据当前 ExploreStep + waypointIndex 推导用户在地图上的位置。
 *
 * 返回的是用户"当前所在位置"，不是目标位置：
 * - initial: 用户在 origin（出发点），要走去 wp[0]
 * - checkin_initial: 用户到达了 wp[waypointIndex]
 * - hidden steps: 用户在 hiddenTask 位置
 * - next_objective: 用户在上一站（wp[waypointIndex-1]），要走去 wp[waypointIndex]
 * - checkin_next: 用户到达了 wp[waypointIndex]
 * - achievement_unlock: 用户在最后一站
 */
export function positionFromStep(
  step: ExploreStep,
  route: GeneratedRoute | null,
  origin: LatLng,
  waypointIndex: number = 0
): LatLng {
  if (!route || route.waypoints.length === 0) return origin;

  if (DONE_STEPS.has(step)) {
    if (route.hiddenTask) {
      return { lat: route.hiddenTask.lat, lng: route.hiddenTask.lng };
    }
    const last = route.waypoints[route.waypoints.length - 1];
    return { lat: last.lat, lng: last.lng };
  }

  if (HIDDEN_STEPS.has(step) && route.hiddenTask) {
    return { lat: route.hiddenTask.lat, lng: route.hiddenTask.lng };
  }

  // checkin = 到达了目标
  if (step === "checkin_initial" || step === "checkin_next") {
    const wp = route.waypoints[waypointIndex] ?? route.waypoints[route.waypoints.length - 1];
    return { lat: wp.lat, lng: wp.lng };
  }

  // initial = 从 origin 出发
  if (step === "initial") {
    return origin;
  }

  // next_objective = 在上一站，还没走到下一站
  if (step === "next_objective") {
    if (waypointIndex === 0) return origin;
    const prev = route.waypoints[waypointIndex - 1];
    return prev ? { lat: prev.lat, lng: prev.lng } : origin;
  }

  return origin;
}
