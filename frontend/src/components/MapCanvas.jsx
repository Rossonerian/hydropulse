import { memo, useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
import { Layers2, Crosshair, Navigation, Maximize2, Minimize2, Flame } from 'lucide-react';
import SkeletonLoader from './SkeletonLoader.jsx';
import { basemapProxyUrl } from '../api/client.js';
import { MapControlStack, MapLegend, IconButton } from '../ui/index.js';
import { useTheme, getTokenValue } from '../ui/useTheme.js';

const CARTO_DARK_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const CARTO_LIGHT_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

// Fit network bounds strictly once upon initial valid data receipt
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

function FlyTo({ node }) {
  const map = useMap();
  useEffect(() => {
    if (node) map.flyTo([node.lat, node.lng], 18, { duration: 0.6 });
  }, [node, map]);
  return null;
}

function Recenter({ center, revision }) {
  const map = useMap();
  useEffect(() => {
    if (center && revision > 0) map.flyTo([center.lat, center.lng], 16, { duration: 0.55 });
  }, [center, revision, map]);
  return null;
}

function FullscreenControl() {
  const map = useMap();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    const container = map.getContainer();
    if (!document.fullscreenElement) {
      container.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, [map]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  return (
    <IconButton
      label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      icon={isFullscreen ? Minimize2 : Maximize2}
      size='sm'
      onClick={toggleFullscreen}
    />
  );
}

function isProviderErrorTile(tile) {
  try {
    // Some providers return an access-denied image with HTTP 200; detect its uniform watermark pixels.
    const canvas = document.createElement('canvas');
    canvas.width = tile.naturalWidth;
    canvas.height = tile.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(tile, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let uniform = 0,
      total = 0;
    for (let y = 12; y < canvas.height; y += 24)
      for (let x = 12; x < canvas.width; x += 24) {
        const i = (y * canvas.width + x) * 4,
          r = pixels[i],
          g = pixels[i + 1],
          b = pixels[i + 2];
        if (
          Math.abs(r - 38) < 2 &&
          Math.abs(g - 38) < 2 &&
          Math.abs(b - 38) < 2
        )
          uniform++;
        total++;
      }
    return uniform / total > 0.72;
  } catch {
    return true;
  }
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
  basemapProxy = false,
}) {
  const { theme } = useTheme();
  const [basemap, setBasemap] = useState(true);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [recenterRevision, setRecenterRevision] = useState(0);
  const [showFlowArrows, setShowFlowArrows] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [layerTogglesOpen, setLayerTogglesOpen] = useState(false);

  // Index nodes once because every pipe and overlay resolves endpoints by id.
  const byId = useMemo(
    () => Object.fromEntries((network?.nodes || []).map((n) => [n.id, n])),
    [network],
  );

  const valving = useMemo(
    () =>
      new Set(
        phase === 'isolated' ? result?.recommended_valves_to_close || [] : [],
      ),
    [phase, result],
  );

  const isolated = useMemo(
    () => new Set(phase === 'isolated' ? result?.isolated_node_ids || [] : []),
    [phase, result],
  );

  const sensors = useMemo(
    () =>
      new Map((network?.sensor_ids || []).map((id, index) => [id, index + 1])),
    [network],
  );

  const top = result?.predicted_top_candidates || [];
  const heat = result?.node_heatmap || {};

  // Token colors for Leaflet canvas rendering
  const colors = useMemo(() => ({
    water: getTokenValue('--water'),
    inkFaint: getTokenValue('--ink-faint'),
    sensor: getTokenValue('--sensor'),
    leak: getTokenValue('--leak'),
    valve: getTokenValue('--valve'),
    heat0: getTokenValue('--heat-0'),
    heat1: getTokenValue('--heat-1'),
    heat2: getTokenValue('--heat-2'),
    heat3: getTokenValue('--heat-3'),
    heat4: getTokenValue('--heat-4'),
    ink: getTokenValue('--ink'),
    surface: getTokenValue('--surface'),
  }), [theme]);

  // Basemap URL based on theme
  const night = theme === 'night';
  const basemapUrl = basemapProxy
    ? basemapProxyUrl(night ? 'dark' : 'light')
    : night
      ? CARTO_DARK_URL
      : CARTO_LIGHT_URL;

  // Create reservoir/tank icon with theme-aware color
  const reservoirIcon = useMemo(() => {
    const color = colors.water;
    return L.divIcon({
      className: 'reservoir-marker',
      html: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.4c-1.7 3.1-6.2 7.7-6.2 12.2a6.2 6.2 0 0 0 12.4 0c0-4.5-4.5-9.1-6.2-12.2Z" fill="none" stroke="${color}" stroke-width="1.8"/><path d="M8.6 14.2a3.5 3.5 0 0 0 3.3 3.2" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/></svg>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }, [colors.water]);

  // Animated pulsing valve barrier marker icon (hydraulic bowtie valve symbol)
  const valveBarrierIcon = useMemo(() => L.divIcon({
    className: 'valve-barrier-marker',
    html: `<div class="valve-barrier-glow"></div>
           <div class="valve-barrier-badge" title="Isolation Valve Closed (Click for cut-set details)">
             <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
               <polygon points="4,6 12,12 4,18" />
               <polygon points="20,6 12,12 20,18" />
               <line x1="12" y1="12" x2="12" y2="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
               <line x1="8" y1="4" x2="16" y2="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
               <line x1="12" y1="9" x2="12" y2="15" stroke="var(--surface-raised, #0f172a)" stroke-width="2" />
             </svg>
           </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  }), []);

  // Sentinel radar pulse icon
  const sentinelRadarIcon = useMemo(() => L.divIcon({
    className: 'sentinel-marker-wrap',
    html: '<div class="sentinel-radar-ring"></div><div class="sentinel-core-dot"></div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  }), []);

  // Leak ring icon (static, no radar animation)
  const leakRingIcon = useMemo(() => L.divIcon({
    className: 'leak-ring-marker',
    html: '<span aria-hidden="true"></span>',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  }), []);

  // Compute directional hydraulic flow arrows along pipes
  const flowArrows = useMemo(() => {
    if (!showFlowArrows) return [];
    const arrows = [];
    for (const p of network?.pipes || []) {
      const a = byId[p.source];
      const b = byId[p.target];
      if (!a || !b) continue;
      const isIsolated = isolated.has(p.source) || isolated.has(p.target);
      if (isIsolated) continue;
      const midLat = (a.lat + b.lat) / 2;
      const midLng = (a.lng + b.lng) / 2;
      const dLng = b.lng - a.lng;
      const dLat = b.lat - a.lat;
      const angle = (Math.atan2(dLng, dLat) * 180) / Math.PI;
      arrows.push({
        id: `arrow-${p.id}`,
        position: [midLat, midLng],
        angle,
        pipeId: p.id,
      });
    }
    return arrows;
  }, [network?.pipes, byId, isolated, showFlowArrows]);

  // Calculate pipe midpoints for valve markers
  const valveMarkers = useMemo(() => {
    if (phase !== 'isolated') return [];
    const markers = [];
    for (const p of network?.pipes || []) {
      if (!valving.has(p.id)) continue;
      const a = byId[p.source];
      const b = byId[p.target];
      if (!a || !b) continue;
      const midLat = (a.lat + b.lat) / 2;
      const midLng = (a.lng + b.lng) / 2;
      markers.push({
        id: `valve-${p.id}`,
        position: [midLat, midLng],
        pipeId: p.id,
      });
    }
    return markers;
  }, [phase, network?.pipes, valving, byId]);

  // Legend items
  const legendItems = useMemo(() => [
    { key: 'pipe', swatch: 'pipe', label: 'Pipe' },
    { key: 'sensor', swatch: 'sensor', label: 'Sensor' },
    { key: 'heat', swatch: 'heat', label: 'Heat' },
    { key: 'leak', swatch: 'leak', label: 'Leak' },
    { key: 'valve', swatch: 'valve', label: 'Valve' },
    { key: 'isolated', swatch: 'isolated', label: 'Isolated' },
    { key: 'node', swatch: 'node', label: 'Node' },
  ], []);

  const fallback = !basemap || tilesFailed;

  return (
    <section className={`map-canvas ${fallback ? 'no-tiles' : ''}`}>
      <MapContainer
        center={[
          network?.center?.lat || 12.9081,
          network?.center?.lng || 77.4852,
        ]}
        zoom={16}
        zoomControl={false}
        preferCanvas
      >
        <TileLayer
          crossOrigin='anonymous'
          url={basemapUrl}
          attribution='&copy; OpenStreetMap &copy; CARTO'
          eventHandlers={{
            tileerror: () => setTilesFailed(true),
            tileload: (e) => {
              if (isProviderErrorTile(e.tile)) setTilesFailed(true);
            },
          }}
          opacity={basemap && !tilesFailed ? 1 : 0}
        />
        <InitialFitBounds network={network} />
        <FlyTo node={focusNode} />
        <Recenter center={network?.center} revision={recenterRevision} />

        {/* Pipes */}
        {(network?.pipes || []).map((p) => {
          const a = byId[p.source];
          const b = byId[p.target];
          if (!a || !b) return null;
          const active = valving.has(p.id);
          const isolatedPipe = isolated.has(p.source) || isolated.has(p.target);
          const isSelected = selected === p.id;
          const width =
            p.diameter_mm >= 400 ? 5 : p.diameter_mm >= 250 ? 3 : 1.5;
          return (
            <Polyline
              key={p.id}
              positions={[
                [a.lat, a.lng],
                [b.lat, b.lng],
              ]}
              pathOptions={{
                color: isSelected ? colors.sensor : isolatedPipe ? colors.inkFaint : active ? colors.valve : colors.water,
                weight: isSelected ? width + 2 : active ? 4.5 : width,
                opacity: isolatedPipe ? 0.4 : active ? 1.0 : 0.7,
                dashArray: isolatedPipe ? '6 6' : active ? '8 6' : null,
              }}
              eventHandlers={{
                click: () => {
                  setSelected?.(p.id);
                  onPick?.(p);
                },
              }}
            >
              <Tooltip sticky>
                <b>{p.id}</b> · {p.diameter_mm} mm
                <br />
                {p.length_m} m · {p.flow_m3h} m³/h
                <br />
                {p.road_class}
              </Tooltip>
            </Polyline>
          );
        })}

        {/* Directional Hydraulic Flow Arrows */}
        {flowArrows.map((arrow) => (
          <Marker
            key={arrow.id}
            position={arrow.position}
            icon={L.divIcon({
              className: 'pipe-flow-arrow',
              html: `<svg viewBox="0 0 12 12" style="transform: rotate(${arrow.angle}deg); width: 10px; height: 10px;">
                <path d="M2 10 L6 3 L10 10 Z" fill="${colors.water}" opacity="0.75" />
              </svg>`,
              iconSize: [10, 10],
              iconAnchor: [5, 5],
            })}
            interactive={false}
          />
        ))}

        {/* Heat circles (only render high-confidence candidate zone P >= 0.35 to prevent clutter) */}
        {showHeatmap && phase !== 'idle' && Object.entries(heat).map(([id, value]) => {
          const n = byId[id];
          if (!n || value < 0.35) return null;
          const heatColor =
            value >= 0.85 ? colors.heat4 :
            value >= 0.65 ? colors.heat3 :
            value >= 0.45 ? colors.heat2 : colors.heat1;
          return (
            <CircleMarker
              key={`h${id}`}
              center={[n.lat, n.lng]}
              radius={7 + value * 5}
              pathOptions={{
                color: heatColor,
                fillColor: heatColor,
                fillOpacity: 0.2 + value * 0.25,
                weight: 1.5,
                opacity: 0.7,
              }}
            />
          );
        })}

        {/* Junction nodes */}
        {(network?.nodes || []).map((n) => {
          if (n.type === 'reservoir' || n.type === 'tank') return null;
          if (sensors.has(n.id) || n.is_sensor) return null;

          const topRank = top.findIndex((c) => c.node_id === n.id);
          const truth = judge && revealed && result?.injected_node_id === n.id;
          const hiddenTarget = judge && phase === 'idle' && selected === n.id;
          const picked = selected === n.id && !judge;
          const isIsolated = isolated.has(n.id);
          const isTopCandidate = topRank === 0;

          const fill = isIsolated
            ? colors.inkFaint
            : isTopCandidate
              ? colors.leak
              : picked
                ? colors.water
                : colors.inkFaint;

          const radius = isTopCandidate ? 8.5 : picked ? 6.5 : 3.5;
          const weight = truth || picked || isTopCandidate ? 2 : 1;
          const opacity = isIsolated ? 0.35 : 0.85;

          return (
            <CircleMarker
              key={n.id}
              center={[n.lat, n.lng]}
              radius={radius}
              pathOptions={{
                color: truth ? colors.surface : picked ? colors.surface : fill,
                fillColor: hiddenTarget ? colors.surface : fill,
                fillOpacity: hiddenTarget ? 0.3 : isIsolated ? 0.25 : isTopCandidate ? 0.95 : 0.7,
                weight,
                opacity,
                dashArray: isIsolated ? '4 3' : null,
              }}
              eventHandlers={{
                click: () => {
                  const cleanId = String(n.id);
                  setSelected(cleanId);
                  onPick?.(cleanId);
                },
              }}
            >
              {(picked || truth || (result && topRank >= 0 && topRank < 5)) ? (
                <Tooltip
                  permanent={result && topRank >= 0 && topRank < 5}
                  direction='top'
                  offset={[0, -8]}
                  className={
                    topRank === 0
                      ? 'leak-chip'
                      : topRank > 0 && topRank < 5
                        ? 'rank-chip'
                        : 'sensor-chip'
                  }
                >
                  {topRank === 0
                    ? `${n.id} · ${top[0].confidence_pct?.toFixed(1) || '0'}%`
                    : topRank > 0 && topRank < 5
                      ? String(topRank + 1)
                      : n.id}
                </Tooltip>
              ) : (
                <Tooltip direction='top' offset={[0, -6]}>
                  <div className='map-node-tooltip'>
                    <strong>{n.id}</strong> {n.elevation_m ? `· ${n.elevation_m}m` : ''}
                    {n.base_pressure_m ? <div>Base: {n.base_pressure_m.toFixed(1)}m</div> : null}
                    {n.households ? <div>{n.households} homes</div> : null}
                    <div style={{ fontSize: '10px', color: colors.water, marginTop: '2px' }}>
                      Click to select
                    </div>
                  </div>
                </Tooltip>
              )}
            </CircleMarker>
          );
        })}

        {/* Sensor nodes with permanent labels */}
        {(network?.nodes || [])
          .filter((n) => sensors.has(n.id) || n.is_sensor)
          .map((n) => {
            const sensorIndex = sensors.get(n.id) || 1;
            const topRank = top.findIndex((c) => c.node_id === n.id);
            const isIsolated = isolated.has(n.id);

            return (
              <CircleMarker
                key={`sensor-${n.id}`}
                center={[n.lat, n.lng]}
                radius={8}
                pathOptions={{
                  color: colors.sensor,
                  fillColor: colors.sensor,
                  fillOpacity: isIsolated ? 0.3 : 0.9,
                  weight: 2,
                  opacity: isIsolated ? 0.4 : 1,
                }}
                eventHandlers={{
                  click: () => {
                    const cleanId = String(n.id);
                    setSelected(cleanId);
                    onPick?.(cleanId);
                  },
                }}
              >
                <Tooltip
                  permanent
                  direction='right'
                  offset={[8, 0]}
                  className='sensor-chip'
                >
                  S{sensorIndex}
                  {topRank === 0 && (
                    <>
                      <br />
                      {top[0].confidence_pct?.toFixed(1) || '0'}%
                    </>
                  )}
                </Tooltip>
              </CircleMarker>
            );
          })}

        {/* Reservoir / Tank markers */}
        {(network?.nodes || [])
          .filter((n) => n.type === 'reservoir' || n.type === 'tank')
          .map((n) => (
            <Marker
              key={`r${n.id}`}
              position={[n.lat, n.lng]}
              icon={reservoirIcon}
            >
              <Tooltip>
                {n.type === 'reservoir' ? 'Reservoir' : 'Tank'} · {n.id}
              </Tooltip>
            </Marker>
          ))}

        {/* Selected custom spot glowing ring */}
        {selected && byId[selected] && !judge && (
          <CircleMarker
            center={[byId[selected].lat, byId[selected].lng]}
            radius={14}
            pathOptions={{
              color: colors.water,
              fillColor: 'transparent',
              weight: 2,
              dashArray: '4 4',
              opacity: 0.95,
            }}
            interactive={false}
          />
        )}

        {/* Sentinel radar pulses */}
        {(network?.nodes || [])
          .filter((n) => sensors.has(n.id) || n.is_sensor)
          .map((n) => (
            <Marker
              key={`sentinel-pulse-${n.id}`}
              position={[n.lat, n.lng]}
              icon={sentinelRadarIcon}
              interactive={false}
            />
          ))}

        {/* Valve markers at pipe midpoints (pulsing barrier badges) */}
        {valveMarkers.map((vm) => {
          const pipeObj = (network?.pipes || []).find((p) => p.id === vm.pipeId);
          return (
            <Marker
              key={vm.id}
              position={vm.position}
              icon={valveBarrierIcon}
            >
              <Tooltip direction='top' offset={[0, -14]}>
                <div className='map-node-tooltip'>
                  <strong style={{ color: colors.valve }}>SHUT ISOLATION VALVE</strong>
                  <div>Pipe: <b>{vm.pipeId}</b> {pipeObj?.diameter_mm ? `(${pipeObj.diameter_mm}mm)` : ''}</div>
                  <div style={{ fontSize: '11px', color: colors.inkMuted, marginTop: '2px' }}>
                    Topological Cut-Set Boundary
                  </div>
                </div>
              </Tooltip>
            </Marker>
          );
        })}

        {/* Top candidate leak ring */}
        {result?.predicted_top_candidates?.[0] && byId[result.predicted_top_candidates[0].node_id] && (
          <Marker
            position={[byId[result.predicted_top_candidates[0].node_id].lat, byId[result.predicted_top_candidates[0].node_id].lng]}
            icon={leakRingIcon}
            interactive={false}
          />
        )}

        {/* Revealed injected node */}
        {judge && revealed && result?.injected_node_id && byId[result.injected_node_id] && (
          <CircleMarker
            center={[byId[result.injected_node_id].lat, byId[result.injected_node_id].lng]}
            radius={13}
            pathOptions={{
              color: colors.leak,
              fillOpacity: 0,
              weight: 2,
              dashArray: '5 4',
            }}
          >
            <Tooltip permanent direction='bottom' className='truth-chip'>Injected node</Tooltip>
          </CircleMarker>
        )}
        {/* Control stack */}
        <MapControlStack>
          <IconButton
            label={basemap && !tilesFailed ? 'Hide basemap' : 'Show basemap'}
            icon={Layers2}
            size='sm'
            pressed={basemap && !tilesFailed}
            onClick={() => {
              setBasemap(tilesFailed ? true : !basemap);
              setTilesFailed(false);
            }}
          />
          <IconButton
            label={showFlowArrows ? 'Hide flow arrows' : 'Show flow arrows'}
            icon={Navigation}
            size='sm'
            pressed={showFlowArrows}
            onClick={() => setShowFlowArrows((v) => !v)}
          />
          <IconButton
            label={showHeatmap ? 'Hide heatmap' : 'Show heatmap'}
            icon={Flame}
            size='sm'
            pressed={showHeatmap}
            onClick={() => setShowHeatmap((v) => !v)}
          />
          <IconButton
            label='Center map'
            icon={Crosshair}
            size='sm'
            onClick={() => {
              setSelected(null);
              setRecenterRevision((revision) => revision + 1);
            }}
          />
          <FullscreenControl />
        </MapControlStack>
      </MapContainer>


      {/* Legend */}
      <MapLegend items={legendItems} />

      {/* Mandatory Regulatory / Demonstration Disclaimer Watermark */}
      <div className='map-disclaimer-watermark'>
        SIMULATED NETWORK · DEMO GEOGRAPHIC PLACEMENT · NOT VERIFIED BWSSB GEOMETRY
      </div>

      {(!network?.nodes || network.nodes.length === 0) && (
        <SkeletonLoader variant='map-veil' />
      )}
    </section>
  );
}

export default memo(MapCanvas);
