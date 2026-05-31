/**
 * 把 GeneratedRoute 转成"路线回放"用的几何数据（沿街寻路 + 分段 + 里程）。
 * 无 AI、无 React，纯函数 + 模块级路网图缓存。供 Vlog 路线回放（RouteReplay）使用。
 */

import streetNetwork from "../../scripts/data/street-network.json";
import { buildGraph, shortestPath, type Street } from "./roadGraph";
import { ORIGIN, type LatLng } from "../components/mapProjection";
import type { GeneratedRoute, VlogGeo, VlogGeoStop } from "../types";

const network = streetNetwork as { streets: Street[] };
// 路网图构建一次缓存（Map.tsx 另建了一份；这里单独缓存避免耦合，启动成本可忽略）
const ROAD_GRAPH = buildGraph(network.streets);

const LAT_M = 111_320;
const LNG_M = 111_320 * Math.cos((39.992 * Math.PI) / 180);

function distM(a: LatLng, b: LatLng): number {
  return Math.hypot((b.lng - a.lng) * LNG_M, (b.lat - a.lat) * LAT_M);
}

/** 折线总长（米） */
export function polyLenM(poly: LatLng[]): number {
  let s = 0;
  for (let i = 1; i < poly.length; i++) s += distM(poly[i - 1], poly[i]);
  return s;
}

/** 折线上行进 frac(0~1) 处的点（按长度线性插值） */
export function pointAlong(poly: LatLng[], frac: number): LatLng {
  if (poly.length === 0) return ORIGIN;
  if (poly.length === 1 || frac <= 0) return poly[0];
  if (frac >= 1) return poly[poly.length - 1];
  const target = polyLenM(poly) * frac;
  let acc = 0;
  for (let i = 1; i < poly.length; i++) {
    const seg = distM(poly[i - 1], poly[i]);
    if (acc + seg >= target) {
      const t = seg < 1e-6 ? 0 : (target - acc) / seg;
      return {
        lat: poly[i - 1].lat + (poly[i].lat - poly[i - 1].lat) * t,
        lng: poly[i - 1].lng + (poly[i].lng - poly[i - 1].lng) * t,
      };
    }
    acc += seg;
  }
  return poly[poly.length - 1];
}

/** 折线从头到 frac 处的子折线（画"已走过"的轨迹） */
export function partialPoly(poly: LatLng[], frac: number): LatLng[] {
  if (poly.length <= 1 || frac >= 1) return poly.slice();
  if (frac <= 0) return [poly[0]];
  const target = polyLenM(poly) * frac;
  const out: LatLng[] = [poly[0]];
  let acc = 0;
  for (let i = 1; i < poly.length; i++) {
    const seg = distM(poly[i - 1], poly[i]);
    if (acc + seg >= target) {
      const t = seg < 1e-6 ? 0 : (target - acc) / seg;
      out.push({
        lat: poly[i - 1].lat + (poly[i].lat - poly[i - 1].lat) * t,
        lng: poly[i - 1].lng + (poly[i].lng - poly[i - 1].lng) * t,
      });
      return out;
    }
    out.push(poly[i]);
    acc += seg;
  }
  return out;
}

/**
 * 由路线算回放几何：站点 = waypoints（+ 隐藏任务作为末站），
 * 逐段沿街寻路得到 legs，拼成 fullPath，并算总里程 / 步行时长。
 */
export function computeVlogGeo(route: GeneratedRoute): VlogGeo {
  const stops: VlogGeoStop[] = route.waypoints.map((wp) => ({
    lat: wp.lat,
    lng: wp.lng,
    emoji: wp.emoji,
    name: wp.name,
    reward: wp.reward,
  }));
  if (route.hiddenTask) {
    stops.push({
      lat: route.hiddenTask.lat,
      lng: route.hiddenTask.lng,
      emoji: route.hiddenTask.emoji,
      name: route.hiddenTask.name,
      reward: route.hiddenTask.reward,
    });
  }

  const legs: LatLng[][] = [];
  const fullPath: LatLng[] = [];
  let prev: LatLng = ORIGIN;
  let totalM = 0;
  for (const s of stops) {
    const leg = shortestPath(prev, { lat: s.lat, lng: s.lng }, ROAD_GRAPH);
    legs.push(leg);
    totalM += polyLenM(leg);
    if (fullPath.length === 0) fullPath.push(...leg);
    else fullPath.push(...leg.slice(1));
    prev = { lat: s.lat, lng: s.lng };
  }

  return {
    fullPath,
    legs,
    stops,
    distanceKm: Math.round((totalM / 1000) * 10) / 10,
    walkMin: Math.max(1, Math.round(totalM / (1.2 * 60))), // ~1.2 m/s
  };
}
