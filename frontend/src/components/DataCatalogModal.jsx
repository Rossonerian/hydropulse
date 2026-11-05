import { useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { Button, DataTable, Drawer, Field, StatusDot } from '../ui/index.js';
import { DATA_CATALOG, KENGERI_AOI, filterCatalog } from '../lib/realWorldData.js';
import '../styles/studio/dialogs.css';

const CATEGORIES = [
  'All',
  'Water Supply',
  'Sewerage',
  'Groundwater',
  'Water Quality',
  'Rainfall',
  'Surface Water',
  'Urban Context',
  'Terrain',
];

const statusLabel = (status) => {
  const text = String(status || '').replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const statusTone = (status) => (status === 'measured' ? 'sensor' : 'valve');

export default function DataCatalogModal({
  open,
  onClose,
  activeLayerIds = [],
  onToggleLayer,
  onSelectDataset,
}) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [statusFilter] = useState('All');
  const [selectedItem, setSelectedItem] = useState(DATA_CATALOG[0]);

  const filtered = useMemo(
    () => filterCatalog(DATA_CATALOG, search, selectedCategory, statusFilter),
    [search, selectedCategory, statusFilter],
  );

  const handleSelect = (item) => {
    setSelectedItem(item);
    onSelectDataset?.(item);
  };

  const columns = [
    {
      key: 'displayName',
      label: 'Name',
      render: (value, row) => (
        <button
          type='button'
          className='stu-cat__rowbtn'
          aria-current={selectedItem?.id === row.id ? 'true' : undefined}
          onClick={(e) => {
            e.stopPropagation();
            handleSelect(row);
          }}
        >
          {value}
        </button>
      ),
    },
    { key: 'publisher', label: 'Source', render: (value) => <span>{value}</span> },
    {
      key: 'featureCount',
      label: 'Features',
      align: 'right',
      render: (value) => <span className='stu-mono'>{value}</span>,
    },
    {
      key: 'dataStatus',
      label: 'Status',
      render: (value) => (
        <span className='stu-cat__status'>
          <StatusDot tone={statusTone(value)} />
          {statusLabel(value)}
        </span>
      ),
    },
  ];

  const isActive = selectedItem ? activeLayerIds.includes(selectedItem.id) : false;

  return (
    <Drawer open={open} onClose={onClose} title='Data catalogue' width={480}>
      <div className='stu-cat'>
        <div className='stu-cat__note' role='note'>
          <AlertTriangle size={16} aria-hidden='true' />
          <div>
            <b>Provenance and audit caveat</b>
            <p>{KENGERI_AOI.auditCaveat}</p>
          </div>
        </div>

        <Field label='Search datasets' htmlFor='stu-cat-search'>
          <input
            id='stu-cat-search'
            type='search'
            className='stu-cat__input'
            placeholder='Search BWSSB, KSPCB, NWDP, Copernicus, roads, pipes…'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>

        <div className='stu-cat__chips' role='group' aria-label='Filter by category'>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type='button'
              className='stu-cat__chip'
              aria-pressed={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <p className='stu-cat__count' aria-live='polite'>
          {filtered.length} {filtered.length === 1 ? 'dataset' : 'datasets'}
        </p>

        {filtered.length === 0 ? (
          <p className='stu-cat__empty'>
            No datasets match your search. Try resetting filters or searching for BWSSB, sewer, or
            groundwater.
          </p>
        ) : (
          <div className='stu-cat__table'>
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey='id'
              onRowClick={handleSelect}
              caption='Datasets in the catalogue'
            />
          </div>
        )}

        {selectedItem && (
          <section className='stu-cat__detail' aria-label='Dataset details'>
            <div className='stu-cat__detail-head'>
              <div>
                <h3>{selectedItem.displayName}</h3>
                <p>
                  {selectedItem.category} · {selectedItem.publisher} · {selectedItem.catalogue}
                </p>
              </div>
              <Button
                variant={isActive ? 'secondary' : 'primary'}
                icon={isActive ? EyeOff : Eye}
                onClick={() => onToggleLayer?.(selectedItem.id)}
              >
                {isActive ? 'Remove layer' : 'Add to map'}
              </Button>
            </div>

            <dl className='stu-cat__facts'>
              <dt>Provenance</dt>
              <dd>{statusLabel(selectedItem.dataStatus)}</dd>
              <dt>Confidence</dt>
              <dd>{statusLabel(selectedItem.confidenceLevel)}</dd>
              <dt>Licence</dt>
              <dd>{selectedItem.licenseName}</dd>
              <dt>Format</dt>
              <dd>{selectedItem.format}</dd>
              <dt>CRS</dt>
              <dd>{selectedItem.targetCrs}</dd>
              <dt>Source updated</dt>
              <dd>{selectedItem.sourceUpdatedAt || 'Static reference'}</dd>
              <dt>Downloaded</dt>
              <dd>{selectedItem.downloadedAt?.split('T')[0] || '2026-11-05'}</dd>
              <dt>Features</dt>
              <dd>{selectedItem.featureCount} in study area</dd>
            </dl>

            <div>
              <h4 className='stu-cat__heading'>Caveats</h4>
              <ul className='stu-cat__caveats'>
                {selectedItem.limitations.map((lim, i) => (
                  <li key={i}>{lim}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className='stu-cat__heading'>Origin and attribution</h4>
              <p className='stu-cat__attr'>{selectedItem.attribution}</p>
              {selectedItem.sourceUrl && (
                <a
                  href={selectedItem.sourceUrl}
                  target='_blank'
                  rel='noreferrer'
                  className='stu-cat__link'
                >
                  View original catalogue record
                  <ExternalLink size={14} aria-hidden='true' />
                </a>
              )}
            </div>

            <div>
              <h4 className='stu-cat__heading'>SHA-256</h4>
              <code className='stu-cat__sha'>{selectedItem.sha256}</code>
            </div>
          </section>
        )}
      </div>
    </Drawer>
  );
}
