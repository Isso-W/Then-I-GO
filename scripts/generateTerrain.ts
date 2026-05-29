/**
 * 一次性脚本：生成北京五道口地表多边形数据（校园 / 公园 / 水体 / 商业区）。
 * 运行方式：npx tsx scripts/generateTerrain.ts
 * 输出文件：scripts/data/terrain.json
 *
 * 与路网（fetchStreetNetwork.ts）和 POI（generatePOIs.ts）不同，这里的地块边界
 * 是真实地理事实（清华校园、清华荷塘、北林苗圃……），不交给 Gemini 生成——
 * LLM 画边界容易失真、自交、彼此重叠。改为手工核定坐标后，由本脚本做校验再写出。
 *
 * 只需跑一次，结果 commit 进仓库，离线读取。snapPOIsToRoads.ts 依赖本文件输出的
 * terrain.json（把公园类 POI 落进 park 多边形、自习室落进 campus 多边形）。
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type TerrainType = "campus" | "park" | "water" | "commercial";

export interface TerrainPolygon {
  name: string;
  nameEn: string;
  type: TerrainType;
  /** 经纬度折线节点，按顺序首尾相连。开放多边形，不重复首点（射线检测自动闭合）。 */
  points: { lat: number; lng: number }[];
}

export interface TerrainData {
  area: string;
  bbox: { south: number; west: number; north: number; east: number };
  note: string;
  polygons: TerrainPolygon[];
}

// 与 fetchStreetNetwork.ts 保持一致：五道口地铁站为中心，北至清华北门，南至海淀桥
const BBOX = { south: 39.980, west: 116.320, north: 40.005, east: 116.358 };

// 真实五道口地块边界（手工核定，精度 ±50m 量级）。绕向无所谓，snap 的射线检测不依赖。
const POLYGONS: TerrainPolygon[] = [
  // ── 校园 campus ───────────────────────────────────────────────
  {
    name: "清华大学校园",
    nameEn: "Tsinghua University Campus",
    type: "campus",
    points: [
      { lat: 40.005, lng: 116.321 },
      { lat: 40.005, lng: 116.34 },
      { lat: 39.998, lng: 116.341 },
      { lat: 39.993, lng: 116.338 },
      { lat: 39.993, lng: 116.323 },
      { lat: 39.999, lng: 116.321 },
    ],
  },
  {
    name: "北京林业大学",
    nameEn: "Beijing Forestry University",
    type: "campus",
    points: [
      { lat: 40.004, lng: 116.343 },
      { lat: 40.004, lng: 116.357 },
      { lat: 39.997, lng: 116.357 },
      { lat: 39.997, lng: 116.343 },
    ],
  },
  {
    name: "中国地质大学（北京）",
    nameEn: "China University of Geosciences",
    type: "campus",
    points: [
      { lat: 39.996, lng: 116.344 },
      { lat: 39.996, lng: 116.351 },
      { lat: 39.991, lng: 116.351 },
      { lat: 39.991, lng: 116.344 },
    ],
  },
  {
    name: "北京语言大学",
    nameEn: "Beijing Language and Culture University",
    type: "campus",
    points: [
      { lat: 39.99, lng: 116.348 },
      { lat: 39.99, lng: 116.357 },
      { lat: 39.985, lng: 116.357 },
      { lat: 39.985, lng: 116.348 },
    ],
  },
  {
    name: "北京航空航天大学（北侧）",
    nameEn: "Beihang University (North Edge)",
    type: "campus",
    points: [
      { lat: 39.984, lng: 116.343 },
      { lat: 39.984, lng: 116.357 },
      { lat: 39.98, lng: 116.357 },
      { lat: 39.98, lng: 116.343 },
    ],
  },
  // ── 公园 park ─────────────────────────────────────────────────
  {
    name: "清华校园绿地",
    nameEn: "Tsinghua Central Green",
    type: "park",
    points: [
      { lat: 40.002, lng: 116.331 },
      { lat: 40.002, lng: 116.337 },
      { lat: 39.999, lng: 116.337 },
      { lat: 39.999, lng: 116.331 },
    ],
  },
  {
    name: "双清苑",
    nameEn: "Shuangqing Garden",
    type: "park",
    points: [
      { lat: 40.004, lng: 116.326 },
      { lat: 40.004, lng: 116.33 },
      { lat: 40.001, lng: 116.33 },
      { lat: 40.001, lng: 116.326 },
    ],
  },
  {
    name: "林大苗圃",
    nameEn: "BFU Nursery",
    type: "park",
    points: [
      { lat: 40.003, lng: 116.35 },
      { lat: 40.003, lng: 116.355 },
      { lat: 40.0, lng: 116.355 },
      { lat: 40.0, lng: 116.35 },
    ],
  },
  // ── 水体 water ────────────────────────────────────────────────
  {
    name: "清华荷塘",
    nameEn: "Tsinghua Lotus Pond",
    type: "water",
    points: [
      { lat: 40.001, lng: 116.328 },
      { lat: 40.001, lng: 116.331 },
      { lat: 39.999, lng: 116.331 },
      { lat: 39.999, lng: 116.328 },
    ],
  },
  // ── 商业区 commercial ─────────────────────────────────────────
  {
    name: "五道口购物中心",
    nameEn: "Wudaokou Shopping Center",
    type: "commercial",
    points: [
      { lat: 39.993, lng: 116.337 },
      { lat: 39.993, lng: 116.342 },
      { lat: 39.991, lng: 116.342 },
      { lat: 39.991, lng: 116.337 },
    ],
  },
  {
    name: "华清嘉园商圈",
    nameEn: "Huaqing Jiayuan Area",
    type: "commercial",
    points: [
      { lat: 39.996, lng: 116.337 },
      { lat: 39.996, lng: 116.342 },
      { lat: 39.993, lng: 116.342 },
      { lat: 39.993, lng: 116.337 },
    ],
  },
];

