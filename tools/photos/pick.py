import json, subprocess, io, os, time
from PIL import Image
c = json.load(open("cands.json"))
office = next(i for i, x in enumerate(c["scene-office2"]) if "C4DI" in x["title"])
PICK = {
 "scene-park": ("scene-park", 2), "scene-metro": ("scene-metro", 0), "scene-train": ("scene-train", 2), "scene-station": ("scene-station", 5),
 "scene-concourse": ("scene-concourse", 0), "scene-platform": ("scene-platform", 1), "scene-office": ("scene-office2", office),
 "scene-restaurant": ("scene-restaurant", 0), "scene-market": ("scene-market", 4), "scene-mall": ("scene-mall", 0), "scene-kitchen": ("scene-kitchen", 0),
 "scene-bedroom": ("scene-bedroom", 0), "scene-bathroom": ("scene-bathroom", 3), "scene-gym": ("scene-gym2", 0), "scene-bus": ("scene-bus", 2),
 "scene-taxi": ("scene-taxi", 3), "scene-home": ("scene-home", 3),
 "place-wow": ("place-wow", 0), "place-happy": ("place-happy", 2), "place-lianhua": ("place-lianhua", 0), "place-bay": ("place-bay", 3),
 "place-dameisha": ("place-dameisha", 3), "place-hq1": ("place-hq1", 0), "place-hq2": ("place-hq1", 3), "place-dm1": ("place-dm1", 2), "place-dm2": ("place-dm2", 4),
 "place-szb1": ("place-szb1", 1), "place-szb2": ("place-szb1", 5), "place-xh1": ("place-xh1", 4), "place-xh2": ("place-xh2", 4),
 "place-lf1": ("place-lf1", 3), "place-lf2": ("place-lf1", 5), "place-sy": ("place-sy", 1), "place-sy2": ("place-sy", 0),
 "place-hejiang": ("place-hejiang", 0), "place-hejiang2": ("place-hejiang", 5), "place-turtle": ("place-turtle", 0), "place-turtle2": ("place-turtle2", 1),
 "place-xunliao": ("place-xunliao", 0), "place-aquarium": ("place-aquarium", 1), "place-aquarium2": ("place-aquarium2", 1),
 "place-wheel": ("place-wheel", 0), "place-wheel2": ("place-wheel", 2), "place-wow2": ("place-wow", 3), "place-dameisha2": ("place-dameisha", 0),
}
OUT = "/Users/alexmbp/PycharmProjects/shenhui-life-sim/client/src/assets"
os.makedirs(OUT, exist_ok=True)
credits = {}
for name, (k, i) in PICK.items():
    cand = c[k][i]
    fn = f"{OUT}/{name}.jpg"
    if not os.path.exists(fn):
        for t in range(4):
            r = subprocess.run(["curl", "-sSL", "-m", "120", "-A", "shenhui-life-sim/1.0 (game photo credits in repo)", cand["thumb"]], capture_output=True)
            try:
                im = Image.open(io.BytesIO(r.stdout)).convert("RGB"); break
            except Exception: time.sleep(5 + t * 5)
        else:
            print("FAIL", name); continue
        im.thumbnail((1150, 1150)); im.save(fn, quality=82, optimize=True)
        time.sleep(0.5)
    credits[name] = {"title": cand["title"][5:], "artist": cand["artist"], "license": cand["lic"], "page": cand["page"]}
    print(name, os.path.getsize(fn)//1024, "KB", credits[name]["license"], credits[name]["artist"][:40])
json.dump(credits, open("credits.json", "w"), ensure_ascii=False, indent=1)
