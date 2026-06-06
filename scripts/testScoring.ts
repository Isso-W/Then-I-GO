/**
 * 模拟几种典型偏好，输出 top 10 候选 + 评分明细
 * 运行：npx tsx scripts/testScoring.ts
 */
import { filterCandidates, scorePOI, extractVisitedNames, ORIGIN, distanceMeters } from "../src/agents/poiFilter";
import type { UserPreferences, TripRecord } from "../src/types";

const scenarios: { label: string; prefs: UserPreferences; history?: TripRecord[] }[] = [
  {
    label: "🎨 文艺情侣·1h·想拍照",
    prefs: { mood: "relax", duration: "1h", transport: "walk", special: ["art", "photo"], foodPreference: [], intensity: "normal", companion: "couple" },
  },
  {
    label: "🔥 朋友聚会·2h·美食+热闹",
    prefs: { mood: "explore", duration: "2h", transport: "walk", special: ["food", "busy"], foodPreference: ["spicy"], intensity: "normal", companion: "friends" },
  },
  {
    label: "💰 一个人·30min·省钱小众",
    prefs: { mood: "bored", duration: "30min", transport: "walk", special: ["budget", "niche"], foodPreference: [], intensity: "don't_think", companion: "solo" },
  },
  {
    label: "👨‍👩‍👧 亲子户外·半天",
    prefs: { mood: "happy", duration: "half_day", transport: "walk", special: ["outdoor"], foodPreference: ["light"], intensity: "normal", companion: "family" },
  },
  {
    label: "🧠 别让我思考·半天（带历史）",
    prefs: { mood: "explore", duration: "half_day", transport: "walk", special: ["art", "photo"], foodPreference: [], intensity: "don't_think", companion: "solo" },
    history: [{
      id: "t0", date: "2026-06-03",
      waypoints: [
        { name: "挪瓦咖啡", emoji: "☕", lat: 0, lng: 0, visited: true },
        { name: "万圣书园", emoji: "📚", lat: 0, lng: 0, visited: true },
        { name: "彼岸花书店", emoji: "📖", lat: 0, lng: 0, visited: true },
        { name: "清华二校门", emoji: "🏛️", lat: 0, lng: 0, visited: true },
        { name: "星辰咖啡", emoji: "☕", lat: 0, lng: 0, visited: true },
      ],
      chatActions: [], distanceKm: 3, durationMin: 120,
      rewards: [], intensity: "don't_think",
      preferences: { mood: "explore", duration: "half_day", transport: "walk", special: ["art"], foodPreference: [], intensity: "don't_think", companion: "solo" },
    }],
  },
  {
    label: "🎯 正常探索·半天（同样历史，对比）",
    prefs: { mood: "explore", duration: "half_day", transport: "walk", special: ["art", "photo"], foodPreference: [], intensity: "normal", companion: "solo" },
    history: [{
      id: "t0", date: "2026-06-03",
      waypoints: [
        { name: "挪瓦咖啡", emoji: "☕", lat: 0, lng: 0, visited: true },
        { name: "万圣书园", emoji: "📚", lat: 0, lng: 0, visited: true },
        { name: "彼岸花书店", emoji: "📖", lat: 0, lng: 0, visited: true },
        { name: "清华二校门", emoji: "🏛️", lat: 0, lng: 0, visited: true },
        { name: "星辰咖啡", emoji: "☕", lat: 0, lng: 0, visited: true },
      ],
      chatActions: [], distanceKm: 3, durationMin: 120,
      rewards: [], intensity: "normal",
      preferences: { mood: "explore", duration: "half_day", transport: "walk", special: ["art"], foodPreference: [], intensity: "normal", companion: "solo" },
    }],
  },
  {
    label: "🎨 文艺情侣·1h（带历史，去过咖啡厅和书店）",
    prefs: { mood: "relax", duration: "1h", transport: "walk", special: ["art", "photo"], foodPreference: [], intensity: "normal", companion: "couple" },
    history: [{
      id: "t1", date: "2026-06-01",
      waypoints: [
        { name: "挪瓦咖啡", emoji: "☕", lat: 0, lng: 0, visited: true },
        { name: "万圣书园", emoji: "📚", lat: 0, lng: 0, visited: true },
        { name: "彼岸花书店", emoji: "📖", lat: 0, lng: 0, visited: true },
      ],
      chatActions: [], distanceKm: 2, durationMin: 50,
      rewards: [], intensity: "normal",
      preferences: { mood: "relax", duration: "1h", transport: "walk", special: ["art"], foodPreference: [], intensity: "normal", companion: "couple" },
    }],
  },
];

for (const { label, prefs, history } of scenarios) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(label);
  console.log(`${"═".repeat(60)}`);

  const candidates = filterCandidates(prefs, new Date("2026-06-05T14:00:00"), undefined, history ?? []);
  const visitedNames = extractVisitedNames(history ?? []);

  for (const [i, poi] of candidates.entries()) {
    const dist = Math.round(distanceMeters(ORIGIN, { lat: poi.lat, lng: poi.lng }));
    const score = scorePOI(poi, prefs, visitedNames);
    const visited = visitedNames.has(poi.name) ? " ⚠️去过" : "";
    console.log(
      `  ${String(i + 1).padStart(2)}. [${score.toFixed(2)}] ${poi.name}（${poi.category}）` +
      `  🏷️${poi.tags.join(",")}  ⏳等${poi.avg_wait_minutes}min  🕐停${poi.avg_stay_minutes}min  📍${dist}m  ⭐${poi.rating}${visited}`
    );
  }
  console.log(`  → 共 ${candidates.length} 个候选`);
}
