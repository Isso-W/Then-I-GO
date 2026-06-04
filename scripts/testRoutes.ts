/**
 * 测试脚本：用 20 种不同偏好组合生成路线，记录结果。
 * 运行：需要 GEMINI_API_KEY（从 .env.local 读取或环境变量）
 * npx tsx scripts/testRoutes.ts
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const _origFetch = globalThis.fetch;
globalThis.fetch = async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input?.url ?? "";
  if (url === "/api/generate") {
    const body = JSON.parse(init?.body ?? "{}");
    const resp = await ai.models.generateContent({ model: body.model, contents: body.prompt });
    const text = resp.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
    return new Response(JSON.stringify({ text }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return _origFetch(input, init);
};

import { generateRoute } from "../src/agents/routeAgent";
import { filterCandidates } from "../src/agents/poiFilter";
import type { UserPreferences } from "../src/types";

interface TestCase {
  label: string;
  prefs: UserPreferences;
}

const CASES: TestCase[] = [
  // 不同时长
  { label: "① 30min·文艺·独自",        prefs: { mood: "relax", duration: "30min", transport: "walk", special: ["art"], foodPreference: [], intensity: "normal", companion: "solo" } },
  { label: "② 1h·美食·朋友",            prefs: { mood: "hungry", duration: "1h", transport: "walk", special: ["food"], foodPreference: ["spicy"], intensity: "normal", companion: "friends" } },
  { label: "③ 2h·户外·情侣",            prefs: { mood: "relax", duration: "2h", transport: "walk", special: ["outdoor"], foodPreference: [], intensity: "normal", companion: "couple" } },
  { label: "④ 半天·小众·独自",           prefs: { mood: "explore", duration: "half_day", transport: "walk", special: ["niche"], foodPreference: [], intensity: "don't_think", companion: "solo" } },

  // 不同 special 标签
  { label: "⑤ 拍照控",                  prefs: { mood: "happy", duration: "1h", transport: "walk", special: ["photo"], foodPreference: [], intensity: "normal", companion: "solo" } },
  { label: "⑥ 热闹夜生活",              prefs: { mood: "explore", duration: "2h", transport: "walk", special: ["busy"], foodPreference: [], intensity: "normal", companion: "friends" } },
  { label: "⑦ 省钱学生党",              prefs: { mood: "bored", duration: "1h", transport: "walk", special: ["budget"], foodPreference: ["light"], intensity: "don't_think", companion: "solo" } },
  { label: "⑧ 文艺+拍照",              prefs: { mood: "relax", duration: "1h", transport: "walk", special: ["art", "photo"], foodPreference: [], intensity: "normal", companion: "couple" } },
  { label: "⑨ 美食+热闹",              prefs: { mood: "hungry", duration: "2h", transport: "walk", special: ["food", "busy"], foodPreference: ["spicy"], intensity: "normal", companion: "friends" } },
  { label: "⑩ 户外+小众",              prefs: { mood: "explore", duration: "2h", transport: "walk", special: ["outdoor", "niche"], foodPreference: [], intensity: "normal", companion: "solo" } },

  // 不同 mood
  { label: "⑪ 疲惫·咖啡甜品",          prefs: { mood: "tired", duration: "30min", transport: "walk", special: ["art"], foodPreference: ["coffee"], intensity: "don't_think", companion: "solo" } },
  { label: "⑫ 无聊·随机探索",           prefs: { mood: "bored", duration: "1h", transport: "walk", special: [], foodPreference: [], intensity: "don't_think", companion: "solo" } },
  { label: "⑬ 开心·全都要",             prefs: { mood: "happy", duration: "half_day", transport: "walk", special: ["food", "photo", "art"], foodPreference: [], intensity: "normal", companion: "friends" } },

  // 不同 companion
  { label: "⑭ 家庭出游·半天",           prefs: { mood: "happy", duration: "half_day", transport: "walk", special: ["outdoor", "food"], foodPreference: [], intensity: "normal", companion: "family" } },
  { label: "⑮ 情侣约会·文艺",           prefs: { mood: "relax", duration: "2h", transport: "walk", special: ["art", "niche"], foodPreference: ["coffee"], intensity: "normal", companion: "couple" } },

  // 不同 food preference
  { label: "⑯ 清淡素食控",              prefs: { mood: "relax", duration: "1h", transport: "walk", special: ["food"], foodPreference: ["light"], intensity: "normal", companion: "solo" } },
  { label: "⑰ 麻辣重口",               prefs: { mood: "hungry", duration: "1h", transport: "walk", special: ["food", "busy"], foodPreference: ["spicy"], intensity: "normal", companion: "friends" } },
  { label: "⑱ 西式brunch",             prefs: { mood: "happy", duration: "1h", transport: "walk", special: ["photo", "food"], foodPreference: ["western"], intensity: "normal", companion: "couple" } },

  // 极端情况
  { label: "⑲ 无偏好·别让我想",         prefs: { mood: "bored", duration: "1h", transport: "walk", special: [], foodPreference: [], intensity: "don't_think", companion: "solo" } },
  { label: "⑳ 全标签·半天",             prefs: { mood: "explore", duration: "half_day", transport: "walk", special: ["art", "outdoor", "food", "busy", "photo", "niche", "budget"], foodPreference: ["spicy", "coffee"], intensity: "normal", companion: "friends" } },
];

async function main() {
  console.log("=" .repeat(80));
  console.log("路线生成测试（20 组偏好）");
  console.log("=".repeat(80));

  const results: string[] = [];
  let pass = 0;
  let fail = 0;

  for (const tc of CASES) {
    const candidates = filterCandidates(tc.prefs);
    const catSet = new Set(candidates.map((p) => p.category));

    process.stdout.write(`\n${tc.label}  候选 ${candidates.length} 个 / ${catSet.size} 品类 → `);

    try {
      const route = await generateRoute(tc.prefs);
      const wps = route.waypoints.map((w) => `${w.emoji} ${w.name}`);
      const cats = route.waypoints.map((w) => w.category ?? "?");
      const hidden = route.hiddenTask ? `${route.hiddenTask.emoji} ${route.hiddenTask.name}` : "无";
      const branch = route.branch ? `${route.branch.options[0].name} vs ${route.branch.options[1].name}` : "无";
      const uniqueCats = new Set(cats).size;

      const line = [
        `  标题: ${route.title}`,
        `  站点(${wps.length}): ${wps.join(" → ")}`,
        `  品类: ${cats.join(" / ")}  (${uniqueCats} 种)`,
        `  隐藏: ${hidden}`,
        `  岔路: ${branch}`,
      ].join("\n");

      console.log(`✅ ${wps.length} 站`);
      console.log(line);
      results.push(`${tc.label}\n${line}`);
      pass++;
    } catch (e: any) {
      console.log(`❌ ${e.message}`);
      results.push(`${tc.label}  ❌ ${e.message}`);
      fail++;
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log(`结果: ${pass} 通过 / ${fail} 失败 / ${CASES.length} 总计`);
  console.log("=".repeat(80));
}

main().catch((e) => { console.error("脚本错误:", e); process.exit(1); });
