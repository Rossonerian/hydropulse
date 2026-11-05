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
}) {
  const canvasRef = useRef(null);
  const [internalDepth, setInternalDepth] = useState(true);
  const showIllustrativeDepth = propDepth ?? internalDepth;
  const toggleDepth = propToggleDepth ?? (() => setInternalDepth((d) => !d));

  // Interaction Mode: 'navigate' (camera orbit/pan/zoom) vs 'edit' (pipe/junction modification)
  const [interactionMode, setInteractionMode] = useState('navigate');

  // Camera State: azimith (deg), elevation (deg), zoom, pan {x, y}
  const [rotation, setRotation] = useState({ azimuth: 45, elevation: 35 });
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Camera Dragging State
  const [isNavDragging, setIsNavDragging] = useState(false);
  const navDragStart = useRef({ x: 0, y: 0, azimuth: 45, elevation: 35, panX: 0, panY: 0, button: 0 });

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

  // Generate DEM terrain grid points across Kengeri AOI (808m to 838m)
  const terrainGrid = useRef([]);
  useEffect(() => {
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
        const pt = projectToMetricScene(lat, lng, elevation);
        row.push({ lat, lng, elevation, ...pt });
      }
      grid.push(row);
    }
    terrainGrid.current = grid;
  }, []);

  // Forward Isometric 3D Projection
  const project = useCallback(
    (x, y, z, width, height) => {
      const azRad = (rotation.azimuth * Math.PI) / 180;
      const elRad = (rotation.elevation * Math.PI) / 180;

      // Rotate around Y (Azimuth)
      const cosAz = Math.cos(azRad);
      const sinAz = Math.sin(azRad);
      const rx = x * cosAz - z * sinAz;
      const rz = x * sinAz + z * cosAz;

      // Tilt with Elevation (Pitch)
      const cosEl = Math.cos(elRad);
      const sinEl = Math.sin(elRad);
      const py = y * cosEl - rz * sinEl;
      const depth = y * sinEl + rz * cosEl;

      const scale = (zoom * 0.22 * Math.min(width, height)) / 600;
      const screenX = width / 2 + rx * scale + pan.x;
      const screenY = height / 2 - py * scale + pan.y;

      return { x: screenX, y: screenY, depth };
    },
    [rotation, zoom, pan],
  );

  // Inverse 3D Projection: screen point to metric scene (x, z) at target plane y
  const unproject = useCallback(
    (screenX, screenY, yTarget = 0, width, height) => {
      const azRad = (rotation.azimuth * Math.PI) / 180;
      const elRad = (rotation.elevation * Math.PI) / 180;

      const cosAz = Math.cos(azRad);
      const sinAz = Math.sin(azRad);
      const cosEl = Math.cos(elRad);
      const sinEl = Math.sin(elRad);

      const scale = (zoom * 0.22 * Math.min(width, height)) / 600;
      const rx = (screenX - width / 2 - pan.x) / scale;
      const py = (height / 2 + pan.y - screenY) / scale;

      // py = yTarget * cosEl - rz * sinEl => rz = (yTarget * cosEl - py) / sinEl
      const safeSinEl = Math.abs(sinEl) < 0.05 ? (sinEl < 0 ? -0.05 : 0.05) : sinEl;
      const rz = (yTarget * cosEl - py) / safeSinEl;

      const x = rx * cosAz + rz * sinAz;
      const z = -rx * sinAz + rz * cosAz;

      return { x, z };
    },
    [rotation, zoom, pan],
  );

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

  // Camera Control Actions
  const resetCamera = () => {
    setRotation({ azimuth: 45, elevation: 35 });
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  const topDownCamera = () => {
    setRotation({ azimuth: 0, elevation: 84 });
    setPan({ x: 0, y: 0 });
  };

  const fitNetwork = () => {
    if (!activeNodes.length) return;
    const xs = [],
      zs = [];
    activeNodes.forEach((n) => {
      const pt = projectToMetricScene(n.lat, n.lng, n.elevation_m || 818);
      xs.push(pt.x);
      zs.push(pt.z);
    });
    const minX = Math.min(...xs),
      maxX = Math.max(...xs);
    const minZ = Math.min(...zs),
      maxZ = Math.max(...zs);
    const midX = (minX + maxX) / 2;
    const midZ = (minZ + maxZ) / 2;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.width || 800;
    const height = canvas.height || 600;

    const span = Math.max(maxX - minX, maxZ - minZ, 400);
    const targetZoom = Math.max(0.6, Math.min(2.8, 1400 / span));

    setZoom(targetZoom);
    // Center on the network centroid
    const azRad = (rotation.azimuth * Math.PI) / 180;
    const cosAz = Math.cos(azRad);
    const sinAz = Math.sin(azRad);
    const rx = midX * cosAz - midZ * sinAz;
    const scale = (targetZoom * 0.22 * Math.min(width, height)) / 600;
    setPan({ x: -rx * scale, y: 20 });
  };

  const focusSelected = () => {
    let target = null;
    if (selectedNode) {
      target = projectToMetricScene(
        selectedNode.lat,
        selectedNode.lng,
        selectedNode.elevation_m || 818,
      );
    } else if (selectedPipe) {
      const a = byId[selectedPipe.source];
      const b = byId[selectedPipe.target];
      if (a && b) {
        const mid = interpolateMidpoint(a, b);
        target = projectToMetricScene(mid.lat, mid.lng, 818);
      }
    }
    if (!target) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.width || 800;
    const height = canvas.height || 600;

    const azRad = (rotation.azimuth * Math.PI) / 180;
    const cosAz = Math.cos(azRad);
    const sinAz = Math.sin(azRad);
    const rx = target.x * cosAz - target.z * sinAz;

    const scale = (zoom * 0.22 * Math.min(width, height)) / 600;
    setPan({ x: -rx * scale, y: 0 });
  };

  // Keyboard Navigation & Undo/Redo Shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? handleRedo() : handleUndo();
      } else if (e.key === 'Escape') {
        setActiveDragHandle(null);
        if (interactionMode === 'edit') setInteractionMode('navigate');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

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

  // Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = (canvas.width = canvas.parentElement.clientWidth);
    const height = (canvas.height = canvas.parentElement.clientHeight);

    ctx.clearRect(0, 0, width, height);

    // 1. Sky & Atmospheric Haze
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#0B132B');
    bg.addColorStop(0.7, '#1C2541');
    bg.addColorStop(1, '#151E36');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // 2. Terrain Wireframe & Elevation Grid
    const grid = terrainGrid.current;
    if (grid.length > 0 && (visibleLayers.terrain ?? true)) {
      ctx.strokeStyle = '#3A506B33';
      ctx.lineWidth = 1;

      for (let r = 0; r < grid.length; r++) {
        ctx.beginPath();
        for (let c = 0; c < grid[r].length; c++) {
          const pt = grid[r][c];
          const sc = project(pt.x, pt.y, pt.z, width, height);
          if (c === 0) ctx.moveTo(sc.x, sc.y);
          else ctx.lineTo(sc.x, sc.y);
        }
        ctx.stroke();
      }

      for (let c = 0; c < grid[0].length; c++) {
        ctx.beginPath();
        for (let r = 0; r < grid.length; r++) {
          const pt = grid[r][c];
          const sc = project(pt.x, pt.y, pt.z, width, height);
          if (r === 0) ctx.moveTo(sc.x, sc.y);
          else ctx.lineTo(sc.x, sc.y);
        }
        ctx.stroke();
      }
    }

    // 3. Water Bodies (Kengeri Lake & Stream)
    if (visibleLayers.water_bodies ?? true) {
      REAL_WORLD_FEATURES.waterBodies.forEach((wb) => {
        if (wb.type === 'line') {
          ctx.beginPath();
          ctx.strokeStyle = '#5BC0DE66';
          ctx.lineWidth = 4;
          wb.coordinates.forEach((coord, idx) => {
            const pt = projectToMetricScene(coord[0], coord[1], 808);
            const sc = project(pt.x, pt.y, pt.z, width, height);
            if (idx === 0) ctx.moveTo(sc.x, sc.y);
            else ctx.lineTo(sc.x, sc.y);
          });
          ctx.stroke();
        }
      });
    }

    // Depth offset for pipe stratification (-12m or 0m)
    const depthOffset = showIllustrativeDepth ? -12 : 0;

    // 4. Draw Canonical Network Pipes
    activePipes.forEach((p) => {
      const a = byId[p.source];
      const b = byId[p.target];
      if (!a || !b) return;

      const isSelected = selected === p.id;
      const isValving = valving.has(p.id);
      const isClosed = p.status === 'CLOSED';

      const ptA = projectToMetricScene(a.lat, a.lng, a.elevation_m || 815);
      const ptB = projectToMetricScene(b.lat, b.lng, b.elevation_m || 815);

      // Collect all polyline vertices (start, intermediates, end)
      const intermediatePts = (p.coordinates || []).map((c) =>
        projectToMetricScene(c.lat ?? c[0], c.lng ?? c[1], 815),
      );
      const allPts = [ptA, ...intermediatePts, ptB];

      ctx.beginPath();
      ctx.strokeStyle = isSelected
        ? '#F4D6B0'
        : isValving
          ? '#D97706'
          : isClosed
            ? '#64748B'
            : '#5BC0DE';
      ctx.lineWidth = isSelected ? 6.5 : isValving ? 5 : p.diameter_mm >= 400 ? 4.5 : 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (isSelected) {
        ctx.shadowColor = 'rgba(244, 214, 176, 0.6)';
        ctx.shadowBlur = 10;
      }

      allPts.forEach((pt, idx) => {
        const sc = project(pt.x, pt.y + depthOffset, pt.z, width, height);
        if (idx === 0) ctx.moveTo(sc.x, sc.y);
        else ctx.lineTo(sc.x, sc.y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw intermediate route handles if in Edit mode and selected
      if (isSelected && interactionMode === 'edit') {
        allPts.forEach((pt, idx) => {
          const sc = project(pt.x, pt.y + depthOffset, pt.z, width, height);
          ctx.beginPath();
          ctx.arc(sc.x, sc.y, idx === 0 || idx === allPts.length - 1 ? 5.5 : 7, 0, Math.PI * 2);
          ctx.fillStyle = idx === 0 || idx === allPts.length - 1 ? '#5BC0DE' : '#D97706';
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      }
    });

    // 5. Draw Canonical Network Nodes (Junctions & Sensors)
    activeNodes.forEach((n) => {
      const isSelected = selected === n.id;
      const isSensor = sensors.has(n.id) || n.is_sensor;
      const isIsolated = isolatedNodes.has(n.id);
      const isTopLeak = top[0]?.node_id === n.id;
      const isRevealedTruth = judge && revealed && result?.injected_node_id === n.id;

      const pt = projectToMetricScene(n.lat, n.lng, n.elevation_m || 818);
      const sc = project(pt.x, pt.y + depthOffset, pt.z, width, height);

      // Base circle
      ctx.beginPath();
      const radius = isTopLeak ? 9 : isSensor ? 7 : isSelected ? 8 : 4;
      ctx.arc(sc.x, sc.y, radius, 0, Math.PI * 2);

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

      // Sensor Tag
      if (isSensor) {
        ctx.fillStyle = '#10B981';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`S${sensors.get(n.id) || 1}`, sc.x + 9, sc.y - 4);
      }

      // Top Leak Radar Ring
      if (isTopLeak) {
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, 18, 0, Math.PI * 2);
        ctx.strokeStyle = '#EF444499';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Ground-truth revealed ring
      if (isRevealedTruth) {
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, 22, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }, [
    draftNetwork,
    activeNodes,
    activePipes,
    byId,
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
    project,
  ]);

  // Mouse Input Handling: Orbit, Pan, Zoom and Handle Dragging
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const width = canvas.width;
    const height = canvas.height;
    const depthOffset = showIllustrativeDepth ? -12 : 0;

    // In Edit mode, check if clicked on intermediate route handles or nodes
    if (interactionMode === 'edit' && selectedPipe) {
      const a = byId[selectedPipe.source];
      const b = byId[selectedPipe.target];
      if (a && b) {
        const intermediatePts = (selectedPipe.coordinates || []).map((c) =>
          projectToMetricScene(c.lat ?? c[0], c.lng ?? c[1], 815),
        );
        for (let i = 0; i < intermediatePts.length; i++) {
          const pt = intermediatePts[i];
          const sc = project(pt.x, pt.y + depthOffset, pt.z, width, height);
          if (Math.hypot(mouseX - sc.x, mouseY - sc.y) < 12) {
            // Hit intermediate vertex handle!
            const handleInfo = { type: 'vertex', pipeId: selectedPipe.id, vertexIdx: i };
            setActiveDragHandle(handleInfo);
            dragHandleRef.current = handleInfo;
            return;
          }
        }
      }
    }

    // Check if clicked on a Node
    let clickedNodeId = null;
    for (const n of activeNodes) {
      const pt = projectToMetricScene(n.lat, n.lng, n.elevation_m || 818);
      const sc = project(pt.x, pt.y + depthOffset, pt.z, width, height);
      if (Math.hypot(mouseX - sc.x, mouseY - sc.y) < 14) {
        clickedNodeId = n.id;
        break;
      }
    }

    if (clickedNodeId) {
      setSelected(clickedNodeId);
      if (interactionMode === 'edit') {
        const handleInfo = { type: 'node', nodeId: clickedNodeId };
        setActiveDragHandle(handleInfo);
        dragHandleRef.current = handleInfo;
      }
      return;
    }

    // Check if clicked on a Pipe
    let clickedPipeId = null;
    for (const p of activePipes) {
      const a = byId[p.source];
      const b = byId[p.target];
      if (!a || !b) continue;
      const ptA = projectToMetricScene(a.lat, a.lng, 815);
      const ptB = projectToMetricScene(b.lat, b.lng, 815);
      const allPts = [
        ptA,
        ...(p.coordinates || []).map((c) => projectToMetricScene(c.lat, c.lng, 815)),
        ptB,
      ];

      for (let i = 0; i < allPts.length - 1; i++) {
        const sc1 = project(allPts[i].x, allPts[i].y + depthOffset, allPts[i].z, width, height);
        const sc2 = project(allPts[i + 1].x, allPts[i + 1].y + depthOffset, allPts[i + 1].z, width, height);

        // Distance from point to line segment
        const A = mouseX - sc1.x;
        const B = mouseY - sc1.y;
        const C = sc2.x - sc1.x;
        const D = sc2.y - sc1.y;
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        const param = lenSq !== 0 ? Math.max(0, Math.min(1, dot / lenSq)) : -1;
        const xx = sc1.x + param * C;
        const yy = sc1.y + param * D;
        if (Math.hypot(mouseX - xx, mouseY - yy) < 10) {
          clickedPipeId = p.id;
          break;
        }
      }
      if (clickedPipeId) break;
    }

    if (clickedPipeId) {
      setSelected(clickedPipeId);
      return;
    }

    // Default: Camera Navigation Drag
    setIsNavDragging(true);
    navDragStart.current = {
      x: e.clientX,
      y: e.clientY,
      azimuth: rotation.azimuth,
      elevation: rotation.elevation,
      panX: pan.x,
      panY: pan.y,
      button: e.button,
    };
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const width = canvas.width;
    const height = canvas.height;

    // If actively dragging a route vertex handle or node
    const handle = dragHandleRef.current;
    if (handle) {
      const metric = unproject(mouseX, mouseY, 0, width, height);
      const geo = unprojectFromMetricScene(metric.x, metric.z);

      if (handle.type === 'vertex') {
        setDraftNetwork((prev) => {
          if (!prev) return prev;
          const next = JSON.parse(JSON.stringify(prev));
          const p = next.pipes.find((item) => item.id === handle.pipeId);
          if (p && p.coordinates && p.coordinates[handle.vertexIdx]) {
            p.coordinates[handle.vertexIdx] = geo;
            const a = byId[p.source];
            const b = byId[p.target];
            if (a && b) {
              p.length_m = calculatePolylineLength([a, ...p.coordinates, b]);
            }
          }
          return next;
        });
      } else if (handle.type === 'node') {
        setDraftNetwork((prev) => {
          if (!prev) return prev;
          const next = JSON.parse(JSON.stringify(prev));
          const n = next.nodes.find((item) => item.id === handle.nodeId);
          if (n) {
            n.lat = geo.lat;
            n.lng = geo.lng;
            // Update connected pipe lengths
            next.pipes.forEach((p) => {
              if (p.source === n.id || p.target === n.id) {
                const a = p.source === n.id ? n : byId[p.source];
                const b = p.target === n.id ? n : byId[p.target];
                if (a && b) {
                  p.length_m = calculatePolylineLength([a, ...(p.coordinates || []), b]);
                }
              }
            });
          }
          return next;
        });
      }
      return;
    }

    // Otherwise, Camera Navigation
    if (!isNavDragging) return;
    const dx = e.clientX - navDragStart.current.x;
    const dy = e.clientY - navDragStart.current.y;

    if (navDragStart.current.button === 0 && !e.shiftKey) {
      // Orbit
      setRotation({
        azimuth: (navDragStart.current.azimuth + dx * 0.45) % 360,
        elevation: Math.max(12, Math.min(84, navDragStart.current.elevation - dy * 0.35)),
      });
    } else {
      // Pan
      setPan({
        x: navDragStart.current.panX + dx,
        y: navDragStart.current.panY + dy,
      });
    }
  };

  const handleMouseUp = () => {
    if (dragHandleRef.current) {
      dragHandleRef.current = null;
      setActiveDragHandle(null);
      setDirty(true);
      if (draftNetwork) onUpdateDraft?.(draftNetwork);
    }
    setIsNavDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom((z) => Math.max(0.4, Math.min(4.5, z * factor)));
  };

  if (!draftNetwork) {
    return (
      <div className='terrain-3d-container' role='status' aria-busy='true'>
        <SkeletonLoader variant='map-veil' />
      </div>
    );
  }

  return (
    <div className='terrain-3d-container' onWheel={handleWheel}>
      <canvas
        ref={canvasRef}
        className='terrain-3d-canvas'
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: activeDragHandle ? 'crosshair' : interactionMode === 'edit' ? 'pointer' : isNavDragging ? 'grabbing' : 'grab' }}
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
        <div className='hud-compass' aria-label={`Azimuth ${Math.round(rotation.azimuth)} degrees, Elevation ${Math.round(rotation.elevation)} degrees`}>
          <Compass size={14} style={{ transform: `rotate(${-rotation.azimuth}deg)` }} />
          <span>{Math.round(rotation.azimuth)}° Az · {Math.round(rotation.elevation)}° El</span>
        </div>

        {/* Camera Navigation Buttons */}
        <div className='hud-button-group'>
          <button
            className='studio-icon-button'
            onClick={() => setZoom((z) => Math.min(4.5, z * 1.2))}
            title='Zoom in camera (+)'
            type='button'
            aria-label='Zoom in'
          >
            <ZoomIn size={15} />
          </button>
          <button
            className='studio-icon-button'
            onClick={() => setZoom((z) => Math.max(0.4, z / 1.2))}
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
            <button className='hud-close-btn' onClick={() => setSelected(null)} type='button'>
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

      {/* Mandatory Disclaimer Watermark */}
      <div className='map-disclaimer-watermark'>
        SIMULATED NETWORK · DEMO GEOGRAPHIC PLACEMENT · NOT VERIFIED BWSSB GEOMETRY
      </div>

      {/* 3D Legend & Attribution Bar */}
      <div className='terrain-3d-legend'>
        <span className='legend-item'>
          <i style={{ background: '#5BC0DE' }} /> Potable Mains (BWSSB Kengeri)
        </span>
        <span className='legend-item'>
          <i style={{ background: '#10B981' }} /> Sentinel Sensors
        </span>
        <span className='legend-item'>
          <i style={{ background: '#D97706' }} /> Valves / Low Pressure
        </span>
        <span className='legend-item'>
          <i style={{ background: '#EF4444' }} /> Leak Candidate
        </span>
        <span className='legend-item'>
          <i style={{ background: '#64748B' }} /> Isolated Pipeline
        </span>
      </div>
    </div>
  );
}
