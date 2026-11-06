// Operations flow helpers: pure functions, no React, no network.
// Everything shown comes from the existing API responses; nothing here changes a field, unit or ID.
import { number } from './format.js';

// Fallback presets (match frontend/public/mock/presets.json) used only when the API sent fewer than 3.
export const DEFAULT_PRESETS = [
  {
    id: 'kengeri_mainline_rupture',
    label: 'Kengeri Mainline Rupture',
    description: '45 cm² rupture on primary distribution corridor',
    target_node_id: 'J35',
    leak_area_cm2: 45.0,
    noise_pct: 1.5,
  },
  {
    id: 'residential_lane_seep',
    label: 'Residential Lane Seep',
    description: '8 cm² seep in residential perimeter dead-end lane',
    target_node_id: 'J80',
    leak_area_cm2: 8.0,
    noise_pct: 3.0,
  },
  {
    id: 'joint_crack_junction',
    label: 'Joint Crack under Junction',
    description: '20 cm² cracked joint at secondary intersection',
    target_node_id: 'J44',
    leak_area_cm2: 20.0,
    noise_pct: 2.0,
  },
];

export function getPresetList(presets) {
  return presets && presets.length >= 3 ? presets.slice(0, 3) : DEFAULT_PRESETS;
}

// Leak size choices shown as Small / Medium / Large with the real cm² next to them.
export const LEAK_SIZES = [
  { key: 'small', label: 'Small', area: 8 },
  { key: 'medium', label: 'Medium', area: 25 },
  { key: 'large', label: 'Large', area: 60 },
];

export function sizeForArea(area) {
  const a = Number(area);
  return LEAK_SIZES.find((s) => s.area === a) || null;
}

const MINUS = '−';

// Pressure change at a sensor in metres of water. drop_m > 0 means pressure fell.
export function dropText(dropM) {
  const d = Number(dropM) || 0;
  return `${d < 0 ? '+' : MINUS}${number(Math.abs(d), 1)} m`;
}

export function sensorRows(result) {
  return (result?.sensor_readings || []).map((r, i) => ({ ...r, label: `S${i + 1}` }));
}

export function biggestDrop(rows) {
  if (!rows?.length) return null;
  return rows.reduce((a, b) => (Number(b.drop_m) > Number(a.drop_m) ? b : a));
}

export function sensorSummaryLine(result, sensorCount = 5) {
  const rows = sensorRows(result);
  const big = biggestDrop(rows);
  if (!big) return `${sensorCount} sensors watching the network`;
  return `${rows.length} sensors, biggest drop ${big.label} ${dropText(big.drop_m)}`;
}

// ---- Confidence (display-only) ----
// Derived from the spread of the match scores the API already returns. It is a reading aid,
// not a probability, and it never changes any API value.
const CONF_HINT = {
  high: 'One spot clearly fits the sensor pattern better than the others.',
  medium: 'A leading spot, but another one is close. Check both.',
  low: 'Several spots fit about equally well. Check them in order before closing valves.',
};

export function leakConfidence(result) {
  const list = result?.predicted_top_candidates || [];
  const scores = list.map((c) => Number(c.confidence_pct)).filter((v) => Number.isFinite(v));
  if (!scores.length) return null;
  const best = scores[0];
  const second = scores.length > 1 ? scores[1] : null;
  const tied = scores.filter((s) => best - s < 1).length;
  let level;
  if (second === null) level = best >= 80 ? 'high' : best >= 50 ? 'medium' : 'low';
  else if (tied >= 3) level = 'low';
  else {
    const gap = best - second;
    level = gap >= 15 ? 'high' : gap >= 5 ? 'medium' : 'low';
  }
  return {
    level,
    label: level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low',
    hint: CONF_HINT[level],
    tied,
    allTied: scores.length > 1 && tied === scores.length,
  };
}

// ---- Result figures ----
export function resultFigures(result, network) {
  const loss = Number(result?.actual_loss_lpm) || 0;
  const tankers = Math.round(((loss * 1440) / 6000) * 10) / 10;
  const households = (network?.nodes || []).reduce((a, n) => a + (n.households || 0), 0);
  const cut = Number(result?.affected_households_after_isolation) || 0;
  const supplied = Math.max(0, 100 - (cut / Math.max(households, 1)) * 100);
  const top = result?.predicted_top_candidates?.[0];
  return {
    loss,
    tankers,
    households,
    cut,
    supplied,
    top,
    holeCm2: top?.estimated_leak_area_cm2 || result?.injected_leak_area_cm2,
    valves: result?.recommended_valves_to_close || [],
  };
}

function haversineM(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// "S3, about 140 m away" for the junction, using the map coordinates.
export function nearestSensor(network, nodeId) {
  const nodes = network?.nodes || [];
  const node = nodes.find((n) => n.id === nodeId);
  if (!node || !Number.isFinite(node.lat)) return null;
  let best = null;
  (network.sensor_ids || []).forEach((sid, i) => {
    const s = nodes.find((n) => n.id === sid);
    if (!s || !Number.isFinite(s.lat)) return;
    const d = haversineM(node, s);
    if (!best || d < best.meters) best = { label: `S${i + 1}`, meters: d };
  });
  return best;
}

// ---- Plain-text report ----
export function reportText({ result, network, phase, judge, revealed }) {
  if (!result) return '';
  const f = resultFigures(result, network);
  const conf = leakConfidence(result);
  const lines = [];
  lines.push('HydroPulse leak report');
  lines.push('======================');
  lines.push(`Most likely leak: ${f.top?.node_id || result.injected_node_id}${conf ? ` (${conf.label} confidence)` : ''}`);
  lines.push(`Water lost: ${number(f.loss, 0)} litres per minute (about ${number(Math.round(f.tankers), 0)} tanker trips a day)`);
  lines.push(`Hole size: about ${number(f.holeCm2, 1)} cm2`);
  if (f.valves.length) {
    lines.push(`${phase === 'isolated' ? 'Valves closed' : 'Valves to close'}: ${f.valves.join(', ')}`);
    lines.push(`Homes: ${number(f.supplied, 1)}% keep water (${number(f.cut, 0)} homes cut off)`);
  }
  const rows = sensorRows(result);
  if (rows.length) {
    lines.push(`Sensors: ${rows.map((r) => `${r.label} ${dropText(r.drop_m)}`).join(', ')}`);
  }
  const others = (result.predicted_top_candidates || []).slice(1).map((c) => c.node_id);
  if (others.length) lines.push(`Other possible spots: ${others.join(', ')}`);
  if (judge && revealed) {
    lines.push(`Real leak spot: ${result.injected_node_id} (miss distance ${number(result.localization_error_m, 1)} m)`);
  }
  lines.push('');
  lines.push(`Network: ${network?.network_name || 'unknown'}. Simulated test, not field-verified.`);
  lines.push(`Created ${new Date().toLocaleString('en-IN')}`);
  return lines.join('\n');
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
