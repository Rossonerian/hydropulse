import { useEffect, useMemo, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { AlertTriangle } from 'lucide-react';
import { Switch } from '../ui/index.js';
import { useBasemapProxy } from '../ui/BasemapContext.js';
import { basemapProxyUrl } from '../api/client.js';
import { KENGERI_AOI, REAL_WORLD_FEATURES } from '../lib/realWorldData.js';
import '../styles/studio/mapviews.css';

// Data colours: fixed hues for features that have no semantic token.
// Mid-tone so they stay readable on both the dark and the light basemap.
const SEWER_COLOUR = '#A855F7'; // data colour
const STP_STROKE = '#C084FC'; // data colour
const STP_FILL = '#7E22CE'; // data colour
const PUMP_COLOUR = '#3B82F6'; // data colour
const RAIN_COLOUR = '#3B82F6'; // data colour

function getElevationColor(elev) {
  if (!Number.isFinite(elev)) return '#38bdf8';
  const norm = Math.max(0, Math.min(1, (elev - 760) / 80));
  if (norm < 0.33) return '#10b981';
  if (norm < 0.66) return '#38bdf8';
  return '#f59e0b';
}

function MapClickHandler({ tool, onMapClick }) {
  useMapEvents({
    click(e) {
      if (['junction', 'reservoir', 'tank'].includes(tool)) {
        onMapClick?.(e.latlng);
      }
    },
  });
  return null;
}

const readTheme = () =>
  (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || 'night';

// Re-render when the app theme flips so map colours track the tokens.
function useThemeName() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

function readPalette() {
  const style = getComputedStyle(document.documentElement);
  const pick = (name) => style.getPropertyValue(name).trim();
  return {
    water: pick('--water'),
    sensor: pick('--sensor'),
    valve: pick('--valve'),
    ink: pick('--ink'),
    inkFaint: pick('--ink-faint'),
    surface: pick('--surface'),
  };
}

// Custom Map Bounds Fitter
function MapBoundsManager({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom);
  }, [map, center, zoom]);
  return null;
}

