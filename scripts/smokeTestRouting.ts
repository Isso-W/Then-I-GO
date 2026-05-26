/**
 * 临时：用真实路网验证寻路工作
 * 运行：npx tsx scripts/smokeTestRouting.ts
 */
import { readFileSync } from "node:fs";
import { buildGraph, shortestPath, routePolyline } from "../src/lib/roadGraph";
import type { POI } from "../src/types";

const net = JSON.parse(readFileSync("scripts/data/street-network.json", "utf-8"));
const pois: POI[] = JSON.parse(readFileSync("src/data/pois.json", "utf-8"));

const g = buildGraph(net.streets);
console.log(`Graph: nodes=${g.nodes.length} edges=${g.edges.length} mainComp=${g.mainComponent.size}`);

const ORIGIN = { lat: 39.992, lng: 116.337 };

for (let i = 0; i < 5; i++) {
  const poi = pois[Math.floor((i * pois.length) / 5)];
  const p = shortestPath(ORIGIN, { lat: poi.lat, lng: poi.lng }, g);
  // 算一下 polyline 总长度（米）
  let len = 0;
  const LAT_M = 111_320, LNG_M = 111_320 * Math.cos((39.992 * Math.PI) / 180);
  for (let j = 1; j < p.length; j++) {
    const dy = (p[j].lat - p[j-1].lat) * LAT_M;
    const dx = (p[j].lng - p[j-1].lng) * LNG_M;
    len += Math.hypot(dx, dy);
  }
  console.log(`ORIGIN → ${poi.name} (${poi.category}): ${p.length} 折点, 总长 ${Math.round(len)}m`);
}

console.log("");
const route = pois.slice(0, 3).map((p) => ({ lat: p.lat, lng: p.lng }));
const poly = routePolyline([ORIGIN, ...route], g);
console.log(`3 站路线 polyline: 折点数 = ${poly.length}`);
console.log(`首点: (${poly[0].lat.toFixed(4)}, ${poly[0].lng.toFixed(4)})`);
console.log(`末点: (${poly[poly.length-1].lat.toFixed(4)}, ${poly[poly.length-1].lng.toFixed(4)})`);
