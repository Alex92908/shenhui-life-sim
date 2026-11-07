"""Huizhou landmarks from OpenStreetMap, placed on the (schematic) Huizhou game map.

Shenzhen's map is fitted to real geography through its metro stations; Huizhou's
miniature is hand-drawn, so real places are tied to the game locations instead:
each anchor below is a game location (x, z) with its real coordinates, and a place
sits at the inverse-distance-weighted blend of "anchor + real offset" over its
nearest anchors — it lands in the right neighbourhood of the miniature.

  python3 tools/hz/fetch_hz.py        # refresh tools/hz/hz-osm-places.json
  python3 tools/hz/gen_hz_places.py   # write client/src/places-hz.ts
Data © OpenStreetMap contributors, ODbL 1.0.
"""
from __future__ import annotations
import json, math, re, sys, zlib
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "tools" / "metro"))
from places import kind_of, KINDS, NEAR_KINDS, SKIP_NAME  # noqa: E402

OUT = ROOT / "client" / "src" / "places-hz.ts"
LAT0, LON0 = 23.0870, 114.3970  # 惠州西湖
KX = 111.32 * math.cos(math.radians(LAT0))
def to_km(lat: float, lon: float) -> tuple[float, float]:
    return ((lon - LON0) * KX, -(lat - LAT0) * 110.57)

# game location id -> (x, z, lat, lon)
ANCHORS = {
    "luofu": (-25, -14, 23.2677, 114.0302), "nankunshan": (-29, -19, 23.6391, 113.8674),
    "xiangtoushan": (-19, -15, 23.2898, 114.3899), "work": (-20, -3, 23.0400, 114.3400),
    "gym": (-17, 3, 23.0779, 114.3781), "library": (-14, -7, 23.1175, 114.4098),
    "xihu": (-13, 1, 23.0870, 114.3970), "hostel": (-15, 5, 23.0820, 114.3920),
    "hospital": (-6, -11, 23.1160, 114.4053), "huamao": (-3, -14, 23.1066, 114.4098),
    "hejiang": (-6, 7, 23.0905, 114.4135), "food": (-5, 2, 23.0939, 114.4048),
    "gaobangshan": (-9, -14, 23.0843, 114.3687), "dongjiangpark": (-1, 4, 23.1015, 114.4105),
    "hzbotanic": (-16, -10, 23.0965, 114.3761), "hzsouth": (2, 7, 22.7880, 114.4850),
    "danshui": (7, 3, 22.7850, 114.4620), "dayawan": (11, 10, 22.7768, 114.6692),
    "xiayong": (13, 13.5, 22.7705, 114.6513), "xunliao": (20, 8, 22.6808, 114.7454),
    "fun": (27, 10, 22.6005, 114.9085), "haiguiwan": (31, 14, 22.5526, 114.8909),
    "sanjiaozhou": (21, 12.5, 22.6450, 114.7700), "pingtan-airport": (9, -9, 23.0517, 114.6005),
    "home": (23, 4, 22.6270, 114.8880), "hotel": (17, 1, 22.9700, 114.7200), "hq": (-11, -4, 23.0950, 114.4250),
    "metro": (-10, 6, 23.0659, 114.3897), "mall": (-8, -6, 23.0706, 114.4120), "bank": (-2, -8, 23.1100, 114.4180),
    "ktv": (-3, -3, 23.1000, 114.4200), "hzmuseum": (-6.5, -16.5, 23.1089, 114.4129),
    "@惠州北": (0, -16, 23.1825, 114.3756), "@惠东站": (18, 2, 22.9355, 114.7372),
}
# game locations whose real spot is known but which shouldn't steer the place
# layout (several sit within a km of each other in 仲恺 but far apart on the map)
KM_ONLY = {"co-tcl": (23.0344, 114.3343), "co-desay": (23.0472, 114.3428), "co-eve": (23.0605, 114.2376), "co-petro": (22.7548, 114.5875)}
# game rail stations -> real position (for "nearest station")
STATIONS = {
    "仲恺": (23.0294, 114.2618), "沥林北": (22.9818, 114.2249), "陈江南": (23.0087, 114.3219), "惠环": (23.0327, 114.3610),
    "龙丰": (23.0659, 114.3897), "惠州西湖": (23.0891, 114.3958), "云山": (23.1127, 114.4125), "江北·小金口": (23.1543, 114.4132),
    "惠州北": (23.1825, 114.3756), "惠州南站": (22.7880, 114.4850), "惠东站": (22.9355, 114.7372),
}
S = 0.6  # game units per real km around an anchor

