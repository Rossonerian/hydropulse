import { Checkbox, Panel, StagedBadge } from '../../ui/index.js';
import { DATA_CATALOG } from '../../lib/realWorldData.js';
import '../../styles/studio/shell.css';

const MAP_LAYERS = [
  { key: 'potable_water', label: 'Potable mains (BWSSB)' },
  { key: 'valves', label: 'Valves (sluice and air)' },
  { key: 'infrastructure', label: 'Pumping stations' },
  { key: 'groundwater', label: 'Public borewells' },
  { key: 'sewerage', label: 'Sewerage (non-potable)' },
  { key: 'surface_water', label: 'Hydrology and lakes' },
  { key: 'monitors', label: 'Telemetry and monitors' },
  { key: 'admin_boundary', label: 'Ward 159 boundary' },
  { key: 'terrain', label: 'Terrain surface' },
];

export default function LayersList({
  visibleLayers,
  toggleLayer,
  activeLayerIds,
  toggleCatalogLayer,
  stagedLayers,
  viewMode,
}) {
  const mapLayers = viewMode === 'terrain3d' ? MAP_LAYERS : MAP_LAYERS.filter((layer) => layer.key !== 'terrain');

  return (
    <Panel title='Layers' className='stu-layers'>
      <ul className='stu-layers-list' aria-label='Map layers'>
        {mapLayers.map((layer) => (
          <li key={layer.key}>
            <Checkbox
              label={layer.label}
              checked={visibleLayers[layer.key] ?? true}
              onChange={() => toggleLayer(layer.key)}
            />
          </li>
        ))}
      </ul>

      <h3 className='stu-layers-heading'>Catalog datasets</h3>
      <ul className='stu-layers-list' aria-label='Catalog datasets'>
        {DATA_CATALOG.map((dataset) => (
          <li key={dataset.id}>
            <Checkbox
              label={dataset.displayName}
              checked={activeLayerIds.includes(dataset.id)}
              onChange={() => toggleCatalogLayer(dataset.id)}
            />
          </li>
        ))}
      </ul>

      {stagedLayers.length > 0 && (
        <>
          <h3 className='stu-layers-heading'>Staged layers</h3>
          <ul className='stu-layers-list' aria-label='Staged layers'>
            {stagedLayers.map((layer) => (
              <li key={layer.id} className='stu-layers-staged'>
                <span className='stu-layers-staged-name'>{layer.displayName}</span>
                <span className='stu-layers-staged-meta'>{layer.featureCount} features</span>
                <StagedBadge />
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
