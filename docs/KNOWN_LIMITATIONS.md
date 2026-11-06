# DHARA / HydroPulse: Known Technical Limitations & Constraints

**Document Version:** 1.0.0  
**Target Event:** Lakshya 2026 @ SJB Institute of Technology (SJBIT) · Track 02: Smart & Sustainable Future  
**Dual Branding:** DHARA (Public Exhibition Brand) · HydroPulse (Internal Engine & API Contract)

---

## Executive Summary

DHARA is an honest, physics-grounded municipal hydraulic digital twin for rapid pipe burst detection, localization, and valve isolation. To maintain scientific and engineering integrity during technical judging and municipal utility evaluations, this document outlines the current technical boundaries, physical assumptions, and operational constraints of the platform.

---

## 1. Software-Only Simulation vs. Physical Sensor Deployment

* **Current Architecture:** DHARA operates on a high-fidelity digital twin using the **US EPA WNTR (Water Network Tool for Resilience)** simulation engine and EPANET 2.2 hydraulics.
* **Sentinel Observation:** The 5 sentinel pressure sensors ($S_1 \dots S_5$) are topological software junctions selected via graph betweenness centrality with a minimum 2-hop topological separation constraint.
* **Telemetry Emulation:** Observed pressure drops are computed by simulating pressure-driven demand (PDD) with Torricelli orifice equations, perturbed by zero-mean Gaussian measurement noise ($\sigma \in [0.5\%, 3.0\%]$).
* **Field Requirement:** In a physical municipal rollout, physical pressure data loggers (e.g., IoT piezoresistive pressure transmitters with 4G/NB-IoT telemetry logging at 1–10 Hz) would replace simulated telemetry at the 5 selected sentinel nodes. Zero hardware is required for the hackathon demonstration.

---

## 2. Spatial Triangulation Resolution (City-Block vs. Centimeter)

* **Current Resolution:** DHARA localizes leaks to the nearest junction or pipe segment within a **50–150 meter radius** (typical city-block granularity in urban Indian layouts).
* **Hydraulic Physics Limit:** Pressure waves and steady-state hydraulic drawdowns disperse across looped pipe networks. A 5-sensor array can reliably identify the affected neighborhood cluster and candidate junctions, but cannot resolve sub-meter acoustic crack coordinates from pressure alone.
* **Operational Hand-off:** Municipal utility field crews (BWSSB) use DHARA's localized junction coordinates to dispatch targeted ground teams equipped with acoustic ground microphones or listening sticks, reducing street search times from days to under 20 minutes.

---

## 3. Human-in-the-Loop Semi-Autonomous Valve Isolation

* **Safety Policy:** Autonomous motorized valve closure is strictly prohibited without human operator sign-off.
* **Risk Factors:**
  1. **Water Hammer (Hydraulic Transients):** Rapid valve shutdown causes severe pressure surges that can burst adjacent aged AC (asbestos cement) or CI (cast iron) pipelines.
  2. **Critical Infrastructure Disruption:** Automated shutoffs could inadvertently depressurize hospitals, dialysis centers, or fire protection lines without operator awareness.
* **DHARA Implementation:** The system computes the minimal 2-to-3 valve cut-set via breadth-first search (BFS) graph traversal and displays an interactive verification dialog (`CONFIRM ISOLATION`) with expected residual household impacts before actuation commands are committed.

---

## 4. Hydraulic Physics & Elevation Approximations

* **Torricelli Orifice Model:** Leak flow is modeled using the classical pressure-dependent equation:
  $$Q_{\text{leak}} = C_d \cdot A \cdot \sqrt{2g \cdot \frac{P}{\rho g}} = C_d \cdot A \cdot \sqrt{\frac{2P}{\rho}}$$
  where discharge coefficient $C_d = 0.60$ and leak area $A$ represents an idealized circular orifice. Real underground pipe failures (e.g., longitudinal splits, circumferential fractures, joint weeping, or corroded pitting) exhibit non-constant discharge coefficients and pressure exponents ($0.5 \le \alpha \le 1.15$).
* **Terrain & Elevation Models:** For the Kengeri DMA network, elevations are generated from OpenStreetMap contours cross-referenced against SRTM 30m Digital Elevation Models (DEM) with synthetic hydraulic gradient smoothing. Detailed municipal lidar elevation surveys will further refine head loss calculations in production.

---

## 5. Intermittent Supply Regimes vs. Continuous PDD

* **Supply Regime:** DHARA simulates steady-state, fully pressurized pipe networks operating under Pressure-Driven Demand (PDD).
* **Bengaluru Intermittent Reality:** Many wards in Bengaluru receive municipal Cauvery water on intermittent schedules (e.g., alternate days, 4-hour morning supply windows). During empty-pipe fill periods, air pockets and transient multiphase flow distort pressure readings.
* **Operational Boundary:** DHARA's leak triangulation algorithm is designed to engage once the network reaches steady operating pressure (typically 15 minutes post-valve opening during a supply cycle).

---

## 6. District Metered Area (DMA) Scalability

* **Network Size:** The current single-matrix sensitivity engine is optimized for DMAs containing **100 to 500 nodes** (the Kengeri DMA network features 129 junctions and 203 pipes).
* **City-Wide Scaling:** Scaling to Bengaluru's complete distribution network (~100,000+ nodes) requires decomposing the municipal grid into hydrologically isolated District Metered Areas bounded by bulk flow meters, running independent sensitivity models per DMA rather than a single monolithic inversion matrix.
