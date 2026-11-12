# ROUND-3 LOG-D — 动画/过场（Agent D）— 2026-11-11

任务：审计缺口 8（动画层 13 处仍播散步）+ 缺口 10（上班/加班过场改摇杆）。
只改了 `client/src/LifeStage.tsx` 一个文件；App.tsx 没碰，下面的集成全部是 snippet。
本地分支 feature/round-2 @ 4bc5307b（API 拉取副本，无 git，未推远端，未启动服务器，未跑 vite build）。

## 一、我在 LifeStage.tsx 里改了什么（共 2 处加法，零重构）

### D1. 办公室 ROAM_SPOTS：加了 2 个上班节拍点（缺口 10）
位置：`client/src/LifeStage.tsx:72-74`（`ROAM_SPOTS.office`，原有 coffee/ask/toilet 三点原样保留）。

```ts
{ id: "code", emoji: "💻", zh: "坐下敲代码", en: "Sit down and code", x: -0.9, z: 0.1 },
{ id: "leave", emoji: "🚪", zh: "下班走人", en: "Clock out", x: -2.6, z: 1.9 },
```

选点依据（对照 office 布景 `LifeStage.tsx:1063-1132`）：
- `code`：自己工位在 z≈-0.95、椅子在 (0.4, 0.38)，点放在工位前空地 (-0.9, 0.1)，不在椅子/隔断里；离 roam 出生点 (0.15, 1.15) 约 1.48（> 近点半径 1.15），不会一开场就弹出互动按钮。
- `leave`：前场 (-2.6, 1.9)，离出生点约 2.85，空地（植物在 (-3.1, 0.9)，不挡）。
- 两个点都在 `clampWalk` 可达范围（x ±5.6，z -1.15…2.15）内。
- 原有三点（coffee/ask/toilet）不动：它们是 `VENUE_TALK.office` 的对话锚点（App.tsx:81-88），动了会断场馆对话。code/leave 的场馆对话见下面 snippet S5，补上后场馆模式没有死 pin。

说明：任务说的“加办公室 ROAM_SPOTS”，office 条目本身 round-2 已有（coffee/ask/toilet，LOG-g 已写“Existing spots already cover … office”）。缺的是**上班节拍**的点：原来三个点的文案（请教前辈/去洗手间）跟 code/overtime 的拍子（坐下敲代码/提交/下班）对不上，所以补了 code/leave 两个。过场里点任意 pin 都推进一拍（App.tsx:6786 的 onSpot 不看 id），所以功能上原来三点也能走，但文案对不上拍子。

### D2. watershow 定时过场的演员落点修复（缺口 8）
位置：`client/src/LifeStage.tsx:3113-3114`（frame 循环里 idle 分支，`platform` 分支之后、`else` 默认之前新插的一条 `else if`；既有的 3107 行市场类 set 列表和 `else` 默认分支一字未动）。

```ts
else if (setKind === "watershow") { A.g.position.set(0.2, 0, 1.3); A.g.rotation.y = Math.PI; }
```

原因：watershow 布景（`LifeStage.tsx:1858-1877`）的喷泉水池中心在 (0, -1.2)、半径约 1.9–2.1、水面 y≈0.28；idle 默认落点 (0.2, 0, 0.3) 离池心只有约 1.51，演员会站在水池里。新落点 (0.2, 0, 1.3) 在池边前场（离池心约 2.5），面朝水秀（rotation.y = π，和其它场馆 set 一致）；舞台在 x -5.7…-1.5、z 0.3…1.9，(0.2, 1.3) 不在舞台里；离最近的观众人偶 (0.6, 0.4) 约 0.98，不重叠。

### 没有动的地方（给宠物 agent 的锚点保证）
- `flat` / `bedroom` / `kitchen` / `bathroom` / `home` 的布景代码、ROAM_SPOTS、idle/pose 分支全部未动；`else { A.g.position.set(0.2, 0, 0.3); }` 默认分支一字未动。
- 其余所有 set 的布景、ROAM_SPOTS、相机、roam 导航均未动。

