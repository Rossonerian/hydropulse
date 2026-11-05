import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import {
  Crosshair,
  Layers2,
  MapPin,
  Maximize2,
  RotateCcw,
  Waves,
  ZoomIn,
  ZoomOut,
  Info,
  GitBranch,
  Circle,
} from 'lucide-react';

const reservoirIcon = L.divIcon({
  className: 'reservoir-marker',
  html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.4c-1.7 3.1-6.2 7.7-6.2 12.2a6.2 6.2 0 0 0 12.4 0c0-4.5-4.5-9.1-6.2-12.2Z" fill="none" stroke="#5BC0DE" stroke-width="2.2"/><path d="M8.6 14.2a3.5 3.5 0 0 0 3.3 3.2" fill="none" stroke="#5BC0DE" stroke-width="1.8" stroke-linecap="round"/></svg>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const sensorPulseIcon = L.divIcon({
  className: 'sensor-pulse-marker',
  html: '<span aria-hidden="true" style="border-color: #10B981; box-shadow: 0 0 10px #10B981;"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const leakRadarIcon = L.divIcon({
  className: 'leak-radar-marker',
  html: '<span aria-hidden="true" style="border-color: #EF4444; box-shadow: 0 0 14px #EF4444;"></span>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

// Fit network bounds strictly ONCE upon initial valid data receipt to prevent unexpected view resets.
function InitialFitBounds({ network }) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (hasFitted.current) return;
    if (network?.nodes && network.nodes.length > 0) {
      const validNodes = network.nodes.filter(
        (n) => Number.isFinite(n.lat) && Number.isFinite(n.lng) && (n.lat !== 0 || n.lng !== 0),
      );
      if (validNodes.length > 0) {
        const lats = validNodes.map((n) => n.lat);
        const lngs = validNodes.map((n) => n.lng);
        const bounds = [
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)],
        ];
        map.fitBounds(bounds, { padding: [35, 35], maxZoom: 17 });
        hasFitted.current = true;
      }
    }
  }, [network, map]);

  return null;
}

// Controller for explicit zoom and fit actions from the toolbar
function MapController({ fitTrigger, resetTrigger, network }) {
  const map = useMap();

  useEffect(() => {
    if (fitTrigger > 0 && network?.nodes?.length) {
      const validNodes = network.nodes.filter(
        (n) => Number.isFinite(n.lat) && Number.isFinite(n.lng) && (n.lat !== 0 || n.lng !== 0),
      );
      if (validNodes.length > 0) {
        const lats = validNodes.map((n) => n.lat);
        const lngs = validNodes.map((n) => n.lng);
        map.fitBounds(
          [
            [Math.min(...lats), Math.min(...lngs)],
            [Math.max(...lats), Math.max(...lngs)],
          ],
          { padding: [35, 35], maxZoom: 17 },
        );
      }
    }
  }, [fitTrigger, network, map]);

  useEffect(() => {
    if (resetTrigger > 0) {
      const center = network?.center || { lat: 12.9081, lng: 77.4852 };
      map.flyTo([center.lat, center.lng], 16, { duration: 0.5 });
    }
  }, [resetTrigger, network, map]);

  return null;
}

function FlyTo({ node }) {
  const map = useMap();
  useEffect(() => {
    if (node && Number.isFinite(node.lat) && Number.isFinite(node.lng)) {
      map.flyTo([node.lat, node.lng], 17, { duration: 0.65 });
    }
  }, [node, map]);
  return null;
}

function ScanOverlay({ active }) {
  return active ? (
    <div className='scan-overlay'>
      <div className='scan-beam' />
      <div className='scan-caption'>
        <span className='scan-spinner' /> PRESSURE SIGNATURE ANALYSIS <b>IN PROGRESS</b>
      </div>
    </div>
  ) : null;
}

