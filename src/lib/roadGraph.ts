/**
 * 路网图 + Dijkstra 寻路。
 * 输入：street-network.json 的 streets[]
 * 输出：
 *   - buildGraph(streets) 一次性构建
 *   - shortestPath(from, to, graph) 返回沿路 LatLng[] polyline
 *
 * 设计要点：
 * - 25m 容差合并端点为图节点（与 auditStreetNetwork.ts 一致）
 * - 只保留最大连通分量；POI / waypoint 落到孤岛上时仍能 fallback 到直线
 * - 寻路时把 from/to 投影到最近节点（snap-to-nearest-node）
 */

import type { LatLng } from "../components/mapProjection";

export interface Street {
  name: string;
  nameEn?: string;
  highway: string;
  points: LatLng[];
}

const LAT_M = 111_320;
const LNG_M = 111_320 * Math.cos((39.992 * Math.PI) / 180);
const MERGE_TOL_M = 25;

function distMeters(a: LatLng, b: LatLng): number {
  const dy = (b.lat - a.lat) * LAT_M;
  const dx = (b.lng - a.lng) * LNG_M;
  return Math.hypot(dx, dy);
}

interface Node {
  id: number;
  lat: number;
  lng: number;
  count: number;
}
interface Edge {
  a: number;
  b: number;
  len: number;
  street: string;
}

export interface RoadGraph {
  nodes: Node[];
  edges: Edge[];
  adj: number[][]; // node id → edge index 数组
  /** 最大连通分量的节点 id 集合（寻路只在这里跑） */
  mainComponent: Set<number>;
}

export function buildGraph(streets: Street[]): RoadGraph {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  function getOrCreate(p: LatLng): number {
    for (const n of nodes) {
      if (distMeters(p, n) <= MERGE_TOL_M) {
        n.lat = (n.lat * n.count + p.lat) / (n.count + 1);
        n.lng = (n.lng * n.count + p.lng) / (n.count + 1);
        n.count++;
        return n.id;
      }
    }
    const id = nodes.length;
    nodes.push({ id, lat: p.lat, lng: p.lng, count: 1 });
    return id;
  }

  for (const st of streets) {
    for (let i = 0; i < st.points.length - 1; i++) {
      const a = getOrCreate(st.points[i]);
      const b = getOrCreate(st.points[i + 1]);
      if (a === b) continue;
      edges.push({
        a,
        b,
        len: distMeters(st.points[i], st.points[i + 1]),
        street: st.name,
      });
    }
  }

  const adj: number[][] = nodes.map(() => []);
  for (let i = 0; i < edges.length; i++) {
    adj[edges[i].a].push(i);
    adj[edges[i].b].push(i);
  }

  // 找最大连通分量
  const compOf = new Array<number>(nodes.length).fill(-1);
  let compCount = 0;
  const compSizes: number[] = [];
  for (let s = 0; s < nodes.length; s++) {
    if (compOf[s] !== -1) continue;
    const stack = [s];
    compOf[s] = compCount;
    let size = 0;
    while (stack.length) {
      const cur = stack.pop()!;
      size++;
      for (const eIdx of adj[cur]) {
        const e = edges[eIdx];
        const nb = e.a === cur ? e.b : e.a;
        if (compOf[nb] === -1) {
          compOf[nb] = compCount;
          stack.push(nb);
        }
      }
    }
    compSizes.push(size);
    compCount++;
  }
  let maxComp = 0;
  for (let i = 1; i < compSizes.length; i++) {
    if (compSizes[i] > compSizes[maxComp]) maxComp = i;
  }
  const mainComponent = new Set<number>();
  for (let i = 0; i < nodes.length; i++) {
    if (compOf[i] === maxComp) mainComponent.add(i);
  }

  return { nodes, edges, adj, mainComponent };
}

/**
 * 把任意点吸附到路网上最近的点（不限于节点 —— 可以是线段中间的某个垂足）。
 * 用于：拖动小人时强制贴路、ORIGIN 初始化、未来 LBS 校验。
 * 只在最大连通分量上找。
 */
