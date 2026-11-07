"""English names for OSM places (and stations) that have no name:en: generic
terms translated, proper names in pinyin. Writes client/src/places-en.ts.

  pip install pypinyin
  python3 tools/i18n/place_en.py [show]
"""
import re, json, sys
from pypinyin import lazy_pinyin
SRC = "/Users/alexmbp/PycharmProjects/shenhui-life-sim/client/src/places-sz.ts"
OUT = "/Users/alexmbp/PycharmProjects/shenhui-life-sim/client/src/places-en.ts"
G = {
 "深圳市": "Shenzhen", "深圳": "Shenzhen", "中国": "China", "北京": "Beijing", "广州": "Guangzhou",
 "宝安区": "Bao'an District", "龙岗区": "Longgang District", "龙华区": "Longhua District", "坪山区": "Pingshan District", "光明区": "Guangming District",
 "罗湖区": "Luohu District", "盐田区": "Yantian District", "大鹏": "Dapeng", "南山区": "Nanshan District", "福田区": "Futian District",
 "宝安": "Bao'an", "龙岗": "Longgang", "龙华": "Longhua", "坪山": "Pingshan", "光明": "Guangming", "罗湖": "Luohu", "盐田": "Yantian", "南山": "Nanshan", "福田": "Futian", "横岗": "Henggang",
 "湿地公园": "Wetland Park", "郊野公园": "Country Park", "森林公园": "Forest Park", "体育公园": "Sports Park", "主题公园": "Theme Park", "公园": "Park", "湿地": "Wetland",
 "沙滩": "Beach", "海滩": "Beach", "沙灘": "Beach", "海岸": "Coast", "度假村": "Resort", "工人": "Workers'",
 "纪念碑": "Monument", "纪念馆": "Memorial Hall", "烈士陵园": "Martyrs' Cemetery", "烈士": "Martyrs", "革命": "Revolutionary", "人民": "People's",
 "大营救": "Great Rescue", "文化名人": "Cultural Figures", "东深供水": "Dongshen Water Supply",
 "中医药大学": "University of Chinese Medicine", "中医院": "TCM Hospital", "中心医院": "Central Hospital", "总医院": "General Hospital", "医疗中心": "Medical Center", "国际": "International",
 "第二人民医院": "No.2 People's Hospital", "第四人民医院": "No.4 People's Hospital", "第五人民医院": "No.5 People's Hospital", "人民医院": "People's Hospital", "医院": "Hospital",
 "新院区": "New Campus", "院区": "Campus", "校区": "Campus", "大学": "University", "（新）": "(New)",
 "图书馆": "Library", "分馆": "Branch", "南馆": "South Building", "街道": "Subdistrict", "广场": "Plaza", "购物中心": "Shopping Center", "商城": "Mall", "天地": "",
 "博物馆": "Museum", "美术馆": "Art Museum", "世居": "Hakka House", "展示中心": "Exhibition Center", "规划展览馆": "Planning Exhibition Hall", "超级总部基地": "Super HQ Base",
 "科学馆": "Science Museum", "科学城": "Science City", "大屋": "Great House", "碧道": "Greenway", "片区": "Area", "樱花林": "Cherry Blossom Grove", "示范园": "Demonstration Garden",
 "水土保持": "Soil & Water Conservation", "机场": "Airport", "外排渠": "Drainage Channel", "桥下公共空间": "Under-bridge Public Space", "深中": "Shenzhen–Zhongshan",
 "大药房": "Pharmacy", "药房": "Pharmacy", "药行": "Pharmacy",
 "派出所": "Police Station", "警务室": "Police Office", "社区": "Community", "公安局": "Public Security Bureau", "市公安局": "City Public Security Bureau", "分局": "Branch",
 "交通警察局": "Traffic Police Bureau", "交警": "Traffic Police", "大队": "Brigade", "中队": "Squadron", "支队": "Detachment", "刑警": "Criminal Police", "刑事侦察": "Criminal Investigation",
 "扣车场": "Impound Lot", "警犬基地": "Police Dog Base", "制证中心": "ID Card Center", "法医检验中心": "Forensic Center", "治安巡警": "Patrol Police", "警卫局": "Security Bureau",
 "预审监管": "Pre-trial Custody", "铁路公安局": "Railway Public Security Bureau", "公交": "Transit", "西站": "West Station", "北站": "North Station",
 "文体中心": "Culture & Sports Center", "足球场": "Football Ground", "骑士会": "Equestrian Club", "大剧院": "Grand Theatre", "剧场": "Theatre", "戏台": "Opera Stage", "会堂": "Hall",
 "演绎中心": "Performance Center", "水上": "Water", "水世界": "Water World", "游乐场": "Amusement Park", "滑草": "Grass Sliding",
 "游客服务中心": "Visitor Center", "游客中心": "Visitor Center", "服务中心": "Service Center", "志愿服务站": "Volunteer Station", "青年": "Youth", "夜市": "Night Market",
 "书院": "Academy", "古城": "Ancient City", "东门": "East Gate", "古镇": "Old Town", "民宿小镇": "B&B Town", "影视文化园": "Film & Culture Park", "古墟": "Old Market",
 "山水田园": "Countryside", "惠州市": "Huizhou", "惠州": "Huizhou", "惠城区": "Huicheng District", "惠城": "Huicheng", "惠阳区": "Huiyang District", "惠阳": "Huiyang",
 "惠东县": "Huidong County", "惠东": "Huidong", "博罗县": "Boluo County", "博罗": "Boluo", "龙门县": "Longmen County", "龙门": "Longmen", "大亚湾": "Daya Bay", "仲恺": "Zhongkai",
 "经济技术开发区": "Economic & Technological Development Zone", "经开区": "Development Zone", "高新技术产业开发区": "Hi-Tech Zone", "县": "County",
 "纪念园": "Memorial Park", "故居": "Former Residence", "旧址": "Former Site", "人民政府": "Government", "学宫": "Confucian Academy", "古观": "Ancient Temple", "宝殿": "Hall",
 "所城": "Fortress", "北门": "North Gate", "西门": "West Gate", "生态园": "Eco Park", "生态景区": "Eco Scenic Area", "水上乐园": "Water Park", "动物园": "Zoo", "文化创意园": "Creative Park",
 "科普馆": "Science Hall", "主题馆": "Theme Hall", "资料馆": "Archive", "資料館": "Archive", "陈列室": "Exhibition Room", "陳列室": "Exhibition Room", "书室": "Study Hall", "剧台": "Stage",
 "体育场": "Stadium", "体育馆": "Gymnasium", "文化体育公园": "Culture & Sports Park", "开放大学": "Open University", "职业技术学院": "Polytechnic", "卫生": "Health", "附属": "Affiliated",
 "交警支队": "Traffic Police Detachment", "交通警察支队": "Traffic Police Detachment", "交通警察大队": "Traffic Police Brigade", "高速公路": "Expressway", "高速": "Expressway", "公安分局": "Police Branch",
 "垂钓场": "Fishing Ground", "汽车特技表演": "Car Stunt Show", "古建筑群": "Ancient Buildings", "渔村": "Fishing Village", "漁村": "Fishing Village", "滨江公园": "Riverside Park",
 "购物广场": "Shopping Plaza", "商业步行街": "Pedestrian Street", "中心市场": "Central Market", "奥特莱斯": "Outlets", "医药": "Pharmacy", "药房连锁": "Pharmacy", "中医医院": "TCM Hospital",
 "医科大学": "Medical University", "中山大学": "Sun Yat-sen University", "广州中医药大学": "Guangzhou University of Chinese Medicine", "南方医科大学": "Southern Medical University", "总院": "Main Hospital",
 "第三人民医院": "No.3 People's Hospital", "第六人民医院": "No.6 People's Hospital", "中心人民医院": "Central People's Hospital", "东院区": "East Campus", "战斗纪念碑": "Battle Monument",
 "红树林": "Mangrove", "少儿": "Children's", "儿童": "Children's", "实业有限公司": "Industrial Co.", "有限公司": "Co.", "分院": "Branch", "大概位置": "", "自然保护区": "Nature Reserve",
 "解放军": "PLA", "第": "No.", "中心": "Center", "一中": "No.1 Middle School", "女子": "Women's", "三大队": "3rd Brigade", "二大队": "2nd Brigade", "西区": "West Zone", "站": "Station", "湿地公园": "Wetland Park", "国际": "International", "饭店": "Hotel", "将军": "General", "抹香鲸": "Sperm Whale", "科技馆": "Science Museum", "美术馆": "Art Museum", "（": "(", "）": ")", "(": "(", ")": ")", "东江纵队": "East River Column", "店": "Store", "区": "Zone", "牌坊": "Archway", "石塔": "Stone Pagoda", "碉楼": "Watchtower", "快车": "Express", "零碳": "Zero-Carbon",
}
KEYS = sorted(G, key=len, reverse=True)
TAIL = {"山": "Mountain", "湖": "Lake", "岭": "Ridge", "湾": "Bay", "灣": "Bay", "岛": "Island", "河": "River", "村": "Village", "围": "Wai"}
ANY_TAIL = {"街": "Street", "门": "Gate", "馆": "Hall", "堂": "Hall"}
def py(s):
    return "".join(lazy_pinyin(s)).capitalize() if s else ""
