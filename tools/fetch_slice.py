#!/usr/bin/env python3
"""Fetch the Bay Area Life 2.0 Stage 1 Shenzhen slice (bbox B) from Overpass
and convert it to the versioned snapshot `client/src/world2/data/slice-city.json`.

Bbox B (Stage 0 audit §5.1): 22.5465–22.5510 N, 113.9490–113.9540 E
(500 m x 500 m, Nanshan Science Park core).

Usage:
    python3 tools/fetch_slice.py            # full pull from Overpass, then convert
    python3 tools/fetch_slice.py --infile /tmp/slice-raw.json
                                            # convert a cached raw Overpass response
    python3 tools/fetch_slice.py --fallback ~/workspace/hk-action-m0/public/sz-block.json
                                            # LAST RESORT only: Huaqiangbei M0 block
                                            # (different bbox; slice is defined on bbox B)

Determinism: the same OSM base timestamp in produces a byte-identical
slice-city.json out (sorted keys, arrays sorted by id, rounded coordinates).

Data (c) OpenStreetMap contributors, ODbL.
"""

from __future__ import annotations

import json
import math
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent

# --- slice definition -------------------------------------------------------
BBOX = {"minLat": 22.5465, "maxLat": 22.5510, "minLon": 113.9490, "maxLon": 113.9540}
ORIGIN = {"lat": 22.54875, "lon": 113.9515}  # bbox centre
M_PER_DEG = 111320.0
UA = "bay-area-life-2.0-slice/0.1 (contact: zhuwen160@gmail.com)"

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
# Backoff (seconds) between attempts on 502/504/429.
BACKOFFS = [5, 15, 45, 120]
MAX_ATTEMPTS = 6

QUERY = """[out:json][timeout:180];
(
  way["building"]({s},{w},{n},{e});
  way["highway"]({s},{w},{n},{e});
  way["leisure"~"^(plaza|park|garden)$"]({s},{w},{n},{e});
);
out geom tags;""".format(
    s=BBOX["minLat"], w=BBOX["minLon"], n=BBOX["maxLat"], e=BBOX["maxLon"]
)

COUNT_QUERY = """[out:json][timeout:60];
(
  way["building"]({s},{w},{n},{e});
  way["highway"]({s},{w},{n},{e});
);
out count;""".format(
    s=BBOX["minLat"], w=BBOX["minLon"], n=BBOX["maxLat"], e=BBOX["maxLon"]
)

HEIGHT_LIB = REPO / "tools" / "buildings" / "buildings-osm.json"
OUT_JSON = REPO / "client" / "src" / "world2" / "data" / "slice-city.json"
RAW_CACHE = Path("/tmp/slice-raw.json")

# --- Overpass ---------------------------------------------------------------


