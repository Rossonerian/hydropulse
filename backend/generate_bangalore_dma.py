"""OpenStreetMap streets → EPANET pipe network for a Kengeri DMA.

Usage (from the repo root):
    python backend/generate_bangalore_dma.py                     # real OSM download (needs internet)
    python backend/generate_bangalore_dma.py --source synthetic  # offline, street-like grid in the Kengeri bbox

Both sources produce the same intermediate graph (nodes with x=lng, y=lat; edges
with `length` and `highway`) and then run through one shared pipeline:
rename → elevation/households proxies → pipe sizing → reservoir → pressure
validation → write .inp + network_meta.json.

Options for other areas / real elevation (defaults reproduce the original Kengeri behaviour):
    python backend/generate_bangalore_dma.py --name indiranagar --lat 12.9784 --lng 77.6408 \
        --dist 450 --out backend/networks/indiranagar.inp --meta backend/networks/indiranagar_meta.json \
        --dem opentopodata --dem-file backend/networks/indiranagar_dem.json
    --dem proxy         planar-slope proxy (default)
    --dem opentopodata  sample SRTM 30 m at every junction and write the samples to --dem-file
    --dem file          read the samples back from --dem-file (offline and reproducible)

Modelling proxies (documented, not survey data):
- Elevation (--dem proxy) = 815 m + a gentle planar slope (~15 m across the bbox) + N(0, 0.5) noise.
  With --dem opentopodata/file it is the SRTM 30 m value sampled at each junction.
- Households per junction = uniform 10–80; demand = households × 4.5 persons × 135 LPCD.
- Pipe diameter follows the road class (trunk/primary 400 mm, secondary/tertiary 250 mm, else 110 mm).
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import networkx as nx
import numpy as np
import wntr

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from data_utils.geo_mapper import haversine_m  # noqa: E402

LPCD = 135.0
PERSONS_PER_HOUSEHOLD = 4.5
MIN_JUNCTIONS, MAX_JUNCTIONS = 60, 250
MIN_P, MAX_P = 15.0, 70.0


# ───────────────────────────── graph sources ─────────────────────────────
def _clean_graph(g: nx.Graph) -> nx.Graph:
    """Largest connected component, no self-loops, parallel edges collapsed to the shortest."""
    out = nx.Graph()
    for n, d in g.nodes(data=True):
        out.add_node(n, x=float(d["x"]), y=float(d["y"]))
    for u, v, d in g.edges(data=True):
        if u == v:
            continue
        length = float(d.get("length", 1.0))
        hw = d.get("highway", "residential")
        if isinstance(hw, (list, tuple)):
            hw = hw[0]
        if out.has_edge(u, v) and out[u][v]["length"] <= length:
            continue
        out.add_edge(u, v, length=length, highway=str(hw))
    largest = max(nx.connected_components(out), key=len)
    return out.subgraph(largest).copy()


def osm_graph(lat: float, lng: float, dist: float, cache_dir: str | None = None,
              retries: int = 5, info: dict | None = None) -> nx.Graph:
    """Download the OSM drive network and return a cleaned undirected graph.

    Uses the osmnx on-disk HTTP cache (`cache_dir`, default osmnx's own) so repeated runs
    are offline, and retries Overpass failures with exponential backoff. `info` receives
    {"fresh_fetch": bool}: True when a new cache file appeared during the call.
    """
    import osmnx as ox

    if cache_dir:
        ox.settings.cache_folder = str(cache_dir)
    ox.settings.use_cache = True
    ox.settings.requests_timeout = 180
    cache = Path(ox.settings.cache_folder)
    before = set(cache.glob("*.json")) if cache.exists() else set()
    gm = None

    # Check offline cache first to avoid hanging when Overpass is unavailable
    if cache.exists():
        for cached_file in sorted(cache.glob("*.json")):
            try:
                raw_data = json.loads(cached_file.read_text(encoding="utf-8"))
                if isinstance(raw_data, dict) and "elements" in raw_data and len(raw_data["elements"]) > 10:
                    gm_candidate = ox.graph._create_graph([raw_data], bidirectional=False)
                    R = 6371000.0
                    def _hm(la, ln):
                        p1, p2 = math.radians(lat), math.radians(la)
                        dp, dl = math.radians(la - lat), math.radians(ln - lng)
                        a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
                        return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))
                    nodes_in = [n for n, d_attr in gm_candidate.nodes(data=True) if "y" in d_attr and "x" in d_attr and _hm(d_attr["y"], d_attr["x"]) <= dist]
                    if len(nodes_in) >= MIN_JUNCTIONS:
                        print(f"  Loaded {len(nodes_in)} intersections from offline cache: {cached_file.name}", file=sys.stderr)
                        gm = gm_candidate.subgraph(nodes_in).copy()
                        break
            except Exception:
                pass

    if gm is None:
        ox.settings.requests_timeout = 10
        for attempt in range(1, retries + 1):
            try:
                gm = ox.graph_from_point((lat, lng), dist=dist, network_type="drive")
                break
            except Exception as exc:  # Overpass / requests errors differ by library version
                print(f"  Overpass attempt {attempt}/{retries} failed: {type(exc).__name__}: {str(exc)[:120]}",
                      file=sys.stderr)
                if attempt == retries:
                    raise
                time.sleep(min(60, 5 * 2 ** (attempt - 1)))
    if info is not None:
        after = set(cache.glob("*.json")) if cache.exists() else set()
        info["fresh_fetch"] = bool(after - before)
    if hasattr(ox, "convert") and hasattr(ox.convert, "to_undirected"):
        gu = ox.convert.to_undirected(gm)  # osmnx v2
    else:
        gu = ox.get_undirected(gm)  # osmnx v1
    return _clean_graph(nx.Graph(gu) if not gu.is_multigraph() else _multi_to_simple(gu))


def _multi_to_simple(gm) -> nx.Graph:
    g = nx.Graph()
    g.add_nodes_from(gm.nodes(data=True))
    for u, v, d in gm.edges(data=True):
        if g.has_edge(u, v) and g[u][v].get("length", math.inf) <= d.get("length", math.inf):
            continue
        g.add_edge(u, v, **d)
    return g


def synthetic_graph(lat: float, lng: float, dist: float, seed: int) -> nx.Graph:
    """Offline street-like network centred on (lat, lng).

    A jittered grid (~110 m blocks) with two primary arterials, two secondary
    roads, ~12% of residential links removed (connectivity kept) and a few
    dead-end lanes. IDs are integers standing in for OSM ids.
    """
    rng = np.random.default_rng(seed)
    m_per_deg_lat = 111_320.0
    m_per_deg_lng = 111_320.0 * math.cos(math.radians(lat))
    spacing = 110.0
    k = int(round(2 * dist / spacing)) // 2 * 2  # even → odd number of lines
    rows = cols = k + 1 if k + 1 <= 11 else 11
    g = nx.Graph()
    nid = lambda r, c: 1_000_000 + r * 100 + c  # noqa: E731
    for r in range(rows):
        for c in range(cols):
            dx = (c - (cols - 1) / 2) * spacing + rng.normal(0, 18)
            dy = (r - (rows - 1) / 2) * spacing + rng.normal(0, 18)
            g.add_node(nid(r, c), x=lng + dx / m_per_deg_lng, y=lat + dy / m_per_deg_lat)
    mid = (rows - 1) // 2
    primary_rows, primary_cols = {mid}, {mid}
    secondary_rows, secondary_cols = {1, rows - 2}, {2}

    def hw(r1, c1, r2, c2) -> str:
        if r1 == r2 and r1 in primary_rows or c1 == c2 and c1 in primary_cols:
            return "primary"
        if r1 == r2 and r1 in secondary_rows or c1 == c2 and c1 in secondary_cols:
            return "secondary"
        return "residential"

    for r in range(rows):
        for c in range(cols):
            if c + 1 < cols:
                g.add_edge(nid(r, c), nid(r, c + 1), highway=hw(r, c, r, c + 1))
            if r + 1 < rows:
                g.add_edge(nid(r, c), nid(r + 1, c), highway=hw(r, c, r + 1, c))
    # Remove some residential links while staying connected (irregular blocks).
    residential = [e for e in g.edges if g.edges[e]["highway"] == "residential"]
    rng.shuffle(residential)
    removed, target_removed = 0, int(0.12 * g.number_of_edges())
    for u, v in residential:
        if removed >= target_removed:
            break
        g.remove_edge(u, v)
        if g.degree(u) < 2 or g.degree(v) < 2 or not nx.is_connected(g):
            g.add_edge(u, v, highway="residential")
            continue
        removed += 1
    # Dead-end lanes off random residential nodes.
    candidates = [n for n in g.nodes if g.degree(n) <= 3]
    for i, base in enumerate(rng.choice(candidates, size=min(8, len(candidates)), replace=False)):
        bx, by = g.nodes[base]["x"], g.nodes[base]["y"]
        ang = rng.uniform(0, 2 * math.pi)
        dlen = rng.uniform(45, 80)
        new = 2_000_000 + i
        g.add_node(
            new,
            x=bx + dlen * math.cos(ang) / m_per_deg_lng,
            y=by + dlen * math.sin(ang) / m_per_deg_lat,
        )
        g.add_edge(int(base), new, highway="residential")
    for u, v in g.edges:
        a, b = g.nodes[u], g.nodes[v]
        g.edges[u, v]["length"] = 1.05 * haversine_m(a["y"], a["x"], b["y"], b["x"])
    return _clean_graph(g)


# ───────────────────────────── elevation (DEM) ─────────────────────────────
OPENTOPODATA_URL = "https://api.opentopodata.org/v1/srtm30m"
DEM_BATCH = 100


def sample_srtm(points: dict[str, tuple[float, float]], retries: int = 5) -> dict[str, float]:
    """Sample SRTM 30 m via the public opentopodata API (100 pts/request, 1 request/s)."""
    import requests

    keys = list(points)
    out: dict[str, float] = {}
    for i in range(0, len(keys), DEM_BATCH):
        chunk = keys[i:i + DEM_BATCH]
        locs = "|".join(f"{points[k][0]:.6f},{points[k][1]:.6f}" for k in chunk)
        for attempt in range(1, retries + 1):
            try:
                r = requests.get(OPENTOPODATA_URL, params={"locations": locs}, timeout=60,
                                 headers={"User-Agent": "hydropulse-network-generator"})
                r.raise_for_status()
                results = r.json()["results"]
                if len(results) != len(chunk):
                    raise ValueError("opentopodata returned a different number of results")
                for k, res in zip(chunk, results):
                    if res.get("elevation") is not None:
                        out[k] = float(res["elevation"])
                break
            except Exception as exc:
                print(f"  DEM attempt {attempt}/{retries} failed: {type(exc).__name__}: {str(exc)[:100]}",
                      file=sys.stderr)
                if attempt == retries:
                    raise
                time.sleep(min(30, 2 ** attempt))
        time.sleep(1.1)  # public API: 1 request per second
    return out


def load_elevations(order: list, g: nx.Graph, mode: str, dem_file: Path | None) -> tuple[np.ndarray, dict]:
    """Return (elevation per junction in `order`, DEM provenance) for mode opentopodata|file.

    Samples are keyed by OSM node id so a cached file reproduces the network offline.
    """
    pts = {str(n): (g.nodes[n]["y"], g.nodes[n]["x"]) for n in order}
    if mode == "file":
        if dem_file is None:
            raise RuntimeError("--dem file needs --dem-file")
        doc = json.loads(Path(dem_file).read_text())
        samples = {str(k): v for k, v in doc["samples"].items()}
        missing = [k for k in pts if k not in samples]
        if missing:
            raise RuntimeError(f"{dem_file} has no sample for {len(missing)} OSM nodes (e.g. {missing[:3]}); "
                               "OSM changed since it was written. Re-run with --dem opentopodata.")
        info = {k: v for k, v in doc.items() if k not in ("samples", "coordinates")}
    else:
        samples = sample_srtm(pts)
        missing = [k for k in pts if k not in samples]
        if missing:
            raise RuntimeError(f"SRTM returned no value for {len(missing)} junctions: {missing[:5]}")
        info = {
            "source": "SRTM 30 m via api.opentopodata.org/v1/srtm30m",
            "fetched_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "points": len(samples),
        }
        if dem_file:
            Path(dem_file).parent.mkdir(parents=True, exist_ok=True)
            doc = dict(info, samples={k: samples[k] for k in sorted(samples, key=int)},
                       coordinates={k: [round(pts[k][0], 6), round(pts[k][1], 6)] for k in sorted(pts, key=int)})
            Path(dem_file).write_text(json.dumps(doc, indent=1) + "\n")
    elev = np.array([samples[str(n)] for n in order], dtype=float)
    return elev, info


# ───────────────────────────── network build ─────────────────────────────
def diameter_for(highway: str) -> float:
    """Pipe diameter (m) from the OSM highway class."""
    h = highway.replace("_link", "")
    if h in ("trunk", "primary"):
        return 0.40
    if h in ("secondary", "tertiary"):
        return 0.25
    return 0.11


def road_class_for(highway: str) -> str:
    """Normalised road_class enum (SOURCE_OF_TRUTH §5)."""
    h = highway.replace("_link", "")
    if h in ("trunk", "primary"):
        return "primary"
    if h in ("secondary", "tertiary"):
        return "secondary"
    return "residential"


def build_network(g: nx.Graph, seed: int, dem: str = "proxy",
                  dem_file: Path | None = None) -> tuple[wntr.network.WaterNetworkModel, dict]:
    """Turn a cleaned street graph into a WNTR model plus metadata."""
    rng = np.random.default_rng(seed)
    order = sorted(g.nodes, key=lambda n: int(n) if str(n).isdigit() else str(n))
    jname = {n: f"J{i + 1}" for i, n in enumerate(order)}
    xs = np.array([g.nodes[n]["x"] for n in order])
    ys = np.array([g.nodes[n]["y"] for n in order])
    dem_info: dict = {}
    if dem == "proxy":
        # Planar slope: ~15 m drop from north-east to south-west across the bbox.
        span = max(np.ptp(xs) + np.ptp(ys), 1e-9)
        slope = 15.0 * (((xs - xs.min()) + (ys - ys.min())) / span)
        elev = 815.0 + slope + rng.normal(0, 0.5, size=len(order))
    else:
        elev, dem_info = load_elevations(order, g, dem, dem_file)

    wn = wntr.network.WaterNetworkModel()
    households: dict[str, int] = {}
    osmid: dict[str, int] = {}
    for i, n in enumerate(order):
        name = jname[n]
        hh = int(rng.integers(10, 81))
        households[name] = hh
        osmid[name] = int(n) if str(n).isdigit() else -1
        demand_m3s = hh * PERSONS_PER_HOUSEHOLD * LPCD / 1000.0 / 86400.0
        wn.add_junction(
            name,
            base_demand=demand_m3s,
            elevation=float(elev[i]),
            coordinates=(float(xs[i]), float(ys[i])),
        )

    edges = sorted(
        g.edges(data=True),
        key=lambda e: tuple(sorted((int(jname[e[0]][1:]), int(jname[e[1]][1:])))),
    )
    road_class: dict[str, str] = {}
    for k, (u, v, d) in enumerate(edges, start=1):
        a, b = sorted((jname[u], jname[v]), key=lambda s: int(s[1:]))
        pname = f"P{k}"
        wn.add_pipe(
            pname, a, b,
            length=max(float(d["length"]), 1.0),
            diameter=diameter_for(d["highway"]),
            roughness=120.0,
        )
        road_class[pname] = road_class_for(d["highway"])

    # Reservoir ~50 m off the highest junction that sits on a primary main (falls back
    # to the highest junction overall). Feeding a trunk, not a 110 mm lane, mirrors how
    # a DMA inlet works and avoids one lane becoming the bottleneck for the whole ward.
    on_primary = {jname[n] for u, v, d in g.edges(data=True) if road_class_for(d["highway"]) == "primary"
                  for n in (u, v)}
    idx = [i for i, n in enumerate(order) if jname[n] in on_primary] or list(range(len(order)))
    top = max(idx, key=lambda i: elev[i])
    tx, ty = xs[top], ys[top]
    m_lng = 111_320.0 * math.cos(math.radians(ty))
    wn.add_reservoir(
        "R1",
        base_head=float(elev.max() + 45.0),
        coordinates=(float(tx + 35.0 / m_lng), float(ty + 35.0 / 111_320.0)),
    )
    wn.add_pipe("P0", "R1", jname[order[top]], length=50.0, diameter=0.50, roughness=120.0)
    road_class["P0"] = "feeder"
    apply_options(wn)
    meta = {"households": households, "road_class": road_class, "osmid": osmid,
            "dem_info": dem_info, "elevations": [float(e) for e in elev]}
    return wn, meta


def apply_options(wn: wntr.network.WaterNetworkModel) -> None:
    """Steady-state PDD invariants (SOURCE_OF_TRUTH §6)."""
    wn.options.time.duration = 0
    wn.options.hydraulic.demand_model = "PDD"
    wn.options.hydraulic.required_pressure = 15.0
    wn.options.hydraulic.minimum_pressure = 2.0
    wn.options.hydraulic.pressure_exponent = 0.5


def junction_pressures(wn: wntr.network.WaterNetworkModel):
    res = wntr.sim.WNTRSimulator(wn).run_sim()
    return res.node["pressure"].iloc[0][wn.junction_name_list], res


def validate_pressures(wn: wntr.network.WaterNetworkModel, max_iter: int = 30) -> None:
    """Raise reservoir head / upsize small pipes until 15 m ≤ pressure ≤ 70 m."""
    res_node = wn.get_node("R1")
    upsized = False
    for _ in range(max_iter):
        p, _ = junction_pressures(wn)
        lo, hi = float(p.min()), float(p.max())
        if lo >= MIN_P and hi <= MAX_P:
            return
        if lo < MIN_P and hi + 5.0 <= MAX_P:
            res_node.head_timeseries.base_value += 5.0
        elif lo < MIN_P and not upsized:
            for pn in wn.pipe_name_list:
                pipe = wn.get_link(pn)
                if abs(pipe.diameter - 0.11) < 1e-9:
                    pipe.diameter = 0.15
            upsized = True
        elif hi > MAX_P and lo - 5.0 >= MIN_P:
            res_node.head_timeseries.base_value -= 5.0
        else:
            break
    p, _ = junction_pressures(wn)
    raise RuntimeError(
        f"Could not bring pressures into [{MIN_P}, {MAX_P}] m: min={p.min():.1f}, max={p.max():.1f}"
    )


def write_inp(wn: wntr.network.WaterNetworkModel, path: Path) -> None:
    if hasattr(wntr.network, "write_inpfile"):
        wntr.network.write_inpfile(wn, str(path))
    else:
        wn.write_inpfile(str(path))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lat", type=float, default=12.9081)
    ap.add_argument("--lng", type=float, default=77.4852)
    ap.add_argument("--dist", type=float, default=600.0)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default="backend/bangalore_kengeri.inp")
    ap.add_argument("--meta", default=None, help="meta JSON path (default: <out dir>/network_meta.json)")
    ap.add_argument("--name", default=None,
                    help="network_name (default: bangalore_kengeri for osm, kengeri_synthetic for synthetic)")
    ap.add_argument("--source", choices=["osm", "synthetic"], default="osm",
                    help="osm = download real streets (default); synthetic = offline street-like grid")
    ap.add_argument("--dem", choices=["proxy", "opentopodata", "file"], default="proxy",
                    help="elevation: planar proxy (default), SRTM 30 m via opentopodata, or a cached DEM file")
    ap.add_argument("--dem-file", default=None, help="DEM samples JSON (written by opentopodata, read by file)")
    ap.add_argument("--cache-dir", default=None, help="osmnx HTTP cache folder (default: osmnx's own)")
    ap.add_argument("--retries", type=int, default=5, help="Overpass retries with exponential backoff")
    args = ap.parse_args(argv)

    dist = args.dist
    osm_info: dict = {}
    for attempt in range(4):
        g = (osm_graph(args.lat, args.lng, dist, args.cache_dir, args.retries, osm_info)
             if args.source == "osm" else synthetic_graph(args.lat, args.lng, dist, args.seed))
        n = g.number_of_nodes()
        print(f"[attempt {attempt + 1}] source={args.source} dist={dist:.0f} m → {n} intersections")
        if MIN_JUNCTIONS <= n <= MAX_JUNCTIONS:
            break
        dist = dist * (1.3 if n < MIN_JUNCTIONS else 0.75)
    else:
        print(f"ERROR: could not reach {MIN_JUNCTIONS}-{MAX_JUNCTIONS} junctions", file=sys.stderr)
        return 1

    dem_file = Path(args.dem_file) if args.dem_file else None
    wn, meta = build_network(g, args.seed, args.dem, dem_file)
    validate_pressures(wn)
    p, res = junction_pressures(wn)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    write_inp(wn, out)

    network_name = args.name or ("bangalore_kengeri" if args.source == "osm" else "kengeri_synthetic")
    elev = np.array(meta["elevations"])
    params = {
        "source": args.source, "lat": args.lat, "lng": args.lng, "dist": dist,
        "seed": args.seed, "reservoir_head_m": round(wn.get_node("R1").base_head, 2),
        "elevation": ("proxy: 815 m + ~15 m planar slope + N(0, 0.5) noise" if args.dem == "proxy"
                      else f"SRTM 30 m sampled at each junction (--dem {args.dem})"),
    }
    meta_doc = {
        "network_name": network_name,
        "center": {"lat": args.lat, "lng": args.lng},
        "households": meta["households"],
        "road_class": meta["road_class"],
        "osmid": meta["osmid"],
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "params": params,
    }
    if args.source == "osm" and args.dem != "proxy":
        fresh = bool(osm_info.get("fresh_fetch"))
        meta_doc["source"] = "osm"
        meta_doc["provenance"] = {
            "summary": "Street geometry is real OpenStreetMap; hydraulics are modelled, not BWSSB asset data.",
            "street_geometry": "OpenStreetMap drive network via osmnx (Overpass API), largest connected component",
            "osm_fetch_utc": (datetime.now(timezone.utc).isoformat(timespec="seconds") if fresh
                              else "from osmnx cache (original fetch earlier than generated_at)"),
            "osm_radius_m": dist,
            "diameters": "by OSM road class: trunk/primary 400 mm, secondary/tertiary 250 mm, else 110 mm "
                         "(110 mm lanes upsized to 150 mm if the pressure window needs it)",
            "hazen_williams_c": 120,
            "households": f"modelled, seed {args.seed}: uniform integer 10-80 per junction (not a census)",
            "demand": "households x 4.5 persons x 135 LPCD",
            "elevation": meta["dem_info"],
            "elevation_range_m": [round(float(elev.min()), 1), round(float(elev.max()), 1)],
            "reservoir": "single reservoir ~50 m off the highest junction on a primary road; head tuned so "
                         f"all junction pressures sit in [{MIN_P:.0f}, {MAX_P:.0f}] m",
            "counts": {
                "junctions": len(wn.junction_name_list), "pipes": len(wn.pipe_name_list),
                "households": sum(meta["households"].values()),
            },
            "disclaimer": "modelled, not BWSSB asset data",
        }
    meta_path = Path(args.meta) if args.meta else out.parent / "network_meta.json"
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    meta_path.write_text(json.dumps(meta_doc, indent=2) + "\n")

    total_demand_lps = sum(wn.get_node(j).base_demand for j in wn.junction_name_list) * 1000
    print(f"wrote {out} and {meta_path}")
    print(f"network_name={network_name} junctions={len(wn.junction_name_list)} "
          f"pipes={len(wn.pipe_name_list)} reservoirs={len(wn.reservoir_name_list)}")
    print(f"pressure m: min={p.min():.1f} mean={p.mean():.1f} max={p.max():.1f}")
    print(f"elevation m: min={elev.min():.1f} max={elev.max():.1f} (dem={args.dem})")
    print(f"total demand: {total_demand_lps:.2f} L/s; households: {sum(meta['households'].values())}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
