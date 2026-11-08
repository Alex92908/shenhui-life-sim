// 👤 账号：邮箱 / 手机验证码登录，绑定游客进度，换设备载入，导出与注销。
import { useEffect, useState } from "react";
import { api } from "./api";
import { deviceId } from "./analytics";
import { setCloudCode } from "./share";

const TOKEN_KEY = "shhr-account-token";
export const accountToken = (): string => { try { return localStorage.getItem(TOKEN_KEY) ?? ""; } catch { return ""; } };
const setToken = (t: string) => { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } };

type Me = { id: string; createdAt: string; playerId: string | null; playerName: string | null; identities: { provider: string; masked: string }[] };

export function AccountModal({ en, playerId, saveKey, onClose, toast, onChange }: {
  en: boolean; playerId: string | null; saveKey: string; onClose: () => void; toast: (m: string) => void; onChange: (loggedIn: boolean) => void;
}) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(!!accountToken());
  const [provider, setProvider] = useState<"email" | "phone">("email");
  const [to, setTo] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [other, setOther] = useState<{ hasSave: boolean } | null>(null);
  const [delText, setDelText] = useState("");
  const T = (zh: string, enS: string) => (en ? enS : zh);

  const refresh = async () => {
    const t = accountToken(); if (!t) { setMe(null); setLoading(false); return; }
    try { const r = await api.accountMe({ token: t }); if (r.ok && r.account) setMe(r.account); else { setToken(""); setMe(null); onChange(false); } } catch { /* offline */ }
    setLoading(false);
  };
  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const request = async () => {
    setBusy(true);
    try {
      const r = await api.requestLoginCode({ provider, to });
      if (!r.ok) toast(r.error ?? T("发送失败", "Couldn't send the code"));
      else { setSent(true); setDevCode(r.devCode ?? ""); toast(T("验证码已发送，10 分钟内有效。", "Code sent — valid for 10 minutes.")); }
    } catch { toast(T("网络不太好，稍后再试。", "Network hiccup — try again.")); }
    setBusy(false);
  };
  const verify = async () => {
    setBusy(true);
    try {
      const r = await api.verifyLoginCode({ provider, to, code, playerId: playerId ?? undefined, device: deviceId() || undefined });
      if (!r.ok || !r.token) { toast(r.error ?? T("登录失败", "Login failed")); setBusy(false); return; }
      setToken(r.token); onChange(true);
      if (r.linked) toast(r.isNew ? T("账号创建好了，现在的进度已经绑定。", "Account created and your progress is linked.") : T("登录成功。", "Logged in."));
      else if (r.accountPlayerId && r.accountPlayerId !== playerId) setOther({ hasSave: !!r.hasCloudSave });
      await refresh();
    } catch { toast(T("网络不太好，稍后再试。", "Network hiccup — try again.")); }
    setBusy(false);
  };
  const loadAccountSave = async () => {
    const r = await api.accountLoadSave({ token: accountToken() });
    if (!r.ok || !r.save) { toast(T("账号里还没有云存档。", "No cloud save on this account yet.")); return; }
    localStorage.setItem(saveKey, r.save);
    if (r.meta) localStorage.setItem("shhr-meta-v1", r.meta);
    if (r.secret) setCloudCode(r.secret);
    toast(T("正在载入账号存档…", "Loading your account's save…"));
    window.setTimeout(() => window.location.reload(), 600);
  };
  const exportData = async () => {
    const r = await api.exportAccountData({ token: accountToken() });
    if (!r.ok || !r.json) { toast(T("导出失败", "Export failed")); return; }
    const url = URL.createObjectURL(new Blob([r.json], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "shenhui-account-data.json"; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const logout = async (everywhere: boolean) => {
    try { await api.logout({ token: accountToken(), everywhere }); } catch { /* still log out locally */ }
    setToken(""); setMe(null); setOther(null); onChange(false);
    toast(everywhere ? T("所有设备都已退出。", "Logged out on every device.") : T("已退出。本机进度还在。", "Logged out. Progress on this device stays."));
  };
  const del = async () => {
    const r = await api.deleteAccount({ token: accountToken(), confirm: "注销" });
    if (!r.ok) { toast(T("注销失败", "Couldn't delete the account")); return; }
    setToken(""); setMe(null); onChange(false);
    toast(T("账号已注销，服务器上的数据已删除。", "Account deleted; its data was removed from the server."));
  };

  const btn = "rounded-full px-4 py-2 text-xs font-black";
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={T("账号", "Account")} onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-5 text-[var(--text)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black">👤 {T("账号", "Account")}</h2><button type="button" onClick={onClose} aria-label={T("关闭", "Close")} className="text-xl">✕</button></div>
        {loading ? <p className="text-sm text-[var(--dim)]">{T("加载中…", "Loading…")}</p> : me ? (
          <div className="grid gap-3 text-sm">
            <div className="rounded-[12px] bg-[var(--surface2)] p-3">
              {me.identities.map((i) => <p key={i.provider + i.masked} className="font-bold">{i.provider === "email" ? "📧" : "📱"} {i.masked}</p>)}
              <p className="mt-1 text-xs text-[var(--dim)]">{T("角色", "Character")}：{me.playerName ?? T("未绑定", "none linked")} · {T("注册于", "since")} {me.createdAt.slice(0, 10)}</p>
            </div>
            {me.playerId && me.playerId !== playerId && (
              <div className="rounded-[12px] border border-[var(--accent)] p-3">
                <p className="text-xs font-bold">{T("这台设备上的进度不是账号里的角色。", "The progress on this device isn't your account's character.")}</p>
                <button type="button" onClick={() => void loadAccountSave()} className={`${btn} mt-2 w-full bg-[var(--accent)] text-white`}>{T("载入账号存档（替换本机进度）", "Load account save (replaces this device)")}</button>
              </div>
            )}
            {other && !other.hasSave && <p className="text-xs text-[var(--dim)]">{T("账号里的角色还没有云存档。", "Your account's character has no cloud save yet.")}</p>}
            <p className="text-xs text-[var(--dim)]">{T("登录后私聊、组局、邀请奖励才会开放；进度自动云同步，换手机登录同一个账号就能接着玩。", "With an account you can DM, host parties and earn invite rewards; progress syncs, so log in on another phone to continue.")}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void exportData()} className={`${btn} border border-[var(--line)]`}>{T("导出我的数据", "Export my data")}</button>
              <button type="button" onClick={() => void logout(false)} className={`${btn} border border-[var(--line)]`}>{T("退出登录", "Log out")}</button>
              <button type="button" onClick={() => void logout(true)} className={`${btn} border border-[var(--line)]`}>{T("所有设备退出", "Log out everywhere")}</button>
            </div>
            <details className="rounded-[12px] border border-[var(--line)] p-3 text-xs">
              <summary className="cursor-pointer font-black text-red-500">{T("注销账号", "Delete account")}</summary>
              <p className="mt-2 text-[var(--dim)]">{T("会永久删除登录方式、云存档、聊天和私信，角色从所有榜单消失，不能恢复。输入「注销」确认。", "Permanently deletes your login, cloud save, chats and messages; your character leaves every leaderboard. This can't be undone. Type 注销 to confirm.")}</p>
              <input value={delText} onChange={(e) => setDelText(e.target.value)} placeholder="注销" className="mt-2 w-full rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2" />
              <button type="button" disabled={delText !== "注销"} onClick={() => void del()} className={`${btn} mt-2 w-full bg-red-600 text-white disabled:opacity-40`}>{T("永久注销", "Delete permanently")}</button>
            </details>
          </div>
        ) : (
          <div className="grid gap-3 text-sm">
            <p className="text-xs text-[var(--dim)]">{T("绑定后进度不会因为清缓存、换手机丢失；私聊和组局需要账号（防骚扰、防小号）。现在的游客进度会自动并入账号。", "Link an account so progress survives cleared caches and new phones. DMs and parties need an account (stops harassment and throwaway accounts). Your guest progress moves into it.")}</p>
            <div className="flex gap-2">
              {(["email", "phone"] as const).map((p) => <button key={p} type="button" aria-pressed={provider === p} onClick={() => { setProvider(p); setSent(false); setCode(""); }} className={`${btn} ${provider === p ? "bg-[var(--text)] text-[var(--bg)]" : "border border-[var(--line)]"}`}>{p === "email" ? T("📧 邮箱", "📧 Email") : T("📱 手机号", "📱 Phone")}</button>)}
            </div>
            <input value={to} onChange={(e) => setTo(e.target.value)} inputMode={provider === "email" ? "email" : "tel"} autoComplete={provider === "email" ? "email" : "tel"} placeholder={provider === "email" ? "you@example.com" : T("手机号（海外带 +国家码）", "Phone with +country code")} className="rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2" />
            <button type="button" disabled={busy || to.trim().length < 3} onClick={() => void request()} className={`${btn} border border-[var(--line)] disabled:opacity-40`}>{sent ? T("重新发送验证码", "Resend code") : T("获取验证码", "Send code")}</button>
            {sent && <>
              {devCode && <p className="rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-xs">{T("开发模式验证码", "Dev-mode code")}：<span className="font-mono font-black tracking-widest">{devCode}</span></p>}
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder={T("6 位验证码", "6-digit code")} className="rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono tracking-widest" />
              <button type="button" disabled={busy || code.length !== 6} onClick={() => void verify()} className={`${btn} bg-[var(--accent)] text-white disabled:opacity-40`}>{T("登录 / 注册", "Log in / sign up")}</button>
            </>}
            <p className="text-[11px] text-[var(--dim)]">{T("继续即表示同意用户协议和隐私政策。", "By continuing you agree to the Terms and Privacy Policy.")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
