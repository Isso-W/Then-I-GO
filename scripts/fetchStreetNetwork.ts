/**
 * 一次性脚本：用 Gemini 生成北京五道口模拟路网数据
 * 运行方式：npx tsx scripts/fetchStreetNetwork.ts
 * 输出文件：scripts/data/street-network.json
 *
 * 只需跑一次，结果 commit 进仓库，离线读取。
 * 原 Overpass API 方案因国内网络限制放弃，改为 AI 生成模拟数据（同 generatePOIs.ts 思路）。
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BBOX = {
  south: 39.980,
  west: 116.320,
  north: 40.005,
  east: 116.358,
};

export interface StreetSegment {
  name: string;
  nameEn: string;
  highway: string;
  points: { lat: number; lng: number }[];
}

export interface StreetNetwork {
  area: string;
  bbox: typeof BBOX;
  fetchedAt: string;
  totalStreets: number;
  namedStreets: number;
  streets: StreetSegment[];
}

const PROMPT = `
你是一个北京五道口区域的地理数据专家。请生成该区域的道路网络模拟数据。

区域范围：
- 纬度：${BBOX.south} ~ ${BBOX.north}（五道口地铁站为中心，北至清华北门，南至海淀桥）
- 经度：${BBOX.west} ~ ${BBOX.east}（东西各约 1km）

请生成 25~35 条道路，覆盖以下真实存在的主要街道及周边支路：
- 主路：成府路、中关村北大街、学院路、清华东路、五道口购物中心周边
- 次路：双清路、王庄路、华清嘉园周边路、荷清路
- 支路/胡同：五道口周边的居民区小路、清华园小路

每条道路用 4~8 个折线节点描述，节点坐标必须在 BBOX 范围内，且要符合实际走向（东西向/南北向/斜向）。

返回纯 JSON，格式如下，不要有任何多余文字：
{
  "streets": [
    {
      "name": "成府路",
      "nameEn": "Chengfu Road",
      "highway": "secondary",
      "points": [
        { "lat": 39.9923, "lng": 116.3201 },
        { "lat": 39.9923, "lng": 116.3280 },
        { "lat": 39.9921, "lng": 116.3350 },
        { "lat": 39.9920, "lng": 116.3579 }
      ]
    }
  ]
}

highway 类型只用：primary / secondary / tertiary / residential / pedestrian
无名小路 name 和 nameEn 填空字符串。
`;

async function generateStreetNetwork(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('请设置环境变量 GEMINI_API_KEY');

  console.log('正在用 Gemini 生成五道口路网模拟数据...');
  console.log(`范围: lat ${BBOX.south}~${BBOX.north}, lng ${BBOX.west}~${BBOX.east}\n`);

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: PROMPT,
  });

  const text = response.text ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Gemini 返回内容无法提取 JSON:\n${text}`);

  const parsed = JSON.parse(match[0]) as { streets: StreetSegment[] };
  const streets = parsed.streets;

  const namedStreets = streets.filter((s) => s.name).length;
  const byType: Record<string, number> = {};
  for (const s of streets) {
    byType[s.highway] = (byType[s.highway] ?? 0) + 1;
  }

  console.log(`共生成 ${streets.length} 条路段，其中有名称 ${namedStreets} 条`);
  console.log('按类型分布:');
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type.padEnd(16)} ${count}`);
  }

  const network: StreetNetwork = {
    area: '北京五道口',
    bbox: BBOX,
    fetchedAt: new Date().toISOString(),
    totalStreets: streets.length,
    namedStreets,
    streets,
  };

  const outDir = path.resolve(__dirname, 'data');
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'street-network.json');
  writeFileSync(outPath, JSON.stringify(network, null, 2), 'utf-8');

  console.log(`\n已保存到 ${outPath}`);

  const named = streets.filter((s) => s.name).slice(0, 5);
  console.log('\n有名称街道样本:');
  for (const s of named) {
    console.log(`  [${s.highway}] ${s.name} — ${s.points.length} 个节点`);
  }
}

generateStreetNetwork().catch((e) => {
  console.error('失败:', e);
  process.exit(1);
});
