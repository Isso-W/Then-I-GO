/**
 * 路网连通性修复：
 *   1) 检测所有线段几何相交，把交点作为共享节点插入两条街的 points
 *   2) 把孤立端点（度=1 但距离最近其他路段 ≤ SNAP_TOL_M）吸附到最近线段，并在被吸附的线段上插入对应节点
 *   3) 输出修复后的 street-network.json（覆盖原文件）
 *
 * 运行：npx tsx scripts/fixStreetNetwork.ts
 */

import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import type { StreetNetwork, StreetSegment } from "./fetchStreetNetwork.js";

const PATH_IN = resolve("scripts/data/street-network.json");
const PATH_BAK = resolve("scripts/data/street-network.backup.json");
const network: StreetNetwork = JSON.parse(readFileSync(PATH_IN, "utf-8"));

// 保留原始备份，便于回滚
copyFileSync(PATH_IN, PATH_BAK);

const LAT_M = 111_320;
const LNG_M = 111_320 * Math.cos((39.992 * Math.PI) / 180);

interface LL { lat: number; lng: number; }
interface XY { x: number; y: number; }

// 投到本地米平面，方便几何运算
function toXY(p: LL): XY {
  return { x: p.lng * LNG_M, y: p.lat * LAT_M };
}
function fromXY(p: XY): LL {
  return { lat: p.y / LAT_M, lng: p.x / LNG_M };
}
function dist(a: XY, b: XY): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// 已经"几乎相同"就视作同一个点，避免重复插入
const SAME_POINT_TOL_M = 3;

// 端点贴边的最大距离
const SNAP_TOL_M = 80;

// =====================================================================
// 步骤 1：把所有街的子段拆出来，在米平面上工作
// =====================================================================
interface SubSeg {
  street: StreetSegment;
  // 在 street.points 数组里，本子段对应 [from, from+1]，
  // 但插入操作会改变 points，所以我们工作时不能保持 from 索引固定 —
  // 一会儿用"逐街从头扫"的方式重做这步。
  // 这里只用于 step 1 的相交计算，原 from 索引可以临时使用。
  fromIdx: number;
  a: XY;
  b: XY;
}

function rebuildSubsegs(): SubSeg[] {
  const list: SubSeg[] = [];
  for (const st of network.streets) {
    for (let i = 0; i < st.points.length - 1; i++) {
      list.push({
        street: st,
        fromIdx: i,
        a: toXY(st.points[i]),
        b: toXY(st.points[i + 1]),
      });
    }
  }
  return list;
}

// 线段相交：返回 (t1, t2, point)；t1/t2 ∈ (0,1) 才是真相交（不算端点）
function segIntersect(s1: SubSeg, s2: SubSeg): { t1: number; t2: number; p: XY } | null {
  const { a: p1, b: p2 } = s1;
  const { a: p3, b: p4 } = s2;
  const denom = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(denom) < 1e-9) return null; // 平行
  const t1 = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / denom;
  const t2 = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / denom;
  // 必须严格落在两条段内部 —— 端点重合的情况不需要再插入
  const EPS = 1e-4;
  if (t1 <= EPS || t1 >= 1 - EPS) return null;
  if (t2 <= EPS || t2 >= 1 - EPS) return null;
  const p: XY = {
    x: p1.x + t1 * (p2.x - p1.x),
    y: p1.y + t1 * (p2.y - p1.y),
  };
  return { t1, t2, p };
}

// 收集所有相交：每个 street 上要插入哪些 (insertAfterIdx, point) 对
type Insertion = { afterIdx: number; t: number; point: LL };
const pendingByStreet = new Map<StreetSegment, Insertion[]>();
function queueInsert(street: StreetSegment, afterIdx: number, t: number, p: XY) {
  const arr = pendingByStreet.get(street) ?? [];
  arr.push({ afterIdx, t, point: fromXY(p) });
  pendingByStreet.set(street, arr);
}

const subs = rebuildSubsegs();
let intersectionsFound = 0;
for (let i = 0; i < subs.length; i++) {
  for (let j = i + 1; j < subs.length; j++) {
    if (subs[i].street === subs[j].street) continue; // 同一条街内部交叉不处理
    const hit = segIntersect(subs[i], subs[j]);
    if (!hit) continue;
    queueInsert(subs[i].street, subs[i].fromIdx, hit.t1, hit.p);
    queueInsert(subs[j].street, subs[j].fromIdx, hit.t2, hit.p);
    intersectionsFound++;
  }
}

