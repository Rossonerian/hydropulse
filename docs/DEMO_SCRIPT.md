# DHARA / HydroPulse — Live Demonstration Script & Narrative

**Event:** Lakshya 2026 @ SJBIT, Bengaluru · **Track 02:** Smart & Sustainable Future  
**Project:** DHARA — Smart Water Leakage & Consumption Tracker

---

## 1. Setup & Launch (Terminal Commands)

From the repository root on Arch Linux:
```bash
make demo
```

1. **Wait for Console Confirmation**:
   ```
   ✓ Hydraulic engine & sensitivity matrix READY on port 8000!
   Dashboard: http://localhost:5173
   ```
2. **Open Browser**: `http://localhost:5173`
3. If the Welcome Screen appears, click **"Explore the demo"**.

---

## 2. Step-by-Step Demonstration Actions

### Step 1: Initial Baseline Network Inspection
- **Speaker**: "What you see on the screen is **DHARA**, our hydraulic digital twin for the Kengeri District Metered Area (DMA) in South Bengaluru."
- **Visual**:
  - Top bar shows: `DHARA · Smart Water Leakage & Consumption Tracker · Kengeri DMA`
  - Status badge: `LIVE API` (green indicator dot)
  - Network overview: `5 sentinels · 130 nodes, 203 pipes`
  - All 5 sentinel markers ($S_1 \dots S_5$) are healthy green circles.
- **Key Technical Note for Judges**: "Notice we only monitor **5 junctions** out of 130. We selected these 5 junctions using graph betweenness centrality with a minimum 3-hop separation constraint, ensuring our sensors cover the hydraulic core without redundant clustering."

### Step 2: One-Click Live Simulation
- **Action**: Click the prominent blue **START DHARA DEMO** button.
- **Speaker**: "We now simulate a major burst on the Kengeri mainline corridor—a 45 cm² pipe rupture under realistic pressure-driven demand and Torricelli orifice physics."
- **Visual**:
  - Scanning indicator animates: `"Checking the sensors…"`
  - Sensor pressure drops ($S_1 \dots S_5$) update instantly in the bottom and incident panels.
  - Max pressure drop sensor ($S_1$ / $S_3$) pulses red.

### Step 3: Two-Stage Triangulation & Localization
- **Speaker**: "In under 350 milliseconds, DHARA executes our two-stage localization:
  1. **Stage 1 (Cosine Similarity)**: Matches the 5-drop fingerprint against our precomputed hydraulic sensitivity matrix.
  2. **Stage 2 (Physics Verification)**: Re-simulates the top 5 candidates at their estimated hole size to rank by actual pressure residuals."
- **Visual**:
  - Map displays the red pinpoint marker at the leaking junction.
  - The probability heatmap highlights the affected pressure zone ($0 \dots 1$).
  - Result figures:
    - **Estimated loss**: $\approx 4,600\text{ L/min}$
    - **Tanker equivalents**: $\approx 1,100\text{ BWSSB 6,000-L tankers per day}$
    - **Localization error**: Displayed accurately in metres from the true injected node.

### Step 4: Valve Isolation Recommendation
- **Action**: Click **"3. Shut the valves"** (or press keyboard shortcut `I`).
- **Speaker**: "Finding the burst is only half the battle. DHARA computes an optimal graph cut to isolate the burst while keeping the maximum number of homes supplied."
- **Visual**:
  - Recommended isolation valves ($P_{14}$, $P_{19}$, etc.) are highlighted in amber on the map.
  - The isolated node zone is marked.
  - Incident panel shows: *"42 homes temporarily unsupplied; 98.4% of DMA remains under full pressure."*
  - Clear disclaimer: *Simulation recommendation for municipal crew confirmation; no autonomous valve actuation.*

### Step 5: Report Export & Clean Reset
- **Action**: Click **"4. Export / share report"**.
- **Visual**: Toast notification appears: *"Report copied to clipboard"*.
- **Action**: Click **"Reset"** (or press `R`).
- **Speaker**: "With a single click on Reset, all in-memory hydraulic states return to normal baseline, ready for another scenario."
- **Action**: Click **START DHARA DEMO** again to demonstrate complete repeatability.

---

## 3. Offline Backup & Failure Recovery

If Wi-Fi fails or the local server is intentionally disconnected:
1. The top-bar badge automatically switches to **`RECORDED DEMO DATA`**.
2. Click **START DHARA DEMO** — the flow runs seamlessly using committed real-response snapshots (`frontend/public/mock/*.json`).
3. You can also force offline mode from the terminal:
   ```bash
   make demo-offline
   ```
