import { Checkbox, StagedBadge } from '../../ui/index.js';
import { DATA_CATALOG } from '../../lib/realWorldData.js';
import '../../styles/studio/shell.css';

const MAP_LAYERS = [
  { key: 'potable_water', label: 'Potable mains (BWSSB)', group: 'water' },
  { key: 'valves', label: 'Valves (sluice and air)', group: 'water' },
  { key: 'infrastructure', label: 'Pumping stations', group: 'water' },
  { key: 'groundwater', label: 'Public borewells', group: 'water' },
  { key: 'terrain', label: 'Terrain surface', group: 'water' },
  { key: 'sewerage', label: 'Sewerage (non-potable)', group: 'sewer' },
  { key: 'surface_water', label: 'Hydrology and lakes', group: 'sewer' },
  { key: 'monitors', label: 'Telemetry and monitors', group: 'monitoring' },
  { key: 'admin_boundary', label: 'Ward 159 boundary', group: 'boundaries' },
];

const GROUPS = [
  { id: 'water', title: 'Water network' },
  { id: 'sewer', title: 'Sewer and rain' },
  { id: 'monitoring', title: 'Monitoring' },
  { id: 'boundaries', title: 'Boundaries' },
];

const datasetGroup = (dataset) => {
  if (dataset.category === 'Water Supply') return 'water';
  if (dataset.category === 'Groundwater') return dataset.id.includes('telemetry') ? 'monitoring' : 'water';
  if (dataset.category === 'Water Quality') return 'monitoring';
  if (['Sewerage', 'Surface Water', 'Rainfall'].includes(dataset.category)) return 'sewer';
  return 'boundaries';
};

/** Layers panel: collapsed by default, four plain groups. */
export default function LayersList({
  visibleLayers,
  toggleLayer,
  activeLayerIds,
  toggleCatalogLayer,
  stagedLayers,
  viewMode,
}) {
  const mapLayers = viewMode === 'terrain3d' ? MAP_LAYERS : MAP_LAYERS.filter((layer) => layer.key !== 'terrain');
  const onCount = mapLayers.filter((layer) => visibleLayers[layer.key] ?? true).length;

  return (
    <details className='stu-layers panel'>
      <summary className='stu-layers-summary'>
        <span className='panel__title'>Layers</span>
        <span className='stu-layers-count'>{onCount} of {mapLayers.length} on</span>
      </summary>
      <div className='stu-layers-body'>
        {GROUPS.map((group) => {
          const layers = mapLayers.filter((layer) => layer.group === group.id);
          const datasets = DATA_CATALOG.filter((dataset) => datasetGroup(dataset) === group.id);
          if (!layers.length && !datasets.length) return null;
          return (
            <section key={group.id} aria-label={group.title}>
              <h3 className='stu-layers-heading'>{group.title}</h3>
              <ul className='stu-layers-list'>
                {layers.map((layer) => (
                  <li key={layer.key}>
                    <Checkbox
                      label={layer.label}
                      checked={visibleLayers[layer.key] ?? true}
                      onChange={() => toggleLayer(layer.key)}
                    />
                  </li>
                ))}
                {datasets.map((dataset) => (
                  <li key={dataset.id}>
                    <Checkbox
                      label={dataset.displayName}
                      checked={activeLayerIds.includes(dataset.id)}
                      onChange={() => toggleCatalogLayer(dataset.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {stagedLayers.length > 0 && (
          <section aria-label='Imported layers'>
            <h3 className='stu-layers-heading'>Imported layers</h3>
            <ul className='stu-layers-list'>
              {stagedLayers.map((layer) => (
                <li key={layer.id} className='stu-layers-staged'>
                  <span className='stu-layers-staged-name'>{layer.displayName}</span>
                  <span className='stu-layers-staged-meta'>{layer.featureCount} features</span>
                  <StagedBadge />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </details>
  );
}
