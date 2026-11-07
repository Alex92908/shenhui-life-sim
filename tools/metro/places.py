"""Shenzhen landmarks (parks, malls, hospitals, museums, beaches …) from
OpenStreetMap, placed on the game map with the SAME fit as the metro
stations so every place sits in the right spot relative to its station.

Used by gen_sz_metro.py:
  --fetch-places   re-download the OSM snapshot (tools/metro/sz-osm-places.json)
Writes client/src/places-sz.ts. Data © OpenStreetMap contributors, ODbL.
"""
from __future__ import annotations

import json
import math
import re
import shutil
import ssl
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
PLACES_SNAPSHOT = HERE / "sz-osm-places.json"
OUT = ROOT / "client" / "src" / "places-sz.ts"
OVERPASS = "https://overpass-api.de/api/interpreter"
QUERY = """[out:json][timeout:180];
area["boundary"="administrative"]["name"="深圳市"]->.sz;
(
  nwr["tourism"~"^(attraction|museum|theme_park|zoo|gallery|aquarium)$"]["name"](area.sz);
  nwr["leisure"~"^(park|nature_reserve|stadium|water_park)$"]["name"](area.sz);
  nwr["shop"="mall"]["name"](area.sz);
  nwr["amenity"~"^(hospital|university|library|theatre)$"]["name"](area.sz);
  nwr["natural"~"^(beach|peak)$"]["name"](area.sz);
  nwr["historic"~"^(fort|castle|city_gate|monument|memorial)$"]["name"](area.sz);
);
out tags center bb;"""

# kind -> (minimum area km² unless it has a wikidata tag, cap on how many to keep)
KINDS = {
    "park": (0.45, 90), "nature": (0, 10), "beach": (0, 20), "peak": (None, 12),
    "mall": (0.035, 60), "hospital": (0.03, 40), "university": (0, 30),
    "library": (0.004, 15), "museum": (0, 45), "theatre": (0, 15),
    "stadium": (0, 12), "themepark": (0.05, 15), "attraction": (0.03, 30), "historic": (0, 25),
}
SKIP_NAME = re.compile(r"停车|入口|出口|门诊部|社区健康|卫生服务|分院区|宿舍|^\d|雕塑|标语|模型|喷泉")


def kind_of(t: dict) -> str | None:
    if t.get("leisure") == "park": return "park"
    if t.get("leisure") == "nature_reserve": return "nature"
    if t.get("natural") == "beach": return "beach"
    if t.get("natural") == "peak": return "peak"
    if t.get("shop") == "mall": return "mall"
    if t.get("amenity") == "hospital": return "hospital" if "医院" in t["name"] else None
    if t.get("amenity") == "university": return "university"
    if t.get("amenity") == "library": return "library" if "图书馆" in t["name"] else None
    if t.get("tourism") in ("museum", "gallery"): return "museum"
    if t.get("amenity") == "theatre": return "theatre"
    if t.get("leisure") == "stadium": return "stadium"
    if t.get("tourism") in ("theme_park", "zoo", "aquarium") or t.get("leisure") == "water_park": return "themepark"
    if t.get("tourism") == "attraction": return "attraction"
    if "historic" in t: return "historic"
    return None


def area_km2(e: dict) -> float:
    b = e.get("bounds")
    if not b:
        return 0.0
    return (b["maxlat"] - b["minlat"]) * 110.57 * (b["maxlon"] - b["minlon"]) * 102.6


def _ssl_context() -> ssl.SSLContext | None:
    """python.org's macOS Python ships without root certificates
    (CERTIFICATE_VERIFY_FAILED); use certifi's bundle when it is installed."""
    try:
        import certifi  # type: ignore
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return None


def overpass(query: str, agent: str = "shenhui-life-sim-osm-import/1.0", tries: int = 4) -> dict:
    """POST a query to Overpass and return the JSON. Retries when the server
    is busy (429/502/504); when Python cannot verify HTTPS certificates it
    retries with certifi, then falls back to curl (which uses the system
    keychain)."""
    body = urllib.parse.urlencode({"data": query}).encode()
    ctx: ssl.SSLContext | None = None
    use_curl = False
    for attempt in range(tries):
        try:
            if use_curl:
                out = subprocess.run(["curl", "-sS", "--fail", "-m", "300", "-A", agent, "--data-binary", "@-", OVERPASS],
                                     input=body, capture_output=True, check=True)
                return json.loads(out.stdout)
            req = urllib.request.Request(OVERPASS, data=body, headers={"User-Agent": agent})
            return json.load(urllib.request.urlopen(req, timeout=300, context=ctx))
        except urllib.error.HTTPError as e:
            if e.code not in (429, 502, 503, 504) or attempt == tries - 1:
                raise
            print(f"Overpass busy ({e.code}), retrying in 20s…")
        except urllib.error.URLError as e:
            if not isinstance(e.reason, ssl.SSLCertVerificationError):
                raise
            if ctx is None and (ctx := _ssl_context()) is not None:
                print("HTTPS certificate check failed; retrying with certifi's certificates…")
                continue
            if shutil.which("curl"):
                print("HTTPS certificate check failed; retrying with curl…")
                use_curl = True
                continue
            raise SystemExit("HTTPS certificate check failed. Run \"Install Certificates.command\" in your Python folder "
                             "(/Applications/Python 3.x/) or `pip install certifi`, then try again.") from e
        except subprocess.CalledProcessError as e:
            if attempt == tries - 1:
                raise SystemExit(f"curl failed: {e.stderr.decode(errors='replace').strip()}") from e
            print("Overpass request failed, retrying in 20s…")
        time.sleep(20)
    raise SystemExit("Overpass did not answer; try again later.")


