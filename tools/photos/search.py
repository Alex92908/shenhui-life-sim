import json, re, sys, urllib.parse, subprocess
Q = {
 "scene-gym2": ["gym equipment interior", "fitness centre interior", "weight room"], "scene-office2": ["office workers desks computers", "coworking space interior", "modern office interior"], "place-honghua2": ["Honghu Lake Huizhou", "Huizhou Honghua Lake", "惠州 红花湖", "Huizhou lake greenway"],
 "scene-park": ["Shenzhen Bay Park", "深圳湾公园"], "scene-metro": ["Shenzhen Metro train interior", "Shenzhen Metro carriage"],
 "scene-train": ["CR400AF interior", "Fuxing train second class interior"], "scene-station": ["Shenzhen North railway station platform"],
 "scene-concourse": ["Shenzhen North railway station waiting hall", "Shenzhen North station interior"], "scene-platform": ["CR400AF platform", "Fuxing Hao station platform"],
 "scene-office": ["open plan office interior"], "scene-restaurant": ["Cantonese restaurant interior", "dim sum restaurant interior"],
 "scene-market": ["Dongmen Shenzhen night", "Dongmen pedestrian street"], "scene-mall": ["Huaqiangbei electronics market interior", "SEG electronics market Shenzhen"],
 "scene-kitchen": ["apartment kitchen interior"], "scene-bedroom": ["apartment bedroom interior"], "scene-bathroom": ["bathroom washbasin interior"],
 "scene-gym": ["fitness gym interior treadmills"], "scene-bus": ["Shenzhen bus interior", "Shenzhen Bus Group interior"], "scene-taxi": ["Shenzhen taxi"],
 "scene-home": ["apartment living room interior"],
 "place-wow": ["Window of the World Shenzhen Eiffel"], "place-happy": ["Happy Valley Shenzhen"], "place-lianhua": ["Lianhuashan Park Shenzhen", "Lianhua Mountain Park Deng Xiaoping"],
 "place-bay": ["Shenzhen Bay Park sunset", "Shenzhen Bay Park"], "place-dameisha": ["Dameisha beach"], "place-hq1": ["Huaqiangbei"], "place-hq2": ["Huaqiang North Road"],
 "place-dm1": ["Dongmen Shenzhen"], "place-dm2": ["Dongmen Old Street Shenzhen"], "place-szb1": ["Shenzhen North railway station"], "place-szb2": ["Shenzhen North Station"],
 "place-xh1": ["Huizhou West Lake", "惠州西湖"], "place-xh2": ["Sizhou Pagoda Huizhou", "泗洲塔"], "place-lf1": ["Luofu Mountain", "罗浮山"], "place-lf2": ["Luofushan"],
 "place-sy": ["Shuangyue Bay", "双月湾"],
 "place-hejiang": ["Hejiang Tower Huizhou", "合江楼", "Dongjiang Huizhou night"], "place-turtle": ["Huidong sea turtle", "green sea turtle"], "place-turtle2": ["sea turtle hatchlings beach"],
 "place-xunliao": ["Xunliao Bay", "巽寮湾"], "place-honghua": ["Honghua Lake Huizhou", "红花湖"], "place-aquarium": ["Xiaomeisha Sea World", "aquarium tunnel sharks"],
 "place-aquarium2": ["aquarium jellyfish tank"], "place-wheel": ["Bay Glory Ferris wheel Shenzhen", "湾区之光摩天轮", "Ferris wheel Shenzhen"], "place-cruise": ["Huizhou Dongjiang River night", "river cruise boat night China"],
}
API = "https://commons.wikimedia.org/w/api.php"
OK = re.compile(r"^(CC BY(-SA)? [0-9.]+|CC0|Public domain|PD.*|CC BY [0-9.]+)", re.I)
out = {}
import time, os
def get(params):
    url = API + "?" + urllib.parse.urlencode(params)
    for i in range(6):
        r = subprocess.run(["curl", "-sS", "-m", "60", "-A", "shenhui-life-sim/1.0 (photo sourcing; contact via repo)", url], capture_output=True)
        try: return json.loads(r.stdout)
        except Exception: time.sleep(5 + i * 5)
    return {}
if os.path.exists("cands.json"): out = json.load(open("cands.json"))
for key, qs in Q.items():
    if key in out and out[key]: continue
    cands = []
    time.sleep(1.5)
    for q in qs:
        d = get({"action": "query", "format": "json", "generator": "search", "gsrsearch": f"filetype:bitmap {q}", "gsrnamespace": 6, "gsrlimit": 12,
                 "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": 1280})
        for p in sorted((d.get("query", {}).get("pages", {}) or {}).values(), key=lambda p: p.get("index", 99)):
            ii = (p.get("imageinfo") or [{}])[0]; m = ii.get("extmetadata", {})
            lic = m.get("LicenseShortName", {}).get("value", "")
            if not OK.match(lic) or ii.get("width", 0) < 800: continue
            artist = re.sub(r"<[^>]+>", "", m.get("Artist", {}).get("value", "")).strip()
            cands.append({"title": p["title"], "thumb": ii.get("thumburl"), "page": ii.get("descriptionurl"), "lic": lic, "artist": artist, "w": ii.get("width"), "h": ii.get("height")})
    seen = set(); uniq = []
    for c in cands:
        if c["title"] in seen: continue
        seen.add(c["title"]); uniq.append(c)
    out[key] = uniq[:8]
    print(key, len(uniq), [c["title"][5:60] for c in uniq[:4]])
    json.dump(out, open("cands.json", "w"), ensure_ascii=False, indent=1)
json.dump(out, open("cands.json", "w"), ensure_ascii=False, indent=1)
