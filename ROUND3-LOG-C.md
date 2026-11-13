# ROUND-3 LOG C — 地图 / 宠物 (Agent C)

日期：2026-11-11。分支：本地 `feature/round-2` @ 4bc5307b（API 拉取副本，无 git，未推远端）。
任务：审计报告缺口 6（MapView 接 npcAllowedAt + community toMapMarkers）与缺口 9(a)（地图上的宠物 3D 形象）；9(b) 家里的宠物只写集成 snippet，不改 LifeStage.tsx。
只改了 3 个文件：`client/src/MapView.tsx`、`client/src/round2/community.ts`、`client/src/round2/pets.ts`。没碰 App.tsx / LifeStage.tsx / data.ts / server / drizzle / .env，未启动服务器，未跑 vite build。

验证：`cd standalone && npm run typecheck` —— 0 错误（改完后跑了两次，第二次在清掉一个未读 ref 之后，也是 0 错误）。

## 一、改了什么（文件 + 行号）

### 1. `client/src/MapView.tsx`

| 改动 | 行号（改后） |
|---|---|
| import `npcAllowedAt`（data.ts）、`COMMUNITY_PIN_COLOR` + `CommunityMapMarker`（round2/community.ts）、`PET_MODEL` + `stepPetFollow` + `Pet` + `PetRuntime`（round2/pets.ts） | :30–:32 |
| Props 新增：`communityMarkers?: CommunityMapMarker[]`、`activePet?: Pet \| null`、`onCommunityMarkerClick?: (marker) => void` | :84–:93 |
| `Chip` 的 `kind` 增加 `"community"`，新增可选字段 `community?: CommunityMapMarker["kind"]` | :578–:580 |
| `npcAnchorLocId` 改用 `npcAllowedAt`：先找允许的地点，再按时段找类型；只有无 allow-list 的 NPC 才回退到纯类型查找 | :335–:359 |
| actor 同步：`npcsForCity` 后过滤掉 allow-list 在本城无匹配的 NPC（如郭叔 `onlyLocIds: []`），初始落点池改用 `npcAllowedAt` | :887–:895 |
| 新增 `petRuntimeRef`（跟随状态机运行时状态）与 `communityChipsRef`（社区图钉 chip 注册表） | :620–:628 |
| 新增模块级 `PetParts`（宠物活动部件注册表）、`disposeObject`（换宠物时释放几何体/材质/徽章贴图）、`makePetGroup(pet)`（宠物模型 builder，见第三节） | :436–:575 |
| 场景 effect 内：宠物模型状态 `petGroup` / `petGroupKey` / `petPhase` | :1044–:1050 |
| 帧循环：宠物跟随驱动（`stepPetFollow` + 腿摆 / 尾巴摇 / 坐姿 / 小跳），放在 actor 清理循环之后、相机跟随之前 | :3516–:3562 |
| declutter 标签流程：社区图钉并入同一轮 `chips` 迭代（`allChips`），新增 `kind === "community"` 优先级分支 | :3683、:3725–:3737 |
| 新增社区图钉同步 effect（在场景 effect 之后声明，见下） | :3905–:3956 |
| 小地图：社区图钉画成按 `COMMUNITY_PIN_COLOR` 着色的圆点 | :4071–:4077 |
| WebGL 失败的备用列表：有图钉时下方多一排“社区动态”按钮，点一下同样回调 `onCommunityMarkerClick` | :4146–:4162 |

### 2. `client/src/round2/community.ts`

- 新增 `COMMUNITY_PIN_COLOR`（:396–:401）：stray `#f59e0b`、notice `#3b82f6`、snake `#dc2626`、fishing `#0ea5e9`，小地图与图钉共用。
- 底部 MAPVIEW SNIPPET 注释改写为已实现的状态（:550 附近）；`toMapMarkers` 本身不用改（过滤规则已对：未过期、未收养/认领、本城）。

### 3. `client/src/round2/pets.ts`

- 新增 `PET_MODEL`（:85–:88）：cat `{ height: 0.55, ear: "pointed", tail: "up-curved", emoji: "🐱" }`，dog `{ height: 0.7, ear: "floppy", tail: "level", emoji: "🐶" }` —— 猫狗区分的唯一事实来源，MapView 的 `makePetGroup` 与它共用。
- `PET_MODEL_HOOK` 与 MAPVIEW SNIPPET 注释改写为已实现的状态，并补了家宠物的集成片段索引（见第四节）。

## 二、图钉的渲染方式

走 MapView 已有的 HTML chip 路线（与地点标签、NPC 名牌同一套），不用新 3D 标记：

