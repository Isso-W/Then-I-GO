import { describe, it, expect } from "vitest";
import {
  projectLatLng,
  computeViewBox,
  defaultViewBox,
  bboxSizeMeters,
  ORIGIN,
  NETWORK_BBOX,
  MIN_VIEW_RADIUS_METERS,
} from "../src/components/mapProjection";

const SAMPLE_BBOX = {
  south: 39.98,
  west: 116.32,
  north: 40.00,
  east: 116.34,
};

describe("projectLatLng（边界保形 + 双射）", () => {
  it("西北角投影到 (0, 0)", () => {
    const xy = projectLatLng(
      { lat: SAMPLE_BBOX.north, lng: SAMPLE_BBOX.west },
      SAMPLE_BBOX
    );
    expect(xy.x).toBeCloseTo(0, 6);
    expect(xy.y).toBeCloseTo(0, 6);
  });

  it("东南角投影到 (width, height)", () => {
    const xy = projectLatLng(
      { lat: SAMPLE_BBOX.south, lng: SAMPLE_BBOX.east },
      SAMPLE_BBOX
    );
    const { width, height } = bboxSizeMeters(SAMPLE_BBOX);
    expect(xy.x).toBeCloseTo(width, 3);
    expect(xy.y).toBeCloseTo(height, 3);
  });

  it("中心点投影到画布中心（x = width/2, y = height/2）", () => {
    const center = {
      lat: (SAMPLE_BBOX.north + SAMPLE_BBOX.south) / 2,
      lng: (SAMPLE_BBOX.east + SAMPLE_BBOX.west) / 2,
    };
    const xy = projectLatLng(center, SAMPLE_BBOX);
    const { width, height } = bboxSizeMeters(SAMPLE_BBOX);
    expect(xy.x).toBeCloseTo(width / 2, 3);
    expect(xy.y).toBeCloseTo(height / 2, 3);
  });

  it("同坐标投影确定性（两次结果一致）", () => {
    const coord = { lat: 39.99, lng: 116.33 };
    const a = projectLatLng(coord, SAMPLE_BBOX);
    const b = projectLatLng(coord, SAMPLE_BBOX);
    expect(a).toEqual(b);
  });

  it("纬度高（北方）时，1°lng 不等于 1°lat 的米数（验证余弦补偿）", () => {
    // 在 40° 上，1°lng ≈ 85km，1°lat ≈ 111km
    const oneDegLng = projectLatLng(
      { lat: 40, lng: 1 },
      { south: 40, north: 40, west: 0, east: 1 }
    ).x;
    const oneDegLat = projectLatLng(
      { lat: 0, lng: 0 },
      { south: 0, north: 1, west: 0, east: 0 }
    ).y;
    // 比例应该 ≈ cos(40°) ≈ 0.766
    const ratio = oneDegLng / oneDegLat;
    expect(ratio).toBeGreaterThan(0.74);
    expect(ratio).toBeLessThan(0.79);
  });
});

describe("bboxSizeMeters（物理尺寸）", () => {
  it("NETWORK_BBOX 大小约 3.2km × 2.8km（五道口区域尺度合理）", () => {
    const { width, height } = bboxSizeMeters(NETWORK_BBOX);
    // 0.038°lng * cos(39.99°) * 111000 ≈ 3230m
    expect(width).toBeGreaterThan(3000);
    expect(width).toBeLessThan(3500);
    // 0.025° * 111000 = 2775m
    expect(height).toBeGreaterThan(2700);
    expect(height).toBeLessThan(2850);
  });

  it("尺寸严格为正", () => {
    const { width, height } = bboxSizeMeters(NETWORK_BBOX);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });
});

