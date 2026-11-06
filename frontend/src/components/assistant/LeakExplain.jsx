import { PROVENANCE_HINT, leakExplain } from '../../lib/assistantCopy.js';
import './assistant.css';

/**
 * LeakExplain: three plain lines about the last simulated leak.
 * Props:
 *   lastResult  LeakSimulationResponse from POST /api/simulate-leak (or null)
 * Renders nothing until a result with at least one candidate exists.
 */
export default function LeakExplain({ lastResult }) {
  const lines = leakExplain(lastResult);
  if (lines.length === 0) return null;
  return (
    <section className="asst-explain" aria-labelledby="asst-explain-title">
      <div className="asst__head">
        <h3 id="asst-explain-title" className="asst__title">
          What this means
        </h3>
        <span className="asst-chip" title={PROVENANCE_HINT}>
          Rule-based summary
        </span>
      </div>
      <ul className="asst-explain__lines">
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </section>
  );
}