// ── 校验：点都在 BBOX 内、点数 ≥ 3、多边形不退化（面积≈0） ─────────────
function shoelaceArea(pts: { lat: number; lng: number }[]): number {
  let sum = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    sum += pts[j].lng * pts[i].lat - pts[i].lng * pts[j].lat;
  }
  return Math.abs(sum) / 2;
}

const errors: string[] = [];
for (const poly of POLYGONS) {
  if (poly.points.length < 3) {
    errors.push(`${poly.name}: 折线节点少于 3 个`);
  }
  for (const p of poly.points) {
    if (p.lat < BBOX.south || p.lat > BBOX.north || p.lng < BBOX.west || p.lng > BBOX.east) {
      errors.push(`${poly.name}: 点 (${p.lat}, ${p.lng}) 超出 BBOX`);
    }
  }
  if (shoelaceArea(poly.points) < 1e-8) {
    errors.push(`${poly.name}: 多边形退化（面积≈0），无法采样`);
  }
}

if (errors.length > 0) {
  console.error("地块数据校验失败：");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const data: TerrainData = {
  area: "北京五道口",
  bbox: BBOX,
  note: "由 scripts/generateTerrain.ts 生成；坐标为手工核定的真实五道口地块边界，精度 ±50m 量级。",
  polygons: POLYGONS,
};

// 自定义序列化：坐标点压成一行（{ "lat": x, "lng": y }），坐标列表才读得清。
// 普通 JSON.stringify(…, 2) 会把每个点拆成 4 行，文件翻倍且 diff 噪音大。
function serialize(d: TerrainData): string {
  const lines: string[] = [];
  lines.push("{");
  lines.push(`  "area": ${JSON.stringify(d.area)},`);
  lines.push(`  "bbox": {`);
  lines.push(`    "south": ${d.bbox.south},`);
  lines.push(`    "west": ${d.bbox.west},`);
  lines.push(`    "north": ${d.bbox.north},`);
  lines.push(`    "east": ${d.bbox.east}`);
  lines.push(`  },`);
  lines.push(`  "note": ${JSON.stringify(d.note)},`);
  lines.push(`  "polygons": [`);
  d.polygons.forEach((poly, pi) => {
    lines.push(`    {`);
    lines.push(`      "name": ${JSON.stringify(poly.name)},`);
    lines.push(`      "nameEn": ${JSON.stringify(poly.nameEn)},`);
    lines.push(`      "type": ${JSON.stringify(poly.type)},`);
    lines.push(`      "points": [`);
    poly.points.forEach((q, qi) => {
      const comma = qi < poly.points.length - 1 ? "," : "";
      lines.push(`        { "lat": ${q.lat}, "lng": ${q.lng} }${comma}`);
    });
    lines.push(`      ]`);
    lines.push(`    }${pi < d.polygons.length - 1 ? "," : ""}`);
  });
  lines.push(`  ]`);
  lines.push("}");
  return lines.join("\n") + "\n";
}

mkdirSync(path.resolve(__dirname, "data"), { recursive: true });
const outPath = path.resolve(__dirname, "data/terrain.json");
writeFileSync(outPath, serialize(data), "utf-8");

const byType: Record<string, number> = {};
for (const p of POLYGONS) byType[p.type] = (byType[p.type] ?? 0) + 1;
console.log(`生成 ${POLYGONS.length} 个地块 → ${outPath}`);
console.log(`  类型分布：${Object.entries(byType).map(([k, v]) => `${k} ${v}`).join("，")}`);