function MapCanvas({
  network,
  networkSource,
  phase,
  result,
  selected,
  setSelected,
  judge,
  revealed,
  mode,
  onPick,
  focusNode,
}) {
  // Tile options: 'osm' (OpenStreetMap standard), 'carto' (Dark Carto), or 'grid' (Local grid)
  const [tileMode, setTileMode] = useState('osm');
  const [tilesFailed, setTilesFailed] = useState(false);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [valvePulse, setValvePulse] = useState(false);
  const mapInstanceRef = useRef(null);

  // Map nodes once for fast lookups
  const byId = useMemo(
    () => Object.fromEntries((network?.nodes || []).map((n) => [n.id, n])),
    [network],
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
    () => new Map((network?.sensor_ids || []).map((id, index) => [id, index + 1])),
    [network],
  );

  const top = result?.predicted_top_candidates || [];
  const heat = result?.node_heatmap || {};

  // Pulse effect for valving pipes during isolation
  useEffect(() => {
    if (phase !== 'isolated' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValvePulse(false);
      return undefined;
    }
    const timer = setInterval(() => setValvePulse((pulse) => !pulse), 520);
    return () => clearInterval(timer);
  }, [phase]);

  // Selected item details for contextual inspector
  const selectedNode = byId[selected];
  const selectedPipe = (network?.pipes || []).find((p) => p.id === selected);

  const centerCoords = [network?.center?.lat || 12.9081, network?.center?.lng || 77.4852];

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  return (
    <section className={`map-canvas ${tileMode === 'grid' || tilesFailed ? 'no-tiles' : ''}`}>
      <MapContainer
        center={centerCoords}
        zoom={16}
        zoomControl={false}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        dragging={true}
        preferCanvas={true}
        ref={mapInstanceRef}
        attributionControl={true}
      >
        <InitialFitBounds network={network} />
        <MapController fitTrigger={fitTrigger} resetTrigger={resetTrigger} network={network} />
        <FlyTo node={focusNode} />

        {/* 1. OpenStreetMap TileLayer with standard attribution */}
        {tileMode === 'osm' && !tilesFailed && (
          <TileLayer
            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
            maxZoom={19}
            eventHandlers={{
              tileerror: () => setTilesFailed(true),
            }}
          />
        )}

        {/* 2. Carto Dark TileLayer */}
        {tileMode === 'carto' && !tilesFailed && (
          <TileLayer
            crossOrigin='anonymous'
            url='https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'
            maxZoom={19}
            eventHandlers={{
              tileerror: () => setTilesFailed(true),
            }}
          />
        )}

        {/* Render Pipes (with intermediate route coordinates if modified in draft) */}
        {(network?.pipes || []).map((p) => {
          const a = byId[p.source];
          const b = byId[p.target];
          if (!a || !b) return null;

          const isSelected = selected === p.id;
          const isValving = valving.has(p.id);
          const isClosed = p.status === 'CLOSED';

          // Use intermediate vertices if present in pipe draft
          const polyPositions =
            p.coordinates && p.coordinates.length > 0
              ? [[a.lat, a.lng], ...p.coordinates.map((c) => (Array.isArray(c) ? c : [c.lat, c.lng])), [b.lat, b.lng]]
              : [
                  [a.lat, a.lng],
                  [b.lat, b.lng],
                ];

          const color = isSelected
            ? '#F4D6B0'
            : isValving
              ? '#D97706'
              : isClosed
                ? '#64748B'
                : '#5BC0DE';

          const strokeWidth = isSelected
            ? 6.5
            : isValving
              ? 5
              : p.diameter_mm >= 400
                ? 4.5
                : p.diameter_mm >= 250
                  ? 3
                  : 2;

          return (
            <Polyline
              key={p.id}
              positions={polyPositions}
              pathOptions={{
                color,
                weight: strokeWidth,
                opacity: isValving ? (valvePulse ? 0.45 : 1) : isClosed ? 0.45 : 0.88,
                dashArray: isValving ? '7 7' : isClosed ? '5 5' : null,
                className: isValving ? 'valve-flash' : isSelected ? 'pipe-selected' : '',
              }}
              eventHandlers={{
                click: () => setSelected(p.id),
              }}
            >
              <Tooltip sticky>
                <b>{p.id}</b> · {p.diameter_mm} mm
                <br />
                {p.length_m} m · {p.flow_m3h} m³/h
                <br />
                {p.road_class} · {p.status}
              </Tooltip>
            </Polyline>
          );
        })}

        {/* Heatmap rings for leak candidates */}
        {Object.entries(heat).map(([id, value]) => {
          const n = byId[id];
          if (!n || value < 0.08) return null;
          const col = value > 0.72 ? '#EF4444' : value > 0.38 ? '#D97706' : '#1C2541';
          return (
            <CircleMarker
              key={`h-${id}`}
              center={[n.lat, n.lng]}
              radius={4 + value * 11}
              pathOptions={{
                color: col,
                fillColor: col,
                fillOpacity: 0.12 + value * 0.3,
                weight: 1,
                opacity: 0.6,
              }}
            />
          );
        })}

        {/* Sentinel sensor CSS pulse markers */}
        {(network?.nodes || [])
          .filter((node) => sensors.has(node.id) || node.is_sensor)
          .map((node) => (
            <Marker
              key={`sensor-pulse-${node.id}`}
              position={[node.lat, node.lng]}
              icon={sensorPulseIcon}
              interactive={false}
            />
          ))}

        {/* Network Junctions / Nodes */}
        {(network?.nodes || []).map((n) => {
          const sensor = sensors.has(n.id) || n.is_sensor;
          const topRank = top.findIndex((c) => c.node_id === n.id);
          const truth = judge && revealed && result?.injected_node_id === n.id;
          const hiddenTarget = judge && phase === 'idle' && selected === n.id;
          const picked = selected === n.id && !judge;
          const prob = Number(heat[n.id] || n.leak_probability || 0);

          const fill = isolatedNodes.has(n.id)
            ? '#64748B'
            : sensor
              ? '#10B981'
              : prob > 0.6
                ? '#EF4444'
                : '#3A506B';

          return (
            <CircleMarker
              key={n.id}
              center={[n.lat, n.lng]}
              radius={sensor ? 6.2 : topRank === 0 ? 9.5 : topRank > 0 ? 7 : 3.6}
              pathOptions={{
                color: truth ? '#FFFFFF' : picked ? '#5BC0DE' : fill,
                fillColor: hiddenTarget ? '#0B132B' : fill,
                fillOpacity: hiddenTarget ? 0.3 : 0.95,
                weight: truth || picked ? 3 : 1.2,
                opacity: isolatedNodes.has(n.id) ? 0.45 : 1,
                className: sensor ? 'sensor-core' : undefined,
              }}
              eventHandlers={{
                click: () => {
                  setSelected(n.id);
                  onPick?.(n);
                },
              }}
            >
              <Tooltip
                permanent={sensor || (result && topRank >= 0 && topRank < 5)}
                direction={topRank === 0 ? 'top' : sensor ? 'right' : 'top'}
                offset={topRank === 0 ? [0, -10] : sensor ? [8, 0] : [0, -8]}
                className={
                  topRank === 0
                    ? 'leak-chip'
                    : topRank > 0 && topRank < 5
                      ? 'rank-chip'
                      : sensor
                        ? 'sensor-chip'
                        : ''
                }
              >
                {topRank === 0
                  ? `LEAK · ${n.id} · ${top[0].confidence_pct.toFixed(1)}%`
                  : topRank > 0 && topRank < 5
                    ? String(topRank + 1)
                    : sensor
                      ? `S${sensors.get(n.id) || 1}`
                      : n.id}
                {!sensor && !result ? (
                  <>
                    <br />
                    {n.base_pressure_m?.toFixed(1)} m · {n.households} households
                  </>
                ) : null}
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* Revealed Ground-Truth Marker */}
        {judge && revealed && result?.injected_node_id && byId[result.injected_node_id] && (
          <CircleMarker
            center={[byId[result.injected_node_id].lat, byId[result.injected_node_id].lng]}
            radius={14}
            pathOptions={{
              color: '#FFFFFF',
              fillOpacity: 0,
              weight: 2.2,
              dashArray: '5 4',
              className: 'truth-ring',
            }}
          >
            <Tooltip permanent direction='bottom' className='truth-chip'>
              INJECTED NODE
            </Tooltip>
          </CircleMarker>
        )}

        {/* Leak radar animation marker at rank-1 candidate */}
        {result?.predicted_top_candidates?.[0] && byId[result.predicted_top_candidates[0].node_id] && (
          <Marker
            position={[
              byId[result.predicted_top_candidates[0].node_id].lat,
              byId[result.predicted_top_candidates[0].node_id].lng,
            ]}
            icon={leakRadarIcon}
            interactive={false}
          />
        )}

        {/* Reservoirs & Tanks */}
        {(network?.nodes || [])
          .filter((n) => n.type === 'reservoir' || n.type === 'tank')
          .map((n) => (
            <Marker key={`r-${n.id}`} position={[n.lat, n.lng]} icon={reservoirIcon}>
              <Tooltip>
                {n.type.toUpperCase()} · {n.id}
              </Tooltip>
            </Marker>
          ))}
      </MapContainer>

      {/* Local grid overlay for offline/fallback */}
      <div className='map-grid' />
      <ScanOverlay active={phase === 'simulating'} />

      {/* Map Control Toolbar */}
      <div className='map-toolbar' role='toolbar' aria-label='Map navigation controls'>
        <button
          className='map-toggle'
          onClick={handleZoomIn}
          title='Zoom In (+)'
          type='button'
          aria-label='Zoom in'
        >
          <ZoomIn size={14} />
        </button>
        <button
          className='map-toggle'
          onClick={handleZoomOut}
          title='Zoom Out (-)'
          type='button'
          aria-label='Zoom out'
        >
          <ZoomOut size={14} />
        </button>
        <button
          className='map-toggle'
          onClick={() => setFitTrigger((c) => c + 1)}
          title='Fit Network to Screen'
          type='button'
          aria-label='Fit network'
        >
          <Maximize2 size={14} />
          <span>Fit</span>
        </button>
        <button
          className='map-toggle'
          onClick={() => setResetTrigger((c) => c + 1)}
          title='Reset to Kengeri DMA Overview'
          type='button'
          aria-label='Reset overview'
        >
          <RotateCcw size={14} />
          <span>Reset</span>
        </button>
        <button
          className={`map-toggle ${tileMode !== 'grid' && !tilesFailed ? 'active' : ''}`}
          onClick={() => {
            setTilesFailed(false);
            setTileMode((current) => (current === 'osm' ? 'carto' : current === 'carto' ? 'grid' : 'osm'));
          }}
          title='Toggle Basemap (OSM / CARTO / Grid)'
          type='button'
        >
          <Layers2 size={14} />
          <b>{tilesFailed ? 'Offline' : tileMode.toUpperCase()}</b>
        </button>
      </div>

      {/* Selected Entity HUD Inspector */}
      {(selectedNode || selectedPipe) && (
        <div className='map-entity-inspector' role='region' aria-label='Selected entity details'>
          <div className='inspector-pill-title'>
            {selectedPipe ? <GitBranch size={13} /> : <Circle size={13} />}
            <span>{selectedPipe ? 'PIPE' : (selectedNode?.type || 'NODE').toUpperCase()}</span>
            <b>{selected}</b>
          </div>
          <div className='inspector-pill-data'>
            {selectedPipe ? (
              <>
                <span>Ø {selectedPipe.diameter_mm} mm</span>
                <span>{selectedPipe.length_m} m</span>
                <span>{selectedPipe.flow_m3h} m³/h</span>
                <span>{selectedPipe.status}</span>
              </>
            ) : (
              <>
                <span>{selectedNode?.base_pressure_m?.toFixed(1)} m head</span>
                <span>{selectedNode?.households} hh</span>
                <span>{selectedNode?.is_sensor ? 'Sentinel Sensor' : 'Standard'}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Offline status notice */}
      {(tilesFailed || tileMode === 'grid') && (
        <div className='map-fallback'>
          {tilesFailed ? 'BASEMAP OFFLINE · LOCAL VECTOR OVERLAY ACTIVE' : 'LOCAL GRID MODE'}
        </div>
      )}

      {/* Geographic Coordinates & District Label */}
      <div className='map-coordinate'>
        <MapPin size={12} /> KENGERI DMA 04 <span>·</span> 12.9081° N, 77.4852° E
      </div>

      {/* Mandatory Regulatory / Demonstration Disclaimer Watermark */}
      <div className='map-disclaimer-watermark'>
        SIMULATED NETWORK · DEMO GEOGRAPHIC PLACEMENT · NOT VERIFIED BWSSB GEOMETRY
      </div>

      {/* Map Legend */}
      <div className='map-legend'>
        <div className='legend-title'>
          NETWORK LAYERS{' '}
          <span>● {mode === 'live' ? 'LIVE' : mode === 'offline' ? 'CACHED' : 'MOCK'}</span>
        </div>
        <div className='legend-item'>
          <i className='legend-pipe' style={{ background: '#5BC0DE' }} />
          Active pipeline
        </div>
        <div className='legend-item'>
          <i className='legend-sensor' style={{ background: '#10B981' }} />
          Sentinel sensor (S1..S5)
        </div>
        <div className='legend-item'>
          <i className='legend-leak' style={{ background: '#EF4444' }} />
          Burst / leak candidate
        </div>
        <div className='legend-item'>
          <i className='legend-valve' style={{ background: '#D97706' }} />
          Recommended valve closure
        </div>
        <div className='legend-divider' />
        <div className='legend-note'>
          <Waves size={12} /> Torricelli pressure-driven monitoring
        </div>
      </div>

      <div className='map-scale'>
        250 m <span />
      </div>

      <div className='map-status'>
        <span />
        NETWORK SYNCHRONIZED <b>·</b>{' '}
        {mode === 'live'
          ? 'REAL-TIME TELEMETRY'
          : networkSource === 'live'
            ? 'LAST LIVE SNAPSHOT'
            : networkSource === 'recorded'
              ? 'RECORDED FIXTURE'
              : 'SYNTHETIC DEMO NETWORK'}
      </div>
    </section>
  );
}

export default memo(MapCanvas);
