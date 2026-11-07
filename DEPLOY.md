# 上线部署

游戏要被很多人玩到，需要一个公开网址。下面三种方式任选其一。

## 1. Muse（项目原本的托管方式）

这是一个 Muse 空间：在 Muse 里用它的 web-artifact 构建 / 发布流程发布即可（见 `AGENTS.md`）。
新增的数据库迁移 `drizzle/0004_social_collections.sql`、`drizzle/0005_anticheat_cloud_saves.sql` 会由 Muse 按顺序执行。

## 2. Docker（任意云服务器 / 容器平台）

```bash
docker build -t shenhui-life .
docker run -d --restart unless-stopped -p 8787:8787 -v shenhui-data:/data --name shenhui shenhui-life
```

- 数据库在卷 `shenhui-data` 里（`/data/app.db`）：玩家、聊天、礼物、云存档都在这，**记得定期备份**。
- 前面放一个 HTTPS 反向代理（Caddy 最省事）：

```
your-domain.com {
  reverse_proxy 127.0.0.1:8787
}
```

HTTPS 是必须的：系统分享面板、复制邀请链接都要求安全上下文。

## 3. 直接用 Node（没有 Docker 的服务器）

```bash
cd standalone
npm ci && npm run build
HOST=0.0.0.0 PORT=8787 DB_PATH=/srv/shenhui/app.db npx tsx server.ts
```

用 systemd 或 pm2 保持常驻，同样在前面加 HTTPS 反代。

## 上线前检查

- 打开 `https://你的域名/`，建一个角色，看右上角在线人数、聊天能发。
- 在「📤 分享」里复制邀请链接，用另一台手机打开，确认开局提示「XX 邀请你来」，邀请人几秒后收到 ¥200。
- 在「🎫 集章」页记下云存档码，换浏览器在开始页输入，能接着玩。
- 天气用 Open-Meteo（免费、无需 key）；服务器连不上外网时设 `WEATHER=off`。
- 防作弊：服务器会比对每次心跳，存款 / 职级 / 站章出现不可能的跳变就把玩家标记为可疑并移出所有排行榜（不删数据）。
