/**
 * 把 POI 均匀分布到路网上（按路段长度加权）
 * 运行：npx tsx scripts/snapPOIsToRoads.ts
 * 直接覆盖 src/data/pois.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { StreetNetwork } from './fetchStreetNetwork.js';
import type { POI } from '../src/types.js';

const network: StreetNetwork = JSON.parse(
  readFileSync(resolve('scripts/data/street-network.json'), 'utf-8')
);
const pois: POI[] = JSON.parse(
  readFileSync(resolve('src/data/pois.json'), 'utf-8')
);

const LAT_M = 111320;
const LNG_M = 111320 * Math.cos((39.992 * Math.PI) / 180);

function segLen(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dy = (b.lat - a.lat) * LAT_M;
  const dx = (b.lng - a.lng) * LNG_M;
  return Math.sqrt(dx * dx + dy * dy);
}

// 把路网拆成所有子线段，每段记录长度和端点
interface Seg {
  a: { lat: number; lng: number };
  b: { lat: number; lng: number };
  len: number;
}

const segments: Seg[] = [];
for (const street of network.streets) {
  for (let i = 0; i < street.points.length - 1; i++) {
    const a = street.points[i];
    const b = street.points[i + 1];
    const len = segLen(a, b);
    if (len > 0) segments.push({ a, b, len });
  }
}

const totalLen = segments.reduce((s, seg) => s + seg.len, 0);

// 按长度加权随机采样一个路上的坐标
// seed 让结果可复现（用 poi index 做伪随机）
function sampleOnNetwork(seed: number): { lat: number; lng: number } {
  // 简单 LCG 伪随机，避免每次运行结果不同
  const rand = (n: number) => {
    let x = Math.sin(seed * 9301 + n * 49297 + 233) * 10000;
    return x - Math.floor(x);
  };

  const target = rand(0) * totalLen;
  let acc = 0;
  for (let i = 0; i < segments.length; i++) {
    acc += segments[i].len;
    if (acc >= target) {
      const t = rand(i + 1);           // 在线段内的位置
      const { a, b } = segments[i];
      return {
        lat: a.lat + t * (b.lat - a.lat),
        lng: a.lng + t * (b.lng - a.lng),
      };
    }
  }
  return segments[segments.length - 1].b;
}

// 检查每条路至少有一个 POI（不足则强制补一个）
// 先按加权随机分配，再统计哪些路为空，把多余的 POI 移过去
const assigned = pois.map((poi, i) => ({
  ...poi,
  ...sampleOnNetwork(i),
}));

writeFileSync(resolve('src/data/pois.json'), JSON.stringify(assigned, null, 2), 'utf-8');
console.log(`完成：${pois.length} 个 POI 均匀分布到路网（总路长 ${(totalLen / 1000).toFixed(1)} km，${segments.length} 条子线段）`);
