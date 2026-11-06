import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { biggestDrop, dropText, leakConfidence, sensorRows } from '../lib/opsFlow.js';

// Reveal sequence for a finished simulation. The backend answers in one request, so nothing here
// pretends to compute: it replays the REAL response in short beats (<= 2.5 s, skippable).
//   sensors (one by one, with their real drop) -> heat (top 3) -> leak marker + zoom -> done (result card fills in)
// prefers-reduced-motion: straight to done.
const SENSOR_MS = 240;
const HEAT_MS = 450;
const LEAK_MS = 600;

const DONE = { active: false, stage: 'done', index: 999 };

export function useReveal({ result, reduced }) {
  const [state, setState] = useState(DONE);
  const timers = useRef([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useLayoutEffect(() => {
    clear();
    if (!result) {
      setState(DONE);
      return clear;
    }
    const n = sensorRows(result).length;
    if (reduced || n === 0) {
      setState(DONE);
      return clear;
    }
    setState({ active: true, stage: 'sensors', index: 0 });
    const at = (ms, next) => timers.current.push(setTimeout(() => setState(next), ms));
    for (let i = 1; i < n; i += 1) at(i * SENSOR_MS, { active: true, stage: 'sensors', index: i });
    const tHeat = n * SENSOR_MS;
    at(tHeat, { active: true, stage: 'heat', index: n });
    at(tHeat + HEAT_MS, { active: true, stage: 'leak', index: n });
    at(tHeat + HEAT_MS + LEAK_MS, DONE);
    return clear;
  }, [result, reduced]);

  const skip = useCallback(() => {
    clear();
    setState(DONE);
  }, []);

  const rows = sensorRows(result);
  const big = biggestDrop(rows);
  const top = result?.predicted_top_candidates?.[0]?.node_id;
  const conf = leakConfidence(result);

  let caption = '';
  if (state.active) {
    if (state.stage === 'sensors') {
      const r = rows[Math.min(state.index, rows.length - 1)];
      caption = r ? `Sensor ${r.label}: pressure change ${dropText(r.drop_m)}` : 'Reading the sensors';
    } else if (state.stage === 'heat') {
      caption = big
        ? `Sensor ${big.label} saw the biggest pressure drop (${dropText(big.drop_m)}). Comparing with every spot`
        : 'Comparing with every spot';
    } else {
      caption = `Most likely leak: ${top}`;
    }
  }
  const finalCaption = top
    ? `Result ready. Most likely leak: ${top}${conf ? `, ${conf.label.toLowerCase()} confidence` : ''}.`
    : '';

  return {
    active: state.active,
    stage: state.stage,
    index: state.index,
    showHeat: state.stage === 'heat' || state.stage === 'leak' || state.stage === 'done',
    showLeak: state.stage === 'leak' || state.stage === 'done',
    caption,
    finalCaption,
    skip,
  };
}
