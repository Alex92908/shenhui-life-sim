"""Neighbourhood / town / village names and named woods for both cities (OSM),
for the map's area labels. Writes tools/hz/areas-osm.json. ODbL."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "metro"))
from places import overpass  # noqa: E402
out = {}
for ck, city in (("sz", "深圳市"), ("hz", "惠州市")):
    q = f"""[out:json][timeout:240];
area["boundary"="administrative"]["name"="{city}"]->.a;
(
  node["place"~"^(suburb|quarter|neighbourhood|town|village)$"]["name"](area.a);
  nwr["landuse"="forest"]["name"](area.a);
  nwr["natural"="wood"]["name"](area.a);
  nwr["landuse"="residential"]["name"](area.a);
);
out tags center bb;"""
    raw = overpass(q, "shenhui-life-sim-areas/1.0")
    rows = []
    for e in raw["elements"]:
        t = e.get("tags", {}); b = e.get("bounds")
        c = e.get("center") or ({"lat": e["lat"], "lon": e["lon"]} if "lat" in e else None)
        if not c or not t.get("name"): continue
        area = ((b["maxlat"] - b["minlat"]) * 110.57 * (b["maxlon"] - b["minlon"]) * 102.6) if b else 0
        kind = t.get("place") or ("wood" if t.get("landuse") == "forest" or t.get("natural") == "wood" else "residential")
        rows.append({"name": t["name"], "en": t.get("name:en"), "kind": kind, "lat": c["lat"], "lon": c["lon"], "area": round(area, 4)})
    out[ck] = rows
    print(ck, len(rows), {k: sum(1 for r in rows if r["kind"] == k) for k in set(r["kind"] for r in rows)})
(Path(__file__).resolve().parent / "areas-osm.json").write_text(json.dumps(out, ensure_ascii=False))
