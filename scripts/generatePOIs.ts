/**
 * 一次性脚本：用 Gemini 生成北京五道口的模拟 POI 数据（150 个）
 * 运行方式：npx tsx scripts/generatePOIs.ts
 * 输出文件：src/data/pois.json
 *
 * 分 3 批各生成 50 个，每批侧重不同类型，最后合并去重重编 id。
 */

import { GoogleGenAI } from "@google/genai";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const BBOX = { south: 39.980, west: 116.320, north: 40.005, east: 116.358 };

const BASE_CONTEXT = `
你是一个熟悉北京五道口区域的本地生活专家。五道口是海淀区高校聚集地，
紧邻清华大学、北京林业大学、北京语言大学，以年轻、文艺、多元文化著称。
代表性地标：五道口购物中心、优衣库、各类特色咖啡馆、书店、日韩料理。

地理约束（所有坐标必须在此范围内）：
- lat ${BBOX.south}~${BBOX.north}, lng ${BBOX.west}~${BBOX.east}
- 五道口地铁站：(39.9927, 116.3354)，购物中心在其南侧
- 清华大学南门：(40.0000, 116.3260)
- 成府路沿线 lat ≈ 39.992，中关村北大街沿线 lng ≈ 116.323
- 坐标要分散，不要扎堆

字段约束（严格遵守）：
- tags 只能用：art, outdoor, food, busy, family, photo, niche, budget, coffee
- mood_match 只能用：happy, tired, bored, relax, explore, hungry
- crowd_level 只能用：low, medium, high
- price_level：1=人均30以下, 2=人均30-80, 3=人均80-200, 4=人均200以上
- reviews 要真实，提到五道口特色（高校氛围、年轻人、骑车等）

严格返回 JSON 数组，不要有任何其他文字。
`;

const SCHEMA_EXAMPLE = `
[
  {
    "name": "店名",
    "category": "咖啡厅",
    "tags": ["coffee", "niche"],
    "area": "五道口",
    "address": "海淀区成府路XX号",
    "lat": 39.9920,
    "lng": 116.3354,
    "open_hours": "09:00-22:00",
    "avg_stay_minutes": 60,
    "avg_wait_minutes": 10,
    "crowd_level": "medium",
    "price_level": 2,
    "rating": 4.6,
    "review_summary": "一句话评价",
    "reviews": ["评论1", "评论2", "评论3"],
    "mood_match": ["relax", "explore"],
    "mbti_tags": ["内向", "文艺"],
    "best_time": "工作日下午"
  }
]`;

// 把 BBOX 切成 4 个象限，每批覆盖不同区域，避免扎堆
// NW: 清华/五道口核心  NE: 成府路东/荷清路  SW: 海淀桥/中关村北  SE: 学院路/地质大学
const BATCHES = [
  {
    label: "批次1：西北区（清华园/五道口核心）",
    focus: `
坐标范围严格限制：lat 39.992~40.005, lng 116.320~116.339（西北象限）
这片区域有：清华大学南门附近、五道口地铁站北侧、清华园路、双清路西段
生成 38 个 POI，类型：咖啡厅(8)、餐厅(8)、书店(5)、文创小店(5)、酒吧(4)、美术馆(4)、便利店(4)
所有 lat 必须在 39.992~40.005 之间，lng 必须在 116.320~116.339 之间。`,
  },
  {
    label: "批次2：东北区（成府路东/荷清路）",
    focus: `
坐标范围严格限制：lat 39.992~40.005, lng 116.339~116.358（东北象限）
这片区域有：成府路东段、荷清路、王庄路东段、北京林业大学附近、学院路北段
生成 38 个 POI，类型：餐厅-日韩料理(8)、咖啡厅(6)、奶茶甜品(5)、健身/瑜伽(4)、便利店(4)、公园绿地(4)、夜宵烧烤(4)、花店(3)
所有 lat 必须在 39.992~40.005 之间，lng 必须在 116.339~116.358 之间。`,
  },
  {
    label: "批次3：南部区（海淀桥/中关村北大街/学院路南）",
    focus: `
坐标范围严格限制：lat 39.980~39.992, lng 116.320~116.358（南半部）
这片区域有：中关村北大街南段、海淀桥附近、华清嘉园周边、学院路南段、成府路西段
生成 38 个 POI，类型：餐厅-北京风味(7)、餐厅-素食轻食(5)、咖啡厅(5)、共享空间/自习室(5)、酒吧清吧(4)、宠物友好咖啡(4)、洗衣生活服务(4)、livehouse(4)
所有 lat 必须在 39.980~39.992 之间，lng 必须在 116.320~116.358 之间。`,
  },
];

async function generateBatch(label: string, focus: string, retries = 5): Promise<object[]> {
  console.log(`\n正在生成 ${label}...`);
  const prompt = `${BASE_CONTEXT}\n${focus}\n\n返回格式示例：${SCHEMA_EXAMPLE}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: prompt,
        config: { temperature: 0.85 },
      });

      const text = response.text ?? "";
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error(`没找到 JSON 数组\n${text.slice(0, 300)}`);

      const pois = JSON.parse(match[0]);
      console.log(`  ✓ 得到 ${pois.length} 个`);
      return pois;
    } catch (e: any) {
      if (attempt < retries && e?.status === 503) {
        const wait = attempt * 15000;
        console.log(`  503 过载，${wait / 1000}s 后重试 (${attempt}/${retries})...`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw e;
      }
    }
  }
  return [];
}

async function main() {
  console.log("正在用 Gemini 分批生成五道口 POI 数据（目标 150 个）...");

  const allPois: object[] = [];
  for (const { label, focus } of BATCHES) {
    const batch = await generateBatch(label, focus);
    allPois.push(...batch);
  }

  // 按名称去重，重新编 id
  const seen = new Set<string>();
  const deduped = allPois
    .filter((p: any) => {
      if (seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    })
    .map((p: any, i) => ({ ...p, id: `poi_${String(i + 1).padStart(3, '0')}` }));

  // 过滤越界坐标
  const inBounds = deduped.filter((p: any) =>
    p.lat >= BBOX.south && p.lat <= BBOX.north &&
    p.lng >= BBOX.west  && p.lng <= BBOX.east
  );
  const dropped = deduped.length - inBounds.length;
  if (dropped > 0) console.warn(`\n⚠ 丢弃 ${dropped} 个越界 POI`);

  // 统计
  const byCategory: Record<string, number> = {};
  const byCrowd: Record<string, number> = {};
  for (const p of inBounds as any[]) {
    byCategory[p.category] = (byCategory[p.category] ?? 0) + 1;
    byCrowd[p.crowd_level] = (byCrowd[p.crowd_level] ?? 0) + 1;
  }
  console.log(`\n总计 ${inBounds.length} 个 POI（去重后）`);
  console.log("按类型：", byCategory);
  console.log("按客流：", byCrowd);

  const outputPath = resolve("src/data/pois.json");
  mkdirSync(resolve("src/data"), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(inBounds, null, 2), "utf-8");
  console.log(`\n已保存到 ${outputPath}`);
}

main().catch(console.error);
