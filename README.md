# 深惠人生模拟 · 电脑高配版

深圳 / 惠州 / 香港三城生活模拟游戏：30 天一个人生周期，选一座城开始过日子——上班赚钱、吃饭睡觉、坐地铁、骑行、开车、租房、装修、认识街坊，赶上 2026 年 11 月深圳 APEC 领导人周，还能当志愿者、记者、接驳司机去会场打卡。

## 玩法设计：大地图只做路线，弹出经历全是真实的

- **大地图 = 路线层**：116 个地点（深圳 52、惠州 32、香港 32），按真实地理方位排布，只负责导航、选地点、看位置关系、选出行方式。深圳全地铁网 + 惠州城际/高铁 + 香港全港铁网，步行 / 跑步 / 骑行 / 电动车 / 公交 / 打车 / 地铁 / 高铁 / 自驾 / 渡轮等多档速度各不相同。
- **弹出经历 = 真实层**：住宿、搭乘、吃饭、工作、逛街等一切弹出经历都用真实照片做底（真实地点的实拍），配真实信息（地址、价格、营业时间、小贴士）和互动选择，目标是玩着就认识这座城市。
- **认识城市图鉴**：每到一个真实地点，解锁它的实拍和城市知识；按真实地铁线做一日游路线任务；拍照认地方小游戏；NPC 带路讲真实故事。中英双语。
- **真实天气**：天色天气跟深圳 / 惠州 / 香港（九龙）实时天气走，下雨天游戏里真的下雨。
- **APEC 领导人周活动**：11 月 14–19 日每天一个任务，按真实日程去香蜜湖、前海、太子湾三个会场打卡上岗，玩家只能当志愿者、记者、司机。
- **NPC 模拟**：17 位 NPC（深圳/惠州 11 位 + 香港 6 位）有性格、心情、作息和记忆，会记住你的帮助、礼物和得罪，在街坊墙上发动态、评论。
- **多人联机**：玩家共享一个世界，头像每 6 秒同步，三城聊天频道、动态墙、排行榜。
- **LOL 式小地图**：角落小地图实时显示玩家位置、NPC 和目的地，点小地图快速定位。

## 热血无赖式街道与自驾（2026-11-07）

电脑版地图按真实街道重做：人行道、斑马线、会变灯的红绿灯（两相位 18 秒周期），约 120 家沿街店铺（雨棚、霓虹招牌、夜里亮窗）；车流会跟车排队、红灯前刹停、绿灯起步；22 个路人在人行道上走、等绿灯过马路、进店逛；街坊 NPC 按真实作息跑。新增**跑步**（免费、比步行快）和**自驾**（自己的车、驾驶座视角四步演绎：点火上路、等红灯、跟车流、找车位，油费 + 按地点类型收停车费），右下角有街景视角按钮，可贴到街面以行人高度看车流和行人。

## 香港（2026-11-07）

第三座城市：32 个地点按真实地理排布（新界、九龙、维多利亚港、港岛、大屿山），全套真实港铁（荃湾线、港岛线、观塘线、将军澳线、东铁线、南港岛线、屯马线、东涌线、机场快线、迪士尼线）加巴士、的士、渡轮，电车和山顶缆车做成地点体验；11 个真实地点有实拍照片卡；云吞面、点心、茶餐厅、街市都是真实价格；从深圳/惠州切去香港会播专门的过关场景（出示证件 → 安检 → 一地两检 → 抵达西九龙站），深圳↔西九龙 ¥75、惠州↔西九龙 ¥120，钱不够免费过。

**货币**：香港城内所有金额统一显示 HK$（余额、工资、租金、餐饮、交通等），深圳/惠州保持 ¥；跨境车票按出发地货币标示（西九龙出发 HK$75/HK$120，深圳出发 ¥75，惠州出发 ¥120，深惠之间 ¥40）。

## 运行

这是一个 Muse 空间（TypeScript + React 19 + Three.js + Drizzle + SQLite）项目，运行在 Muse 的托管运行时里。

```bash
bun install
bun run typecheck   # 前后端类型检查
bun run build       # 构建服务端与客户端
```

`package.json` 依赖了 `@hatch/space-sdk`（`file:/opt/hatch/skills/spaces/ts-runtime/dist/space-sdk.tgz`），本地构建需要 Muse 运行时环境。

## 仓库里没有的东西

- **44 张实拍照片**（`client/src/assets/*.jpg`，约 12MB）：快照提交不支持二进制文件，故未包含。`client/src/experience.ts` 引用了它们，缺失时游戏可运行但经历卡片没有照片底图。把原图放回 `client/src/assets/` 即可，文件名如下（另见 `shenhui-life-sim-photos.zip`，随提交说明一起提供）：
  - 地点（27 张）：place-bay / place-buddha / place-dameisha / place-dimsum / place-disney / place-dm1 / place-dm2 / place-happy / place-harbour / place-hq1 / place-hq2 / place-lf1 / place-lf2 / place-lianhua / place-mongkok / place-peak / place-saikung / place-stanley / place-sy / place-szb1 / place-szb2 / place-taio / place-tram / place-wongtaisin / place-wow / place-xh1 / place-xh2
  - 场景（17 张）：scene-bathroom / scene-bedroom / scene-bus / scene-concourse / scene-gym / scene-home / scene-kitchen / scene-mall / scene-market / scene-metro / scene-office / scene-park / scene-platform / scene-restaurant / scene-station / scene-taxi / scene-train
- **AI 视频过场**：早期版本的 6 段 AI 生成视频已从游戏里删掉，改成游戏内实时 3D 演绎，不在仓库里。
- **联机数据**：`app.db`（玩家、聊天、动态等运行数据）未包含。
- **构建产物与依赖**：`node_modules`、`dist`、`dist-cvm`、`.space-build*`、审计文件等未包含。

## 目录

- `client/src/`：前端（`App.tsx` 主逻辑、`MapView.tsx` 3D 地图、`MetroMap.tsx` 线网图、`LifeStage.tsx` 生活演绎、`experience.ts` 真实经历、`npc.ts` NPC 模拟、`postfx.ts` 后期）
- `server/src/`：服务端动作与数据库模型（`actions.ts`、`schema.ts`）
- `drizzle/`：数据库迁移
- `DATA-PLAN.md`：数据结构说明
