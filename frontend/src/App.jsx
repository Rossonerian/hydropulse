import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  X,
} from 'lucide-react';
import Header from './components/Header.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import MapCanvas from './components/MapCanvas.jsx';
import IncidentPanel from './components/IncidentPanel.jsx';
import PressureCharts from './components/PressureCharts.jsx';
import RoiPanel from './components/RoiPanel.jsx';
import StatusBanner from './components/StatusBanner.jsx';
import NetworkStudio from './pages/NetworkStudio.jsx';
import { useHydroPulse } from './hooks/useHydroPulse.js';

// Lazy load Preview for dev-only UI primitive showcase
const Preview = lazy(() => import('./ui/Preview.jsx'));

export default function App() {
  const pulse = useHydroPulse();
  const {
    network,
    networkSource,
    presets,
    health,
    mode,
    phase,
    lastResult,
    error,
    load,
    simulate,
    isolate,
    reset,
  } = pulse;
  const [selected, setSelected] = useState('J15'),
    [area, setArea] = useState(25),
    [noise, setNoise] = useState(1.5),
    [judge, setJudge] = useState(false),
    [revealed, setRevealed] = useState(false),
    [chartsOpen, setChartsOpen] = useState(true),
    [help, setHelp] = useState(false),
    [roi, setRoi] = useState(false),
    [focusNode, setFocusNode] = useState(null),
    [toast, setToast] = useState('');
  const [studioOpen, setStudioOpen] = useState(false);
  const run = useCallback(
    async (body, preset) => {
      const req = { ...body, target_junction_id: selected };
      if (preset) {
        req.preset_scenario_id = preset.id;
      }
      try {
        await simulate(req);
      } catch {}
    },
    [simulate, network, selected],
  );
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (lastResult) {
      setJudge(false);
      setRevealed(false);
    }
  }, [lastResult]);
  useEffect(() => {
    if (error) {
      setToast(error);
      const t = setTimeout(() => setToast(''), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);
  useEffect(() => {
    const handler = (e) => {
      if (studioOpen) return;
      if (e.key === '1') run(presets[0], presets[0]);
      if (e.key === '2') run(presets[1], presets[1]);
      if (e.key === '3') run(presets[2], presets[2]);
      if (e.key === ' ' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        run(
          { area_cm2: area, noise_pct: noise },
          null,
        );
      }
      if (e.key === 'i' || e.key === 'I') {
        isolate();
      }
      if (e.key === 'r' || e.key === 'R') {
        reset();
      }
      if (e.key === 'j' || e.key === 'J') {
        setJudge((v) => !v);
        setRevealed(false);
      }
      if (e.key === 'v' || e.key === 'V') {
        setRevealed(true);
      }
      if (e.key === 'n' || e.key === 'N') {
        setStudioOpen((v) => !v);
      }
      if (e.key === 'b' || e.key === 'B') {
        // Toggle basemap - handled by MapCanvas
      }
      if (e.key === 'f' || e.key === 'F') {
        // Toggle fullscreen - handled by MapCanvas
      }
      if (e.key === '?' || e.key === '/') {
        setHelp((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [presets, run, selected, area, noise, lastResult, isolate, reset, judge, studioOpen]);
  const truth = lastResult?.injected_node_id;
  const candidate = lastResult?.predicted_top_candidates?.[0]?.node_id;
  // Older backend responses may omit localization_error_m, so derive distance from node coordinates.
  const distance =
    network?.nodes && truth && candidate
      ? (() => {
          const tNode = network.nodes.find((n) => n.id === truth);
          const cNode = network.nodes.find((n) => n.id === candidate);
          if (!tNode || !cNode) return 0;
          const dx = tNode.x - cNode.x;
          const dy = tNode.y - cNode.y;
          return Math.sqrt(dx * dx + dy * dy);
        })()
      : 0;
  const showTruth = !judge || revealed;
  const errorMeters = lastResult?.localization_error_m ?? distance;

  // Dev-only UI primitives preview
  const isUiPreview =
    import.meta.env.DEV && new URLSearchParams(window.location.search).get('ui') === '1';

  if (isUiPreview) {
    return (
      <Suspense fallback={<div>Loading preview…</div>}>
        <Preview />
      </Suspense>
    );
  }

  return (
    studioOpen ? (
      <NetworkStudio
        initialNetwork={network}
        networkSource={networkSource}
        onExit={() => setStudioOpen(false)}
      />
    ) : (
    <main className='app-shell'>
      <Header
        network={network}
        health={health}
        mode={mode}
        onStudioToggle={() => setStudioOpen(true)}
        onHelpToggle={() => setHelp((v) => !v)}
        onRoiToggle={() => setRoi((v) => !v)}
      />
      <ControlPanel
        presets={presets}
        selected={selected}
        area={area}
        noise={noise}
        judge={judge}
        onSelectedChange={setSelected}
        onAreaChange={setArea}
        onNoiseChange={setNoise}
        onSimulate={(body, preset) => run(body, preset)}
        onReset={reset}
        onJudgeToggle={() => setJudge((v) => !v)}
        network={network}
      />
      <MapCanvas
        network={network}
        selected={selected}
        phase={phase}
        lastResult={lastResult}
        judge={judge}
        showTruth={showTruth}
        onSelect={setSelected}
        onBasemapToggle={() => {}}
        onFullscreenToggle={() => {}}
      />
      <IncidentPanel
        phase={phase}
        lastResult={lastResult}
        judge={judge}
        showTruth={showTruth}
        errorMeters={errorMeters}
        onIsolate={isolate}
        onReset={reset}
        onJudgeToggle={() => setJudge((v) => !v)}
        onReveal={() => setRevealed(true)}
      />
      <PressureCharts
        open={chartsOpen}
        onToggle={() => setChartsOpen((v) => !v)}
        lastResult={lastResult}
      />
      <RoiPanel open={roi} onClose={() => setRoi(false)} network={network} />
      <StatusBanner message={toast} onDismiss={() => setToast('')} />
      {help && (
        <div className='help-modal'>
          <div className='help-modal-content'>
            <h2>Keyboard Shortcuts</h2>
            <ul>
              <li><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> — Quick scenarios</li>
              <li><kbd>Space</kbd> — Simulate custom burst</li>
              <li><kbd>I</kbd> — Isolate valves</li>
              <li><kbd>R</kbd> — Reset incident</li>
              <li><kbd>J</kbd> — Toggle judge mode</li>
              <li><kbd>V</kbd> — Reveal truth</li>
              <li><kbd>N</kbd> — Toggle Network Studio</li>
              <li><kbd>B</kbd> — Toggle basemap</li>
              <li><kbd>F</kbd> — Toggle fullscreen</li>
              <li><kbd>?</kbd> — This help</li>
            </ul>
            <button onClick={() => setHelp(false)}>Close</button>
          </div>
        </div>
      )}
    </main>
    )
  );
}
