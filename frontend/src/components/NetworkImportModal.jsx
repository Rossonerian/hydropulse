import { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Modal, Button, Field } from '../ui/index.js';
import { client } from '../api/client.js';
import '../styles/ops/import.css';

const MAX_BYTES = 2_000_000; // matches the backend content limit (2 MB)
const SOURCE_LABELS = {
  imported_inp: 'EPANET .inp file',
  imported_geojson: 'GeoJSON file',
  synthetic: 'Synthetic network',
  osm: 'OpenStreetMap',
  ward_preset: 'Ward preset',
  net3_fallback: 'Fallback network',
};

// Tiny built-in EPANET network: 1 reservoir, 5 junctions. Coordinates are x = lng, y = lat (EPSG:4326).
const SAMPLE_INP = `[TITLE]
HydroPulse sample network

[JUNCTIONS]
;ID  Elev  Demand
J1   900   2
J2   898   2
J3   897   2
J4   896   2
J5   895   2

[RESERVOIRS]
;ID  Head
R1   935

[PIPES]
;ID Node1 Node2 Length Diameter Roughness MinorLoss Status
P1  R1    J1    300    200      130       0         Open
P2  J1    J2    250    150      130       0         Open
P3  J2    J3    250    150      130       0         Open
P4  J2    J4    250    100      130       0         Open
P5  J4    J5    250    100      130       0         Open

[OPTIONS]
Units    LPS
Headloss H-W

[TIMES]
Duration 0

[COORDINATES]
;Node  X        Y
R1     77.4838  12.9081
J1     77.4846  12.9081
J2     77.4852  12.9081
J3     77.4860  12.9081
J4     77.4852  12.9073
J5     77.4852  12.9065

[END]
`;
const SAMPLE_NAME = 'hydropulse-sample.inp';

const STEPS = ['Choose a file', 'Check it', 'Switch to it'];

function detectFormat(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.inp')) return 'inp';
  if (lower.endsWith('.geojson') || lower.endsWith('.json')) return 'geojson';
  return null;
}