1. **数据流**：App 把 `toMapMarkers({ strays, notices, snakes, fishingSpots, cityKey })` 的返回值传给 `communityMarkers` prop（App 接线片段见第五节）。MapView 自己不调服务器、不调 `toMapMarkers`。
2. **同步 effect**（MapView.tsx:3905–:3956）：内容键 `communityKey`（kind:id:label 拼接）或 `cityKey` 变化时重建。每个标记建一个 `<button>` chip：`emoji + label` 文字，`pointer-events:auto`，点一下 `stopPropagation` 后调 `propsRef.current.onCommunityMarkerClick?.(marker)`。位置取 `pin.x/z`，没有就按 `pin.locId` 经 `resolveLoc` 落到对应地点；解析不到坐标的跳过。最多 24 个图钉。
3. **定位**：chip 注册进 `communityChipsRef`，帧循环的 declutter 流程把它和地点/NPC chip 一起投影、去重、边缘夹取（`allChips`，:3683）。优先级：蛇警告 1.5（仅次于玩家本人和搜索图钉），流浪动物 3.5，招领启事 4，钓鱼点 5（都加 `dCam / 60`）。蛇警告在全城视角也显示，其余三类只在拉近后显示——与地点标签的缩放规则一致。蛇图钉红底红字白边（`#fef2f2` / `#dc2626` / `#991b1b`），其余是默认米白 pill。
4. **小地图**：同一批 chip 的 `getPos()` 画成 `COMMUNITY_PIN_COLOR` 的小圆点（r=3.2），每 120ms 随 minimap 重绘一起更新。
5. **为什么 effect 声明在场景 effect 之后**：场景重建时会 `labels.innerHTML = ""` 清空整个标签层；React 按声明顺序跑 effect，所以图钉 effect 在场景 effect 之后重建图钉，不会被清空。城市切换、标记内容变化都会自动重建；卸载时清理自己的 chip 节点。
6. **NPC 落点**：`npcAnchorLocId` 与 actor 同步都改用 `npcAllowedAt`（data.ts:239，含 `onlyLocIds` / `neverLocIds`）。效果举例：阿海只在海鲜街/渔港/海边排班，不会午饭时间被派去二手市集；大芬姐不去大芬/华强北；郭叔（`onlyLocIds: []`，惠州暂无真菜市场）本城不落点，而不是随机落在某个角落。`王姨`/`老周`（`cities: []`）本来就被 `npcsForCity` 排除，不受影响。

## 三、宠物模型：几何结构（地图上的跟随宠物）

`makePetGroup(pet)`（MapView.tsx:472–:575），与 LifeStage `makeFigure`、地图人物 builder 同一路子：纯 Three.js 基础几何体拼装，无新 .glb。朝向 +Z，与 actor 一致（`rotation.y = heading`）。

- **共用结构**：4 条腿（圆柱，顶部 pivot，`0.22` 高，走路时绕 pivot 摆动）；身体椭球（SphereGeometry 缩放 `0.85 / 0.78 / 1.3`，在 `body` 子组里）；浅色肚子（同色提亮 45% 的小椭球）；头（球，位于身体前端上方）；两只黑色小球眼睛（round-2 的“不要无脸”规则同样适用于动物）；徽章 sprite（`emojiSprite`，🐱/🐶，0.9 大小，头顶 0.85 高，与 NPC 徽章同一语言）。
- **猫狗区分**（规格见 `pets.ts` 的 `PET_MODEL`）：
  - **猫**：尖耳——两个四棱锥（ConeGeometry，粉色内耳）；尾巴细而长（0.42，r 0.028），pivot 初始 `rotation.x = -0.35`，向上弯曲；粉色小鼻子；整体比例 1.0，高约 0.55。
  - **狗**：垂耳——两个扁长盒子（BoxGeometry，贴头两侧下垂，微向外张）；尾巴粗而短（0.3，r 0.042），pivot 初始 `rotation.x = -1.15`，向后平伸微翘；浅色吻部盒子 + 深色鼻头；整体放大 1.28 倍，高约 0.7。
  - 颜色：通体用宠物自己的 `pet.color`，垂耳/腿用同色压暗 55%，肚子/吻部用同色提亮。
