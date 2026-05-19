/**
 * 一次性脚本：用 Gemini 生成上海静安区的模拟 POI 数据
 * 运行方式：npx tsx scripts/generatePOIs.ts
 * 输出文件：src/data/pois.json
 */

import { GoogleGenAI } from "@google/genai";
import { writeFileSync } from "fs";
import { resolve } from "path";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const prompt = `
你是一个熟悉上海静安区的本地生活专家。请生成 30 个真实风格的 POI（兴趣点）数据，
覆盖咖啡厅、书店、公园、美术馆、餐厅、小店等多种类型。

每个 POI 必须包含以下字段，严格返回 JSON 数组，不要有任何其他文字：

[
  {
    "id": "poi_001",
    "name": "地点名称（真实感，可以是虚构但合理的上海风格店名）",
    "category": "咖啡厅",
    "tags": ["art", "niche", "photo"],
    "area": "静安寺",
    "address": "静安区某路某号",
    "open_hours": "09:00-22:00",
    "avg_stay_minutes": 60,
    "avg_wait_minutes": 10,
    "crowd_level": "medium",
    "price_level": 2,
    "rating": 4.6,
    "review_summary": "一句话吸引人的评价摘要",
    "reviews": [
      "用户评论1，描述真实体验",
      "用户评论2，提到具体细节",
      "用户评论3，提到排队或环境"
    ],
    "mood_match": ["relax", "explore"],
    "mbti_tags": ["内向", "文艺", "慢节奏"],
    "best_time": "工作日下午，人少且光线好"
  }
]

要求：
- tags 只能用这些值：art, outdoor, food, busy, family, photo, niche, budget, coffee
- mood_match 只能用：happy, tired, bored, relax, explore, hungry
- crowd_level 只能用：low, medium, high
- price_level：1=人均30以下, 2=人均30-80, 3=人均80-200, 4=人均200以上
- avg_wait_minutes：热门店10-30分钟，冷门店0-5分钟
- avg_stay_minutes：咖啡厅45-90分钟，公园60-180分钟，书店30-60分钟，餐厅45-75分钟
- 30个 POI 要覆盖至少5种 category，覆盖 low/medium/high 三种 crowd_level
- reviews 要真实，要提到具体感受（等待时间、环境、食物、性价比等）
`;

async function main() {
  console.log("正在用 Gemini 生成 POI 数据...");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { temperature: 0.8 },
  });

  const text = response.text ?? "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("返回内容：", text);
    throw new Error("没找到 JSON 数组");
  }

  const pois = JSON.parse(jsonMatch[0]);
  console.log(`生成了 ${pois.length} 个 POI`);

  const outputPath = resolve("src/data/pois.json");
  writeFileSync(outputPath, JSON.stringify(pois, null, 2), "utf-8");
  console.log(`已保存到 ${outputPath}`);

  // 打印一条样本
  console.log("\n样本数据：");
  console.log(JSON.stringify(pois[0], null, 2));
}

main().catch(console.error);
