import TopBar from './TopBar.jsx';
import HelpModal from './HelpModal.jsx';
import RoiPanel from './RoiPanel.jsx';
import StatusBanner from './StatusBanner.jsx';

export default function AppShell({
  view = 'operations',
  onViewChange,
  mode = 'mock',
  networkSource = 'recorded',
  health,
  network,
  phase = 'idle',
  lastResult,
  activeTab = 'simulate',
  onTabChange,
  statusAnnouncement,
  onSimulateBurst,
  onHelp,
  onRoi,
  helpOpen = false,
  onHelpClose,
  roiOpen = false,
  onRoiClose,
  statusMessage,
  onDismissStatus,
  onRetryConnection,
  lastUpdated,
  isRefreshing,
  isCached,
  onClearCache,
  controlPanel,
  mapCanvas,
  incidentPanel,
  pressureCharts,
  assistantPanel,
  mobileAction,
  studioShell,
  customData = false,
  onDataSource,
  onResetCustom,
  onReplayTour,
  onAiAdvisor,
  onOpenBenchmark,
  extra,
}) {
  return (
    <main className="app-shell">
      <TopBar
        view={view}
        onViewChange={onViewChange}
        mode={mode}
        networkSource={networkSource}
        health={health}
        network={network}
        onHelp={onHelp}
        onRoi={onRoi}
        customData={customData}
        onDataSource={onDataSource}
        onResetCustom={onResetCustom}
        onAiAdvisor={onAiAdvisor}
        onOpenBenchmark={onOpenBenchmark}
      />

      {view === 'studio' ? (
        studioShell
      ) : (
        <div className="ops-workspace" data-active-tab={activeTab}>
          <div className="ops-map-wrapper">
            {mapCanvas}
          </div>

          <div className="ops-tabs-nav" role="tablist" aria-label="Operations panels">
            <button
              type="button"
              role="tab"
              id="tab-simulate"
              aria-selected={activeTab === 'simulate'}
              aria-controls="panel-simulate"
              className={`ops-tab-btn ${activeTab === 'simulate' ? 'ops-tab-btn--active' : ''}`}
              onClick={() => onTabChange?.('simulate')}
            >
              Simulate
            </button>
            <button
              type="button"
              role="tab"
              id="tab-incident"
              aria-selected={activeTab === 'incident'}
              aria-controls="panel-incident"
              className={`ops-tab-btn ${activeTab === 'incident' ? 'ops-tab-btn--active' : ''}`}
              onClick={() => onTabChange?.('incident')}
            >
              Incident
            </button>
            <button
              type="button"
              role="tab"
              id="tab-sensors"
              aria-selected={activeTab === 'sensors'}
              aria-controls="panel-sensors"
              className={`ops-tab-btn ${activeTab === 'sensors' ? 'ops-tab-btn--active' : ''}`}
              onClick={() => onTabChange?.('sensors')}
            >
              Sensors
            </button>
            {assistantPanel && (
              <button
                type="button"
                role="tab"
                id="tab-advisor"
                aria-selected={activeTab === 'advisor'}
                aria-controls="panel-advisor"
                className={`ops-tab-btn ${activeTab === 'advisor' ? 'ops-tab-btn--active' : ''}`}
                onClick={() => onTabChange?.('advisor')}
              >
                AI Advisor
              </button>
            )}
          </div>

          <div
            className="ops-panel ops-panel--control"
            id="panel-simulate"
            role="tabpanel"
            aria-labelledby="tab-simulate"
          >
            {controlPanel}
          </div>

          <div
            className="ops-panel ops-panel--incident"
            id="panel-incident"
            role="tabpanel"
            aria-labelledby="tab-incident"
          >
            {incidentPanel}
          </div>

          <div
            className="ops-panel ops-panel--charts"
            id="panel-sensors"
            role="tabpanel"
            aria-labelledby="tab-sensors"
          >
            {pressureCharts}
          </div>

          {assistantPanel && (
            <div
              className="ops-panel ops-panel--assistant"
              id="panel-advisor"
              role="tabpanel"
              aria-labelledby="tab-advisor"
            >
              {assistantPanel}
            </div>
          )}

          <div className="mobile-bottom-bar">
            {mobileAction ? (
              mobileAction
            ) : (
              <button
                type="button"
                className="mobile-simulate-btn"
                disabled={!network || phase === 'simulating'}
                onClick={onSimulateBurst}
              >
                {phase === 'simulating' ? 'Scanning network…' : 'Simulate burst'}
              </button>
            )}
          </div>

          <div className="sr-only" aria-live="polite" role="status">
            {statusAnnouncement}
          </div>
        </div>
      )}

      <HelpModal open={helpOpen} onClose={onHelpClose} onReplayTour={onReplayTour} />
      <RoiPanel
        open={roiOpen}
        onClose={onRoiClose}
        lastResult={lastResult}
        network={network}
      />
      <StatusBanner
        mode={mode}
        networkSource={networkSource}
        message={statusMessage}
        onDismiss={onDismissStatus}
        onRetry={onRetryConnection}
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        isCached={isCached}
        onClearCache={onClearCache}
      />
      {extra}
    </main>
  );
}
