"""Enlarge Shenzhen on its map: one uniform scale about the game places' centre.

The Shenzhen projection is the metro-station fit (fits.sz_xy), whose anchors
are the x/z of client/src/places-sz.ts; scaling those anchors (and the
precomputed station coordinates) scales the whole projection, so every
generator that uses the fit — terrain, roads, areas, skyline, relayout —
follows. Run once per change of A / centre, then re-run the generators:

  python3 tools/terrain/sz_frame.py
  python3 tools/terrain/relayout.py sz && python3 tools/terrain/gen_terrain.py sz && ...

Applied 2026-11-08: A = 1.13 about (4.05, -4.85), shifted to z centre -4.95.
"""
import re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent.parent
A, CX, CZ, OZ = 1.13, 4.05, -4.85, -4.95
T = lambda x, z: (A * (x - CX), A * (z - CZ) + OZ)
fmt2 = lambda v: f"{v:.2f}"

def scale_S(text: str, only_city: str | None = None) -> str:
    def line(m):
        body = m.group(0)
        if only_city and f'city: "{only_city}"' not in body: return body
        return re.sub(r'S\("([^"]+)",(-?[\d.]+),(-?[\d.]+)', lambda s: 'S("%s",%s,%s' % (s.group(1), *map(fmt2, T(float(s.group(2)), float(s.group(3))))), body)
    return re.sub(r'\{ id: "[^"]+", name: [^\n]*?stations: \[.*?\] \}', line, text)

p = ROOT / "client/src/places-sz.ts"; s = p.read_text()
MARK = f"// sz_frame applied: A={A}"
if MARK in s: sys.exit("already applied — re-running would scale twice")
s = MARK + "\n" + s
s2, n = re.subn(r'P\("([^"]+)","([^"]+)","(\w+)",(-?[\d.]+),(-?[\d.]+),', lambda m: 'P("%s","%s","%s",%s,%s,' % (m.group(1), m.group(2), m.group(3), *map(fmt2, T(float(m.group(4)), float(m.group(5))))), s)
p.write_text(s2); print("places-sz rows", n)
p = ROOT / "client/src/metro-sz.ts"; p.write_text(scale_S(p.read_text())); print("metro-sz scaled")
# station positions keyed by name (REAL_KM-style tables keep km; only x/z tables move)
s = p.read_text()
p = ROOT / "client/src/data.ts"; p.write_text(scale_S(p.read_text(), only_city="sz")); print("data.ts sz lines scaled")
p = ROOT / "client/src/metro-sz.ts"; s = p.read_text()
m = re.search(r"export const SZ_KM_PER_UNIT = ([\d.]+);", s)
s = s.replace(m.group(0), f"export const SZ_KM_PER_UNIT = {float(m.group(1)) / A:.4f};"); p.write_text(s); print("km per unit", float(m.group(1)) / A)