def _post(url: str, query: str, timeout: int = 240) -> dict:
    req = urllib.request.Request(
        url,
        data=urllib.parse.urlencode({"data": query}).encode(),
        headers={"User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


def fetch_overpass() -> tuple[dict, str]:
    """Try endpoints in order with exponential backoff. Returns (data, endpoint)."""
    attempts = 0
    for url in ENDPOINTS:
        for backoff in BACKOFFS:
            attempts += 1
            if attempts > MAX_ATTEMPTS:
                break
            try:
                # Light probe first: if the server is at capacity, fail cheap.
                try:
                    probe = _post(url, COUNT_QUERY, timeout=90)
                    print(f"  probe {url}: {probe}", file=sys.stderr)
                except Exception as ex:
                    print(f"  probe {url} failed ({ex}); trying full query anyway",
                          file=sys.stderr)
                data = _post(url, QUERY, timeout=240)
                return data, url
            except urllib.error.HTTPError as ex:
                print(f"  attempt {attempts} {url}: HTTP {ex.code}", file=sys.stderr)
                if ex.code not in (429, 502, 503, 504):
                    raise
                if attempts >= MAX_ATTEMPTS:
                    break
                print(f"  retry in {backoff}s", file=sys.stderr)
                time.sleep(backoff)
            except Exception as ex:  # network error / timeout
                print(f"  attempt {attempts} {url}: {ex}", file=sys.stderr)
                if attempts >= MAX_ATTEMPTS:
                    break
                print(f"  retry in {backoff}s", file=sys.stderr)
                time.sleep(backoff)
    raise RuntimeError(f"Overpass failed on all endpoints after {attempts} attempts")


# --- ENU conversion ---------------------------------------------------------


def latlon_to_enu(lat: float, lon: float) -> tuple[float, float]:
    """ENU metres, origin = bbox centre. +x east, +z south (game convention)."""
    x = (lon - ORIGIN["lon"]) * M_PER_DEG * math.cos(math.radians(ORIGIN["lat"]))
    z = (ORIGIN["lat"] - lat) * M_PER_DEG
    return round(x, 2), round(z, 2)


def polygon_area_m2(poly: list[tuple[float, float]]) -> float:
    """Shoelace area of an ENU polygon (metres)."""
    a = 0.0
    for (x1, z1), (x2, z2) in zip(poly, poly[1:]):
        a += x1 * z2 - x2 * z1
    return abs(a) / 2.0


def close_polygon(poly: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if poly and poly[0] != poly[-1]:
        poly = poly + [poly[0]]
    return poly


def _pt_seg_dist(p, a, b):
    ax, az = a; bx, bz = b; px, pz = p
    dx, dz = bx - ax, bz - az
    L2 = dx * dx + dz * dz
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (pz - az) * dz) / L2))
    return math.hypot(px - (ax + t * dx), pz - (az + t * dz))