## 二、缺口 8：10 个 animKind 的映射去向

结论先说：tram / temple / oldtown / miniature / farm / watershow 六个 set 的 3D 布景 round-2 (g) 已经建好（LifeStage.tsx:1779 tram、1798 temple、1653 oldtown、1820 miniature、1838 farm、1858 watershow，ROAM_SPOTS 也都有），缺的只是 App.tsx 侧的 LifeKind 成员 + LIFE_SCENES 文案 + lifeStageFor 映射——所以 LifeStage 侧除 D2 外无须新建场景。cycle / gallery / nature / wetland 四个没有专属 set，按“最接近的真实场景”复用已有 set（不是 stroll）。

| animKind | 新 LifeKind | LifeStage set（已有） | 涉及地点（审计 13 处 + 同 kind 顺带修好） | 过场形式 |
|---|---|---|---|---|
| tram | `tram` | `tram`（:1779，叮叮车） | tramroad（湾仔电车路） | 定时，全部 idle |
| temple | `temple` | `temple`（:1798，黄大仙祠） | wongtaisin（黄大仙祠） | 定时，全部 idle |
| oldtown | `oldtown` | `oldtown`（:1653，骑楼老街） | dapengfort、zhongyingjie，顺带 nantou、danshui、yuenlong | 定时，idx 0 walk、其余 idle |
| miniature | `miniature` | `miniature`（:1820，微缩地标） | window（世界之窗）、jinxiu（锦绣中华） | 定时，全部 idle |
| nature | `nature` | `park`（现有，青青世界是雨林公园） | qingqing（青青世界·蝴蝶谷） | 定时，idx 0 walk、其余 idle（沿用 stroll 的 park 走法） |
| farm | `farm` | `farm`（:1838，农场） | gmfarm（光明农场） | 定时，全部 idle |
| wetland | `wetland` | `beach`（现有，海上田园是滨海滩涂） | seagarden（海上田园·红树林） | 定时，idx 0 walk、idx 1 stretch、其余 idle（沿用 beach 的走法） |
| watershow | `watershow` | `watershow`（:1858，水秀 + 滨海商场） | octharbour（欢乐海岸） | 定时，全部 idle（+ D2 落点修复） |
| cycle | `cycle` | `bikehub`（:1918，骑行站 + 绿道） | missionhills（观澜湖）、tseungkwano（将军澳），顺带 honghualake（红花湖骑行站，也有 animKind cycle） | 定时，全部 idle |
| gallery | `gallery` | `museum`（:1700，博物馆展厅） | swcac（海上世界艺术中心），顺带 szmuseum、hzmuseum | 定时，全部 idle |

为什么多数是“全部 idle”而不是 idx 0 walk：walk 姿势是固定路线（x -3.5→2.75，z=0.55，LifeStage.tsx:2955-2968），而这些布景的路人人偶正好站在走线上，演员会穿模——tram 的 rider 在 (-0.6, 0.6)、temple 的求签人在 (2.2, 0.5)、miniature 的导游在 (-1.8, 0.5)、farm 的游客在 (2.6, 0.5)、bikehub 的骑车人在 (1.8, 0.35)、museum 的参观者在 (2.6, 0.3)、watershow 的舞台占了 x -5.7…-1.5、z 0.3…1.9。oldtown 的走线是干净的（摊位都在 z=-1.6，柱子在 z=-2.9），所以 oldtown idx 0 用 walk；nature/wetland 复用 park/beach 已验证过的走法。全部 idle 也有先例（wheel idx 0 idle、coaster/safari 全程 sit）。场景身份由布景 + 专属文案（snippet S1）承担，不靠走位。

没有再一股脑 stroll：10 个 kind 里 0 个映射到 stroll；nature→park、wetland→beach、cycle→bikehub、gallery→museum 都是按地点真实身份选的最接近场景（青青世界是公园、海上田园是海边滩涂、骑行是骑行站、艺术中心是展厅）。

## 三、缺口 10：上班/加班改摇杆

