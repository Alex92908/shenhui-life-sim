# ROUND-3 LOG — Agent B：房子 / 声音（2026-11-11）

分支：`feature/round-2` @ 4bc5307b，本地副本 `~/workspace/shenhui-life-sim/`（无 git，只改本地，未推远端，未碰浏览器）。
审计依据：`~/workspace/goals/shenhui-life-sim-launch/files/round-2-omissions-audit-2026-11-11.md` 缺口 3、4、5。

**改了的文件（仅 1 个）：** `client/src/round2/house.ts`
**没改的文件：** `client/src/sound.ts`（核实后确认无需改动，见 §2）、`App.tsx`、`MiniGame.tsx`（只出 snippet，未动）。

---

## 5. 盖房：14 个 ZhuyaHome 家具 id 全部接通发布 ✅

### 问题根源
`data.ts:365-379` 的 `FURNITURE`（ZhuyaHome 真实目录）本来就有 **14 件**，round-2 的 `house.ts` 只认了其中 3 件，另外 5 个是凭空编的 id（`table` / `wardrobe` / `desk` / `tv` / `plant`），目录里根本没有，`houseLayoutToPlacedFurn()` 全部以 `not-in-catalog` 丢弃。

### 接通的 14 个 id（与 data.ts FURNITURE 逐一核对：id、中文名一致）
| id | 中文名 | 房间 | 尺寸（米） |
|---|---|---|---|
| sofa-fabric | 布艺三人沙发 | living | 2.0 × 0.9 |
| sofa-leather | 真皮L型沙发 | living | 2.4 × 1.0 |
| sofa-tatami | 无腿榻榻米沙发 | living | 1.8 × 0.9 |
| table-oak | 橡木圆形茶几 | living | 0.9 × 0.9 |
| table-marble | 大理石方形茶几 | living | 1.2 × 0.7 |
| tv-cabinet | 电视柜组合 | living | 1.8 × 0.45 |
| bed-double | 实木双人床 | bedroom | 1.8 × 2.1 |
| wardrobe | 三门衣柜 | bedroom | 1.8 × 0.6 |
| desk | 书桌 + 显示器支架 | bedroom | 1.2 × 0.6 |
| fridge | 双门冰箱 | kitchen | 0.8 × 0.7 |
| kitchen-cabinet | 整体橱柜 + 灶台 | kitchen | 1.8 × 0.7 |
| dining-table | 四人餐桌椅 | kitchen | 1.4 × 0.8 |
| washer | 滚筒洗衣机 | bathroom | 0.6 × 0.6 |
| bathtub | 独立浴缸 | bathroom | 1.7 × 0.8 |

全部 `inCatalog: true`。旧的 5 个编造 id 已删除（`wardrobe` / `desk` 是真 id，保留；`table`→`table-oak`、`tv`→`tv-cabinet` 另有真 id；`plant` 在目录里不存在，删除）。

### 为什么这样就能发布（逐层核实过，不是只改了名单）
- **服务端不卡 id**：`server/src/actions.ts:1362` `publishHome` 只校验 id 符合 `/^[a-z0-9-]{1,32}$/`、slot 0–6、最多 8 件——14 个 id 全符合。
- **App.tsx 认得出**：`furnById()` 查 `FURNITURE`，14 个全在；发布按钮（App.tsx:7157）把 placed id 加进 `x.furniture` 后调 `publishHome()`，`placedFurn()` / `spotsOf()`（:3390）都能解析。
- **3D 家里画得出来**：`LifeStage.tsx:1314-1362` 的 flat 渲染已对 14 个 id 全有专属几何（sofa-leather 的 L 型加长、sofa-tatami 低矮、table-oak 圆桌、tv-cabinet 带电视屏、wardrobe / desk / fridge / kitchen-cabinet / dining-table / washer / bathtub 各有造型），未知 id 才 fallback 到灰盒子。

### 附带：旧存档迁移（同在 house.ts 内）
round-2 已推远端，lee 可能已在浏览器 localStorage 存过含编造 id 的布局。`loadHouseLayout()` 现做迁移：`table`→`table-oak`、`tv`→`tv-cabinet`；`plant` 无对应物，滤掉。`wardrobe` / `desk` 本来就是真 id，无需迁移。

### 验证
- `cd standalone && npm run typecheck`：**0 错误**。
- 运行时抽查（`npx tsx /tmp/house-check.mts`，14 件全摆进一个布局再转 publish payload）：`placed 7，dropped 7（全是 no-free-slot），not-in-catalog drops: 0`。

