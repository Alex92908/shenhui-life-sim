import json, subprocess, io, os, time
from PIL import Image
c = json.load(open("cands.json"))
office = next(i for i, x in enumerate(c["scene-office2"]) if "C4DI" in x["title"])
PICK = {
 "sz-cablecar": ("sc-cablecar", 0), "sz-coaster": ("sc-coaster", 1), "sz-dapeng": ("sz-dapeng", 0), "sz-dapeng2": ("sz-dapeng", 4),
 "sz-fenghuang": ("sz-fenghuang", 3), "sz-fenghuang2": ("sz-fenghuang", 4), "sz-jinxiu": ("sz-jinxiu", 0), "sz-jinxiu2": ("sz-jinxiu", 4),
 "sz-octeast": ("sz-octeast", 3), "sz-octharbour": ("sz-octharbour", 3), "sz-octharbour2": ("sz-octharbour", 1), "sz-qingqing": ("sz-qingqing", 3),
 "sz-qiniang": ("sz-qiniang", 0), "sz-safari": ("sz-safari", 5), "sz-safari2": ("sz-safari", 3), "sz-swcac": ("sz-swcac", 2), "sz-swcac2": ("sz-swcac", 4),
 "sz-tanglang": ("sz-tanglang", 5), "sz-tanglang2": ("sz-tanglang", 3), "sz-wutong": ("sz-wutong", 4), "sz-wutong2": ("sz-wutong", 2),
 "sz-xianhu": ("sz-xianhu", 0), "sz-xianhu2": ("sz-xianhu", 5), "sz-xichong": ("sz-xichong", 0), "sz-xichong2": ("sz-xichong", 4),
 "sz-yangmeikeng": ("sz-yangmeikeng", 0), "sz-yangmeikeng2": ("sz-yangmeikeng", 1), "sz-zhongying": ("sz-zhongying", 0), "sz-zhongying2": ("sz-zhongying", 2),
}
OUT = "/Users/alexmbp/PycharmProjects/shenhui-life-sim/client/src/assets"
os.makedirs(OUT, exist_ok=True)
credits = json.load(open("credits.json")) if os.path.exists("credits.json") else {}
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