describe("defaultViewBox（中心 + 半径）", () => {
  it("中心点等于输入中心", () => {
    const bbox = defaultViewBox(ORIGIN, 1000);
    expect((bbox.north + bbox.south) / 2).toBeCloseTo(ORIGIN.lat, 6);
    expect((bbox.east + bbox.west) / 2).toBeCloseTo(ORIGIN.lng, 6);
  });

  it("半径 R 时，bbox 物理半宽/半高 ≈ R 米", () => {
    const R = 800;
    const bbox = defaultViewBox(ORIGIN, R);
    const { width, height } = bboxSizeMeters(bbox);
    expect(width / 2).toBeCloseTo(R, 0); // ±1m 精度
    expect(height / 2).toBeCloseTo(R, 0);
  });
});

describe("computeViewBox（自适配）", () => {
  it("空数组返回默认（以 ORIGIN 为中心）", () => {
    const bbox = computeViewBox([]);
    expect((bbox.north + bbox.south) / 2).toBeCloseTo(ORIGIN.lat, 6);
    expect((bbox.east + bbox.west) / 2).toBeCloseTo(ORIGIN.lng, 6);
  });

  it("单点输入 → 以该点为中心、minRadius 半径", () => {
    const pt = { lat: 40.00, lng: 116.33 };
    const bbox = computeViewBox([pt], MIN_VIEW_RADIUS_METERS);
    expect((bbox.north + bbox.south) / 2).toBeCloseTo(pt.lat, 6);
    expect((bbox.east + bbox.west) / 2).toBeCloseTo(pt.lng, 6);
    const { width } = bboxSizeMeters(bbox);
    expect(width / 2).toBeCloseTo(MIN_VIEW_RADIUS_METERS, 0);
  });

  it("多点：所有输入点都落在结果 bbox 内", () => {
    const pts = [
      { lat: 39.985, lng: 116.325 },
      { lat: 40.00, lng: 116.35 },
      { lat: 39.99, lng: 116.34 },
    ];
    const bbox = computeViewBox(pts);
    for (const p of pts) {
      expect(p.lat).toBeGreaterThanOrEqual(bbox.south);
      expect(p.lat).toBeLessThanOrEqual(bbox.north);
      expect(p.lng).toBeGreaterThanOrEqual(bbox.west);
      expect(p.lng).toBeLessThanOrEqual(bbox.east);
    }
  });

  it("多点：实际尺寸不小于 2 * minRadius（不会缩到太小）", () => {
    const pts = [
      { lat: ORIGIN.lat, lng: ORIGIN.lng },
      { lat: ORIGIN.lat + 0.0001, lng: ORIGIN.lng + 0.0001 }, // 几乎重合
    ];
    const bbox = computeViewBox(pts, MIN_VIEW_RADIUS_METERS);
    const { width, height } = bboxSizeMeters(bbox);
    expect(width).toBeGreaterThanOrEqual(2 * MIN_VIEW_RADIUS_METERS - 1);
    expect(height).toBeGreaterThanOrEqual(2 * MIN_VIEW_RADIUS_METERS - 1);
  });

  it("paddingFactor 影响边距：1.5 比 1.0 大", () => {
    const pts = [
      { lat: 39.985, lng: 116.325 },
      { lat: 40.00, lng: 116.35 },
    ];
    const tight = computeViewBox(pts, 0, 1.0);
    const padded = computeViewBox(pts, 0, 1.5);
    expect(padded.north - padded.south).toBeGreaterThan(tight.north - tight.south);
    expect(padded.east - padded.west).toBeGreaterThan(tight.east - tight.west);
  });

  it("中心稳定：多点输入的 bbox 中心 = 输入点的几何中心", () => {
    const pts = [
      { lat: 39.985, lng: 116.325 },
      { lat: 40.00, lng: 116.35 },
    ];
    const bbox = computeViewBox(pts);
    const expectedLat = (39.985 + 40.00) / 2;
    const expectedLng = (116.325 + 116.35) / 2;
    expect((bbox.north + bbox.south) / 2).toBeCloseTo(expectedLat, 6);
    expect((bbox.east + bbox.west) / 2).toBeCloseTo(expectedLng, 6);
  });
});
