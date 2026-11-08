"""Fetch a city's admin boundary (outer ways) -> tools/terrain/<ck>-boundary.json (lists of [lon, lat]).
  python3 tools/terrain/fetch_boundary.py hz
Data © OpenStreetMap contributors, ODbL 1.0."""
import json, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "metro"))
from places import overpass  # noqa: E402
CK = sys.argv[1]
NAME = {"hz": "惠州市", "sz": "深圳市"}[CK]
els = overpass(f'[out:json][timeout:300];relation["boundary"="administrative"]["admin_level"="5"]["name"="{NAME}"];out geom;', "shenhui-life-sim-terrain/1.0")["elements"]
ways = [[[p["lon"], p["lat"]] for p in m["geometry"]] for r in els for m in r.get("members", []) if m.get("role") == "outer" and m.get("geometry")]
(HERE / f"{CK}-boundary.json").write_text(json.dumps(ways))
print(len(els), "relations", len(ways), "ways")