def _seg_seg_dist(a, b, c, d):
    """Min distance between segments ab and cd (0 if they intersect)."""
    def orient(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    def on_seg(p, q, r):  # q on pr (collinear case)
        return (min(p[0], r[0]) <= q[0] <= max(p[0], r[0])
                and min(p[1], r[1]) <= q[1] <= max(p[1], r[1]))
    o1, o2, o3, o4 = orient(a, b, c), orient(a, b, d), orient(c, d, a), orient(c, d, b)
    if ((o1 > 0) != (o2 > 0) and (o3 > 0) != (o4 > 0)):
        return 0.0
    if o1 == 0 and on_seg(a, c, b):
        return 0.0
    if o2 == 0 and on_seg(a, d, b):
        return 0.0
    if o3 == 0 and on_seg(c, a, d):
        return 0.0
    if o4 == 0 and on_seg(c, b, d):
        return 0.0
    return min(_pt_seg_dist(a, c, d), _pt_seg_dist(b, c, d),
               _pt_seg_dist(c, a, b), _pt_seg_dist(d, a, b))


def footprint_road_distance_m(footprint, roads_pts):
    """Min distance (m) from any footprint edge to any road segment.

    Edge distance, not centroid: a tower's wall can front a street even when
    its centre is deep inside a compound.
    """
    best = float("inf")
    for i in range(len(footprint) - 1):
        a, b = footprint[i], footprint[i + 1]
        for pts in roads_pts:
            for j in range(len(pts) - 1):
                d = _seg_seg_dist(a, b, pts[j], pts[j + 1])
                if d < best:
                    best = d
    return best


# --- heights ----------------------------------------------------------------


def parse_height_m(tags: dict) -> float | None:
    raw = (tags.get("height") or "").replace("m", "").strip()
    try:
        h = float(raw)
        return h if h > 0 else None
    except ValueError:
        return None


def parse_levels(tags: dict) -> int | None:
    try:
        lv = int(float(tags.get("building:levels", "")))
        return lv if lv > 0 else None
    except (TypeError, ValueError):
        return None


def load_height_library() -> list[dict]:
    """Vendored tools/buildings/buildings-osm.json, Shenzhen entries in bbox B."""
    data = json.loads(HEIGHT_LIB.read_text())
    return [
        r for r in data.get("sz", [])
        if BBOX["minLat"] <= r["lat"] <= BBOX["maxLat"]
        and BBOX["minLon"] <= r["lon"] <= BBOX["maxLon"]
    ]


def nearest_height_lib(lib: list[dict], lat: float, lon: float,
                       max_dist_m: float = 50.0) -> float | None:
    """Nearest height-library entry within ~50 m of the building centroid."""
    best, best_d = None, max_dist_m
    for r in lib:
        dlat = (r["lat"] - lat) * M_PER_DEG
        dlon = (r["lon"] - lon) * M_PER_DEG * math.cos(math.radians(lat))
        d = math.hypot(dlat, dlon)
        if d < best_d:
            best, best_d = r["h"], d
    return best


# --- classification ---------------------------------------------------------


def classify_building(tags: dict) -> str:
    b = (tags.get("building") or "").lower()
    amenity = (tags.get("amenity") or "").lower()
    office = (tags.get("office") or "").lower()
    shop = (tags.get("shop") or "").lower()
    if b in ("office", "commercial") or office or b == "retail":
        return "office" if office or b == "office" else "commercial"
    if shop or b in ("supermarket", "mall"):
        return "commercial"
    if b in ("apartments", "residential", "house", "dormitory", "hotel"):
        return "residential"
    if b in ("school", "hospital", "civic", "public", "government", "university",
             "kindergarten", "museum", "library", "train_station") or amenity in (
             "school", "hospital", "library", "community_centre", "public_building"):
        return "public"
    if b in ("industrial", "warehouse", "factory"):
        return "other"
    return "other"


# --- walkable derivation ----------------------------------------------------
#
# Derivation rule (documented for the navmesh agent), v1.1:
#   * footway / path / pedestrian / steps / cycleway centreline -> buffer to a
#     2 m half-width corridor (4 m wide walkable strip), built as a rectangle
#     per segment (perpendicular offset), unioned only by emitting the
#     rectangles (overlaps are harmless for navmesh input).
#   * residential / service / unclassified / living_street roads -> a 3 m
#     sidewalk strip along BOTH sides of the centreline (offset +/-3 m from
#     the centreline, strip width 3 m), i.e. walkable band from 3 m to 6 m
#     either side.
#   * plaza / park / garden area ways -> the whole area polygon is walkable.
#   * v1.1 CHANGE (integration, 2026-11-13): the carriageway surface of
#     EVERY road is walkable too (centred strip, half-width by kind — the
#     same widths render/roads.ts draws). Reason, measured on the v1.0
#     snapshot: sidewalks-only produced 156 disconnected fragments
#     (largest 30 polys); the shop door sat 12.47 m from the nearest
#     walkable polygon (outside the navmesh snap box), and no route
#     existed across the block at all, so the delivery task
#     (shop -> office, 318 m) and NPC commuting were unroutable. The
#     Stage 0 audit (§5.3) said carriageways are vehicles-only, but that
#     assumed connected sidewalks — the real OSM data defeats it. Stage 1
#     has no vehicle-traffic AI (only the player's car), so pedestrians
#     on the carriageway is the only way the slice's task and NPCs work.
#     Stage 2 re-splits this with crosswalks + traffic when it arrives.
#   * v1.2 CHANGE: sidewalk bands moved to 2–5.5 m from the centreline
#     (was 3–6 m — the old band left a 0.5 m gap to service carriageways
#     and stranded sidewalk fragments as isolated navmesh islands), and
#     each enterable building gets a 3 m wide entrance apron from its
#     door to the nearest road (the doors sit 12–20 m from the road
#     across unmapped forecourt ground).
# ----------------------------------------------------------------------------


def _offset_point(p: tuple[float, float], q: tuple[float, float],
                  dist: float) -> tuple[float, float]:
    dx, dz = q[0] - p[0], q[1] - p[1]
    length = math.hypot(dx, dz) or 1.0
    return (round(p[0] - dz / length * dist, 2), round(p[1] + dx / length * dist, 2))


def _strip(points: list[tuple[float, float]], half_width: float,
           side_offset: float = 0.0) -> list[list[tuple[float, float]]]:
    """Per-segment rectangle strip(s) along a polyline.

    side_offset == 0: centred strip of +/- half_width.
    side_offset != 0: strip on ONE side, from side_offset-half_width to
    side_offset+half_width (call twice with +/- for both sides).
    """
    out: list[list[tuple[float, float]]] = []
    for a, b in zip(points, points[1:]):
        dx, dz = b[0] - a[0], b[1] - a[1]
        length = math.hypot(dx, dz)
        if length < 0.5:
            continue
        nx, nz = -dz / length, dx / length  # unit normal
        if side_offset == 0.0:
            o1, o2 = half_width, -half_width
        else:
            o1 = side_offset + half_width
            o2 = side_offset - half_width
        p1 = (round(a[0] + nx * o1, 2), round(a[1] + nz * o1, 2))
        p2 = (round(b[0] + nx * o1, 2), round(b[1] + nz * o1, 2))
        p3 = (round(b[0] + nx * o2, 2), round(b[1] + nz * o2, 2))
        p4 = (round(a[0] + nx * o2, 2), round(a[1] + nz * o2, 2))
        out.append([p1, p2, p3, p4, p1])
    return out


FOOTWAY_KINDS = {"footway", "path", "pedestrian", "steps", "cycleway", "corridor"}
SIDEWALK_KINDS = {"residential", "service", "unclassified", "living_street", "tertiary"}
# Carriageway half-widths by highway kind — MUST match render/roads.ts
# (full widths there: primary 14, tertiary 12, secondary 10,
# secondary_link 8, residential 7, unclassified 6, service 5, footway 2.5).
ROAD_HALF_WIDTH = {
    "primary": 7.0, "trunk": 7.0, "tertiary": 6.0, "secondary": 5.0,
    "secondary_link": 4.0, "primary_link": 4.0, "tertiary_link": 4.0,
    "residential": 3.5, "unclassified": 3.0, "living_street": 3.0,
    "service": 2.5,
}
DEFAULT_ROAD_HALF_WIDTH = 3.0


def derive_walkable(roads: list[dict], areas: list[list[tuple[float, float]]],
                    ) -> list[list[tuple[float, float]]]:
    walkable: list[list[tuple[float, float]]] = []
    for r in roads:
        pts = [tuple(p) for p in r["points"]]
        if len(pts) < 2:
            continue
        if r["kind"] in FOOTWAY_KINDS:
            walkable.extend(_strip(pts, half_width=2.0))
        else:
            # v1.1: the carriageway surface itself is walkable (see the
            # derivation-rule comment above). Sidewalk bands are added
            # on top for the kinds that have them; overlaps are harmless.
            hw = ROAD_HALF_WIDTH.get(r["kind"], DEFAULT_ROAD_HALF_WIDTH)
            walkable.extend(_strip(pts, half_width=hw))
            if r["kind"] in SIDEWALK_KINDS:
                # 3.5 m sidewalk strips on both sides: band 2–5.5 m from
                # the centreline (v1.2: was 3–6 m, which left a 0.5 m gap
                # to service carriageways at 2.5 m half-width and stranded
                # sidewalk fragments as isolated navmesh islands).
                walkable.extend(_strip(pts, half_width=1.75, side_offset=3.75))
                walkable.extend(_strip(pts, half_width=1.75, side_offset=-3.75))
    for area in areas:
        walkable.append(close_polygon(area))
    return walkable


def _centroid(poly: list[tuple[float, float]]) -> tuple[float, float]:
    xs = [p[0] for p in poly]
    zs = [p[1] for p in poly]
    return sum(xs) / len(xs), sum(zs) / len(zs)


def door_position(footprint: list[tuple[float, float]]
                  ) -> tuple[tuple[float, float], tuple[float, float]]:
    """Port of render/buildings.ts doorPositionFor + the gameplay march.

    Longest footprint edge, midpoint, outward normal (away from the
    centroid), marched out past the footprint AABB in 0.25 m steps plus
    0.5 m. Returns (door point, outward normal)."""
    cx, cz = _centroid(footprint)
    best_len, best_a, best_b = 0.0, footprint[0], footprint[1]
    for i in range(len(footprint)):
        a = footprint[i]
        b = footprint[(i + 1) % len(footprint)]
        ln = math.hypot(b[0] - a[0], b[1] - a[1])
        if ln > best_len:
            best_len, best_a, best_b = ln, a, b
    mx, mz = (best_a[0] + best_b[0]) / 2, (best_a[1] + best_b[1]) / 2
    dx, dz = best_b[0] - best_a[0], best_b[1] - best_a[1]
    ln = math.hypot(dx, dz) or 1.0
    nx, nz = dz / ln, -dx / ln
    if (mx - cx) * nx + (mz - cz) * nz < 0:
        nx, nz = -nx, -nz
    xs = [p[0] for p in footprint]
    zs = [p[1] for p in footprint]
    min_x, max_x, min_z, max_z = min(xs), max(xs), min(zs), max(zs)
    t = 0.0
    while (min_x <= mx + nx * t <= max_x
           and min_z <= mz + nz * t <= max_z):
        t += 0.25
    t += 0.5
    return (round(mx + nx * t, 2), round(mz + nz * t, 2)), (nx, nz)


def _closest_pt_on_seg(p, a, b):
    ax, az = a; bx, bz = b; px, pz = p
    dx, dz = bx - ax, bz - az
    L2 = dx * dx + dz * dz
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (pz - az) * dz) / L2))
    return (ax + t * dx, az + t * dz)


