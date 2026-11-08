"""Real land (lat/lon) for a city's bounding box from the cached OSM coastline."""
import json
from functools import lru_cache
from pathlib import Path
from shapely.geometry import LineString, Point, box
from shapely.ops import polygonize, unary_union
from shapely.strtree import STRtree
HERE = Path(__file__).resolve().parent; ROOT = HERE.parent.parent
BBOX = {"sz": (113.70, 22.15, 114.66, 22.90), "hz": (113.30, 22.45, 115.45, 23.85), "hk": (113.80, 22.13, 114.46, 22.58)}
def cache(ck): return ROOT / "tools/hk/hk-osm-terrain.json" if ck == "hk" else HERE / f"{ck}-osm-terrain.json"

@lru_cache(None)
def pieces(ck):
    """(all polygonised pieces, is_land flags)"""
    raw = json.loads(cache(ck).read_text())
    W, S, E, N = BBOX[ck]
    frame = box(W + 1e-4, S + 1e-4, E - 1e-4, N - 1e-4)
    coast = [LineString([(p["lon"], p["lat"]) for p in w["geometry"]]) for w in raw["coast"] if len(w.get("geometry", [])) >= 2]
    ps = list(polygonize(unary_union([g for g in [c.intersection(frame) for c in coast] + [frame.exterior] if not g.is_empty])))
    segdir = [(a, b) for c in coast for a, b in zip(list(c.coords), list(c.coords)[1:])]
    tree = STRtree([LineString(s) for s in segdir])
    def is_land(poly):
        votes = 0
        for q in [poly.representative_point()] + [Point(poly.exterior.interpolate(t, normalized=True).coords[0]) for t in (0.13, 0.37, 0.61, 0.89)]:
            q = q if poly.contains(q) else poly.representative_point()
            (ax, ay), (bx, by) = segdir[int(tree.nearest(q))]
            votes += 1 if (bx - ax) * (q.y - ay) - (by - ay) * (q.x - ax) > 0 else -1
        return votes > 0
    return ps, [p.area > 1e-7 and is_land(p) for p in ps]

@lru_cache(None)
def hk_boundary():
    return unary_union(list(polygonize(unary_union([LineString(w) for w in json.loads((HERE / "hk-boundary.json").read_text())]))))

@lru_cache(None)
def land_ll(ck):
    """(this city's land, land across a border shown but not walkable) in lat/lon"""
    ps, flags = pieces(ck)
    allland = unary_union([p for p, f in zip(ps, flags) if f]).buffer(0)
    if ck == "sz":
        szb = unary_union(list(polygonize(unary_union([LineString(w) for w in json.loads((HERE / "sz-boundary.json").read_text())])))).buffer(0.002)
        own = allland.intersection(szb).difference(hk_boundary())
        return own, allland.difference(own)
    if ck == "hk": return allland.intersection(hk_boundary()), allland.difference(hk_boundary())
    hzb = unary_union(list(polygonize(unary_union([LineString(w) for w in json.loads((HERE / "hz-boundary.json").read_text())]))))
    return allland.intersection(hzb), allland.difference(hzb)
