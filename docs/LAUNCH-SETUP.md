# 上线设置：登录验证码与付款

代码都已经接好，你只需要开通下面的服务、把密钥填进 `standalone/.env`（复制 `standalone/.env.example`，这个文件不会提交到 git），重启服务器即可。没填的服务会自动关闭，游戏照常运行。

## 1. 邮箱验证码 — Resend（海外 + 国内邮箱都能收）

1. 注册 https://resend.com （有免费额度）。
2. **Domains → Add Domain**，填你的域名，按提示在域名服务商处添加 DNS 记录（SPF / DKIM），等状态变成 Verified。
3. **API Keys → Create API Key**，权限选 Sending access。
4. 填写：
   ```
   RESEND_API_KEY=re_xxxxxxxx
   LOGIN_FROM=湾区人生 <login@你的域名>
   ```
5. 重启后在游戏里「👤 绑定账号 → 📧 邮箱」测试，收到 6 位验证码即成功。

## 2. 短信验证码

**海外号码 — Twilio**
1. 注册 https://www.twilio.com ，在 Console 首页拿到 Account SID 和 Auth Token。
2. 买一个可发短信的号码（Phone Numbers → Buy a number），或建一个 Messaging Service。
3. 填写 `TWILIO_ACCOUNT_SID`、`TWILIO_AUTH_TOKEN`，以及 `TWILIO_FROM=+1…`（或 `TWILIO_MESSAGING_SERVICE_SID=MG…`）。
4. 试用账号只能发给你验证过的号码，正式使用前要升级账号。

**中国大陆号码 — 阿里云短信 / 腾讯云短信**
- 需要**企业资质**：申请短信签名（如「湾区人生」）和验证码模板，审核通过后才能发。
- 这两家都有自己的签名算法，建议用一个很小的转发服务（云函数即可）：接收本游戏 POST 过去的 `{provider, to, code}`，再调用它们的 SDK 发短信。
- 填写 `LOGIN_CODE_WEBHOOK=https://你的云函数地址` 和 `LOGIN_CODE_WEBHOOK_SECRET=一串随机字符`（云函数里校验 `Authorization: Bearer …`）。

## 3. 付款 — Stripe（海外，无需版号）

1. 注册 https://dashboard.stripe.com ，先保持 **Test mode**。
2. **Developers → API keys**，复制 Secret key（`sk_test_…`）→ `STRIPE_SECRET_KEY`。
3. **Developers → Webhooks → Add endpoint**：
   - 地址：`https://你的域名/stripe/webhook`
   - 事件：`checkout.session.completed`、`checkout.session.async_payment_succeeded`、`charge.refunded`
   - 复制 Signing secret（`whsec_…`）→ `STRIPE_WEBHOOK_SECRET`
4. 本地测试 webhook（不需要公网域名）：安装 Stripe CLI，运行
   ```
   stripe listen --forward-to localhost:8787/stripe/webhook
   ```
   它会打印一个 `whsec_…`，本地就填这个。
5. 在游戏「✨ 商店」买一包星光，用测试卡 `4242 4242 4242 4242`（任意未来日期、任意 CVC）付款，✨ 到账即成功；在 Stripe 后台退款，✨ 会被扣回。
6. 测试全部通过后，Stripe 后台完成商户资料审核，再把密钥换成 `sk_live_…` 和正式 webhook 的 `whsec_…`。

> 国内付费（微信支付 / 支付宝 / 微信小游戏虚拟支付）需要企业主体和游戏版号，拿到后再接。

## 4. 上线前检查

- [ ] `DEV_LOGIN_CODES=0`、`DEV_PAYMENTS=0`（否则验证码会显示在页面上、付款是模拟的）
- [ ] `ADMIN_TOKEN` 设成 12 位以上随机字符，后台在 `/#admin`
- [ ] 放在 nginx 等反向代理后面时 `TRUST_PROXY=1`
- [ ] 构建时设置 `VITE_OPERATOR_NAME`、`VITE_OPERATOR_CONTACT`（用户协议和隐私政策里的运营方）
- [ ] 国内上线：ICP 备案；有付费还需版号、实名认证和未成年人防沉迷
- [ ] 真实企业名称的使用请律师过目（见 BUSINESS-PLAN.md）

## 5. 账号体系（已做好）

