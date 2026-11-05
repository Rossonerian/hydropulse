import { useEffect, useRef, useState } from 'react';
import { Compass, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { IconButton, MapControlStack, MapLegend, Switch } from '../ui/index.js';
import { KENGERI_AOI, REAL_WORLD_FEATURES, projectToMetricScene } from '../lib/realWorldData.js';
import '../styles/studio/mapviews.css';

// Data colours: fixed hues for rendered features, mid-tone so they read on both themes.
const SEWER_COLOUR = '#A855F7'; // data colour
const PUMP_COLOUR = '#3B82F6'; // data colour

// Canvas cannot resolve var(); read computed token values at draw time.
const readTokens = () => {
  const style = getComputedStyle(document.documentElement);
  const pick = (name) => style.getPropertyValue(name).trim();
  return {
    ground: pick('--ground'),
    sunken: pick('--surface-sunken'),
    lineStrong: pick('--line-strong'),
    water: pick('--water'),
    valve: pick('--valve'),
    sensor: pick('--sensor'),
    ink: pick('--ink'),
    surface: pick('--surface'),
  };
};

const readTheme = () => document.documentElement.getAttribute('data-theme') || 'night';

const LEGEND_ITEMS = [
  { key: 'potable', swatch: 'pipe', label: 'Potable mains (BWSSB)' },
  { key: 'sewer', swatch: 'sewer', label: 'Sewer outfall (non-potable)' },
  { key: 'valve', swatch: 'valve', label: 'Sluice valves' },
  { key: 'pump', swatch: 'pump', label: 'Booster stations' },
  { key: 'borewell', swatch: 'node', label: 'Borewells' },
];

export default function Terrain3DViewer({
  selectedFeature,
  onSelectFeature,
  showIllustrativeDepth = true,
  onToggleDepth,
  visibleLayers = {},
}) {
  const canvasRef = useRef(null);
  const [rotation, setRotation] = useState({ azimuth: 45, elevation: 35 });
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, azimuth: 45, elevation: 35, panX: 0, panY: 0 });
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Generate synthetic DEM terrain grid points across Kengeri AOI (808m to 838m)
  const terrainGrid = useRef([]);
  useEffect(() => {
    const grid = [];
    const cols = 18;
    const rows = 18;
    const { south, west, north, east } = KENGERI_AOI.bbox;
    for (let r = 0; r <= rows; r++) {
      const row = [];
      const lat = south + (r / rows) * (north - south);
      for (let c = 0; c <= cols; c++) {
        const lng = west + (c / cols) * (east - west);
        // Realistic Kengeri ridge topography: higher elevation in the east/north ridge (835m),
        // sloping down to Vrishabhavathi stream valley in the southwest (810m).
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

  // Isometric 3D Projection Engine
  const project = (x, y, z, width, height) => {
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
  };

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = (canvas.width = canvas.parentElement.clientWidth);
    const height = (canvas.height = canvas.parentElement.clientHeight);

    ctx.clearRect(0, 0, width, height);

    // 1. Draw background (token colours)
    const T = readTokens();
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, T.sunken);
    bg.addColorStop(1, T.ground);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Terrain Wireframe & Elevation Contours
    const grid = terrainGrid.current;
    if (grid.length > 0 && (visibleLayers.terrain ?? true)) {
      ctx.strokeStyle = T.lineStrong;
      ctx.lineWidth = 1;

      // Draw rows
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

      // Draw cols
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

    // 3. Draw Water Bodies (Vrishabhavathi Stream & Kengeri Lake)
    if (visibleLayers.water_bodies ?? true) {
      REAL_WORLD_FEATURES.waterBodies.forEach((wb) => {
        if (wb.type === 'line') {
          ctx.beginPath();
          ctx.strokeStyle = T.water;
          ctx.lineWidth = 5;
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

    // 4. Draw Sewer Lines (Violet, Strictly Non-Potable)
    if (visibleLayers.sewerage ?? true) {
      ctx.save();
      REAL_WORLD_FEATURES.sewerPipes.forEach((pipe) => {
        ctx.beginPath();
        ctx.strokeStyle = SEWER_COLOUR;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 5]);
        const depthOffset = showIllustrativeDepth ? -12 : 0;
        pipe.coordinates.forEach((coord, idx) => {
          const pt = projectToMetricScene(coord[0], coord[1], 810);
          const sc = project(pt.x, pt.y + depthOffset, pt.z, width, height);
          if (idx === 0) ctx.moveTo(sc.x, sc.y);
          else ctx.lineTo(sc.x, sc.y);
        });
        ctx.stroke();
      });
      ctx.restore();
    }

    // 5. Draw Potable Water Pipes (Cyan, 3D Pipe Cylinder Styling)
    if (visibleLayers.potable_water ?? true) {
      REAL_WORLD_FEATURES.potablePipes.forEach((pipe) => {
        const isSelected = selectedFeature?.id === pipe.id;
        ctx.beginPath();
        ctx.strokeStyle = isSelected ? T.ink : T.water;
        ctx.lineWidth = isSelected ? 5.5 : pipe.properties.diameter_mm >= 450 ? 4.5 : 3;
        ctx.lineCap = 'round';

        const depthOffset = showIllustrativeDepth ? -8 : 0;

        pipe.coordinates.forEach((coord, idx) => {
          const pt = projectToMetricScene(coord[0], coord[1], 815);
          const sc = project(pt.x, pt.y + depthOffset, pt.z, width, height);
          if (idx === 0) ctx.moveTo(sc.x, sc.y);
          else ctx.lineTo(sc.x, sc.y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
      });
    }

    // 6. Draw Valves (Amber Markers in 3D)
    if (visibleLayers.valves ?? true) {
      REAL_WORLD_FEATURES.valves.forEach((v) => {
        const depthOffset = showIllustrativeDepth ? -8 : 0;
        const pt = projectToMetricScene(v.coordinates[0], v.coordinates[1], 815);
        const sc = project(pt.x, pt.y + depthOffset, pt.z, width, height);
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = T.valve;
        ctx.fill();
        ctx.strokeStyle = T.surface;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    // 7. Draw Pumping Stations & Borewells (Surface Markers)
    if (visibleLayers.infrastructure ?? true) {
      REAL_WORLD_FEATURES.pumpingStations.forEach((ps) => {
        const pt = projectToMetricScene(ps.coordinates[0], ps.coordinates[1], 816);
        const sc = project(pt.x, pt.y + 4, pt.z, width, height);
        ctx.fillStyle = PUMP_COLOUR;
        ctx.fillRect(sc.x - 7, sc.y - 7, 14, 14);
        ctx.strokeStyle = T.surface;
        ctx.lineWidth = 2;
        ctx.strokeRect(sc.x - 7, sc.y - 7, 14, 14);
      });

      REAL_WORLD_FEATURES.borewells.forEach((bw) => {
        const pt = projectToMetricScene(bw.coordinates[0], bw.coordinates[1], 816);
        const sc = project(pt.x, pt.y + 2, pt.z, width, height);
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = T.sensor;
        ctx.fill();
        ctx.strokeStyle = T.surface;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }
  }, [rotation, zoom, pan, selectedFeature, showIllustrativeDepth, visibleLayers, theme]);

  // Mouse Interaction: Orbit, Pan & Zoom
  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStart.current = {
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
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    if (dragStart.current.button === 0 && !e.shiftKey) {
      // Orbit
      setRotation({
        azimuth: (dragStart.current.azimuth + dx * 0.45) % 360,
        elevation: Math.max(12, Math.min(85, dragStart.current.elevation - dy * 0.35)),
      });
    } else {
      // Pan
      setPan({
        x: dragStart.current.panX + dx,
        y: dragStart.current.panY + dy,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom((z) => Math.max(0.4, Math.min(3.5, z * factor)));
  };

  const resetCamera = () => {
    setRotation({ azimuth: 45, elevation: 35 });
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className='stu-terr' onWheel={handleWheel}>
      <canvas
        ref={canvasRef}
        className='stu-terr__canvas'
        role='img'
        aria-label='Illustrative 3D terrain of the Kengeri area. Drag to orbit, shift-drag to pan, scroll to zoom.'
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      <div className='stu-terr__hud'>
        <div className='stu-terr__compass'>
          <Compass size={16} aria-hidden='true' style={{ transform: `rotate(${-rotation.azimuth}deg)` }} />
          <span>{Math.round(rotation.azimuth)}° az · {Math.round(rotation.elevation)}° el</span>
        </div>
        <Switch
          className='stu-terr__depth'
          label={showIllustrativeDepth ? 'Illustrative depth (−2.5 m)' : 'Flattened to ground'}
          checked={showIllustrativeDepth}
          onChange={() => onToggleDepth?.()}
          title='Toggle between ground surface and assumed −2.5 m depth'
        />
      </div>

      <MapControlStack>
        <IconButton label='Zoom in' icon={ZoomIn} onClick={() => setZoom((z) => Math.min(3.5, z * 1.2))} />
        <IconButton label='Zoom out' icon={ZoomOut} onClick={() => setZoom((z) => Math.max(0.4, z / 1.2))} />
        <IconButton label='Reset camera' icon={RotateCcw} onClick={resetCamera} />
      </MapControlStack>

      <div className='stu-terr__legend'>
        <MapLegend items={LEGEND_ITEMS} />
      </div>
    </div>
  );
}
