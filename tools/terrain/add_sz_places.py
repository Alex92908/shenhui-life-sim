"""Add Shenzhen's parks and sights that the per-kind caps left out (前海石公园…).

Reads the cached OSM snapshot (tools/metro/sz-osm-places.json) and appends
every park ≥ 0.02 km², and every nature reserve, beach, theme park,
attraction, museum and historic site not already on the map, placed with the
current projection (fits.sz_xy) and kept on land. New rows get ids starting
with "x" so the station fit (which reads places-sz.ts) ignores them.

  python3 tools/terrain/add_sz_places.py
"""
import json, math, re, sys, zlib
from pathlib import Path
HERE = Path(__file__).resolve().parent; ROOT = HERE.parent.parent
sys.path[:0] = [str(HERE), str(ROOT / "tools/metro")]
import fits, proj  # noqa: E402
from places import kind_of, SKIP_NAME  # noqa: E402

SIGHTS = {"park", "nature", "beach", "themepark", "attraction", "museum", "historic", "peak"}
MIN_PARK = 0.02
out_path = ROOT / "client/src/places-sz.ts"
src = out_path.read_text()
# drop rows from an earlier run, then rebuild them
src = re.sub(r'\n  P\("x[^\n]*', "", src)
have = set(re.findall(r'P\("[^"]+","([^"]+)"', src))
data = (ROOT / "client/src/data.ts").read_text()
blk = data[data.index("const SZ_LOCS"):]; blk = blk[:blk.index("\n];")]
loc_names = set(re.findall(r'name: "([^"]+)"', blk))
loc_xy = [(float(a), float(b)) for a, b in re.findall(r"x: (-?[\d.]+), z: (-?[\d.]+)", blk)]
real_km = {n: (float(a), float(b)) for n, a, b in re.findall(r'"([^"]+)":\[(-?[\d.]+),(-?[\d.]+)\]', (ROOT / "client/src/metro-sz.ts").read_text().split("SZ_REAL_KM")[1])}
placed = [(float(a), float(b)) for a, b in re.findall(r'P\("[^"]+","[^"]+","\w+",(-?[\d.]+),(-?[\d.]+)', src)] + loc_xy

best: dict[str, dict] = {}
for p in json.loads((ROOT / "tools/metro/sz-osm-places.json").read_text())["places"]:
    t = p["tags"]; k = kind_of(t); name = t.get("name", "").strip()
    if k not in SIGHTS or not name or SKIP_NAME.search(name) or len(name) < 2 or not re.search(r"[一-鿿]", name): continue
    if name in have or re.sub(r"[（(].*$", "", name) in have or any(name in ln or ln in name for ln in loc_names if len(ln) >= 3): continue
    notable = "wikidata" in t or "wikipedia" in t
    if k == "park" and p.get("area", 0) < MIN_PARK and not notable: continue
    if k == "peak" and not (notable or float(re.sub(r"[^\d.]", "", t.get("ele", "0")) or 0) >= 300): continue
    base = re.sub(r"[（(].*$", "", name)
    base = re.sub(r"(公园|湿地|绿道)[^公园湿地绿道]{1,4}段$", r"\1", base)  # 前海石公园桂湾段 -> 前海石公园: one entry per park
    score = (10 if notable else 0) + math.log10(p.get("area", 0) + 1e-4)
    if base in best and best[base]["score"] >= score: continue
    best[base] = {**p, "kind": k, "name": base if len(base) >= 2 else name, "score": score}

rows = []
for r in sorted(best.values(), key=lambda r: -r["score"]):
    x, z = fits.sz_xy(r["lat"], r["lon"])
    if not (-37.5 < x < 37.5 and -21.5 < z < 23.5): continue
    x, z = proj.land_snap("sz", x, z, 0.4)
    for i in range(12):  # step off pins and buildings already there
        if not any(math.dist((x, z), q) < 0.8 for q in placed): break
        ang = (zlib.crc32(r["name"].encode()) % 360) * math.pi / 180 + i
        x, z = proj.land_snap("sz", x + math.cos(ang) * 0.6, z + math.sin(ang) * 0.6, 0.4)
    placed.append((x, z))
    kx, ky = (r["lon"] - fits.lon0) * fits.KX, -(r["lat"] - fits.lat0) * 110.57
    st = min(real_km, key=lambda n: math.dist(real_km[n], (kx, ky)))
    en = r["tags"].get("name:en")
    esc = lambda s: s.replace("\\", "\\\\").replace('"', '\\"')
    rows.append(f'  P("x{r["id"]}","{esc(r["name"])}","{r["kind"]}",{x:.2f},{z:.2f},{kx:.2f},{ky:.2f},"{esc(st)}",{math.dist(real_km[st], (kx, ky)):.2f}' + (f',"{esc(en)}"' if en else "") + "),")
end = src.rindex("];")
out_path.write_text(src[:end] + "\n".join(rows) + "\n" + src[end:])
print("added", len(rows), "e.g.", [re.search(r'","([^"]+)"', r).group(1) for r in rows[:12]])