def derive_door_aprons(buildings: list[dict], roads: list[dict],
                       ) -> list[list[tuple[float, float]]]:
    """v1.2: walkable entrance paths for the 3 enterable buildings.

    The doors sit 12–20 m from the nearest road (open forecourt /
    compound ground that OSM maps as nothing), so without an apron the
    door is off-mesh: the navmesh snap box (10 m) cannot reach it and
    NPCs cannot walk up to their own door. Each apron is a 3 m wide
    rectangle from the (marched-out) door point to the nearest point on
    the nearest road centreline. Only the enterable buildings get one —
    nobody routes to the other doors.
    """
    aprons: list[list[tuple[float, float]]] = []
    roads_pts = [[tuple(p) for p in r["points"]] for r in roads]
    for b in buildings:
        if not b["enterable"]:
            continue
        fp = [tuple(p) for p in b["footprint"]]
        door, _n = door_position(fp)
        best_d, best_r = float("inf"), None
        for pts in roads_pts:
            for a, c in zip(pts, pts[1:]):
                r = _closest_pt_on_seg(door, a, c)
                d = math.hypot(door[0] - r[0], door[1] - r[1])
                if d < best_d:
                    best_d, best_r = d, r
        if best_r is None or best_d < 1.0:
            continue
        dx, dz = best_r[0] - door[0], best_r[1] - door[1]
        ln = math.hypot(dx, dz) or 1.0
        nx, nz = -dz / ln * 1.5, dx / ln * 1.5
        p1 = (round(door[0] + nx, 2), round(door[1] + nz, 2))
        p2 = (round(best_r[0] + nx, 2), round(best_r[1] + nz, 2))
        p3 = (round(best_r[0] - nx, 2), round(best_r[1] - nz, 2))
        p4 = (round(door[0] - nx, 2), round(door[1] - nz, 2))
        aprons.append([p1, p2, p3, p4, p1])
    return aprons


