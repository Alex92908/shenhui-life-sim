# 深惠人生模拟 · 电脑高配版

深圳 / 惠州双城生活模拟游戏：30 天一个人生周期，在深圳或惠州开始过日子——上班赚钱、吃饭睡觉、坐地铁、骑行、租房、装修、认识街坊，赶上 2026 年 11 月深圳 APEC 领导人周，还能当志愿者、记者、接驳司机去会场打卡。

## 玩法设计：大地图只做路线，弹出经历全是真实的

- **大地图 = 路线层**：低多边形 3D 双城地图，按真实地理方位排布，只负责导航、选地点、看位置关系、选出行方式。84 个地点（深圳 52、惠州 32），深圳全地铁网 + 惠州城际/高铁，步行 / 骑行 / 电动车 / 公交 / 打车 / 地铁 / 高铁九档速度各不相同。
- **弹出经历 = 真实层**：住宿、搭乘、吃饭、工作、逛街等一切弹出经历都用真实照片做底（真实地点的实拍），配真实信息（地址、价格、营业时间、小贴士）和互动选择，目标是玩着就认识这座城市。
- **认识深圳图鉴**：每到一个真实地点，解锁它的实拍和城市知识；按真实地铁线做一日游路线任务；拍照认地方小游戏；NPC 带路讲真实故事。中英双语。
- **真实天气**：天色天气跟深圳 / 惠州实时天气走，下雨天游戏里真的下雨。
- **APEC 领导人周活动**：11 月 14–19 日每天一个任务，按真实日程去香蜜湖、前海、太子湾三个会场打卡上岗，玩家只能当志愿者、记者、司机。
- **NPC 模拟**：11 位 NPC 有性格、心情、作息和记忆，会记住你的帮助、礼物和得罪，在街坊墙上发动态、评论。
- **多人联机**：玩家共享一个世界，头像每 6 秒同步，深惠聊天频道、动态墙、排行榜。
- **LOL 式小地图**：角落小地图实时显示玩家位置、NPC 和目的地，点小地图快速定位。

## 运行

这是一个 Muse 空间（TypeScript + React 19 + Three.js + Drizzle + SQLite）项目，运行在 Muse 的托管运行时里。

```bash
bun install
bun run typecheck   # 前后端类型检查
bun run build       # 构建服务端与客户端
```

`package.json` 依赖了 `@hatch/space-sdk`（`file:/opt/hatch/skills/spaces/ts-runtime/dist/space-sdk.tgz`），本地构建需要 Muse 运行时环境。

## 仓库里没有的东西

- **33 张实拍照片**（`client/src/assets/*.jpg`）：快照提交不支持二进制文件，故未包含。`client/src/experience.ts` 引用了它们，缺失时游戏可运行但经历卡片没有照片底图。需要照片时把原图放回 `client/src/assets/`，文件名如下：
  - 地点：place-bay / place-dameisha / place-dm1 / place-dm2 / place-happy / place-hq1 / place-hq2 / place-lf1 / place-lf2 / place-lianhua / place-sy / place-szb1 / place-szb2 / place-wow / place-xh1 / place-xh2
  - 场景：scene-bathroom / scene-bedroom / scene-bus / scene-concourse / scene-gym / scene-home / scene-kitchen / scene-mall / scene-market / scene-metro / scene-office / scene-park / scene-platform / scene-restaurant / scene-station / scene-taxi / scene-train
- **AI 视频过场**：早期版本的 6 段 AI 生成视频已从游戏里删掉，改成游戏内实时 3D 演绎，不在仓库里。
- **联机数据**：`app.db`（玩家、聊天、动态等运行数据）未包含。
- **构建产物与依赖**：`node_modules`、`dist`、`dist-cvm`、`.space-build*`、审计文件等未包含。

## 目录

- `client/src/`：前端（`App.tsx` 主逻辑、`MapView.tsx` 3D 地图、`MetroMap.tsx` 线网图、`LifeStage.tsx` 生活演绎、`experience.ts` 真实经历、`npc.ts` NPC 模拟、`postfx.ts` 后期）
- `server/src/`：服务端动作与数据库模型（`actions.ts`、`schema.ts`）
- `drizzle/`：数据库迁移
- `DATA-PLAN.md`：数据结构说明
