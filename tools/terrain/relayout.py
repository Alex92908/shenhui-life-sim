"""Put every game location (and rail station) of a city at its real spot.

  python3 tools/terrain/relayout.py hk|hz|sz [--dry] [--scale]

Positions come from the city's real projection (fits.to_map). Places that would
overlap are nudged apart (a spring pulls each back to its real spot) and kept
on the city's own land; waterfront places may sit right at the shore.
Rewrites x/z in client/src/data.ts, and station coordinates in the city's rail
lines (data.ts for hz/hk, metro-sz.ts for sz). --scale shrinks footprints.
"""
import json, math, re, sys
from pathlib import Path
import numpy as np
from shapely.geometry import Point, Polygon
from shapely.ops import transform, unary_union
HERE = Path(__file__).resolve().parent; ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import fits, landpoly  # noqa: E402
hk, hz = fits.hk, fits.hz
CK = sys.argv[1]
SCALE = 0.82

if CK == "sz":
    LL = {**fits.SZ_LOC_LL}
elif CK == "hk":
    LL = dict(hk.LOC_LL)
else:
    LL = {k: (v[2], v[3]) for k, v in hz.ANCHORS.items() if not k.startswith("@")} | dict(hz.KM_ONLY)
COAST = {
    "sz": {"fun", "port", "szbayport", "talent", "hotel", "apec-taiziwan", "swcac", "octharbour", "qingqing", "xichong", "dameisha", "yantian",
           "yangmeikeng", "futianport", "huanggangport", "luohu", "liantangport", "zhongyingjie", "wenjinduport", "shatoujiaoport", "seagarden", "chunjian", "co-tencent", "mall", "co-bytedance"},
    "hk": {"tst", "central", "westkowloon", "stanley", "saikung", "taio", "tuenmun", "tseungkwano", "oceanpark", "airport-hk", "co-cathay",
           "tungchung", "disney", "vicpark", "co-hkex", "luohu-hk", "kwuntong", "chunyeung", "co-hkstp", "hotel-hk",
           "hzmb-hk", "macauferry", "chinaferry", "kaitak", "lokmachau", "lokmachau-spur", "szbay-hk", "heungyuenwai", "mankamto", "shatauokcp"},
    "hz": {"hejiang", "dongjiangpark", "dayawan", "xunliao", "fun", "haiguiwan", "sanjiaozhou", "home", "xiayong", "tanyue", "co-petro", "xihu", "hostel", "ktv"},
}[CK]
TAG = {"sz": "const SZ_LOCS", "hz": "const HZ_LOCS", "hk": "const HK_LOCS"}[CK]

own, _across = landpoly.land_ll(CK)
land = transform(lambda xs, ys, zs=None: tuple(zip(*[fits.to_map(CK, y, x) for x, y in zip(xs, ys)])), own.simplify(0.0006)).buffer(0)
inside, shore = land.buffer(-1.2), land.buffer(-0.5)
def nearest_in(g, p):
    if g.contains(Point(*p)): return np.array(p)
    gs = [q for q in ([g] if isinstance(g, Polygon) else list(g.geoms)) if isinstance(q, Polygon) and not q.is_empty]
    best = min((q.exterior.interpolate(q.exterior.project(Point(*p))) for q in gs), key=lambda c: c.distance(Point(*p)))
    return np.array([best.x, best.y])
def parts(g): return [g] if isinstance(g, Polygon) else list(g.geoms)
HOME = {}  # each place stays on the landmass it really sits on (no hopping across a harbour)
def snap(p, k):
    if k not in HOME:
        comp = min(parts(land), key=lambda q: q.distance(Point(*tgt[k])))
        for b in ((-0.5, -0.25, 0.0) if k in COAST else (-1.2, -0.6, -0.25, 0.0)):  # small islands: as far in as they allow
            HOME[k] = comp.buffer(b)
            if not HOME[k].is_empty: break
    p = nearest_in(HOME[k], p)
    return np.array([max(-36.0, min(36.0, p[0])), max(-20.8, min(22.8, p[1]))])

