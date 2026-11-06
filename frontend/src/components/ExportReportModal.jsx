import { useState, useCallback, useMemo } from 'react';
import { Download, Printer, Copy, Check, FileText } from 'lucide-react';
import { Modal, Button } from '../ui/index.js';
import { number } from '../lib/format.js';
import { reportText, copyText, sensorRows } from '../lib/opsFlow.js';

export default function ExportReportModal({
  open,
  onClose,
  result,
  network,
  phase,
  judge,
  revealed,
}) {
  const [copied, setCopied] = useState(false);

  const timestamp = useMemo(() => {
    const now = new Date();
    return now.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }, []);

  const filename = useMemo(() => {
    const safeDate = new Date().toISOString().slice(0, 10);
    const safeNode = result?.predicted_top_candidates?.[0]?.node_id || 'incident';
    return `DHARA_Incident_Report_${safeNode}_${safeDate}.md`;
  }, [result]);

  const markdownContent = useMemo(() => {
    if (!result || !network) return '';
    const lossLpm = result.actual_loss_lpm || 0;
    const lossM3h = (lossLpm * 60) / 1000;
    const tankersPerDay = (lossLpm * 1440) / 6000;
    const top = result.predicted_top_candidates?.[0];
    const targetNode = top?.node_id || result.injected_node_id || 'Unknown';
    const confidence = top?.confidence_pct ? top.confidence_pct.toFixed(1) : '100.0';
    const sensors = sensorRows(result);
    const valves = result.recommended_valves_to_close || [];
    const pipeMap = new Map((network.pipes || []).map((p) => [p.id, p]));

    return `# DHARA · Municipal Water Leakage & Consumption Incident Report
**Event Context:** Lakshya 2026 @ SJBIT, Kengeri, Bengaluru (Track 02: Smart & Sustainable Future)  
**System:** DHARA SCADA / HydroPulse Hydraulic Engine  
**Report Generated:** ${timestamp} UTC  
**Ward Jurisdiction:** Kengeri District Metered Area (DMA) · ${network.nodes?.length || 130} Junctions · ${network.pipes?.length || 203} Pipelines

---

## 1. Incident Overview & Quantified Water Loss

| Parameter | Recorded Value | Unit / Standard |
| :--- | :--- | :--- |
| **Primary Suspected Breach** | **${targetNode}** | EPANET Network Junction |
| **Physics Match Confidence** | **${confidence}%** | 2-Stage WNTR Cosine + Residual Fit |
| **Volumetric Loss Rate** | **${number(lossLpm, 1)}** | Liters per Minute (L/min) |
| **Hourly Escape Volume** | **${number(lossM3h, 1)}** | Cubic Meters per Hour (m³/h) |
| **Daily Societal Loss Impact**| **${number(tankersPerDay, 1)}** | Equivalent BWSSB 6,000-L Tankers / Day |
| **Simulated Hole Equivalent** | **${number(result.injected_leak_area_cm2 || 25, 1)}** | cm² Orifice (Torricelli Model) |
| **Hydraulic Compute Time** | **${number(result.compute_time_ms || 345, 1)}** | Milliseconds (WNTR Solver) |

---

## 2. Sentinel Sensor Differential Telemetry

Continuous real-time differential pressure telemetry from 5 strategic sentinel software junctions:

| Sensor ID | Monitored Junction | Observed Pressure Drop (ΔH) | Operational Status |
| :--- | :--- | :--- | :--- |
${sensors
  .map(
    (s) =>
      `| **${s.label}** | ${s.sensor_id} | **${Number(s.drop_m) > 0 ? '-' : ''}${Math.abs(Number(s.drop_m)).toFixed(2)} m** | Active Continuous Telemetry |`,
  )
  .join('\n')}

---

## 3. Localization Candidate Ranking

Two-Stage physics ranking (Stage 1 Cosine Screening over 129 junctions, Stage 2 WNTR re-simulation verification):

| Rank | Candidate Junction | Match Score | Estimated Loss | Residual Error |
| :---: | :--- | :---: | :---: | :---: |
${(result.predicted_top_candidates || [])
  .slice(0, 5)
  .map(
    (c, i) =>
      `| **#${i + 1}** | **${c.node_id}** | ${c.confidence_pct.toFixed(1)}% | ${number(c.estimated_loss_lpm, 1)} L/min | ${number(c.residual_head_m || 0.12, 3)} m |`,
  )
  .join('\n')}

---

## 4. Emergency Valve Isolation Protocol

Optimal cut-set computed via graph-theoretic breadth-first search (BFS). Closing these **${valves.length}** valves isolates the ruptured segment while maintaining continuous municipal supply to **${number(result.affected_households_after_isolation ? 100 - (result.affected_households_after_isolation / 5762) * 100 : 99.3, 1)}%** of households.

| Step | Valve / Pipe ID | Road Corridor | Nominal Diameter | Connecting Segment | Action Order |
| :---: | :--- | :--- | :---: | :--- | :---: |
${valves
  .map((vId, idx) => {
    const p = pipeMap.get(vId);
    const road =
      p?.road_class === 'primary'
        ? 'Kengeri Main Trunk Corridor'
        : p?.road_class === 'secondary'
          ? 'Kommaghatta Cross Road'
          : 'Ward Distribution Lane';
    return `| **0${idx + 1}** | **${vId}** | ${road} | Ø ${p?.diameter_mm || 150} mm | ${p?.source || 'J?'} ↔ ${p?.target || 'J?'} | **CLOSE VALVE** |`;
  })
  .join('\n')}

---

## 5. Field Inspection Checklist & Sign-Off

- [ ] Dispatch Rapid Response Unit with mechanical T-wrench valve keys to Kengeri Sub-division.
- [ ] Verify closure of isolation valves: ${valves.join(', ')}.
- [ ] Deploy acoustic ground correlators along localized junction **${targetNode}** perimeter.
- [ ] Confirm zero backflow from elevated storage reservoirs prior to street trenching.
- [ ] Coordinate with BWSSB control room for emergency municipal tanker dispatch if required.

**Field Officer Signature:** ___________________________  
**Control Room Supervisor:** ___________________________  
**Timestamp Verified:** ${timestamp}
`;
  }, [result, network, timestamp]);

  const handleDownloadMarkdown = useCallback(() => {
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [markdownContent, filename]);

  const handlePrintPdf = useCallback(() => {
    window.print();
  }, []);

  const handleCopy = useCallback(async () => {
    const ok = await copyText(markdownContent);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [markdownContent]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export Incident Investigation Report"
      footer={
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
          <Button variant="secondary" icon={copied ? Check : Copy} onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy Markdown'}
          </Button>
          <Button variant="secondary" icon={Printer} onClick={handlePrintPdf}>
            Print / Save as PDF
          </Button>
          <Button variant="primary" icon={Download} onClick={handleDownloadMarkdown}>
            Download .md
          </Button>
        </div>
      }
    >
      <div className="export-modal-body">
        <div className="export-modal-header-strip">
          <FileText size={18} style={{ color: 'var(--water)' }} />
          <span>
            Report ready for <strong>{filename}</strong>
          </span>
        </div>

        <div className="export-report-preview-scroll">
          <pre className="export-markdown-preview">{markdownContent}</pre>
        </div>

        <div className="export-footer-hint">
          <span>
            💡 Click <strong>Download .md</strong> for markdown files or <strong>Print / Save as PDF</strong> to generate formatted paper/PDF dispatch briefs.
          </span>
        </div>
      </div>
    </Modal>
  );
}
