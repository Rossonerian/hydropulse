import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, EmptyState } from '../ui/index.js';
import { client } from '../api/client.js';
import {
  CONDITION_BANNER,
  CONDITION_INDEX_NOTE,
  CONDITION_INDEX_TITLE,
  fmt,
  loadLevel,
  missingLabel,
} from '../lib/assistantCopy.js';
import './assistant/assistant.css';

/**
 * PipeConditionPanel: hydraulic load of each pipe. Never shows remaining life or years.
 * Props:
 *   networkRevision  string, refetches once when it changes
 *   live             boolean, false = show the offline message (default true)
 *   initialCount     number of pipes shown before "Show all" (default 10)
 * Data: GET /api/pipes/condition (rul_available is false; illustrative_stress_index is 0..1).
 */
export default function PipeConditionPanel({ networkRevision, live = true, initialCount = 10 }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });
  const [showAll, setShowAll] = useState(false);
  const seq = useRef(0);
  const offline = !live || client.forcedMock;

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, status: 'loading', error: '' }));
    try {
      const data = await client.getPipeCondition();
      if (mine === seq.current) setState({ status: 'ready', data, error: '' });
    } catch (e) {
      if (mine === seq.current) setState({ status: 'error', data: null, error: e.message });
    }
  }, []);

  useEffect(() => {
    if (!offline) load();
    return () => {
      seq.current += 1;
    };
  }, [networkRevision, offline, load]);

  const pipes = [...(state.data?.pipes || [])].sort(
    (a, b) => b.illustrative_stress_index - a.illustrative_stress_index,
  );
  const shown = showAll ? pipes : pipes.slice(0, initialCount);
  const missing = [...new Set(pipes.flatMap((p) => p.missing_inputs || []))];
  const note = pipes[0]?.provenance_note || state.data?.methodology_note;

  return (
    <section className="asst" aria-labelledby="cond-title">
      <h2 id="cond-title" className="asst__title">
        Pipe condition
      </h2>
      <p className="asst__msg asst__msg--warn" role="note">
        {CONDITION_BANNER}
      </p>

      {offline && <EmptyState title="Pipe condition needs the live backend" />}

      {!offline && state.status === 'loading' && (
        <div className="asst-skel" role="status" aria-busy="true">
          <span className="asst-sr">Loading pipe condition</span>
          <div className="asst-skel__bar" />
          <div className="asst-skel__bar" />
          <div className="asst-skel__bar" />
        </div>
      )}

      {!offline && state.status === 'error' && (
        <div className="asst__msg asst__msg--bad" role="alert">
          <p>Could not load pipe condition: {state.error}</p>
          <Button variant="secondary" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      )}

      {!offline && state.status === 'ready' && (
        <>
          <h3 className="asst-apply__title">{CONDITION_INDEX_TITLE}</h3>
          <p className="asst-card__note">{CONDITION_INDEX_NOTE} Highest first.</p>
          <table className="asst-cond__table">
            <caption className="asst-sr">{CONDITION_INDEX_TITLE}, highest first</caption>
            <thead>
              <tr>
                <th scope="col">Pipe</th>
                <th scope="col">Size</th>
                <th scope="col">Index</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.pipe_id}>
                  <th scope="row">
                    {p.pipe_id}
                    <span className="asst-card__note"> {p.from_node} to {p.to_node}</span>
                  </th>
                  <td className="asst-cond__num">{fmt(p.diameter_mm, 0)} mm</td>
                  <td className="asst-cond__num">
                    {fmt(p.illustrative_stress_index, 3)}
                    <span className="asst-sr"> ({loadLevel(p.illustrative_stress_index)} load)</span>
                    <span className="asst-cond__bar" aria-hidden="true">
                      <span style={{ width: `${Math.max(0, Math.min(1, p.illustrative_stress_index)) * 100}%` }} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pipes.length > initialCount && (
            <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
              {showAll ? 'Show fewer' : `Show all (${pipes.length})`}
            </Button>
          )}
          {missing.length > 0 && (
            <div>
              <h3 className="asst-apply__title">What we would need for remaining life</h3>
              <ul className="asst-cond__missing">
                {missing.map((m) => (
                  <li key={m}>{missingLabel(m)}</li>
                ))}
              </ul>
            </div>
          )}
          {note && (
            <details className="asst-details">
              <summary>How this is calculated</summary>
              <p>{note}</p>
            </details>
          )}
        </>
      )}
    </section>
  );
}
