"""Real lat/lon -> game-map (x, z) for each city, shared by the terrain tools.
Shenzhen: the affine + residual fit used for area labels and the skyline;
Huizhou: the anchor warp from gen_hz_places; Hong Kong: gen_hk_places."""
import json, math, re, sys
from pathlib import Path
import numpy as np
ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "tools/hz")); sys.path.insert(0, str(ROOT / "tools/hk")); sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_hz_places as hz  # noqa: E402
import gen_hk_places as hk  # noqa: E402

src = (ROOT / "client/src/places-sz.ts").read_text()
rows = re.findall(r'P\("([^"]+)","[^"]+","\w+",(-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)', src)
rows = [r for r in rows if not r[0].startswith("x")]  # rows added by add_sz_places.py are not fit anchors
osm = {p["id"]: p for p in json.loads((ROOT / "tools/metro/sz-osm-places.json").read_text())["places"]}
anc = [(float(x), float(z), float(kx), float(ky)) for pid, x, z, kx, ky in rows]
lat0 = np.mean([osm[pid]["lat"] + float(ky) / 110.57 for pid, x, z, kx, ky in rows if pid in osm])
KX = 111.32 * math.cos(math.radians(lat0))
lon0 = np.mean([osm[pid]["lon"] - float(kx) / KX for pid, x, z, kx, ky in rows if pid in osm])
A = np.array([[a[2], a[3], 1] for a in anc]); B = np.array([[a[0], a[1]] for a in anc])
M, *_ = np.linalg.lstsq(A, B, rcond=None)
res = B - A @ M
def sz_xy(lat: float, lon: float) -> tuple[float, float]:
    X, Y = (lon - lon0) * KX, -(lat - lat0) * 110.57
    base = np.array([X, Y, 1]) @ M
    d = np.hypot(A[:, 0] - X, A[:, 1] - Y)
    idx = np.argsort(d)[:5]; w = 1 / np.maximum(d[idx], 0.3) ** 2
    corr = (res[idx] * w[:, None]).sum(0) / w.sum()
    fade = min(1, 3 / max(1e-6, d[idx[0]]))
    return float(base[0] + corr[0] * fade), float(base[1] + corr[1] * fade)

import proj  # noqa: E402
def to_map(ck: str, lat: float, lon: float) -> tuple[float, float]:
    """The one real projection per city (every place, coast, road and label uses it)."""
    if ck == "sz": return sz_xy(lat, lon)
    return proj.xy(ck, lat, lon)
T2S = hk.T2S

# ---- Shenzhen terrain: bend the fit to the game's own (hand-placed) layout ----
# The station fit is exact inland but the hand-built map pushes the coast
# south; coastlines are therefore also pulled by the game locations' real
# spots (inverse-distance residuals that fade out ~8 km from any anchor).
SZ_LOC_LL = {
    "fun": (22.5180, 113.9450), "talent": (22.5100, 113.9530), "szbayport": (22.4950, 113.9450), "futianport": (22.5160, 114.0670),
    "huanggangport": (22.5230, 114.0750), "wenjinduport": (22.5395, 114.1285), "shatoujiaoport": (22.5465, 114.2245), "luohu": (22.5320, 114.1170), "liantangport": (22.5560, 114.1600), "zhongyingjie": (22.5480, 114.2280),
    "yantian": (22.5650, 114.2600), "dameisha": (22.5930, 114.3080), "co-vanke": (22.6040, 114.3020), "octeast": (22.6220, 114.2900),
    "xichong": (22.4790, 114.5490), "yangmeikeng": (22.5480, 114.5800), "qiniangshan": (22.5370, 114.5740), "dapengfort": (22.5950, 114.5110),
    "port": (22.4800, 113.9140), "apec-taiziwan": (22.4820, 113.9130), "swcac": (22.4830, 113.9180), "octharbour": (22.5240, 113.9850),
    "chunjian": (22.5170, 113.9430), "mall": (22.5170, 113.9370), "apec-qianhai": (22.5370, 113.8950), "co-penguin": (22.5560, 113.8710),
    "airport": (22.6390, 113.8110), "seagarden": (22.7390, 113.7770), "wutongshan": (22.5830, 114.1980), "xianhuhu": (22.5800, 114.1700),
    "happyvalley": (22.5410, 113.9840), "window": (22.5370, 113.9730), "jinxiu": (22.5340, 113.9790), "lianhua": (22.5550, 114.0530),
    "apec-xiangmihu": (22.5550, 114.0250), "library": (22.5450, 114.0570), "bank": (22.5360, 114.0560), "food": (22.5480, 114.1180),
    "hq": (22.5450, 114.0880), "north": (22.6090, 114.0290), "co-byd": (22.7020, 114.3570), "universiade": (22.6980, 114.2120),
    "safari": (22.5970, 113.9740), "tanglangshan": (22.5870, 113.9960), "fenghuangshan": (22.6720, 113.8670), "gmfarm": (22.7650, 113.9180),
    "missionhills": (22.7230, 114.0660), "dafen": (22.6150, 114.1370), "co-tencent": (22.5230, 113.9360), "co-huawei": (22.6550, 114.0640),
    "szmuseum": (22.5480, 114.0640), "work": (22.5400, 113.9500), "co-zte": (22.5340, 113.9450), "co-cmb": (22.5390, 114.0280),
}
_east = Path(__file__).resolve().parent / "sz-real-ll.json"
if _east.exists(): SZ_LOC_LL.update({k: tuple(v) for k, v in json.loads(_east.read_text()).items()})  # relayout_sz_east.py
def _sz_locs():
    s = (ROOT / "client/src/data.ts").read_text()
    blk = s[s.index("const SZ_LOCS"):]; blk = blk[:blk.index("\n];")]
    out = {}
    for line in blk.split("\n"):
        m = re.search(r'id: "([^"]+)".*?\bx: (-?[\d.]+), z: (-?[\d.]+)', line)
        if m: out[m.group(1)] = (float(m.group(2)), float(m.group(3)))
    return out
_L = _sz_locs()
_SZA = [(lat, lon, *_L[k]) for k, (lat, lon) in SZ_LOC_LL.items() if k in _L]
_SZR = np.array([[mx - sz_xy(lat, lon)[0], mz - sz_xy(lat, lon)[1]] for lat, lon, mx, mz in _SZA])
_SZK = np.array([[(lon - lon0) * KX, -(lat - lat0) * 110.57] for lat, lon, _mx, _mz in _SZA])
def sz_terrain_xy(lat: float, lon: float) -> tuple[float, float]:
    x, z = sz_xy(lat, lon)
    X, Y = (lon - lon0) * KX, -(lat - lat0) * 110.57
    d = np.hypot(_SZK[:, 0] - X, _SZK[:, 1] - Y)
    idx = np.argsort(d)[:5]; w = 1 / np.maximum(d[idx], 0.4) ** 2
    corr = (_SZR[idx] * w[:, None]).sum(0) / w.sum()
    fade = max(0.0, min(1.0, (9 - d[idx[0]]) / 6))
    return x + float(corr[0]) * fade, z + float(corr[1]) * fade
