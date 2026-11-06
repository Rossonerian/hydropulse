import { useEffect } from 'react';
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import {
  FileUp,
  MousePointer2,
  Sparkles,
  Waves,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { nodeTypes, NODE_TYPES } from './nodes.jsx';
import { edgeTypes } from './edges.jsx';
import { Button, IconButton } from '../../ui/index.js';
import '../../styles/studio/canvas.css';
import GeographicMapCanvas from '../../components/GeographicMapCanvas.jsx';

function FlowViewport({ draft, viewVersion }) {
  const flow = useReactFlow();
  useEffect(() => {
    flow.setViewport(draft.editor_layout.viewport || { x: 0, y: 0, zoom: 1 }, { duration: 0 });
  }, [flow, draft.project.id, viewVersion]);
  return null;
}

export default function SchematicCanvas({
  draft,
  viewVersion,
  viewMode,
  tool,
  placeHint,
  flowNodes,
  edges,
  onNodesChange,
  handleNodeClick,
  handleEdgeClick,
  onPaneClick,
  onMoveEnd,
  startDrag,
  finishDrag,
  setSelection,
  pendingConnection,
  setCursor,
  loadDemo,
  addNode,
  addPipe,
  autoLayout,
  setPendingConnection,
  updateField,
  inspectedFeature,
  setInspectedFeature,
  visibleLayers,
  toggleLayer,
  stagedLayers,
  onImport,
  readOnly = false,
}) {
  const flow = useReactFlow();
  return (
    <section className={`stu-canvas ${tool === 'pipe' ? 'stu-canvas--pipe' : ''} ${NODE_TYPES.includes(tool) ? 'stu-canvas--place' : ''}`}>
      {viewMode === 'schematic' ? (
        <>
          <div className='stu-canvas__top'>
            <span className='stu-canvas__label'>Schematic drawing, not to scale</span>
            <div className='stu-canvas__zoom'>
              <IconButton icon={ZoomOut} label='Zoom out' size='sm' onClick={() => flow.zoomOut({ duration: 160 })} />
              <span className='stu-canvas__pct'>{Math.round((draft.editor_layout.viewport.zoom || 1) * 100)}%</span>
              <IconButton icon={ZoomIn} label='Zoom in' size='sm' onClick={() => flow.zoomIn({ duration: 160 })} />
              <Button size='sm' onClick={() => flow.fitView({ padding: 0.18, duration: 300 })}>Fit</Button>
              {autoLayout && (
                <Button
                  size='sm'
                  variant='secondary'
                  icon={Sparkles}
                  onClick={() => {
                    autoLayout();
                    setTimeout(() => flow.fitView({ padding: 0.18, duration: 400 }), 60);
                  }}
                  title='Auto-organize schematic into clean hierarchical topology'
                >
                  Clean Layout
                </Button>
              )}
            </div>
          </div>
          <div className='stu-canvas__flow'>
            {draft.network.nodes.length === 0 && (
              <div className='stu-canvas__empty'>
                <h2>Start with the Kengeri sample</h2>
                <p>Drafts save in this browser only. The drawing positions are separate from real map coordinates.</p>
                <div className='stu-canvas__empty-actions'>
                  <Button variant='primary' icon={Waves} onClick={loadDemo}>Load Kengeri sample</Button>
                  {!readOnly && (
                    <Button icon={FileUp} onClick={onImport}>Import your own file</Button>
                  )}
                </div>
              </div>
            )}
            <ReactFlow
              nodes={flowNodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={(changes) => {
                changes.forEach((change) => {
                  if (change.type === 'select') setSelection(change.selected ? { type: 'pipe', id: change.id } : null);
                });
              }}
              onNodeClick={handleNodeClick}
              onNodeDragStart={startDrag}
              onNodeDragStop={finishDrag}
              onEdgeClick={handleEdgeClick}
              onPaneClick={onPaneClick}
              onPaneMouseMove={(event) => {
                if (pendingConnection) setCursor(flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
              }}
              onMoveEnd={onMoveEnd}
              onSelectionChange={({ nodes: selectedNodes, edges: selectedEdges }) => {
                if (selectedNodes.length) setSelection({ type: 'node', id: selectedNodes.at(-1).id });
                else if (selectedEdges.length) setSelection({ type: 'pipe', id: selectedEdges.at(-1).id });
                else setSelection(null);
              }}
              onPaneContextMenu={(event) => event.preventDefault()}
              fitView={false}
              defaultViewport={draft.editor_layout.viewport}
              minZoom={0.25}
              maxZoom={2}
              nodesDraggable={tool === 'select'}
              nodesConnectable={false}
              edgesReconnectable={false}
              elementsSelectable={tool === 'select' || tool === 'delete'}
              panOnDrag
              selectionOnDrag={false}
              deleteKeyCode={null}
              snapToGrid
              snapGrid={[20, 20]}
              onError={(code, message) => console.error('[RF ERROR]', code, message)}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1.15} color='var(--line)' />
              <MiniMap
                nodeStrokeWidth={2}
                zoomable
                pannable
                ariaLabel="Schematic overview minimap"
              />
              <FlowViewport draft={draft} viewVersion={viewVersion} />
            </ReactFlow>
            <div className='stu-canvas__hint'><MousePointer2 size={13} />{placeHint}</div>
          </div>
        </>
      ) : (
        <GeographicMapCanvas
          draft={draft}
          tool={tool}
          addNode={addNode}
          addPipe={addPipe}
          setSelection={setSelection}
          updateField={updateField}
          pendingConnection={pendingConnection}
          setPendingConnection={setPendingConnection}
          selectedFeature={inspectedFeature}
          onSelectFeature={(feat) => setInspectedFeature(feat)}
          visibleLayers={visibleLayers}
          onToggleLayer={toggleLayer}
          stagedLayers={stagedLayers}
        />
      )}
    </section>
  );
}
