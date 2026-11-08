"""Real land, inland water and bridges for a city map (sz | hz | hk).

OSM coastline ways (land on the left of each way) are polygonised together with
the bounding box; each piece is classified land / sea by which side of its
nearest coastline segment it lies on. Land, named reservoirs / lakes / rivers
and named long bridges that actually cross water are warped onto the miniature
with the city's own fit (fits.to_map), clipped to the map and simplified.

  python3 tools/terrain/gen_terrain.py sz --fetch   # download + write client/src/terrain-sz.ts
  python3 tools/terrain/gen_terrain.py hz           # reuse the cached download
Data © OpenStreetMap contributors, ODbL 1.0.
"""
import json, math, re, sys, warnings
from pathlib import Path
import numpy as np
warnings.filterwarnings("ignore", category=DeprecationWarning)
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import polygonize, unary_union, transform
from shapely.strtree import STRtree
HERE = Path(__file__).resolve().parent; ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(ROOT / "tools/metro"))
import fits  # noqa: E402

CK = sys.argv[1]
BBOX = {"sz": (113.70, 22.15, 114.66, 22.90), "hz": (113.30, 22.45, 115.45, 23.85), "hk": (113.80, 22.13, 114.46, 22.58)}[CK]
CACHE = ROOT / "tools/hk/hk-osm-terrain.json" if CK == "hk" else HERE / f"{CK}-osm-terrain.json"
W, S, E, N = BBOX
if "--fetch" in sys.argv:
    from places import overpass  # noqa: E402
    bb = f"{S},{W},{N},{E}"
    coast = overpass(f'[out:json][timeout:300];(way["natural"="coastline"]({bb}););out geom;', "shenhui-life-sim-terrain/1.0")["elements"]
    water = overpass(f'[out:json][timeout:300];(nwr["natural"="water"]["water"~"^(reservoir|lake|river|lagoon)$"]["name"]({bb});nwr["waterway"="riverbank"]["name"]({bb}););out geom;', "shenhui-life-sim-terrain/1.0")["elements"]
    bridges = overpass(f'[out:json][timeout:300];(way["bridge"]["highway"~"^(motorway|trunk|primary)$"]["name"~"大桥|大橋|Bridge"]({bb}););out geom;', "shenhui-life-sim-terrain/1.0")["elements"]
    rivers = overpass(f'[out:json][timeout:300];(way["waterway"="river"]["name"~"^(东江|西枝江|深圳河|茅洲河|淡水河|龙岗河|觀音山|梧桐|大沙河)"]({bb}););out geom;', "shenhui-life-sim-terrain/1.0")["elements"]
    CACHE.write_text(json.dumps({"coast": coast, "water": water, "bridges": bridges, "rivers": rivers}))
    print("fetched", len(coast), "coast ways,", len(water), "water,", len(bridges), "bridge ways")
raw = json.loads(CACHE.read_text())

import landpoly  # noqa: E402
own_ll, across_ll = landpoly.land_ll(CK)
pieces, _flags = landpoly.pieces(CK)
land_ll = [own_ll] if isinstance(own_ll, Polygon) else list(own_ll.geoms)
hkb = landpoly.hk_boundary()
print(CK, "pieces", len(pieces), "land", len(land_ll))

def warp(g):
    return transform(lambda xs, ys, zs=None: tuple(zip(*[fits.to_map(CK, y, x) for x, y in zip(xs, ys)])), g)
MAP = box(-38, -22, 38, 24)
def polys(g):
    return [g] if isinstance(g, Polygon) else [x for x in getattr(g, "geoms", []) if isinstance(x, Polygon)]
def rings(g, tol, min_area):
    out = []
    for p in polys(g):
        for q in polys(p.buffer(0).intersection(MAP)):
            q = q.simplify(tol, preserve_topology=True)
            if q.is_empty or q.area < min_area: continue
            r = lambda ring: [[round(x, 2), round(z, 2)] for x, z in list(ring.coords)[:-1]]
            out.append([r(q.exterior)] + [r(h) for h in q.interiors if Polygon(h).area > min_area])
    return out