机制已在 App.tsx 里现成（round-2 (g) S5）：`CUTSCENE_ROAM[kind]` 有值时，过场渲染 `LifeStage3D pose="idle" roam`（App.tsx:6783-6786），2.3 秒定时器跳过该 kind（App.tsx:1787-1788），点任意 pin 或点“跳过”推进一拍。LifeStage 侧 office set + ROAM_SPOTS 已就绪（D1 补了节拍点）。所以集成只要把两个 key 加进 CUTSCENE_ROAM（snippet S4），不需要改渲染和定时器逻辑。

code 4 拍（刷卡进公司 / 坐下打开电脑 / 敲代码 / 提交起身接杯水）与 pin 的对应：进公司→leave（门口方向）、坐下/敲代码→code（工位前）、提交接水→coffee（茶水间，原有点）。overtime 3 拍（办公室只剩几盏灯 / 再敲最后一行 / 走出大楼）：前两拍→code、末拍→leave。`day`  montage 里的 office 拍（lifeStageFor "day" idx 4）不动——它不是 CUTSCENE_ROAM 成员，仍走定时 pose="type"，不在任务范围。

## 四、App.tsx 集成 snippet（给集成 agent，不要直接改 App.tsx）

**注意：任务里写的 LifeKind 行号 :477 是旧的，实测 App.tsx 里 `type LifeKind` 在 :572、`LIFE_SCENES` 在 :577、`lifeStageFor` 在 :708、`CUTSCENE_ROAM` 在 :1771（与任务一致）、`ANIM_TO_LIFE` 在 :3326（与任务一致）、`VENUE_TALK.office` 在 :81。以下 snippet 按实测行号锚定。**

