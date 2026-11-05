import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, CheckCircle2, ShieldAlert, Upload } from 'lucide-react';
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

const STEPS = ['Choose file', 'Map fields', 'Review', 'Stage'];

export default function ImportWizardModal({ open, onClose, onImportStaged }) {
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
      setStep(2);
    } catch (err) {
      setValidation({
        valid: false,
        errors: [`Failed to read file: ${err.message}`],
        warnings: [],
      });
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
          Review geometry <ArrowRight size={16} aria-hidden='true' />
        </Button>
      </div>
    );
  } else if (step === 3) {
    footer = (
      <div className='stu-wiz__actions'>
        <Button variant='secondary' onClick={() => setStep(2)}>
          Back
        </Button>
        <Button variant='primary' disabled={!validation?.valid} onClick={() => setStep(4)}>
          Continue to staging <ArrowRight size={16} aria-hidden='true' />
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
          Stage layer
        </Button>
      </div>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title='Import layer' footer={footer}>
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
              <h3>Choose a geospatial file to import</h3>
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
            {validation && !validation.valid && validation.errors?.length > 0 && (
              <div className='stu-wiz__note stu-wiz__note--bad' role='alert'>
                <AlertTriangle size={16} aria-hidden='true' />
                <span>{validation.errors[0]}</span>
              </div>
            )}
            <div className='stu-wiz__note'>
              <ShieldAlert size={16} aria-hidden='true' />
              <p>
                Security boundary: files are processed client-side into local draft staging.
                Imported files will <b>never</b> overwrite the committed EPANET benchmark model.
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
                    <CheckCircle2 size={16} aria-hidden='true' /> Format and topology validated
                  </>
                ) : (
                  'Validation issues detected'
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
                  <dt>Hydraulic status</dt>
                  <dd className={validation?.modelReady ? 'is-good' : 'is-warn'}>
                    {validation?.modelReady ? 'Model ready' : 'Geographic only'}
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
                  <h4 className='stu-wiz__heading'>Hydraulic simulation readiness gate</h4>
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
              <h3>Ready to stage layer</h3>
              <p>
                <b>{importName}</b> will be added to your draft workspace with{' '}
                <b>{validation?.featureCount}</b> features.
              </p>
              <div>
                <StagedBadge />
              </div>
              <ul>
                <li>Staged as a reference overlay in the Map and Terrain views.</li>
                <li>The WNTR hydraulic model remains untouched.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
