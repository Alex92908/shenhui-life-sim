#!/usr/bin/env python3
"""Generate client/src/metro-sz.ts — the full Shenzhen metro network — from
OpenStreetMap route relations, fitted onto the game's miniature map.

Data: © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).

Usage (from the repo root):
    # 1) refresh the OSM snapshot (optional — a snapshot is committed):
    python3 tools/metro/gen_sz_metro.py --fetch        # or --from overpass.json
    # 2) regenerate the TypeScript data:
    python3 tools/metro/gen_sz_metro.py

How the coordinates are made:
  * Each station's real position = mean of its OSM stop nodes (one point per
    station name, shared by every line through it, so transfers line up).
  * An affine transform (least squares) maps real km → game map units,
    fitted on stations that already existed in the game (legacy-anchors.json).
  * Each game location served by a station (罗湖口岸, 深圳北站, 福田口岸 …) has
    ONE canonical station pinned exactly onto the location's building, and a
    smooth Gaussian residual field bends every other station accordingly, so
    the network stays consistent with the hand-placed 3D map.
"""
from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SNAPSHOT = HERE / "sz-osm-routes.json"
ANCHORS = HERE / "legacy-anchors.json"
OUT = ROOT / "client" / "src" / "metro-sz.ts"

OVERPASS = "https://overpass-api.de/api/interpreter"
QUERY = (
    '[out:json][timeout:150];'
    '(rel["route"~"^(subway|light_rail|monorail)$"](22.40,113.70,22.90,114.65);'
    'rel["route"="train"]["name"="穗深城际：竹料=>深圳机场"];)->.r;'
    '.r out body;node(r.r);out;'
)

# Game line id -> how to pick it out of OSM (relation name prefix) and,
# for the 2&8 through service, where to cut it.
LINES = [
    # id, OSM name startswith, display name, short, colour
    ("1", "地铁 1号线：罗湖 → 机场东", "1号线（罗宝线）", "1号线", "#008C2E"),
    # 2号线 and 8号线 run through as one service (no change at 莲塘).
    ("2", "地铁 2&8号线：赤湾 → 溪涌", "2/8号线（蛇口线·盐田线 贯通运营）", "2/8号线", "#F39800"),
    ("3", "地铁 3号线: 福保 → 坪地六联", "3号线（龙岗线）", "3号线", "#0096D6"),
    ("4", "地铁 4号线：福田口岸 -> 牛湖", "4号线（龙华线）", "4号线", "#E60012"),
    ("5", "地铁 5号线：赤湾 → 大剧院", "5号线（环中线）", "5号线", "#7B2D8B"),
    ("6", "地铁 6号线：科学馆 → 松岗", "6号线（光明线）", "6号线", "#1AA17A"),
    ("6b", "地铁 6号线支线：深理工 -> 光明城", "6号线支线", "6号线支线", "#428D89"),
    ("7", "地铁 7号线: 深大丽湖 → 太安", "7号线（西丽线）", "7号线", "#003F87"),
    ("9", "地铁 9号线：前湾 → 文锦", "9号线（梅林线）", "9号线", "#8B7D6B"),
    ("10", "地铁 10号线：福田口岸 → 双拥街", "10号线（坂田线）", "10号线", "#F5A9B8"),
    ("11", "地铁 11号线: 红岭南 → 碧头", "11号线（机场线）", "11号线", "#6C1D45"),
    ("12", "地铁 12号线: 左炮台东 → 松岗", "12号线（南宝线）", "12号线", "#A192B2"),
    ("13", "深圳地铁13号线: 深圳湾口岸 → 李松蓢", "13号线（石岩线）", "13号线", "#DE7C00"),
    ("14", "地铁 14号线: 岗厦北 -> 沙田", "14号线（东部快线）", "14号线", "#E6007E"),
    ("16", "地铁 16号线: 园山西坑 → 田心", "16号线（龙坪线）", "16号线", "#1E22AA"),
    ("20", "地铁 20号线: 机场北 → 会展城", "20号线（会展线）", "20号线", "#7FB3E8"),
    ("apm", "轻轨 坪山云巴1号线: 坪山高铁站 -> 比亚迪北", "坪山云巴1号线", "云巴", "#00A0A0"),
    ("tram1", "深圳有轨电车：清湖 → 下围", "龙华有轨电车1号线", "有轨1号线", "#93CB44"),
    ("tram2", "深圳有轨电车：清湖 → 新澜", "龙华有轨电车2号线", "有轨2号线", "#00491E"),
    # Intercity: only its Shenzhen stops; the Dongguan end becomes a
    # non-ridable direction stub (a name ending in 方向 marks it as such).
    ("guangshen", "穗深城际：竹料=>深圳机场", "穗深城际（深圳机场↔东莞·广州）", "穗深城际", "#C1272D"),
]
INTERCITY_LAST_SZ = "沙井西"      # last Shenzhen stop of 穗深城际 (from the airport)
INTERCITY_STUB = "东莞·广州方向"   # drawn at the next (Dongguan) stop's position
# The hand-made miniature's land deck spans x -38…38, z -24…14. Stations
# beyond these soft limits (far east 坪山/坑梓, far north) are eased inward
# so they stay on land; pinned location stations are never moved.
SOFT_EDGE = {"x": (-33.0, 30.0, 7.0), "z": (-21.0, 13.0, 2.5)}  # (min, max, room)

