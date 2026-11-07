"""Download Huizhou's OSM places (same categories as Shenzhen) and rail stations.
Writes tools/hz/hz-osm-places.json. Data © OpenStreetMap contributors, ODbL."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "metro"))
from places import overpass, area_km2, KEEP_TAGS  # noqa: E402

HERE = Path(__file__).resolve().parent
Q = """[out:json][timeout:240];
area["boundary"="administrative"]["name"="惠州市"]->.hz;
(
  nwr["tourism"~"^(attraction|museum|theme_park|zoo|gallery|aquarium)$"]["name"](area.hz);
  nwr["leisure"~"^(park|nature_reserve|stadium|water_park)$"]["name"](area.hz);
  nwr["shop"="mall"]["name"](area.hz);
  nwr["amenity"~"^(hospital|university|library|theatre)$"]["name"](area.hz);
  nwr["natural"~"^(beach|peak|bay|island)$"]["name"](area.hz);
  nwr["historic"]["name"](area.hz);
  nwr["amenity"~"^(police|pharmacy)$"]["name"](area.hz);
  nwr["tourism"="information"]["information"~"^(office|visitor_centre)$"]["name"](area.hz);
  nwr["railway"="station"]["name"](area.hz);
  nwr["aeroway"="aerodrome"]["name"](area.hz);
  nwr["office"="company"]["name"](area.hz);
  nwr["landuse"="industrial"]["name"](area.hz);
);
out tags center bb;"""
raw = overpass(Q, "shenhui-life-sim-hz-import/1.0")
keep = []
for e in raw["elements"]:
    t = e.get("tags", {}); b = e.get("bounds")
    c = e.get("center") or ({"lat": e["lat"], "lon": e["lon"]} if "lat" in e else None) or (
        {"lat": (b["minlat"] + b["maxlat"]) / 2, "lon": (b["minlon"] + b["maxlon"]) / 2} if b else None)
    if not c or not t.get("name"): continue
    extra = {k: v for k, v in t.items() if k in ("railway", "aeroway", "office", "landuse", "operator")}
    keep.append({"id": f'{e["type"][0]}{e["id"]}', "tags": {**{k: v for k, v in t.items() if k in KEEP_TAGS}, **extra},
                 "lat": c["lat"], "lon": c["lon"], "area": round(area_km2(e), 4)})
(HERE / "hz-osm-places.json").write_text(json.dumps({"source": "OpenStreetMap (ODbL) via Overpass API", "places": keep}, ensure_ascii=False, indent=0))
print(len(keep))
