import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ops/shell.css';

import AppShell from './components/AppShell.jsx';
import { BasemapProxyContext } from './ui/BasemapContext.js';
import ControlPanel from './components/ControlPanel.jsx';
import MapCanvas from './components/MapCanvas.jsx';
import Terrain3DViewer from './components/Terrain3DViewer.jsx';
import IncidentPanel from './components/IncidentPanel.jsx';
import WelcomeScreen from './components/WelcomeScreen.jsx';
import NetworkImportModal from './components/NetworkImportModal.jsx';
import GuidedTour from './components/GuidedTour.jsx';
import { Toast } from './ui/index.js';
import { useHydroPulse } from './hooks/useHydroPulse.js';
import { Stepper, NextActionButton } from './components/NextAction.jsx';
import AssistantPanel from './components/assistant/AssistantPanel.jsx';
import { useAssistant } from './hooks/useAssistant.js';
import { reportText, copyText } from './lib/opsFlow.js';

// Lazy load NetworkStudio and PressureCharts with React.Suspense
const NetworkStudio = lazy(() => import('./pages/NetworkStudio.jsx'));
const PressureCharts = lazy(() => import('./components/PressureCharts.jsx'));

// Dev-only UI primitive showcase
const Preview = lazy(() => import('./ui/Preview.jsx'));

const ENTRY_KEY = 'hp-entry';
function readEntry() {
  try {
    const v = localStorage.getItem(ENTRY_KEY);
    return v === 'demo' || v === 'import' ? v : null;
  } catch {
    return null;
  }
}
function writeEntry(v) {
  try {
    if (v) localStorage.setItem(ENTRY_KEY, v);
    else localStorage.removeItem(ENTRY_KEY);
  } catch {
    /* storage unavailable: choice just isn't remembered */
  }
}

