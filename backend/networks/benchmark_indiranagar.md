# HydroPulse benchmark report

Generated 2026-11-06T01:00:59+00:00 by `backend/benchmark.py` (seed 2026). **Do not edit by hand.**

- Network: `indiranagar` — 137 junctions, 156 pipes (backend/networks/indiranagar.inp)
- Leak solver path: `wntr_reusable_model`; engine boot 5.2 s
- Trials per row: 50 junctions, leak area U(10, 60) cm², one leak per trial
- Localization error = haversine distance between the injected and the top-ranked junction

| Sensor strategy | Sensors | Noise % | Top-1 % | Top-3 % | Mean err (m) | Median err (m) | P90 err (m) | P50 latency (ms) | P95 latency (ms) |
|---|---|---|---|---|---|---|---|---|---|
| betweenness_separated | J90, J43, J41, J25, J45 | 0.0 | 64.0 | 86.0 | 19.4 | 0.0 | 61.1 | 35 | 129 |
| betweenness_separated | J90, J43, J41, J25, J45 | 1.5 | 22.0 | 44.0 | 89.0 | 72.2 | 210.7 | 30 | 112 |
| betweenness_separated | J90, J43, J41, J25, J45 | 3.0 | 20.0 | 38.0 | 87.9 | 77.6 | 214.7 | 28 | 109 |
| betweenness_separated | J90, J43, J41, J25, J45 | 5.0 | 18.0 | 30.0 | 105.5 | 104.5 | 230.7 | 30 | 108 |
| betweenness_top | J90, J91, J77, J43, J92 | 0.0 | 66.0 | 82.0 | 11.6 | 0.0 | 52.7 | 34 | 137 |
| betweenness_top | J90, J91, J77, J43, J92 | 1.5 | 14.0 | 28.0 | 119.6 | 130.5 | 230.5 | 35 | 110 |
| betweenness_top | J90, J91, J77, J43, J92 | 3.0 | 6.0 | 22.0 | 127.9 | 134.4 | 241.1 | 30 | 103 |
| betweenness_top | J90, J91, J77, J43, J92 | 5.0 | 6.0 | 14.0 | 139.0 | 158.3 | 248.9 | 31 | 108 |

## Plain-English summary

On the `indiranagar` network (137 junctions) with 5 sentinel pressure sensors and 1.5% sensor noise, HydroPulse ranked the true leaking junction first in 22% of 50 simulated bursts and in the top 3 in 44%. The median distance between the predicted and the true junction was 72 m (90th percentile 211 m), and 95% of detections completed in under 112 ms. These are simulation results on a digital twin, not field measurements.

> **Caveat:** `indiranagar` is not the real OSM Kengeri network. Re-run this benchmark after `python backend/generate_bangalore_dma.py` (OSM) has been committed, and quote only those numbers.
