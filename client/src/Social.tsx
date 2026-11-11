// 上线运营 + 真人关系：🆕 更新公告与意见箱、🤝 合租 / 结拜 / 情侣、🏛️ 业委会选举。
import { useState, type ReactNode } from "react";
import { adLines, sanheSay } from "./ads";
import { api, type ApiResponse } from "./api";

export type Bond = ApiResponse<typeof api, "getBonds">["bonds"][number];
export type Committee = ApiResponse<typeof api, "committeeState">;
export type Pledge = "rent" | "metro" | "eat";
export type BondKind = Bond["kind"];

export const BOND_INFO: Record<BondKind, { emoji: string; zh: string; en: string; ask: [string, string]; perk: [string, string] }> = {
  roommate: { emoji: "🏠", zh: "合租室友", en: "Roommate", ask: ["邀请合租", "Invite to share a flat"], perk: ["房租各付一半，一起爬阶层梯子", "Rent split in half — climb the ladder together"] },
  sworn: { emoji: "🍻", zh: "结拜", en: "Sworn sibling", ask: ["结拜兄弟姐妹", "Become sworn siblings"], perk: ["深漂路上有人罩：分享卡和名片上都有对方", "Someone has your back — shown on your cards"] },
  partner: { emoji: "💞", zh: "情侣", en: "Partner", ask: ["表白", "Ask them out"], perk: ["在一起了：名片上挂着对方的名字", "Together — their name sits on your card"] },
};
/** what each committee pledge does for the whole city the week after it wins */
export const PLEDGE_INFO: Record<Pledge, { emoji: string; zh: string; en: string; short: [string, string] }> = {
  rent: { emoji: "🏠", zh: "全城房租 -5%", en: "Rent -5% citywide", short: ["房租 -5%", "rent -5%"] },
  metro: { emoji: "🚇", zh: "地铁 / 港铁 / 城轨车票 -20%", en: "Metro fares -20%", short: ["地铁 -20%", "metro -20%"] },
  eat: { emoji: "🍜", zh: "下馆子 -10%", en: "Eating out -10%", short: ["吃饭 -10%", "food -10%"] },
};
/** price multipliers this week, from the elected chair's pledge */
export function policyMul(pledge: Pledge | null | undefined): { rent: number; metro: number; eat: number } {
  return { rent: pledge === "rent" ? 0.95 : 1, metro: pledge === "metro" ? 0.8 : 1, eat: pledge === "eat" ? 0.9 : 1 };
}

/* ---- 🆕 更新公告：上线后每天发，玩家打开游戏就能看到改了什么 ---- */
export const UPDATES: { date: string; zh: string[]; en: string[] }[] = [
  { date: "2026-11-09", zh: [
    "🎲 抽签投胎：开局随机抽出身，10 秒进城；30 天能从城中村搬进南山吗？",
    "🪜 阶层梯子：顶部显示「出身 → 现在」，结局和分享卡都会晒出来",
    "👷 新增 10 个职业：保安、保洁、快递员、厨师、护士、中介、主播、小贩、建筑工人、健身教练",
    "🏛️ 业委会选举：每周一届，主任的政策全城生效",
    "🤝 和真人合租（房租减半）、结拜、表白",
    "🏝️ 惠州有了自己的街坊：渔民阿海、民宿秀姐、下棋的何伯……",
  ], en: [
    "🎲 Draw your origin: a random start, in the city in 10 seconds — can you get from an urban village to Nanshan in 30 days?",
    "🪜 The class ladder: “origin → now” at the top, on your result and on your share card",
    "👷 10 new jobs: guard, cleaner, courier, chef, nurse, estate agent, streamer, street vendor, builder, gym coach",
    "🏛️ Estate committee elections: one a week, the chair's policy applies to the whole city",
    "🤝 Share a flat with a real player (half rent), become sworn siblings, ask someone out",
    "🏝️ Huizhou has its own neighbours: fisherman A-Hai, guesthouse owner Sister Xiu, chess-playing Uncle He…",
  ] },
  { date: "2026-11-08", zh: [
    "🚇 地铁按真实耗时规划，换乘不再绕路",
    "🛑 坐车途中可以就地下车，或者换别的交通工具",
    "⏰ 迟到也能打卡上班（只是没了全勤奖）；刷新不再回到家里",
  ], en: [
    "🚇 Metro routes now go by real travel time — no more detours via a transfer",
    "🛑 Get off mid-ride, or switch to another way of getting there",
    "⏰ Late? You can still clock in (no attendance bonus); reloading keeps you where you were",
  ] },
];
export const LATEST_UPDATE = UPDATES[0]!.date;

