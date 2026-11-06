import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, EmptyState } from '../../ui/index.js';
import SuggestionCard from './SuggestionCard.jsx';
import ApplyConfirmModal from './ApplyConfirmModal.jsx';
import { PANEL_COPY, appliedMessage } from '../../lib/assistantCopy.js';
import './assistant.css';

/**
 * AssistantPanel: the "Suggestions" list.
 * Props:
 *   assistant  the object returned by useAssistant() (the parent owns the hook)
 *   onNotify   (tone: 'water'|'leak', message: string) => void, optional
 * Shows at most 3 suggestions until "Show all" is pressed.
 */
const VISIBLE = 3;

export default function AssistantPanel({ assistant, onNotify }) {
  const { status, suggestions, error, refresh, previews, previewImpact, apply, applying, undo, undoing, lastApplied } =
    assistant;
  const [showAll, setShowAll] = useState(false);
  const [target, setTarget] = useState(null); // suggestion being applied
  const [undoOpen, setUndoOpen] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 15000);
    return () => clearTimeout(t);
  }, [toast]);

  const list = showAll ? suggestions : suggestions.slice(0, VISIBLE);
  const blocked = status === 'stale' || status === 'offline';

  const confirmApply = async (token) => {
    const res = await apply(target, token);
    const msg = appliedMessage(res);
    setTarget(null);
    setToast(msg);
    onNotify?.('water', msg);
  };

  const confirmUndo = async (token) => {
    await undo(token);
    setUndoOpen(false);
    setToast('');
    onNotify?.('water', 'Last change undone');
  };

  return (
    <section className="asst" aria-labelledby="asst-title">
      <div className="asst__head">
        <h2 id="asst-title" className="asst__title">
          {PANEL_COPY.title}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          icon={RefreshCw}
          onClick={refresh}
          busy={status === 'loading'}
          disabled={status === 'offline'}
        >
          Refresh
        </Button>
      </div>

      {status === 'offline' && <EmptyState title={PANEL_COPY.offline} />}

      {status === 'loading' && (
        <div className="asst-skel" role="status" aria-busy="true">
          <span className="asst-sr">{PANEL_COPY.loading}</span>
          <p className="asst__msg">{PANEL_COPY.loading}</p>
          <div className="asst-skel__bar" />
          <div className="asst-skel__bar" />
          <div className="asst-skel__bar" />
        </div>
      )}

      {status === 'error' && (
        <div className="asst__msg asst__msg--bad" role="alert">
          <p>{PANEL_COPY.error}{error ? `: ${error}` : ''}</p>
          <Button variant="secondary" size="sm" onClick={refresh}>
            Retry
          </Button>
        </div>
      )}

      {status === 'empty' && <EmptyState title={PANEL_COPY.empty} />}

      {status === 'stale' && (
        <p className="asst__msg asst__msg--warn" role="status">
          {PANEL_COPY.stale}
        </p>
      )}

      {(status === 'ready' || status === 'stale') && suggestions.length > 0 && (
        <ul className="asst__list">
          {list.map((s) => (
            <SuggestionCard
              key={s.suggestion_id}
              suggestion={s}
              preview={previews[s.suggestion_id]}
              onPreview={previewImpact}
              onApply={setTarget}
              disabled={blocked}
            />
          ))}
        </ul>
      )}

      {suggestions.length > VISIBLE && !blocked && (
        <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
          {showAll ? 'Show fewer' : `Show all (${suggestions.length})`}
        </Button>
      )}

      {lastApplied && !toast && (
        <Button variant="ghost" size="sm" onClick={() => setUndoOpen(true)}>
          Undo last change
        </Button>
      )}

      <ApplyConfirmModal
        open={!!target}
        suggestion={target}
        busy={applying}
        onClose={() => setTarget(null)}
        onConfirm={confirmApply}
      />
      <ApplyConfirmModal
        open={undoOpen}
        mode="undo"
        undoTitle={lastApplied?.title}
        busy={undoing}
        onClose={() => setUndoOpen(false)}
        onConfirm={confirmUndo}
      />

      {toast && (
        <div className="asst-toast" role="status" aria-live="polite">
          <p>{toast}. Only one undo step exists.</p>
          <Button variant="secondary" size="sm" onClick={() => setUndoOpen(true)}>
            Undo
          </Button>
        </div>
      )}
    </section>
  );
}