# OSM name -> the name the rest of the game network uses, so transfers to
# intercity / high-speed rail lines (kept hand-made in data.ts) connect.
ALIAS = {"坪山高铁站": "坪山站", "坪山": "坪山站", "深圳机场": "机场", "深圳机场北": "机场北"}

# Game location -> the ONE station pinned onto its building.
CANONICAL = {
    "luohu": "罗湖", "hq": "华强北", "work": "高新园", "apec-qianhai": "前海湾",
    "airport": "机场", "port": "赤湾", "apec-taiziwan": "太子湾", "mall": "后海",
    "apec-xiangmihu": "香蜜", "library": "市民中心", "liantangport": "莲塘口岸",
    "xianhuhu": "仙湖路", "dafen": "大芬", "futianport": "福田口岸", "north": "深圳北站",
    "wutongshan": "梧桐山南", "yantian": "盐田港西", "dameisha": "大梅沙",
    "szbayport": "深圳湾口岸", "talent": "人才公园",
}
LINK_RADIUS = 3.2   # a non-canonical station keeps a location link within this
SIGMA = float(os.environ.get("METRO_SIGMA", 9))  # residual field smoothness (map units)
EPS = 0.15          # how fast the residual correction fades away from anchors
SOFT_KEEP = float(os.environ.get("METRO_SOFT_KEEP", 3.0))  # legacy non-location stations used as anchors if residual < this


def fetch(from_files: list[str] | None = None) -> None:
    if from_files:
        raw = {"elements": [e for f in from_files for e in json.loads(Path(f).read_text())["elements"]]}
    else:
        raw = overpass(QUERY, "shenhui-life-sim-metro-import/1.0")
    nodes = {e["id"]: e for e in raw["elements"] if e["type"] == "node"}
    routes = {}
    for r in raw["elements"]:
        if r["type"] != "relation":
            continue
        name = r.get("tags", {}).get("name", "")
        if not any(name == osm for _, osm, *_ in LINES):
            continue
        stops = []
        for m in r["members"]:
            n = nodes.get(m["ref"]) if m["type"] == "node" and m["role"].startswith("stop") else None
            if n and n.get("tags", {}).get("name"):
                stops.append({"name": n["tags"]["name"], "lat": n["lat"], "lon": n["lon"]})
        if len(stops) > len(routes.get(name, [])):
            routes[name] = stops
    SNAPSHOT.write_text(json.dumps({"source": "OpenStreetMap (ODbL) via Overpass API", "routes": routes}, ensure_ascii=False, indent=1))
    print(f"snapshot: {len(routes)} routes -> {SNAPSHOT.relative_to(ROOT)}")


from places import PLACES_SNAPSHOT, emit_places, fetch_places, overpass  # noqa: E402


def solve3(a, b):
    """Solve a 3x3 linear system by Cramer's rule."""
    def det(m):
        return (m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
                - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
                + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]))
    d = det(a)
    out = []
    for i in range(3):
        m = [row[:] for row in a]
        for r in range(3):
            m[r][i] = b[r]
        out.append(det(m) / d)
    return out


def fit_affine(pairs):
    """pairs: [((X, Y), (x, z))] -> f(X, Y) = (x, z), least squares."""
    ata = [[0.0] * 3 for _ in range(3)]
    atx = [0.0] * 3
    atz = [0.0] * 3
    for (X, Y), (x, z) in pairs:
        v = (X, Y, 1.0)
        for i in range(3):
            for j in range(3):
                ata[i][j] += v[i] * v[j]
            atx[i] += v[i] * x
            atz[i] += v[i] * z
    px, pz = solve3(ata, atx), solve3(ata, atz)
    return px, pz