export function UpdatesModal({ en, playerId, city, news, onClose, toast }: { en: boolean; playerId: string; city: "sz" | "hz" | "hk"; news: { id: number; zh: string; en: string; at: string }[]; onClose: () => void; toast: (m: string) => void }) {
  const T = (zh: string, e: string) => (en ? e : zh);
  const [kind, setKind] = useState<"bug" | "idea" | "other">("idea");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const r = await api.sendFeedback({ playerId, kind, body: body.trim(), city });
      if (r.ok) { setBody(""); toast(T("收到了，谢谢！我们每天都会看。", "Got it — thank you! We read every one.")); } else toast(r.error ?? T("没发出去", "Couldn't send"));
    } catch { toast(T("网络不太好，稍后再试。", "Network hiccup — try again.")); }
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={T("更新公告", "What's new")}>
      <div className="rise max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="flex items-center justify-between"><span className="font-display text-xl font-black">🆕 {T("更新公告", "What's new")}</span><button type="button" onClick={onClose} className="rounded-full border px-3 py-1 text-xs font-black">✕</button></p>
        {news.map((n) => (
          <div key={`n${n.id}`} className="mt-3 rounded-[12px] border-2 border-[var(--accent)] p-2.5">
            <p className="text-xs font-black text-[var(--accent)]">📣 {new Date(n.at).toLocaleDateString(en ? "en-GB" : "zh-CN", { timeZone: "Asia/Shanghai", month: "short", day: "numeric" })}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{en ? n.en : n.zh}</p>
          </div>
        ))}
        {UPDATES.map((u) => (
          <div key={u.date} className="mt-3">
            <p className="text-xs font-black text-[var(--accent)]">{u.date}</p>
            <ul className="mt-1 space-y-1 text-sm leading-relaxed">{(en ? u.en : u.zh).map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        ))}
        <div className="mt-4 rounded-[14px] border-2 border-[var(--line)] p-3">
          <p className="text-sm font-black">💌 {T("意见箱：想要什么、哪里有 bug，直接告诉我们", "Feedback: ideas, bugs, anything — tell us")}</p>
          <div className="mt-2 flex gap-1.5">
            {([["idea", "💡 想法", "💡 Idea"], ["bug", "🐞 Bug", "🐞 Bug"], ["other", "💬 其他", "💬 Other"]] as const).map(([k, zh, e]) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`rounded-full border-2 px-3 py-1 text-xs font-black ${kind === k ? "border-[var(--border)] bg-[var(--text)] text-[var(--bg)]" : "border-[var(--line)]"}`}>{en ? e : zh}</button>
            ))}
          </div>
          <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 600))} rows={3} aria-label={T("意见内容", "Your feedback")} placeholder={T("比如：希望能养猫 / 深圳北站的地铁换乘不对……", "e.g. I'd love to keep a cat / the transfer at Shenzhen North is wrong…")} className="mt-2 w-full rounded-[12px] border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm" />
          <button type="button" disabled={busy || body.trim().length < 2} onClick={() => void send()} className="mt-2 w-full rounded-full bg-[var(--accent)] py-2.5 text-sm font-black text-white disabled:opacity-40">{T("发送", "Send")}</button>
        </div>
      </div>
    </div>
  );
}

