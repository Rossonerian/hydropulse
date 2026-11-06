import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  Crosshair,
  Eye,
  GitBranch,
  Layers,
  Maximize2,
  Minimize2,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  Waves,
  X,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import HoldToConfirmButton from './HoldToConfirmButton.jsx';
import SkeletonLoader from './SkeletonLoader.jsx';
import {
  KENGERI_AOI,
  REAL_WORLD_FEATURES,
  projectToMetricScene,
  unprojectFromMetricScene,
  calculatePolylineLength,
  interpolateMidpoint,
} from '../lib/realWorldData.js';


const DEFAULT_CAM = { azimuth: 45, elevation: 35, zoom: 1.0, panX: 0, panY: 0 };

// Forward isometric projection with trig/scale computed once per frame; `to` writes into x/y.
function makeProjector(cam, width, height) {
  const azRad = (cam.azimuth * Math.PI) / 180;
  const elRad = (cam.elevation * Math.PI) / 180;
  const cosAz = Math.cos(azRad);
  const sinAz = Math.sin(azRad);
  const cosEl = Math.cos(elRad);
  const sinEl = Math.sin(elRad);
  const scale = (cam.zoom * 0.22 * Math.min(width, height)) / 600;
  const cx = width / 2 + cam.panX;
  const cy = height / 2 + cam.panY;
  const o = {
    x: 0,
    y: 0,
    to(x, y, z) {
      const rx = x * cosAz - z * sinAz;
      const rz = x * sinAz + z * cosAz;
      const py = y * cosEl - rz * sinEl;
      o.x = cx + rx * scale;
      o.y = cy - py * scale;
    },
  };
  return o;
}

// Inverse projection: screen point to metric scene (x, z) at target plane y.
function unprojectScreen(cam, screenX, screenY, yTarget, width, height) {
  const azRad = (cam.azimuth * Math.PI) / 180;
  const elRad = (cam.elevation * Math.PI) / 180;
  const cosAz = Math.cos(azRad);
  const sinAz = Math.sin(azRad);
  const cosEl = Math.cos(elRad);
  const sinEl = Math.sin(elRad);
  const scale = (cam.zoom * 0.22 * Math.min(width, height)) / 600;
  const rx = (screenX - width / 2 - cam.panX) / scale;
  const py = (height / 2 + cam.panY - screenY) / scale;
  const safeSinEl = Math.abs(sinEl) < 0.05 ? (sinEl < 0 ? -0.05 : 0.05) : sinEl;
  const rz = (yTarget * cosEl - py) / safeSinEl;
  return { x: rx * cosAz + rz * sinAz, z: -rx * sinAz + rz * cosAz };
}


