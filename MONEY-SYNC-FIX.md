# 余额同步修复 — 管理员发钱被心跳清掉

## Bug（2026-11-12 实测）

管理员在后台 `补偿游戏币` 发 ¥12,000（后又两次发 ¥24,000），账本显示发钱成功
（`reward +12000 → ¥12337`），但紧接着出现一笔 `spend -12000 → ¥337`，
余额回到 ¥407。两次 ¥24,000 也一样被清掉。

## 根因

1. **服务端 `creditMoney`** 发钱时把 `money` 和 `reportedMoney` 一起抬高。
   但游戏客户端并不知道这笔钱——它从 localStorage 恢复旧余额（¥337），
   每 6 秒心跳把旧余额报上去。
2. **服务端 `settleMoney`** 无条件相信客户端报的"减少"就是花钱：
   `delta = proposed(407) - reportedMoney(12337) = -11930`，
   当作一笔 ¥12,000 消费记账扣回。发钱就这样被"花掉"了。
3. 客户端只在 `bank.corrected` 时才接受服务器的数，而消费分支从不置
   `corrected`，所以客户端永远学不到服务器发的那笔钱。

## 修复（2 处）

- `server/src/actions.ts` · `creditMoney`：发钱只改 `money`，**不动
  `reportedMoney`**。`reportedMoney` 是"客户端上次报过的余额"，
  客户端没报过这笔钱，就不能先替它报。这样下次心跳的 delta
  按旧基准算（+¥70 收入），不会凭空多出一笔 ¥12,000 消费。
- `client/src/App.tsx` · 心跳 `onSuccess`：如果服务器的钱**比本地多**
  （后台发了钱/签到奖励客户端没见过），直接按服务器的数校正上来，
  并弹提示"服务器给你钱包里加了 ¥X"。只往上校正，不会吞掉本地收入。

## 验证

- `bun x tsc --noEmit -p client/tsconfig.json`：只有预先存在的
  `bun-types` 缺失报错，与本次改动无关。
- `npm run build`（standalone）：8.84s，通过。

## 生效方式

lee 侧：`git pull` → `cd standalone && npm run build` → 重启服务器。
重启后重新发钱，余额会留在账上，客户端下次心跳（6 秒内）自动校正
到正确数额，之后可正常在家开店（¥12,000）。
