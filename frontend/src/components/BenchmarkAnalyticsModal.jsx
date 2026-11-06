import { useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Target,
  Upload,
} from 'lucide-react';
import { Button, Modal } from '../ui/index.js';
import { getTokenValue, useTheme } from '../ui/useTheme.js';
import { DEFAULT_BENCHMARK_ROWS, parseBenchmarkCsv } from '../lib/realWorldData.js';
import '../styles/studio/dialogs.css';
import '../styles/ops/charts_roi.css';

const FONT_MONO = 'IBM Plex Mono, monospace';

export default function BenchmarkAnalyticsModal({
  open,
  onClose,
  initialData,
}) {
  const { theme } = useTheme();
  const fileInputRef = useRef(null);

  const [customData, setCustomData] = useState(null);
  const [metricTab, setMetricTab] = useState('accuracy'); // 'accuracy' | 'error' | 'latency'
  const [uploadNotice, setUploadNotice] = useState('');

  // Active dataset
  const activeDataset = useMemo(() => {
    if (customData) return customData;
    if (initialData?.rows?.length) return initialData;
    return {
      sourceName: 'Repository Baseline (benchmark_report.md)',
      rows: DEFAULT_BENCHMARK_ROWS,
    };
  }, [customData, initialData]);

  const isCustom = Boolean(
    customData || initialData?.isCustom || (initialData?.sourceName && !initialData.sourceName.includes('benchmark_report.md'))
  );

  const rows = activeDataset.rows || DEFAULT_BENCHMARK_ROWS;

  // Chart colors derived from theme tokens
  const colors = useMemo(
    () => ({
      water: getTokenValue('--water', '#00b4d8'),
      accent: getTokenValue('--accent-cyan', '#00e5ff'),
      success: getTokenValue('--success', '#10b981'),
      warn: getTokenValue('--warning', '#f59e0b'),
      danger: getTokenValue('--danger', '#ef4444'),
      textDim: getTokenValue('--text-dim', '#64748b'),
      text: getTokenValue('--text', '#f8fafc'),
      line: getTokenValue('--line', '#334155'),
      surface: getTokenValue('--surface-raised', '#1e293b'),
    }),
    [theme],
  );

  // Group rows by noise level for side-by-side strategy comparisons
  const chartData = useMemo(() => {
    const byNoise = {};
    rows.forEach((r) => {
      const n = r.noise_pct;
      if (!byNoise[n]) {
        byNoise[n] = { noise: `${n}%`, noise_val: n };
      }
      const isSep = r.strategy.includes('separated');
      const prefix = isSep ? 'sep' : 'top';
      byNoise[n][`${prefix}_top1`] = r.top1_pct;
      byNoise[n][`${prefix}_top3`] = r.top3_pct;
      byNoise[n][`${prefix}_median_err`] = r.median_err_m;
      byNoise[n][`${prefix}_mean_err`] = r.mean_err_m;
      byNoise[n][`${prefix}_p90_err`] = r.p90_err_m;
      byNoise[n][`${prefix}_p50_ms`] = r.p50_latency_ms;
      byNoise[n][`${prefix}_p95_ms`] = r.p95_latency_ms;
    });

    return Object.values(byNoise).sort((a, b) => a.noise_val - b.noise_val);
  }, [rows]);

  // Key stats at nominal 1.5% noise
  const stats15 = useMemo(() => {
    const sep = rows.find((r) => r.strategy.includes('separated') && r.noise_pct === 1.5);
    const top = rows.find((r) => !r.strategy.includes('separated') && r.noise_pct === 1.5);
    return { sep, top };
  }, [rows]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseBenchmarkCsv(text);
      if (parsed?.rows?.length) {
        setCustomData({
          sourceName: file.name,
          rows: parsed.rows,
        });
        setUploadNotice(`Loaded ${parsed.rows.length} rows from ${file.name}`);
      } else {
        setUploadNotice('Could not parse benchmark rows from this CSV.');
      }
    } catch (err) {
      setUploadNotice(`Failed to parse CSV: ${err.message}`);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'sensor_strategy',
      'sensors',
      'noise_pct',
      'top1_pct',
      'top3_pct',
      'mean_err_m',
      'median_err_m',
      'p90_err_m',
      'p50_latency_ms',
      'p95_latency_ms',
    ];
    const csvLines = [headers.join(',')];
    rows.forEach((r) => {
      csvLines.push(
        [
          r.strategy,
          `"${r.sensors}"`,
          r.noise_pct,
          r.top1_pct,
          r.top3_pct,
          r.mean_err_m,
          r.median_err_m,
          r.p90_err_m,
          r.p50_latency_ms,
          r.p95_latency_ms,
        ].join(','),
      );
    });
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DHARA_Benchmark_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetToBaseline = () => {
    setCustomData(null);
    setUploadNotice('Reset to official repository baseline benchmark.');
  };

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
        <Button
          variant="secondary"
          size="sm"
          icon={Upload}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload benchmark CSV
        </Button>
        {isCustom && (
          <Button variant="ghost" size="sm" onClick={resetToBaseline}>
            Restore baseline
          </Button>
        )}
        <Button variant="ghost" size="sm" icon={Download} onClick={handleExportCsv}>
          Export CSV
        </Button>
      </div>
      <Button variant="primary" onClick={onClose}>
        Done
      </Button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Accuracy & Benchmark Analytics"
      footer={footer}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '72vh', overflowY: 'auto', paddingRight: '4px' }}>
        {/* Source banner */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          background: 'var(--surface-raised, #1e293b)',
          borderRadius: 'var(--radius-md, 8px)',
          border: '1px solid var(--line, #334155)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet size={18} style={{ color: 'var(--water, #00b4d8)' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{activeDataset.sourceName || 'Repository Benchmark'}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim, #94a3b8)' }}>
                Rigorous WNTR hydraulic sensitivity matrix benchmark across 80 randomized leak trials per condition.
              </div>
            </div>
          </div>
          <span style={{
            fontSize: '11px',
            fontFamily: FONT_MONO,
            padding: '3px 8px',
            borderRadius: '999px',
            background: isCustom ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 180, 216, 0.15)',
            color: isCustom ? 'var(--success, #10b981)' : 'var(--water, #00b4d8)',
            border: '1px solid currentColor',
          }}>
            {isCustom ? 'CUSTOM CSV' : 'VERIFIED BASELINE'}
          </span>
        </div>

        {uploadNotice && (
          <div style={{
            padding: '8px 12px',
            fontSize: '12px',
            borderRadius: '6px',
            background: 'rgba(0, 180, 216, 0.1)',
            color: 'var(--text, #f8fafc)',
            border: '1px solid var(--line, #334155)',
          }}>
            {uploadNotice}
          </div>
        )}

        {/* 4 Key Stat Cards at 1.5% Noise (Pitch/Judge Reference) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--surface, #0f172a)',
            border: '1px solid var(--line, #334155)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-dim, #94a3b8)' }}>
              <Target size={14} style={{ color: 'var(--water, #00b4d8)' }} />
              Top-1 Accuracy (1.5% noise)
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: FONT_MONO, color: 'var(--water, #00b4d8)', marginTop: '4px' }}>
              {stats15.sep?.top1_pct ?? 51.2}%
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim, #94a3b8)', marginTop: '2px' }}>
              vs {stats15.top?.top1_pct ?? 20.0}% (plain top-betweenness)
            </div>
          </div>

          <div style={{
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--surface, #0f172a)',
            border: '1px solid var(--line, #334155)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-dim, #94a3b8)' }}>
              <CheckCircle2 size={14} style={{ color: 'var(--success, #10b981)' }} />
              Top-3 Accuracy (1.5% noise)
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: FONT_MONO, color: 'var(--success, #10b981)', marginTop: '4px' }}>
              {stats15.sep?.top3_pct ?? 85.0}%
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim, #94a3b8)', marginTop: '2px' }}>
              True burst in top 3 ranked nodes
            </div>
          </div>

          <div style={{
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--surface, #0f172a)',
            border: '1px solid var(--line, #334155)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-dim, #94a3b8)' }}>
              <Activity size={14} style={{ color: 'var(--warning, #f59e0b)' }} />
              Median Error Distance
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: FONT_MONO, color: 'var(--warning, #f59e0b)', marginTop: '4px' }}>
              {stats15.sep?.median_err_m ?? 0.0} m
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim, #94a3b8)', marginTop: '2px' }}>
              P90 error: {stats15.sep?.p90_err_m ?? 226.5} m
            </div>
          </div>

          <div style={{
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--surface, #0f172a)',
            border: '1px solid var(--line, #334155)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-dim, #94a3b8)' }}>
              <Clock size={14} style={{ color: 'var(--accent-cyan, #00e5ff)' }} />
              P95 Latency
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: FONT_MONO, color: 'var(--accent-cyan, #00e5ff)', marginTop: '4px' }}>
              {stats15.sep?.p95_latency_ms ?? 493} ms
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim, #94a3b8)', marginTop: '2px' }}>
              P50 median: {stats15.sep?.p50_latency_ms ?? 297} ms
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--line, #334155)', paddingBottom: '8px' }}>
          <button
            type="button"
            className={`ops-tab-btn ${metricTab === 'accuracy' ? 'ops-tab-btn--active' : ''}`}
            onClick={() => setMetricTab('accuracy')}
          >
            Accuracy vs Sensor Noise
          </button>
          <button
            type="button"
            className={`ops-tab-btn ${metricTab === 'error' ? 'ops-tab-btn--active' : ''}`}
            onClick={() => setMetricTab('error')}
          >
            Localization Error Distance (m)
          </button>
          <button
            type="button"
            className={`ops-tab-btn ${metricTab === 'latency' ? 'ops-tab-btn--active' : ''}`}
            onClick={() => setMetricTab('latency')}
          >
            Computation Latency (ms)
          </button>
        </div>

        {/* Chart View */}
        <div style={{ height: '240px', width: '100%', background: 'var(--surface, #0f172a)', borderRadius: '8px', padding: '12px', border: '1px solid var(--line, #334155)' }}>
          <ResponsiveContainer width="100%" height="100%">
            {metricTab === 'accuracy' ? (
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid stroke={colors.line} strokeDasharray="3 3" />
                <XAxis dataKey="noise" stroke={colors.textDim} tick={{ fill: colors.textDim, fontSize: 11 }} />
                <YAxis stroke={colors.textDim} tick={{ fill: colors.textDim, fontSize: 11 }} domain={[0, 105]} unit="%" />
                <Tooltip
                  contentStyle={{ background: colors.surface, borderColor: colors.line, color: colors.text, fontSize: 12 }}
                  formatter={(val) => [`${val}%`]}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <Line type="monotone" dataKey="sep_top1" name="Separated Sentinels Top-1 %" stroke={colors.water} strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="sep_top3" name="Separated Sentinels Top-3 %" stroke={colors.success} strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="top_top1" name="Plain Betweenness Top-1 %" stroke={colors.warn} strokeDasharray="4 4" strokeWidth={1.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="top_top3" name="Plain Betweenness Top-3 %" stroke={colors.textDim} strokeDasharray="4 4" strokeWidth={1.5} dot={{ r: 3 }} />
              </LineChart>
            ) : metricTab === 'error' ? (
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid stroke={colors.line} strokeDasharray="3 3" />
                <XAxis dataKey="noise" stroke={colors.textDim} tick={{ fill: colors.textDim, fontSize: 11 }} />
                <YAxis stroke={colors.textDim} tick={{ fill: colors.textDim, fontSize: 11 }} unit=" m" />
                <Tooltip
                  contentStyle={{ background: colors.surface, borderColor: colors.line, color: colors.text, fontSize: 12 }}
                  formatter={(val) => [`${val} m`]}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <Line type="monotone" dataKey="sep_median_err" name="Separated Median Error (m)" stroke={colors.success} strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="sep_mean_err" name="Separated Mean Error (m)" stroke={colors.water} strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="sep_p90_err" name="Separated P90 Error (m)" stroke={colors.warn} strokeWidth={1.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="top_median_err" name="Plain Betweenness Median (m)" stroke={colors.danger} strokeDasharray="4 4" strokeWidth={1.5} dot={{ r: 3 }} />
              </LineChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid stroke={colors.line} strokeDasharray="3 3" />
                <XAxis dataKey="noise" stroke={colors.textDim} tick={{ fill: colors.textDim, fontSize: 11 }} />
                <YAxis stroke={colors.textDim} tick={{ fill: colors.textDim, fontSize: 11 }} unit=" ms" />
                <Tooltip
                  contentStyle={{ background: colors.surface, borderColor: colors.line, color: colors.text, fontSize: 12 }}
                  formatter={(val) => [`${val} ms`]}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <Line type="monotone" dataKey="sep_p50_ms" name="Separated P50 Latency (ms)" stroke={colors.accent} strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="sep_p95_ms" name="Separated P95 Latency (ms)" stroke={colors.water} strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="top_p50_ms" name="Plain Betweenness P50 (ms)" stroke={colors.textDim} strokeDasharray="4 4" strokeWidth={1.5} dot={{ r: 3 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Tabular Details */}
        <div style={{ overflowX: 'auto', border: '1px solid var(--line, #334155)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--surface-raised, #1e293b)', color: 'var(--text-dim, #94a3b8)', borderBottom: '1px solid var(--line, #334155)' }}>
                <th style={{ padding: '8px 10px' }}>Strategy</th>
                <th style={{ padding: '8px 10px' }}>Sensors</th>
                <th style={{ padding: '8px 10px' }}>Noise %</th>
                <th style={{ padding: '8px 10px' }}>Top-1 %</th>
                <th style={{ padding: '8px 10px' }}>Top-3 %</th>
                <th style={{ padding: '8px 10px' }}>Mean Err (m)</th>
                <th style={{ padding: '8px 10px' }}>Median Err (m)</th>
                <th style={{ padding: '8px 10px' }}>P90 Err (m)</th>
                <th style={{ padding: '8px 10px' }}>P50 (ms)</th>
                <th style={{ padding: '8px 10px' }}>P95 (ms)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isNominal = r.noise_pct === 1.5 && r.strategy.includes('separated');
                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid var(--line, #1e293b)',
                      background: isNominal ? 'rgba(0, 180, 216, 0.08)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '7px 10px', fontWeight: isNominal ? 600 : 400 }}>{r.strategy}</td>
                    <td style={{ padding: '7px 10px', fontFamily: FONT_MONO }}>{r.sensors || '—'}</td>
                    <td style={{ padding: '7px 10px', fontFamily: FONT_MONO }}>{r.noise_pct}%</td>
                    <td style={{ padding: '7px 10px', fontFamily: FONT_MONO, color: 'var(--water, #00b4d8)', fontWeight: 600 }}>{r.top1_pct}%</td>
                    <td style={{ padding: '7px 10px', fontFamily: FONT_MONO, color: 'var(--success, #10b981)' }}>{r.top3_pct}%</td>
                    <td style={{ padding: '7px 10px', fontFamily: FONT_MONO }}>{r.mean_err_m}</td>
                    <td style={{ padding: '7px 10px', fontFamily: FONT_MONO }}>{r.median_err_m}</td>
                    <td style={{ padding: '7px 10px', fontFamily: FONT_MONO }}>{r.p90_err_m}</td>
                    <td style={{ padding: '7px 10px', fontFamily: FONT_MONO }}>{r.p50_latency_ms}</td>
                    <td style={{ padding: '7px 10px', fontFamily: FONT_MONO }}>{r.p95_latency_ms}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