export function snapToRoad(p: LatLng, g: RoadGraph): LatLng {
  const LAT_M = 111_320;
  const LNG_M = 111_320 * Math.cos((39.992 * Math.PI) / 180);
  const px = p.lng * LNG_M, py = p.lat * LAT_M;
  let bestD = Infinity;
  let bestPt: LatLng = p;
  for (const e of g.edges) {
    if (!g.mainComponent.has(e.a) || !g.mainComponent.has(e.b)) continue;
    const a = g.nodes[e.a], b = g.nodes[e.b];
    const ax = a.lng * LNG_M, ay = a.lat * LAT_M;
    const bx = b.lng * LNG_M, by = b.lat * LAT_M;
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-9) continue;
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    const d = Math.hypot(cx - px, cy - py);
    if (d < bestD) {
      bestD = d;
      bestPt = { lat: cy / LAT_M, lng: cx / LNG_M };
    }
  }
  return bestPt;
}

/** 找最近的图节点（只在 mainComponent 里找，避免落到孤岛） */
export function nearestNode(p: LatLng, g: RoadGraph): number | null {
  let best: { id: number; d: number } | null = null;
  for (const id of g.mainComponent) {
    const n = g.nodes[id];
    const d = distMeters(p, n);
    if (!best || d < best.d) best = { id, d };
  }
  return best?.id ?? null;
}

/** Dijkstra 最短路（按米加权），返回节点 id 序列。无路则 null。 */
function dijkstra(g: RoadGraph, src: number, dst: number): number[] | null {
  if (src === dst) return [src];
  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  dist.set(src, 0);
  // 简单的优先队列：用数组 + 每次 pop min。100 节点规模够用。
  const pq: { node: number; d: number }[] = [{ node: src, d: 0 }];
  const visited = new Set<number>();
  while (pq.length) {
    pq.sort((a, b) => a.d - b.d);
    const cur = pq.shift()!;
    if (visited.has(cur.node)) continue;
    visited.add(cur.node);
    if (cur.node === dst) break;
    for (const eIdx of g.adj[cur.node]) {
      const e = g.edges[eIdx];
      const nb = e.a === cur.node ? e.b : e.a;
      if (visited.has(nb)) continue;
      const nd = cur.d + e.len;
      const old = dist.get(nb);
      if (old === undefined || nd < old) {
        dist.set(nb, nd);
        prev.set(nb, cur.node);
        pq.push({ node: nb, d: nd });
      }
    }
  }
  if (!dist.has(dst)) return null;
  const path: number[] = [];
  let cur: number | undefined = dst;
  while (cur !== undefined) {
    path.unshift(cur);
    cur = prev.get(cur);
  }
  return path[0] === src ? path : null;
}

/**
 * 在路网上从 from 到 to 寻路，返回 LatLng polyline。
 * - polyline 头尾分别拼上 from / to 真实坐标，确保 marker 位置不跳
 * - 路网内无连通路径时返回 [from, to] 直线（不会让 UI 崩）
 */
export function shortestPath(from: LatLng, to: LatLng, g: RoadGraph): LatLng[] {
  const srcId = nearestNode(from, g);
  const dstId = nearestNode(to, g);
  if (srcId === null || dstId === null) {
    return [from, to];
  }
  const ids = dijkstra(g, srcId, dstId);
  if (!ids) return [from, to];
  const middle = ids.map((id) => ({ lat: g.nodes[id].lat, lng: g.nodes[id].lng }));
  // 头尾接上真实坐标
  return [from, ...middle, to];
}

/** 一连串 waypoints 全部串起来：[ORIGIN, wp1, wp2, ...] → 长 polyline */
export function routePolyline(stops: LatLng[], g: RoadGraph): LatLng[] {
  if (stops.length < 2) return stops.slice();
  const out: LatLng[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const seg = shortestPath(stops[i], stops[i + 1], g);
    if (i === 0) out.push(...seg);
    else out.push(...seg.slice(1)); // 去掉重复的衔接点
  }
  return out;
}
