import { AlertTriangle, X } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { IconButton } from '../ui/index.js';
import { TIME_SERIES_DATA } from '../lib/realWorldData.js';
import '../styles/studio/dialogs.css';

const AXIS_TICK = { fontSize: 12, fill: 'var(--ink-muted)' };
const AXIS_LINE = { stroke: 'var(--line)' };
const TOOLTIP_STYLE = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  color: 'var(--ink)',
  fontSize: 12,
};
const TOOLTIP_LABEL_STYLE = { color: 'var(--ink)' };

const sentence = (text) => {
  const t = String(text || '').replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export default function FeatureInspectorPanel({ feature, onClose }) {
  if (!feature) return null;

  const { id, assetType, name, properties = {}, provenance = {} } = feature;
  const timeSeries = TIME_SERIES_DATA[id] || null;

  const attrs = [
    properties.diameter_mm != null && ['Diameter', `${properties.diameter_mm} mm`],
    properties.nominal_diameter_mm != null && ['Nominal bore', `${properties.nominal_diameter_mm} mm`],
    properties.length_m != null && ['Length', `${properties.length_m} m`],
    properties.material && ['Material', properties.material],
    properties.valve_type && ['Valve type', properties.valve_type],
    properties.operational_status && ['Operational status', properties.operational_status],
    properties.installation_year && ['Installation', properties.installation_year],
    properties.installed_capacity_mld != null && ['Capacity', `${properties.installed_capacity_mld} MLD`],
    properties.water_level_mbgl != null && ['Water table', `${properties.water_level_mbgl} m bgl`],
    properties.yield_lpm != null && ['Yield', `${properties.yield_lpm} LPM`],
    properties.effluent_bod_mg_l != null && ['Effluent BOD', `${properties.effluent_bod_mg_l} mg/L`],
  ].filter(Boolean);

  const licence =
    provenance.licenseName || properties.licenseName || properties.license_name || 'Not stated';

  return (
    <aside className='stu-feat' aria-label='Feature inspector'>
      <div className='stu-feat__head'>
        <div>
          <h3>{name || id}</h3>
          <span className='stu-feat__type'>{String(assetType || '').replace(/_/g, ' ')}</span>
        </div>
        <IconButton label='Close inspector' icon={X} size='sm' onClick={onClose} />
      </div>

      <dl className='stu-feat__facts'>
        <dt>Source</dt>
        <dd title={provenance.datasetId}>{provenance.datasetId || 'BWSSB Public GIS'}</dd>
        <dt>Licence</dt>
        <dd>{licence}</dd>
        <dt>Data status</dt>
        <dd>{sentence(provenance.dataStatus || 'source_mapped')}</dd>
        <dt>Confidence</dt>
        <dd>{sentence(provenance.confidenceLevel || 'medium')}</dd>
        {provenance.sourceFeatureId && (
          <>
            <dt>Source asset ID</dt>
            <dd className='stu-mono'>{provenance.sourceFeatureId}</dd>
          </>
        )}
      </dl>

      {attrs.length > 0 && (
        <div>
          <h4 className='stu-feat__heading'>Engineering attributes</h4>
          <dl className='stu-feat__facts stu-feat__facts--attrs'>
            {attrs.map(([label, value]) => (
              <div key={label} style={{ display: 'contents' }}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className='stu-feat__note' role='note'>
        <AlertTriangle size={16} aria-hidden='true' />
        <div>
          <b>Underground depth</b>
          <p>
            {properties.depth_label ||
              'Pipe invert depth not provided by utility GIS. Mapped illustratively at -2.5m nominal depth.'}
          </p>
        </div>
      </div>

      {timeSeries && (
        <div>
          <h4 className='stu-feat__heading'>Measured observations and telemetry</h4>

          {assetType === 'groundwater_monitor' && (
            <>
              <div className='stu-feat__chart-label'>
                <span>Depth to water table (m below ground level)</span>
                <b>GW-KA-BNG-KENGERI-01</b>
              </div>
              <ResponsiveContainer width='100%' height={160}>
                <AreaChart data={timeSeries}>
                  <CartesianGrid strokeDasharray='3 3' stroke='var(--line)' />
                  <XAxis dataKey='timestamp' tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={AXIS_LINE} />
                  <YAxis
                    tick={AXIS_TICK}
                    axisLine={AXIS_LINE}
                    tickLine={AXIS_LINE}
                    domain={[40, 48]}
                    reversed
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    formatter={(val) => [`${val} m bgl`, 'Depth']}
                  />
                  <Area
                    type='monotone'
                    dataKey='value'
                    stroke='var(--water)'
                    fill='var(--water)'
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}

          {assetType === 'water_quality_monitor' && (
            <>
              <div className='stu-feat__chart-label'>
                <span>Dissolved oxygen (DO) vs BOD (mg/L)</span>
                <b>Dubasipalya Lake</b>
              </div>
              <ResponsiveContainer width='100%' height={180}>
                <BarChart data={timeSeries}>
                  <CartesianGrid strokeDasharray='3 3' stroke='var(--line)' />
                  <XAxis dataKey='timestamp' tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={AXIS_LINE} />
                  <YAxis tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={AXIS_LINE} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--ink-muted)' }} />
                  <Bar dataKey='do' name='DO (mg/L)' fill='var(--sensor)' />
                  <Bar dataKey='bod' name='BOD (mg/L)' fill='var(--leak)' />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}

          {assetType === 'rain_gauge' && (
            <>
              <div className='stu-feat__chart-label'>
                <span>Monthly precipitation (mm)</span>
                <b>KSNDMC Kengeri</b>
              </div>
              <ResponsiveContainer width='100%' height={160}>
                <BarChart data={timeSeries}>
                  <CartesianGrid strokeDasharray='3 3' stroke='var(--line)' />
                  <XAxis dataKey='month' tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={AXIS_LINE} />
                  <YAxis tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={AXIS_LINE} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                  <Bar dataKey='rainfall_mm' name='Rainfall (mm)' fill='var(--water)' />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