def main() -> None:
    if "--fetch-places" in sys.argv:
        fetch_places()
    if "--fetch" in sys.argv:
        fetch()
    elif "--from" in sys.argv:  # build the snapshot from a saved Overpass response
        fetch(sys.argv[sys.argv.index("--from") + 1:])
    snap = json.loads(SNAPSHOT.read_text())["routes"]
    legacy = json.loads(ANCHORS.read_text())
    locs = {l["id"]: l for l in legacy["locs"]}

    # ---- ordered station names per game line ----
    seqs: dict[str, list[str]] = {}
    pts: dict[str, list[tuple[float, float]]] = {}
    for lid, osm, *_ in LINES:
        stops = snap[osm]
        if lid == "guangshen":
            stops = list(reversed(stops)) if stops[0]["name"] != "深圳机场" else stops
            cut = next(i for i, x in enumerate(stops) if x["name"] == INTERCITY_LAST_SZ)
            stops = stops[: cut + 2]  # Shenzhen stops + the first Dongguan stop (→ stub)
        names = []
        for s in stops:
            nm = ALIAS.get(s["name"], s["name"])
            pts.setdefault(nm, []).append((s["lat"], s["lon"]))
            if not names or names[-1] != nm:
                names.append(nm)
        seqs[lid] = names

    # ---- real positions in km (equirectangular around the network centre) ----
    lat0 = sum(p[0] for v in pts.values() for p in v) / sum(len(v) for v in pts.values())
    lon0 = sum(p[1] for v in pts.values() for p in v) / sum(len(v) for v in pts.values())
    kx = 111.32 * math.cos(math.radians(lat0))
    km = {n: (sum((p[1] - lon0) * kx for p in v) / len(v), sum(-(p[0] - lat0) * 110.57 for p in v) / len(v)) for n, v in pts.items()}

    # ---- anchors ----
    legacy_xy: dict[str, tuple[float, float]] = {}
    legacy_loc: dict[str, set[str]] = {}
    for line in legacy["lines"]:
        for s in line["stations"]:
            legacy_xy.setdefault(s["name"], (s["x"], s["z"]))
            if s.get("locId"):
                legacy_loc.setdefault(s["name"], set()).add(s["locId"])
    hard = {}
    for loc_id, st in CANONICAL.items():
        if st not in km:
            sys.exit(f"canonical station {st} for {loc_id} missing from OSM data")
        hard[st] = (locs[loc_id]["x"], locs[loc_id]["z"])
    soft_candidates = {n: xy for n, xy in legacy_xy.items() if n in km and n not in hard}

    # robust affine: fit on hard + legacy, drop outliers, refit
    pairs = [(km[n], xy) for n, xy in {**soft_candidates, **hard}.items()]
    px, pz = fit_affine(pairs)
    f = lambda X, Y: (px[0] * X + px[1] * Y + px[2], pz[0] * X + pz[1] * Y + pz[2])
    for _ in range(2):
        res = {n: math.dist(f(*km[n]), xy) for n, xy in soft_candidates.items()}
        soft = {n: xy for n, xy in soft_candidates.items() if res[n] < SOFT_KEEP}
        px, pz = fit_affine([(km[n], xy) for n, xy in {**soft, **hard}.items()])
        f = lambda X, Y, px=px, pz=pz: (px[0] * X + px[1] * Y + px[2], pz[0] * X + pz[1] * Y + pz[2])
    km_per_unit = 1 / math.sqrt(abs(px[0] * pz[1] - px[1] * pz[0]))
    anchors = {**soft, **hard}
    resid = {n: (xy[0] - f(*km[n])[0], xy[1] - f(*km[n])[1]) for n, xy in anchors.items()}

    def place(n: str) -> tuple[float, float]:
        if n in hard:
            return hard[n]
        return place_km(*km[n])

    def place_km(X: float, Y: float) -> tuple[float, float]:
        bx, bz = f(X, Y)
        sw = sx = sz = 0.0
        for a, (rx, rz) in resid.items():
            ax, az = f(*km[a])
            w = math.exp(-((ax - bx) ** 2 + (az - bz) ** 2) / (2 * SIGMA * SIGMA))
            sw += w; sx += w * rx; sz += w * rz
        return (bx + sx / (sw + EPS), bz + sz / (sw + EPS))

    def ease(v: float, lo: float, hi: float, room: float) -> float:
        if v > hi:
            return hi + room * (1 - math.exp(-(v - hi) / room))
        if v < lo:
            return lo - room * (1 - math.exp(-(lo - v) / room))
        return v

    def squeeze(n: str, p: tuple[float, float]) -> tuple[float, float]:
        if n in hard:
            return p
        return (ease(p[0], *SOFT_EDGE["x"]), ease(p[1], *SOFT_EDGE["z"]))

    xy = {n: squeeze(n, place(n)) for n in km}

    # ---- location links ----
    loc_of: dict[str, str] = {st: lid for lid, st in CANONICAL.items()}
    for n, lids in legacy_loc.items():
        if n in loc_of or n not in xy:
            continue
        for lid in sorted(lids):
            L = locs.get(lid)
            if L and math.dist(xy[n], (L["x"], L["z"])) <= LINK_RADIUS:
                loc_of[n] = lid
                break

    # ---- report ----
    worst = sorted(((math.dist(f(*km[n]), anchors[n]), n) for n in soft), reverse=True)[:5]
    print(f"stations: {len(xy)}  lines: {len(seqs)}  km/unit: {km_per_unit:.3f}  anchors: {len(hard)} hard + {len(soft)} legacy")
    print("largest legacy residuals:", ", ".join(f"{n} {d:.1f}" for d, n in worst))
    ratios = []
    for lid, seq in seqs.items():
        for a, b in zip(seq, seq[1:]):
            real = math.dist(km[a], km[b])
            if real > 0.05:
                ratios.append((math.dist(xy[a], xy[b]) / real / (1 / km_per_unit), a, b))
    ratios.sort()
    print("most squashed hops (map/real, 1.0 = true scale):", ", ".join(f"{a}-{b} {r:.2f}" for r, a, b in ratios[:6]))
    print("most stretched hops:", ", ".join(f"{a}-{b} {r:.2f}" for r, a, b in ratios[-4:]))
    names = sorted(xy)
    close = [(a, b, math.dist(xy[a], xy[b])) for i, a in enumerate(names) for b in names[i + 1:] if math.dist(xy[a], xy[b]) < 0.35]
    print(f"station pairs closer than 0.35 units: {len(close)}", close[:8])

    # ---- emit TypeScript ----
    out = [
        "// GENERATED by tools/metro/gen_sz_metro.py — do not edit by hand.",
        "// Shenzhen metro / tram / APM network: station order from OpenStreetMap",
        "// route relations, positions fitted onto the game's miniature map.",
        "// Data © OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright",
        'import type { MetroLine, MetroStation } from "./data";',
        "",
        f"/** Real kilometres per game map unit (from the fit), for distance fares. */",
        f"export const SZ_KM_PER_UNIT = {km_per_unit:.4f};",
        "",
        "const S = (name: string, x: number, z: number, locId?: string): MetroStation => (locId ? { name, x, z, locId } : { name, x, z });",
        "",
        "export const SZ_METRO_LINES: MetroLine[] = [",
    ]
    for lid, _osm, full, short, colour in LINES:
        seq = seqs[lid]
        shown = lambda i, n: INTERCITY_STUB if lid == "guangshen" and i == len(seq) - 1 else n
        sts = ",".join(
            f'S("{shown(i, n)}",{xy[n][0]:.2f},{xy[n][1]:.2f}' + (f',"{loc_of[n]}"' if n in loc_of and shown(i, n) == n else "") + ")"
            for i, n in enumerate(seq)
        )
        out.append(f'  {{ id: "{lid}", name: "{full}", short: "{short}", color: 0x{colour[1:].lower()}, colorCss: "{colour}", city: "sz", stations: [{sts}] }},')
    out.append("];")
    out.append("")
    out.append("/** Real station positions in km (east, south) for distance-based fares. */")
    out.append("export const SZ_REAL_KM: Record<string, [number, number]> = {")
    used = sorted({n for seq in seqs.values() for n in seq})
    out.append("  " + ",".join(f'"{n}":[{km[n][0]:.2f},{km[n][1]:.2f}]' for n in used))
    out.append("};")
    OUT.write_text("\n".join(out) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}")

    if PLACES_SNAPSHOT.exists():
        to_km = lambda lat, lon: ((lon - lon0) * kx, -(lat - lat0) * 110.57)
        emit_places(to_km, lambda X, Y: (ease(place_km(X, Y)[0], *SOFT_EDGE["x"]), ease(place_km(X, Y)[1], *SOFT_EDGE["z"])), xy, km, locs)


if __name__ == "__main__":
    main()