### S1. LifeKind + LIFE_SCENES（锚点 App.tsx:572 / :577，`gathering` 条目 :702-707 之后、`};` 之前插入）
```ts
// S1a — LifeKind 加 10 个成员（App.tsx:572，union 末尾追加）：
type LifeKind = "routine" | "day" | "alightRail" | "crossing" | "metro" | "code" | "overtime" | "eat" | "cook" | "sleep" | "wash" | "groceries" | "shopping" | "gym" | "stroll" | "gathering" | "cruise" | "wheel" | "aquarium" | "turtle" | "coaster" | "safari" | "hike" | "beach" | "cablecar" | "tram" | "temple" | "oldtown" | "miniature" | "farm" | "watershow" | "cycle" | "gallery" | "nature" | "wetland";

// S1b — LIFE_SCENES 加 10 条（App.tsx:577，gathering 条目之后插入；LifeStep 的 move 字段目前未被消费，照既有条目写上即可）：
tram: { title: "坐叮叮车", steps: [
  { bg: "🚋 🎫 👥", prop: "🎫", caption: "在站牌下排队上车", sub: "叮叮车慢悠悠进站，车身绿得发亮——上车找个靠窗的位置", move: "walk" },
  { bg: "🚋 🌆 🪟", prop: "🚋", caption: "车厢轻轻晃着往前开", sub: "木头座椅吱呀作响，街景一格一格往后退，时间也慢了下来", move: "stay", fx: "shine" },
  { bg: "🚋 📸 🌇", prop: "📸", caption: "到站了，下车", sub: "叮的一声，车门打开——这一程的风景留在照片里", move: "walk" },
] },
temple: { title: "黄大仙祠上香", tone: "indoor", steps: [
  { bg: "🏮 🙏 🌿", prop: "🙏", caption: "走进大殿，点三炷香", sub: "香火袅袅，殿里安静得能听见自己的心跳", move: "walk" },
  { bg: "🎋 ✨ 🙏", prop: "🎋", caption: "摇一支签", sub: "签筒哗啦啦响，掉出来的那支——是上上签", move: "stay", fx: "shine" },
  { bg: "🌳 🧧 😌", prop: "🧧", caption: "系一条许愿带", sub: "把心愿写在红带上，系在树上——心诚就好", move: "stay" },
] },
oldtown: { title: "逛老街", steps: [
  { bg: "🏛️ 🚶 🌤️", prop: "🚶", caption: "走进骑楼老街", sub: "青石板路两边是老字号，骑楼的影子一格一格落在地上", move: "walk" },
  { bg: "🍢 🥮 😋", prop: "🍢", caption: "尝一块老婆饼", sub: "刚出炉的还烫手，甜香混着街坊的说话声", move: "stay", fx: "chew" },
  { bg: "🏮 📸 🌆", prop: "📸", caption: "在老街口拍一张", sub: "这条街站了一百年，站在这里的人换了一茬又一茬", move: "stay", fx: "shine" },
] },
miniature: { title: "微缩世界一日游", steps: [
  { bg: "🗼 🌍 📸", prop: "🗼", caption: "站在迷你埃菲尔铁塔下", sub: "一抬头，巴黎就在眼前——再走两步就是金字塔", move: "walk" },
  { bg: "🕌 🏯 🌏", prop: "🏯", caption: "一天环游了半个地球", sub: "泰姬陵、白宫、悉尼歌剧院，全都缩成一步之遥", move: "stay", fx: "shine" },
  { bg: "🎭 📸 🌇", prop: "📸", caption: "看一场民俗表演", sub: "鼓点一响，裙摆一转——世界那么大，半天就看完了", move: "stay" },
] },
farm: { title: "农场一日", steps: [
  { bg: "🐄 🥛 🌿", prop: "🥛", caption: "给奶牛挤牛奶", sub: "一桶新鲜的牛奶，带着青草味", move: "stay" },
  { bg: "🌽 🧺 ☀️", prop: "🌽", caption: "到玉米地里摘玉米", sub: "掰下一个，剥开——金黄饱满，今晚加菜", move: "walk", fx: "shine" },
  { bg: "🦀 🌊 😆", prop: "🦀", caption: "下塘摸鱼抓蟹", sub: "裤脚卷到膝盖，螃蟹跑得比你还快", move: "stay" },
] },
watershow: { title: "欢乐海岸水秀", tone: "night", steps: [
  { bg: "⛲ 🌃 ✨", prop: "⛲", caption: "水柱冲上夜空", sub: "音乐一响，喷泉跟着节奏跳舞，水雾里全是彩虹", move: "stay", fx: "shine" },
  { bg: "🛍️ 🌉 🌙", prop: "🛍️", caption: "逛逛滨海商场", sub: "灯牌亮了一整条街，海风从商场门口一阵阵吹进来", move: "stay" },
] },
cycle: { title: "骑行绿道", steps: [
  { bg: "🚲 🎫 🌳", prop: "🚲", caption: "租一辆车", sub: "调好座椅，戴好头盔——绿道在等你", move: "walk" },
  { bg: "🚴 🌿 🌤️", prop: "🚴", caption: "骑上绿道", sub: "风从耳边过，湖面在左边闪，腿越蹬越轻", move: "stay", fx: "shine" },
  { bg: "🌉 🌅 📸", prop: "📸", caption: "骑到跨湾大桥底", sub: "停下来拍一张——海风追着车尾跑了一路", move: "stay", fx: "shine" },
] },
gallery: { title: "看展", tone: "indoor", steps: [
  { bg: "🏺 🎧 🖼️", prop: "🏺", caption: "走进展厅", sub: "灯光打在展品上，安静得只剩脚步声", move: "walk" },
  { bg: "🖼️ 👀 ✨", prop: "🖼️", caption: "在一幅画前站很久", sub: "画里的人也在看你——看展就是这样，慢慢看才有意思", move: "stay", fx: "shine" },
  { bg: "🌊 🌇 📸", prop: "📸", caption: "到屋顶花园看海", sub: "展厅落地窗外就是海，看完展正好赶上日落", move: "stay", fx: "shine" },
] },
nature: { title: "青青世界 · 蝴蝶谷", steps: [
  { bg: "🌴 🦋 🌿", prop: "🦋", caption: "走进热带雨林", sub: "吊桥在脚下轻轻晃，蝴蝶落在肩膀上不肯走", move: "walk" },
  { bg: "🦋 🌸 📸", prop: "📸", caption: "蝴蝶谷里慢慢看", sub: "成百上千只蝴蝶在花丛里起起落落，整个人都安静下来", move: "stay", fx: "shine" },
  { bg: "🌳 🪵 🌤️", prop: "🌳", caption: "爬上观景台", sub: "城市边上的绿野仙踪——站在这里，深圳像另一个世界", move: "stay", fx: "shine" },
] },
wetland: { title: "海上田园 · 滩涂", steps: [
  { bg: "🌾 🦩 🌊", prop: "🦩", caption: "走进红树林", sub: "滩涂上白鹭起起落落，退潮留下一面面小镜子", move: "walk" },
  { bg: "🦀 🪣 😆", prop: "🦀", caption: "下滩涂摸鱼抓蟹", sub: "裤脚卷起来，蚬子一摸一个准——晚饭有着落了", move: "stay", fx: "shine" },
  { bg: "🌅 🌾 📸", prop: "🌅", caption: "在田埂上看日落", sub: "鱼塘一格一格亮起来，慢生活原来长这样", move: "stay", fx: "shine" },
] },
```

