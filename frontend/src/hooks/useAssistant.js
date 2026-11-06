import { useCallback, useEffect, useRef, useState } from 'react';
import { client } from '../api/client.js';

/**
 * useAssistant: loads AI suggestions once per network revision.
 *
 * Options:
 *   networkRevision  string   current revision from health/network (cache key)
 *   enabled          boolean  fetch only when the panel is in use (default true)
 *   live             boolean  false when the app runs on recorded data (default true)
 *   onNetworkChanged () => Promise|void   call the app's existing load() after apply/undo
 *   openRouterKey    string   optional, sent as a header only
 *
 * Returns:
 *   status       'idle'|'loading'|'ready'|'empty'|'error'|'stale'|'offline'
 *   suggestions, benchmark, revision, error, refresh()
 *   previews     { [suggestion_id]: { status, kind, label, rows?, whatIf?, error? } }
 *   previewImpact(suggestion), clearPreview(id)
 *   apply(suggestion, adminToken) -> response, applying, canUndo, lastApplied
 *   undo(adminToken), undoing
 * The admin token is only ever a function argument. It is never stored.
 */
export function useAssistant({
  networkRevision,
  enabled = true,
  live = true,
  onNetworkChanged,
  openRouterKey,
} = {}) {
  const offline = !live || client.forcedMock;
  const [status, setStatus] = useState('idle');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [previews, setPreviews] = useState({});
  const [applying, setApplying] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [lastApplied, setLastApplied] = useState(null);

  const cache = useRef(new Map()); // revision -> AiSuggestionsResponse
  const dataRef = useRef(null);
  const inflight = useRef(0); // number of loads running
  const seq = useRef(0);
  const mounted = useRef(true);
  const onChangedRef = useRef(onNetworkChanged);
  onChangedRef.current = onNetworkChanged;
  const keyRef = useRef(openRouterKey);
  keyRef.current = openRouterKey;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const show = useCallback((res) => {
    dataRef.current = res;
    setData(res);
    setError('');
    setStatus(res.suggestions?.length ? 'ready' : 'empty');
  }, []);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    inflight.current += 1;
    setStatus('loading');
    setError('');
    try {
      const res = await client.getSuggestions({ openRouterKey: keyRef.current });
      if (!mounted.current || mine !== seq.current) return null;
      cache.current.set(res.network_revision, res);
      show(res);
      return res;
    } catch (e) {
      if (!mounted.current || mine !== seq.current) return null;
      setError(e.message || 'Could not load suggestions');
      setStatus('error');
      return null;
    } finally {
      inflight.current -= 1;
    }
  }, [show]);

  // Once per revision: cached revisions never refetch; a changed revision shows "stale" until Refresh.
  useEffect(() => {
    if (!enabled) return;
    if (offline) {
      setStatus('offline');
      return;
    }
    if (inflight.current > 0) return;
    const hit = networkRevision ? cache.current.get(networkRevision) : null;
    if (hit) {
      show(hit);
    } else if (dataRef.current && networkRevision && dataRef.current.network_revision !== networkRevision) {
      setStatus('stale');
    } else if (!dataRef.current) {
      load();
    }
  }, [networkRevision, enabled, offline, show, load]);

  const refresh = useCallback(() => {
    if (offline) {
      setStatus('offline');
      return Promise.resolve(null);
    }
    cache.current.clear();
    setPreviews({});
    return load();
  }, [offline, load]);

  const setPreview = (id, value) => setPreviews((p) => ({ ...p, [id]: value }));
  const clearPreview = useCallback((id) => {
    setPreviews((p) => {
      const { [id]: _drop, ...rest } = p;
      return rest;
    });
  }, []);

  const previewImpact = useCallback(
    async (s) => {
      if (!s) return null;
      const id = s.suggestion_id;
      const rev = dataRef.current?.network_revision;
      if (s.category === 'pipe_upsizing' && s.proposed_parameters?.pipe_id) {
        setPreview(id, { status: 'loading', kind: 'whatif' });
        try {
          const res = await client.whatIf({
            pipe_overrides: [
              { pipe_id: s.proposed_parameters.pipe_id, diameter_mm: s.proposed_parameters.proposed_diameter_mm },
            ],
            expected_network_revision: rev,
          });
          if (!mounted.current) return null;
          const out = { status: 'ready', kind: 'whatif', whatIf: res };
          setPreview(id, out);
          return out;
        } catch (e) {
          if (!mounted.current) return null;
          setPreview(id, { status: 'error', kind: 'whatif', error: e.message });
          if (e.status === 409) setStatus('stale');
          return null;
        }
      }
      // What-if cannot add a pipe or move sensors, so use the advisor's own simulated numbers.
      const out = { status: 'ready', kind: 'advisor' };
      setPreview(id, out);
      return out;
    },
    [],
  );

  const afterChange = useCallback(async () => {
    cache.current.clear();
    setPreviews({});
    try {
      await onChangedRef.current?.();
    } catch (err) {
      console.debug('Error in afterChange callback:', err);
    }
    return load();
  }, [load]);

  const apply = useCallback(
    async (s, adminToken) => {
      setApplying(true);
      try {
        const res = await client.applySuggestion({
          suggestion_id: s.suggestion_id,
          expected_network_revision: dataRef.current?.network_revision || s.source_network_revision,
          adminToken,
        });
        if (mounted.current) {
          setLastApplied({
            suggestion_id: s.suggestion_id,
            title: s.title,
            previous_network_revision: res.previous_network_revision,
            new_network_revision: res.new_network_revision,
            mutation_summary: res.mutation_summary,
          });
        }
        await afterChange();
        return res;
      } catch (e) {
        if (mounted.current) {
          if (e.status === 409) setStatus('stale');
          if (e.status === 404) await load();
        }
        throw e;
      } finally {
        if (mounted.current) setApplying(false);
      }
    },
    [afterChange, load],
  );

  const undo = useCallback(
    async (adminToken) => {
      setUndoing(true);
      try {
        const res = await client.undoLast({ adminToken });
        if (mounted.current) setLastApplied(null);
        await afterChange();
        return res;
      } finally {
        if (mounted.current) setUndoing(false);
      }
    },
    [afterChange],
  );

  return {
    status: enabled && offline ? 'offline' : status,
    suggestions: data?.suggestions || [],
    benchmark: data?.sensor_benchmark || null,
    revision: data?.network_revision || '',
    error,
    refresh,
    previews,
    previewImpact,
    clearPreview,
    apply,
    applying,
    undo,
    undoing,
    canUndo: !!lastApplied,
    lastApplied,
  };
}

export default useAssistant;
