/**
 * HydroPulse UI Primitives Preview
 * Dev-only preview of all primitives in both themes
 * Rendered when ?ui=1 query param is present
 */

import { useState } from 'react';
import {
  Button,
  IconButton,
  SegmentedControl,
  Field,
  Slider,
  Select,
  Checkbox,
  Switch,
  Kbd,
  DataSourceBadge,
  DraftStatus,
  StagedBadge,
  StatusDot,
  Panel,
  Drawer,
  Modal,
  Toast,
  Tabs,
  DataTable,
  EmptyState,
  MapLegend,
  MapControlStack,
} from './index.js';
import { Play, Trash2, Settings, X, Layers, Map, Maximize2, Save, AlertTriangle, Disc, Wifi, WifiOff } from 'lucide-react';

export default function Preview() {
  const [sliderValue, setSliderValue] = useState(50);
  const [selectValue, setSelectValue] = useState('option1');
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [switchChecked, setSwitchChecked] = useState(false);
  const [segmentedValue, setSegmentedValue] = useState('option1');
  const [tabValue, setTabValue] = useState('tab1');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);

  const selectOptions = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  const segmentedOptions = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  const tabs = [
    { id: 'tab1', label: 'Tab 1', content: <div>Content for Tab 1</div> },
    { id: 'tab2', label: 'Tab 2', content: <div>Content for Tab 2</div> },
    { id: 'tab3', label: 'Tab 3', content: <div>Content for Tab 3</div> },
  ];

  const dataTableColumns = [
    { key: 'id', label: 'ID', align: 'left', render: (v) => <code>{v}</code> },
    { key: 'name', label: 'Name', align: 'left' },
    { key: 'value', label: 'Value', align: 'right' },
  ];

  const dataTableRows = [
    { id: 'J12', name: 'Junction 12', value: 42.5 },
    { id: 'J15', name: 'Junction 15', value: 38.2 },
    { id: 'J23', name: 'Junction 23', value: 45.1 },
  ];

  const mapLegendItems = [
    { key: 'pipe', label: 'Pipe', swatch: 'pipe' },
    { key: 'sensor', label: 'Sensor', swatch: 'sensor' },
    { key: 'leak', label: 'Leak', swatch: 'leak' },
    { key: 'valve', label: 'Valve', swatch: 'valve' },
  ];

  const ThemePreview = ({ theme }) => (
    <div data-theme={theme} className="preview__theme">
      <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>
        {theme === 'night' ? 'Night Theme' : 'Day Theme'}
      </h3>

      <div className="preview__section">
        <h4 className="preview__section-title">Buttons</h4>
        <div className="preview__row">
          <Button variant="primary">Primary</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" busy>
            Busy
          </Button>
          <Button variant="primary" icon={Play} kbd="Space">
            With Icon
          </Button>
        </div>
        <div className="preview__row" style={{ marginTop: '8px' }}>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </div>

      <div className="preview__section">
        <h4 className="preview__section-title">Icon Buttons</h4>
        <div className="preview__row">
          <IconButton label="Settings" icon={Settings} />
          <IconButton label="Delete" icon={Trash2} />
          <IconButton label="Close" icon={X} pressed />
          <IconButton label="Play" icon={Play} size="sm" />
          <IconButton label="Pause" icon={Settings} size="lg" />
        </div>
      </div>

      <div className="preview__section">
        <h4 className="preview__section-title">Segmented Control</h4>
        <SegmentedControl
          options={segmentedOptions}
          value={segmentedValue}
          onChange={setSegmentedValue}
        />
      </div>

      <div className="preview__section">
        <h4 className="preview__section-title">Form Controls</h4>
        <Field label="Select Field" hint="Choose an option">
          <Select id="preview-select" options={selectOptions} value={selectValue} onChange={setSelectValue} />
        </Field>
        <div style={{ marginTop: '16px' }}>
          <Slider
            id="preview-slider"
            label="Slider"
            value={sliderValue}
            min={0}
            max={100}
            step={1}
            unit="cm²"
            onChange={setSliderValue}
          />
        </div>
        <div style={{ marginTop: '16px' }}>
          <Checkbox id="preview-checkbox" checked={checkboxChecked} onChange={setCheckboxChecked} label="Checkbox option" />
        </div>
        <div style={{ marginTop: '16px' }}>
          <Switch checked={switchChecked} onChange={setSwitchChecked} label="Switch toggle" />
        </div>
        <div style={{ marginTop: '16px' }}>
          <Kbd>Space</Kbd> <Kbd>Ctrl</Kbd> <Kbd>S</Kbd>
        </div>
      </div>

      <div className="preview__section">
        <h4 className="preview__section-title">Badges & Status</h4>
        <div className="preview__row">
          <DataSourceBadge mode="live" health={{ network_revision: 'rev-1' }} />
          <DataSourceBadge mode="mock" networkSource="recorded" />
          <DataSourceBadge mode="offline" networkSource="live" />
          <DataSourceBadge mode="loading" />
        </div>
        <div className="preview__row" style={{ marginTop: '8px' }}>
          <DraftStatus dirty />
          <DraftStatus savedAt={new Date()} />
          <StagedBadge />
        </div>
        <div className="preview__row" style={{ marginTop: '8px' }}>
          <StatusDot tone="sensor" />
          <StatusDot tone="leak" />
          <StatusDot tone="valve" />
          <StatusDot tone="water" />
        </div>
      </div>

      <div className="preview__section">
        <h4 className="preview__section-title">Panel</h4>
        <Panel title="Panel Title" actions={<Button size="sm">Action</Button>}>
          <p>Panel content goes here.</p>
        </Panel>
      </div>

      <div className="preview__section">
        <h4 className="preview__section-title">Drawer & Modal</h4>
        <div className="preview__row">
          <Button onClick={() => setDrawerOpen(true)}>Open Drawer</Button>
          <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
          <Button onClick={() => setToastOpen(true)}>Show Toast</Button>
        </div>
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Drawer Title">
          <p>Drawer content goes here.</p>
        </Drawer>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Modal Title" footer={<Button onClick={() => setModalOpen(false)}>Close</Button>}>
          <p>Modal content goes here.</p>
        </Modal>
        {toastOpen && (
          <Toast tone="water" message="Toast message" onDismiss={() => setToastOpen(false)} />
        )}
      </div>

      <div className="preview__section">
        <h4 className="preview__section-title">Tabs</h4>
        <Tabs tabs={tabs} value={tabValue} onChange={setTabValue} />
      </div>

      <div className="preview__section">
        <h4 className="preview__section-title">Data Table</h4>
        <DataTable
          columns={dataTableColumns}
          rows={dataTableRows}
          rowKey="id"
          caption="Sample data table"
        />
      </div>

      <div className="preview__section">
        <h4 className="preview__section-title">Empty State</h4>
        <EmptyState
          icon={Disc}
          title="No Data"
          body="There is no data to display at this time."
          actions={<Button>Action</Button>}
        />
      </div>

      <div className="preview__section">
        <h4 className="preview__section-title">Map Legend</h4>
        <MapLegend items={mapLegendItems} />
      </div>

      <div className="preview__section">
        <h4 className="preview__section-title">Map Control Stack</h4>
        <MapControlStack>
          <IconButton label="Layers" icon={Layers} />
          <IconButton label="Map" icon={Map} />
          <IconButton label="Fullscreen" icon={Maximize2} />
        </MapControlStack>
      </div>
    </div>
  );

  return (
    <div className="preview">
      <h1 style={{ fontSize: '28px', fontWeight: 600, marginBottom: '24px' }}>
        HydroPulse UI Primitives Preview
      </h1>
      <div className="preview__themes">
        <ThemePreview theme="night" />
        <ThemePreview theme="day" />
      </div>
    </div>
  );
}
