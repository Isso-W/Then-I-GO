import type { ReactNode } from 'react';

export type ScreenType = 'onboarding' | 'explore' | 'story' | 'bag' | 'mine' | 'event' | 'settings';

// 冷启动收集的长期属性。持久化到 localStorage 的 userProfile 键。
// mbti / interests 都可以为 null/[]（用户跳过）；只要 completedAt 存在就不再展示 onboarding。
export interface UserProfile {
  mbti: string | null;
  interests: string[];
  completedAt: number;
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
  | "vlog_ready"
  | "achievement_unlock";

export interface Coupon {
  title: string;
  desc: string;
  date: string;
  amount: string;
  icon: ReactNode;
  color: string;
  tag?: string;
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
}

// AI 生成的完整路线
export interface GeneratedRoute {
  title: string;        // 今日路线标题，如"静安区的隐秘下午"
  waypoints: Waypoint[];
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