def coast_z(x: float) -> float:
    return 14.6 + math.sin(x * 0.09 + 2) * 1.2 + math.sin(x * 0.21 + 0.6) * 0.7

A = [(k, x, z, *to_km(lat, lon)) for k, (x, z, lat, lon) in ANCHORS.items()]
def to_xy(X: float, Y: float) -> tuple[float, float]:
    near = sorted(A, key=lambda a: math.dist((a[3], a[4]), (X, Y)))[:4]
    ws = [1 / max(0.3, math.dist((a[3], a[4]), (X, Y))) ** 3 for a in near]
    x = sum(w * (a[1] + S * (X - a[3])) for w, a in zip(ws, near)) / sum(ws)
    z = sum(w * (a[2] + S * (Y - a[4])) for w, a in zip(ws, near)) / sum(ws)
    x = max(-36.5, min(36.5, x))
    z = max(-21, min(coast_z(x) - 1.0, z))
    return x, z

def main() -> None:
    raw = json.loads((HERE / "hz-osm-places.json").read_text())["places"]
    loc_names = ["西湖", "罗浮山", "南昆山", "象头山", "红花湖", "惠州市图书馆", "惠州市第一人民医院", "华贸", "合江楼", "高榜山",
                 "东江公园", "惠州市植物园", "惠州植物园", "双月湾", "巽寮湾", "海龟湾", "大亚湾黄金海岸", "三角洲", "平潭机场", "惠州南站", "淡水老城"]
    seen: dict[str, dict] = {}
    for p in raw:
        t = p["tags"]
        if any(k in t for k in ("railway", "aeroway", "office", "landuse")): continue
        k = kind_of(t)
        name = t["name"].strip()
        if not k or SKIP_NAME.search(name) or re.search(r"检查点|终点|起点|界址|，", name) or len(name) < 2 or not re.search(r"[一-鿿]", name): continue
        if any(ln in name or name in ln for ln in loc_names if len(name) >= 2): continue
        notable = "wikidata" in t or "wikipedia" in t
        X, Y = to_km(p["lat"], p["lon"])
        if k == "peak":
            if not (notable or float(re.sub(r"[^\d.]", "", t.get("ele", "0")) or 0) >= 300): continue
            score = float(re.sub(r"[^\d.]", "", t.get("ele", "0")) or 0) / 100
        elif k in NEAR_KINDS:
            # services close to where players go
            score = -min(math.dist((X, Y), (a[3], a[4])) for a in A)
        else:
            min_area = KINDS[k][0] or 0
            if not notable and p["area"] < min_area * 0.5 and not (k == "hospital" and t.get("emergency") == "yes") and k not in ("museum", "library", "beach", "historic", "theatre", "university"):
                continue
            score = (10 if notable else 0) + math.log10(p["area"] + 1e-4) + (3 if t.get("emergency") == "yes" else 0)
        key = name if k not in NEAR_KINDS else f"{name}@{round(X)},{round(Y)}"
        if key in seen and seen[key]["score"] >= score: continue
        seen[key] = {**p, "kind": k, "name": name, "score": score, "X": X, "Y": Y}
    caps = {k: max(6, c // 2) for k, (_m, c) in KINDS.items()}
    by: dict[str, list] = {}
    for r in seen.values(): by.setdefault(r["kind"], []).append(r)
    chosen = []
    for k, rs in by.items():
        rs.sort(key=lambda r: -r["score"]); chosen += rs[: caps[k]]
    rows, placed = [], [(x, z) for (x, z, _a, _b) in ANCHORS.values()]
    st_km = {n: to_km(*ll) for n, ll in STATIONS.items()}
    for r in sorted(chosen, key=lambda r: -r["score"]):
        x, z = to_xy(r["X"], r["Y"])
        # nudge off other pins / game buildings
        for _ in range(12):
            hit = next((q for q in placed if math.dist((x, z), q) < 0.9), None)
            if not hit: break
            ang = (zlib.crc32(r["id"].encode()) % 360) * math.pi / 180
            x, z = x + math.cos(ang) * 0.7, z + math.sin(ang) * 0.7
            z = min(coast_z(x) - 1.0, z)
        placed.append((x, z))
        st = min(st_km, key=lambda n: math.dist(st_km[n], (r["X"], r["Y"])))
        rows.append((r, x, z, st, math.dist(st_km[st], (r["X"], r["Y"]))))
    counts: dict[str, int] = {}
    for r, *_ in rows: counts[r["kind"]] = counts.get(r["kind"], 0) + 1
    print(len(rows), counts)
    esc = lambda s: s.replace("\\", "\\\\").replace('"', '\\"')
    L = ["// GENERATED by tools/hz/gen_hz_places.py — do not edit by hand.",
         "// Huizhou landmarks from OpenStreetMap, tied to the game's Huizhou locations (see the script).",
         "// Data © OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright",
         'import type { CityPlace, PlaceInfo, PlaceKind } from "./places-sz";', "",
         "const P = (id: string, name: string, kind: PlaceKind, x: number, z: number, kx: number, ky: number, st: string, stKm: number, en?: string, info?: PlaceInfo): CityPlace => ({ id, name, kind, x, z, kx, ky, st, stKm, ...(en ? { en } : {}), ...(info ?? {}) });",
         "/** Real km (east, south of 惠州西湖) of the game's Huizhou locations, for distances. */",
         "export const HZ_LOC_KM: Record<string, [number, number]> = " + json.dumps({**{k: [round(v, 2) for v in to_km(lat, lon)] for k, (_x, _z, lat, lon) in ANCHORS.items() if not k.startswith("@")}, **{k: [round(v, 2) for v in to_km(*ll)] for k, ll in KM_ONLY.items()}}) + ";",
         "/** Real km of Huizhou's rail stations (same frame). */",
         "export const HZ_REAL_KM: Record<string, [number, number]> = " + json.dumps({n: [round(v, 2) for v in xy] for n, xy in st_km.items()}, ensure_ascii=False) + ";",
         "", "export const HZ_PLACES: CityPlace[] = ["]
    for r, x, z, st, d in sorted(rows, key=lambda row: (row[0]["kind"], row[0]["name"])):
        t = r["tags"]; en = t.get("name:en"); info = {}
        tel = t.get("phone") or t.get("contact:phone")
        if tel: info["tel"] = tel.split(";")[0].strip()
        addr = t.get("addr:full") or "".join(t.get(k, "") for k in ("addr:district", "addr:street", "addr:housenumber"))
        if addr: info["addr"] = addr
        if t.get("opening_hours"): info["hours"] = t["opening_hours"]
        if t.get("emergency") == "yes": info["er"] = True
        extra = (f',"{esc(en)}"' if en else (",undefined" if info else "")) + (f",{json.dumps(info, ensure_ascii=False)}" if info else "")
        L.append(f'  P("hz{r["id"]}","{esc(r["name"])}","{r["kind"]}",{x:.2f},{z:.2f},{r["X"]:.2f},{r["Y"]:.2f},"{esc(st)}",{d:.2f}' + extra + "),")
    L.append("];")
    OUT.write_text("\n".join(L) + "\n")
    print("wrote", OUT.relative_to(ROOT))

if __name__ == "__main__":
    main()