# --- conversion -------------------------------------------------------------


def convert(raw: dict, fallback_bbox: dict | None = None) -> tuple[dict, dict]:
    """Convert a raw Overpass response to (slice_city, stats)."""
    bbox = fallback_bbox or BBOX
    origin = ORIGIN
    if fallback_bbox is not None:
        # M0 fallback block: recompute origin from its own bbox.
        origin = {
            "lat": round((fallback_bbox["minLat"] + fallback_bbox["maxLat"]) / 2, 5),
            "lon": round((fallback_bbox["minLon"] + fallback_bbox["maxLon"]) / 2, 5),
        }
    timestamp = raw.get("osm3s", {}).get("timestamp_osm_base", "unknown")

    def enu(lat: float, lon: float) -> tuple[float, float]:
        x = (lon - origin["lon"]) * M_PER_DEG * math.cos(math.radians(origin["lat"]))
        z = (origin["lat"] - lat) * M_PER_DEG
        return round(x, 2), round(z, 2)

    elements = [e for e in raw.get("elements", []) if e.get("type") == "way"]
    lib = load_height_library() if fallback_bbox is None else []

    buildings_raw, roads_raw, areas = [], [], []
    for el in elements:
        tags = el.get("tags", {})
        geom = el.get("geometry") or []
        if not geom:
            continue
        pts = [enu(g["lat"], g["lon"]) for g in geom]
        if "building" in tags:
            buildings_raw.append((el, tags, pts, geom))
        elif "highway" in tags:
            roads_raw.append((el, tags, pts))
        elif tags.get("leisure") in ("plaza", "park", "garden"):
            areas.append(close_polygon(pts))

    # --- roads (built first: building/road distance needs them) -------------
    roads = []
    for el, tags, pts in sorted(roads_raw, key=lambda t: t[0]["id"]):
        roads.append({
            "id": f"r{el['id']}",
            "osmId": el["id"],
            "name": tags.get("name") or None,
            "kind": tags.get("highway", "other"),
            "points": [[x, z] for x, z in pts],
        })
    roads_pts = [[tuple(p) for p in r["points"]] for r in roads]

    # --- buildings: filter, heights, selection ------------------------------
    # Excluded by rule, not by accident (bbox B, 2026-11-13 pull):
    #   * way 533679865 (building=yes, 15,986 m2, unnamed) is a podium/base
    #     slab, not a tower; the height library's 120 m at its centroid
    #     belongs to a tower rising from it, so it must not become a building.
    #   * towers deep inside the gated 大冲城市花园 compound (5号楼, 2号楼)
    #     have no mapped footway to any road (edge distance > 50 m); OSM
    #     maps no internal paths there, so they are left out of the slice.
    PODIUM_SLAB_OSM_IDS = {533679865}
    candidates = []
    lib_matches = 0
    for el, tags, pts, geom in buildings_raw:
        if el["id"] in PODIUM_SLAB_OSM_IDS:
            continue
        poly = close_polygon(pts)
        area = polygon_area_m2(poly)
        if area <= 200:
            continue
        clat = sum(g["lat"] for g in geom) / len(geom)
        clon = sum(g["lon"] for g in geom) / len(geom)
        lib_h = nearest_height_lib(lib, clat, clon) if lib else None
        if lib_h is not None:
            lib_matches += 1
        tag_h = parse_height_m(tags)
        levels = parse_levels(tags)
        if tag_h is not None:
            height = tag_h
            src = "tag:height"
        elif levels is not None:
            height = round(levels * 3.0, 1)
            src = "tag:levels*3"
        elif lib_h is not None:
            height = float(lib_h)
            src = "height-library"
        else:
            height = 12.0
            src = "fallback:12m"
        if levels is None:
            levels = max(1, round(height / 3.0))
        candidates.append({
            "osmId": el["id"],
            "name": tags.get("name") or None,
            "kind": classify_building(tags),
            "footprint": [[x, z] for x, z in poly],
            "height": round(height, 1),
            "levels": levels,
            "area": round(area, 1),
            "_lib": lib_h is not None,
            "_src": src,
            "_road_m": footprint_road_distance_m(poly, roads_pts),
        })

    # Selection: 30 max, prefer named + height-library match + within 50 m
    # of a road, then larger footprint. Two must-includes anchor the slice:
    # the only commercial building (尚美科技大厦) and the only public
    # building near a road with a >1000 m2 footprint (kindergarten).
    MUST_INCLUDE = {533679872, 1269262174}
    rank = lambda c: (c["name"] is None, not c["_lib"], c["_road_m"] > 50,
                      -c["area"], c["osmId"])
    near = sorted([c for c in candidates if c["_road_m"] <= 50], key=rank)
    far = sorted([c for c in candidates if c["_road_m"] > 50], key=rank)
    selected = []
    for c in near + far:
        if c["osmId"] in MUST_INCLUDE and c not in selected:
            selected.append(c)
    for c in near:
        if len(selected) >= 30:
            break
        if c not in selected:
            selected.append(c)
    for c in far:
        if len(selected) >= 30:
            break
        if c not in selected:
            selected.append(c)
    selected = selected[:30]
    # Final order in the file: by osmId (deterministic).
    selected.sort(key=lambda c: c["osmId"])

    # --- enterable: 3 buildings ---------------------------------------------
    # Box B reality (2026-11-13 pull): 41 residential, 8 public (7 school +
    # 1 kindergarten, all unnamed), 1 commercial, 0 office-tagged. So:
    #   (a) office role -> 尚美科技大厦, the only commercial building, a tech
    #       office tower in reality (name says 科技大厦); no office-tagged
    #       building exists in the box.
    #   (b) shop role -> largest named residential tower (ground-floor podium
    #       retail is the standard Shenzhen mixed-use form); the only
    #       commercial building is already the office pick.
    #   (c) lobby role -> the kindergarten (public, 1,658 m2): lobby + 1 room.
    def pick_enterable(kind_want: set[str], role: str, note: str,
                       used: set[int]) -> dict | None:
        pool = [c for c in selected
                if c["kind"] in kind_want and c["osmId"] not in used]
        if not pool:
            pool = [c for c in selected if c["osmId"] not in used]
        if not pool:
            return None
        pool.sort(key=lambda c: (c["name"] is None, c["area"] < 1000,
                                 -c["area"], c["osmId"]))
        chosen = pool[0]
        used.add(chosen["osmId"])
        chosen["enterable"] = {"role": role, "note": note}
        return chosen

    used: set[int] = set()
    pick_enterable({"office", "commercial"}, "office",
                   "Office: ground-floor lobby + 1 office room (尚美科技大厦, the box's only commercial/office tower)", used)
    pick_enterable({"public"}, "lobby",
                   "Public: lobby + 1 room (kindergarten)", used)
    pick_enterable({"commercial", "residential"}, "shop",
                   "Commercial: ground-floor shop (residential tower podium retail)", used)

    buildings = []
    for c in selected:
        buildings.append({
            "id": f"b{c['osmId']}",
            "osmId": c["osmId"],
            "name": c["name"],
            "kind": c["kind"],
            "footprint": [[x, z] for x, z in c["footprint"]],
            "height": c["height"],
            "levels": c["levels"],
            "enterable": c.get("enterable"),
        })

    walkable = derive_walkable(roads, areas)
    # v1.2: entrance paths from the 3 enterable doors to the road.
    walkable.extend(derive_door_aprons(buildings, roads))
    # Deterministic order: sort walkable polygons by first point then length.
    walkable = sorted(walkable, key=lambda p: (p[0][0], p[0][1], len(p)))

    slice_city = {
        "version": "1.2",
        "timestamp_osm_base": timestamp,
        "bbox": bbox,
        "origin": origin,
        "source": "OpenStreetMap contributors, ODbL",
        "buildings": buildings,
        "roads": roads,
        "walkable": [[[x, z] for x, z in poly] for poly in walkable],
    }

    stats = {
        "building_ways_raw": len(buildings_raw),
        "building_candidates_area_gt_200": len(candidates),
        "candidates_far_from_road_gt_50m": sum(1 for c in candidates
                                               if c["_road_m"] > 50),
        "buildings_selected": len(buildings),
        "enterable": sum(1 for b in buildings if b["enterable"]),
        "height_lib_matches_selected": sum(1 for c in selected if c["_lib"]),
        "height_sources": {s: sum(1 for c in selected if c["_src"] == s)
                           for s in ("tag:height", "tag:levels*3",
                                     "height-library", "fallback:12m")},
        "roads": len(roads),
        "road_kinds": {},
        "walkable_polygons": len(walkable),
        "plaza_park_areas": len(areas),
        "timestamp_osm_base": timestamp,
    }
    for r in roads:
        stats["road_kinds"][r["kind"]] = stats["road_kinds"].get(r["kind"], 0) + 1
    return slice_city, stats


