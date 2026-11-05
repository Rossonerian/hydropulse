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
import { Layers2, Crosshair, Maximize2, Minimize2 } from 'lucide-react';
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

  // Valve marker icon (amber square)
  const valveIcon = useMemo(() => L.divIcon({
    className: 'valve-marker',
    html: '<span aria-hidden="true"></span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  }), []);

  // Leak ring icon (static, no radar animation)
  const leakRingIcon = useMemo(() => L.divIcon({
    className: 'leak-ring-marker',
    html: '<span aria-hidden="true"></span>',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  }), []);

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
                weight: isSelected ? width + 2 : width,
                opacity: isolatedPipe ? 0.4 : active ? 0.9 : 0.7,
                dashArray: isolatedPipe ? '6 6' : active ? '8 8' : null,
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

        {/* Heat circles */}
        {Object.entries(heat).map(([id, value]) => {
          const n = byId[id];
          if (!n || value < 0.05) return null;
          const heatColor =
            value >= 1.0 ? colors.heat4 :
            value >= 0.75 ? colors.heat3 :
            value >= 0.5 ? colors.heat2 :
            value >= 0.25 ? colors.heat1 : colors.heat0;
          const sizeBoost = value >= 0.25 ? 4 : 0;
          return (
            <CircleMarker
              key={`h${id}`}
              center={[n.lat, n.lng]}
              radius={4 + value * 10 + sizeBoost}
              pathOptions={{
                color: heatColor,
                fillColor: heatColor,
                fillOpacity: 0.1 + value * 0.3,
                weight: 1,
                opacity: 0.5,
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
              : colors.inkFaint;

          const radius = isTopCandidate ? 9 : picked ? 6 : 4;
          const weight = truth || picked || isTopCandidate ? 2.5 : 1;
          const opacity = isIsolated ? 0.4 : 1;

          return (
            <CircleMarker
              key={n.id}
              center={[n.lat, n.lng]}
              radius={radius}
              pathOptions={{
                color: truth ? colors.surface : picked ? colors.surface : fill,
                fillColor: hiddenTarget ? colors.surface : fill,
                fillOpacity: hiddenTarget ? 0.3 : isIsolated ? 0.3 : 0.85,
                weight,
                opacity,
                dashArray: isIsolated ? '4 3' : null,
              }}
              eventHandlers={{
                click: () => {
                  setSelected(n.id);
                  onPick?.(n);
                },
              }}
            >
              {(picked || truth || (result && topRank >= 0 && topRank < 5)) && (
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
                    setSelected(n.id);
                    onPick?.(n);
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

        {/* Valve markers at pipe midpoints */}
        {valveMarkers.map((vm) => (
          <Marker
            key={vm.id}
            position={vm.position}
            icon={valveIcon}
          >
            <Tooltip>
              Valve · {vm.pipeId}
            </Tooltip>
          </Marker>
        ))}

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
