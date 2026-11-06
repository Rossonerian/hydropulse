// Plain-language copy for the AI assistant. Pure functions, no React, no network.
// Input shapes are the real backend responses (AiSuggestion, LeakSimulationResponse,
// IntelliSenseResponse, PipeConditionItem, WhatIfResponse). Every number shown comes from the response.
// Wording is built here from fixed templates, so the provenance chip is always "Rule-based".

export const PROVENANCE_CHIP = 'Rule-based';
export const PROVENANCE_HINT = 'Wording is built by this app from the numbers the advisor returned.';
export const SYNTHETIC_NOTE = 'synthetic test, not field-verified';

// A pressure gain under this many metres is not worth the pipe cost.
const SMALL_GAIN_M = 0.1;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function fmt(v, digits = 1) {
  const n = num(v);
  if (n === null) return 'n/a';
  return n.toFixed(digits);
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

export const homes = (n) => plural(n ?? 0, 'home', 'homes');

// Jargon to plain words. Longest phrases first so they win over their parts.
const JARGON = [
  [/pressure[- ]dependent demand\s*\(PDD\)/gi, 'supply that drops when pressure drops'],
  [/\bPDD\b/g, 'supply drops when pressure drops'],
  [/head\s?loss/gi, 'pressure lost along the pipe'],
  [/\btop[- ]?1\b/gi, 'right junction first'],
  [/\btop[- ]?3\b/gi, 'within top 3'],
  [/\bconfidence\b/gi, 'match score'],
];

export function plain(text) {
  if (typeof text !== 'string') return '';
  return JARGON.reduce((out, [re, to]) => out.replace(re, to), text);
}

export const JARGON_GLOSSARY = [
  ['Headloss', 'pressure lost along the pipe'],
  ['PDD', 'supply drops when pressure drops'],
  ['Top-1 / top-3', 'right junction first / within top 3'],
  ['Confidence', 'match score'],
];

const P = (s) => s?.proposed_parameters || {};
const B = (s) => s?.baseline_metrics || {};
const A = (s) => s?.simulated_after_metrics || {};

// Pressure gain for an upsizing suggestion, metres.
export function upsizeGainM(s) {
  return num(A(s).downstream_pressure_gain_m);
}

// How many metres closer the new sensor spots locate a leak (positive = better).
export function sensorErrorGainM(s) {
  const before = num(B(s).mean_error_m);
  const after = num(A(s).mean_error_m);
  return before === null || after === null ? null : before - after;
}

export function suggestionTitle(s) {
  if (!s) return '';
  const p = P(s);
  if (s.category === 'loop_completion' && p.from_node_id && p.to_node_id) {
    return `Add a backup pipe between ${p.from_node_id} and ${p.to_node_id}`;
  }
  if (s.category === 'pipe_upsizing' && p.pipe_id) {
    const size = num(p.current_diameter_mm) && num(p.proposed_diameter_mm)
      ? ` from ${fmt(p.current_diameter_mm, 0)} mm to ${fmt(p.proposed_diameter_mm, 0)} mm`
      : '';
    return `Make pipe ${p.pipe_id} wider${size}`;
  }
  if (s.category === 'sensor_placement') {
    const n = Array.isArray(p.sensor_ids) ? p.sensor_ids.length : null;
    return n ? `Move the ${n} leak sensors to better spots` : 'Move the leak sensors to better spots';
  }
  return plain(s.title || 'Suggestion');
}

const joinIds = (ids) => (Array.isArray(ids) ? ids.join(', ') : '');

// { today, withThis, line }: the single "Today -> With this" line shown on a card.
export function todayVsWith(s) {
  if (!s) return { today: '', withThis: '', line: '' };
  const b = B(s);
  const a = A(s);
  let today = '';
  let withThis = '';
  let suffix = 'this change';
  if (s.category === 'loop_completion') {
    const before = num(b.unsupplied_households_before);
    const after = num(a.unsupplied_households_after);
    const pipe = b.outage_pipe_id ? ` if ${b.outage_pipe_id} breaks` : ' if a main breaks';
    if (before !== null && after !== null) {
      today = `${plural(before, 'home loses', 'homes lose')} water${pipe}`;
      suffix = 'this pipe';
      withThis = homes(after);
    }
  } else if (s.category === 'pipe_upsizing') {
    const before = num(b.downstream_pressure_before_m);
    const gain = upsizeGainM(s);
    if (before !== null && gain !== null) {
      today = `${fmt(before, 2)} m of pressure downstream`;
      withThis = `${fmt(before + gain, 2)} m`;
      suffix = 'the wider pipe';
    }
  } else if (s.category === 'sensor_placement') {
    const before = num(b.top1_pct);
    const after = num(a.top1_pct);
    if (before !== null && after !== null) {
      today = `right junction first in ${fmt(before)}% of tests`;
      withThis = `${fmt(after)}%`;
      suffix = 'these sensor spots';
    }
  }
  if (!today) return { today: '', withThis: '', line: 'Numbers not available for this suggestion' };
  return { today, withThis, line: `Today: ${today} → With ${suffix}: ${withThis}` };
}

// Honest wording about the size of the effect. tone: 'good' | 'small' | 'neutral'.
export function effectNote(s) {
  if (!s) return { tone: 'neutral', text: '' };
  if (s.category === 'pipe_upsizing') {
    const gain = upsizeGainM(s);
    if (gain === null) return { tone: 'neutral', text: 'Effect not available' };
    if (Math.abs(gain) < SMALL_GAIN_M) {
      return { tone: 'small', text: `+${fmt(gain, 2)} m of pressure. Small gain, probably not worth the cost` };
    }
    return { tone: 'good', text: `+${fmt(gain, 2)} m of pressure downstream` };
  }
  if (s.category === 'loop_completion') {
    const before = num(B(s).unsupplied_households_before);
    const after = num(A(s).unsupplied_households_after);
    if (before === null || after === null) return { tone: 'neutral', text: 'Effect not available' };
    if (before <= 0) return { tone: 'small', text: 'No homes at risk today. Probably not worth the cost' };
    return { tone: 'good', text: `Protects ${homes(before - after)} if ${B(s).outage_pipe_id || 'a main'} breaks` };
  }
  if (s.category === 'sensor_placement') {
    const gain = sensorErrorGainM(s);
    if (gain === null) return { tone: 'neutral', text: 'Effect not available' };
    if (gain <= 0) return { tone: 'small', text: `No improvement in a ${SYNTHETIC_NOTE}` };
    return { tone: 'good', text: `Locates leaks ~${fmt(gain, 0)} m closer in a ${SYNTHETIC_NOTE}` };
  }
  return { tone: 'neutral', text: '' };
}

// Before/after rows from the advisor's own numbers (used for Apply and for non-what-if previews).
export function impactRows(s) {
  if (!s) return [];
  const b = B(s);
  const a = A(s);
  const rows = [];
  const add = (label, before, after, unit, digits = 1) => {
    if (num(before) === null || num(after) === null) return;
    rows.push({ label, before: `${fmt(before, digits)}${unit}`, after: `${fmt(after, digits)}${unit}` });
  };
  if (s.category === 'loop_completion') {
    add('Homes without water if the pipe breaks', b.unsupplied_households_before, a.unsupplied_households_after, '', 0);
    add('Lowest pressure in that case', b.min_pressure_before_m, a.min_pressure_after_m, ' m', 2);
  } else if (s.category === 'pipe_upsizing') {
    add('Pressure lost along the pipe', b.headloss_m_per_km_before, a.headloss_m_per_km_after, ' m per km', 2);
    add('Water speed', b.velocity_ms_before, a.velocity_ms_after, ' m/s', 2);
    const gain = upsizeGainM(s);
    if (num(b.downstream_pressure_before_m) !== null && gain !== null) {
      add('Pressure downstream', b.downstream_pressure_before_m, b.downstream_pressure_before_m + gain, ' m', 2);
    }
  } else if (s.category === 'sensor_placement') {
    add('Right junction first', b.top1_pct, a.top1_pct, '%');
    add('Right junction within top 3', b.top3_pct, a.top3_pct, '%');
    add('Average distance off', b.mean_error_m, a.mean_error_m, ' m');
  }
  return rows;
}

// Rows from a /api/what-if response (baseline vs scenario).
export function whatIfRows(res) {
  if (!res?.baseline || !res?.scenario) return [];
  const b = res.baseline;
  const a = res.scenario;
  const rows = [];
  const add = (label, before, after, unit, digits) => {
    if (num(before) === null || num(after) === null) return;
    rows.push({ label, before: `${fmt(before, digits)}${unit}`, after: `${fmt(after, digits)}${unit}` });
  };
  add('Lowest pressure', b.min_pressure_m, a.min_pressure_m, ' m', 2);
  add('Average pressure', b.avg_pressure_m, a.avg_pressure_m, ' m', 2);
  add('Homes without enough pressure', b.affected_households, a.affected_households, '', 0);
  add('Junctions short of pressure', b.pressure_deficit_nodes, a.pressure_deficit_nodes, '', 0);
  return rows;
}

export function sensorDetail(s) {
  if (s?.category !== 'sensor_placement') return '';
  const p = P(s);
  const now = joinIds(B(s).sensor_ids);
  const next = joinIds(p.sensor_ids);
  const extra = p.optional_6th_sensor_id ? ` A sixth sensor at ${p.optional_6th_sensor_id} is optional.` : '';
  return `Now: ${now}. Suggested: ${next}.${extra}`;
}

export function assumptionText(s) {
  return plain(s?.uncertainty_note || 'No assumptions were listed.');
}

// How the preview was produced, so users know what the numbers are.
export const PREVIEW_LABELS = {
  whatif: 'Simulated on a copy of the network. Nothing was changed',
  advisor: 'Simulated by the advisor',
};

// ---- Apply flow ----
export const APPLY_WARNING = 'This changes the shared network for everyone';
export const UNDO_NOTE = 'Only one undo step exists. Applying another change replaces it';
export const TOKEN_HINT = 'Needed to apply or undo. Kept only in this dialog and cleared after the request';

export function appliedMessage(res) {
  return res?.mutation_summary ? `Applied: ${plain(res.mutation_summary)}` : 'Change applied to the network';
}

// ---- Panel states ----
export const PANEL_COPY = {
  title: 'Suggestions',
  loading: 'Checking ideas against the network (about 1-2 s)',
  offline: 'Suggestions need the live backend',
  stale: 'The network changed. Refresh',
  empty: 'No suggestions right now. The network looks fine on the checks we run',
  error: 'Could not load suggestions',
};

// ---- Leak explanation (from a simulate-leak response) ----
export function matchScoreBand(pct) {
  const v = num(pct);
  if (v === null) return 'unknown';
  if (v >= 80) return 'strong';
  if (v >= 60) return 'likely';
  return 'weak';
}

const BAND_TEXT = { strong: 'strong match', likely: 'likely match', weak: 'weak match', unknown: 'match unknown' };

// Exactly three short lines. Uses LeakSimulationResponse fields only.
export function leakExplain(result) {
  const top = result?.predicted_top_candidates?.[0];
  if (!top) return [];
  const band = matchScoreBand(top.confidence_pct);
  const second = result.predicted_top_candidates[1];
  const close = second && num(top.confidence_pct) !== null && num(second.confidence_pct) !== null
    && top.confidence_pct - second.confidence_pct < 10;
  const line1 = `Most likely leak: junction ${top.node_id}. Match score ${fmt(top.confidence_pct, 0)}% (${BAND_TEXT[band]}).${
    close ? ` ${second.node_id} is nearly as likely.` : ''}`;
  const hh = num(result.affected_households_after_isolation);
  const valves = Array.isArray(result.recommended_valves_to_close) ? result.recommended_valves_to_close : [];
  const line2 = hh === null
    ? 'Households affected: not available.'
    : valves.length
      ? `Closing ${valves.join(', ')} to stop it would leave ${homes(hh)} without water.`
      : `${homes(hh)} would be affected.`;
  const line3 = band === 'weak' || close
    ? `Next step: check ${top.node_id}${close ? ` and ${second.node_id}` : ''} on site before closing any valve.`
    : `Next step: send a crew to ${top.node_id}${valves.length ? ' and prepare the valves above' : ''}.`;
  return [line1, line2, line3];
}

// ---- IntelliSense ----
export function intellisenseFacts(r) {
  if (!r) return [];
  return [
    { label: 'Recommended size', value: `${fmt(r.recommended_diameter_mm, 0)} mm` },
    { label: 'Water speed', value: `${fmt(r.predicted_velocity_ms, 2)} m/s` },
    { label: 'Pressure lost along the pipe', value: `${fmt(r.predicted_headloss_m, 3)} m` },
    { label: 'Homes served', value: `${r.estimated_households ?? 'n/a'}` },
    { label: 'Pipe length', value: `${fmt(r.length_m, 0)} m` },
  ];
}

export function loopCandidateText(c) {
  if (!c) return '';
  return `${c.node_id}, ${fmt(c.distance_m, 0)} m away${c.is_dead_end ? ' (dead end)' : ''}`;
}

// ---- Pipe condition ----
const MISSING_LABELS = {
  material: 'Pipe material',
  installation_year: 'Installation year',
  wall_thickness_mm: 'Wall thickness',
  repair_history: 'Repair history',
  transient_wave_speed_ms: 'Pressure-surge wave speed',
  soil_corrosivity: 'Soil corrosivity',
};

export const missingLabel = (key) => MISSING_LABELS[key] || String(key).replace(/_/g, ' ');

export const CONDITION_BANNER =
  "Remaining life: not available - we don't have pipe age, material or wall thickness";
export const CONDITION_INDEX_TITLE = 'Hydraulic load index (illustrative, 0-1)';
export const CONDITION_INDEX_NOTE =
  'Built only from water speed and pressure lost per km. It is not a failure prediction.';

export function loadLevel(index) {
  const v = num(index);
  if (v === null) return 'unknown';
  if (v >= 0.66) return 'high';
  if (v >= 0.33) return 'medium';
  return 'low';
}