land_map = unary_union([warp(p).buffer(0) for p in land_ll])
ACROSS = []
if across_ll is not None and not across_ll.is_empty:
    # the neighbour across the border (Hong Kong on the Shenzhen map and vice versa): drawn, not walkable
    across_map = unary_union([warp(g).buffer(0) for g in polys(across_ll.buffer(0))])
    ACROSS = rings(across_map.difference(land_map.buffer(0.05)).intersection(MAP), 0.15, 0.4)
LAND = rings(land_map, 0.12, 0.2)
print("land polygons", len(LAND), "vertices", sum(len(r) for p in LAND for r in p))

water_ll = []
for w in raw["water"]:
    if w.get("tags", {}).get("water") == "river" or w.get("tags", {}).get("waterway") == "riverbank": continue
    if w["type"] == "way" and len(w.get("geometry", [])) >= 4:
        water_ll.append(Polygon([(p["lon"], p["lat"]) for p in w["geometry"]]).buffer(0))
    elif w["type"] == "relation":
        outs = [LineString([(p["lon"], p["lat"]) for p in m["geometry"]]) for m in w.get("members", []) if m.get("role") == "outer" and m.get("geometry")]
        water_ll += [pg.buffer(0) for pg in polygonize(unary_union(outs))]
# rivers are drawn from their centrelines (RIVERS below); their polygons smear under the warp
water_ll = [p for p in water_ll if p.area > 0]
water_ll = [p for p in water_ll if not p.is_empty]
WATER = rings(unary_union([warp(p).buffer(0) for p in water_ll]), 0.1, 0.35) if water_ll else []
WATER = [w for w in WATER if 4 * math.pi * Polygon(w[0]).area / max(1e-9, Polygon(w[0]).length ** 2) > 0.12]
WATER = [w for w in WATER if land_map.contains(Polygon(w[0]).representative_point())]
print("water polygons", len(WATER))

land_u = unary_union(land_ll); water_u = unary_union(water_ll) if water_ll else Polygon()
def zh(n: str) -> str:
    return re.sub(r"\s*[A-Za-z(].*$", "", fits.T2S(n)).strip()
groups: dict[str, list] = {}
for b in raw["bridges"]:
    n = zh(b["tags"].get("name", ""))
    if n: groups.setdefault(n, []).extend((p["lon"], p["lat"]) for p in b["geometry"])
BRIDGES = []
for n, pts in groups.items():
    P = np.array(pts)
    if len(P) < 2: continue
    i, j = max(((a, c) for a in range(len(P)) for c in range(a + 1, len(P))), key=lambda ac: np.hypot(*(P[ac[0]] - P[ac[1]])))
    mid = Point(*(P[i] + P[j]) / 2)
    if land_u.contains(mid) and not water_u.contains(mid): continue  # a "大桥" over a road or a ditch
    (ax, az), (bx, bz) = fits.to_map(CK, P[i][1], P[i][0]), fits.to_map(CK, P[j][1], P[j][0])
    if math.hypot(bx - ax, bz - az) < 0.8 or not (MAP.contains(Point(ax, az)) or MAP.contains(Point(bx, bz))): continue
    BRIDGES.append({"name": n, "a": [round(ax, 2), round(az, 2)], "b": [round(bx, 2), round(bz, 2)]})
_own = unary_union([Polygon(p[0]).buffer(0) for p in LAND]).buffer(0.6)  # bridges must land on this city (港珠澳大桥 is Hong Kong's)
BRIDGES = [b for b in BRIDGES if _own.contains(Point(*b["a"])) or _own.contains(Point(*b["b"]))]
BRIDGES = sorted(BRIDGES, key=lambda b: -math.dist(b["a"], b["b"]))[:10]
print("bridges", [b["name"] for b in BRIDGES])

