// 经纬度 → SVG 像素的投影 + 视野计算。
// 故意写成无 React 依赖的纯函数，方便单测。

export interface LatLng {
  lat: number;
  lng: number;
}

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface XY {
  x: number;
  y: number;
}

// 五道口地铁站，作为整张地图的默认中心 / 用户起点
// 这个坐标是手工对齐到成府路上的（最近路段距离 8.9m，已 snap）
export const ORIGIN: LatLng = { lat: 39.99208, lng: 116.337001 };

// 视野最小半径（米）。30 分钟单 waypoint 的路线也不会缩到一个点。
export const MIN_VIEW_RADIUS_METERS = 800;

// 第一人称跟随模式下的视野半径（米）。地图始终以红点为中心，这是固定的可视范围。
export const FOLLOW_RADIUS_METERS = 500;

// 自动适配时，外加 20% 边距防止 marker 贴边
export const DEFAULT_PADDING = 1.2;

// street-network.json 里写死的 BBox。Fallback 用。
export const NETWORK_BBOX: BBox = {
  south: 39.98,
  west: 116.32,
  north: 40.005,
  east: 116.358,
};

const METERS_PER_DEG_LAT = 111_000;

// 在参考纬度上，1 度经度等于多少米。北纬 40° 约 85km。
function metersPerDegLngAt(refLat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((refLat * Math.PI) / 180);
}

/**
 * 把经纬度投影到一个以"米"为单位的画布。
 * 原点在 bbox 的西北角，x 向东增长，y 向南增长（符合 SVG 坐标系）。
 * 经度方向按 bbox 中心纬度做余弦补偿，避免北方城市被横向拉伸。
 */
export function projectLatLng(coord: LatLng, bbox: BBox): XY {
  const refLat = (bbox.north + bbox.south) / 2;
  const mPerDegLng = metersPerDegLngAt(refLat);
  return {
    x: (coord.lng - bbox.west) * mPerDegLng,
    y: (bbox.north - coord.lat) * METERS_PER_DEG_LAT,
  };
}

/** projectLatLng 的反函数：SVG 用户坐标（米）→ 经纬度。 */
export function unprojectXY(xy: XY, bbox: BBox): LatLng {
  const refLat = (bbox.north + bbox.south) / 2;
  const mPerDegLng = metersPerDegLngAt(refLat);
  return {
    lng: bbox.west + xy.x / mPerDegLng,
    lat: bbox.north - xy.y / METERS_PER_DEG_LAT,
  };
}

/**
 * 在给定 bbox 上，画布总尺寸（米）。
 * 用来设置 SVG 的 viewBox：`0 0 width height`。
 */
export function bboxSizeMeters(bbox: BBox): { width: number; height: number } {
  const refLat = (bbox.north + bbox.south) / 2;
  const mPerDegLng = metersPerDegLngAt(refLat);
  return {
    width: (bbox.east - bbox.west) * mPerDegLng,
    height: (bbox.north - bbox.south) * METERS_PER_DEG_LAT,
  };
}

/**
 * 以 center 为中心、radiusMeters 为半径，生成正方形 bbox（按米衡量边长，纬度补偿）。
 */
export function defaultViewBox(center: LatLng, radiusMeters: number): BBox {
  const mPerDegLng = metersPerDegLngAt(center.lat);
  const dLat = radiusMeters / METERS_PER_DEG_LAT;
  const dLng = radiusMeters / mPerDegLng;
  return {
    south: center.lat - dLat,
    north: center.lat + dLat,
    west: center.lng - dLng,
    east: center.lng + dLng,
  };
}

/**
 * 给一组点 + 最小半径 → 自动适配的 bbox。
 * 规则：
 *  - 空数组 → 以 ORIGIN 为中心、1000 米半径
 *  - 单点 → 以该点为中心、minRadius 半径
 *  - 多点 → 包住所有点 + paddingFactor 倍边距，但单边不小于 minRadius
 */
export function computeViewBox(
  points: LatLng[],
  minRadiusMeters: number = MIN_VIEW_RADIUS_METERS,
  paddingFactor: number = DEFAULT_PADDING
): BBox {
  if (points.length === 0) {
    return defaultViewBox(ORIGIN, 1000);
  }
  if (points.length === 1) {
    return defaultViewBox(points[0], minRadiusMeters);
  }

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const west = Math.min(...lngs);
  const east = Math.max(...lngs);

  const centerLat = (north + south) / 2;
  const centerLng = (east + west) / 2;
  const mPerDegLng = metersPerDegLngAt(centerLat);

  const latExtentM = (north - south) * METERS_PER_DEG_LAT;
  const lngExtentM = (east - west) * mPerDegLng;

  // 半边长 = 数据范围/2 * padding，但不小于 minRadius
  const halfLatM = Math.max((latExtentM / 2) * paddingFactor, minRadiusMeters);
  const halfLngM = Math.max((lngExtentM / 2) * paddingFactor, minRadiusMeters);

  const dLat = halfLatM / METERS_PER_DEG_LAT;
  const dLng = halfLngM / mPerDegLng;

  return {
    south: centerLat - dLat,
    north: centerLat + dLat,
    west: centerLng - dLng,
    east: centerLng + dLng,
  };
}