### S2. lifeStageFor 加 10 个 case（锚点 App.tsx:708，`cablecar` case 之后、switch 右括号之前插入）
```ts
// Round-3 (D): 审计缺口 8 — 新 kind 的专属场景。walk 只在走线干净的 set 上用：
// tram/temple/miniature/farm/bikehub/museum 的路人人偶站在 walk 走线（z=0.55）上，
// watershow 的舞台占了走线起点，全部 idle；oldtown 走线干净，idx 0 用 walk。
case "tram": return { set: "tram", pose: "idle" };
case "temple": return { set: "temple", pose: "idle" };
case "oldtown": return { set: "oldtown", pose: idx === 0 ? "walk" : "idle" };
case "miniature": return { set: "miniature", pose: "idle" };
case "farm": return { set: "farm", pose: "idle" };
case "watershow": return { set: "watershow", pose: "idle" };
case "cycle": return { set: "bikehub", pose: "idle" };
case "gallery": return { set: "museum", pose: "idle" };
case "nature": return { set: "park", pose: idx === 0 ? "walk" : "idle" };
case "wetland": return { set: "beach", pose: idx === 0 ? "walk" : idx === 1 ? "stretch" : "idle" };
```
⚠️ 必须和 S1/S3 一起上：`lifeStageFor` 现在没有 default 分支，缺了 case 会返回 undefined，App.tsx:6781 的 `sp.set` 会炸；`LIFE_SCENES` 是 `Record<LifeKind, LifeScene>`，缺了条目 typecheck 就过不了。

### S3. ANIM_TO_LIFE 改成恒等映射（锚点 App.tsx:3326，整行替换，上面的注释 :3321-3325 一起换）
```ts
// signature rides and sights get their own scene instead of a plain stroll
// Round-3 (D): the 10 new anim kinds are real LifeKinds now (S1+S2) —
// dedicated 3D sets for tram/temple/oldtown/miniature/farm/watershow, and
// the nearest real scene for cycle→bikehub, gallery→museum, nature→park,
// wetland→beach. Nothing falls back to stroll any more.
const ANIM_TO_LIFE: Partial<Record<string, LifeKind>> = { tram: "tram", temple: "temple", oldtown: "oldtown", miniature: "miniature", nature: "nature", farm: "farm", wetland: "wetland", watershow: "watershow", cycle: "cycle", gallery: "gallery" };
```
注：`animRaw ? (ANIM_TO_LIFE[animRaw] ?? (animRaw as LifeKind))` 这行（:3327-3328）不用动——映射齐了以后 fallback 分支走不到。

