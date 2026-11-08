"""Hong Kong landmarks from OpenStreetMap, placed on the (schematic) Hong Kong map.

The Hong Kong miniature is hand-drawn (港岛 / 九龙 / 新界 / 大屿山 around a
harbour strip). Real places are tied to it through anchors — the game's 32
locations and 75 MTR stations, each with its real coordinates: an affine fit
from real km to the map, plus an inverse-distance correction from the nearest
anchors, so a place lands in the right neighbourhood. OSM names in Hong Kong
are mostly Traditional Chinese; they are converted to Simplified to match the
game (opencc-python-reimplemented).

  python3 tools/hk/fetch_hk.py        # refresh hk-osm-places.json / hk-osm-areas.json
  python3 tools/hk/gen_hk_places.py   # write client/src/places-hk.ts
Data © OpenStreetMap contributors, ODbL 1.0.
"""
from __future__ import annotations
import json, math, re, sys, zlib
from pathlib import Path
import numpy as np
from opencc import OpenCC
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "tools" / "metro"))
from places import kind_of, KINDS, NEAR_KINDS, SKIP_NAME  # noqa: E402

T2S = OpenCC("t2s").convert
OUT = ROOT / "client" / "src" / "places-hk.ts"
LAT0, LON0 = 22.2935, 114.1700  # 尖沙咀海滨
KX = 111.32 * math.cos(math.radians(LAT0))
def to_km(lat: float, lon: float) -> tuple[float, float]:
    return ((lon - LON0) * KX, -(lat - LAT0) * 110.57)

# game location id -> real (lat, lon)
LOC_LL = {
    "home": (22.3307, 114.1622), "westkowloon": (22.3036, 114.1663), "luohu-hk": (22.5283, 114.1135),
    "central": (22.2810, 114.1588), "kwuntong": (22.3122, 114.2256), "sheungwan": (22.2866, 114.1517),
    "yumatei": (22.3090, 114.1700), "mongkok": (22.3190, 114.1708), "chunyeung": (22.2917, 114.2005),
    "causewaybay": (22.2802, 114.1838), "shatin": (22.3822, 114.1886), "bank-hk": (22.2802, 114.1590),
    "hospital-hk": (22.2701, 114.1311), "library-hk": (22.2797, 114.1910), "vicpark": (22.2820, 114.1880),
    "tst": (22.2935, 114.1700), "peak": (22.2711, 114.1500), "tramroad": (22.2775, 114.1730),
    "disney": (22.3130, 114.0413), "ngongping": (22.2540, 113.9049), "taio": (22.2530, 113.8620),
    "tungchung": (22.2890, 113.9410), "airport-hk": (22.3080, 113.9185), "oceanpark": (22.2467, 114.1757),
    "stanley": (22.2185, 114.2120), "saikung": (22.3816, 114.2735), "wongtaisin": (22.3420, 114.1937),
    "tseungkwano": (22.3075, 114.2600), "yuenlong": (22.4445, 114.0222), "tuenmun": (22.3700, 113.9890),
    "lankwaifong": (22.2810, 114.1555), "hotel-hk": (22.2960, 114.1720),
    "co-hkex": (22.2840, 114.1580), "co-cathay": (22.2985, 113.9395), "co-swire": (22.2860, 114.2120),
    "co-hkstp": (22.4250, 114.2100), "co-mtr": (22.3230, 114.2080),
    "lokmachau": (22.5070, 114.0750), "lokmachau-spur": (22.5145, 114.0657), "szbay-hk": (22.4890, 113.9850), "mankamto": (22.5320, 114.1300), "shatauokcp": (22.5440, 114.2225), "heungyuenwai": (22.5560, 114.1620),
    "hzmb-hk": (22.3170, 113.9440), "macauferry": (22.2890, 114.1520), "chinaferry": (22.2990, 114.1665), "kaitak": (22.3060, 114.2130),
}
# Central's game buildings sit a few map units apart though they are within a
# few hundred metres in reality — keep them for distances, not for the fit.
FIT_SKIP = {"bank-hk", "lankwaifong", "sheungwan", "hotel-hk", "tramroad", "co-hkex"}

def game_data():
    s = (ROOT / "client/src/data.ts").read_text()
    blk = s[s.index("const HK_LOCS"):]; blk = blk[:blk.index("\n];")]
    locs = {}
    for line in blk.split("\n"):
        m = re.search(r'id: "([^"]+)".*?\bx: (-?[\d.]+), z: (-?[\d.]+)', line)
        if m: locs[m.group(1)] = (float(m.group(2)), float(m.group(3)))
    names = [n for n in re.findall(r'name: "([^"]+)"', blk)]
    st = {}
    for m in re.finditer(r'city: "hk", stations: \[(.*?)\] \}', s):
        for n, x, z in re.findall(r'S\("([^"]+)",(-?[\d.]+),(-?[\d.]+)', m.group(1)):
            st.setdefault(n, (float(x), float(z)))
    return locs, names, st