export default function Terrain3DViewer({
  network,
  result,
  phase = 'idle',
  selected,
  setSelected,
  judge = false,
  revealed = false,
  mode = 'mock',
  onUpdateDraft,
  showIllustrativeDepth: propDepth,
  onToggleDepth: propToggleDepth,
  visibleLayers = {},
  selectedFeature,
  onSelectFeature,
  onReady,
}) {
  const canvasRef = useRef(null);
  const readyRef = useRef(false);
  const [internalDepth, setInternalDepth] = useState(true);
  const showIllustrativeDepth = propDepth ?? internalDepth;
  const toggleDepth = propToggleDepth ?? (() => setInternalDepth((d) => !d));

  // Interaction Mode: 'navigate' (camera orbit/pan/zoom) vs 'edit' (pipe/junction modification)
  const [interactionMode, setInteractionMode] = useState('navigate');

  // Camera lives in a ref, not React state: orbit/pan/zoom must not re-render the component
  // (and the HUD inspector) on every mouse event. A draw is scheduled on demand instead.
  const camRef = useRef({ ...DEFAULT_CAM });
  const compassIconRef = useRef(null);
  const compassTextRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const rafRef = useRef(0);
  const drawRef = useRef(null);

  // Camera Dragging State (cursor only; the drag itself is tracked in a ref)
  const [isNavDragging, setIsNavDragging] = useState(false);
  const navDragStart = useRef({ x: 0, y: 0, azimuth: 45, elevation: 35, panX: 0, panY: 0, button: 0, active: false });


  // Active Draft Network for Local Edits
  const [draftNetwork, setDraftNetwork] = useState(network || null);
  const [historyPast, setHistoryPast] = useState([]);
  const [historyFuture, setHistoryFuture] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [validationMsg, setValidationMsg] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');

  // Keep draft in sync if external network updates and no local edits have been made
  useEffect(() => {
    if (!dirty && network) {
      setDraftNetwork(network);
    }
  }, [network, dirty]);

  // Handle Dragging in Edit Mode
  const [activeDragHandle, setActiveDragHandle] = useState(null); // { type: 'vertex'|'node', pipeId, vertexIdx, nodeId }
  const dragHandleRef = useRef(null);

  // DEM terrain grid across Kengeri AOI (808m to 838m), built once.
  const terrainGrid = useMemo(() => {
    const grid = [];
    const cols = 16;
    const rows = 16;
    const { south, west, north, east } = KENGERI_AOI.bbox;
    for (let r = 0; r <= rows; r++) {
      const row = [];
      const lat = south + (r / rows) * (north - south);
      for (let c = 0; c <= cols; c++) {
        const lng = west + (c / cols) * (east - west);
        // Realistic Kengeri ridge topography
        const elevation =
          810.0 +
          (c / cols) * 16.0 +
          (r / rows) * 8.5 +
          Math.sin(c * 0.45) * 3.5 +
          Math.cos(r * 0.4) * 2.0;
        row.push(projectToMetricScene(lat, lng, elevation));
      }
      grid.push(row);
    }
    return grid;
  }, []);

  const waterLines = useMemo(
    () =>
      REAL_WORLD_FEATURES.waterBodies
        .filter((wb) => wb.type === 'line')
        .map((wb) => wb.coordinates.map((coord) => projectToMetricScene(coord[0], coord[1], 808))),
    [],
  );

  // Schedule one draw on the next animation frame (coalesces any number of requests).
  const requestDraw = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      drawRef.current?.();
    });
  }, []);

  // Update the compass readout straight in the DOM (no React render per orbit event).
  const syncCompass = () => {
    const { azimuth, elevation } = camRef.current;
    if (compassIconRef.current) compassIconRef.current.style.transform = `rotate(${-azimuth}deg)`;
    if (compassTextRef.current)
      compassTextRef.current.textContent = `${Math.round(azimuth)}° Az · ${Math.round(elevation)}° El`;
  };
  const updateCam = (patch) => {
    Object.assign(camRef.current, patch);
    syncCompass();
    requestDraw();
  };


  // Nodes indexed by ID
  const activeNodes = draftNetwork?.nodes || [];
  const activePipes = draftNetwork?.pipes || [];
  const byId = useMemo(
    () => Object.fromEntries(activeNodes.map((n) => [n.id, n])),
    [activeNodes],
  );

  const valving = useMemo(
    () => new Set(phase === 'isolated' ? result?.recommended_valves_to_close || [] : []),
    [phase, result],
  );

  const isolatedNodes = useMemo(
    () => new Set(phase === 'isolated' ? result?.isolated_node_ids || [] : []),
    [phase, result],
  );

  const sensors = useMemo(
    () => new Map((draftNetwork?.sensor_ids || []).map((id, index) => [id, index + 1])),
    [draftNetwork],
  );

  const top = result?.predicted_top_candidates || [];

  // Selected object pointers
  const selectedNode = byId[selected];
  const selectedPipe = activePipes.find((p) => p.id === selected);

  // Projected-to-metric geometry, rebuilt only when the network itself changes
  // (not on camera moves, selection, or theme changes).
  const scene = useMemo(() => {
    const nodes = activeNodes.map((n) => {
      const pt = projectToMetricScene(n.lat, n.lng, n.elevation_m || 818);
      return { n, x: pt.x, y: pt.y, z: pt.z };
    });
    const pipes = [];
    for (const p of activePipes) {
      const a = byId[p.source];
      const b = byId[p.target];
      if (!a || !b) continue;
      const ptA = projectToMetricScene(a.lat, a.lng, a.elevation_m || 815);
      const ptB = projectToMetricScene(b.lat, b.lng, b.elevation_m || 815);
      const mids = (p.coordinates || []).map((c) =>
        projectToMetricScene(c.lat ?? c[0], c.lng ?? c[1], 815),
      );
      pipes.push({ p, pts: [ptA, ...mids, ptB], mids: mids.length });
    }
    return { nodes, pipes };
  }, [activeNodes, activePipes, byId]);


  // Camera Control Actions
  const resetCamera = () => updateCam({ ...DEFAULT_CAM });
  const topDownCamera = () => updateCam({ azimuth: 0, elevation: 84, panX: 0, panY: 0 });
  const zoomBy = (f) => updateCam({ zoom: Math.max(0.4, Math.min(4.5, camRef.current.zoom * f)) });

  const fitNetwork = () => {
    if (!scene.nodes.length) return;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const s of scene.nodes) {
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
      if (s.z < minZ) minZ = s.z;
      if (s.z > maxZ) maxZ = s.z;
    }
    const midX = (minX + maxX) / 2;
    const midZ = (minZ + maxZ) / 2;
    const { w, h } = sizeRef.current;
    const width = w || 800;
    const height = h || 600;

    const span = Math.max(maxX - minX, maxZ - minZ, 400);
    const targetZoom = Math.max(0.6, Math.min(2.8, 1400 / span));
    const azRad = (camRef.current.azimuth * Math.PI) / 180;
    const rx = midX * Math.cos(azRad) - midZ * Math.sin(azRad);
    const scale = (targetZoom * 0.22 * Math.min(width, height)) / 600;
    updateCam({ zoom: targetZoom, panX: -rx * scale, panY: 20 });
  };

  const focusSelected = () => {
    let target = null;
    if (selectedNode) {
      target = projectToMetricScene(selectedNode.lat, selectedNode.lng, selectedNode.elevation_m || 818);
    } else if (selectedPipe) {
      const a = byId[selectedPipe.source];
      const b = byId[selectedPipe.target];
      if (a && b) {
        const mid = interpolateMidpoint(a, b);
        target = projectToMetricScene(mid.lat, mid.lng, 818);
      }
    }
    if (!target) return;
    const { w, h } = sizeRef.current;
    const width = w || 800;
    const height = h || 600;
    const cam = camRef.current;
    const azRad = (cam.azimuth * Math.PI) / 180;
    const rx = target.x * Math.cos(azRad) - target.z * Math.sin(azRad);
    const scale = (cam.zoom * 0.22 * Math.min(width, height)) / 600;
    updateCam({ panX: -rx * scale, panY: 0 });
  };



  // Commit a draft update into undo history
  const commitMutation = (mutator) => {
    if (!draftNetwork) return;
    setHistoryPast((past) => [...past, JSON.parse(JSON.stringify(draftNetwork))]);
    setHistoryFuture([]);
    setDirty(true);
    setSaveStatus('');
    const next = mutator(JSON.parse(JSON.stringify(draftNetwork)));
    setDraftNetwork(next);
    onUpdateDraft?.(next);
  };

  const handleUndo = () => {
    if (!historyPast.length) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryPast((past) => past.slice(0, -1));
    setHistoryFuture((future) => [JSON.parse(JSON.stringify(draftNetwork)), ...future]);
    setDraftNetwork(previous);
    onUpdateDraft?.(previous);
  };

  const handleRedo = () => {
    if (!historyFuture.length) return;
    const next = historyFuture[0];
    setHistoryFuture((future) => future.slice(1));
    setHistoryPast((past) => [...past, JSON.parse(JSON.stringify(draftNetwork))]);
    setDraftNetwork(next);
    onUpdateDraft?.(next);
  };

  // Intermediate route vertex modification
  const handleAddRoutePoint = () => {
    if (!selectedPipe) return;
    const a = byId[selectedPipe.source];
    const b = byId[selectedPipe.target];
    if (!a || !b) return;

    commitMutation((next) => {
      const p = next.pipes.find((item) => item.id === selectedPipe.id);
      if (!p) return next;
      const coords = p.coordinates || [];
      let newPoint;
      if (coords.length === 0) {
        newPoint = interpolateMidpoint(a, b);
      } else {
        const last = coords[coords.length - 1];
        newPoint = interpolateMidpoint(last, b);
      }
      p.coordinates = [...coords, newPoint];
      // Recalculate derived polyline length
      const fullPoints = [a, ...p.coordinates, b];
      p.length_m = calculatePolylineLength(fullPoints);
      return next;
    });
  };

  const handleDeleteRoutePoint = (index) => {
    if (!selectedPipe) return;
    commitMutation((next) => {
      const p = next.pipes.find((item) => item.id === selectedPipe.id);
      if (!p || !p.coordinates) return next;
      p.coordinates = p.coordinates.filter((_, idx) => idx !== index);
      const a = byId[p.source];
      const b = byId[p.target];
      if (a && b) {
        const fullPoints = [a, ...p.coordinates, b];
        p.length_m = calculatePolylineLength(fullPoints);
      }
      return next;
    });
  };

  // Property Modifications
  const handlePipeProperty = (field, value) => {
    if (!selectedPipe) return;
    commitMutation((next) => {
      const p = next.pipes.find((item) => item.id === selectedPipe.id);
      if (p) p[field] = value;
      return next;
    });
  };

  const handleNudgeJunction = () => {
    if (!selectedNode) return;
    commitMutation((next) => {
      const n = next.nodes.find((item) => item.id === selectedNode.id);
      if (n) {
        n.lat += 0.0001;
        n.lng += 0.0001;
      }
      return next;
    });
  };

  // Topology Validation
  const handleValidate = () => {
    if (!draftNetwork) return;
    const issues = [];
    draftNetwork.pipes.forEach((p) => {
      if (!byId[p.source] || !byId[p.target]) {
        issues.push(`Pipe ${p.id} references non-existent junction.`);
      }
      if (p.length_m <= 0) {
        issues.push(`Pipe ${p.id} has invalid length (${p.length_m} m).`);
      }
    });
    if (issues.length === 0) {
      setValidationMsg({
        success: true,
        text: `Validation Passed · ${draftNetwork.nodes.length} nodes & ${draftNetwork.pipes.length} pipes verified.`,
      });
    } else {
      setValidationMsg({
        success: false,
        text: `Validation Warning: ${issues[0]}`,
      });
    }
  };

  // Save Local Draft (Honest persistence disclosure per §8.5 & SOT)
  const handleSaveDraft = () => {
    if (!draftNetwork) return;
    try {
      localStorage.setItem('hydropulse_active_draft', JSON.stringify(draftNetwork));
      setDirty(false);
      setSaveStatus('LOCAL DRAFT SAVED · AWAITING HARDHIK BACKEND PERSISTENCE ENDPOINT');
    } catch {
      setSaveStatus('Error writing draft to local storage.');
    }
  };

  // Discard Local Draft (Hold-to-confirm safe action §21.2 & §21.5)
  const handleDiscardEdits = useCallback(() => {
    setDraftNetwork(network);
    setHistoryPast([]);
    setHistoryFuture([]);
    setDirty(false);
    setValidationMsg({
      success: true,
      text: 'Local draft discarded. Reset to baseline network geometry.',
    });
    setSaveStatus('Draft reset to baseline');
    try {
      localStorage.removeItem('hydropulse_active_draft');
    } catch {
      // Storage unavailable
    }
    onUpdateDraft?.(null);
  }, [network, onUpdateDraft]);

  // Keyboard Navigation & Undo/Redo Shortcuts (subscribed once; reads latest handlers via ref)
  const keyRef = useRef({});
  keyRef.current = { handleUndo, handleRedo, interactionMode };
  useEffect(() => {
    const handleKey = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const k = keyRef.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? k.handleRedo() : k.handleUndo();
      } else if (e.key === 'Escape') {
        setActiveDragHandle(null);
        if (k.interactionMode === 'edit') setInteractionMode('navigate');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Canvas size + DPR (capped at 2): resize only when the container changes, never per frame.
  const hasNetwork = !!draftNetwork;
  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return undefined;
    const apply = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const s = sizeRef.current;
      if (w === s.w && h === s.h && dpr === s.dpr) return;
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      requestDraw();
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(host);
    const onVis = () => {
      if (!document.hidden) requestDraw();
    };
    document.addEventListener('visibilitychange', onVis);
    syncCompass();
    return () => {
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNetwork, requestDraw]);

  // Draw function: reads the latest props through this closure and the camera from camRef.
  drawRef.current = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w: width, h: height, dpr } = sizeRef.current;
    if (!width || !height) return;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const proj = makeProjector(camRef.current, width, height);
    if (!readyRef.current) {
      readyRef.current = true;
      onReady?.();
    }

    // 1. Sky & Atmospheric Haze
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#0B132B');
    bg.addColorStop(0.7, '#1C2541');
    bg.addColorStop(1, '#151E36');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // 2. Terrain Wireframe & Elevation Grid (single path)
    const grid = terrainGrid;
    if (grid.length > 0 && (visibleLayers.terrain ?? true)) {
      ctx.strokeStyle = '#3A506B33';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          const pt = grid[r][c];
          proj.to(pt.x, pt.y, pt.z);
          if (c === 0) ctx.moveTo(proj.x, proj.y);
          else ctx.lineTo(proj.x, proj.y);
        }
      }
      for (let c = 0; c < grid[0].length; c++) {
        for (let r = 0; r < grid.length; r++) {
          const pt = grid[r][c];
          proj.to(pt.x, pt.y, pt.z);
          if (r === 0) ctx.moveTo(proj.x, proj.y);
          else ctx.lineTo(proj.x, proj.y);
        }
      }
      ctx.stroke();
    }

    // 3. Water Bodies (Kengeri Lake & Stream)
    if (visibleLayers.water_bodies ?? true) {
      ctx.strokeStyle = '#5BC0DE66';
      ctx.lineWidth = 4;
      for (const line of waterLines) {
        ctx.beginPath();
        line.forEach((pt, idx) => {
          proj.to(pt.x, pt.y, pt.z);
          if (idx === 0) ctx.moveTo(proj.x, proj.y);
          else ctx.lineTo(proj.x, proj.y);
        });
        ctx.stroke();
      }
    }

    // Depth offset for pipe stratification (-12m or 0m)
    const depthOffset = showIllustrativeDepth ? -12 : 0;

    // 4. Pipes, batched by style: one stroke per style instead of one per pipe.
    const groups = new Map();
    let selectedEntry = null;
    for (const entry of scene.pipes) {
      const p = entry.p;
      if (selected === p.id) {
        selectedEntry = entry;
        continue;
      }
      const isValving = valving.has(p.id);
      const color = isValving ? '#D97706' : p.status === 'CLOSED' ? '#64748B' : '#5BC0DE';
      const lw = isValving ? 5 : p.diameter_mm >= 400 ? 4.5 : 2.5;
      const key = `${color}|${lw}`;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { color, lw, list: [] }));
      g.list.push(entry);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const strokeGroup = (list, color, lw) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      for (const { pts } of list) {
        for (let i = 0; i < pts.length; i++) {
          proj.to(pts[i].x, pts[i].y + depthOffset, pts[i].z);
          if (i === 0) ctx.moveTo(proj.x, proj.y);
          else ctx.lineTo(proj.x, proj.y);
        }
      }
      ctx.stroke();
    };
    groups.forEach((g) => strokeGroup(g.list, g.color, g.lw));
    if (selectedEntry) {
      ctx.shadowColor = 'rgba(244, 214, 176, 0.6)';
      ctx.shadowBlur = 10;
      strokeGroup([selectedEntry], '#F4D6B0', 6.5);
      ctx.shadowBlur = 0;
      // Intermediate route handles if in Edit mode and selected
      if (interactionMode === 'edit') {
        const allPts = selectedEntry.pts;
        allPts.forEach((pt, idx) => {
          proj.to(pt.x, pt.y + depthOffset, pt.z);
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, idx === 0 || idx === allPts.length - 1 ? 5.5 : 7, 0, Math.PI * 2);
          ctx.fillStyle = idx === 0 || idx === allPts.length - 1 ? '#5BC0DE' : '#D97706';
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      }
    }

    // 5. Nodes (Junctions & Sensors)
    const topId = top[0]?.node_id;
    ctx.font = 'bold 9px monospace';
    for (const s of scene.nodes) {
      const n = s.n;
      const isSelected = selected === n.id;
      const isSensor = sensors.has(n.id) || n.is_sensor;
      const isIsolated = isolatedNodes.has(n.id);
      const isTopLeak = topId === n.id;
      const isRevealedTruth = judge && revealed && result?.injected_node_id === n.id;

      proj.to(s.x, s.y + depthOffset, s.z);
      const sx = proj.x;
      const sy = proj.y;
      if (sx < -30 || sy < -30 || sx > width + 30 || sy > height + 30) continue;

      ctx.beginPath();
      const radius = isTopLeak ? 9 : isSensor ? 7 : isSelected ? 8 : 4;
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fillStyle = isIsolated
        ? '#64748B'
        : isRevealedTruth
          ? '#FFFFFF'
          : isTopLeak
            ? '#EF4444'
            : isSensor
              ? '#10B981'
              : '#3A506B';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#F4D6B0' : '#1C2541';
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.stroke();

      if (isSensor) {
        ctx.fillStyle = '#10B981';
        ctx.fillText(`S${sensors.get(n.id) || 1}`, sx + 9, sy - 4);
      }
      if (isTopLeak) {
        ctx.beginPath();
        ctx.arc(sx, sy, 18, 0, Math.PI * 2);
        ctx.strokeStyle = '#EF444499';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (isRevealedTruth) {
        ctx.beginPath();
        ctx.arc(sx, sy, 22, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  };

  // Any render that changes data/selection/layers/mode schedules one coalesced redraw.
  useEffect(() => {
    requestDraw();
  }, [
    scene,
    selected,
    valving,
    isolatedNodes,
    sensors,
    top,
    judge,
    revealed,
    result,
    showIllustrativeDepth,
    visibleLayers,
    interactionMode,
    terrainGrid,
    requestDraw,
  ]);


  // Mouse Input Handling: Orbit, Pan, Zoom and Handle Dragging
  const pending = useRef(null); // coalesced draft-drag update (applied once per frame)
  const flushDragRef = useRef(0);

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const { w: width, h: height } = sizeRef.current;
    const cam = camRef.current;
    const proj = makeProjector(cam, width, height);
    const depthOffset = showIllustrativeDepth ? -12 : 0;

    // In Edit mode, check if clicked on intermediate route handles or nodes
    if (interactionMode === 'edit' && selectedPipe) {
      const entry = scene.pipes.find((s) => s.p.id === selectedPipe.id);
      if (entry) {
        for (let i = 1; i <= entry.mids; i++) {
          const pt = entry.pts[i];
          proj.to(pt.x, pt.y + depthOffset, pt.z);
          if (Math.hypot(mouseX - proj.x, mouseY - proj.y) < 12) {
            const handleInfo = { type: 'vertex', pipeId: selectedPipe.id, vertexIdx: i - 1 };
            setActiveDragHandle(handleInfo);
            dragHandleRef.current = handleInfo;
            return;
          }
        }
      }
    }

    // Check if clicked on a Node
    for (const s of scene.nodes) {
      proj.to(s.x, s.y + depthOffset, s.z);
      if (Math.hypot(mouseX - proj.x, mouseY - proj.y) < 14) {
        setSelected?.(s.n.id);
        if (interactionMode === 'edit') {
          const handleInfo = { type: 'node', nodeId: s.n.id };
          setActiveDragHandle(handleInfo);
          dragHandleRef.current = handleInfo;
        }
        return;
      }
    }

    // Check if clicked on a Pipe
    for (const { p, pts } of scene.pipes) {
      let sx = 0;
      let sy = 0;
      for (let i = 0; i < pts.length; i++) {
        proj.to(pts[i].x, pts[i].y + depthOffset, pts[i].z);
        if (i > 0) {
          const A = mouseX - sx;
          const B = mouseY - sy;
          const C = proj.x - sx;
          const D = proj.y - sy;
          const lenSq = C * C + D * D;
          const param = lenSq !== 0 ? Math.max(0, Math.min(1, (A * C + B * D) / lenSq)) : -1;
          if (Math.hypot(mouseX - (sx + param * C), mouseY - (sy + param * D)) < 10) {
            setSelected?.(p.id);
            return;
          }
        }
        sx = proj.x;
        sy = proj.y;
      }
    }

    // Default: Camera Navigation Drag
    setIsNavDragging(true);
    navDragStart.current = {
      x: e.clientX,
      y: e.clientY,
      azimuth: cam.azimuth,
      elevation: cam.elevation,
      panX: cam.panX,
      panY: cam.panY,
      button: e.button,
      active: true,
    };
  };

  const applyHandleDrag = (handle, mouseX, mouseY) => {
    const { w, h } = sizeRef.current;
    const cam = camRef.current;
    const metric = unprojectScreen(cam, mouseX, mouseY, 0, w, h);
    const geo = unprojectFromMetricScene(metric.x, metric.z);
    setDraftNetwork((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev));
      if (handle.type === 'vertex') {
        const p = next.pipes.find((item) => item.id === handle.pipeId);
        if (p && p.coordinates && p.coordinates[handle.vertexIdx]) {
          p.coordinates[handle.vertexIdx] = geo;
          const a = byId[p.source];
          const b = byId[p.target];
          if (a && b) p.length_m = calculatePolylineLength([a, ...p.coordinates, b]);
        }
      } else if (handle.type === 'node') {
        const n = next.nodes.find((item) => item.id === handle.nodeId);
        if (n) {
          n.lat = geo.lat;
          n.lng = geo.lng;
          next.pipes.forEach((p) => {
            if (p.source === n.id || p.target === n.id) {
              const a = p.source === n.id ? n : byId[p.source];
              const b = p.target === n.id ? n : byId[p.target];
              if (a && b) p.length_m = calculatePolylineLength([a, ...(p.coordinates || []), b]);
            }
          });
        }
      }
      return next;
    });
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Dragging a route vertex / node: at most one draft update per animation frame.
    const handle = dragHandleRef.current;
    if (handle) {
      const rect = canvas.getBoundingClientRect();
      pending.current = { handle, x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (!flushDragRef.current) {
        flushDragRef.current = requestAnimationFrame(() => {
          flushDragRef.current = 0;
          const job = pending.current;
          pending.current = null;
          if (job && dragHandleRef.current) applyHandleDrag(job.handle, job.x, job.y);
        });
      }
      return;
    }

    // Camera navigation: mutate the ref and schedule a draw. No React render.
    const st = navDragStart.current;
    if (!st.active) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (st.button === 0 && !e.shiftKey) {
      updateCam({
        azimuth: (st.azimuth + dx * 0.45) % 360,
        elevation: Math.max(12, Math.min(84, st.elevation - dy * 0.35)),
      });
    } else {
      updateCam({ panX: st.panX + dx, panY: st.panY + dy });
    }
  };

  const handleMouseUp = () => {
    if (dragHandleRef.current) {
      dragHandleRef.current = null;
      setActiveDragHandle(null);
      setDirty(true);
      if (draftNetwork) onUpdateDraft?.(draftNetwork);
    }
    if (navDragStart.current.active) {
      navDragStart.current.active = false;
      setIsNavDragging(false);
    }
  };

  // Wheel zoom needs a non-passive listener to preventDefault (React's onWheel is passive).
  useEffect(() => {
    const host = canvasRef.current?.parentElement;
    if (!host) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.12 : 0.89;
      updateCam({ zoom: Math.max(0.4, Math.min(4.5, camRef.current.zoom * f)) });
    };
    host.addEventListener('wheel', onWheel, { passive: false });
    return () => host.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNetwork]);

  // Cancel any pending frames on unmount.
  useEffect(
    () => () => {
      if (flushDragRef.current) cancelAnimationFrame(flushDragRef.current);
    },
    [],
  );


  if (!draftNetwork) {
    return (
      <div className='terrain-3d-container' role='status' aria-busy='true'>
        <SkeletonLoader variant='map-veil' />
      </div>
    );
  }

  return (
    <div className='terrain-3d-container' style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        className='terrain-3d-canvas'
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ display: 'block', width: '100%', height: '100%', cursor: activeDragHandle ? 'crosshair' : interactionMode === 'edit' ? 'pointer' : isNavDragging ? 'grabbing' : 'grab' }}
      />

      {/* Top HUD Toolbar: Mode Selector, Camera, & Depth */}
      <div className='terrain-3d-hud'>
        {/* Interaction Mode Pill */}
        <div className='hud-button-group'>
          <button
            className={`studio-icon-button ${interactionMode === 'navigate' ? 'is-active' : ''}`}
            onClick={() => setInteractionMode('navigate')}
            title='Navigate Mode: Orbit, Pan, and Zoom camera'
            type='button'
            aria-label='Navigate mode'
          >
            <Compass size={15} />
          </button>
          <button
            className={`studio-icon-button ${interactionMode === 'edit' ? 'is-active' : ''}`}
            onClick={() => setInteractionMode('edit')}
            title='Edit Network Mode: Select and reshape pipes and junctions'
            type='button'
            aria-label='Edit mode'
          >
            <MousePointer2 size={15} />
          </button>
        </div>

        {/* Camera Azimuth Compass */}
        <div className='hud-compass' aria-label='Camera azimuth and elevation'>
          <span ref={compassIconRef} style={{ display: 'inline-flex' }}><Compass size={14} /></span>
          <span ref={compassTextRef}>{DEFAULT_CAM.azimuth}° Az · {DEFAULT_CAM.elevation}° El</span>
        </div>

        {/* Camera Navigation Buttons */}
        <div className='hud-button-group'>
          <button
            className='studio-icon-button'
            onClick={() => zoomBy(1.2)}
            title='Zoom in camera (+)'
            type='button'
            aria-label='Zoom in'
          >
            <ZoomIn size={15} />
          </button>
          <button
            className='studio-icon-button'
            onClick={() => zoomBy(1 / 1.2)}
            title='Zoom out camera (-)'
            type='button'
            aria-label='Zoom out'
          >
            <ZoomOut size={15} />
          </button>
          <button
            className='studio-icon-button'
            onClick={fitNetwork}
            title='Fit network bounds to screen (F)'
            type='button'
            aria-label='Fit network bounds'
          >
            <Maximize2 size={15} />
          </button>
          <button
            className='studio-icon-button'
            onClick={resetCamera}
            title='Reset perspective overview (R)'
            type='button'
            aria-label='Reset perspective overview'
          >
            <RotateCcw size={15} />
          </button>
          <button
            className='studio-icon-button'
            onClick={topDownCamera}
            title='Switch to 2D top-down planimetric view'
            type='button'
            aria-label='Top-down view'
          >
            <Minimize2 size={15} />
          </button>
          {selected && (
            <button
              className='studio-icon-button'
              onClick={focusSelected}
              title={`Focus camera on selected ${selected}`}
              type='button'
              aria-label={`Focus on ${selected}`}
            >
              <Crosshair size={15} />
            </button>
          )}
        </div>

        {/* Depth Stratification Toggle */}
        <div className='hud-depth-control'>
          <button
            className={`depth-toggle-pill ${showIllustrativeDepth ? 'is-active' : ''}`}
            onClick={toggleDepth}
            title='Toggle between terrain surface and illustrative -2.5m underground depth'
            type='button'
          >
            <Layers size={13} />
            <span>{showIllustrativeDepth ? 'Depth: -2.5m Illustrative' : 'Depth: Surface Mesh'}</span>
          </button>
        </div>
      </div>

      {/* 3D Pipe/Junction Edit Workspace Inspector (When an item is selected) */}
      {(selectedPipe || selectedNode) && (
        <div className='terrain-editor-hud' role='region' aria-label='3D Entity Inspector'>
          <div className='editor-hud-header'>
            <div className='hud-title-row'>
              {selectedPipe ? <GitBranch size={14} /> : <Circle size={14} />}
              <b>{selectedPipe ? `PIPE ${selectedPipe.id}` : `JUNCTION ${selectedNode.id}`}</b>
              <span className='hud-type-badge'>{selectedPipe ? selectedPipe.road_class : selectedNode.type}</span>
            </div>
            <button className='hud-close-btn' onClick={() => setSelected?.(null)} type='button' aria-label='Close inspector'>
              <X size={13} />
            </button>
          </div>

          <div className='editor-hud-body'>
            {selectedPipe && (
              <>
                <div className='hud-field-row'>
                  <span>Endpoints</span>
                  <b>{selectedPipe.source} → {selectedPipe.target}</b>
                </div>
                <div className='hud-field-row'>
                  <span>Derived Length</span>
                  <b>{selectedPipe.length_m} m</b>
                </div>
                <div className='hud-field-row'>
                  <span>Diameter</span>
                  <select
                    value={selectedPipe.diameter_mm}
                    onChange={(e) => handlePipeProperty('diameter_mm', Number(e.target.value))}
                    disabled={interactionMode !== 'edit'}
                  >
                    <option value={150}>150 mm</option>
                    <option value={200}>200 mm</option>
                    <option value={250}>250 mm</option>
                    <option value={300}>300 mm</option>
                    <option value={450}>450 mm</option>
                  </select>
                </div>
                <div className='hud-field-row'>
                  <span>Status</span>
                  <select
                    value={selectedPipe.status}
                    onChange={(e) => handlePipeProperty('status', e.target.value)}
                    disabled={interactionMode !== 'edit'}
                  >
                    <option value='OPEN'>OPEN</option>
                    <option value='CLOSED'>CLOSED</option>
                  </select>
                </div>

                {/* Route Vertices Actions in Edit Mode */}
                {interactionMode === 'edit' && (
                  <div className='hud-actions-box'>
                    <span className='hud-action-title'>
                      ROUTE BEND POINTS ({selectedPipe.coordinates?.length || 0})
                    </span>
                    <div className='hud-btn-row'>
                      <button
                        className='hud-action-btn'
                        onClick={handleAddRoutePoint}
                        type='button'
                        title='Add intermediate bend vertex'
                      >
                        <Plus size={13} /> Add Point
                      </button>
                      {selectedPipe.coordinates && selectedPipe.coordinates.length > 0 && (
                        <button
                          className='hud-action-btn destructive'
                          onClick={() => handleDeleteRoutePoint(selectedPipe.coordinates.length - 1)}
                          type='button'
                          title='Delete last bend vertex'
                        >
                          <Trash2 size={13} /> Remove Point
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {selectedNode && (
              <>
                <div className='hud-field-row'>
                  <span>Coordinates</span>
                  <b>{selectedNode.lat.toFixed(5)}° N, {selectedNode.lng.toFixed(5)}° E</b>
                </div>
                <div className='hud-field-row'>
                  <span>Base Head</span>
                  <b>{selectedNode.base_pressure_m?.toFixed(1) || '0.0'} m</b>
                </div>
                <div className='hud-field-row'>
                  <span>Households</span>
                  <b>{selectedNode.households || 0}</b>
                </div>
                {interactionMode === 'edit' && (
                  <div className='hud-actions-box'>
                    <span className='hud-action-title'>JUNCTION SPATIAL TRANSFORM</span>
                    <div className='hud-btn-row'>
                      <button
                        className='hud-action-btn'
                        onClick={handleNudgeJunction}
                        type='button'
                        title='Nudge junction position to adjust topological alignment'
                      >
                        <Plus size={13} /> Shift Position
                      </button>
                    </div>
                  </div>
                )}
                {interactionMode === 'edit' && (
                  <p className='hud-note'>
                    Drag this junction handle across the terrain to move it. Connected pipe endpoints propagate automatically.
                  </p>
                )}
              </>
            )}

            {/* Undo / Redo & Validation Bar */}
            {interactionMode === 'edit' && (
              <div className='hud-history-bar'>
                <button
                  className='hud-mini-btn'
                  onClick={handleUndo}
                  disabled={!historyPast.length}
                  title='Undo edit (Ctrl+Z)'
                  type='button'
                >
                  <Undo2 size={13} /> Undo
                </button>
                <button
                  className='hud-mini-btn'
                  onClick={handleRedo}
                  disabled={!historyFuture.length}
                  title='Redo edit (Ctrl+Y)'
                  type='button'
                >
                  <Redo2 size={13} /> Redo
                </button>
                <button className='hud-mini-btn' onClick={handleValidate} title='Validate network geometry' type='button'>
                  <CheckCircle2 size={13} /> Validate
                </button>
                <button
                  className='hud-mini-btn primary'
                  onClick={handleSaveDraft}
                  disabled={!dirty}
                  title='Save draft changes locally'
                  type='button'
                >
                  <Save size={13} /> Save Draft
                </button>
              </div>
            )}

            {validationMsg && (
              <div className={`hud-validation-alert ${validationMsg.success ? 'success' : 'warning'}`}>
                {validationMsg.success ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                <span>{validationMsg.text}</span>
              </div>
            )}

            {saveStatus && <div className='hud-save-status'>{saveStatus}</div>}

            {/* Danger Zone: Separated Destructive Actions (§21.2 & §21.5) */}
            {dirty && (
              <div className='danger-zone-box' role='region' aria-label='Danger Zone'>
                <div className='danger-zone-header'>
                  <AlertTriangle size={13} />
                  <span>DANGER ZONE</span>
                </div>
                <p className='danger-zone-desc'>
                  Discarding replaces all unsaved route modifications and resets to baseline geometry ({network?.pipes?.length || 0} pipes).
                </p>
                <HoldToConfirmButton
                  onConfirm={handleDiscardEdits}
                  holdDurationMs={1200}
                  label='Hold to discard edits'
                  actionName='Discarding changes…'
                  completedLabel='Draft reset'
                  variant='danger'
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className='terrain-3d-foot'>
        {/* 3D Legend & Attribution: collapsed to a chip; swatches are data colours */}
        <details className='terrain-3d-legend'>
          <summary>Legend</summary>
          <div className='terrain-3d-legend-items'>
            <span className='legend-item'>
              <i style={{ background: '#5BC0DE' }} /> Water mains
            </span>
            <span className='legend-item'>
              <i style={{ background: '#10B981' }} /> Sensors
            </span>
            <span className='legend-item'>
              <i style={{ background: '#D97706' }} /> Valves / low pressure
            </span>
            <span className='legend-item'>
              <i style={{ background: '#EF4444' }} /> Leak candidate
            </span>
            <span className='legend-item'>
              <i style={{ background: '#64748B' }} /> Isolated pipe
            </span>
          </div>
        </details>

        {/* Mandatory Disclaimer Watermark */}
        <div className='map-disclaimer-watermark'>
          SIMULATED NETWORK · DEMO GEOGRAPHIC PLACEMENT · NOT VERIFIED BWSSB GEOMETRY
        </div>
      </div>
    </div>
  );
}