export default function NetworkImportModal({
  open,
  onClose,
  mode,
  health,
  network,
  customActive = false,
  onActivated,
  onNotify,
}) {
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [checking, setChecking] = useState(false);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(''); // '' | 'commit' | 'reset'
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [isSample, setIsSample] = useState(false);
  const fileRef = useRef(null);
  const seq = useRef(0);

  const live = mode === 'live';
  const currentRevision = health?.network_revision || network?.network_revision || '';

  // Fresh state each time the dialog opens; the token never outlives the dialog.
  useEffect(() => {
    if (!open) return;
    seq.current += 1;
    setFileName('');
    setPreview(null);
    setChecking(false);
    setToken('');
    setBusy('');
    setError('');
    setDone('');
    setIsSample(false);
  }, [open]);

  const notify = (tone, message) => onNotify?.(tone, message);

  const runPreview = async ({ name, format, content, sample }) => {
    const mine = ++seq.current;
    setPreview(null);
    setError('');
    setFileName(name);
    setIsSample(!!sample);
    setChecking(true);
    try {
      const result = await client.importPreview({ format, filename: name, content });
      if (mine !== seq.current) return;
      setPreview(result);
    } catch (e) {
      if (mine !== seq.current) return;
      setError(e.message || 'Could not validate this file');
    } finally {
      if (mine === seq.current) setChecking(false);
    }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    seq.current += 1;
    setPreview(null);
    setError('');
    setIsSample(false);
    setFileName(file.name);
    const format = detectFormat(file.name);
    if (!format) {
      setError('Unsupported file type. Choose a .inp, .geojson or .json file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`File is too large (${(file.size / 1e6).toFixed(1)} MB). The limit is 2 MB.`);
      return;
    }
    const content = await file.text();
    await runPreview({ name: file.name, format, content });
  };

  const trySample = () => runPreview({ name: SAMPLE_NAME, format: 'inp', content: SAMPLE_INP, sample: true });

  const finish = async (message) => {
    setToken('');
    try {
      await onActivated?.();
    } catch {
      /* reload errors surface through the hook's own error state */
    }
    notify('water', message);
    setDone(message);
    setBusy('');
  };

  const activate = async () => {
    if (!preview?.valid || !preview.preview_token) return;
    setBusy('commit');
    setError('');
    try {
      await client.importCommit({
        preview_token: preview.preview_token,
        expected_network_revision: currentRevision,
        adminToken: token,
      });
      await finish('Your data is now the active network');
    } catch (e) {
      setError(e.message);
      notify('leak', e.message);
      setBusy('');
    }
  };

  const resetToDemo = async () => {
    setBusy('reset');
    setError('');
    try {
      await client.resetNetwork({ target: 'baseline', adminToken: token });
      await finish('Demo network restored');
    } catch (e) {
      setError(e.message);
      notify('leak', e.message);
      setBusy('');
    }
  };

  const meta = preview?.proposed_meta;
  const canActivate = live && preview?.valid && token.trim() && !busy && !checking;
  const needsToken = live && (preview?.valid || customActive || !preview);

  // 1 Upload, 2 Validate, 3 Activate. 4 means everything is complete.
  // Shown beside the disabled button so it is always clear why it cannot be pressed.
  let activateReason = '';
  if (!live) activateReason = 'Needs the live backend.';
  else if (checking || busy) activateReason = 'Please wait a moment.';
  else if (!preview) activateReason = 'Choose a file first.';
  else if (!preview.valid) activateReason = 'The file has errors. Fix them and choose it again.';
  else if (!token.trim()) activateReason = 'Enter the admin token below first.';

  const stepNow = done ? 4 : preview?.valid ? 3 : preview || checking ? 2 : 1;

  const footer = done ? (
    <Button variant="primary" onClick={onClose}>
      Run a leak
    </Button>
  ) : (
    <>
      {!canActivate && activateReason && (
        <span className="import__reset-hint" role="status">{activateReason}</span>
      )}
      <Button variant="ghost" onClick={onClose} disabled={!!busy}>
        Cancel
      </Button>
      <Button variant="primary" onClick={activate} busy={busy === 'commit'} disabled={!canActivate}>
        Use this data
      </Button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title="Use your own data" footer={footer} initialFocusRef={fileRef}>
      <div className="import">
        <ol className="import__steps" aria-label="Import progress">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const state = n < stepNow ? 'done' : n === stepNow ? 'current' : 'todo';
            return (
              <li
                key={label}
                className={`import__step import__step--${state}`}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                <span className="import__step-num" aria-hidden="true">{state === 'done' ? '✓' : n}</span>
                <span>{label}</span>
                {state === 'done' && <span className="sr-only"> (complete)</span>}
              </li>
            );
          })}
        </ol>

        {done ? (
          <div className="import__success" role="status">
            <CheckCircle2 size={28} aria-hidden="true" />
            <h3 className="import__success-title">{done}</h3>
            <p className="import__reset-text">Go to Operations and pick a problem to try to see how the network responds.</p>
          </div>
        ) : (
          <>
        {!live && (
          <p className="import__msg import__msg--warn" role="alert">
            Import needs the live backend. The app is currently running on recorded or generated data.
          </p>
        )}

        <Field
          label="Network file"
          htmlFor="import-file"
          hint="EPANET .inp, or GeoJSON (.geojson / .json). Maximum 2 MB. The file is checked before anything changes."
        >
          <input
            ref={fileRef}
            id="import-file"
            className="import__file"
            type="file"
            accept=".inp,.geojson,.json"
            onChange={handleFile}
            disabled={!live || checking || !!busy}
          />
        </Field>

        <div className="import__sample">
          <Button variant="secondary" size="sm" onClick={trySample} disabled={!live || checking || !!busy}>
            Try a sample file
          </Button>
          <span className="import__reset-hint">Built-in 5-junction demo network (sample data). Nothing is uploaded from your device.</span>
        </div>

        <details className="import__guide">
          <summary>File format guide</summary>
          <ul className="import__list">
            <li>Accepted: EPANET <code>.inp</code> and GeoJSON (<code>.geojson</code>, <code>.json</code>).</li>
            <li>Maximum size: 2 MB.</li>
            <li>Coordinates must be longitude and latitude in EPSG:4326.</li>
            <li>Nothing changes until you press Use this data.</li>
          </ul>
        </details>

        {isSample && fileName && (
          <p className="import__msg">Using the built-in sample file ({fileName}). It is example data, not your network.</p>
        )}

        {checking && (
          <p className="import__msg" role="status">
            Checking {fileName}…
          </p>
        )}

        {preview && (
          <div className="import__result" role="status">
            <p className={`import__badge ${preview.valid ? 'import__badge--ok' : 'import__badge--bad'}`}>
              {preview.valid ? 'File is valid and ready to use' : 'File is not valid. Fix the errors and try again'}
            </p>
            {meta && (
              <dl className="import__meta">
                <dt>Source</dt>
                <dd>{SOURCE_LABELS[meta.source_type] || meta.source_type}{meta.source_filename ? ` (${meta.source_filename})` : ''}</dd>
                <dt>Junctions and sources</dt>
                <dd>{meta.num_nodes}</dd>
                <dt>Pipes</dt>
                <dd>{meta.num_pipes}</dd>
                <dt>Checksum</dt>
                <dd>{meta.sha256 ? meta.sha256.slice(0, 8) : 'n/a'}</dd>
                <dt>Coordinates</dt>
                <dd>{meta.crs}</dd>
              </dl>
            )}
            {preview.errors?.length > 0 && (
              <div>
                <h3 className="import__list-title">Errors</h3>
                <ul className="import__list import__list--bad">
                  {preview.errors.map((m, i) => (
                    <li key={`e${i}`}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
            {preview.warnings?.length > 0 && (
              <div>
                <h3 className="import__list-title">Warnings</h3>
                <ul className="import__list">
                  {preview.warnings.map((m, i) => (
                    <li key={`w${i}`}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <p className="import__msg import__msg--warn">
          Activating replaces the shared workspace for all visitors until reset.
        </p>

        {needsToken && (
          <>
            <Field
              label="Admin token"
              htmlFor="import-admin-token"
              hint="Needed to activate or reset. Kept only in this dialog and cleared when it closes."
            >
              <input
                id="import-admin-token"
                className="import__text"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={!!busy}
              />
            </Field>
          </>
        )}

        {error && (
          <p className="import__msg import__msg--bad" role="alert">
            {error}
          </p>
        )}

        <div className="import__reset">
          <h3 className="import__list-title">Back to the demo</h3>
          <p className="import__reset-text">Restore the Kengeri synthetic network for everyone.</p>
          <Button
            variant="danger"
            size="sm"
            onClick={resetToDemo}
            busy={busy === 'reset'}
            disabled={!live || !token.trim() || !!busy}
          >
            Reset to demo network
          </Button>
          {live && !token.trim() && <span className="import__reset-hint"> Enter the admin token above to enable.</span>}
        </div>
          </>
        )}
      </div>
    </Modal>
  );
}