export function BondsModal({ en, playerId, bonds, onClose, toast, refresh, openCard }: { en: boolean; playerId: string; bonds: Bond[]; onClose: () => void; toast: (m: string) => void; refresh: () => void; openCard: (pub: string) => void }) {
  const T = (zh: string, e: string) => (en ? e : zh);
  const answer = async (b: Bond, accept: boolean) => {
    try { const r = await api.answerBond({ playerId, bondId: b.id, accept }); toast(r.ok ? (accept ? T(`${BOND_INFO[b.kind].emoji} 和${b.peerName}成为${BOND_INFO[b.kind].zh}了！`, `${BOND_INFO[b.kind].emoji} You and ${b.peerName} are now ${BOND_INFO[b.kind].en.toLowerCase()}s!`) : T("已婉拒", "Declined")) : r.error ?? T("操作失败", "Couldn't do that")); } catch { toast(T("网络不太好", "Network hiccup")); }
    refresh();
  };
  const end = async (b: Bond) => {
    try { await api.endBond({ playerId, bondId: b.id }); toast(b.status === "pending" ? T("邀请已撤回", "Invitation withdrawn") : b.kind === "roommate" ? T("搬出去了，房租恢复全额", "Moved out — full rent again") : T("关系已解除", "Bond ended")); } catch { toast(T("网络不太好", "Network hiccup")); }
    refresh();
  };
  const incoming = bonds.filter((b) => b.status === "pending" && !b.mine);
  const active = bonds.filter((b) => b.status === "active");
  const sent = bonds.filter((b) => b.status === "pending" && b.mine);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={T("我的关系", "My people")}>
      <div className="rise max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="flex items-center justify-between"><span className="font-display text-xl font-black">🤝 {T("我的关系", "My people")}</span><button type="button" onClick={onClose} className="rounded-full border px-3 py-1 text-xs font-black">✕</button></p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{T("和真人玩家合租（房租各付一半）、结拜、在一起。点地图上玩家的名字 → 名片里发出邀请；只能邀请一起组过局、或者互相聊过天的人。", "Share a flat with a real player (half rent each), become sworn siblings, get together. Tap a player's name on the map → their card to invite; only people you've partied or chatted with.")}</p>
        {incoming.length > 0 && <p className="mt-3 text-sm font-black">📨 {T("等你回复", "Waiting for you")}</p>}
        {incoming.map((b) => (
          <div key={b.id} className="mt-2 rounded-[14px] border-2 border-[var(--accent)] p-3">
            <p className="text-sm font-black">{b.peerEmoji} {b.peerName} · {BOND_INFO[b.kind].emoji} {T(`想和你${BOND_INFO[b.kind].zh === "情侣" ? "在一起" : `成为${BOND_INFO[b.kind].zh}`}`, `wants to be your ${BOND_INFO[b.kind].en.toLowerCase()}`)}</p>
            <p className="text-xs text-[var(--dim)]">{en ? BOND_INFO[b.kind].perk[1] : BOND_INFO[b.kind].perk[0]}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void answer(b, true)} className="rounded-full bg-[var(--accent)] py-2 text-sm font-black text-white">{T("答应", "Accept")}</button>
              <button type="button" onClick={() => void answer(b, false)} className="rounded-full border-2 border-[var(--line)] py-2 text-sm font-black">{T("婉拒", "Decline")}</button>
            </div>
          </div>
        ))}
        <p className="mt-4 text-sm font-black">{T("现在的关系", "Now")}</p>
        {active.length === 0 && <p className="mt-1 text-xs text-[var(--dim)]">{T("还没有。深漂路上，找个人一起扛。", "Nobody yet. This city is easier with someone.")}</p>}
        {active.map((b) => (
          <div key={b.id} className="mt-2 flex items-center gap-2 rounded-[14px] border-2 border-[var(--line)] p-2.5">
            <span className="text-2xl">{b.peerEmoji}</span>
            <button type="button" onClick={() => openCard(b.peerId)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-black">{b.online ? "🟢 " : ""}{b.peerName}</span><span className="block text-xs text-[var(--dim)]">{BOND_INFO[b.kind].emoji} {en ? BOND_INFO[b.kind].en : BOND_INFO[b.kind].zh} · {en ? BOND_INFO[b.kind].perk[1] : BOND_INFO[b.kind].perk[0]}</span></button>
            <button type="button" onClick={() => void end(b)} className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black">{b.kind === "roommate" ? T("搬走", "Move out") : T("解除", "End")}</button>
          </div>
        ))}
        {sent.length > 0 && <p className="mt-4 text-sm font-black">{T("已发出的邀请", "Sent")}</p>}
        {sent.map((b) => (
          <div key={b.id} className="mt-2 flex items-center gap-2 text-sm">
            <span>{b.peerEmoji} {b.peerName} · {BOND_INFO[b.kind].emoji} {en ? BOND_INFO[b.kind].en : BOND_INFO[b.kind].zh}</span>
            <button type="button" onClick={() => void end(b)} className="ml-auto rounded-full border px-2.5 py-0.5 text-[11px] font-black">{T("撤回", "Withdraw")}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CommitteeModal({ en, playerId, city, cityName, st, onClose, toast, refresh, openAccount }: { en: boolean; playerId: string; city: "sz" | "hz" | "hk"; cityName: string; st: Committee | undefined; onClose: () => void; toast: (m: string) => void; refresh: () => void; openAccount: () => void }) {
  const T = (zh: string, e: string) => (en ? e : zh);
  const [pledge, setPledge] = useState<Pledge>("rent");
  const run = async () => {
    try { const r = await api.runForCommittee({ playerId, city, pledge }); if (r.ok) toast(T("报名成功！拉票去吧：把名片发给朋友。", "You're on the ballot! Go get votes.")); else { toast(r.error ?? T("报名失败", "Couldn't sign up")); if (r.error?.includes("账号")) openAccount(); } } catch { toast(T("网络不太好", "Network hiccup")); }
    refresh();
  };
  const vote = async (id: string) => {
    try { const r = await api.voteCommittee({ playerId, city, candidateId: id }); if (r.ok) toast(T("投好了！这周还能改票。", "Voted! You can change it this week.")); else { toast(r.error ?? T("投票失败", "Couldn't vote")); if (r.error?.includes("账号")) openAccount(); } } catch { toast(T("网络不太好", "Network hiccup")); }
    refresh();
  };
  const ends = st ? new Date(st.endsAt) : null;
  const left = ends ? Math.max(0, Math.ceil((ends.getTime() - Date.now()) / 86_400_000)) : 0;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={T("业委会选举", "Estate committee")}>
      <div className="rise max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="flex items-center justify-between"><span className="font-display text-xl font-black">🏛️ {T(`${cityName}业委会`, `${cityName} estate committee`)}</span><button type="button" onClick={onClose} className="rounded-full border px-3 py-1 text-xs font-black">✕</button></p>
        <div className="mt-3 rounded-[14px] border-2 border-[var(--gold)] bg-[#fdf6da] p-3 text-[#5c4a00]">
          <p className="text-xs font-black tracking-[0.12em]">{T("本周主任", "THIS WEEK'S CHAIR")}</p>
          {st?.chair ? (
            <p className="mt-1 text-sm font-black">{st.chair.emoji} {st.chair.name} · {T(`${st.chair.votes} 票当选`, `elected with ${st.chair.votes} votes`)}<br />{PLEDGE_INFO[st.chair.pledge].emoji} {T(`政策：${PLEDGE_INFO[st.chair.pledge].zh}（全城生效到周日）`, `Policy: ${PLEDGE_INFO[st.chair.pledge].en} (whole city, until Sunday)`)}</p>
          ) : <p className="mt-1 text-sm font-bold">{T("还没有主任——这周投出第一位吧，下周一上任。", "No chair yet — vote one in this week; they take office Monday.")}</p>}
        </div>
        <p className="mt-4 text-sm font-black">{T(`下周主任选举 · 还剩 ${left} 天`, `Next week's election · ${left} day${left === 1 ? "" : "s"} left`)}</p>
        <p className="text-xs leading-relaxed text-[var(--dim)]">{T("一人一票，可以改票；得票最多的人下周一上任，承诺的政策全城生效一周。", "One vote each, changeable; the winner takes office Monday and their pledge applies to the whole city for a week.")}</p>
        {(st?.candidates ?? []).length === 0 && <p className="mt-2 text-xs text-[var(--dim)]">{T("还没人参选。第一个站出来的人最容易当选。", "Nobody's running yet. The first to stand has the best odds.")}</p>}
        {(st?.candidates ?? []).map((c) => (
          <div key={c.id} className={`mt-2 flex items-center gap-2 rounded-[14px] border-2 p-2.5 ${st?.myVote === c.id ? "border-[var(--accent)]" : "border-[var(--line)]"}`}>
            <span className="text-2xl">{c.emoji}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{c.name}{c.me ? T("（你）", " (you)") : ""}</span><span className="block text-xs text-[var(--dim)]">{PLEDGE_INFO[c.pledge].emoji} {en ? PLEDGE_INFO[c.pledge].en : PLEDGE_INFO[c.pledge].zh}</span></span>
            <span className="shrink-0 text-sm font-black">{c.votes} {T("票", "votes")}</span>
            {!c.me && <button type="button" disabled={st?.myVote === c.id} onClick={() => void vote(c.id)} className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-black text-white disabled:opacity-40">{st?.myVote === c.id ? T("已投", "Voted") : T("投他", "Vote")}</button>}
          </div>
        ))}
        <div className="mt-4 rounded-[14px] border-2 border-[var(--line)] p-3">
          <p className="text-sm font-black">{st?.running ? T("你在参选：可以换一条承诺", "You're running — you can change your pledge") : T("我要参选", "Stand for election")}</p>
          <div className="mt-2 grid gap-1.5">
            {(Object.keys(PLEDGE_INFO) as Pledge[]).map((k) => (
              <button key={k} type="button" aria-pressed={pledge === k} onClick={() => setPledge(k)} className={`rounded-[12px] border-2 px-3 py-2 text-left text-sm font-bold ${pledge === k ? "border-[var(--border)] bg-[var(--surface2)]" : "border-[var(--line)]"}`}>{PLEDGE_INFO[k].emoji} {en ? PLEDGE_INFO[k].en : PLEDGE_INFO[k].zh}</button>
            ))}
          </div>
          <button type="button" onClick={() => void run()} className="mt-2 w-full rounded-full bg-[var(--text)] py-2.5 text-sm font-black text-[var(--bg)]">{st?.running ? T("更新承诺", "Update pledge") : T("报名参选", "Sign up")}</button>
        </div>
      </div>
    </div>
  );
}

/* ---- 💼 零工：真人雇真人，工钱托管；有纠纷交给同城陪审团 ---- */
export type GigsState = ApiResponse<typeof api, "getGigs">;
type Gig = GigsState["mine"][number];
const GIG_IDEAS: [string, string][] = [["帮我排队买网红奶茶", "Queue for the viral bubble tea"], ["帮忙搬家搬两箱书", "Help move two boxes of books"], ["代送一份文件去福田", "Deliver a document across town"], ["陪练粤语口语", "Cantonese conversation practice"], ["帮我修电脑", "Fix my computer"], ["夜市摊位帮忙一晚", "Help at my night-market stall"]];
const STATUS: Record<string, [string, string]> = { open: ["等人接", "Waiting"], taken: ["干活中", "In progress"], delivered: ["已交付，待确认", "Delivered — awaiting OK"], disputed: ["陪审中", "With the jury"], paid: ["已付款", "Paid"], refunded: ["已退回", "Refunded"] };
export interface NpcGig { id: string; who: string; emoji: string; title: string; pay: string; cost: string; done: boolean }
export function GigsModal({ en, playerId, city, money, st, onClose, toast, refresh, onHeld, onDeliver, openAccount, npcGigs, onNpcGig, prime }: { npcGigs?: NpcGig[]; onNpcGig?: (id: string) => void; prime?: boolean; en: boolean; playerId: string; city: "sz" | "hz" | "hk"; money: number; st: GigsState | undefined; onClose: () => void; toast: (m: string) => void; refresh: () => void; onHeld: (n: number) => void; onDeliver: () => boolean; openAccount: () => void }) {
  const T = (zh: string, e: string) => (en ? e : zh);
  const [tab, setTab] = useState<"find" | "mine" | "jury">("find");
  const [title, setTitle] = useState("");
  const [pay, setPay] = useState(120);
  const [reason, setReason] = useState("");
  const err = (e?: string) => { toast(e ?? T("操作失败", "Couldn't do that")); if (e?.includes("账号")) openAccount(); };
  const post = async () => {
    try { const r = await api.postGig({ playerId, city, title: title.trim(), pay }); if (r.ok) { onHeld(r.held ?? pay); setTitle(""); toast(T(`发出去了！¥${pay} 由平台托管，干完活才付。`, `Posted! ¥${pay} is held until the job's done.`)); setTab("mine"); } else err(r.error); } catch { toast(T("网络不太好", "Network hiccup")); }
    refresh();
  };
  const act = async (g: Gig, a: "take" | "deliver" | "confirm" | "dispute" | "cancel") => {
    if (a === "deliver" && !onDeliver()) return;
    try { const r = await api.gigAction({ playerId, gigId: g.id, act: a, reason: a === "dispute" ? reason : undefined }); if (r.ok) toast(({ take: T("接了！去干活，2 分钟后可以交付。", "Taken! Do the job — you can deliver in 2 minutes."), deliver: T("交付了，等老板确认（2 小时内不确认自动付款）。", "Delivered — the employer has 2 hours to confirm, then it pays automatically."), confirm: T("付款了，对方会收到工钱。", "Paid — the worker gets the money."), dispute: T("投诉已提交，同城玩家 24 小时内投票裁决。", "Complaint filed — the city's players vote within 24 hours."), cancel: T("撤回了，工钱退回你的钱包。", "Withdrawn — the pay comes back to you.") } as Record<string, string>)[a]!); else err(r.error); } catch { toast(T("网络不太好", "Network hiccup")); }
    refresh();
  };
  const vote = async (g: Gig, side: "worker" | "employer") => {
    try { const r = await api.juryVote({ playerId, gigId: g.id, side }); if (r.ok) toast(T("投票了，结案后按多数执行。", "Voted — the majority decides when it closes.")); else err(r.error); } catch { toast(T("网络不太好", "Network hiccup")); }
    refresh();
  };
  const left = (iso: string | null) => { if (!iso) return ""; const m = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000)); return m >= 60 ? T(`${Math.floor(m / 60)} 小时 ${m % 60} 分`, `${Math.floor(m / 60)}h ${m % 60}m`) : T(`${m} 分钟`, `${m} min`); };
  const card = (g: Gig, body: ReactNode) => (
    <div key={g.id} className="mt-2 rounded-[14px] border-2 border-[var(--line)] p-3">
      <p className="flex items-start gap-2"><span className="min-w-0 flex-1 text-sm font-black">{g.title}</span><span className="shrink-0 font-black text-[var(--accent)]">¥{g.pay}</span></p>
      <p className="text-xs text-[var(--dim)]">{g.employer.emoji} {g.employer.name}{g.worker ? ` → ${g.worker.emoji} ${g.worker.name}` : ""} · {en ? STATUS[g.status]?.[1] : STATUS[g.status]?.[0]}</p>
      {body}
    </div>
  );
  const juryN = st?.jury.length ?? 0;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={T("零工", "Gigs")}>
      <div className="rise max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="flex items-center justify-between"><span className="font-display text-xl font-black">💼 {T("零工 · 真人雇真人", "Gigs · real players hiring real players")}</span><button type="button" onClick={onClose} className="rounded-full border px-3 py-1 text-xs font-black">✕</button></p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{T("发活的人先把工钱交给平台托管；接活的人干完交付，老板确认就付款（2 小时不确认自动付）。觉得没干好可以投诉，由同城玩家当陪审团投票。", "The employer's pay is held by the game; the worker delivers, the employer confirms (or it pays out after 2 hours). Unhappy? Complain, and the city's players vote as a jury.")}</p>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {([["find", T("接活", "Find work")], ["mine", T("我的活", "My gigs")], ["jury", `${T("陪审", "Jury")}${juryN ? ` ${juryN}` : ""}`]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={`rounded-full border-2 py-1.5 text-xs font-black ${tab === k ? "border-[var(--border)] bg-[var(--text)] text-[var(--bg)]" : "border-[var(--line)]"}`}>{l}</button>)}
        </div>
        {tab === "find" && <>
          {(st?.open ?? []).length === 0 && <p className="mt-3 text-xs text-[var(--dim)]">{T("城里暂时没人发活。你也可以在「我的活」里发一个。", "No gigs in town right now. Post one under “My gigs”.")}</p>}
          {(st?.open ?? []).map((g) => card(g, <button type="button" onClick={() => void act(g, "take")} className="mt-2 w-full rounded-full bg-[var(--accent)] py-2 text-sm font-black text-white">{T("接这个活", "Take it")}</button>))}
          {(st?.open ?? []).length < 3 && (npcGigs ?? []).length > 0 && <>
            <p className="mt-4 text-xs font-black tracking-wide text-[var(--dim)]">🏘️ {T("街坊也在找人帮忙", "Neighbours need a hand too")}{prime ? T(" · 🔥 晚 8 点黄金档，工钱 ×1.5", " · 🔥 8 pm prime time, pay ×1.5") : ""}</p>
            {npcGigs!.map((g) => (
              <div key={g.id} className="mt-2 rounded-[14px] border-2 border-dashed border-[var(--line)] p-3">
                <p className="text-sm font-black">{g.emoji} {g.title}</p>
                <p className="text-xs text-[var(--dim)]">{g.who} · {g.pay} · {g.cost}</p>
                <button type="button" disabled={g.done} onClick={() => onNpcGig?.(g.id)} className="mt-2 w-full rounded-full border-2 border-[var(--border)] py-1.5 text-xs font-black disabled:opacity-40">{g.done ? T("今天帮过了", "Done today") : T("帮这个忙", "Help out")}</button>
              </div>
            ))}
          </>}
        </>}
        {tab === "mine" && <>
          <div className="mt-3 rounded-[14px] border-2 border-[var(--border)] p-3">
            <p className="text-sm font-black">{T("发一个活", "Post a gig")}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">{GIG_IDEAS.map(([zh, e]) => <button key={zh} type="button" onClick={() => setTitle(en ? e : zh)} className="chip text-[11px]">{en ? e : zh}</button>)}</div>
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 30))} placeholder={T("要别人帮你做什么？", "What do you need done?")} aria-label={T("活的内容", "Gig")} className="mt-2 w-full rounded-full border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm" />
            <label className="mt-2 flex items-center gap-2 text-xs font-bold">{T("工钱", "Pay")} <input type="range" min={30} max={500} step={10} value={pay} onChange={(e) => setPay(Number(e.target.value))} className="flex-1" /> <span className="w-12 text-right font-black">¥{pay}</span></label>
            <button type="button" disabled={title.trim().length < 2 || money < pay} onClick={() => void post()} className="mt-2 w-full rounded-full bg-[var(--text)] py-2 text-sm font-black text-[var(--bg)] disabled:opacity-40">{money < pay ? T("存款不够", "Not enough savings") : T(`托管 ¥${pay} 并发布`, `Hold ¥${pay} and post`)}</button>
          </div>
          {(st?.mine ?? []).map((g) => card(g, <>
            {g.role === "worker" && g.status === "taken" && <button type="button" disabled={!!g.canDeliverAt && new Date(g.canDeliverAt).getTime() > Date.now()} onClick={() => void act(g, "deliver")} className="mt-2 w-full rounded-full bg-[var(--accent)] py-2 text-sm font-black text-white disabled:opacity-40">{g.canDeliverAt && new Date(g.canDeliverAt).getTime() > Date.now() ? T(`干活中… ${left(g.canDeliverAt)}后可交付`, `Working… deliver in ${left(g.canDeliverAt)}`) : T("交付（能量 -8）", "Deliver (energy -8)")}</button>}
            {g.role === "employer" && g.status === "open" && <button type="button" onClick={() => void act(g, "cancel")} className="mt-2 w-full rounded-full border-2 border-[var(--line)] py-2 text-xs font-black">{T("撤回，退回工钱", "Withdraw — get the pay back")}</button>}
            {g.role === "employer" && g.status === "delivered" && <div className="mt-2 grid gap-1.5">
              <button type="button" onClick={() => void act(g, "confirm")} className="rounded-full bg-[var(--accent)] py-2 text-sm font-black text-white">{T("满意，付款", "Happy — pay")}</button>
              <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 80))} placeholder={T("不满意？写一句理由", "Not happy? Say why")} aria-label={T("投诉理由", "Complaint")} className="rounded-full border-2 border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs" />
              <button type="button" onClick={() => void act(g, "dispute")} className="rounded-full border-2 border-[var(--line)] py-1.5 text-xs font-black">{T(`投诉，交给陪审团（${left(g.dueAt)}内）`, `Complain to the jury (within ${left(g.dueAt)})`)}</button>
            </div>}
            {g.status === "delivered" && g.role === "worker" && <p className="mt-1 text-xs text-[var(--dim)]">{T(`${left(g.dueAt)}后自动付款`, `Pays out automatically in ${left(g.dueAt)}`)}</p>}
            {g.status === "disputed" && <p className="mt-1 text-xs text-[var(--dim)]">{T(`理由：${g.reason ?? ""} · 陪审 ${g.votes.worker}:${g.votes.employer}（工人:老板），${left(g.dueAt)}后结案`, `Reason: ${g.reason ?? ""} · jury ${g.votes.worker}:${g.votes.employer} (worker:employer), closes in ${left(g.dueAt)}`)}</p>}
          </>))}
        </>}
        {tab === "jury" && <>
          {juryN === 0 && <p className="mt-3 text-xs text-[var(--dim)]">{T("城里暂时没有纠纷。", "No disputes in town right now.")}</p>}
          {(st?.jury ?? []).map((g) => card(g, <>
            <p className="mt-1 text-xs">{T(`老板的投诉：「${g.reason ?? ""}」`, `The employer's complaint: “${g.reason ?? ""}”`)}</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button type="button" aria-pressed={g.myVote === "worker"} onClick={() => void vote(g, "worker")} className={`rounded-full border-2 py-1.5 text-xs font-black ${g.myVote === "worker" ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--line)]"}`}>{T(`该付工钱（${g.votes.worker}）`, `Pay the worker (${g.votes.worker})`)}</button>
              <button type="button" aria-pressed={g.myVote === "employer"} onClick={() => void vote(g, "employer")} className={`rounded-full border-2 py-1.5 text-xs font-black ${g.myVote === "employer" ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--line)]"}`}>{T(`退钱给老板（${g.votes.employer}）`, `Refund the employer (${g.votes.employer})`)}</button>
            </div>
            <p className="mt-1 text-[11px] text-[var(--dim)]">{T(`${left(g.dueAt)}后结案，平票算工人赢`, `Closes in ${left(g.dueAt)} — a tie goes to the worker`)}</p>
          </>))}
        </>}
      </div>
    </div>
  );
}

