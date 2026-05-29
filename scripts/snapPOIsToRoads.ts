/**
 * 把 POI 按 category 落到合适的地表上：
 *   - 公园绿地 → 随机落在某个 park 多边形内（rejection sampling + ray casting）
 *   - 共享空间 / 自习室 → 落在某个 campus 多边形内（校园里有自习室更合理）
 *   - 其它 → 按路段长度加权落在路网上（原行为）
 *
 * 直接覆盖 src/data/pois.json。运行：npx tsx scripts/snapPOIsToRoads.ts
 *
 * 注：跑这个脚本前要确保 scripts/data/terrain.json 已生成（npx tsx scripts/generateTerrain.ts）。
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { StreetNetwork } from "./fetchStreetNetwork.js";
import type { TerrainData } from "./generateTerrain.js";
import type { POI } from "../src/types.js";

const network: StreetNetwork = JSON.parse(
  readFileSync(resolve("scripts/data/street-network.json"), "utf-8")
);
const terrain: TerrainData = JSON.parse(
  readFileSync(resolve("scripts/data/terrain.json"), "utf-8")
);
const pois: POI[] = JSON.parse(
  readFileSync(resolve("src/data/pois.json"), "utf-8")
);

const LAT_M = 111_320;
const LNG_M = 111_320 * Math.cos((39.992 * Math.PI) / 180);

function segLen(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dy = (b.lat - a.lat) * LAT_M;
  const dx = (b.lng - a.lng) * LNG_M;
  return Math.sqrt(dx * dx + dy * dy);
}

// =====================================================================
// 路上采样（原算法）
// =====================================================================
interface Seg { a: { lat: number; lng: number }; b: { lat: number; lng: number }; len: number; }
const segments: Seg[] = [];
for (const street of network.streets) {
  for (let i = 0; i < street.points.length - 1; i++) {
    const a = street.points[i], b = street.points[i + 1];
    const len = segLen(a, b);
    if (len > 0) segments.push({ a, b, len });
  }
}
const totalLen = segments.reduce((s, seg) => s + seg.len, 0);

function sampleOnNetwork(seed: number): { lat: number; lng: number } {
  // 用 seed 做伪随机，保证可复现
  const rand = (n: number) => {
    const x = Math.sin(seed * 9301 + n * 49297 + 233) * 10000;
    return x - Math.floor(x);
  };
  const target = rand(0) * totalLen;
  let acc = 0;
  for (let i = 0; i < segments.length; i++) {
    acc += segments[i].len;
    if (acc >= target) {
      const t = rand(i + 1);
      const { a, b } = segments[i];
      return {
        lat: a.lat + t * (b.lat - a.lat),
        lng: a.lng + t * (b.lng - a.lng),
      };
    }
  }
  return segments[segments.length - 1].b;
}

// =====================================================================
// 多边形内采样（rejection sampling + ray casting point-in-polygon）
// =====================================================================
type Poly = { lat: number; lng: number }[];

function pointInPolygon(p: { lat: number; lng: number }, poly: Poly): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i].lat, xi = poly[i].lng;
    const yj = poly[j].lat, xj = poly[j].lng;
    const intersect =
      yi > p.lat !== yj > p.lat &&
      p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function polyBBox(poly: Poly) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of poly) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

function sampleInsidePolygon(poly: Poly, seed: number): { lat: number; lng: number } | null {
  const bb = polyBBox(poly);
  const rand = (n: number) => {
    const x = Math.sin(seed * 9301 + n * 49297 + 233) * 10000;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 30; i++) {
    const lat = bb.minLat + rand(i * 2) * (bb.maxLat - bb.minLat);
    const lng = bb.minLng + rand(i * 2 + 1) * (bb.maxLng - bb.minLng);
    if (pointInPolygon({ lat, lng }, poly)) return { lat, lng };
  }
  return null; // rejection 30 次都失败（极端窄长多边形），换下一个
}

function sampleInsideAnyOfType(type: "park" | "campus", seed: number): { lat: number; lng: number } | null {
  const candidates = terrain.polygons.filter((p) => p.type === type);
  if (candidates.length === 0) return null;
  const rand = (n: number) => {
    const x = Math.sin(seed * 9301 + n * 49297 + 233) * 10000;
    return x - Math.floor(x);
  };
  // 随机打乱顺序后逐个尝试，第一个采样成功的就用
  const order = candidates
    .map((p, i) => ({ p, k: rand(i) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.p);
  for (const poly of order) {
    const pt = sampleInsidePolygon(poly.points, seed);
    if (pt) return pt;
  }
  return null;
}

// =====================================================================
// 主流程：按 category 选采样策略
// =====================================================================
function placementFor(poi: POI, seed: number): { lat: number; lng: number } {
  const cat = poi.category;
  if (cat === "公园绿地") {
    const p = sampleInsideAnyOfType("park", seed);
    if (p) return p;
    // 没找到 park 多边形 → fallback 到路上
  }
  if (cat === "共享空间/自习室") {
    const p = sampleInsideAnyOfType("campus", seed);
    if (p) return p;
  }
  return sampleOnNetwork(seed);
}

const stats = { park: 0, campus: 0, road: 0, fallback: 0 };
const assigned = pois.map((poi, i) => {
  const placed = placementFor(poi, i);
  // 统计：检查落点落进了哪些类型的多边形（一个点可能同时在嵌套多边形里，比如林大苗圃在北林校园里）
  const inTypes = new Set<string>();
  for (const poly of terrain.polygons) {
    if (pointInPolygon(placed, poly.points)) inTypes.add(poly.type);
  }
  if (poi.category === "公园绿地") {
    inTypes.has("park") ? stats.park++ : stats.fallback++;
  } else if (poi.category === "共享空间/自习室") {
    inTypes.has("campus") ? stats.campus++ : stats.fallback++;
  } else {
    stats.road++;
  }
  return { ...poi, ...placed };
});

writeFileSync(resolve("src/data/pois.json"), JSON.stringify(assigned, null, 2), "utf-8");

console.log(`完成：${pois.length} 个 POI 已按 category 重新吸附`);
console.log(`  公园绿地落进公园: ${stats.park}（共 ${pois.filter((p) => p.category === "公园绿地").length} 个）`);
console.log(`  自习室落进校园: ${stats.campus}（共 ${pois.filter((p) => p.category === "共享空间/自习室").length} 个）`);
console.log(`  其它落在路上: ${stats.road}`);
if (stats.fallback > 0) {
  console.log(`  ⚠ ${stats.fallback} 个 POI 因没有匹配的多边形回退到路上`);
}
console.log(`总路长: ${(totalLen / 1000).toFixed(1)} km，${segments.length} 条子线段`);
