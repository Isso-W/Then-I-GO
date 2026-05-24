/**
 * 把 street-network.json + pois.json 渲染成可交互地图 HTML
 * 运行：npx tsx scripts/visualizeStreetNetwork.ts
 * 输出：scripts/data/street-network.html  （浏览器直接打开）
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StreetNetwork, StreetSegment } from './fetchStreetNetwork.js';
import type { POI } from '../src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, 'data');

const network: StreetNetwork = JSON.parse(
  readFileSync(path.join(dataDir, 'street-network.json'), 'utf-8')
);

const pois: POI[] = JSON.parse(
  readFileSync(path.resolve(__dirname, '../src/data/pois.json'), 'utf-8')
);

// ---------- 路网样式 ----------

const ROAD_COLOR: Record<string, string> = {
  primary:      '#FF4444',
  secondary:    '#FF8800',
  tertiary:     '#FFCC00',
  residential:  '#44BB88',
  pedestrian:   '#4488FF',
  unknown:      '#888888',
};

const ROAD_WEIGHT: Record<string, number> = {
  primary: 5, secondary: 4, tertiary: 3, residential: 2, pedestrian: 2,
};

function streetToJS(s: StreetSegment): string {
  const latlngs = s.points.map(p => `[${p.lat},${p.lng}]`).join(',');
  const color  = ROAD_COLOR[s.highway] ?? ROAD_COLOR.unknown;
  const weight = ROAD_WEIGHT[s.highway] ?? 2;
  const label  = s.name || s.nameEn || s.highway;
  return `L.polyline([${latlngs}],{color:'${color}',weight:${weight},opacity:0.7})` +
         `.bindTooltip(${JSON.stringify(label)},{sticky:true}).addTo(map);`;
}

// ---------- POI 样式 ----------

const POI_COLOR: Record<string, string> = {
  '咖啡厅':         '#A87CFF',  // 紫
  '宠物友好咖啡':   '#C9A0FF',  // 浅紫
  '奶茶甜品':       '#FF88CC',  // 粉
  '书店':           '#4488FF',  // 蓝
  '文创小店':       '#00CCEE',  // 青
  '美术馆':         '#FF6699',  // 玫红
  'livehouse':      '#FF3366',  // 深玫红
  '公园绿地':       '#33CC77',  // 绿
  '餐厅':           '#FF8833',  // 橙
  '餐厅-日韩料理':  '#FFB347',  // 浅橙
  '餐厅-北京风味':  '#FF6633',  // 深橙
  '餐厅-素食轻食':  '#99DD44',  // 黄绿
  '酒吧':           '#EE44AA',  // 深粉
  '酒吧清吧':       '#CC3388',  // 深玫
  '夜宵烧烤':       '#FF4444',  // 红
  '便利店':         '#FFDD22',  // 黄
  '花店':           '#FF99BB',  // 粉红
  '健身/瑜伽':      '#44DDBB',  // 青绿
  '共享空间/自习室':'#88AAFF',  // 浅蓝
  '洗衣生活服务':   '#AAAAAA',  // 灰
};

const CROWD_RADIUS: Record<string, number> = { low: 8, medium: 11, high: 15 };

function poiToJS(p: POI): string {
  const color  = POI_COLOR[p.category] ?? '#CCCCCC';
  const radius = CROWD_RADIUS[p.crowd_level] ?? 10;
  const popup  = [
    `<b>${p.name}</b>`,
    `${p.category} · ⭐${p.rating} · ${'¥'.repeat(p.price_level)}`,
    `客流：${p.crowd_level} | 停留约 ${p.avg_stay_minutes}min`,
    `<i>${p.review_summary}</i>`,
  ].join('<br>');
  return `L.circleMarker([${p.lat},${p.lng}],` +
         `{radius:${radius},color:'${color}',fillColor:'${color}',fillOpacity:0.85,weight:1.5})` +
         `.bindPopup(${JSON.stringify(popup)}).addTo(map);`;
}

// ---------- 生成 HTML ----------

const centerLat = (network.bbox.south + network.bbox.north) / 2;
const centerLng = (network.bbox.west  + network.bbox.east)  / 2;

const roadLegend = Object.entries(ROAD_COLOR)
  .filter(([t]) => t !== 'unknown')
  .map(([type, color]) =>
    `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
       <div style="width:24px;height:4px;background:${color};border-radius:2px"></div>
       <span>${type}</span></div>`
  ).join('');

const poiLegend = Object.entries(POI_COLOR)
  .map(([cat, color]) =>
    `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
       <div style="width:10px;height:10px;border-radius:50%;background:${color}"></div>
       <span>${cat}</span></div>`
  ).join('');

const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>五道口路网 + POI</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: sans-serif; }
  #map { width:100vw; height:100vh; }
  #info {
    position:absolute; top:12px; right:12px; z-index:1000;
    background:rgba(255,255,255,0.93); padding:12px 16px;
    border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.2);
    font-size:12px; min-width:155px; max-height:90vh; overflow-y:auto;
  }
  #info h4 { font-size:13px; margin:8px 0 4px; color:#333; }
  #info .stat { color:#666; margin-bottom:6px; font-size:11px; }
  .note { font-size:10px; color:#999; margin-top:4px; }
</style>
</head>
<body>
<div id="map"></div>
<div id="info">
  <b style="font-size:13px">五道口路网 + POI</b>
  <div class="stat" style="margin-top:4px">
    路段 ${network.totalStreets} 条 · POI ${pois.length} 个<br>
    圆圈大小 = 客流量
  </div>
  <h4>道路类型</h4>
  ${roadLegend}
  <h4>POI 类型</h4>
  ${poiLegend}
  <div class="note">点击 POI 查看详情</div>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const map = L.map('map');
map.fitBounds([[${network.bbox.south},${network.bbox.west}],[${network.bbox.north},${network.bbox.east}]]);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors', maxZoom: 19,
}).addTo(map);

L.rectangle(
  [[${network.bbox.south},${network.bbox.west}],[${network.bbox.north},${network.bbox.east}]],
  {color:'#6C5CFF',weight:1.5,fill:false,dashArray:'6,4',opacity:0.4}
).addTo(map);

// 路网（先画，POI 在上层）
${network.streets.map(streetToJS).join('\n')}

// POI
${pois.map(poiToJS).join('\n')}
</script>
</body>
</html>`;

const outPath = path.join(dataDir, 'street-network.html');
writeFileSync(outPath, html, 'utf-8');
console.log(`已生成：${outPath}`);
console.log('浏览器打开，点 POI 圆圈可查看详情。');