# --- verification -----------------------------------------------------------


def verify(slice_city: dict) -> list[str]:
    """Return a list of problems (empty = pass)."""
    problems: list[str] = []
    buildings = slice_city["buildings"]
    roads = slice_city["roads"]
    if not (20 <= len(buildings) <= 30):
        problems.append(f"building count {len(buildings)} outside 20–30")
    if sum(1 for b in buildings if b["enterable"]) != 3:
        problems.append("enterable count != 3")
    for b in buildings:
        fp = b["footprint"]
        if fp[0] != fp[-1]:
            problems.append(f"{b['id']}: footprint not closed")
        area = polygon_area_m2([tuple(p) for p in fp])
        if area <= 200:
            problems.append(f"{b['id']}: area {area:.1f} m2 <= 200")
        if b["height"] <= 0:
            problems.append(f"{b['id']}: bad height {b['height']}")
    # Every building within 50 m of some road (footprint EDGE to road segment,
    # not centroid: a tower's wall can front a street while its centre sits
    # deep inside a compound).
    roads_pts = [[tuple(p) for p in r["points"]] for r in roads]
    for b in buildings:
        fp = [tuple(p) for p in b["footprint"]]
        d = footprint_road_distance_m(fp, roads_pts)
        if d > 50:
            problems.append(
                f"{b['id']} ({b['name'] or 'unnamed'}): nearest road edge "
                f"{d:.1f} m away (>50 m)")
    return problems