LOCS, LOC_NAMES, GAME_ST = game_data()
RAW = json.loads((HERE / "hk-osm-places.json").read_text())["places"]
def zh(t: dict) -> str:
    """Simplified Chinese name; bilingual OSM names ("深水灣泳灘 Deep Water Bay Beach") keep the Chinese part."""
    n = T2S((t.get("name:zh-Hans") or t.get("name:zh") or t.get("name:zh-Hant") or t.get("name", "")).strip())
    return re.sub(r"\s*[A-Za-z(][A-Za-z0-9 .,'&()\-]*$", "", n).strip() or n

# real station positions (OSM), matched to the game's station names
OSM_ST: dict[str, tuple[float, float]] = {}
for p in RAW:
    t = p["tags"]
    if t.get("railway") != "station": continue
    n = re.sub(r"站$", "", zh(t).split(" ")[0])
    if n in GAME_ST and n not in OSM_ST: OSM_ST[n] = (p["lat"], p["lon"])
ALIAS = {"香港大学": "香港大學"}
ST_KM = {n: to_km(*ll) for n, ll in OSM_ST.items()}

# anchors: (map x, map z, real km X, real km Y)
A = [(*LOCS[k], *to_km(*ll)) for k, ll in LOC_LL.items() if k in LOCS and k not in FIT_SKIP]
A += [(*GAME_ST[n], *ST_KM[n]) for n in ST_KM]
Akm = np.array([[a[2], a[3], 1] for a in A]); Axy = np.array([[a[0], a[1]] for a in A])
M, *_ = np.linalg.lstsq(Akm, Axy, rcond=None)
RES = Axy - Akm @ M

def harbour_fix(x: float, z: float) -> tuple[float, float]:
    """The miniature's Victoria Harbour is a water strip at z 6.1–8.7 (x -17..17)."""
    if -17 < x < 17 and 5.9 < z < 8.9: z = 5.7 if z < 7.4 else 9.1
    return x, z
def coast_z(x: float) -> float:
    return 21.6 + math.sin(x * 0.08 + 1) * 1 + math.sin(x * 0.19 + 0.4) * 0.6
def to_xy_raw(X: float, Y: float) -> tuple[float, float]:
    """Real km -> map, no clamping (coastlines, bridges)."""
    base = np.array([X, Y, 1]) @ M
    d = np.hypot(Akm[:, 0] - X, Akm[:, 1] - Y)
    idx = np.argsort(d)[:5]; w = 1 / np.maximum(d[idx], 0.3) ** 2
    corr = (RES[idx] * w[:, None]).sum(0) / w.sum()
    fade = min(1, 2.5 / max(1e-6, d[idx[0]]))
    return float(base[0] + corr[0] * fade), float(base[1] + corr[1] * fade)
def to_xy(X: float, Y: float) -> tuple[float, float]:
    x, z = to_xy_raw(X, Y)
    x = max(-36.5, min(36.5, x)); z = max(-21, min(coast_z(x) - 1.0, z))
    return harbour_fix(x, z)

# ---- the real projection (tools/terrain/proj.py) replaces the old anchor warp ----
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "terrain"))
import proj  # noqa: E402
def _ll(X: float, Y: float) -> tuple[float, float]:
    return LAT0 - Y / 110.57, LON0 + X / KX
def to_xy_raw(X: float, Y: float) -> tuple[float, float]:
    return proj.xy("hk", *_ll(X, Y))
def to_xy(X: float, Y: float) -> tuple[float, float]:
    return proj.land_snap("hk", *to_xy_raw(X, Y))
def coast_z(x: float) -> float:
    return 99.0
def harbour_fix(x: float, z: float) -> tuple[float, float]:
    return proj.land_snap("hk", x, z)

