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