| 功能 | 在哪 | 说明 |
|---|---|---|
| 游客开玩 | 打开就玩 | 进度存在本机；第 2 天起提示绑定 |
| 注册 / 登录 | 菜单 → 👤 账号 | 邮箱或手机号验证码，一个入口：没注册过就是注册，注册过就是登录 |
| 游客进度并入 | 登录时自动 | 当前进度绑定到账号，换手机登录接着玩 |
| 云存档 | 自动 | 登录后进度同步到服务器 |
| 退出 / 所有设备退出 | 账号页 | 手机丢了可以一键踢掉所有登录 |
| 导出我的数据 / 注销账号 | 账号页 | 个人信息保护法和应用商店都要求有，已经有 |
| 社交门槛 | 服务器 `SOCIAL_REQUIRES_ACCOUNT=1` | 私聊、组局必须绑账号（防骚扰、防小号） |

还没有（按需要再做）：微信登录（需要微信开放平台 / 公众号，企业主体）、实名认证和未成年人防沉迷（国内上线有付费时必须）。

## 6. 运营后台（`https://你的域名/#admin`）

**登录**：主账号用服务器的 `ADMIN_TOKEN`；团队成员用主账号在「🔑 管理员」里生成的口令（只显示一次）。

| 角色 | 能做什么 |
|---|---|
| 主账号 | 全部，外加添加 / 停用团队成员 |
| 运营 | 玩家管理、补偿游戏币和 ✨、公告、广告牌、操作日志 |
| 客服 / 审核 | 举报处理、封号、禁言、强制改名、审歌 |

**页签**：

- 👥 **玩家**：按昵称、玩家编号、登录邮箱 / 手机号搜。详情里能看到：存款、✨、登录方式（打码）、游戏币流水、✨ 流水、订单、被举报记录、最近聊天。可以封号 / 解封、禁言 N 小时、强制改名、补偿游戏币或 ✨（负数是扣回）、取消可疑标记。
- 举报、📣 公告 / 📢 广告牌、意见箱、风险 / 薅羊毛、经济 / 订单、数据（日活、留存）、最近公开聊天、报错、🎶 审歌。
- 📜 **操作日志**：每一次封号、禁言、补偿、改名、加人都记下是谁做的，方便查账、防内鬼。
- 🔑 **管理员**：添加成员（选角色，生成口令）；成员离职点「停用」，口令立刻失效。

## 7. 上线还差什么（按顺序）

**必须（不做上不了）**
- [ ] 服务器：一台云服务器（国内 2 核 4G 起），装 Node 20，`npm run build && npm start`，用 systemd 或 pm2 守护，挂了自动重启
- [ ] 域名 + HTTPS（nginx 反代 + Let's Encrypt），`TRUST_PROXY=1`
- [ ] **ICP 备案**（国内服务器必须；不备案微信里会拦截链接）。来不及就先用香港 / 新加坡服务器，但微信里可能提示风险
- [ ] 登录验证码：至少接一个（邮箱 Resend 最快；国内短信要企业资质）
- [ ] `.env`：`DEV_LOGIN_CODES=0`、`DEV_PAYMENTS=0`、`SOCIAL_REQUIRES_ACCOUNT=1`、`ADMIN_TOKEN` 设长随机串
- [ ] 每天自动备份 `standalone/data/app.db`（cron 复制到另一块盘 / 对象存储），并试一次恢复
- [ ] 用户协议、隐私政策里的运营方（`VITE_OPERATOR_NAME`、`VITE_OPERATOR_CONTACT`）

**强烈建议**
- [ ] 监控：服务器挂了能收到通知（UptimeRobot 之类免费即可），后台「报错」每天看
- [ ] 静态资源走 CDN（主包 600KB gzip，手机 4G 首次打开要几秒）
- [ ] 真实企业名（腾讯、大疆、华为……）和地标商标请律师看一眼；不放心就改成化名
- [ ] 微信分享卡片（标题、缩略图）需要已备案域名 + 公众号 JS-SDK
- [ ] 真机压测：找 20–50 个人同时在线跑一晚

**有收入时再做**
- [ ] 国内收钱：游戏内充值需要**游戏版号**；没有版号前只能做「广告牌」这类线下商家合作，或者海外 Stripe
- [ ] 实名认证 + 未成年人防沉迷（有付费或在国内应用商店上架时必须）