- **跟随驱动**（帧循环，MapView.tsx:3516–:3562）：每帧 `petRuntimeRef.current = stepPetFollow(pet, runtime, 玩家 x/z, 玩家 heading, dt)`，模型位置/朝向照抄返回值。`stepPetFollow` 的传送（>12 单位）、理想跟随距离（按亲密度 0.9–2.2）都不用改，直接用。换宠物（id/kind/color 变了）时拆掉旧模型（`disposeObject` 释放几何体/材质/徽章贴图）再建新的；没宠物或玩家坐火车时模型隐藏。`petRuntimeRef` 在换宠物或城市重建时重置到玩家脚下。
- **动作**（pose 来自 `stepPetFollow` 的返回值）：
  - `follow`：四腿按 `petPhase` 交替摆动（±0.55 rad），尾巴左右摇（sin 5Hz × 0.45），身体轻微起伏；
  - `sit`：`body` 子组 `rotation.x` 渐变到 -0.5（胸抬起、坐姿），腿保持着地，尾巴慢摇；
  - `play`（心情 ≥70 时 `stepPetFollow` 给的姿态）：原地小跳（`|sin| × 0.09`），尾巴快摇（10Hz）；
  - `sleep`：`body` 前倾 0.28（趴下）。目前地图上极少出现（宠物在家时由 LifeStage 渲染），顺手接了。

## 四、家里宠物：LifeStage 集成 snippet（给集成 agent，不要直接改 LifeStage.tsx）

锚点（均已核对行号，`feature/round-2` @ 4bc5307b 本地副本）：

- 组件：`LifeStage3D`，`client/src/LifeStage.tsx:621`；Props 接口 `LifeStage.tsx:23–63`（`household` 在 :54，可照抄它的可选 prop 写法）。
- 玩家人物：`LifeStage.tsx:2590` `const actor = makeFigure(mat, shirt, pants, 0xf2c79b, faceId ?? ...)`，`:2593` `scene.add(actor.g)`。
- 家场景：`setKind === "flat"` 分支 `LifeStage.tsx:1249` 起；客厅分支里门在 `:2302`（`box(1.05, 2.25, 0.09, 0xffffff, -4.4, 1.13, -3.56, 0.6)`，后墙左侧）；沙发在 `(-1.3, 0.3, -2.35)` 附近；`ROAM_SPOTS.flat` 在 `:73`（bed/sit/cook/wash 四个点）。
- 家门口内侧空地（不挡沙发、不挡 ROAM_SPOTS、不挡玩家出生点）：`(-3.6, 0, -2.7)`。
- App 的家渲染：`client/src/App.tsx:7284`（`<LifeStage3D … setKind="flat" … />`）。

Snippet（集成 agent 按此应用到 LifeStage.tsx + App.tsx）：

```tsx
// ---- 1) LifeStage.tsx: Props 接口 (LifeStage.tsx:23-63) 里加：
//   /** 家里坐着的宠物 (App 传 getActivePet(pets)); 只在 setKind === "flat" 时渲染 */
//   homePet?: { kind: "cat" | "dog"; color: number; name: string } | null;

// ---- 2) LifeStage.tsx: 在玩家 actor 建好后 (LifeStage.tsx:2590-2593,
//   `scene.add(actor.g);` 之后) 加：
//   // 家里的宠物: 坐在门口内侧等主人 (round-3, 缺口 9b)。几何体与 MapView 的
//   // makePetGroup 同款 (猫尖耳/狗垂耳 + 尾巴 + 四腿 + 眼睛); 抽成共享 builder
//   // 之前先在 LifeStage 里照抄一份 makePetGroup (它只用 THREE + pet 字段)。
//   // 位置来自 pets.ts 的 petHomePose(): 门在后墙 (-4.4, 1.13, -3.56),
//   // 门口内侧一点是 (-3.6, 0, -2.7); 面朝门口即 rotation.y = Math.PI。
//   if (setKind === "flat" && propsRef.current.homePet) {
//     const hp = makePetGroup(propsRef.current.homePet);
//     hp.position.set(-3.6, 0, -2.7);
//     hp.rotation.y = Math.PI; // 面朝门口
//     // 坐姿: body 子组抬起 (与 MapView 帧循环里 sit 的 -0.5 同值)
//     const parts = hp.userData as PetParts;
//     if (parts.body) parts.body.rotation.x = -0.5;
//     scene.add(hp);
//     bobbers.push({ g: hp, ph: 1.3, amp: 0.008 }); // 呼吸起伏, 与人物同制
//   }
//   注意: makePetGroup / PetParts 目前只在 MapView.tsx 里 (模块级函数,
//   MapView.tsx:436-575)。集成时二选一: (a) 把它抽到 client/src/round2/
//   petModel.ts (MapView 与 LifeStage 共用, 推荐); (b) 在 LifeStage 里照抄
//   一份 (快, 但两处要同步改)。抽出来之前不要为了复用而改 MapView 的导出。

// ---- 3) App.tsx: 家渲染处 (App.tsx:7284, setKind="flat" 的 LifeStage3D) 加：
//   homePet={getActivePet(pets)}
//   (getActivePet 已在 App.tsx 里 import 自 ./round2/pets; 只有跟随的那只
//   坐在家里, 其余宠物不渲染 —— 与地图只画 activePet 一致。)
//   另: 玩家在家时 (currentLoc === "home") MapView 本来就被 LifeStage 盖住
//   (paused), 不会同时出现两只宠物。
```

