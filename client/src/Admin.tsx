/* ---- 运营后台 ----
   Open the game URL with #admin. Needs the ADMIN_TOKEN set on the server
   (environment variable, at least 12 characters); the token is kept only
   in this tab's sessionStorage. Shows daily actives and D1/D7 retention
   from our own events, the open report queue with the conversation that
   was reported, recent public chat, top events and client errors — and
   lets a moderator dismiss a report or ban / unban a player. */
import { useEffect, useState } from "react";
import { api } from "./api";

type Overview = {
  totalPlayers: number; banned: number;
  dau: [string, number][];
  d1: { base: number; kept: number; rate: number | null }; d7: { base: number; kept: number; rate: number | null };
  topEvents: { name: string; n: number }[];
  reports: { id: number; reason: string; createdAt: string; reporter: { pub: string; name: string }; target: { pub: string; name: string; banned: boolean }; context: { from: string; body: string; at: string }[] }[];
  errors: { id: number; message: string; stack: string | null; url: string | null; ua: string | null; count: number; lastAt: string }[];
  chat: { id: number; player: string; name: string; city: string; body: string; at: string }[];
  economy?: { clamped: { name: string; pub: string; n: number; sum: number }[]; orders: { id: string; product: string; amount: number; currency: string; status: string; provider: string; at: string }[]; starsOutstanding: number };
  feedback?: { id: number; kind: string; body: string; city: string | null; name: string; at: string }[];
  risk?: {
    multiDevice: { n: number; names: string }[];
    burstNet: { n: number; names: string }[];
    inviters: { pub: string; name: string; pending: number; granted: number; rejected: number; expired: number }[];
    rejected: { inviter: string; invitee: string; reason: string; at: string }[];
  };
};
const REASON: Record<string, string> = { harassment: "骚扰", scam: "诈骗", spam: "广告刷屏", inappropriate: "不当内容", minor: "未成年人安全", other: "其他" };
const KEY = "shhr-admin-token";
const t = (iso: string) => new Date(iso).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function AdminPage() {
  const [token, setToken] = useState(() => { try { return sessionStorage.getItem(KEY) ?? ""; } catch { return ""; } });
  const [input, setInput] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"reports" | "numbers" | "chat" | "errors" | "risk" | "economy" | "feedback" | "ops">("reports");
  const [banPub, setBanPub] = useState("");
  const load = async (tok = token) => {
    if (!tok) return;
    const r = await api.adminOverview({ token: tok }).catch(() => null);
    if (!r?.ok) { setErr(r?.error ?? "连不上服务器"); setData(null); return; }
    setErr(""); setData(r.data as Overview);
  };
  useEffect(() => { void load(); const id = window.setInterval(() => void load(), 30_000); return () => window.clearInterval(id); }, [token]);
  const act = async (args: { reportId?: number; targetPub?: string; action: "dismiss" | "ban" | "unban" }) => {
    if (args.action === "ban" && !window.confirm("确定封号？对方将不能聊天、私信、组局、送礼，也会从在线列表和排行榜消失。")) return;
    const r = await api.adminModerate({ token, ...args });
    if (!r.ok) window.alert(r.error ?? "失败");
    void load();
  };

  if (!token) return (
    <div className="grid min-h-screen place-items-center bg-[var(--bg)] p-6 text-[var(--text)]">
      <form className="w-full max-w-sm rounded-[18px] border-2 border-[var(--border)] bg-[var(--surface)] p-5" onSubmit={(e) => { e.preventDefault(); try { sessionStorage.setItem(KEY, input); } catch { /* ignore */ } setToken(input); }}>
        <p className="font-display text-xl font-black">🛠️ 运营后台</p>
        <p className="mt-1 text-xs text-[var(--dim)]">输入服务器环境变量 ADMIN_TOKEN 的值。口令只存在这个标签页里。</p>
        <input type="password" value={input} onChange={(e) => setInput(e.target.value)} aria-label="管理员口令" className="mt-3 w-full rounded-full border-2 border-[var(--border)] bg-[var(--bg)] px-4 py-2" />
        <button type="submit" className="mt-3 w-full rounded-full bg-[var(--text)] py-2.5 font-black text-[var(--bg)]">进入</button>
      </form>
    </div>
  );

  const maxDau = Math.max(1, ...(data?.dau ?? []).map((d) => d[1]));
  return (
    <div className="min-h-screen bg-[var(--bg)] p-4 text-[var(--text)]">
      <div className="mx-auto max-w-5xl">
        <p className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-display text-2xl font-black">🛠️ 运营后台</span>
          <span className="flex gap-2">
            <button type="button" onClick={() => void load()} className="rounded-full border-2 px-3 py-1 text-xs font-black">刷新</button>
            <button type="button" onClick={() => { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } setToken(""); setData(null); }} className="rounded-full border-2 px-3 py-1 text-xs font-black">退出</button>
            <a href="#" onClick={() => { window.location.hash = ""; window.location.reload(); }} className="rounded-full border-2 px-3 py-1 text-xs font-black">回到游戏</a>
          </span>
        </p>
        {err && <p className="mt-3 rounded-[12px] bg-[var(--surface2)] p-3 text-sm font-bold text-[var(--accent)]">{err}</p>}
        {data && (<>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[["玩家总数", data.totalPlayers], ["已封号", data.banned], ["今日活跃", data.dau[data.dau.length - 1]?.[1] ?? 0], ["次日留存", data.d1.rate === null ? "—" : `${data.d1.rate}%（${data.d1.kept}/${data.d1.base}）`], ["7 日留存", data.d7.rate === null ? "—" : `${data.d7.rate}%（${data.d7.kept}/${data.d7.base}）`], ["待处理举报", data.reports.length]].map(([k, v]) => (
              <div key={String(k)} className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-3"><p className="text-[11px] font-bold text-[var(--dim)]">{k}</p><p className="mt-0.5 text-lg font-black">{v}</p></div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {([["reports", `举报（${data.reports.length}）`], ["ops", "📣 公告 / 📢 广告牌"], ["feedback", `意见箱（${data.feedback?.length ?? 0}）`], ["risk", "风险 / 薅羊毛"], ["economy", "经济 / 订单"], ["numbers", "数据"], ["chat", "最近公开聊天"], ["errors", `报错（${data.errors.length}）`]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full border-2 px-3 py-1 text-xs font-black ${tab === k ? "bg-[var(--text)] text-[var(--bg)]" : ""}`}>{l}</button>)}
          </div>

          {tab === "ops" && <OpsPanel token={token} />}
          {tab === "feedback" && (
            <div className="mt-3 space-y-2">
              {(data.feedback ?? []).length === 0 && <p className="text-sm text-[var(--dim)]">还没有玩家反馈。</p>}
              {(data.feedback ?? []).map((f) => (
                <div key={f.id} className="rounded-[12px] border-2 border-[var(--line)] p-2.5 text-sm">
                  <p className="text-xs font-black text-[var(--dim)]">{f.kind === "bug" ? "🐞 Bug" : f.kind === "idea" ? "💡 想法" : "💬 其他"} · {f.name} · {f.city ?? ""} · {t(f.at)}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{f.body}</p>
                </div>
              ))}
            </div>
          )}
          {tab === "reports" && (
            <div className="mt-3 grid gap-2">
              <form className="flex flex-wrap gap-2 rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-3" onSubmit={(e) => { e.preventDefault(); if (banPub.trim()) void act({ targetPub: banPub.trim(), action: "ban" }); }}>
                <input value={banPub} onChange={(e) => setBanPub(e.target.value)} placeholder="玩家公开 id（16 位）" aria-label="玩家公开 id" className="min-w-0 flex-1 rounded-full border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm" />
                <button type="submit" className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-black text-white">封号</button>
                <button type="button" onClick={() => banPub.trim() && void act({ targetPub: banPub.trim(), action: "unban" })} className="rounded-full border-2 px-3 py-1.5 text-xs font-black">解封</button>
              </form>
              {data.reports.length === 0 && <p className="text-sm text-[var(--dim)]">没有待处理的举报。</p>}
              {data.reports.map((r) => (
                <div key={r.id} className="rounded-[12px] border-2 border-[var(--line)] bg-[var(--surface)] p-3">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-black"><span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] text-white">{REASON[r.reason] ?? r.reason}</span>{r.reporter.name} 举报 {r.target.name}<span className="text-[11px] font-bold text-[var(--dim)]">{r.target.pub} · {t(r.createdAt)}{r.target.banned ? " · 已封号" : ""}</span></p>
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-[10px] bg-[var(--bg)] p-2 text-xs">
                    {r.context.length === 0 ? <p className="text-[var(--dim)]">（两人之间没有私信记录）</p> : r.context.slice().reverse().map((m, i) => <p key={i} className={m.from === "target" ? "font-bold text-[var(--accent)]" : ""}>{m.from === "target" ? `${r.target.name}：` : `${r.reporter.name}：`}{m.body} <span className="text-[var(--dim)]">{t(m.at)}</span></p>)}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => void act({ reportId: r.id, action: "dismiss" })} className="rounded-full border-2 px-3 py-1 text-xs font-black">驳回</button>
                    <button type="button" onClick={() => void act({ reportId: r.id, action: "ban" })} className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-black text-white">封号</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "risk" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-3 text-xs">
                <p className="text-sm font-black">📱 一台设备 ≥ 3 个账号</p>
                {(data.risk?.multiDevice ?? []).length === 0 ? <p className="mt-1 text-[var(--dim)]">没有。</p> : data.risk!.multiDevice.map((r, i) => <p key={i} className="mt-1"><b>×{r.n}</b> {r.names}</p>)}
              </div>
              <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-3 text-xs">
                <p className="text-sm font-black">🌐 同一网络 24 小时内 ≥ 5 个新号</p>
                {(data.risk?.burstNet ?? []).length === 0 ? <p className="mt-1 text-[var(--dim)]">没有。</p> : data.risk!.burstNet.map((r, i) => <p key={i} className="mt-1"><b>×{r.n}</b> {r.names}</p>)}
              </div>
              <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-3 text-xs">
                <p className="text-sm font-black">🎟️ 邀请人（待定 / 已发 / 拒绝 / 过期）</p>
                <p className="mt-1 text-[11px] text-[var(--dim)]">被邀请人要活跃 3 天 + 和真人组过局；同设备、同网络不算；每人每周最多发 10 份。</p>
                {(data.risk?.inviters ?? []).map((r) => <p key={r.pub} className="mt-1 flex items-center gap-2"><span className="min-w-0 flex-1 truncate">{r.name}</span><span>{r.pending} / <b className="text-[var(--green)]">{r.granted}</b> / <b className="text-[var(--accent)]">{r.rejected}</b> / {r.expired}</span><button type="button" onClick={() => void act({ targetPub: r.pub, action: "ban" })} className="rounded-full border px-2 text-[11px] font-black">封号</button></p>)}
              </div>
              <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-3 text-xs">
                <p className="text-sm font-black">⛔ 最近被拒的邀请</p>
                {(data.risk?.rejected ?? []).length === 0 ? <p className="mt-1 text-[var(--dim)]">没有。</p> : data.risk!.rejected.map((r, i) => <p key={i} className="mt-1">{r.inviter} → {r.invitee} · <b>{r.reason}</b> <span className="text-[var(--dim)]">{r.at ? t(r.at) : ""}</span></p>)}
              </div>
            </div>
          )}

          {tab === "economy" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-3 text-xs">
                <p className="text-sm font-black">🧾 7 天内被拦下的进账</p>
                <p className="mt-1 text-[11px] text-[var(--dim)]">客户端报上来、超出游戏节奏的钱没有入账（账本 kind = clamped）。反复出现的多半在改存档。</p>
                {(data.economy?.clamped ?? []).length === 0 ? <p className="mt-1 text-[var(--dim)]">没有。</p> : data.economy!.clamped.map((r) => <p key={r.pub} className="mt-1 flex gap-2"><span className="min-w-0 flex-1 truncate">{r.name}</span><span>{r.n} 次</span><b>¥{r.sum.toLocaleString()}</b></p>)}
              </div>
              <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-3 text-xs">
                <p className="text-sm font-black">💳 最近订单 · 流通中的 ✨ {data.economy?.starsOutstanding ?? 0}</p>
                {(data.economy?.orders ?? []).length === 0 ? <p className="mt-1 text-[var(--dim)]">还没有订单。</p> : data.economy!.orders.map((o) => <p key={o.id} className="mt-1 flex gap-2"><span className="min-w-0 flex-1 truncate">{o.product}</span><span>{(o.amount / 100).toFixed(2)} {o.currency.toUpperCase()}</span><b>{o.status}</b><span className="text-[var(--dim)]">{o.provider} · {o.at.slice(5, 16).replace("T", " ")}</span></p>)}
              </div>
            </div>
          )}

          {tab === "numbers" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-3">
                <p className="text-sm font-black">每日活跃（北京时间，近 30 天）</p>
                <div className="mt-2 flex h-32 items-end gap-0.5">{data.dau.map(([d, n]) => <div key={d} title={`${d}：${n}`} className="flex-1 rounded-t bg-[var(--accent)]" style={{ height: `${(n / maxDau) * 100}%` }} />)}</div>
                <p className="mt-1 flex justify-between text-[10px] text-[var(--dim)]"><span>{data.dau[0]?.[0] ?? ""}</span><span>{data.dau[data.dau.length - 1]?.[0] ?? ""}</span></p>
                <p className="mt-2 text-[11px] text-[var(--dim)]">留存按「第一次出现的那天」分组：次日留存 = 第二天也来了的比例。</p>
              </div>
              <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-3">
                <p className="text-sm font-black">近 7 天事件</p>
                <div className="mt-2 grid gap-0.5 text-xs">{data.topEvents.map((e) => <p key={e.name} className="flex justify-between"><span>{e.name}</span><b>{e.n}</b></p>)}</div>
              </div>
            </div>
          )}

          {tab === "chat" && (
            <div className="mt-3 grid gap-1 rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-3 text-sm">
              {data.chat.map((c) => <p key={c.id} className="flex items-center gap-2"><span className="text-[11px] text-[var(--dim)]">{t(c.at)} · {c.city}</span><b>{c.name}</b><span className="min-w-0 flex-1 break-words">{c.body}</span><button type="button" onClick={() => void act({ targetPub: c.player, action: "ban" })} className="shrink-0 rounded-full border px-2 text-[11px] font-black">封号</button></p>)}
            </div>
          )}

          {tab === "errors" && (
            <div className="mt-3 grid gap-2">
              {data.errors.length === 0 && <p className="text-sm text-[var(--dim)]">没有报错。</p>}
              {data.errors.map((e) => (
                <details key={e.id} className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-3 text-xs">
                  <summary className="cursor-pointer font-black">×{e.count} · {e.message} <span className="font-normal text-[var(--dim)]">· 最近 {t(e.lastAt)}</span></summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-[var(--dim)]">{e.url}{"\n"}{e.ua}{"\n"}{e.stack}</pre>
                </details>
              ))}
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}

/* 运营：发公告（玩家「🆕 更新」里立刻看到）、替本地商家挂地图广告牌 */
function OpsPanel({ token }: { token: string }) {
  const [zh, setZh] = useState(""); const [en, setEn] = useState("");
  const [items, setItems] = useState<{ id: number; zh: string; en: string; at: string }[]>([]);
  const [msg, setMsg] = useState("");
  const [ad, setAd] = useState({ city: "sz" as "sz" | "hz" | "hk", slot: 0, owner: "", text: "", emoji: "📢", days: 7 });
  const loadNews = async () => { const r = await api.getAnnouncements({}).catch(() => null); setItems(r?.items ?? []); };
  useEffect(() => { void loadNews(); }, []);
  const post = async (deleteId?: number) => { const r = await api.postAnnouncement({ token, zh: deleteId ? undefined : zh, en: deleteId ? undefined : en, deleteId }); setMsg(r.ok ? (deleteId ? "已删除" : "已发布，玩家下次刷新就能看到") : r.error ?? "失败"); if (r.ok && !deleteId) { setZh(""); setEn(""); } void loadNews(); };
  const placeAd = async () => { const r = await api.adminBillboard({ token, ...ad }); setMsg(r.ok ? (ad.days > 0 && ad.text ? "广告牌已挂上" : "广告牌已撤下") : r.error ?? "失败"); };
  const inp = "w-full rounded-[10px] border-2 border-[var(--line)] bg-[var(--bg)] px-2.5 py-1.5 text-sm";
  return (
    <div className="mt-3 grid gap-4 text-sm">
      {msg && <p className="rounded-[10px] bg-[var(--surface2)] px-3 py-1.5 font-bold">{msg}</p>}
      <div className="rounded-[14px] border-2 border-[var(--line)] p-3">
        <p className="font-black">📣 发更新公告</p>
        <textarea value={zh} onChange={(e) => setZh(e.target.value.slice(0, 400))} rows={3} placeholder="中文：今天上线了……（玩家的「🆕 更新」会亮红点）" className={`${inp} mt-2`} />
        <textarea value={en} onChange={(e) => setEn(e.target.value.slice(0, 400))} rows={2} placeholder="English (optional)" className={`${inp} mt-2`} />
        <button type="button" disabled={!zh.trim()} onClick={() => void post()} className="mt-2 rounded-full bg-[var(--text)] px-4 py-1.5 font-black text-[var(--bg)] disabled:opacity-40">发布</button>
        {items.map((n) => <p key={n.id} className="mt-2 flex items-start gap-2 text-xs"><span className="min-w-0 flex-1 whitespace-pre-wrap">{new Date(n.at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })} · {n.zh}</span><button type="button" onClick={() => void post(n.id)} className="shrink-0 rounded-full border px-2 py-0.5">删除</button></p>)}
      </div>
      <div className="rounded-[14px] border-2 border-[var(--line)] p-3">
        <p className="font-black">📢 替本地商家挂广告牌（免 ✨）</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <select value={ad.city} onChange={(e) => setAd({ ...ad, city: e.target.value as "sz" | "hz" | "hk" })} className={inp}><option value="sz">深圳</option><option value="hz">惠州</option><option value="hk">香港</option></select>
          <select value={ad.slot} onChange={(e) => setAd({ ...ad, slot: Number(e.target.value) })} className={inp}><option value={0}>位置 1（商场）</option><option value={1}>位置 2（车站）</option><option value={2}>位置 3（市场）</option></select>
          <input value={ad.owner} onChange={(e) => setAd({ ...ad, owner: e.target.value.slice(0, 20) })} placeholder="商家名" className={inp} />
          <input value={ad.emoji} onChange={(e) => setAd({ ...ad, emoji: e.target.value.slice(0, 8) })} placeholder="emoji" className={inp} />
          <input value={ad.text} onChange={(e) => setAd({ ...ad, text: e.target.value.slice(0, 20) })} placeholder="广告语（20 字内）" className={`${inp} col-span-2`} />
          <label className="col-span-2 flex items-center gap-2 text-xs font-bold">挂几天 <input type="number" min={0} max={60} value={ad.days} onChange={(e) => setAd({ ...ad, days: Number(e.target.value) })} className={`${inp} w-20`} />（0 = 撤下这个位置）</label>
        </div>
        <button type="button" onClick={() => void placeAd()} className="mt-2 rounded-full bg-[var(--text)] px-4 py-1.5 font-black text-[var(--bg)]">挂上 / 撤下</button>
      </div>
    </div>
  );
}
