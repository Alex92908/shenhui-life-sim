"""Real lat/lon -> map (x, z) for Hong Kong and Huizhou.

One uniform scale per city (north up, true shapes and bearings), plus smooth
"fisheye" magnification over the dense city centres so their places have room.
Each bump is radial and monotonic (a < 2.2), so nothing folds over: neighbours
stay neighbours and coastlines keep their real shape. Shenzhen uses the metro
station fit in fits.sz_xy (already near-uniform, ~1 unit per km).
"""
import math

# per city: origin (lat, lon) mapped to (x0, z0), map units per km, bumps (lat, lon, strength a, radius km)
CITY = {
    "hk": {"o": (22.3700, 114.1300), "xz0": (7.18, 2.63), "s": 1.12,
           "bumps": [(22.2930, 114.1690, 1.5, 3.2), (22.3220, 114.1750, 0.6, 3.0), (22.2800, 114.1800, 0.5, 2.5), (22.2830, 114.1570, 0.7, 1.6)]},
    "hz": {"o": (23.0900, 114.3500), "xz0": (-6.23, -8.87), "s": 0.50,
           "bumps": [(23.0950, 114.4000, 2.2, 6.5), (23.0450, 114.3200, 1.0, 6.0), (22.7800, 114.4900, 1.2, 7.0), (22.6500, 114.8000, 1.0, 7.0)]},
}
LAT_KM = 110.57
def km(ck: str, lat: float, lon: float) -> tuple[float, float]:
    la0, lo0 = CITY[ck]["o"]
    return ((lon - lo0) * 111.32 * math.cos(math.radians(la0)), -(lat - la0) * LAT_KM)
def xy(ck: str, lat: float, lon: float) -> tuple[float, float]:
    c = CITY[ck]
    X, Y = km(ck, lat, lon)
    dx = dy = 0.0
    for bl, bo, a, r in c["bumps"]:
        cx, cy = km(ck, bl, bo)
        ex, ey = X - cx, Y - cy
        f = a * math.exp(-(ex * ex + ey * ey) / (r * r))
        dx += ex * f; dy += ey * f
    return c["xz0"][0] + c["s"] * (X + dx), c["xz0"][1] + c["s"] * (Y + dy)

# ---- keep generated pins on the city's own land (client/src/terrain-<ck>.ts) ----
_LAND = {}
def _land(ck: str):
    if ck not in _LAND:
        import json, re
        from pathlib import Path
        from shapely.geometry import Polygon
        from shapely.ops import unary_union
        ts = (Path(__file__).resolve().parent.parent.parent / f"client/src/terrain-{ck}.ts").read_text()
        polys = json.loads(re.search(r"export const LAND[^=]*= (.*);", ts).group(1))
        _LAND[ck] = unary_union([Polygon(p[0], p[1:]).buffer(0) for p in polys])
    return _LAND[ck]
def land_snap(ck: str, x: float, z: float, margin: float = 0.5) -> tuple[float, float]:
    """(x, z) if it is on land, else the nearest point at least `margin` inside the coast."""
    from shapely.geometry import Point
    g = _land(ck); p = Point(x, z)
    if g.buffer(-margin * 0.5).contains(p): return x, z
    inner = g.buffer(-margin)
    parts = [inner] if inner.geom_type == "Polygon" else list(getattr(inner, "geoms", []))
    if not parts: return x, z
    q = min((pp.exterior.interpolate(pp.exterior.project(p)) for pp in parts), key=lambda c: c.distance(p))
    return q.x, q.y
