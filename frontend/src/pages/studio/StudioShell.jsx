import { useCallback, useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { ReactFlowProvider } from '@xyflow/react';
import { Button, Modal, Toast } from '../../ui/index.js';
import useStudioDraft from './useStudioDraft.js';
import StudioBar from './StudioBar.jsx';
import ToolRail from './ToolRail.jsx';
import SchematicCanvas from './SchematicCanvas.jsx';
import Inspector from './Inspector.jsx';
import ValidationBar from './ValidationBar.jsx';
import LayersList from './LayersList.jsx';
import DataCatalogModal from '../../components/DataCatalogModal.jsx';
import ImportWizardModal from '../../components/ImportWizardModal.jsx';
import FeatureInspectorPanel from '../../components/FeatureInspectorPanel.jsx';
import '../../styles/studio/shell.css';

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

function StudioWorkspace({ initialNetwork, networkSource }) {
  const {
    draft,
    dirty,
    notice,
    projectNameDraft,
    tool,
    selection,
    pendingConnection,
    issuesOpen,
    pendingDelete,
    viewVersion,
    past,
    future,
    draftRef,
    fileInput,
    setNotice,
    setProjectNameDraft,
    setSelection,
    setCursor,
    setIssuesOpen,
    setPendingDelete,
    commit,
    loadDemo,
    newBlank,
    saveDraft,
    reopenDraft,
    exportDraft,
    importDraft,
    undo,
    redo,
    updateField,
    addNode,
    requestDelete,
    confirmDelete,
    handleNodeClick,
    handleEdgeClick,
    onPaneClick,
    onNodesChange,
    flowNodes,
    edges,
    startDrag,
    finishDrag,
    onMoveEnd,
    focusIssue,
    changeTool,
    validation,
    allIssues,
    placeHint,
  } = useStudioDraft({ initialNetwork, networkSource });

  // Real-World Data Layer States
  const [viewMode, setViewMode] = useState('schematic'); // 'schematic' | 'geographic' | 'terrain3d'
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [inspectedFeature, setInspectedFeature] = useState(null);
  const [activeLayerIds, setActiveLayerIds] = useState([
    'bwssb_water_lines_detailed_part_1',
    'bwssb_water_lines_gt_300mm',
    'bwssb_valves_kengeri',
    'bwssb_pumping_stations',
    'bwssb_borewells',
    'bwssb_sewerage_network',
    'nwdp_groundwater_telemetry',
  ]);
  const [visibleLayers, setVisibleLayers] = useState({
    potable_water: true,
    valves: true,
    infrastructure: true,
    groundwater: true,
    sewerage: true,
    surface_water: true,
    monitors: true,
    admin_boundary: true,
    terrain: true,
  });
  const [showIllustrativeDepth, setShowIllustrativeDepth] = useState(true);
  const [stagedLayers, setStagedLayers] = useState([]);

  const toggleLayer = useCallback((layerKey) => {
    setVisibleLayers((prev) => ({
      ...prev,
      [layerKey]: !prev[layerKey],
    }));
  }, []);

  const toggleCatalogLayer = useCallback((layerId) => {
    setActiveLayerIds((prev) =>
      prev.includes(layerId) ? prev.filter((id) => id !== layerId) : [...prev, layerId],
    );
  }, []);

  const handleImportStaged = useCallback((staged) => {
    setStagedLayers((prev) => [...prev, staged]);
    setNotice(`Staged "${staged.displayName}" (${staged.featureCount} features). WNTR model remains frozen.`);
  }, [setNotice]);
  const narrow = useMediaQuery('(max-width: 1023px)');
  const small = useMediaQuery('(max-width: 767px)');
  const [sheetOpen, setSheetOpen] = useState(false);
  const mapMode = viewMode !== 'schematic';
  const readOnly = small;

  useEffect(() => {
    if (readOnly && tool !== 'select') changeTool('select');
  }, [readOnly, tool, changeTool]);

  useEffect(() => {
    if (selection || inspectedFeature) setSheetOpen(true);
  }, [selection, inspectedFeature]);

  const showInspector = !readOnly || mapMode;
  const classes = ['stu-shell'];
  if (narrow) classes.push('stu-shell--narrow');
  if (readOnly) classes.push('stu-shell--readonly');

  const inspectorContent = mapMode ? (
    <>
      <LayersList
        viewMode={viewMode}
        visibleLayers={visibleLayers}
        toggleLayer={toggleLayer}
        activeLayerIds={activeLayerIds}
        toggleCatalogLayer={toggleCatalogLayer}
        stagedLayers={stagedLayers}
      />
      {inspectedFeature ? (
        <FeatureInspectorPanel feature={inspectedFeature} onClose={() => setInspectedFeature(null)} />
      ) : (
        <p className='stu-shell-hint'>Select a feature on the map to see its source, licence and attributes.</p>
      )}
    </>
  ) : (
    <Inspector draft={draft} selection={selection} onField={updateField} onRemove={requestDelete} />
  );

  return (
    <main className={classes.join(' ')}>
      <StudioBar
        projectNameDraft={projectNameDraft}
        setProjectNameDraft={setProjectNameDraft}
        commit={commit}
        draftRef={draftRef}
        dirty={dirty}
        savedAt={draft.saved_at}
        viewMode={viewMode}
        setViewMode={setViewMode}
        setCatalogOpen={setCatalogOpen}
        setImportOpen={setImportOpen}
        past={past}
        future={future}
        undo={undo}
        redo={redo}
        loadDemo={loadDemo}
        newBlank={newBlank}
        reopenDraft={reopenDraft}
        fileInput={fileInput}
        importDraft={importDraft}
        exportDraft={exportDraft}
        saveDraft={saveDraft}
        canExport={draft.network.nodes.length}
        readOnly={readOnly}
      />

      {readOnly && (
        <p className='stu-mobile-notice' role='note'>
          Network Studio editing needs a larger screen — you can still view and export drafts
        </p>
      )}

      <section className='stu-shell-workspace'>
        {!readOnly && (
          <div className='stu-shell-tools'>
            <ToolRail tool={tool} changeTool={changeTool} />
          </div>
        )}

        <div className='stu-shell-center'>
          <div className='stu-shell-canvas'>
            <SchematicCanvas
              draft={draft}
              viewVersion={viewVersion}
              viewMode={viewMode}
              tool={tool}
              placeHint={placeHint}
              flowNodes={flowNodes}
              edges={edges}
              onNodesChange={onNodesChange}
              handleNodeClick={handleNodeClick}
              handleEdgeClick={handleEdgeClick}
              onPaneClick={onPaneClick}
              onMoveEnd={onMoveEnd}
              startDrag={startDrag}
              finishDrag={finishDrag}
              setSelection={setSelection}
              pendingConnection={pendingConnection}
              setCursor={setCursor}
              loadDemo={loadDemo}
              addNode={addNode}
              inspectedFeature={inspectedFeature}
              setInspectedFeature={setInspectedFeature}
              visibleLayers={visibleLayers}
              toggleLayer={toggleLayer}
              stagedLayers={stagedLayers}
              showIllustrativeDepth={showIllustrativeDepth}
              setShowIllustrativeDepth={setShowIllustrativeDepth}
            />
          </div>

          <ValidationBar
            draft={draft}
            validation={validation}
            issuesOpen={issuesOpen}
            setIssuesOpen={setIssuesOpen}
            allIssues={allIssues}
            focusIssue={focusIssue}
          />
        </div>

        {showInspector && (
          <aside className='stu-shell-inspector stu-sheet' aria-label='Inspector'>
            {narrow && (
              <div className='stu-sheet-bar'>
                <Button
                  size='lg'
                  icon={ChevronUp}
                  aria-expanded={sheetOpen}
                  aria-controls='stu-sheet-body'
                  onClick={() => setSheetOpen((value) => !value)}
                  className={sheetOpen ? 'stu-sheet-toggle is-open' : 'stu-sheet-toggle'}
                >
                  Inspector
                </Button>
              </div>
            )}
            <div id='stu-sheet-body' className='stu-sheet-body' hidden={narrow && !sheetOpen}>
              {inspectorContent}
            </div>
          </aside>
        )}
      </section>

      {notice && <Toast tone='water' message={notice} onDismiss={() => setNotice('')} />}

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title={`Delete ${pendingDelete?.id ?? ''}?`}
        footer={(
          <div className='stu-shell-modal-actions'>
            <Button variant='secondary' onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant='danger' onClick={confirmDelete}>Delete</Button>
          </div>
        )}
      >
        {pendingDelete && (
          <p className='stu-shell-modal-text'>
            {pendingDelete.type === 'node' && pendingDelete.connected.length
              ? `This will also remove ${pendingDelete.connected.length} connected pipe${pendingDelete.connected.length === 1 ? '' : 's'}. Undo can restore the complete topology.`
              : `This ${pendingDelete.type} will be removed from the schematic. Undo can restore it.`}
          </p>
        )}
      </Modal>

      <DataCatalogModal
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        activeLayerIds={activeLayerIds}
        onToggleLayer={toggleCatalogLayer}
        onSelectDataset={() => {}}
      />

      <ImportWizardModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImportStaged={handleImportStaged}
      />
    </main>
  );
}

export default function StudioShell({ initialNetwork, networkSource }) {
  return (
    <ReactFlowProvider>
      <StudioWorkspace initialNetwork={initialNetwork} networkSource={networkSource} />
    </ReactFlowProvider>
  );
}