### S4. CUTSCENE_ROAM 加 code/overtime（锚点 App.tsx:1771-1774，缺口 10）
```ts
const CUTSCENE_ROAM: Partial<Record<LifeKind, LifeSet>> = {
  sleep: "bedroom", cook: "kitchen", eat: "market", wash: "bathroom",
  groceries: "market", gym: "gym", stroll: "park", shopping: "mall",
  code: "office", overtime: "office",
};
```
就加两个 key。定时器（:1787-1788）和渲染分支（:6783-6786）已经按 CUTSCENE_ROAM 通用处理，不用再改。新 kind 不进 CUTSCENE_ROAM——玩乐/风景类过场照既有惯例走 2.3 秒定时（wheel/aquarium/cruise/beach 都是这样）。

### S5. VENUE_TALK.office 补两个对话（锚点 App.tsx:81，`office: [` 数组里 toilet 条目之后插入）
```ts
// Round-3 (D): 对应 LifeStage.tsx:74 新加的两个 ROAM_SPOTS id；不补的话场馆模式下这两个 pin 点了没反应。
{ id: "code", emoji: "💻", zh: "坐下来敲会儿代码", en: "Sit down and code a while", who: "自己", whoEn: "You", say: "「需求写完了，提测。」", sayEn: "“The feature's done — sending it to test.”", pose: "type", xp: 2 },
{ id: "leave", emoji: "🚪", zh: "收拾东西准备下班", en: "Pack up and head home", who: "自己", whoEn: "You", say: "「电脑锁屏，明天见。」", sayEn: "“Locking the screen — see you tomorrow.”", pose: "idle", mood: 2 },
```
注：`code` 的 pose "type" 会把演员放到工位椅子上（LifeStage pose "type" 的落点就是 (0.4, -0.52, 0.42)，正好是自家工位），和 pin 的位置一致。

## 五、没做成的事和原因

1. **没给 tram/temple/miniature/farm/watershow/cycle/gallery/nature/wetland 新建 3D 布景**——不需要：前六个的布景 round-2 (g) 已建好（见第二节行号），后四个复用已有 set（bikehub/museum/park/beach）。本轮 LifeStage 侧真正的新增几何是 0，只有 D2 一个落点修正。
2. **新 kind 没做成摇杆过场**——任务 8 没要求；玩乐类过场按既有惯例走定时。摇杆只给了上班/加班（任务 10）。
3. **没补 SCENE_PHOTOS**——tram/temple/oldtown/miniature/farm/watershow/bikehub/museum 在 `experience.ts` 的 SCENE_PHOTOS 里没有实拍照片条目。已确认不影响运行：`PhotoCreditLine` 对 undefined url 返回 null（App.tsx:782-784），LifeStage 里 `if (photoUrl)` 才挂背景照片（LifeStage.tsx:2686），没有照片时就是纯 3D 布景。后续如想加实拍背景，在 experience.ts 里给这 7 个 set 加照片即可，不动 LifeStage。
4. **没碰 `day` montage 的 office 拍**——不在任务范围，它仍走定时 pose="type"。
5. **没修 fishingport 不可达（审计缺口 7）**——那是 venueSet/数据层的事，不归动画 agent；但顺带确认：fishingport 的 3D 布景（LifeStage.tsx:1895）和 ROAM_SPOTS 都在，一旦可达就能走。

## 六、验证

- `cd ~/workspace/shenhui-life-sim/standalone && npm run typecheck`（`tsc --noEmit -p tsconfig.json`）：9 个错误，**全部不在 LifeStage.tsx**——7 个在 `MapView.tsx`（TS6133 未使用声明：COMMUNITY_PIN_COLOR、stepPetFollow、disposeObject、makePetGroup、petRuntimeRef、communityChipsRef、communityMarkersRef），2 个在 `server/src/actions.ts`（isGameAvatarId、activePatrol）。这些是其它 round-3 agent 并行改动留下的未使用声明，与本次改动无关，我按任务约束没碰那两个文件。
- LifeStage.tsx 本身 0 错误；两处改动都是已存在类型内的加法（ROAM_SPOTS 数组项、else-if 分支）。
- 未跑 vite build（任务禁令）；未启动服务器；未做浏览器验证（本环境无浏览器任务）。
