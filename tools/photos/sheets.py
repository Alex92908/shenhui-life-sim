import json, subprocess, os, io, time
from PIL import Image, ImageDraw
c = json.load(open("cands.json"))
os.makedirs("thumbs", exist_ok=True); os.makedirs("sheets", exist_ok=True)
keys = list(c)
for k in keys:
    ims = []
    for i, cand in enumerate(c[k][:6]):
        fn = f"thumbs/{k}-{i}.jpg"
        if not os.path.exists(fn):
            url = cand["thumb"].replace("/1280px-", "/330px-")
            r = subprocess.run(["curl", "-sSL", "-m", "60", "-A", "shenhui-life-sim/1.0", url], capture_output=True)
            try: Image.open(io.BytesIO(r.stdout)).convert("RGB").save(fn)
            except Exception: continue
            time.sleep(0.3)
        ims.append((i, Image.open(fn)))
    W = 6 * 260; sheet = Image.new("RGB", (W, 210), "white"); d = ImageDraw.Draw(sheet)
    for j, (i, im) in enumerate(ims):
        im.thumbnail((250, 180)); sheet.paste(im, (j * 260, 0)); d.text((j * 260 + 4, 185), f"{i}", fill="red")
    sheet.save(f"sheets/{k}.jpg", quality=80)
print("done")
