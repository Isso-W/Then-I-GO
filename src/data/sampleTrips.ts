import type { TripRecord } from "../types";

const today = new Date();
const day = (offset: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
};

export const SAMPLE_TRIPS: TripRecord[] = [
  {
    id: "sample-001",
    date: day(2),
    waypoints: [
      { name: "未名咖啡", emoji: "☕", lat: 40.003, lng: 116.347, visited: true, reaction: "🤩" },
      { name: "学府书吧", emoji: "📚", lat: 39.986, lng: 116.355, visited: true, reaction: "😎" },
      { name: "清华美院画廊", emoji: "🎨", lat: 39.999, lng: 116.332, visited: true },
      { name: "时光雕刻", emoji: "✨", lat: 39.992, lng: 116.334, visited: true, isHidden: true, reaction: "🤩" },
    ],
    branchChosen: 0,
    chatActions: [],
    distanceKm: 2.4,
    durationMin: 68,
    rewards: ["美团单车7天卡", "咖啡买一赠一券", "探索经验 +30", "隐藏奖励 +50 XP"],
    intensity: "normal",
    preferences: { mood: "explore", duration: "2h", transport: "walk", special: ["art", "niche"], foodPreference: ["coffee"], intensity: "normal", companion: "solo" },
    reaction: "🤩",
  },
  {
    id: "sample-002",
    date: day(5),
    waypoints: [
      { name: "韩国烤肉店", emoji: "🥩", lat: 39.993, lng: 116.348, visited: true, reaction: "😎" },
      { name: "五道营小酒馆", emoji: "🍺", lat: 39.993, lng: 116.347, visited: false, reaction: "💀" },
      { name: "五道口深夜食堂", emoji: "🍢", lat: 39.993, lng: 116.339, visited: false, isHidden: true },
    ],
    chatActions: ["skip_current"],
    distanceKm: 1.3,
    durationMin: 42,
    rewards: ["餐饮券8折"],
    intensity: "don't_think",
    preferences: { mood: "hungry", duration: "1h", transport: "walk", special: ["food", "busy"], foodPreference: ["spicy"], intensity: "don't_think", companion: "friends" },
    reaction: "😩",
  },
  {
    id: "sample-003",
    date: day(8),
    waypoints: [
      { name: "独立书吧", emoji: "📖", lat: 39.997, lng: 116.328, visited: true },
      { name: "小确幸咖啡", emoji: "☕", lat: 39.982, lng: 116.323, visited: true },
      { name: "复古屋", emoji: "🎭", lat: 40.002, lng: 116.336, visited: true, isHidden: true },
    ],
    branchChosen: 1,
    chatActions: [],
    distanceKm: 1.8,
    durationMin: 55,
    rewards: ["限定徽章", "咖啡券", "隐藏奖励 +50 XP"],
    intensity: "normal",
    preferences: { mood: "relax", duration: "1h", transport: "walk", special: ["art", "niche"], foodPreference: ["coffee"], intensity: "normal", companion: "couple" },
    reaction: "😎",
  },
];
