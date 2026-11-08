"""Download Hong Kong's OSM places (same categories as Shenzhen), MTR stations
and neighbourhood names. Writes tools/hk/hk-osm-places.json and
tools/hk/hk-osm-areas.json. Data © OpenStreetMap contributors, ODbL."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "metro"))
from places import overpass, area_km2, KEEP_TAGS  # noqa: E402

HERE = Path(__file__).resolve().parent
# Hong Kong's own administrative boundary (a bounding box would pull in
# Futian / Nanshan / Luohu across the Shenzhen River).
AREA = 'area["ISO3166-1"="HK"]["boundary"="administrative"]->.a;'
BB = "area.a"
Q = f"""[out:json][timeout:240];
{AREA}
(
  nwr["tourism"~"^(attraction|museum|theme_park|zoo|gallery|aquarium)$"]["name"]({BB});
  nwr["leisure"~"^(park|nature_reserve|stadium|water_park)$"]["name"]({BB});
  nwr["shop"="mall"]["name"]({BB});
  nwr["amenity"~"^(hospital|university|library|theatre)$"]["name"]({BB});
  nwr["natural"~"^(beach|peak|bay|island)$"]["name"]({BB});
  nwr["historic"]["name"]({BB});
  nwr["amenity"~"^(police|pharmacy)$"]["name"]({BB});
  nwr["tourism"="information"]["information"~"^(office|visitor_centre)$"]["name"]({BB});
  nwr["railway"="station"]["name"]({BB});
  nwr["public_transport"="station"]["name"]({BB});
);
out tags center bb;"""
raw = overpass(Q, "shenhui-life-sim-hk-import/1.0")
keep = []
for e in raw["elements"]:
    t = e.get("tags", {}); b = e.get("bounds")
    c = e.get("center") or ({"lat": e["lat"], "lon": e["lon"]} if "lat" in e else None) or (
        {"lat": (b["minlat"] + b["maxlat"]) / 2, "lon": (b["minlon"] + b["maxlon"]) / 2} if b else None)
    if not c or not t.get("name"): continue
    if t.get("public_transport") == "station" and t.get("railway") != "station":
        if t.get("bus") == "yes": continue
        t = {**t, "railway": "station"}
    extra = {k: v for k, v in t.items() if k in ("railway", "station", "network", "operator", "name:zh", "name:zh-Hans", "name:zh-Hant", "name:en")}
    keep.append({"id": f'{e["type"][0]}{e["id"]}', "tags": {**{k: v for k, v in t.items() if k in KEEP_TAGS}, **extra},
                 "lat": c["lat"], "lon": c["lon"], "area": round(area_km2(e), 4)})
(HERE / "hk-osm-places.json").write_text(json.dumps({"source": "OpenStreetMap (ODbL) via Overpass API", "places": keep}, ensure_ascii=False, indent=0))
print("places", len(keep))

QA = f"""[out:json][timeout:240];
{AREA}
(
  node["place"~"^(suburb|quarter|neighbourhood|town|village)$"]["name"]({BB});
  nwr["landuse"="residential"]["name"]({BB});
);
out tags center bb;"""
raw = overpass(QA, "shenhui-life-sim-hk-areas/1.0")
rows = []
for e in raw["elements"]:
    t = e.get("tags", {}); b = e.get("bounds")
    c = e.get("center") or ({"lat": e["lat"], "lon": e["lon"]} if "lat" in e else None)
    if not c or not t.get("name"): continue
    area = ((b["maxlat"] - b["minlat"]) * 110.57 * (b["maxlon"] - b["minlon"]) * 102.6) if b else 0
    rows.append({"name": t.get("name:zh") or t["name"], "en": t.get("name:en"), "kind": t.get("place") or "residential", "lat": c["lat"], "lon": c["lon"], "area": round(area, 4)})
(HERE / "hk-osm-areas.json").write_text(json.dumps(rows, ensure_ascii=False))
print("areas", len(rows), {k: sum(1 for r in rows if r["kind"] == k) for k in set(r["kind"] for r in rows)})