def fetch_places() -> None:
    raw = overpass(QUERY, "shenhui-life-sim-places-import/1.0")
    keep = []
    for e in raw["elements"]:
        t = e.get("tags", {})
        b = e.get("bounds")
        c = e.get("center") or ({"lat": e["lat"], "lon": e["lon"]} if "lat" in e else None) or (
            {"lat": (b["minlat"] + b["maxlat"]) / 2, "lon": (b["minlon"] + b["maxlon"]) / 2} if b else None)
        if not c or not t.get("name"):
            continue
        keep.append({"id": f'{e["type"][0]}{e["id"]}', "tags": {k: v for k, v in t.items() if k in (
            "name", "name:en", "tourism", "leisure", "shop", "amenity", "natural", "historic", "wikidata", "wikipedia", "ele")},
            "lat": c["lat"], "lon": c["lon"], "area": round(area_km2(e), 4)})
    PLACES_SNAPSHOT.write_text(json.dumps({"source": "OpenStreetMap (ODbL) via Overpass API", "places": keep}, ensure_ascii=False, indent=0))
    print(f"places snapshot: {len(keep)} -> {PLACES_SNAPSHOT.relative_to(ROOT)}")


def emit_places(to_km, to_xy, station_xy: dict, station_km: dict, locs: dict) -> None:
    raw = json.loads(PLACES_SNAPSHOT.read_text())["places"]
    loc_names = [l["name"] for l in locs.values()]
    stations = [n for n in station_xy if not n.endswith("方向")]
    stations_set = set(stations)

    def clash(name: str) -> bool:
        core = re.sub(r"^深圳(市)?|公园$|景区$|购物中心$", "", name)
        if core in stations_set:  # a park/mall named exactly like the station: fine, keep
            return False
        return any(len(core) >= 2 and (core in ln or ln in name) for ln in loc_names)

    by_kind: dict[str, list] = {}
    seen: dict[str, dict] = {}
    for p in raw:
        t = p["tags"]
        k = kind_of(t)
        name = t["name"].strip()
        if not k or SKIP_NAME.search(name) or len(name) < 2 or not re.search(r"[一-鿿]", name):
            continue
        min_area, _cap = KINDS[k]
        notable = "wikidata" in t or "wikipedia" in t
        if k == "peak":
            if not (notable or float(re.sub(r"[^\d.]", "", t.get("ele", "0")) or 0) >= 450):
                continue
        elif not notable and p["area"] < min_area:
            continue
        if clash(name):
            continue
        score = (10 if notable else 0) + math.log10(p["area"] + 1e-4)
        rec = {**p, "kind": k, "name": name, "score": score}
        if name in seen and seen[name]["score"] >= score:
            continue
        seen[name] = rec
    for rec in seen.values():
        by_kind.setdefault(rec["kind"], []).append(rec)

    chosen = []
    for k, recs in by_kind.items():
        recs.sort(key=lambda r: -r["score"])
        chosen += recs[: KINDS[k][1]]

    out_rows = []
    placed: list[tuple[float, float]] = []
    for r in sorted(chosen, key=lambda r: -r["score"]):
        X, Y = to_km(r["lat"], r["lon"])
        x, z = to_xy(X, Y)
        if any(math.dist((x, z), q) < 0.18 for q in placed):  # don't stack two pins on one spot
            continue
        placed.append((x, z))
        st = min(stations, key=lambda n: math.dist(station_km[n], (X, Y)))
        st_km = math.dist(station_km[st], (X, Y))
        out_rows.append((r, x, z, st, st_km))

    counts: dict[str, int] = {}
    for r, *_ in out_rows:
        counts[r["kind"]] = counts.get(r["kind"], 0) + 1
    print(f"places: {len(out_rows)}", counts)

    esc = lambda s: s.replace("\\", "\\\\").replace('"', '\\"')
    lines = [
        "// GENERATED by tools/metro/gen_sz_metro.py (tools/metro/places.py) — do not edit by hand.",
        "// Shenzhen landmarks from OpenStreetMap, placed with the metro network's map fit.",
        "// Data © OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright",
        "",
        'export type PlaceKind = "park" | "nature" | "beach" | "peak" | "mall" | "hospital" | "university" | "library" | "museum" | "theatre" | "stadium" | "themepark" | "attraction" | "historic";',
        "/** A real place: nearest metro station `st`, `stKm` real km away. */",
        "export interface CityPlace { id: string; name: string; en?: string; kind: PlaceKind; x: number; z: number; st: string; stKm: number; }",
        "const P = (id: string, name: string, kind: PlaceKind, x: number, z: number, st: string, stKm: number, en?: string): CityPlace => (en ? { id, name, en, kind, x, z, st, stKm } : { id, name, kind, x, z, st, stKm });",
        "",
        "export const SZ_PLACES: CityPlace[] = [",
    ]
    for r, x, z, st, st_km in sorted(out_rows, key=lambda row: (row[0]["kind"], row[0]["name"])):
        en = r["tags"].get("name:en")
        lines.append(f'  P("{r["id"]}","{esc(r["name"])}","{r["kind"]}",{x:.2f},{z:.2f},"{esc(st)}",{st_km:.2f}' + (f',"{esc(en)}"' if en else "") + "),")
    lines.append("];")
    OUT.write_text("\n".join(lines) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}")
