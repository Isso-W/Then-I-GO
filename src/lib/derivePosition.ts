import type { ExploreStep, GeneratedRoute } from "../types";
import type { LatLng } from "../components/mapProjection";

// 哪些 step 意味着用户"已到达 wp[0]"（或更晚）
const AT_OR_PAST_WP0: ReadonlySet<ExploreStep> = new Set<ExploreStep>([
  "checkin_initial",
  "hidden_found",
  "hidden_active",
  "checkin_hidden",
  "reward_hidden",
  "next_objective",
]);

// 哪些 step 意味着用户"已到达 wp[1]"（或更晚）
const AT_OR_PAST_WP1: ReadonlySet<ExploreStep> = new Set<ExploreStep>([
  "checkin_next",
  "vlog_ready",
  "achievement_unlock",
]);

/**
 * 根据当前 ExploreStep 推导用户在地图上的位置。
 *
 * 规则：
 *  - 没有路线 → 始终在 origin（五道口地铁）
 *  - 进入 checkin_initial 及之后 → 位置 = wp[0]
 *  - 进入 checkin_next 及之后 → 位置 = wp[1]
 *  - 路线只有 1 个 waypoint 时，"wp[1] 阶段"退回 wp[0]
 *  - 其它 step（intro / initial / preference 等） → origin
 */
export function positionFromStep(
  step: ExploreStep,
  route: GeneratedRoute | null,
  origin: LatLng
): LatLng {
  if (!route || route.waypoints.length === 0) return origin;

  if (AT_OR_PAST_WP1.has(step)) {
    const wp = route.waypoints[1] ?? route.waypoints[0];
    return { lat: wp.lat, lng: wp.lng };
  }

  if (AT_OR_PAST_WP0.has(step)) {
    const wp = route.waypoints[0];
    return { lat: wp.lat, lng: wp.lng };
  }

  return origin;
}
