const CATEGORY_IMAGE_MAP: Record<string, string> = {
  // 餐饮 — 9 大品类
  "餐厅": "local-cuisine",
  "餐厅-北京风味": "local-cuisine",
  "餐厅-东北菜": "local-cuisine",
  "餐厅-素食轻食": "local-cuisine",
  "餐厅-火锅": "hotpot",
  "夜宵烧烤": "bbq",
  "餐厅-日韩料理": "world-cuisine",
  "美食城": "buffet",
  "美食街": "snack",
  "餐厅-小吃": "snack",
  "咖啡厅": "drinks",
  "奶茶甜品": "dessert",
  "宠物友好咖啡": "drinks",

  // 非餐饮
  "共享空间/自习室": "coffee",
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
  "local-cuisine", "hotpot", "bbq", "world-cuisine", "buffet",
  "seafood", "snack", "drinks", "dessert",
  "coffee", "bar", "bookstore", "art", "park",
  "fitness", "entertainment", "bike", "taxi",
] as const;

export type CategoryImageKey = (typeof ALL_IMAGE_KEYS)[number];

export function getCategoryImageKey(category?: string): CategoryImageKey {
  if (!category) return "local-cuisine";
  const direct = CATEGORY_IMAGE_MAP[category];
  if (direct) return direct as CategoryImageKey;
  const prefix = category.split(/[-/]/)[0];
  return (CATEGORY_IMAGE_MAP[prefix] ?? "local-cuisine") as CategoryImageKey;
}

export function getCategoryImage(category?: string): string {
  return `/categories/${getCategoryImageKey(category)}.jpg`;
}