def main() -> None:
    err = [math.dist(to_xy(a[2], a[3]), (a[0], a[1])) for a in A]
    print(f"anchors {len(A)} (stations matched {len(ST_KM)}/{len(GAME_ST)}), mean fit error {sum(err)/len(err):.2f} units")
    loc_cores = [re.sub(r"\s|·", "", n) for n in LOC_NAMES]
    seen: dict[str, dict] = {}
    for p in RAW:
        t = p["tags"]
        if t.get("railway"): continue
        name = zh(t)
        k = kind_of({**t, "name": name})  # the classifier looks for Simplified keywords (医院, 图书馆, 警…)
        if not k or SKIP_NAME.search(name) or len(name) < 2 or not re.search(r"[一-鿿]", name): continue
        if re.search(r"[A-Za-z]{4,}", name) and not re.search(r"[一-鿿]{2,}", name): continue
        if any(len(name) >= 2 and (name in c or c in name) for c in loc_cores): continue
        if "深圳" in name: continue
        if k == "peak" and name in ("大帽山", "凤凰山", "大东山", "马鞍山", "八仙岭", "飞鹅山", "太平山", "狮子山", "柏架山"): continue  # drawn as real mountains  # border works named after the Shenzhen River read like a mix-up on the HK map
        notable = "wikidata" in t or "wikipedia" in t
        X, Y = to_km(p["lat"], p["lon"])
        if k == "peak":
            m = re.search(r"\d+(?:\.\d+)?", t.get("ele", "")); ele = float(m.group()) if m else 0.0
            if not (notable or ele >= 300): continue
            score = ele / 100
        elif k in NEAR_KINDS:
            score = -min(math.dist((X, Y), (a[2], a[3])) for a in A)
        else:
            min_area = KINDS[k][0] or 0
            if not notable and p["area"] < (0.02 if k == "park" else min_area * 0.5) and not (k == "hospital" and t.get("emergency") == "yes") and k not in ("museum", "library", "beach", "historic", "theatre", "university"):
                continue
            score = (10 if notable else 0) + math.log10(p["area"] + 1e-4) + (3 if t.get("emergency") == "yes" else 0)
        key = name if k not in NEAR_KINDS else f"{name}@{round(X)},{round(Y)}"
        if key in seen and seen[key]["score"] >= score: continue
        seen[key] = {**p, "kind": k, "name": name, "score": score, "X": X, "Y": Y}
    caps = {k: max(8, c * 2 // 3) for k, (_m, c) in KINDS.items()}
    SIGHTS = {"park", "nature", "beach", "themepark", "attraction", "museum", "historic", "peak"}
    caps.update({k: 600 for k in SIGHTS})  # keep parks and sights generously; only services are tightly capped
    caps.update({"park": 250, "historic": 120, "peak": 60})  # Hong Kong maps hundreds of tiny sitting-out areas, relics and hillocks: keep the biggest / best-known
    by: dict[str, list] = {}
    for r in seen.values(): by.setdefault(r["kind"], []).append(r)
    chosen = []
    for k, rs in by.items():
        rs.sort(key=lambda r: -r["score"]); chosen += rs[: caps[k]]
    rows, placed = [], list(LOCS.values())
    for r in sorted(chosen, key=lambda r: -r["score"]):
        x, z = to_xy(r["X"], r["Y"])
        for _ in range(12):
            hit = next((q for q in placed if math.dist((x, z), q) < 0.9), None)
            if not hit: break
            ang = (zlib.crc32(r["id"].encode()) % 360) * math.pi / 180
            x, z = harbour_fix(x + math.cos(ang) * 0.7, min(coast_z(x) - 1.0, z + math.sin(ang) * 0.7))
        placed.append((x, z))
        st = min(ST_KM, key=lambda n: math.dist(ST_KM[n], (r["X"], r["Y"])))
        rows.append((r, x, z, st, math.dist(ST_KM[st], (r["X"], r["Y"]))))
    counts: dict[str, int] = {}
    for r, *_ in rows: counts[r["kind"]] = counts.get(r["kind"], 0) + 1
    print(len(rows), counts)
    esc = lambda s: s.replace("\\", "\\\\").replace('"', '\\"')
    loc_km = {k: [round(v, 2) for v in to_km(*ll)] for k, ll in LOC_LL.items()}
    L = ["// GENERATED by tools/hk/gen_hk_places.py — do not edit by hand.",
         "// Hong Kong landmarks from OpenStreetMap, tied to the game's Hong Kong locations and MTR stations (see the script).",
         "// Data © OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright",
         'import type { CityPlace, PlaceInfo, PlaceKind } from "./places-sz";', "",
         "const P = (id: string, name: string, kind: PlaceKind, x: number, z: number, kx: number, ky: number, st: string, stKm: number, en?: string, info?: PlaceInfo): CityPlace => ({ id, name, kind, x, z, kx, ky, st, stKm, ...(en ? { en } : {}), ...(info ?? {}) });",
         "/** Real km (east, south of 尖沙咀海滨) of the game's Hong Kong locations, for distances. */",
         "export const HK_LOC_KM: Record<string, [number, number]> = " + json.dumps(loc_km) + ";",
         "/** Real km of Hong Kong's MTR stations (same frame). */",
         "export const HK_REAL_KM: Record<string, [number, number]> = " + json.dumps({n: [round(v, 2) for v in xy] for n, xy in ST_KM.items()}, ensure_ascii=False) + ";",
         "", "export const HK_PLACES: CityPlace[] = ["]
    for r, x, z, st, d in sorted(rows, key=lambda row: (row[0]["kind"], row[0]["name"])):
        t = r["tags"]; en = t.get("name:en"); info = {}
        tel = t.get("phone") or t.get("contact:phone")
        if tel: info["tel"] = tel.split(";")[0].strip()
        addr = t.get("addr:full") or "".join(t.get(k, "") for k in ("addr:district", "addr:street", "addr:housenumber"))
        if addr: info["addr"] = T2S(addr)
        if t.get("opening_hours"): info["hours"] = t["opening_hours"]
        if t.get("emergency") == "yes": info["er"] = True
        extra = (f',"{esc(en)}"' if en else (",undefined" if info else "")) + (f",{json.dumps(info, ensure_ascii=False)}" if info else "")
        L.append(f'  P("hk{r["id"]}","{esc(r["name"])}","{r["kind"]}",{x:.2f},{z:.2f},{r["X"]:.2f},{r["Y"]:.2f},"{esc(st)}",{d:.2f}' + extra + "),")
    L.append("];")
    OUT.write_text("\n".join(L) + "\n")
    print("wrote", OUT.relative_to(ROOT))

if __name__ == "__main__":
    main()
