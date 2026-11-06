# DHARA / HydroPulse: Demo-Day Run of Show & Stage Playbook

**Event:** Lakshya 2026 @ SJBIT, Bengaluru · **Track 02:** Smart and Sustainable Future  
**Brand:** DHARA — Smart Water Leakage & Consumption Tracker (System Identifier: HydroPulse)  
**Team:** Hardhik (Backend & Hydraulics Lead), Gangu (Pipeline/DevOps), Badri (Frontend/UI), Jasmine (Pitch/ROI)

---

## 1. Quick One-Command Startup (Arch Linux)

To boot the entire full-stack live demo with hydraulic matrix verification:

```bash
make demo
```

To run in forced offline mode (using recorded API snapshots):
```bash
make demo-offline
```

To reset the demo state between presentations without restarting services:
```bash
make demo-reset
```

To stop all services cleanly:
```bash
make stop
```

---

## 2. Stage Roles & Responsibilities

| Team Member | Role on Stage | Active Responsibilities |
| :--- | :--- | :--- |
| **Jasmine** | Speaker 1 (The Hook & Story) | Delivers slide deck, problem hook, business/BWSSB economics, ROI defense. |
| **Hardhik** | Speaker 2 (Engineering & Physics) | Explains EPANET PDD model, Torricelli orifice equation, cosine triangulation, stage-2 re-simulation. Answers technical questions from judges. |
| **Badri** | Driver / Operator | Operates the SCADA dashboard on projector: runs presets, triggers valve isolation, highlights telemetry. |
| **Gangu** | Flight Controller / Tech Insurance | Manages terminal runs, verifies offline caches, keeps hot-backup laptop ready with mock mode switch if network drops. |

---

## 3. Pre-Pitch Stage Checklist (T-15 Minutes)

- [ ] **Power Adapter:** Laptop plugged into AC mains; power mode set to "High Performance".
- [ ] **Display Setup:** Resolution set to 1920×1080 (or 1366×768 on venue projectors). Display mode set to **Duplicate / Mirror**.
- [ ] **Browser Window:** Browser zoom level set to **100%** (Ctrl + 0). Press F11 for full-screen presentation mode.
- [ ] **Distraction Shield:** Turn ON "Do Not Disturb" / Focus Assist. Close Slack, Discord, WhatsApp, email, and IDE notifications.
- [ ] **Wi-Fi Independence:** Turn Airplane mode ON to prove zero cloud reliance. Verify backend boots from local `bangalore_kengeri.inp` and cached `sensitivity_matrix.npy`.
- [ ] **Volume / Sound:** System audio muted.

---

## 4. Live Pitch Run-of-Show Script (5-Minute Hackathon Format)

- **0:00 – 1:30 (Jasmine): The Problem & Value Proposition**
  - Open on the problem: Municipal water distribution in Indian metros (like BWSSB in Bengaluru) loses 35–40% of treated water as Non-Revenue Water (NRW).
  - Underground pipe bursts buried 1.5–2.5 m under roads go unnoticed for days until roads cave in.
  - The solution: **DHARA** — a software-only hydraulic digital twin that converts OpenStreetMap road topology into a WNTR PDD hydraulic network, using just **5 sentinel pressure-monitoring junctions** to pinpoint leaks in under a second.

- **1:30 – 3:30 (Hardhik & Badri): The Live Demonstration**
  - Switch to SCADA dashboard (`http://localhost:5173`).
  - *Action 1:* Badri clicks **START DHARA DEMO** on the left panel (or picks Kengeri Mainline Rupture).
  - *Visual 1:* Real-time pressure drop observed on Sentinel Sensors S1–S5. Max drop sensor highlighted.
  - *Visual 2:* 2-stage verification: cosine similarity candidate ranking followed by physical orifice re-simulation. Top candidate junction, confidence badge, and probability heatmap rendered on Leaflet map.
  - *Visual 3:* Incident card displays loss in L/min and equivalent 6,000-L BWSSB tankers per day.
  - *Action 2:* Badri clicks **3. Shut the valves** (`I` key).
  - *Visual 4:* Recommended isolation valves highlighted on map; affected households and preserved network zones computed.
  - *Action 3:* Badri clicks **Reset** (`R` key) and shows instant return to normal baseline state.

- **3:30 – 4:30 (Jasmine): ROI & Municipal Economics**
  - Scalability: explain the 5-sentinel graph betweenness centrality design (software monitoring junctions that map to existing municipal loggers).
  - BWSSB impact: saving millions in treated water and avoiding disruptive road excavations.

- **4:30 – 5:00 (Team): Conclusion & Q&A Defense**
  - Hardhik defends Torricelli equation, PDD pressure exponent $P_{\text{exp}} = 0.5$, and WNTR simulation physics.
  - Badri and Gangu stand by for code and contract inspection.
