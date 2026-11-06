import { Button } from '../../ui/index.js';
import {
  PROVENANCE_CHIP,
  PROVENANCE_HINT,
  PREVIEW_LABELS,
  assumptionText,
  effectNote,
  impactRows,
  sensorDetail,
  suggestionTitle,
  todayVsWith,
  whatIfRows,
} from '../../lib/assistantCopy.js';
import './assistant.css';

/**
 * SuggestionCard: one advisor suggestion in plain language.
 * Props:
 *   suggestion  AiSuggestion from GET /api/ai/suggestions (suggestion_id, category, ...)
 *   preview     entry from useAssistant().previews[suggestion_id], or undefined
 *   onPreview   (suggestion) => void
 *   onApply     (suggestion) => void   opens the confirm dialog
 *   disabled    boolean   true when the data is stale or offline
 */
export function ImpactTable({ rows, caption }) {
  if (!rows?.length) return null;
  return (
    <table className="asst-rows">
      {caption && <caption>{caption}</caption>}
      <thead>
        <tr>
          <th scope="col">What</th>
          <th scope="col">Today</th>
          <th scope="col">After</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <th scope="row">{r.label}</th>
            <td>{r.before}</td>
            <td>{r.after}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function SuggestionCard({ suggestion, preview, onPreview, onApply, disabled = false }) {
  const line = todayVsWith(suggestion);
  const effect = effectNote(suggestion);
  const extra = sensorDetail(suggestion);
  const loading = preview?.status === 'loading';
  let rows = [];
  let caption = '';
  if (preview?.status === 'ready') {
    if (preview.kind === 'whatif') {
      rows = whatIfRows(preview.whatIf);
      caption = PREVIEW_LABELS.whatif;
    } else {
      rows = impactRows(suggestion);
      caption = PREVIEW_LABELS.advisor;
    }
  }
  const titleId = `asst-card-${suggestion.suggestion_id}`;
  return (
    <li className="asst-card" aria-labelledby={titleId}>
      <div className="asst-card__top">
        <h3 id={titleId} className="asst-card__title">
          {suggestionTitle(suggestion)}
        </h3>
        <span className="asst-chip" title={PROVENANCE_HINT}>
          {PROVENANCE_CHIP}
        </span>
      </div>
      <p className="asst-card__line">{line.line}</p>
      {effect.text && (
        <p className={`asst-card__note ${effect.tone === 'small' ? 'asst-card__note--small' : ''}`}>{effect.text}</p>
      )}
      {extra && <p className="asst-card__extra">{extra}</p>}
      <details className="asst-details">
        <summary>Assumptions</summary>
        <p>{assumptionText(suggestion)}</p>
      </details>
      {loading && (
        <p className="asst-card__note" role="status">
          Running the simulation...
        </p>
      )}
      {preview?.status === 'error' && (
        <p className="asst-card__note asst-card__note--small" role="alert">
          {preview.error || 'Preview failed'}
        </p>
      )}
      {rows.length > 0 && <ImpactTable rows={rows} caption={caption} />}
      {preview?.status === 'ready' && preview.kind === 'whatif' && preview.whatIf?.pipe_warnings?.length > 0 && (
        <ul className="asst-list asst-list--warn">
          {preview.whatIf.pipe_warnings.slice(0, 3).map((w) => (
            <li key={`${w.pipe_id}-${w.warning_type}`}>{w.message}</li>
          ))}
        </ul>
      )}
      <div className="asst__actions">
        <Button variant="primary" size="sm" onClick={() => onPreview?.(suggestion)} busy={loading} disabled={disabled}>
          Preview impact
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onApply?.(suggestion)} disabled={disabled || loading}>
          Apply...
        </Button>
      </div>
    </li>
  );
}