// 把每条街收到的插入操作按 (afterIdx, t) 倒序排，从后往前插入避免索引漂移
for (const [street, insertions] of pendingByStreet.entries()) {
  insertions.sort((a, b) => {
    if (a.afterIdx !== b.afterIdx) return b.afterIdx - a.afterIdx;
    return b.t - a.t;
  });
  for (const ins of insertions) {
    // 同位置可能多次插入相同坐标，去重
    const next = street.points[ins.afterIdx + 1];
    if (
      Math.abs(next.lat - ins.point.lat) < 1e-6 &&
      Math.abs(next.lng - ins.point.lng) < 1e-6
    ) {
      continue;
    }
    street.points.splice(ins.afterIdx + 1, 0, ins.point);
  }
}

// =====================================================================
// 步骤 2：端点贴边 —— 找到所有"度=1"的端点，吸附到最近的其他路段
// =====================================================================
// 重建子段（因为 step 1 改变了 points）
let allSubs = rebuildSubsegs();

// 端点列表：每条街的第一个点和最后一个点
interface Endpoint {
  street: StreetSegment;
  idx: number; // 0 或 points.length-1
  xy: XY;
}
function collectEndpoints(): Endpoint[] {
  const eps: Endpoint[] = [];
  for (const st of network.streets) {
    eps.push({ street: st, idx: 0, xy: toXY(st.points[0]) });
    eps.push({ street: st, idx: st.points.length - 1, xy: toXY(st.points[st.points.length - 1]) });
  }
  return eps;
}

// 点到线段的最近距离 + 垂足
function nearestOnSeg(p: XY, a: XY, b: XY): { d: number; pt: XY; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) {
    return { d: dist(p, a), pt: a, t: 0 };
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const pt = { x: a.x + t * dx, y: a.y + t * dy };
  return { d: dist(p, pt), pt, t };
}

let snapsApplied = 0;
const endpoints = collectEndpoints();
for (const ep of endpoints) {
  // 找最近的非本街子段
  let best: { d: number; pt: XY; t: number; seg: SubSeg } | null = null;
  for (const seg of allSubs) {
    if (seg.street === ep.street) continue;
    const r = nearestOnSeg(ep.xy, seg.a, seg.b);
    if (r.d > SNAP_TOL_M) continue;
    if (!best || r.d < best.d) best = { ...r, seg };
  }
  if (!best) continue;
  // 如果端点已经几乎在那条线段上（≤3m），不要硬拉，只在那条线段上插入对应点即可
  const target = best.pt;
  // 1) 把端点坐标拉到 target
  ep.street.points[ep.idx] = fromXY(target);
  // 2) 在 best.seg.street 的对应位置插入这个点（如果还不存在）
  const seg = best.seg;
  const segA = seg.street.points[seg.fromIdx];
  const segB = seg.street.points[seg.fromIdx + 1];
  const targetLL = fromXY(target);
  const closeToA = dist(toXY(segA), target) < SAME_POINT_TOL_M;
  const closeToB = dist(toXY(segB), target) < SAME_POINT_TOL_M;
  if (!closeToA && !closeToB) {
    seg.street.points.splice(seg.fromIdx + 1, 0, targetLL);
    // 注意：插入后会让 allSubs 的索引乱掉，所以下一轮重建
  }
  snapsApplied++;
  allSubs = rebuildSubsegs();
}

// =====================================================================
// 写回
// =====================================================================
network.fetchedAt = new Date().toISOString();
writeFileSync(PATH_IN, JSON.stringify(network, null, 2), "utf-8");

console.log("====== 路网修复 ======");
console.log(`插入交叉口节点: ${intersectionsFound} 处`);
console.log(`端点贴边: ${snapsApplied} 处 (容差 ${SNAP_TOL_M}m)`);
console.log(`原文件备份: ${PATH_BAK}`);
console.log(`输出: ${PATH_IN}`);
console.log("");
console.log("下一步：再跑一次 npx tsx scripts/auditStreetNetwork.ts 验证连通性。");