const TOUR_KEY = 'hp-tour';
function tourDone() {
  try {
    return localStorage.getItem(TOUR_KEY) === 'done';
  } catch {
    return false;
  }
}
function markTourDone() {
  try {
    localStorage.setItem(TOUR_KEY, 'done');
  } catch {
    /* storage unavailable: tour may show again */
  }
}

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
    lastUpdated,
    isRefreshing,
    isCached,
    simulateCooldown,
    load,
    simulate,
    isolate,
    reset,
    clearCache,
  } = pulse;

  const [view, setView] = useState('operations'); // 'operations' | 'studio'
  const [viewMode, setViewMode] = useState('2d'); // '2d' | '3d'
  const [activeDraft, setActiveDraft] = useState(null);
  const activeNetwork = activeDraft || network;
  const [activeTab, setActiveTab] = useState('simulate'); // 'simulate' | 'incident' | 'sensors'
  const [statusAnnouncement, setStatusAnnouncement] = useState('');
  const [selected, setSelected] = useState('J15');
  const [activePresetId, setActivePresetId] = useState(null);
  const [area, setArea] = useState(25);
  const [noise, setNoise] = useState(1.5);
  const [judge, setJudge] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [chartsOpen, setChartsOpen] = useState(true);
  const [help, setHelp] = useState(false);
  const [roi, setRoi] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [entry, setEntry] = useState(readEntry);
  const [importOpen, setImportOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [tourOpen, setTourOpen] = useState(() => readEntry() === 'demo' && !tourDone());

  const customData = !!health?.source && health.source !== 'synthetic';

  // The shared network changed: reload it, drop the old incident and pick a valid target.
  const handleNetworkChanged = useCallback(async () => {
    await pulse.load();
    reset();
    setRevealed(false);
    setSelected('');
  }, [pulse, reset]);

  // Assistant hook for AI suggestions
  const assistant = useAssistant({
    networkRevision: health?.network_revision,
    enabled: view === 'operations',
    live: mode === 'live',
    onNetworkChanged: handleNetworkChanged,
  });

  // Keep preset aligned initially
  useEffect(() => {
    if (!activePresetId && presets?.length) {
      setActivePresetId(presets[0].id);
    }
  }, [presets, activePresetId]);

  const handleSelectPreset = useCallback((p) => {
    setActivePresetId(p.id);
    setSelected(p.target_node_id);
    setArea(p.leak_area_cm2);
    setNoise(p.noise_pct);
  }, []);

  const handlePickSpot = useCallback((nodeId) => {
    setSelected(nodeId);
    setActivePresetId(null);
  }, []);

  const handleSizeChange = useCallback((newArea) => {
    setArea(newArea);
    setActivePresetId(null);
  }, []);

  const handleResetAll = useCallback(() => {
    reset();
    setRevealed(false);
    setActivePresetId(null);
  }, [reset]);

  const handleExportReport = useCallback(async () => {
    const text = reportText({
      result: lastResult,
      network: activeNetwork,
      phase,
      judge,
      revealed,
    });
    const ok = await copyText(text);
    if (ok) {
      setNotice({ tone: 'water', message: 'Report copied to clipboard' });
    } else {
      setNotice({ tone: 'leak', message: 'Failed to copy report to clipboard' });
    }
  }, [lastResult, activeNetwork, phase, judge, revealed]);

  const chooseEntry = useCallback((choice) => {
    writeEntry(choice);
    setEntry(choice);
    if (choice === 'import') setImportOpen(true);
    if (choice === 'demo' && !tourDone()) setTourOpen(true);
  }, []);
  const closeTour = useCallback(() => {
    markTourDone();
    setTourOpen(false);
  }, []);
  const openDataSource = useCallback(() => {
    writeEntry(null);
    setEntry(null);
    setImportOpen(false);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  // Keep the selected junction valid for whichever network is active.
  useEffect(() => {
    if (!network?.nodes) return;
    if (!network.nodes.some((n) => n.id === selected && n.type === 'junction')) {
      const next = presets?.[0]?.target_node_id;
      const fallback = network.nodes.find((n) => n.type === 'junction')?.id;
      setSelected(network.nodes.some((n) => n.id === next) ? next : fallback || '');
    }
  }, [network, presets, selected]);

  // Auto-select Incident tab on simulation completion with polite live announcement
  useEffect(() => {
    if (lastResult) {
      setActiveTab('incident');
      setStatusAnnouncement('Simulation completed. Incident panel selected.');
    }
  }, [lastResult]);

  // Display error messages from useHydroPulse as banner toasts
  useEffect(() => {
    if (error) {
      setToastMessage(error);
    }
  }, [error]);

  // Node selection: sets target junction only when not in judge mode
  const handleSelectNode = useCallback(
    (nodeId) => {
      if (!judge) {
        setSelected(nodeId);
      }
    },
    [judge],
  );

  const run = useCallback(
    (params, preset) => {
      const presetId = typeof preset === 'string' ? preset : preset?.id || null;
      const targetId = params?.target_node_id || params?.target_junction_id || selected;
      const leakArea = params?.leak_area_cm2 ?? params?.area_cm2 ?? area;
      const noisePct = params?.noise_pct ?? noise;

      if (!judge) {
        setSelected(targetId);
      }
      setRevealed(false);
      simulate(
        {
          target_node_id: targetId,
          leak_area_cm2: Number(leakArea) || 25,
          noise_pct: Number(noisePct) || 1.5,
          seed: params?.seed !== undefined ? params.seed : null,
        },
        presetId,
      );
    },
    [judge, selected, area, noise, simulate],
  );

  const handleStartDemo = useCallback(() => {
    const preset = presets?.find((p) => p.id === 'kengeri_mainline_rupture') || presets?.[0];
    const targetNode = preset?.target_node_id || 'J1';
    const leakArea = preset?.leak_area_cm2 || 45.0;
    const leakNoise = preset?.noise_pct ?? 1.5;
    const presetId = preset?.id || 'kengeri_mainline_rupture';

    setActivePresetId(presetId);
    setSelected(targetNode);
    setArea(leakArea);
    setNoise(leakNoise);
    setRevealed(false);

    run({ target_node_id: targetNode, area_cm2: leakArea, noise_pct: leakNoise, seed: 7 }, presetId);
  }, [presets, run]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e) => {
      // Ignore shortcuts when focus is inside input/select/textarea
      const activeEl = document.activeElement;
      const tag = activeEl?.tagName?.toLowerCase();
      const isInput =
        tag === 'input' ||
        tag === 'select' ||
        tag === 'textarea' ||
        activeEl?.isContentEditable;
      if (isInput) return;

      // When Network Studio is open, all shortcuts are disabled except 'n'/'N' to exit
      if (view === 'studio') {
        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          setView('operations');
        }
        return;
      }

      // 'n' / 'N': Toggle view to/from Network Studio
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setView('studio');
        return;
      }

      // '?' / '/': Help modal
      if (e.key === '?' || e.key === '/') {
        e.preventDefault();
        setHelp((v) => !v);
        return;
      }

      // 'Escape': Close modals
      if (e.key === 'Escape') {
        setHelp(false);
        setRoi(false);
        return;
      }

      // '1', '2', '3': Scenario presets
      if (e.key === '1') {
        e.preventDefault();
        const p = presets?.[0];
        if (p) run(p, p);
        return;
      }
      if (e.key === '2') {
        e.preventDefault();
        const p = presets?.[1];
        if (p) run(p, p);
        return;
      }
      if (e.key === '3') {
        e.preventDefault();
        const p = presets?.[2];
        if (p) run(p, p);
        return;
      }

      // 'Space': Simulate custom burst
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        run({ area_cm2: area, noise_pct: noise }, null);
        return;
      }

      // 'i' / 'I': Isolate valves
      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        isolate();
        return;
      }

      // 'r' / 'R': Reset incident
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        reset();
        return;
      }

      // 'j' / 'J': Toggle judge mode
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        setJudge((v) => !v);
        setRevealed(false);
        return;
      }

      // 'v' / 'V': Reveal/hide truth
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        setRevealed((v) => !v);
        return;
      }

      // 'm' / 'M': Toggle 2D Map / 3D Terrain view
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setViewMode((v) => (v === '2d' ? '3d' : '2d'));
        return;
      }

      // 'b' / 'B': Toggle basemap
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        const basemapBtn = document.querySelector(
          '[aria-label="Hide basemap"], [aria-label="Show basemap"]',
        );
        if (basemapBtn) {
          basemapBtn.click();
        }
        return;
      }

      // 'f' / 'F': Toggle fullscreen
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        const fsBtn = document.querySelector(
          '[aria-label="Enter fullscreen"], [aria-label="Exit fullscreen"]',
        );
        if (fsBtn) {
          fsBtn.click();
        } else if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [view, presets, area, noise, run, isolate, reset]);

  // Derived truth and candidate for distance/localization error calculation
  const truth = lastResult?.injected_node_id;
  const candidate = lastResult?.predicted_top_candidates?.[0]?.node_id;
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

  if (!entry) {
    return <WelcomeScreen onChoose={chooseEntry} />;
  }

  const opsStep =
    phase === 'simulating'
      ? 'running'
      : phase === 'isolated'
        ? 'isolated'
        : phase === 'located'
          ? 'located'
          : selected
            ? 'ready'
            : 'pick';

  const nextActionFooter = (
    <>
      <Stepper step={opsStep} />
      <NextActionButton
        step={opsStep}
        hasNetwork={!!activeNetwork}
        cooldown={simulateCooldown}
        onRun={() => run({ area_cm2: area, noise_pct: noise }, activePresetId)}
        onIsolate={isolate}
        onExport={handleExportReport}
        onReset={handleResetAll}
        onSeeWhy={() => setActiveTab('incident')}
      />
    </>
  );

  const mobileActionFooter = (
    <NextActionButton
      step={opsStep}
      hasNetwork={!!activeNetwork}
      cooldown={simulateCooldown}
      onRun={() => run({ area_cm2: area, noise_pct: noise }, activePresetId)}
      onIsolate={isolate}
      onExport={handleExportReport}
      onReset={handleResetAll}
      onSeeWhy={() => setActiveTab('incident')}
      showHelper={false}
    />
  );

  return (
    <BasemapProxyContext.Provider value={!!health?.basemap_proxy}>
    <AppShell
      customData={customData}
      onDataSource={openDataSource}
      onResetCustom={() => setImportOpen(true)}
      assistantPanel={
        <AssistantPanel
          assistant={assistant}
          onNotify={(tone, message) => setNotice({ tone, message })}
        />
      }
      mobileAction={mobileActionFooter}
      extra={
        <>
          <NetworkImportModal
            open={importOpen}
            onClose={() => setImportOpen(false)}
            mode={mode}
            health={health}
            network={network}
            customActive={customData}
            onActivated={handleNetworkChanged}
            onNotify={(tone, message) => setNotice({ tone, message })}
          />
          {tourOpen && entry === 'demo' && !importOpen && view === 'operations' && (
            <GuidedTour
              onClose={closeTour}
              onPickPreset={() => {
                const p = presets?.[0];
                if (p) setSelected(p.target_node_id || selected);
              }}
              onRun={() => run({ area_cm2: area, noise_pct: noise }, null)}
              onOpenStudio={() => setView('studio')}
              canRun={!!network && phase !== 'simulating'}
            />
          )}
          {notice && (
            <Toast tone={notice.tone} message={notice.message} onDismiss={() => setNotice(null)} />
          )}
        </>
      }
      view={view}
      onViewChange={setView}
      mode={mode}
      networkSource={networkSource}
      health={health}
      network={activeNetwork}
      phase={phase}
      lastResult={lastResult}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      statusAnnouncement={statusAnnouncement}
      onSimulateBurst={() => run({ area_cm2: area, noise_pct: noise }, activePresetId)}
      onHelp={() => setHelp(true)}
      onReplayTour={() => setTourOpen(true)}
      onRoi={() => setRoi(true)}
      helpOpen={help}
      onHelpClose={() => setHelp(false)}
      roiOpen={roi}
      onRoiClose={() => setRoi(false)}
      statusMessage={toastMessage}
      onDismissStatus={() => setToastMessage('')}
      onRetryConnection={() => pulse.load()}
      lastUpdated={lastUpdated}
      isRefreshing={isRefreshing}
      isCached={isCached}
      onClearCache={clearCache}
      controlPanel={
        <ControlPanel
          network={activeNetwork}
          presets={presets}
          selected={selected}
          picked={Boolean(selected)}
          activePresetId={activePresetId}
          area={area}
          noise={noise}
          judge={judge}
          revealed={revealed}
          phase={phase}
          footer={nextActionFooter}
          onStartDemo={handleStartDemo}
          onSelectPreset={handleSelectPreset}
          onPickSpot={handlePickSpot}
          onSizeChange={handleSizeChange}
          onNoiseChange={setNoise}
          onJudgeToggle={(checked) => {
            setJudge(checked);
            setRevealed(false);
          }}
          onReveal={(show) => setRevealed(show)}
          onReset={handleResetAll}
        />
      }
      mapCanvas={
        viewMode === '2d' ? (
          <MapCanvas
            network={activeNetwork}
            selected={selected}
            phase={phase}
            lastResult={lastResult}
            basemapProxy={!!health?.basemap_proxy}
            result={lastResult}
            isolatedValves={lastResult?.recommended_valves_to_close || []}
            judge={judge}
            showTruth={showTruth}
            revealed={revealed}
            onPick={handleSelectNode}
            setSelected={handleSelectNode}
            onSelect={handleSelectNode}
          />
        ) : (
          <div className="map-canvas terrain-workspace-view" style={{ width: '100%', height: '100%', position: 'relative' }}>
            <Terrain3DViewer
              network={activeNetwork}
              result={lastResult}
              phase={phase}
              selected={selected}
              setSelected={handleSelectNode}
              judge={judge}
              revealed={revealed}
              mode={mode}
              onUpdateDraft={(updated) => setActiveDraft(updated)}
            />
          </div>
        )
      }
      incidentPanel={
        <IncidentPanel
          network={activeNetwork}
          mode={mode}
          onSimulate={() => run({ area_cm2: area, noise_pct: noise }, activePresetId)}
          phase={phase}
          result={lastResult}
          lastResult={lastResult}
          judge={judge}
          revealed={revealed}
          showTruth={showTruth}
          errorMeters={errorMeters}
          error={error}
          onIsolate={isolate}
          onReset={handleResetAll}
          onJudgeToggle={() => {
            setJudge((v) => !v);
            setRevealed(false);
          }}
          onReveal={() => setRevealed(true)}
          onFocus={handleSelectNode}
          onSelectNode={handleSelectNode}
        />
      }
      pressureCharts={
        <Suspense
          fallback={
            <div className="charts-loading" style={{ padding: 'var(--space-4)', color: 'var(--ink-muted)' }}>
              Loading charts…
            </div>
          }
        >
          <PressureCharts
            result={lastResult}
            lastResult={lastResult}
            open={chartsOpen || activeTab === 'sensors'}
            onToggle={() => setChartsOpen((v) => !v)}
          />
        </Suspense>
      }
      studioShell={
        <Suspense
          fallback={
            <div
              className="studio-loading"
              role="status"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 'calc(100vh - 52px)',
                color: 'var(--ink-muted)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Loading Network Studio…
            </div>
          }
        >
          <NetworkStudio
            initialNetwork={activeNetwork}
            networkSource={networkSource}
          />
        </Suspense>
      }
    />
    </BasemapProxyContext.Provider>
  );
}
