import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Position, useReactFlow } from '@xyflow/react';
import {
  createDemoDraft,
  createEmptyDraft,
  makeNextId,
  normalizeDraft,
  STUDIO_DRAFT_KEY,
  validateDraft,
} from '../../lib/networkStudio.js';
import { NODE_TYPES } from './nodes.jsx';
import { TOOL_ITEMS } from './ToolRail.jsx';

const clone = (value) => JSON.parse(JSON.stringify(value));

export default function useStudioDraft({ initialNetwork, networkSource }) {
  const [draft, setDraft] = useState(() => createEmptyDraft());
  const draftRef = useRef(draft);
  const [tool, setTool] = useState('select');
  const [selection, setSelection] = useState(null);
  const [pendingConnection, setPendingConnection] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [notice, setNotice] = useState('');
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [viewVersion, setViewVersion] = useState(0);
  const [projectNameDraft, setProjectNameDraft] = useState(draft.project.name);
  const fileInput = useRef(null);
  const dragSnapshot = useRef(null);
  const flow = useReactFlow();
  const validation = useMemo(() => validateDraft(draft), [draft]);
  const allIssues = [...validation.errors, ...validation.warnings];

  const replaceDraft = useCallback((next, markDirty = true) => {
    const normalized = normalizeDraft(next);
    draftRef.current = normalized;
    setDraft(normalized);
    setProjectNameDraft(normalized.project.name);
    setSelection(null);
    setPendingConnection(null);
    setPast([]);
    setFuture([]);
    setDirty(markDirty);
    setViewVersion((version) => version + 1);
  }, []);

  const commit = useCallback((mutate) => {
    const before = draftRef.current;
    const next = mutate(clone(before));
    if (!next || JSON.stringify(next) === JSON.stringify(before)) return;
    setPast((items) => [...items.slice(-49), clone(before)]);
    setFuture([]);
    draftRef.current = next;
    setDraft(next);
    setProjectNameDraft(next.project.name);
    setDirty(true);
  }, []);

  const setLiveDocument = useCallback((mutate) => {
    const next = mutate(clone(draftRef.current));
    draftRef.current = next;
    setDraft(next);
    setDirty(true);
  }, []);

  const loadDemo = useCallback(() => {
    if (dirty && !window.confirm('Discard unsaved changes and load the Kengeri sample?')) return;
    try {
      replaceDraft(createDemoDraft(initialNetwork, networkSource), true);
      setNotice(networkSource === 'synthetic' ? 'Loaded the synthetic Kengeri demo. Its engineering data is illustrative.' : 'Loaded a schematic sample from the current Kengeri network.');
    } catch (error) {
      setNotice(error.message);
    }
  }, [dirty, initialNetwork, networkSource, replaceDraft]);

  const newBlank = useCallback(() => {
    if (dirty && !window.confirm('Discard unsaved changes and start a blank network?')) return;
    replaceDraft(createEmptyDraft(), true);
    setNotice('Blank schematic created. Add a source, then place and connect nodes.');
  }, [dirty, replaceDraft]);

  const saveDraft = useCallback(() => {
    const saved = { ...draftRef.current, saved_at: new Date().toISOString() };
    try {
      localStorage.setItem(STUDIO_DRAFT_KEY, JSON.stringify(saved));
      draftRef.current = saved;
      setDraft(saved);
      setDirty(false);
      setNotice('Draft saved in this browser.');
    } catch {
      setNotice('Could not save this draft in browser storage. Export the JSON file instead.');
    }
  }, []);

  const reopenDraft = useCallback(() => {
    if (dirty && !window.confirm('Discard unsaved changes and reopen the saved draft?')) return;
    try {
      const raw = localStorage.getItem(STUDIO_DRAFT_KEY);
      if (!raw) {
        setNotice('No saved draft was found in this browser.');
        return;
      }
      replaceDraft(JSON.parse(raw), false);
      setNotice('Saved draft reopened.');
    } catch (error) {
      setNotice(error.message || 'The saved draft could not be opened.');
    }
  }, [dirty, replaceDraft]);

  const exportDraft = useCallback(() => {
    const blob = new Blob([JSON.stringify(draftRef.current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(draftRef.current.project.name || 'hydropulse-draft').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Draft JSON exported.');
  }, []);

  const importDraft = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (dirty && !window.confirm('Discard unsaved changes and open this draft file?')) return;
    try {
      replaceDraft(JSON.parse(await file.text()), false);
      setNotice(`Opened ${file.name}.`);
    } catch (error) {
      setNotice(error.message || 'Could not read this draft file.');
    }
  }, [dirty, replaceDraft]);

  const undo = useCallback(() => {
    if (!past.length) return;
    const previous = past[past.length - 1];
    setFuture((items) => [...items, clone(draftRef.current)]);
    setPast((items) => items.slice(0, -1));
    draftRef.current = previous;
    setDraft(previous);
    setProjectNameDraft(previous.project.name);
    setDirty(true);
    setSelection(null);
  }, [past]);

  const redo = useCallback(() => {
    if (!future.length) return;
    const next = future[future.length - 1];
    setPast((items) => [...items, clone(draftRef.current)]);
    setFuture((items) => items.slice(0, -1));
    draftRef.current = next;
    setDraft(next);
    setProjectNameDraft(next.project.name);
    setDirty(true);
    setSelection(null);
  }, [future]);

  const updateField = useCallback((id, field, value, kind) => {
    commit((next) => {
      if (kind === 'label') next.editor_layout.labels[id] = value;
      else if (kind === 'notes') next.editor_layout.notes[id] = value;
      else if (kind === 'pipe') {
        next.network.pipes = next.network.pipes.map((pipe) => pipe.id === id ? { ...pipe, [field]: value } : pipe);
      } else {
        next.network.nodes = next.network.nodes.map((node) => node.id === id ? { ...node, [field]: value } : node);
      }
      return next;
    });
  }, [commit]);

  const addNode = useCallback((type, position, geo) => {
    const before = draftRef.current;
    const id = makeNextId(type, before.network.nodes, before.network.pipes);
    const node = {
      id,
      type,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      elevation_m: geo?.elevation_m ?? (geo ? Math.round(790 + (geo.lat - 12.9) * 200) : null),
      base_pressure_m: null,
      base_demand_lps: type === 'junction' ? null : 0,
      households: null,
      is_sensor: false,
      leak_probability: 0,
    };
    commit((next) => {
      next.network.nodes.push(node);
      next.editor_layout.positions[id] = {
        x: Math.round(position.x / 20) * 20,
        y: Math.round(position.y / 20) * 20,
      };
      next.editor_layout.labels[id] = `${type[0].toUpperCase()}${type.slice(1)} ${id.split('-').at(-1)}`;
      return next;
    });
    setSelection({ type: 'node', id });
    setNotice(`${type[0].toUpperCase()}${type.slice(1)} ${id} added.${geo ? ' Position and elevation recorded on map.' : ' Set its required properties in the right panel.'}`);
  }, [commit]);

  const addPipe = useCallback((source, target) => {
    const current = draftRef.current;
    if (source === target) {
      setNotice('A pipe must connect two different nodes.');
      return;
    }
    const exists = current.network.pipes.some((pipe) =>
      (pipe.source === source && pipe.target === target) ||
      (pipe.source === target && pipe.target === source),
    );
    if (exists) {
      setNotice('Those nodes already have a pipe between them.');
      return;
    }
    const id = makeNextId('pipe', current.network.nodes, current.network.pipes);
    const srcNode = current.network.nodes.find((n) => n.id === source);
    const tgtNode = current.network.nodes.find((n) => n.id === target);
    let autoLength = null;
    if (srcNode?.lat && srcNode?.lng && tgtNode?.lat && tgtNode?.lng) {
      const R = 6371e3;
      const dLat = ((tgtNode.lat - srcNode.lat) * Math.PI) / 180;
      const dLng = ((tgtNode.lng - srcNode.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((srcNode.lat * Math.PI) / 180) *
          Math.cos((tgtNode.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      autoLength = Math.max(10, Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))));
    }
    commit((next) => {
      next.network.pipes.push({
        id,
        source,
        target,
        diameter_mm: 150,
        length_m: autoLength,
        flow_m3h: null,
        status: 'OPEN',
        road_class: null,
      });
      return next;
    });
    setSelection({ type: 'pipe', id });
    setPendingConnection(null);
    setNotice(`Pipe ${id} added${autoLength ? ` (${autoLength}m based on GPS coordinates)` : ''}.`);
  }, [commit]);

  const requestDelete = useCallback((item) => {
    if (!item) return;
    const connected = item.type === 'node'
      ? draftRef.current.network.pipes.filter((pipe) => pipe.source === item.id || pipe.target === item.id)
      : [];
    if (connected.length) setPendingDelete({ ...item, connected });
    else setPendingDelete({ ...item, connected: [] });
  }, []);

  const confirmDelete = useCallback(() => {
    const item = pendingDelete;
    if (!item) return;
    commit((next) => {
      if (item.type === 'node') {
        next.network.nodes = next.network.nodes.filter((node) => node.id !== item.id);
        next.network.pipes = next.network.pipes.filter((pipe) => pipe.source !== item.id && pipe.target !== item.id);
        delete next.editor_layout.positions[item.id];
        delete next.editor_layout.labels[item.id];
        delete next.editor_layout.notes[item.id];
      } else {
        next.network.pipes = next.network.pipes.filter((pipe) => pipe.id !== item.id);
      }
      return next;
    });
    setSelection(null);
    setPendingDelete(null);
    setNotice(`${item.id} and any dependent pipes were deleted. Undo can restore them.`);
  }, [commit, pendingDelete]);

  const handleNodeClick = useCallback((_event, node) => {
    if (tool === 'delete') {
      requestDelete({ type: 'node', id: node.id });
      return;
    }
    if (tool === 'pipe') {
      if (!pendingConnection) {
        setPendingConnection(node.id);
        setSelection({ type: 'node', id: node.id });
        setNotice(`Starting at ${node.id}. Choose a different node to finish the pipe.`);
      } else {
        addPipe(pendingConnection, node.id);
      }
      return;
    }
    setSelection({ type: 'node', id: node.id });
  }, [tool, pendingConnection, requestDelete, addPipe]);

  const handleEdgeClick = useCallback((_event, edge) => {
    if (tool === 'delete') requestDelete({ type: 'pipe', id: edge.id });
    else if (edge.data?.preview) return;
    else setSelection({ type: 'pipe', id: edge.id });
  }, [tool, requestDelete]);

  const onPaneClick = useCallback((event) => {
    if (NODE_TYPES.includes(tool)) {
      addNode(tool, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    } else if (tool === 'select') {
      setSelection(null);
    } else if (tool === 'delete') {
      setSelection(null);
    }
  }, [tool, addNode, flow]);

  const onNodesChange = useCallback((changes) => {
    const positions = changes.filter((change) => change.type === 'position' && change.position);
    if (positions.length) {
      setLiveDocument((next) => {
        for (const change of positions) next.editor_layout.positions[change.id] = change.position;
        return next;
      });
    }
    for (const change of changes) {
      if (change.type === 'select') {
        setSelection(change.selected ? { type: 'node', id: change.id } : null);
      }
    }
  }, [setLiveDocument]);

  // Explicit dimensions, measured geometry, and handle definitions ensure React Flow can
  // synchronously resolve handle bounds on every render without waiting for ResizeObserver,
  // preventing controlled edges from temporarily vanishing when selection or draft state updates.
  const nodes = useMemo(() => draft.network.nodes.map((node) => ({
    id: node.id,
    type: 'studioNode',
    width: 160,
    height: 56,
    initialWidth: 160,
    initialHeight: 56,
    measured: { width: 160, height: 56 },
    handles: [
      { id: 'in', type: 'target', position: Position.Left, x: 0, y: 28, width: 8, height: 8 },
      { id: 'out', type: 'source', position: Position.Right, x: 160, y: 28, width: 8, height: 8 },
    ],
    position: draft.editor_layout.positions[node.id] || { x: 0, y: 0 },
    selected: selection?.type === 'node' && selection.id === node.id,
    data: {
      componentType: node.type,
      label: draft.editor_layout.labels[node.id] || node.id,
      pending: pendingConnection === node.id,
      elevation_m: node.elevation_m,
      pressure_m: node.simulated_pressure_m ?? node.base_pressure_m,
      is_sensor: node.is_sensor,
    },
  })), [draft.network.nodes, draft.editor_layout.positions, draft.editor_layout.labels, selection, pendingConnection]);

  const flowNodes = useMemo(() => {
    if (!pendingConnection || !cursor) return nodes;
    return [...nodes, {
      id: '__connection-preview__',
      type: 'studioNode',
      width: 2,
      height: 2,
      initialWidth: 2,
      initialHeight: 2,
      measured: { width: 2, height: 2 },
      handles: [
        { id: 'in', type: 'target', position: Position.Left, x: 0, y: 1, width: 2, height: 2 },
      ],
      position: cursor,
      selectable: false,
      draggable: false,
      connectable: false,
      data: { preview: true },
    }];
  }, [nodes, pendingConnection, cursor]);

  const edges = useMemo(() => {
    const nodeIds = new Set(draft.network.nodes.map((node) => node.id));
    const real = draft.network.pipes.map((pipe) => ({
      id: pipe.id,
      source: pipe.source,
      target: pipe.target,
      sourceHandle: 'out',
      targetHandle: 'in',
      type: 'studioPipe',
      selected: selection?.type === 'pipe' && selection.id === pipe.id,
      data: { status: pipe.status, diameter: pipe.diameter_mm, showLabel: false },
    })).filter((edge) =>
      edge.source !== edge.target && nodeIds.has(edge.source) && nodeIds.has(edge.target),
    );
    if (!pendingConnection || !cursor) return real;
    return [...real, {
      id: '__connection-preview__',
      source: pendingConnection,
      target: '__connection-preview__',
      sourceHandle: 'out',
      targetHandle: 'in',
      type: 'studioPipe',
      selectable: false,
      focusable: false,
      data: { preview: true, previewEnd: cursor },
    }];
  }, [draft.network.pipes, selection, pendingConnection, cursor]);

  const startDrag = useCallback(() => {
    dragSnapshot.current = clone(draftRef.current);
  }, []);

  const finishDrag = useCallback(() => {
    const before = dragSnapshot.current;
    const after = draftRef.current;
    dragSnapshot.current = null;
    if (before && JSON.stringify(before.editor_layout.positions) !== JSON.stringify(after.editor_layout.positions)) {
      setPast((items) => [...items.slice(-49), before]);
      setFuture([]);
    }
  }, []);

  const onMoveEnd = useCallback((_event, viewport) => {
    const current = draftRef.current.editor_layout.viewport || {};
    if (
      Math.abs((current.x || 0) - viewport.x) < 0.01 &&
      Math.abs((current.y || 0) - viewport.y) < 0.01 &&
      Math.abs((current.zoom || 1) - viewport.zoom) < 0.001
    ) return;
    setLiveDocument((next) => {
      next.editor_layout.viewport = viewport;
      return next;
    });
  }, [setLiveDocument]);

  const focusIssue = useCallback((issue) => {
    setSelection({ type: issue.objectType, id: issue.objectId });
    if (issue.objectType === 'node') flow.fitView({ nodes: [{ id: issue.objectId }], duration: 350, padding: 0.7 });
    else {
      const pipe = draftRef.current.network.pipes.find((item) => item.id === issue.objectId);
      if (pipe) flow.fitView({ nodes: [{ id: pipe.source }, { id: pipe.target }], duration: 350, padding: 0.7 });
    }
    setIssuesOpen(false);
  }, [flow]);

  const changeTool = useCallback((nextTool) => {
    setTool(nextTool);
    setPendingConnection(null);
    setCursor(null);
    if (nextTool !== 'select') setSelection(null);
  }, []);

  useEffect(() => {
    const preventClose = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventClose);
    return () => window.removeEventListener('beforeunload', preventClose);
  }, [dirty]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        if (typing) return;
        event.preventDefault();
        event.shiftKey ? redo() : undo();
        return;
      }
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'escape') {
        setPendingConnection(null);
        if (tool !== 'select') changeTool('select');
      } else if (key === 'delete' || key === 'backspace') {
        if (selection) {
          event.preventDefault();
          requestDelete(selection);
        }
      } else {
        const item = TOOL_ITEMS.find((candidate) => candidate.key.toLowerCase() === key);
        if (item && item.id !== 'delete') changeTool(item.id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, tool, changeTool, selection, requestDelete]);

  useEffect(() => {
    const onSaveKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveDraft();
      }
    };
    window.addEventListener('keydown', onSaveKey);
    return () => window.removeEventListener('keydown', onSaveKey);
  }, [saveDraft]);

  const autoLayout = useCallback(() => {
    const current = draftRef.current;
    const nodes = current.network.nodes;
    const pipes = current.network.pipes;
    if (!nodes.length) return;

    const adj = new Map();
    nodes.forEach((n) => adj.set(n.id, []));
    pipes.forEach((p) => {
      if (adj.has(p.source)) adj.get(p.source).push(p.target);
      if (adj.has(p.target)) adj.get(p.target).push(p.source);
    });

    const visited = new Set();
    const levels = new Map();
    const roots = nodes.filter((n) => n.type === 'reservoir' || n.type === 'tank').map((n) => n.id);
    const queue = roots.length ? roots.slice() : [nodes[0].id];
    queue.forEach((r) => { visited.add(r); levels.set(r, 0); });

    let qHead = 0;
    while (qHead < queue.length) {
      const cur = queue[qHead++];
      const curLvl = levels.get(cur) || 0;
      for (const neighbor of adj.get(cur) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          levels.set(neighbor, curLvl + 1);
          queue.push(neighbor);
        }
      }
    }
    nodes.forEach((n) => {
      if (!visited.has(n.id)) levels.set(n.id, 0);
    });

    const levelGroups = new Map();
    nodes.forEach((n) => {
      const lvl = levels.get(n.id) || 0;
      if (!levelGroups.has(lvl)) levelGroups.set(lvl, []);
      levelGroups.get(lvl).push(n.id);
    });

    const X_SPACING = 200;
    const Y_SPACING = 90;
    const newPositions = {};

    levelGroups.forEach((groupNodes, lvl) => {
      const totalH = (groupNodes.length - 1) * Y_SPACING;
      const startY = 120 - totalH / 2;
      groupNodes.forEach((nodeId, idx) => {
        newPositions[nodeId] = {
          x: 100 + lvl * X_SPACING,
          y: Math.round((startY + idx * Y_SPACING) / 20) * 20,
        };
      });
    });

    commit((next) => {
      next.editor_layout.positions = {
        ...next.editor_layout.positions,
        ...newPositions,
      };
      return next;
    });
    setNotice('Schematic layout reorganized.');
  }, [commit]);

  const placeHint = NODE_TYPES.includes(tool)
    ? `Click the canvas to place a ${tool}.`
    : tool === 'pipe'
      ? pendingConnection ? `Choose the second endpoint for ${pendingConnection}.` : 'Click a starting node, then an ending node.'
      : tool === 'delete'
        ? 'Click an object to delete it.'
        : 'Drag stations to arrange the schematic. Click an object to edit its properties.';

  return {
    draft,
    dirty,
    notice,
    projectNameDraft,
    tool,
    selection,
    pendingConnection,
    cursor,
    issuesOpen,
    pendingDelete,
    viewVersion,
    past,
    future,
    draftRef,
    fileInput,
    setNotice,
    setProjectNameDraft,
    setSelection,
    setPendingConnection,
    setCursor,
    setIssuesOpen,
    setPendingDelete,
    replaceDraft,
    commit,
    setLiveDocument,
    loadDemo,
    newBlank,
    saveDraft,
    reopenDraft,
    exportDraft,
    importDraft,
    undo,
    redo,
    updateField,
    addNode,
    addPipe,
    requestDelete,
    confirmDelete,
    handleNodeClick,
    handleEdgeClick,
    onPaneClick,
    onNodesChange,
    flowNodes,
    edges,
    startDrag,
    finishDrag,
    onMoveEnd,
    focusIssue,
    changeTool,
    validation,
    allIssues,
    autoLayout,
    placeHint,
  };
}