### 剩余限制（不是 bug，是 7 个槽位的天花板）
- 一次只能发布 **7 件**：`HOUSE_FURN_SLOTS` 只有 7 个槽位，第 8 件起仍以 `no-free-slot` 丢弃。想放满 14 件要加槽位，得改 `LifeStage.tsx` 的 `FURN_SLOTS` + `App.tsx` 的 `placedFurn()`，不在本次可改文件内，留给集成 agent。
- 盖房预览（`LifeStage.tsx:1970` buildplot）只给 3 个旧 id 配了颜色，其余一律灰盒子 `0x78716c`——预览能看但不分颜色，LifeStage 不在可改范围，留给集成 agent。正式发布后的家里不受影响（flat 渲染有专属几何+目录颜色）。

---

## 4. 麻将音效

### (a) 下载：没做，也没再试 ❌（仍缺）
- SFXMint 上次返回 **HTTP 429 限流**，`mahjong.mp3` 全仓仍然没有。按任务要求**没有再试下载**。
- **没有伪造任何 mp3 文件**。`client/src/sound.ts:60` 的 `MAHJONG_SFX_FILE = null` 保持原样，文件路径未改。
- 定时任务明早 9 点（PST）会再试 SFXMint。文件一旦落到 `client/public/music/shenhui-sounds2/sfx/scenes/mahjong.mp3`，只需把 `sound.ts:60` 改成 `"sfx/scenes/mahjong.mp3"` 即可（注释里已写明）。

### (b) 接线：sound.ts 无需改动，snippet 如下 ✅（待集成 agent 落到 App.tsx / MiniGame.tsx）

核实结果：`sfx("mahjong")` 今天已可调用——`sound.ts:65` 的 `Sfx` 联合类型已有 `"mahjong"`，`:661` 的 `playSfxFile` 在 `MAHJONG_SFX_FILE` 为 null 时返回 false，`:693` 的 synth knock fallback（两声方波敲击）随即响起。文件到货后同一调用自动改播真录音，调用点不用动。所以 **sound.ts 一个字没改**。

真正的出牌入口不在 App.tsx，而在小游戏引擎。麻将的玩法链：
- `activities.ts:246-248`：`mahjong` 活动，`game: meter(...)`（见好就收：`push` =「再摸一张，做大牌」，`stop` =「胡了！」）。
- `App.tsx:3920` `startActivity` → `setPlay({ act: a, spec: specFor(a), ... })`；`:3922` `ACT_ANIM` 把 mahjong 映到 `gathering` 过场。
- `App.tsx:7357` 渲染 `<MiniGame spec={play.spec} … onDone={finishActivity} onQuit={() => setPlay(null)} />`。
- `MiniGame.tsx:204` `Meter.push()` 是**每次出牌/摸牌**的唯一入口（`:218` 是「再摸一张」按钮）；`:219` 是「胡了！」收手按钮。`MiniGame.tsx` 目前没有 import sound，`sfx` 也未在 App.tsx 以外用过。

**Snippet 1 — 每摸一张敲一声（核心，MiniGame.tsx）：**
```tsx
// MiniGame.tsx 顶部新增 import（该文件目前未 import sound）
import { sfx } from "./sound";

// MiniGame 组件 props 增加可选回调（MiniGame 是通用引擎，不能写死 mahjong）：
export function MiniGame({ spec, title, en, onDone, onQuit, onPush }: {
  spec: GameSpec; title: string; en: boolean;
  onDone: (r: GameResult) => void; onQuit: () => void;
  onPush?: () => void;   // ← 新增：push-your-luck 类游戏每次“再来一次”时回调
}) {
  // ……
  {spec.type === "meter" && <Meter spec={spec} en={en} done={!!res} onEnd={finish} onPush={onPush} />}
  // ……
}

// Meter（MiniGame.tsx:204 起）push 里加一行：
function Meter({ spec, en, done, onEnd, onPush }: {
  spec: Extract<GameSpec, { type: "meter" }>; en: boolean; done: boolean;
  onEnd: (r: GameResult) => void; onPush?: () => void;
}) {
  const push = () => {
    if (done || step >= spec.gains.length) return;
    onPush?.();   // ← 新增：摸牌音效（麻将时是 sfx("mahjong")，其它 meter 游戏不传则静默）
    if (Math.random() < risk) { setShake(true); onEnd({ score: 0, bust: true }); return; }
    const n = step + 1; setStep(n);
    if (n >= spec.gains.length) onEnd({ score: 1 });
  };
  // ……
}
```