# --- main -------------------------------------------------------------------


def main(argv: list[str]) -> int:
    infile = fallback = None
    if "--infile" in argv:
        infile = Path(argv[argv.index("--infile") + 1])
    if "--fallback" in argv:
        fallback = Path(argv[argv.index("--fallback") + 1])

    if fallback is not None:
        print("!!! FALLBACK: using M0 Huaqiangbei block, NOT bbox B !!!", file=sys.stderr)
        raw = json.loads(fallback.read_text())
        # M0 block bbox (from its elements' bounds): lat 22.5399–22.5456,
        # lon 114.0818–114.0885 (M0 README / sz-block.json elements).
        lats = [g["lat"] for e in raw["elements"] for g in e.get("geometry", [])]
        lons = [g["lon"] for e in raw["elements"] for g in e.get("geometry", [])]
        fb_bbox = {"minLat": round(min(lats), 4), "maxLat": round(max(lats), 4),
                   "minLon": round(min(lons), 4), "maxLon": round(max(lons), 4)}
        slice_city, stats = convert(raw, fallback_bbox=fb_bbox)
        endpoint = "FALLBACK: " + str(fallback)
    elif infile is not None:
        raw = json.loads(infile.read_text())
        slice_city, stats = convert(raw)
        endpoint = "cached file: " + str(infile)
    else:
        raw, endpoint = fetch_overpass()
        RAW_CACHE.write_text(json.dumps(raw))
        print(f"raw Overpass response cached at {RAW_CACHE}", file=sys.stderr)
        slice_city, stats = convert(raw)

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(slice_city, indent=2, sort_keys=True,
                                   ensure_ascii=False) + "\n")

    problems = verify(slice_city)
    print(json.dumps({"endpoint": endpoint, "stats": stats,
                      "problems": problems}, indent=2, ensure_ascii=False))
    if problems:
        print("VERIFICATION PROBLEMS:", file=sys.stderr)
        for p in problems:
            print(" -", p, file=sys.stderr)
        return 1
    print("OK: slice-city.json written to", OUT_JSON)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