/* ---- 📢 地图广告牌：每城三块，✨ 租一周 ---- */
export type BillboardState = ApiResponse<typeof api, "getBillboards">;
const AD_EMOJI = ["📢", "🍜", "☕", "🛍️", "💕", "🎉", "🏠", "💼", "🎮", "🐶"];
export function BillboardModal({ en, token, playerName, city, spots, shop, day, st, onClose, toast, refresh, openAccount, openStore }: { en: boolean; token: string; playerName: string; city: "sz" | "hz" | "hk"; spots: string[]; shop?: string | null; day: number; st: BillboardState | undefined; onClose: () => void; toast: (m: string) => void; refresh: () => void; openAccount: () => void; openStore: () => void }) {
  const T = (zh: string, e: string) => (en ? e : zh);
  const [slot, setSlot] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState("📢");
  const scripts = adLines(city, shop);
  const said = sanheSay(city, day);
  const useLine = (line: string, mark: string) => {
    setText(line.slice(0, 20));
    setEmoji(mark);
    setSlot((cur) => cur ?? (st?.slots ?? []).find((s) => !s.ad)?.slot ?? 0);
  };
  const buy = async () => {
    if (slot === null) return;
    if (!token) { openAccount(); return; }
    try {
      const r = await api.buyBillboard({ token, playerName, city, slot, text: text.trim(), emoji });
      if (r.ok) { toast(T("广告牌挂上了！全城玩家地图上都看得到，挂 7 天。", "Your billboard is up — everyone in town sees it for 7 days.")); setSlot(null); setText(""); }
      else { toast(r.error ?? T("没租成", "Couldn't rent it")); if (r.error?.includes("✨")) openStore(); if (r.error?.includes("登录")) openAccount(); }
    } catch { toast(T("网络不太好", "Network hiccup")); }
    refresh();
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={T("地图广告牌", "Map billboards")}>
      <div className="rise max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="flex items-center justify-between"><span className="font-display text-xl font-black">📢 {T("地图广告牌", "Map billboards")}</span><button type="button" onClick={onClose} className="rounded-full border px-3 py-1 text-xs font-black">✕</button></p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{T(`招聘、招租、销售、三和日结，点一句就写上，字还能改。空着的牌子每天也会挂这四类。${st?.price ?? 300} ✨ 一周。`, `Hiring, rooms, sales and day-labor. Tap a line to fill it in — you can still edit it. Empty boards carry these every day. ${st?.price ?? 300} ✨ a week.`)}</p>
        <div className="mt-3 flex flex-col gap-2">
          {scripts.map((g) => (
            <div key={g.kind}>
              <p className="text-[11px] font-black text-[var(--dim)]">{g.emoji} {T(g.label, g.en)}</p>
              <div className="mt-1 flex flex-wrap gap-1">{g.lines.map((line) => <button key={line} type="button" onClick={() => useLine(line, g.emoji)} className={`rounded-full border px-2 py-1 text-[11px] font-black ${text === line ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--line)]"}`}>{line}</button>)}</div>
              {g.kind === "sanhe" && <p className="mt-1 text-[11px] leading-relaxed text-[var(--dim)]">{T(said.zh, said.en)}</p>}
            </div>
          ))}
        </div>
        {(st?.slots ?? []).map((sl) => (
          <button key={sl.slot} type="button" disabled={!!sl.ad} onClick={() => setSlot(sl.slot)} className={`mt-2 block w-full rounded-[14px] border-2 p-3 text-left disabled:opacity-90 ${slot === sl.slot ? "border-[var(--accent)]" : "border-[var(--line)]"}`}>
            <span className="block text-xs font-black text-[var(--dim)]">📍 {spots[sl.slot] ?? `#${sl.slot + 1}`}</span>
            {sl.ad ? <span className="block text-sm font-black">{sl.ad.emoji} {sl.ad.text} <span className="text-xs font-bold text-[var(--dim)]">· {sl.ad.owner} · {T(`${Math.max(0, Math.ceil((new Date(sl.ad.endsAt).getTime() - Date.now()) / 86_400_000))} 天后空出`, `free in ${Math.max(0, Math.ceil((new Date(sl.ad.endsAt).getTime() - Date.now()) / 86_400_000))} days`)}</span></span> : <span className="block text-sm font-black text-[var(--accent)]">{T("空着 · 点这里租", "Free · tap to rent")}</span>}
          </button>
        ))}
        {slot !== null && (
          <div className="mt-3 rounded-[14px] border-2 border-[var(--border)] p-3">
            <div className="flex flex-wrap gap-1">{AD_EMOJI.map((e) => <button key={e} type="button" aria-pressed={emoji === e} onClick={() => setEmoji(e)} className={`rounded-full border-2 px-2 py-0.5 text-base ${emoji === e ? "border-[var(--accent)]" : "border-transparent"}`}>{e}</button>)}</div>
            <input value={text} onChange={(e) => setText(e.target.value.slice(0, 20))} placeholder={T("写 20 个字以内，比如：南山找室友！", "Up to 20 characters, e.g. Roommate wanted in Nanshan!")} aria-label={T("广告内容", "Billboard text")} className="mt-2 w-full rounded-full border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm" />
            <p className="mt-2 rounded-[10px] bg-[var(--surface2)] px-3 py-1.5 text-center text-sm font-black">📢 {emoji} {text || T("预览", "Preview")}</p>
            <button type="button" disabled={text.trim().length < 2} onClick={() => void buy()} className="mt-2 w-full rounded-full bg-[var(--accent)] py-2.5 text-sm font-black text-white disabled:opacity-40">{token ? T(`用 ${st?.price ?? 300} ✨ 挂 7 天`, `Rent for 7 days · ${st?.price ?? 300} ✨`) : T("先登录账号", "Log in first")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