src = (ROOT / "client/src/data.ts").read_text()
b0 = src.index(TAG); b1 = src.index("\n];", b0)
blk = src[b0:b1]
ids = re.findall(r'id: "([^"]+)"', blk)
Wd = {m.group(1): float(m.group(2)) for m in re.finditer(r'id: "([^"]+)".*?\bw: ([\d.]+)', blk)}
miss = [k for k in ids if k not in LL]
assert not miss, f"no real position for {miss}"
tgt = {k: np.array(fits.to_map(CK, *LL[k])) for k in ids}
pos = {k: snap(v.copy(), k) for k, v in tgt.items()}
sc = SCALE if "--scale" in sys.argv else 1.0
for it in range(800):
    moved = 0.0
    for a in ids:
        f = (tgt[a] - pos[a]) * 0.02
        for b in ids:
            if b == a: continue
            d = pos[a] - pos[b]; dist = float(np.hypot(*d))
            if dist < 1e-3:  # same spot: part them in a fixed, name-based direction
                ang = (sum(map(ord, a)) - sum(map(ord, b))) * 0.7; d = np.array([math.cos(ang), math.sin(ang)]) * 1e-3; dist = 1e-3
            need = 0.85 * sc * (Wd.get(a, 3) + Wd.get(b, 3)) / 2 + 0.25
            if dist < need: f += (d / max(dist, 1e-3)) * (need - dist) * 0.5
        new = snap(pos[a] + f, a); moved = max(moved, float(np.hypot(*(new - pos[a])))); pos[a] = new
    if moved < 1e-3: break
print("iterations", it)
for k in sorted(ids, key=lambda k: -np.hypot(*(pos[k] - tgt[k])))[:12]:
    print(f"  {k:16s} real=({tgt[k][0]:6.1f},{tgt[k][1]:6.1f}) placed=({pos[k][0]:6.1f},{pos[k][1]:6.1f}) moved {np.hypot(*(pos[k]-tgt[k])):.1f}")

# rail stations
def station_ll(name):
    if CK == "hk":
        n = re.sub(r"站$", "", name); return hk.OSM_ST.get(n) or hk.OSM_ST.get(hk.ALIAS.get(n, ""))
    if CK == "hz":
        extra = {"东莞南": (22.9240, 114.0030), "深圳北·深圳方向": (22.6090, 114.0290), "惠城南": (23.0540, 114.4530)}
        return hz.STATIONS.get(name) or extra.get(name)
    return None
def clamp(x, z): return max(-37.0, min(37.0, x)), max(-21.5, min(23.5, z))
def fix_line(m):
    body = m.group(0)
    def st(mm):
        name, x, z, lid = mm.group(1), mm.group(2), mm.group(3), mm.group(4)
        if lid and lid[2:-1] in pos: p = pos[lid[2:-1]]
        elif CK != "sz" and (ll := station_ll(name)): p = clamp(*fits.to_map(CK, *ll))
        else: return mm.group(0)
        return f'S("{name}",{p[0]:.2f},{p[1]:.2f}{lid or ""})'
    return re.sub(r'S\("([^"]+)",(-?[\d.]+),(-?[\d.]+)(,"[^"]+")?\)', st, body)
unplaced = []
if "--dry" in sys.argv: sys.exit()
fmt = lambda v: f"{round(float(v), 1):g}"
for k in ids:
    blk, n = re.subn(rf'(id: "{re.escape(k)}".*?\bx: )(-?[\d.]+)(, z: )(-?[\d.]+)', lambda m: f"{m.group(1)}{fmt(pos[k][0])}{m.group(3)}{fmt(pos[k][1])}", blk, count=1)
    assert n == 1, k
    if "--scale" in sys.argv:
        for key in ("w", "h"):
            blk = re.sub(rf'(id: "{re.escape(k)}".*?\b{key}: )([\d.]+)', lambda m: f"{m.group(1)}{fmt(float(m.group(2)) * SCALE)}", blk, count=1)
src = src[:b0] + blk + src[b1:]
if CK == "sz":
    mp = ROOT / "client/src/metro-sz.ts"; mp.write_text(re.sub(r'\{ id: "[^"]+", name: .*?city: "sz", stations: \[.*?\] \}', fix_line, mp.read_text()))
    src = re.sub(r'\{ id: "[^"]+", name: [^\n]*?city: "sz", stations: \[.*?\] \}', fix_line, src)
else:
    src = re.sub(rf'\{{ id: "[^"]+", name: [^\n]*?city: "{CK}", stations: \[.*?\] \}}', fix_line, src)
(ROOT / "client/src/data.ts").write_text(src)
(HERE / f"{CK}-real-ll.json").write_text(json.dumps({k: LL[k] for k in ids}))
print("wrote data.ts")