**Snippet 2 — App.tsx 渲染点传回调 + 开局/结算各敲一声（App.tsx:7357、:3920、finishActivity）：**
```tsx
// App.tsx:7357（MiniGame 唯一渲染点；sfx 已在 :35 import 进 App.tsx）
{play && <MiniGame spec={play.spec} title={`${play.act.emoji} ${L2t(play.act.name)}${play.mate ? (en ? ` with ${trText(play.mate)}` : ` · 和${play.mate}`) : ""}`} en={en} onDone={finishActivity} onQuit={() => setPlay(null)} onPush={play.act.id === "mahjong" ? () => sfx("mahjong") : undefined} />}

// App.tsx:3920 startActivity 内，setPlay 之后加一行（开局上桌敲一声）：
setPlay({ act: a, spec: specFor(a), ...(opts.partyId ? { partyId: opts.partyId } : {}), ...(opts.mate ? { mate: opts.mate } : {}) });
if (a.id === "mahjong") sfx("mahjong");

// finishActivity（App.tsx:3924 起）内，setPlay(null) 之后加（胡牌/翻车结算敲一声；
// 注意：点炮 bust 时也响一声，符合“牌桌有动静”的预期；想区分可在 r.bust 时改 sfx("fail")）：
const finishActivity = (r: GameResult) => {
  const p = play; const s0 = gsRef.current; if (!p || !s0) return;
  setPlay(null);
  if (p.act.id === "mahjong") sfx("mahjong");
  // ……其余不变
};
```
说明：只在 `play.act.id === "mahjong"` 时传回调，其它 meter 游戏（爬山、喝酒、吃串、摆摊、倒卖手机、抬价）不受影响；`onPush` 为空时 `Meter` 行为与原来完全一致。

---

## 3. markUnemployed 调用点 ✅（只读扫描，snippet 待集成 agent 落到 App.tsx）

### 定义
`client/src/round2/lifestyles.ts:249`：
```ts
export function markUnemployed(state: LifestyleState, day: number): LifestyleState {
  if (state.flat.unemployedSinceDay > 0) return state;   // 已失业则幂等，不重置天数
  const next = clone(state);
  next.flat.unemployedSinceDay = day;
  return next;
}
```
传参：当前 `LifestyleState`（App.tsx 里是 `x.life ?? defaultLifestyleState()`）+ 当前游戏天 `x.day`。App.tsx:44 的 lifestyles import 里**没有** `markUnemployed` / `markEmployed`，要补。

### 全仓扫描结果：丢工作的入口只有一个
| 候选入口 | 结论 |
|---|---|
| **裁员剧情线 `layoff`**（`arcs.ts:106-120`） | ✅ **唯一真实入口**，见下 |
| `doAction` 辞职/开除 case | ❌ 不存在。`doAction`（App.tsx:2942-3310）的 case 只有 rest / work / overtime / interview / join-company / canteen / campus-tour / gig / eat / …，**没有 quit / resign / fire 任何一种** |
| `events.ts` 随机事件 | ❌ 无丢工作事件。19 个事件里只有「老板画饼」「晋升季」等，无裁员/解雇选项 |
| 转行 `switchJob`（App.tsx:2789-2800） | ❌ 不是。`x.idenId = 新身份；x.careerIdx = 0`——交培训费立刻换一份新工作，中间没有失业状态 |
| 店铺 `s.shop` 倒闭 | ❌ 没有关店路径。店只能开（App.tsx:6194）、升级、收钱；till 可以为负（:3459 每天 15% 概率亏），但**没有任何代码能把 `x.shop` 置空** |
| 摆摊 `stall`（lifestyles.ts:592 `openStall`） | ❌ 只有开摊，没有 `closeStall`；且摆摊是副业，不是主业 |
| 案底 `record >= 2`（doAction interview :2996） | ❌ 只是面试被拒，不是丢工作 |
| 开局 | ❌ 新局自带身份+工资（`defaultLifestyleState()`，`unemployedSinceDay = 0`），没有“从没工作过”的入口 |

### 唯一入口的精确位置与上下文
`arcs.ts:106` `layoff`「公司要『优化』」，`when: c.wage && c.day >= 4`。第二幕分两支：
- `arcs.ts:114`「你留下了」（前一幕选了「加班表忠心」）：**没丢工作，不调用**。
- `arcs.ts:118`「HR 找你」（前一幕选了「偷偷更新简历」）：「N+1，今天签字，明天不用来了。」两个选项**都意味着丢工作**：
  - `:119` `C("签", "Sign", …, { mood: -6 }, "sign")`
  - `:120` `C("申请劳动仲裁，争 2N", "Go to arbitration for double", …, { energy: -12 }, "fight")`

这两个选项都经由同一个通用 handler 执行：**App.tsx:7584**（剧情卡片的选项按钮）：
```tsx
<button key={i} type="button" disabled={short} onClick={() => { mutate((x) => { applyArcFx(x, c.fx); x.arcs = { ...(x.arcs ?? {}), [arc.id]: { st: prog.st + 1, day: x.day, flags: c.flag ? [...prog.flags, c.flag] : prog.flags } }; }); sfx("click"); setArcCard({ id: arc.id, reply: (en ? c.replyEn : c.replyZh) + (arcFxText(c.fx, en, s.cityKey) ? `（${arcFxText(c.fx, en, s.cityKey)}）` : "") }); }} className="act-btn mt-2.5 disabled:opacity-40">
```
注意：`applyArcFx`（App.tsx:469-475）只动 money / mood / energy / network / xp / rentPct，**完全不知道失业这回事**——所以剧情上被裁了，机制上第二天还能照常 `doAction("work")` 领工资，这正是缺口 3 的实质。

