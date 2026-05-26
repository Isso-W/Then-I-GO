/**
 * 路网连通性 audit
 * 把 35 条街拆成端点 / 子段，按容差合并端点成图节点，
 * 输出节点数、边数、连通分量、孤岛路段名。
 * 运行：npx tsx scripts/auditStreetNetwork.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { StreetNetwork } from "./fetchStreetNetwork.js";

const NETWORK_PATH = resolve("scripts/data/street-network.json");
const network: StreetNetwork = JSON.parse(readFileSync(NETWORK_PATH, "utf-8"));

// 在五道口纬度上 1m 大约等于多少经度/纬度
const LAT_M = 111_320;
const LNG_M = 111_320 * Math.cos((39.992 * Math.PI) / 180);

// 两个端点距离 ≤ 这个值（米）就视为同一交叉口
const MERGE_TOL_METERS = 25;

interface LatLng { lat: number; lng: number; }

function distM(a: LatLng, b: LatLng): number {
  const dy = (b.lat - a.lat) * LAT_M;
  const dx = (b.lng - a.lng) * LNG_M;
  return Math.sqrt(dx * dx + dy * dy);
}

// 端点聚类：贪心合并距离 ≤ TOL 的点
interface Node {
  id: number;
  lat: number;
  lng: number;
  count: number; // 有多少原始端点合到这里
}

const nodes: Node[] = [];
function getOrCreateNode(p: LatLng): number {
  for (const n of nodes) {
    if (distM(p, n) <= MERGE_TOL_METERS) {
      // 滑动平均位置
      n.lat = (n.lat * n.count + p.lat) / (n.count + 1);
      n.lng = (n.lng * n.count + p.lng) / (n.count + 1);
      n.count += 1;
      return n.id;
    }
  }
  const id = nodes.length;
  nodes.push({ id, lat: p.lat, lng: p.lng, count: 1 });
  return id;
}

interface Edge {
  street: string;
  highway: string;
  a: number;       // node id
  b: number;       // node id
  len: number;     // 米
}
const edges: Edge[] = [];

for (const street of network.streets) {
  for (let i = 0; i < street.points.length - 1; i++) {
    const pA = street.points[i];
    const pB = street.points[i + 1];
    const a = getOrCreateNode(pA);
    const b = getOrCreateNode(pB);
    if (a === b) continue; // 子段两头被合到同一节点，跳过
    edges.push({
      street: street.name,
      highway: street.highway,
      a,
      b,
      len: distM(pA, pB),
    });
  }
}

// 邻接表
const adj: number[][] = nodes.map(() => []);
for (let i = 0; i < edges.length; i++) {
  adj[edges[i].a].push(i);
  adj[edges[i].b].push(i);
}

// 找连通分量（BFS）
const componentOf = new Array(nodes.length).fill(-1);
let nextComp = 0;
const componentSizes: number[] = [];
for (let start = 0; start < nodes.length; start++) {
  if (componentOf[start] !== -1) continue;
  const queue = [start];
  componentOf[start] = nextComp;
  let size = 0;
  while (queue.length) {
    const cur = queue.shift()!;
    size++;
    for (const eIdx of adj[cur]) {
      const e = edges[eIdx];
      const next = e.a === cur ? e.b : e.a;
      if (componentOf[next] === -1) {
        componentOf[next] = nextComp;
        queue.push(next);
      }
    }
  }
  componentSizes.push(size);
  nextComp++;
}

// 每个连通分量包含哪些街
const streetsByComp: Record<number, Set<string>> = {};
for (const e of edges) {
  const comp = componentOf[e.a];
  (streetsByComp[comp] ??= new Set()).add(e.street);
}

// 度统计：度=1 的节点是死胡同；度=0 不可能（孤立节点没有 edge）
const degrees = nodes.map((_, i) => adj[i].length);
const deadEnds = degrees.filter((d) => d === 1).length;
const intersections = degrees.filter((d) => d >= 3).length;
const passthrough = degrees.filter((d) => d === 2).length;

console.log("====== 路网 audit ======");
console.log(`原始街道: ${network.streets.length} 条`);
console.log(`原始子段: ${edges.length} 条 (合并端点后)`);
console.log(`图节点 (合并后端点): ${nodes.length}`);
console.log(`边: ${edges.length}`);
console.log(`端点合并容差: ${MERGE_TOL_METERS} m`);
console.log("");
console.log(`度分布:`);
console.log(`  死胡同 (度=1): ${deadEnds}`);
console.log(`  穿过点 (度=2): ${passthrough}`);
console.log(`  交叉口 (度≥3): ${intersections}`);
console.log("");
console.log(`连通分量: ${componentSizes.length}`);
componentSizes
  .map((size, i) => ({ comp: i, size, streets: [...(streetsByComp[i] ?? [])] }))
  .sort((a, b) => b.size - a.size)
  .forEach((c) => {
    console.log(
      `  分量 #${c.comp}: ${c.size} 个节点, ${c.streets.length} 条街 → ${c.streets.slice(0, 5).join(", ")}${c.streets.length > 5 ? "…" : ""}`
    );
  });

console.log("");
if (componentSizes.length === 1) {
  console.log("✓ 路网完全连通，可以直接寻路。");
} else {
  const main = Math.max(...componentSizes);
  const orphans = nodes.length - main;
  console.log(`⚠ 路网有 ${componentSizes.length} 个独立分量。最大分量 ${main} 节点，孤岛 ${orphans} 节点。`);
  console.log("建议：把孤岛分量挪到最大分量上（修改 street-network.json 的端点坐标，让它们贴到主路）。");
}
