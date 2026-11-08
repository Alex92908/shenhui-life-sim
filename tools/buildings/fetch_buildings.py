"""Tall buildings (>= 8 levels or >= 30 m) for Shenzhen and Huizhou from
OpenStreetMap via Overpass: centre point + height in metres. Used to give
the map's filler blocks the real skyline. Data © OSM contributors, ODbL."""
import json, sys, time, urllib.request, urllib.parse
from pathlib import Path
HERE = Path(__file__).resolve().parent
BBOX = {"sz": (22.43, 113.75, 22.86, 114.63), "hz": (22.55, 114.05, 23.45, 115.0)}
Q = """[out:json][timeout:180];
(way["building"]["building:levels"~"^([89]|[1-9][0-9])$"]({s},{w},{n},{e});
 way["building"]["height"~"^([3-9][0-9]|[1-9][0-9][0-9])"]({s},{w},{n},{e}););
out center tags;"""
def height(t):
    h = t.get("height", "").replace("m", "").strip()
    try: return float(h)
    except ValueError: pass
    try: return float(t.get("building:levels", "0")) * 3.2
    except ValueError: return 0.0
out = {}
for ck, (s, w, n, e) in BBOX.items():
    q = Q.format(s=s, w=w, n=n, e=e)
    for url in ("https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"):
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": q}).encode(), headers={"User-Agent": "shenhui-life-sim map builder"})
            data = json.load(urllib.request.urlopen(req, timeout=240)); break
        except Exception as ex:
            print(ck, url, ex, file=sys.stderr); time.sleep(5); data = None
    if not data: continue
    rows = []
    for el in data.get("elements", []):
        c = el.get("center"); h = height(el.get("tags", {}))
        if c and h >= 24: rows.append({"lat": round(c["lat"], 5), "lon": round(c["lon"], 5), "h": round(h)})
    out[ck] = rows
    print(ck, len(rows), file=sys.stderr)
(HERE / "buildings-osm.json").write_text(json.dumps(out))