def en(name, kind):
    n = name.replace("·", " ").strip()
    out, buf, i = [], "", 0
    def flush():
        nonlocal buf
        if buf:
            b = buf.strip(); tail = ""
            at_end = i >= len(n)
            if len(b) >= 2 and b[-1] in ANY_TAIL and at_end:
                tail, b = ANY_TAIL[b[-1]], b[:-1]
            elif len(b) >= 2 and b[-1] in TAIL and (at_end or kind in ("peak", "nature", "park")) and (b[-1] != "山" or kind in ("peak", "nature", "park")):
                tail, b = TAIL[b[-1]], b[:-1]
            parts = [p for p in re.split(r"(\s+|[A-Za-z0-9]+)", b) if p and not p.isspace()]
            out.extend(p if re.match(r"[A-Za-z0-9]", p) else py(p) for p in parts)
            if tail: out.append(tail)
        buf = ""
    while i < len(n):
        k = next((k for k in KEYS if n.startswith(k, i)), None)
        if k: flush(); (out.append(G[k]) if G[k] else None); i += len(k)
        else: buf += n[i]; i += 1
    flush()
    s = " ".join(out)
    s = s.replace("( ", "(").replace(" )", ")")
    return re.sub(r"\s{2,}", " ", s).strip()
src = open(SRC).read()
res = {}
for m in re.finditer(r'P\("[^"]+","([^"]+)","(\w+)",(?:[^,]*,){5}[^,)]*(?:,(undefined|"[^"]*"))?', src):
    name, kind, e = m.groups()
    if e in (None, "undefined") and re.search(r"[一-鿿]", name): res[name] = en(name, kind)