export default function GeographicMapCanvas({
  selectedFeature,
  onSelectFeature,
  visibleLayers = {},
  stagedLayers = [],
  draft,
  tool = 'select',
  addNode,
  addPipe,
  setSelection,
  updateField,
  pendingConnection,
  setPendingConnection,
}) {
  const [basemapOn, setBasemapOn] = useState(true);
  const [tileError, setTileError] = useState(false);
  const theme = useThemeName();
  const P = useMemo(readPalette, [theme]);
  const tileStyle = theme === 'day' ? 'light_all' : 'dark_all';
  const proxy = useBasemapProxy();
  const tileUrl = proxy
    ? basemapProxyUrl(theme === 'day' ? 'light' : 'dark')
    : `https://{s}.basemaps.cartocdn.com/${tileStyle}/{z}/{x}/{y}{r}.png`;

  // Probe one tile at mount: CARTO answers with an 'API KEY REQUIRED' watermark (or the proxy
  // with an error status) when it is not usable. Anything but HTTP 200 counts as failed.
  useEffect(() => {
    const controller = new AbortController();
    const probeUrl = tileUrl
      .replace('{s}', 'a')
      .replace('{z}', '10')
      .replace('{x}', '727')
      .replace('{y}', '488')
      .replace('{r}', '');
    fetch(probeUrl, { signal: controller.signal, cache: 'force-cache' })
      .then((res) => {
        if (res.status !== 200) setTileError(true);
      })
      .catch((err) => {
        // A direct CARTO fetch can fail on CORS alone; only the proxy is same-origin.
        if (err?.name !== 'AbortError' && proxy) setTileError(true);
      });
    return () => controller.abort();
  }, [tileUrl, proxy]);

  const nodeMap = useMemo(() => {
    const map = new Map();
    (draft?.network?.nodes || []).forEach((n) => {
      if (Number.isFinite(n.lat) && Number.isFinite(n.lng)) {
        map.set(n.id, n);
      }
    });
    return map;
  }, [draft?.network?.nodes]);

  const selectedPipe = useMemo(() => {
    if (!draft?.network?.pipes) return null;
    const id = selectedFeature?.id || selectedFeature?.properties?.id;
    return draft.network.pipes.find((p) => p.id === id);
  }, [draft?.network?.pipes, selectedFeature]);

  const { srcNode, tgtNode, slopePct, headLossM, elevDiff } = useMemo(() => {
    if (!selectedPipe) return {};
    const src = nodeMap.get(selectedPipe.source);
    const tgt = nodeMap.get(selectedPipe.target);
    const e1 = src?.elevation_m ?? 800;
    const e2 = tgt?.elevation_m ?? 800;
    const diff = Math.round((e2 - e1) * 10) / 10;
    const len = selectedPipe.length_m || 100;
    const slope = Math.round((diff / Math.max(len, 1)) * 1000) / 10;
    const diam = selectedPipe.diameter_mm || 150;
    const hl = Math.round((10.67 * len * Math.pow(0.015, 1.852) / (Math.pow(130, 1.852) * Math.pow(diam / 1000, 4.87))) * 10) / 10;
    return { srcNode: src, tgtNode: tgt, slopePct: slope, headLossM: hl, elevDiff: diff };
  }, [selectedPipe, nodeMap]);

  const handleMapClick = (latlng) => {
    if (['junction', 'reservoir', 'tank'].includes(tool)) {
      const elev = Math.round(790 + (latlng.lat - 12.9) * 200 + (latlng.lng - 77.4) * 150);
      addNode?.(tool, { x: 500, y: 500 }, { lat: latlng.lat, lng: latlng.lng, elevation_m: elev });
    }
  };

  return (
    <div className='stu-geo'>
      <MapContainer
        center={[KENGERI_AOI.center.lat, KENGERI_AOI.center.lng]}
        zoom={KENGERI_AOI.zoom}
        className='stu-geo__map'
        zoomControl={false}
        preferCanvas={true}
        attributionControl={false}
      >
        <MapBoundsManager center={KENGERI_AOI.center} zoom={KENGERI_AOI.zoom} />
        <MapClickHandler tool={tool} onMapClick={handleMapClick} />

        {/* 0. Potable Distribution Network Pipes (from Studio Draft) */}
        {(visibleLayers.potable_water ?? true) &&
          (draft?.network?.pipes || []).map((pipe) => {
            const src = nodeMap.get(pipe.source);
            const tgt = nodeMap.get(pipe.target);
            if (!src || !tgt) return null;
            const isSelected = selectedFeature?.id === pipe.id;
            const isClosed = pipe.status === 'CLOSED';
            const diam = pipe.diameter_mm || 150;
            const weight = Math.max(3, Math.min(8, diam / 40));
            return (
              <Polyline
                key={pipe.id}
                positions={[
                  [src.lat, src.lng],
                  [tgt.lat, tgt.lng],
                ]}
                pathOptions={{
                  color: isSelected ? '#a855f7' : isClosed ? '#64748b' : P.water,
                  weight: isSelected ? weight + 3 : weight,
                  dashArray: isClosed ? '6 6' : undefined,
                  opacity: 0.9,
                }}
                eventHandlers={{
                  click: (e) => {
                    e.originalEvent?.stopPropagation();
                    setSelection?.({ type: 'pipe', id: pipe.id });
                    onSelectFeature?.({
                      id: pipe.id,
                      name: `Pipeline ${pipe.id}`,
                      category: 'potable_water',
                      properties: {
                        source: pipe.source,
                        target: pipe.target,
                        diameter_mm: diam,
                        length_m: pipe.length_m || '—',
                        status: pipe.status,
                      },
                    });
                  },
                }}
              >
                <Tooltip sticky>
                  <b>{pipe.id}</b> · Ø{diam} mm · {pipe.length_m ? `${pipe.length_m}m` : 'calc'} ({pipe.source} → {pipe.target})
                </Tooltip>
              </Polyline>
            );
          })}

        {/* 0. Potable Distribution Nodes (Junctions, Reservoirs, Tanks) */}
        {(visibleLayers.potable_water ?? true) &&
          (draft?.network?.nodes || []).map((node) => {
            if (!Number.isFinite(node.lat) || !Number.isFinite(node.lng)) return null;
            const isSelected = selectedFeature?.id === node.id;
            const isPending = pendingConnection === node.id;
            const elev = node.elevation_m;
            const color = getElevationColor(elev);
            const isRes = node.type === 'reservoir';
            const isTank = node.type === 'tank';
            const isSensor = node.is_sensor;
            const radius = isSelected ? 9.5 : isRes || isTank ? 8.5 : isSensor ? 7.5 : 6;

            return (
              <CircleMarker
                key={node.id}
                center={[node.lat, node.lng]}
                radius={radius}
                pathOptions={{
                  color: isPending ? '#ec4899' : isSelected ? '#a855f7' : isSensor ? '#22c55e' : color,
                  fillColor: isPending ? '#f43f5e' : isSelected ? '#c084fc' : isSensor ? '#4ade80' : color,
                  fillOpacity: 0.92,
                  weight: isSelected || isPending ? 3.5 : 1.5,
                }}
                eventHandlers={{
                  click: (e) => {
                    e.originalEvent?.stopPropagation();
                    if (tool === 'pipe') {
                      if (!pendingConnection) {
                        setPendingConnection?.(node.id);
                      } else if (pendingConnection !== node.id) {
                        addPipe?.(pendingConnection, node.id);
                      } else {
                        setPendingConnection?.(null);
                      }
                    } else {
                      setSelection?.({ type: 'node', id: node.id });
                      onSelectFeature?.({
                        id: node.id,
                        name: `${node.type.toUpperCase()} ${node.id}`,
                        category: 'potable_water',
                        properties: {
                          elevation_m: elev,
                          households: node.households,
                          type: node.type,
                          is_sensor: node.is_sensor,
                        },
                      });
                    }
                  },
                }}
              >
                <Tooltip sticky>
                  <b>{node.id}</b> ({node.type})
                  {elev ? ` · Elev: ${Math.round(elev)}m` : ''}
                  {node.households ? ` · ${node.households} homes` : ''}
                  {tool === 'pipe' ? (isPending ? ' (Connecting pipe from here...)' : ' · Click to connect') : ''}
                </Tooltip>
              </CircleMarker>
            );
          })}

        {/* Basemap Tiles with Offline Grid Fallback */}
        {basemapOn && !tileError && (
          <TileLayer
            key={tileStyle}
            url={tileUrl}
            subdomains='abcd'
            maxZoom={19}
            eventHandlers={{
              tileerror: () => setTileError(true),
            }}
          />
        )}

        {/* 1. Administrative Boundary (Ward 159) */}
        {(visibleLayers.admin_boundary ?? true) &&
          REAL_WORLD_FEATURES.boundaries.map((b) => (
            <Polygon
              key={b.id}
              positions={b.coordinates}
              pathOptions={{
                color: P.inkFaint,
                weight: 2,
                dashArray: '6 6',
                fillColor: P.water,
                fillOpacity: 0.04,
              }}
              eventHandlers={{
                click: () => onSelectFeature(b),
              }}
            >
              <Tooltip sticky>{b.name}</Tooltip>
            </Polygon>
          ))}

        {/* 2. Water Bodies (Kengeri Lake & Vrishabhavathi Channel) */}
        {(visibleLayers.surface_water ?? true) &&
          REAL_WORLD_FEATURES.waterBodies.map((wb) => {
            if (wb.type === 'polygon') {
              return (
                <Polygon
                  key={wb.id}
                  positions={wb.coordinates}
                  pathOptions={{
                    color: P.water,
                    weight: 2,
                    fillColor: P.water,
                    fillOpacity: 0.35,
                  }}
                  eventHandlers={{ click: () => onSelectFeature(wb) }}
                >
                  <Tooltip sticky>{wb.name} (rejuvenated 2021)</Tooltip>
                </Polygon>
              );
            }
            return (
              <Polyline
                key={wb.id}
                positions={wb.coordinates}
                pathOptions={{
                  color: P.water,
                  weight: 5,
                  opacity: 0.8,
                }}
                eventHandlers={{ click: () => onSelectFeature(wb) }}
              >
                <Tooltip sticky>{wb.name}</Tooltip>
              </Polyline>
            );
          })}

        {/* 3. Sewerage Lines (Violet, Strictly Non-Potable) */}
        {(visibleLayers.sewerage ?? true) &&
          REAL_WORLD_FEATURES.sewerPipes.map((pipe) => {
            const isSelected = selectedFeature?.id === pipe.id;
            return (
              <Polyline
                key={pipe.id}
                positions={pipe.coordinates}
                pathOptions={{
                  color: isSelected ? P.ink : SEWER_COLOUR,
                  weight: isSelected ? 5.5 : 3.5,
                  dashArray: '7 6',
                  opacity: 0.9,
                }}
                eventHandlers={{ click: () => onSelectFeature(pipe) }}
              >
                <Tooltip sticky>
                  {pipe.name} · Ø{pipe.properties.diameter_mm} mm (sewer, non-potable)
                </Tooltip>
              </Polyline>
            );
          })}

        {/* 4. Sewage Treatment Plant (Doddabele STP) */}
        {(visibleLayers.sewerage ?? true) &&
          REAL_WORLD_FEATURES.treatmentPlants.map((stp) => (
            <CircleMarker
              key={stp.id}
              center={stp.coordinates}
              radius={9}
              pathOptions={{
              color: STP_STROKE,
              fillColor: STP_FILL,
              fillOpacity: 0.9,
                weight: 2.5,
              }}
              eventHandlers={{ click: () => onSelectFeature(stp) }}
            >
              <Tooltip sticky>
                <b>{stp.name}</b>
                <br />
                Capacity: {stp.properties.installed_capacity_mld} MLD
              </Tooltip>
            </CircleMarker>
          ))}

        {/* 5. Potable Water Pipelines (BWSSB Mains, Cyan) */}
        {(visibleLayers.potable_water ?? true) &&
          REAL_WORLD_FEATURES.potablePipes.map((pipe) => {
            const isSelected = selectedFeature?.id === pipe.id;
            const dia = pipe.properties.diameter_mm;
            const weight = isSelected ? 6 : dia >= 450 ? 5 : dia >= 300 ? 3.5 : 2.5;
            return (
              <Polyline
                key={pipe.id}
                positions={pipe.coordinates}
                pathOptions={{
                  color: isSelected ? P.ink : P.water,
                  weight,
                  opacity: 0.92,
                }}
                eventHandlers={{ click: () => onSelectFeature(pipe) }}
              >
                <Tooltip sticky>
                  <b>{pipe.name}</b>
                  <br />
                  Ø{dia} mm · {pipe.properties.material}
                  <br />
                  Status: {pipe.properties.operational_status}
                </Tooltip>
              </Polyline>
            );
          })}

        {/* 6. Valves (Amber Points) */}
        {(visibleLayers.valves ?? true) &&
          REAL_WORLD_FEATURES.valves.map((v) => (
            <CircleMarker
              key={v.id}
              center={v.coordinates}
              radius={5.5}
              pathOptions={{
                color: P.surface,
                fillColor: P.valve,
                fillOpacity: 1.0,
                weight: 1.5,
              }}
              eventHandlers={{ click: () => onSelectFeature(v) }}
            >
              <Tooltip sticky>
                <b>{v.name}</b>
                <br />
                Type: {v.properties.valve_type} (Ø{v.properties.nominal_diameter_mm} mm)
              </Tooltip>
            </CircleMarker>
          ))}

        {/* 7. Pumping Stations (Blue Squares) */}
        {(visibleLayers.infrastructure ?? true) &&
          REAL_WORLD_FEATURES.pumpingStations.map((ps) => (
            <CircleMarker
              key={ps.id}
              center={ps.coordinates}
              radius={7.5}
              pathOptions={{
                color: P.surface,
                fillColor: PUMP_COLOUR,
                fillOpacity: 1.0,
                weight: 2,
              }}
              eventHandlers={{ click: () => onSelectFeature(ps) }}
            >
              <Tooltip sticky>
                <b>{ps.name}</b>
                <br />
                Capacity: {ps.properties.installed_capacity_mld} MLD · Head: {ps.properties.rated_head_m} m
              </Tooltip>
            </CircleMarker>
          ))}

        {/* 8. Borewells (Teal Circles) */}
        {(visibleLayers.groundwater ?? true) &&
          REAL_WORLD_FEATURES.borewells.map((bw) => (
            <CircleMarker
              key={bw.id}
              center={bw.coordinates}
              radius={5}
              pathOptions={{
                color: P.surface,
                fillColor: P.sensor,
                fillOpacity: 0.95,
                weight: 1.5,
              }}
              eventHandlers={{ click: () => onSelectFeature(bw) }}
            >
              <Tooltip sticky>
                <b>{bw.name}</b>
                <br />
                Water table: {bw.properties.water_level_mbgl} m bgl · Yield: {bw.properties.yield_lpm} LPM
              </Tooltip>
            </CircleMarker>
          ))}

        {/* 9. Environmental Observation Stations */}
        {(visibleLayers.monitors ?? true) && (
          <>
            {/* Groundwater Monitor */}
            {REAL_WORLD_FEATURES.groundwaterStations.map((st) => (
              <CircleMarker
                key={st.id}
                center={st.coordinates}
                radius={8}
                pathOptions={{
                  color: P.water,
                  fillColor: P.water,
                  fillOpacity: 0.6,
                  weight: 2,
                }}
                eventHandlers={{ click: () => onSelectFeature(st) }}
              >
                <Tooltip sticky>
                  <b>{st.name}</b>
                  <br />
                  6-hourly telemetry: {st.properties.latest_water_level_mbgl} m bgl
                </Tooltip>
              </CircleMarker>
            ))}

            {/* Lake Water Quality Monitor */}
            {REAL_WORLD_FEATURES.waterQualityStations.map((st) => (
              <CircleMarker
                key={st.id}
                center={st.coordinates}
                radius={8}
                pathOptions={{
                  color: P.sensor,
                  fillColor: P.sensor,
                  fillOpacity: 0.6,
                  weight: 2,
                }}
                eventHandlers={{ click: () => onSelectFeature(st) }}
              >
                <Tooltip sticky>
                  <b>{st.name}</b>
                  <br />
                  DO: {st.properties.dissolved_oxygen_mg_l} mg/L · BOD: {st.properties.biochemical_oxygen_demand_mg_l} mg/L
                </Tooltip>
              </CircleMarker>
            ))}

            {/* Rain Gauge */}
            {REAL_WORLD_FEATURES.rainGauges.map((st) => (
              <CircleMarker
                key={st.id}
                center={st.coordinates}
                radius={8}
                pathOptions={{
                  color: RAIN_COLOUR,
                  fillColor: RAIN_COLOUR,
                  fillOpacity: 0.6,
                  weight: 2,
                }}
                eventHandlers={{ click: () => onSelectFeature(st) }}
              >
                <Tooltip sticky>
                  <b>{st.name}</b>
                  <br />
                  Annual rainfall: {st.properties.annual_rainfall_2025_mm} mm
                </Tooltip>
              </CircleMarker>
            ))}
          </>
        )}
      </MapContainer>

      {selectedPipe && (
        <div className="geo-cross-section-hud">
          <div className="geo-cross-section-title">
            <span>Pipeline Profile: {selectedPipe.id}</span>
            <span className="geo-pipe-diam">Ø {selectedPipe.diameter_mm || 150} mm</span>
          </div>
          <div className="geo-profile-graph">
            <div className="geo-profile-point">
              <span className="geo-point-id">{srcNode?.id || selectedPipe.source}</span>
              <span className="geo-point-elev">{Math.round(srcNode?.elevation_m || 800)} m</span>
            </div>
            <div className="geo-profile-line">
              <span className="geo-profile-slope">{slopePct > 0 ? `+${slopePct}%` : `${slopePct}%`} grade</span>
              <div className="geo-profile-vector" />
              <span className="geo-profile-dist">{selectedPipe.length_m || 100} m</span>
            </div>
            <div className="geo-profile-point">
              <span className="geo-point-id">{tgtNode?.id || selectedPipe.target}</span>
              <span className="geo-point-elev">{Math.round(tgtNode?.elevation_m || 800)} m</span>
            </div>
          </div>
          <div className="geo-profile-meta">
            <span>Head loss: ~{headLossM} m</span>
            <span>Flow: {elevDiff < 0 ? 'Gravity Assisted ↓' : 'Pressure Head Req ↑'}</span>
          </div>
        </div>
      )}

      <div className="geo-terrain-legend">
        <span className="geo-legend-title">Terrain Elevation</span>
        <div className="geo-legend-bar" />
        <div className="geo-legend-labels">
          <span>760m (Low)</span>
          <span>800m</span>
          <span>840m (High)</span>
        </div>
      </div>

      {tileError && (
        <p className='stu-geo__unavailable' role='status'>Basemap unavailable</p>
      )}

      <div className='stu-geo__controls'>
        <Switch
          className='stu-geo__basemap'
          label='Basemap tiles'
          checked={basemapOn && !tileError}
          onChange={(on) => {
            if (on) setTileError(false);
            setBasemapOn(on);
          }}
        />
      </div>

      <p className='stu-geo__caveat'>
        <AlertTriangle size={14} aria-hidden='true' />
        <span>Source-mapped GIS · positional accuracy caveat per CAG 2022 audit</span>
      </p>
    </div>
  );
}
