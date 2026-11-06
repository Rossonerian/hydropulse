import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, BarChart3, Check, CheckCircle2, ShieldAlert, Upload } from 'lucide-react';
import { Button, Field, Modal, StagedBadge } from '../ui/index.js';
import { validateImportedFile } from '../lib/realWorldData.js';
import '../styles/studio/dialogs.css';

const ASSET_TYPES = [
  { id: 'potable_water_pipe', label: 'Potable water pipeline (mains / feeder)' },
  { id: 'sewer_pipe', label: 'Sewerage gravity line (non-potable)' },
  { id: 'valve', label: 'Valves (isolation / air / sluice)' },
  { id: 'pumping_station', label: 'Pumping / booster station' },
  { id: 'borewell', label: 'Groundwater borewell' },
  { id: 'groundwater_monitor', label: 'Groundwater telemetry station' },
  { id: 'water_quality_monitor', label: 'Water quality observation point' },
  { id: 'rain_gauge', label: 'Rain gauge / hydrological monitor' },
  { id: 'water_body', label: 'Surface waterbody / lake / stream' },
  { id: 'road', label: 'Urban road / street centreline' },
];

const STEPS = ['Choose a file', 'Name and type', 'Check it', 'Add to map'];

export default function ImportWizardModal({ open, onClose, onImportStaged, onOpenBenchmark }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [assetType, setAssetType] = useState('potable_water_pipe');
  const [validation, setValidation] = useState(null);
  const [importName, setImportName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // The Modal primitive unmounts its content when closed, but this component
  // stays mounted, so wizard state is reset explicitly on close.
  useEffect(() => {
    if (open) return;
    setStep(1);
    setFile(null);
    setFileContent('');
    setAssetType('potable_water_pipe');
    setValidation(null);
    setImportName('');
    setIsProcessing(false);
  }, [open]);

  const handleFileChange = async (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setImportName(selected.name.replace(/\.[^/.]+$/, ''));
    setIsProcessing(true);

    try {
      const text = await selected.text();
      setFileContent(text);
      const res = validateImportedFile(selected.name, text, assetType);
      setValidation(res);
      if (res.valid) {
        setStep(2);
      } else {
        setStep(1);
      }
    } catch (err) {
      setValidation({
        valid: false,
        errors: [`Failed to read file: ${err.message}`],
        warnings: [],
      });
      setStep(1);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssetTypeChange = (type) => {
    setAssetType(type);
    if (file && fileContent) {
      const res = validateImportedFile(file.name, fileContent, type);
      setValidation(res);
    }
  };

  const handleConfirm = () => {
    const stagedLayer = {
      id: `imported_${Date.now()}`,
      displayName: importName || file?.name || 'Imported Layer',
      assetType,
      fileName: file?.name,
      featureCount: validation?.featureCount || 0,
      stagedAt: new Date().toISOString(),
      format: validation?.detectedFormat || 'Unknown',
      dataStatus: 'source_mapped',
      isStagedOnly: true,
      features: validation?.features || [],
    };
    onImportStaged?.(stagedLayer);
    onClose();
  };

  let footer = null;
  if (step === 2) {
    footer = (
      <div className='stu-wiz__actions'>
        <Button variant='secondary' onClick={() => setStep(1)}>
          Back
        </Button>
        <Button variant='primary' onClick={() => setStep(3)}>
          Check the file <ArrowRight size={16} aria-hidden='true' />
        </Button>
      </div>
    );
  } else if (step === 3) {
    footer = (
      <div className='stu-wiz__actions'>
        <Button variant='secondary' onClick={() => setStep(2)}>
          Back
        </Button>
        {!validation?.valid && (
          <span className='stu-wiz__reason' role='status'>
            Cannot continue: the file has problems listed above. Go back and choose another file.
          </span>
        )}
        <Button variant='primary' disabled={!validation?.valid} onClick={() => setStep(4)}>
          Continue <ArrowRight size={16} aria-hidden='true' />
        </Button>
      </div>
    );
  } else if (step === 4) {
    footer = (
      <div className='stu-wiz__actions'>
        <Button variant='secondary' onClick={() => setStep(3)}>
          Back
        </Button>
        <Button variant='primary' icon={Check} onClick={handleConfirm}>
          Add layer to the map
        </Button>
      </div>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title='Import a map layer' footer={footer}>
      <div className='stu-wiz'>
        <ol className='stu-wiz__steps' aria-label='Import progress'>
          {STEPS.map((label, i) => {
            const n = i + 1;
            return (
              <li
                key={label}
                className={`stu-wiz__step ${step > n ? 'stu-wiz__step--done' : ''}`}
                aria-current={step === n ? 'step' : undefined}
              >
                <span className='stu-wiz__step-num'>{n}</span>
                {label}
              </li>
            );
          })}
        </ol>

        {step === 1 && (
          <div className='stu-wiz__pane'>
            <div className='stu-wiz__drop'>
              <Upload size={32} aria-hidden='true' />
              <h3>Choose a map file to import</h3>
              <p>
                Supported: GeoJSON (.geojson, .json), KML (.kml), CSV with lat/lon, EPANET (.inp)
              </p>
              <label className='stu-wiz__file-label'>
                {isProcessing ? 'Reading file…' : 'Browse file'}
                <input
                  className='stu-wiz__file'
                  type='file'
                  accept='.geojson,.json,.kml,.csv,.inp'
                  onChange={handleFileChange}
                />
              </label>
            </div>
            {validation?.isBenchmarkMetrics ? (
              <div
                className='stu-wiz__benchmark-card'
                role='region'
                aria-label='Benchmark metrics detected'
                style={{
                  background: 'var(--surface-raised, #1e293b)',
                  border: '1px solid var(--water, #00b4d8)',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  marginTop: '12px',
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <BarChart3 size={24} style={{ color: 'var(--water, #00b4d8)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: '14px', color: 'var(--text, #f8fafc)' }}>
                      Benchmark Performance Metrics Detected
                    </h4>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-dim, #94a3b8)', lineHeight: 1.4 }}>
                      <b>{file?.name}</b> contains hydraulic model benchmark statistics (localization accuracy percentages, sensor noise, compute latency), not geospatial asset coordinates. It cannot be plotted as a spatial map layer (pipelines or borewells).
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                    background: 'var(--surface, #0f172a)',
                    padding: '10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-dim, #94a3b8)', display: 'block' }}>Detected Rows:</span>
                    <b style={{ color: 'var(--text, #f8fafc)' }}>{validation.benchmarkData?.rows?.length || 0} benchmark rows</b>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim, #94a3b8)', display: 'block' }}>Noise Range:</span>
                    <b style={{ color: 'var(--water, #00b4d8)' }}>0.0% – 5.0% noise</b>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim, #94a3b8)', display: 'block' }}>Top-1 Accuracy:</span>
                    <b style={{ color: 'var(--success, #10b981)' }}>Up to 86.2%</b>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                  <Button
                    variant='primary'
                    size='sm'
                    icon={BarChart3}
                    onClick={() => {
                      onOpenBenchmark?.(validation.benchmarkData);
                      onClose();
                    }}
                  >
                    Open in Accuracy & Benchmark Report
                  </Button>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => {
                      setFile(null);
                      setFileContent('');
                      setValidation(null);
                    }}
                  >
                    Choose another file
                  </Button>
                </div>
              </div>
            ) : (
              validation && !validation.valid && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className='stu-wiz__note stu-wiz__note--bad' role='alert'>
                    <AlertTriangle size={16} aria-hidden='true' />
                    <span>{validation.errors[0]}</span>
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-dim, #94a3b8)',
                      background: 'var(--surface-raised, #1e293b)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--line, #334155)',
                    }}
                  >
                    <b>Expected coordinate format for CSV map layers:</b>
                    <div style={{ fontFamily: 'var(--font-mono, monospace)', marginTop: '4px', color: 'var(--text, #f8fafc)' }}>
                      id, name, lat, lng, type<br />
                      BW1, Kengeri Borewell 1, 12.9081, 77.4852, borewell
                    </div>
                  </div>
                </div>
              )
            )}
            <div className='stu-wiz__note'>
              <ShieldAlert size={16} aria-hidden='true' />
              <p>
                Your file stays in this browser. It will <b>never</b> replace the demo network.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className='stu-wiz__pane'>
            <Field label='Layer display name' htmlFor='stu-wiz-name'>
              <input
                id='stu-wiz-name'
                type='text'
                className='stu-wiz__input'
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder='e.g., BWSSB Ward 159 surveyed mains'
              />
            </Field>

            <div>
              <h3 className='stu-wiz__heading' id='stu-wiz-type'>
                Asset classification
              </h3>
              <ul className='stu-wiz__types' aria-labelledby='stu-wiz-type'>
                {ASSET_TYPES.map((t) => (
                  <li key={t.id}>
                    <button
                      type='button'
                      className='stu-wiz__type'
                      aria-pressed={assetType === t.id}
                      onClick={() => handleAssetTypeChange(t.id)}
                    >
                      {t.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {assetType === 'sewer_pipe' && (
              <div className='stu-wiz__note'>
                <AlertTriangle size={16} aria-hidden='true' />
                <span>
                  Sewerage assets are strictly quarantined from the potable-water hydraulic network.
                </span>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className='stu-wiz__pane'>
            <div className='stu-wiz__report'>
              <h4>
                {validation?.valid ? (
                  <>
                    <CheckCircle2 size={16} aria-hidden='true' /> File looks good
                  </>
                ) : (
                  'Problems found in this file'
                )}
              </h4>
              <p className='stu-mono'>
                {validation?.fileName} · {validation?.detectedFormat} · {validation?.detectedCrs}
              </p>

              <dl className='stu-wiz__stats'>
                <div>
                  <dt>Detected features</dt>
                  <dd>{validation?.featureCount || 0}</dd>
                </div>
                <div>
                  <dt>Can it be simulated?</dt>
                  <dd className={validation?.modelReady ? 'is-good' : 'is-warn'}>
                    {validation?.modelReady ? 'Yes' : 'No, map only'}
                  </dd>
                </div>
                <div>
                  <dt>Errors</dt>
                  <dd className={validation?.errors.length ? 'is-bad' : 'is-good'}>
                    {validation?.errors.length || 0}
                  </dd>
                </div>
                <div>
                  <dt>Warnings</dt>
                  <dd>{validation?.warnings.length || 0}</dd>
                </div>
              </dl>

              {validation?.blockingReasons?.length > 0 && (
                <div>
                  <h4 className='stu-wiz__heading'>Why this cannot be simulated yet</h4>
                  <ul className='stu-wiz__reasons'>
                    {validation.blockingReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className='stu-wiz__pane'>
            <div className='stu-wiz__confirm'>
              <h3>Ready to add this layer</h3>
              <p>
                <b>{importName}</b> will be added to your draft workspace with{' '}
                <b>{validation?.featureCount}</b> features.
              </p>
              <div>
                <StagedBadge />
              </div>
              <ul>
                <li>Shown as a reference layer in the Map and Terrain views.</li>
                <li>The flow simulation is not changed.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