print(len(res))
for k in list(res)[:0]: pass
if len(sys.argv) > 1:
    for k, v in list(res.items())[:: max(1, len(res)//60)]: print(k, "→", v)
with open(OUT, "w") as f:
    f.write("// GENERATED by tools/i18n/place_en.py — English names for OSM places without name:en\n// (generic terms translated, proper names in pinyin).\n")
    f.write("export const SZ_PLACE_EN_AUTO: Record<string, string> = " + json.dumps(res, ensure_ascii=False, indent=0) + ";\n")
# Huizhou places
hsrc = open("/Users/alexmbp/PycharmProjects/shenhui-life-sim/client/src/places-hz.ts").read()
hres = {}
for m in re.finditer(r'P\("[^"]+","([^"]+)","(\w+)",(?:[^,]*,){5}[^,)]*(?:,(undefined|"[^"]*"))?', hsrc):
    name, kind, e = m.groups()
    if e in (None, "undefined") and re.search(r"[一-鿿]", name): hres[name] = en(name, kind)
print("hz", len(hres))
if len(sys.argv) > 1:
    for k, v in list(hres.items())[:: max(1, len(hres)//70)]: print(k, "→", v)
with open(OUT, "a") as f:
    f.write("export const HZ_PLACE_EN_AUTO: Record<string, string> = " + json.dumps(hres, ensure_ascii=False, indent=0) + ";\n")
# metro / rail stations without an OSM English name
ms = open("/Users/alexmbp/PycharmProjects/shenhui-life-sim/client/src/metro-sz.ts").read()
i = ms.index("SZ_STATION_EN"); j = ms.index("};", i)
have = set(re.findall(r'"([^"]+)":"', ms[i:j]))
st = {}
for n in re.findall(r'S\("([^"]+)"', ms):
    if n not in have and re.search(r"[一-鿿]", n): st[n] = en(n, "station")
st.update({k: "towards Dongguan · Guangzhou" for k in st if k == "东莞·广州方向"})
print("stations", st)
with open(OUT, "a") as f:
    f.write("export const SZ_STATION_EN_AUTO: Record<string, string> = " + json.dumps(st, ensure_ascii=False, indent=0) + ";\n")