# rivers: named centrelines -> map polylines (drawn as ribbons)
RIVERS = []
for w in raw.get("rivers", []):
    pts = [fits.to_map(CK, p["lat"], p["lon"]) for p in w.get("geometry", [])]
    pts = [(round(x, 2), round(z, 2)) for x, z in pts if -40 < x < 40 and -24 < z < 26]
    if len(pts) >= 2:
        ls = LineString(pts).simplify(0.15)
        if ls.is_empty or ls.geom_type != "LineString": continue
        if ls.length > 1.5: RIVERS.append({"name": zh(w["tags"].get("name", "")), "pts": [[round(x, 2), round(z, 2)] for x, z in ls.coords]})
print("rivers", len(RIVERS), sorted({r["name"] for r in RIVERS}))

PEAKS_LL = {"sz": [("梧桐山", 22.5806, 114.2011, 944), ("七娘山", 22.5190, 114.5560, 869), ("梅沙尖", 22.6050, 114.2780, 753), ("三洲田", 22.6290, 114.2610, 580)],
            "hz": [("罗浮山", 23.2725, 114.0636, 1296), ("南昆山", 23.6447, 113.8475, 1228), ("象头山", 23.2939, 114.4013, 1024), ("白云嶂", 22.9550, 114.5200, 1003), ("莲花山", 22.9650, 115.0400, 1336), ("高榜山", 23.0720, 114.3720, 254)],
            "hk": [("大帽山", 22.4106, 114.1239, 957), ("凤凰山", 22.2536, 113.9184, 934), ("大东山", 22.2611, 113.9416, 869),
                   ("马鞍山", 22.4011, 114.2550, 702), ("八仙岭", 22.4870, 114.2350, 639), ("飞鹅山", 22.3540, 114.2220, 602),
                   ("太平山", 22.2759, 114.1453, 552), ("狮子山", 22.3523, 114.1867, 495), ("柏架山", 22.2633, 114.2083, 532)]}.get(CK, [])
PEAKS = []
for n, lat, lon, ele in PEAKS_LL:
    x, z = fits.to_map(CK, lat, lon)
    x, z = max(-37.0, min(37.0, x)), max(-21.5, min(23.5, z))  # a peak just past the edge stands at the edge
    if MAP.contains(Point(x, z)): PEAKS.append({"name": n, "x": round(x, 2), "z": round(z, 2), "ele": ele})

name = {"sz": "Shenzhen", "hz": "Huizhou", "hk": "Hong Kong"}[CK]
L = [f"// GENERATED by tools/terrain/gen_terrain.py {CK} — do not edit by hand.",
     f"// {name}'s real land (OSM coastline), inland water and bridges, warped onto the map.",
     "// Data © OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright",
     "/** Land polygons: [outer ring, ...holes], each ring [x, z][] in map units. */",
     "export const LAND: [number, number][][][] = " + json.dumps(LAND, separators=(",", ":")) + ";",
     "/** Reservoirs, lakes and rivers on land. */",
     "export const WATER: [number, number][][][] = " + json.dumps(WATER, separators=(",", ":")) + ";",
     "export interface MapBridge { name: string; a: [number, number]; b: [number, number] }",
     "export const BRIDGES: MapBridge[] = " + json.dumps(BRIDGES, ensure_ascii=False) + ";",
     "/** Main peaks at their real spots, with real elevations (m). */",
     "export const PEAKS: { name: string; x: number; z: number; ele: number }[] = " + json.dumps(PEAKS, ensure_ascii=False) + ";",
     "/** Neighbouring territory seen across a border (Hong Kong on the Shenzhen map): drawn, not walkable. */",
     "export const ACROSS: [number, number][][][] = " + json.dumps(ACROSS, separators=(",", ":")) + ";",
     "/** Main rivers as centrelines, drawn as ribbons. */",
     "export const RIVERS: { name: string; pts: [number, number][] }[] = " + json.dumps(RIVERS, ensure_ascii=False, separators=(",", ":")) + ";", ""]
out = ROOT / f"client/src/terrain-{CK}.ts"
out.write_text("\n".join(L))
print("wrote", out.relative_to(ROOT), out.stat().st_size, "bytes")
