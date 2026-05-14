import type { ReactNode } from 'react';

export type ScreenType = 'explore' | 'story' | 'bag' | 'mine' | 'event' | 'settings';

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
