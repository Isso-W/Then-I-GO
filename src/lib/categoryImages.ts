const CATEGORY_IMAGE_MAP: Record<string, string> = {
  "咖啡厅": "coffee",
  "宠物友好咖啡": "coffee",
  "共享空间/自习室": "coffee",
  "餐厅": "food",
  "餐厅-北京风味": "food",
  "餐厅-东北菜": "food",
  "餐厅-素食轻食": "food",
  "餐厅-火锅": "food",
  "美食城": "food",
  "餐厅-日韩料理": "noodles",
  "餐厅-小吃": "noodles",
  "美食街": "noodles",
  "夜宵烧烤": "bbq",
  "奶茶甜品": "boba",
  "酒吧": "bar",
  "酒吧清吧": "bar",
  "livehouse": "bar",
  "夜店": "bar",
  "书店": "bookstore",
  "文创小店": "art",
  "美术馆": "art",
  "花店": "art",
  "公园绿地": "park",
  "景点/地标": "park",
  "健身/瑜伽": "fitness",
  "运动娱乐": "fitness",
  "电影院": "entertainment",
  "KTV": "entertainment",
  "台球/棋牌": "entertainment",
  "桌游/密室": "entertainment",
  "电竞/网咖": "entertainment",
};

export const ALL_IMAGE_KEYS = [
  "coffee", "food", "noodles", "bbq", "boba", "bar",
  "bookstore", "art", "park", "fitness", "entertainment",
  "bike", "taxi",
] as const;

export type CategoryImageKey = (typeof ALL_IMAGE_KEYS)[number];

export function getCategoryImageKey(category?: string): CategoryImageKey {
  if (!category) return "food";
  const direct = CATEGORY_IMAGE_MAP[category];
  if (direct) return direct as CategoryImageKey;
  const prefix = category.split(/[-/]/)[0];
  return (CATEGORY_IMAGE_MAP[prefix] ?? "food") as CategoryImageKey;
}

export function getCategoryImage(category?: string): string {
  return `/categories/${getCategoryImageKey(category)}.jpg`;
}
