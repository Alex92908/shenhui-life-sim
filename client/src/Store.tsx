// ✨ 商店：星光充值、赛季通行证、深漂会员、外观。✨ 只买外观和便利，不卖钱、属性和排名。
import { useEffect, useState } from "react";
import { api, type ApiResponse } from "./api";
import { accountToken } from "./Account";

type State = ApiResponse<typeof api, "storeState">;
/** Name colours a look gives (shown on boards and the online list). */
export const LOOK_COLOR: Record<string, string> = { "name-gold": "#d4a017", "name-jade": "#10b981", "name-rose": "#e11d74" };
export const LOOK_TITLE: Record<string, [string, string]> = { "title-veteran": ["深漂老炮", "Shenzhen Veteran"], "title-harbour": ["维港夜归人", "Harbour Night Owl"] };
const PASS_LEVELS = 30;
const FREE = new Set([3, 7, 14, 21, 28]);
const paidItem = (lv: number) => (lv === 7 ? "title-veteran" : lv === 14 ? "name-jade" : lv === 21 ? "title-harbour" : null);

export function StoreModal({ en, onClose, toast, openAccount }: { en: boolean; onClose: () => void; toast: (m: string) => void; openAccount: () => void }) {
  const [st, setSt] = useState<State | null>(null);
  const [devOrder, setDevOrder] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const T = (zh: string, e: string) => (en ? e : zh);
  const token = accountToken();
  const load = async () => { try { setSt(await api.storeState({ token })); } catch { toast(T("网络不太好，稍后再试。", "Network hiccup — try again.")); } };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const price = (p: { usd: number; cny: number }) => (en || st?.payMode === "stripe" ? `US$${(p.usd / 100).toFixed(2)}` : `¥${(p.cny / 100).toFixed(0)}`);
  const buy = async (product: string) => {
    setBusy(true);
    try {
      const r = await api.createOrder({ token, product: product as never, origin: window.location.origin });
      if (!r.ok) toast(r.error ?? T("下单失败", "Couldn't start the purchase"));
      else if (r.url) window.location.href = r.url;
      else if (r.dev && r.orderId) setDevOrder(r.orderId);
    } catch { toast(T("网络不太好，稍后再试。", "Network hiccup — try again.")); }
    setBusy(false);
  };
  const devPay = async () => {
    if (!devOrder) return;
    const r = await api.devPay({ token, orderId: devOrder });
    setDevOrder(null);
    toast(r.ok ? T("（开发模式）付款成功，已到账。", "(Dev mode) Paid — delivered.") : T("付款失败", "Payment failed"));
    void load();
  };
  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    setBusy(true);
    try { const r = await fn(); toast(r.ok ? okMsg : r.error ?? T("没成功", "That didn't work")); } catch { toast(T("网络不太好，稍后再试。", "Network hiccup — try again.")); }
    setBusy(false); void load();
  };

  const btn = "rounded-full px-3 py-1.5 text-xs font-black disabled:opacity-40";
  const card = "rounded-[14px] border border-[var(--line)] p-3";
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={T("✨ 商店", "✨ Store")} onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--text)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-black">✨ {T("星光商店", "Starlight Store")}</h2><button type="button" onClick={onClose} aria-label={T("关闭", "Close")} className="text-xl">✕</button></div>
        {!token || (st && !st.ok) ? (
          <div className="grid gap-3 text-sm">
            <p>{T("✨ 存在账号里，换手机也不会丢，所以要先登录账号。", "✨ lives in your account (it follows you to new phones), so log in first.")}</p>
            <button type="button" onClick={() => { onClose(); openAccount(); }} className={`${btn} bg-[var(--accent)] text-white`}>👤 {T("登录 / 注册", "Log in / sign up")}</button>
          </div>
        ) : !st ? <p className="text-sm text-[var(--dim)]">{T("加载中…", "Loading…")}</p> : (
          <div className="grid gap-3 text-sm">
            <p className="text-xs text-[var(--dim)]">{T("✨ 只买外观和便利，不卖游戏币、属性和排名；不能提现、不能转给别人；退款会扣回。", "✨ buys looks and conveniences only — never money, stats or rank. It can't be cashed out or transferred; refunds take it back.")}{st.payMode === "dev" ? T(" 现在是开发模式：付款是模拟的。", " Dev mode: payments are simulated.") : st.payMode === "off" ? T(" 支付还没开通。", " Payments aren't switched on yet.") : ""}</p>
            {st.locked && <p className="rounded-[10px] bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{T("这个账号退款次数过多，购买已暂停，请联系客服。", "Too many refunds on this account — purchases are paused. Please contact support.")}</p>}
            <div className={`${card} flex items-center justify-between`}><span className="text-base font-black">✨ {st.stars}</span><span className="text-xs text-[var(--dim)]">{T("我的星光", "My Starlight")}</span></div>

            <section className={card}>
              <h3 className="font-black">💎 {T("充值星光", "Get Starlight")}</h3>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {st.products.filter((p) => p.kind === "stars").map((p) => (
                  <button key={p.id} type="button" disabled={busy || st.locked || st.payMode === "off"} onClick={() => void buy(p.id)} className="rounded-[12px] border border-[var(--line)] p-2 text-center disabled:opacity-40">
                    <span className="block text-sm font-black">✨ {p.stars}{p.bonus ? <span className="text-[var(--accent)]"> +{p.bonus}</span> : null}</span>
                    <span className="block text-xs text-[var(--dim)]">{price(p)}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className={card}>
              <div className="flex items-center justify-between"><h3 className="font-black">🎫 {T(`赛季通行证 · ${st.pass.season}`, `Season pass · ${st.pass.season}`)}</h3>
                {!st.pass.owned && <button type="button" disabled={busy || st.locked || st.payMode === "off"} onClick={() => void buy("season_pass")} className={`${btn} bg-[var(--accent)] text-white`}>{T("购买", "Buy")} {price(st.products.find((p) => p.id === "season_pass")!)}</button>}</div>
              <p className="mt-1 text-xs text-[var(--dim)]">{T(`每天签到升一级（现在 ${st.pass.level}/${PASS_LEVELS} 级）。免费线 5 次 10✨；通行证线每级 8✨，第 7 / 14 / 21 级送称号和昵称颜色。`, `Each day you sign in is a level (now ${st.pass.level}/${PASS_LEVELS}). Free track: 10✨ five times; pass track: 8✨ every level, plus titles and a name colour at levels 7, 14 and 21.`)}</p>
              <div className="mt-2 grid grid-cols-6 gap-1">
                {Array.from({ length: PASS_LEVELS }, (_, i) => i + 1).map((lv) => {
                  const reached = lv <= st.pass.level;
                  const freeOk = FREE.has(lv) && !st.pass.claimed.includes(`free:${lv}`);
                  const paidOk = st.pass.owned && !st.pass.claimed.includes(`paid:${lv}`);
                  const can = reached && (freeOk || paidOk);
                  return (
                    <button key={lv} type="button" disabled={!can || busy} title={paidItem(lv) ?? ""} onClick={() => { const track = freeOk ? "free" : "paid"; void act(() => api.claimStars({ token, what: "pass", track, level: lv }), T(`第 ${lv} 级奖励已领取`, `Level ${lv} reward claimed`)); }}
                      className={`rounded-[8px] border px-1 py-1 text-[10px] font-black ${reached ? "border-[var(--accent)]" : "border-[var(--line)] opacity-50"} ${can ? "bg-[var(--accent)] text-white" : ""}`}>
                      {lv}{paidItem(lv) ? "🎁" : FREE.has(lv) ? "✨" : ""}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={card}>
              <div className="flex items-center justify-between"><h3 className="font-black">🌟 {T("深漂会员", "Member")}</h3>
                <button type="button" disabled={busy || st.locked || st.payMode === "off"} onClick={() => void buy("member_month")} className={`${btn} bg-[var(--accent)] text-white`}>{st.member.until ? T("续 30 天", "Renew 30 days") : T("开通 30 天", "Join for 30 days")} {price(st.products.find((p) => p.id === "member_month")!)}</button></div>
              <p className="mt-1 text-xs text-[var(--dim)]">{st.member.until ? T(`会员到 ${st.member.until.slice(0, 10)}。`, `Member until ${st.member.until.slice(0, 10)}.`) : ""}{T("每天领 10✨、可以戴金色昵称。不给属性、不加钱。", "10✨ every day and the gold name. No stats, no money.")}</p>
              {st.member.until && <button type="button" disabled={busy || st.member.claimedToday} onClick={() => void act(() => api.claimStars({ token, what: "member" }), T("领到 10✨", "+10✨"))} className={`${btn} mt-2 border border-[var(--line)]`}>{st.member.claimedToday ? T("今天已领", "Claimed today") : T("领今天的 10✨", "Claim today's 10✨")}</button>}
            </section>

            <section className={card}>
              <h3 className="font-black">🎨 {T("外观", "Looks")}</h3>
              <div className="mt-2 grid gap-2">
                {st.shop.map((it) => {
                  const own = st.owned.includes(it.id) || (it.id === "name-gold" && !!st.member.until);
                  const on = st.equipped === it.id;
                  return (
                    <div key={it.id} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-bold" style={LOOK_COLOR[it.id] ? { color: LOOK_COLOR[it.id] } : undefined}>{en ? (LOOK_TITLE[it.id]?.[1] ? `Title · ${LOOK_TITLE[it.id]![1]}` : it.id.replace("name-", "Name colour · ")) : it.label}</span>
                      {own ? <button type="button" disabled={busy} onClick={() => void act(() => api.equipLook({ token, item: on ? null : it.id }), on ? T("已取下", "Taken off") : T("已穿上", "Wearing it"))} className={`${btn} ${on ? "bg-[var(--text)] text-[var(--bg)]" : "border border-[var(--line)]"}`}>{on ? T("取下", "Take off") : T("穿上", "Wear")}</button>
                        : <button type="button" disabled={busy || st.stars < it.stars} onClick={() => void act(() => api.buyLook({ token, item: it.id as never }), T("买到了，记得穿上", "Bought — wear it!"))} className={`${btn} border border-[var(--line)]`}>✨ {it.stars}</button>}
                    </div>
                  );
                })}
              </div>
            </section>
            <p className="text-[11px] text-[var(--dim)]">{T("付款由 Stripe 处理，本游戏不保存你的卡号。未成年人请在监护人同意下购买。", "Payments are handled by Stripe; the game never sees your card. Under-18s need a parent's permission.")}</p>
          </div>
        )}
        {devOrder && (
          <div className="mt-3 rounded-[12px] border-2 border-dashed border-[var(--accent)] p-3 text-sm">
            <p className="font-bold">{T("开发模式：没有真实付款。点下面模拟一次付款成功。", "Dev mode: no real payment. Simulate a successful payment below.")}</p>
            <div className="mt-2 flex gap-2"><button type="button" onClick={() => void devPay()} className={`${btn} bg-[var(--accent)] text-white`}>{T("模拟付款成功", "Simulate payment")}</button><button type="button" onClick={() => setDevOrder(null)} className={`${btn} border border-[var(--line)]`}>{T("取消", "Cancel")}</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