## 五、App 接线片段（给集成 agent，App.tsx 不归我改）

App.tsx 里已有的现成材料：`straysQuery` / `noticesQuery` / `snakesQuery` / `fishingQuery`（App.tsx:1340–:1343，四个查询都已存在，`phase === "game"` 时启用）；`pets` state + `petsRef`（:1324–:1325）；`getActivePet` 已 import。服务端返回字段已核对（server/src/actions.ts）：`getStrays → { strays }`（:3050）、`getNotices → { notices }`（:3190）、`getSnakeWarnings → { warnings }`（:3281）、`getFishingSpots → { spots }`（:3359）。

```tsx
// App.tsx: 在 <MapView … /> 附近 (约 :5846) 加：
import { toMapMarkers } from "./round2/community"; // getActivePet 已 import
const communityMarkers = useMemo(
  () => toMapMarkers({
    strays: straysQuery.data?.strays ?? [],
    notices: noticesQuery.data?.notices ?? [],
    snakes: snakesQuery.data?.warnings ?? [],
    fishingSpots: fishingQuery.data?.spots ?? [],
    cityKey,
  }),
  [straysQuery.data, noticesQuery.data, snakesQuery.data, fishingQuery.data, cityKey],
);
// <MapView … /> 上加三个 prop：
communityMarkers={communityMarkers}
activePet={getActivePet(pets)}
onCommunityMarkerClick={(m) => {
  // 按 m.kind 打开对应详情面板: stray → 流浪动物详情 (喂食/收养),
  // notice → 招领启事详情 (回复/认领), snake → 蛇警告详情 (我也看到了),
  // fishing → 钓点详情 (我也在这儿钓到了)。面板本身已在 App.tsx 里
  // (round-2 (c) 社区面板, App.tsx:4994 附近), 这里只做路由。
}}
```

注意：`toMapMarkers` 会按 `cityKey` 过滤并去掉过期/已收养/已认领的；查询每 120–300 秒自动 refetch，标记内容变化时 `communityKey` 变化，MapView 自动重建图钉。切城市时 `cityKey` 变化同样重建。

## 六、没做成的事和原因

1. **App.tsx 接线没做**：`communityMarkers` / `activePet` / `onCommunityMarkerClick` 三个 prop 已备好、typecheck 通过，但 App.tsx 不归我改（任务限定文件）。在集成 agent 按第五节接线之前，地图上仍然看不到图钉和宠物——这是预期内的半成品状态，不是代码问题。
2. **家里宠物没渲染**：按任务要求没改 LifeStage.tsx（另一 agent 这一轮在改它）。模型 builder 已在 MapView 里写好、snippet 在第四节给了精确锚点（LifeStage.tsx:2590 actor 后、flat 门 :2302、坐点 (-3.6, 0, -2.7)），集成 agent 照抄或抽成共享 builder 即可。
3. **没做浏览器验证**：任务明确不碰浏览器；且 round-2 已知云端浏览器拒绝本地地址。验证只到 standalone typecheck（0 错误）。图钉点击、宠物跟随动画、蛇警告优先级等需在 lee 的 Mac 或浏览器接管后实测。
4. **钓点图钉“只在靠近水域时显示”没做**：round-2 的 community.ts 注释示例提过这条，但 `toMapMarkers` 不区分水域、且上报的钓点本身就带位置；按任务“按 MapView 已有方式做”，钓点与其他三类一样按正常优先级显示，没加水域判断。
5. **流浪动物“信任 ≥40 时显示想靠近”小提示没做**：同上，注释示例里的想法；`toMapMarkers` 的 label 已含信任值（`流浪猫 · 亲人 · 信任 45`），图钉上直接能看到，够用了。
6. **小地图上没画宠物**：宠物紧贴玩家（理想距离 0.9–2.2，经常重叠在玩家大圆点上），画了也看不见；只画了社区图钉圆点。
7. **宠物模型没用 .glb**：任务明确要求按 LifeStage 人物 builder 的路子用简单几何体拼；`client/public/models/` 下也没有现成动物模型可复用。
