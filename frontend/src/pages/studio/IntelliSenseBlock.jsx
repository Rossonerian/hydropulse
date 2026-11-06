import { useEffect, useRef, useState } from 'react';
import { Button } from '../../ui/index.js';
import { client } from '../../api/client.js';
import { fmt, intellisenseFacts, loopCandidateText } from '../../lib/assistantCopy.js';
import '../../components/assistant/assistant.css';

/**
 * IntelliSenseBlock: size hint for a pipe being drawn in the Studio.
 * Props:
 *   fromNodeId       string, required
 *   toNodeId         string, an existing node to connect to; OR
 *   newJunctionLat / newJunctionLng   numbers, a new junction position
 *   targetVelocity   number m/s (0.6..1.5), default 1.0
 *   roughness        number (40..200), default 130
 *   networkRevision  string, sent as expected_network_revision when given
 *   live             boolean, false = offline message (default true)
 *   onUseDiameter    (mm: number) => void   called by "Use recommended diameter"
 * Requests are debounced 400 ms and the previous in-flight request is cancelled.
 */
const DEBOUNCE_MS = 400;

export default function IntelliSenseBlock({
  fromNodeId,
  toNodeId,
  newJunctionLat,
  newJunctionLng,
  targetVelocity,
  roughness,
  networkRevision,
  live = true,
  onUseDiameter,
}) {
  const [state, setState] = useState({ status: 'idle', data: null, error: '' });
  const offline = !live || client.forcedMock;
  const hasCoords = Number.isFinite(newJunctionLat) && Number.isFinite(newJunctionLng);
  const ready = !!fromNodeId && (!!toNodeId || hasCoords);
  const abortRef = useRef(null);

  useEffect(() => {
    abortRef.current?.abort();
    if (offline || !ready) {
      setState({ status: 'idle', data: null, error: '' });
      return undefined;
    }
    const body = { from_node_id: fromNodeId };
    if (toNodeId) body.to_node_id = toNodeId;
    else {
      body.new_junction_lat = newJunctionLat;
      body.new_junction_lng = newJunctionLng;
    }
    if (targetVelocity !== undefined) body.target_velocity_ms = targetVelocity;
    if (roughness !== undefined) body.roughness = roughness;
    if (networkRevision) body.expected_network_revision = networkRevision;

    const controller = new AbortController();
    abortRef.current = controller;
    setState((s) => ({ ...s, status: 'loading', error: '' }));
    const timer = setTimeout(async () => {
      try {
        const data = await client.intellisense(body, controller.signal);
        if (!controller.signal.aborted) setState({ status: 'ready', data, error: '' });
      } catch (e) {
        if (controller.signal.aborted) return;
        setState({ status: 'error', data: null, error: e.message });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [fromNodeId, toNodeId, newJunctionLat, newJunctionLng, targetVelocity, roughness, networkRevision, offline, ready]);

  if (offline) {
    return <p className="asst__msg">Size hints need the live backend</p>;
  }
  if (!ready) {
    return <p className="asst__msg">Pick where the pipe starts and ends to get a size hint.</p>;
  }

  const { status, data, error } = state;
  return (
    <section className="asst" aria-labelledby="isense-title" aria-busy={status === 'loading'}>
      <h3 id="isense-title" className="asst__title">
        Size hint
      </h3>
      {status === 'loading' && !data && (
        <p className="asst__msg" role="status">
          Working out a size...
        </p>
      )}
      {status === 'error' && (
        <p className="asst__msg asst__msg--bad" role="alert">
          {error}
        </p>
      )}
      {data && (
        <div role="status" aria-live="polite">
          <dl className="asst-facts">
            {intellisenseFacts(data).map((f) => (
              <div key={f.label} style={{ display: 'contents' }}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
          {data.loop_candidates?.length > 0 && (
            <>
              <h4 className="asst-card__note">Other nearby junctions to connect to</h4>
              <ul className="asst-list">
                {data.loop_candidates.slice(0, 4).map((c) => (
                  <li key={c.node_id}>{loopCandidateText(c)}</li>
                ))}
              </ul>
            </>
          )}
          {data.warnings?.length > 0 && (
            <ul className="asst-list asst-list--warn">
              {data.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <p className="asst-card__note">Hint only, based on {fmt(data.length_m, 0)} m of pipe and estimated demand.</p>
          <div className="asst__actions">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onUseDiameter?.(data.recommended_diameter_mm)}
              disabled={status === 'loading'}
            >
              Use recommended diameter
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