**Snippet — App.tsx:7584 的 mutate 里加两行（只在 layoff 的 sign/fight 选项时触发）：**
```tsx
<button key={i} type="button" disabled={short} onClick={() => { mutate((x) => { applyArcFx(x, c.fx); x.arcs = { ...(x.arcs ?? {}), [arc.id]: { st: prog.st + 1, day: x.day, flags: c.flag ? [...prog.flags, c.flag] : prog.flags } }; if (arc.id === "layoff" && (c.flag === "sign" || c.flag === "fight")) x.life = markUnemployed(x.life ?? defaultLifestyleState(), x.day); }); sfx("click"); setArcCard({ id: arc.id, reply: (en ? c.replyEn : c.replyZh) + (arcFxText(c.fx, en, s.cityKey) ? `（${arcFxText(c.fx, en, s.cityKey)}）` : "") }); }} className="act-btn mt-2.5 disabled:opacity-40">
```
即在原有 `mutate` 内、设置 `x.arcs` 之后追加：
```ts
if (arc.id === "layoff" && (c.flag === "sign" || c.flag === "fight")) x.life = markUnemployed(x.life ?? defaultLifestyleState(), x.day);
```
`markUnemployed` 自带幂等（已失业时返回原 state），重复点选不会重置天数。

**Snippet 0 — import（App.tsx:44）：** 在现有的 lifestyles import 名单里补 `markUnemployed, markEmployed`（`markEmployed` 见下文配套说明）。

### 配套提醒：只加 markUnemployed 会让失业时钟永远不清零
今天 `markEmployed` 也全仓无 App.tsx 调用（只在 `lifestyles.ts:902` `resolveTrial` 内部调——走就业中心试岗被录用时清零）。玩家被裁后若走正常入职路径，失业天数会一直涨：
- **必须配套加** `doAction` 的 `case "join-company"`（App.tsx:3012-3022，接受 offer 跳槽入职）：在 `s.mood += 8;` 之后加 `s.life = markEmployed(s.life ?? defaultLifestyleState());`——`markEmployed`（lifestyles.ts:259）清零 `unemployedSinceDay` 但保留 hope 和心情上限加成，符合设计。
- 不用在 layoff 结局里加：结局「空窗期」（sign 且无 prep）文案就是“找工作花了一个多月”，应保持失业；结局「无缝衔接」（sign + prep）文案说“两周后入职新公司”，但结局在第二天早上就结算，此时立刻清零会抹掉失业状态——留给玩家走试岗 / 跳槽入职时清零更合理。

### 已有接线（核实无误，不用动）
- 失业面板（App.tsx:6939）已读 `flatStatusLine(s.life, lifeProfile(s))`；街坊探望（:7167）已读 `flatDays(s.life, s.day)`；`s.life` 的同步到服务端（:1410 `saveLifestyle`）已随 `gs.life` 变化自动推——所以一旦调用点接上，失业天数、面板、探望、服务端同步全链路自动通。

---

## 没做成的事和原因

1. **麻将 mp3 仍缺**：SFXMint 上次返回 HTTP 429 限流，按任务要求没有再试下载；也没有伪造文件。定时任务明早 9 点（PST）再试。接线已全部写成 snippet，文件到货后 `sfx("mahjong")` 自动改播真录音（`sound.ts:60` 改一行即可），调用点不用动。
2. **App.tsx / MiniGame.tsx 一个字没改**：任务要求只出 snippet。麻将接线的核心钩子在 `MiniGame.tsx` 的 `Meter.push()`（App.tsx 里没有出牌按钮），snippet 覆盖了 `MiniGame.tsx` + `App.tsx` 两处；markUnemployed 的唯一入口在 `App.tsx:7584` 的通用剧情选项 handler，snippet 已给精确行号和代码。
3. **盖房仍有 7 件天花板**：第 8 件家具起仍以 `no-free-slot` 丢弃（flat 只有 7 个槽位），且 buildplot 预览里新家具是灰盒子——两处都要动 `LifeStage.tsx` / `App.tsx`，不在本次可改文件内，见 §5 末尾。
4. **没跑 vite build**：按任务要求只跑了 standalone typecheck（0 错误）+ 一次 `houseLayoutToPlacedFurn` 运行时抽查；未启动服务器。
