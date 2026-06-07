import type { ReactNode } from 'react';

export type ScreenType = 'onboarding' | 'explore' | 'story' | 'bag' | 'mine' | 'event' | 'settings';

// 冷启动收集的长期属性。持久化到 localStorage 的 userProfile 键。
// mbti / interests 都可以为 null/[]（用户跳过）；只要 completedAt 存在就不再展示 onboarding。
export interface UserProfile {
  mbti: string | null;
  interests: string[];
  completedAt: number;
  avatar?: string;
  name?: string;
  gender?: 'male' | 'female' | 'other' | null;
}

export type ExploreStep =
  | "intro"
  | "preference_selection"
  | "gear_confirmation"
  | "initial"
  | "checkin_initial"
  | "hidden_found"
  | "hidden_active"
  | "checkin_hidden"
  | "reward_hidden"
  | "next_objective"
  | "checkin_next"
  | "achievement_unlock";

export interface Coupon {
  title: string;
  desc: string;
  date: string;
  amount: string;
  icon: ReactNode;
  color: string;
  tag?: string;
  image?: string;
}

export interface TimelineItemData {
  time: string;
  title: string;
  desc: string;
  icon: ReactNode;
  img: string;
  recorded?: boolean;
}

// 用户在偏好页面填写的信息
export interface UserPreferences {
  mood: string;
  duration: string;
  transport: string;
  special: string[];
  foodPreference: string[];
  intensity: string;
  companion: string;
}

// AI 生成的单个打卡点
export interface Waypoint {
  name: string;         // 地点名称，如"转角咖啡馆"
  description: string;  // 故事背景，如"藏着这条街十年前的秘密"
  task: string;         // 打卡任务提示，如"找到窗边的那把椅子"
  reward: string;       // 奖励描述，如"美团单车7天畅骑卡"
  emoji: string;        // 地图上显示的图标，如"☕"
  distanceText: string; // 距离描述，如"步行约8分钟"
  lat: number;          // 真实坐标，地图组件用
  lng: number;
  category?: string;    // POI 品类，如"咖啡厅"，用于匹配品类插图
}

// AI 生成的完整路线
export interface GeneratedRoute {
  title: string;        // 今日路线标题，如"五道口的隐秘下午"
  waypoints: Waypoint[];
  hiddenTask?: Waypoint;        // 隐藏任务：不在主线里的真实 POI，Gemini 生成故事/任务/奖励
}

// ── Vlog 生成 ──────────────────────────────────────────────
// 三种成片风格（对应 CLAUDE.md「Planned → Vlog style selection」）
export type VlogStyle = "cyberpunk" | "retro" | "fresh";

// 一个分镜：对应今日路线里的一个站点，AI 写一句旁白 + 一句字幕
export interface VlogScene {
  caption: string;      // 画面字幕（短，<=10字），如"暮色降临"
  narration: string;    // 旁白（一句话，<=25字），播放时滚动显示
  emoji: string;        // 这一幕的代表 emoji
  frame: string;        // B-roll 图片路径（前端按站点关键词从占位图里挑，非 AI 决定）
  durationSec: number;  // 这一幕停留秒数（2~4），驱动播放器自动推进
}

// 路线回放几何：由 StoryScreen 从 generatedRoute 沿街寻路算出（无 AI）。
// 站点与 scenes 一一对应（scenes[i] ↔ stops[i]）。sample 日期无真实路线时为空。
export interface VlogGeoStop {
  lat: number;
  lng: number;
  emoji: string;
  name: string;
  reward: string;
}
export interface VlogGeo {
  fullPath: { lat: number; lng: number }[];   // ORIGIN→…→末站，沿街完整折线（画底线）
  legs: { lat: number; lng: number }[][];      // legs[i]：上一站→stops[i]，驱动小人逐段走
  stops: VlogGeoStop[];
  distanceKm: number;
  walkMin: number;
}

// AI 生成的一支完整 Vlog 脚本
export interface GeneratedVlog {
  id: string;
  title: string;        // Vlog 标题，如"五道口的黄昏漫游"
  style: VlogStyle;
  scenes: VlogScene[];
  bgm: string;          // BGM 情绪描述，如"慵懒 Lo-fi · 90 BPM"
  shareCaption: string; // 分享文案（含话题标签）
  verdict: string;      // 人格化总结金句（战报卡用），如"今天你是个 City Walker"
  geo?: VlogGeo;        // 路线回放几何（有真实路线时才有）
  createdAt: number;    // 生成时间戳
}

// ── 历史记录 ──────────────────────────────────────────────
export interface TripRecord {
  id: string;
  date: string;
  waypoints: {
    name: string;
    emoji: string;
    lat: number;
    lng: number;
    visited: boolean;
    isHidden?: boolean;
    reaction?: string;
  }[];
  chatActions: string[];
  distanceKm: number;
  durationMin: number;
  rewards: string[];
  intensity: string;
  preferences: UserPreferences;
  reaction?: string;
  feedback?: string;
}

// POI 数据库里的一条记录
export interface POI {
  id: string;
  name: string;
  category: string;                   // 咖啡厅 / 书店 / 公园 / 美术馆 …
  tags: string[];                     // 对应 UserPreferences 里的 special 标签
  area: string;                       // 所在商圈，如"五道口"
  address: string;
  lat: number;                        // 纬度
  lng: number;                        // 经度
  open_hours: string;                 // "09:00-22:00"
  avg_stay_minutes: number;           // 平均停留时长
  avg_wait_minutes: number;           // 平均排队时长
  crowd_level: "low" | "medium" | "high";
  price_level: 1 | 2 | 3 | 4;        // 人均消费档次
  rating: number;                     // 4.2
  review_summary: string;             // 一句话评价摘要
  reviews: string[];                  // 模拟用户评论（3条左右）
  mood_match: string[];               // 适合哪些心情
  mbti_tags: string[];                // 适合哪类人，如 ["内向", "文艺", "慢节奏"]
  best_time: string;                  // "下午 14:00-17:00 最舒适"
}
