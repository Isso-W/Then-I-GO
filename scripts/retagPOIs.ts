/**
 * 一次性脚本：按品类 + 属性重标所有 POI 的 tags。
 * 7 个标签：art / outdoor / food / busy / photo / niche / budget
 * 每个 POI 分配 2-3 个，确保每个标签覆盖 15-40%。
 * 运行：npx tsx scripts/retagPOIs.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const POIS_PATH = resolve(__dirname, "../src/data/pois.json");

interface POI {
  id: string;
  name: string;
  category: string;
  tags: string[];
  price_level: number;
  crowd_level: string;
  rating: number;
  [k: string]: any;
}

type Tag = "art" | "outdoor" | "food" | "busy" | "photo" | "niche" | "budget";

const CATEGORY_TAGS: Record<string, Tag[]> = {
  "咖啡厅":         ["art", "photo"],
  "宠物友好咖啡":   ["niche", "photo"],
  "书店":           ["art", "niche"],
  "文创小店":       ["art", "photo", "niche"],
  "美术馆":         ["art", "photo"],
  "花店":           ["art", "photo"],
  "餐厅":           ["food"],
  "餐厅-北京风味":  ["food"],
  "餐厅-东北菜":    ["food"],
  "餐厅-日韩料理":  ["food"],
  "餐厅-火锅":      ["food", "busy"],
  "餐厅-素食轻食":  ["food"],
  "餐厅-小吃":      ["food", "budget"],
  "美食城":         ["food", "budget"],
  "美食街":         ["food", "busy"],
  "夜宵烧烤":       ["food", "busy"],
  "奶茶甜品":       ["food", "photo"],
  "酒吧":           ["busy", "niche"],
  "酒吧清吧":       ["art", "niche"],
  "livehouse":       ["busy", "niche"],
  "夜店":           ["busy"],
  "公园绿地":       ["outdoor", "photo"],
  "景点/地标":      ["outdoor", "photo"],
  "健身/瑜伽":      ["outdoor"],
  "运动娱乐":       ["outdoor", "busy"],
  "电影院":         ["busy"],
  "KTV":            ["busy"],
  "台球/棋牌":      ["busy", "budget"],
  "桌游/密室":      ["busy", "niche"],
  "电竞/网咖":      ["busy", "budget"],
  "共享空间/自习室": ["niche", "budget"],
};

function retagPOI(poi: POI): Tag[] {
  const baseTags = new Set<Tag>(CATEGORY_TAGS[poi.category] ?? ["niche"]);

  if (poi.price_level === 1) baseTags.add("budget");
  if (poi.crowd_level === "high") baseTags.add("busy");
  if (poi.rating >= 4.6) baseTags.add("photo");
  if (poi.crowd_level === "low" && !baseTags.has("busy")) baseTags.add("niche");
  if (/公园|绿地|景点|地标|花|健身|瑜伽|运动|骑行|散步/.test(poi.name + poi.category)) baseTags.add("outdoor");

  const tags = [...baseTags];
  if (tags.length > 3) return tags.slice(0, 3);
  return tags;
}

function main() {
  const pois: POI[] = JSON.parse(readFileSync(POIS_PATH, "utf-8"));

  for (const poi of pois) {
    poi.tags = retagPOI(poi);
  }

  const tagCounts: Record<string, number> = {};
  for (const poi of pois) {
    for (const t of poi.tags) {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
  }

  console.log(`\n  POI 总数: ${pois.length}\n`);
  console.log("  标签覆盖:");
  for (const [tag, count] of Object.entries(tagCounts).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / pois.length) * 100).toFixed(0);
    const bar = "█".repeat(Math.round(count / pois.length * 30));
    console.log(`    ${tag.padEnd(8)} ${String(count).padStart(3)} (${pct.padStart(2)}%)  ${bar}`);
  }

  writeFileSync(POIS_PATH, JSON.stringify(pois, null, 2) + "\n", "utf-8");
  console.log(`\n  ✅ 已写入 ${POIS_PATH}`);
}

main();
