// 🎶 Livehouse：全城同步轮播音乐人投稿的原创歌曲；音乐人可以投稿、花 ✨ 设为本周主打。
import { useEffect, useRef, useState } from "react";
import { api, type ApiResponse } from "./api";
import { playTrack, stopTrack } from "./sound";

type State = ApiResponse<typeof api, "livehouseState">;
type Track = State["rotation"][number];
const CHUNK_RAW = 149_000; // raw bytes per chunk → ≤ 200 KB of base64

const urlCache = new Map<number, string>();
async function trackUrl(t: Track, token?: string): Promise<string | null> {
  const hit = urlCache.get(t.id); if (hit) return hit;
  const parts: Uint8Array[] = []; let mime = "audio/mpeg";
  for (let i = 0; i < t.chunks; i++) {
    const r = await api.trackChunk({ trackId: t.id, idx: i, token });
    if (!r.ok || !r.data) return null;
    mime = r.mime ?? mime;
    const bin = atob(r.data); const u = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
    parts.push(u);
  }
  const url = URL.createObjectURL(new Blob(parts as BlobPart[], { type: mime }));
  urlCache.set(t.id, url);
  return url;
}
/** where the shared rotation is right now: everyone computes the same track and second from the clock */
function nowPlaying(rot: Track[], nowMs: number): { i: number; offset: number } | null {
  const total = rot.reduce((t, x) => t + x.durationSec, 0);
  if (!total) return null;
  let t = Math.floor(nowMs / 1000) % total;
  for (let i = 0; i < rot.length; i++) { if (t < rot[i]!.durationSec) return { i, offset: t }; t -= rot[i]!.durationSec; }
  return { i: 0, offset: 0 };
}

export function LivehouseModal({ en, token, venue, soundIsOn, enableSound, onClose, toast, openAccount, openStore }: { en: boolean; token: string; venue: string; soundIsOn: boolean; enableSound: () => void; onClose: () => void; toast: (m: string) => void; openAccount: () => void; openStore: () => void }) {
  const T = (zh: string, e: string) => (en ? e : zh);
  const [st, setSt] = useState<State | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [listening, setListening] = useState(false);
  const [loadingTrack, setLoadingTrack] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [artist, setArtist] = useState(""); const [title, setTitle] = useState(""); const [rights, setRights] = useState(false);
  const [upload, setUpload] = useState<number | null>(null);
  const offsetRef = useRef(0);
  const load = async () => { try { const r = await api.livehouseState({ token: token || undefined }); offsetRef.current = r.now - Date.now(); setSt(r); } catch { /* offline */ } };
  useEffect(() => { void load(); const a = window.setInterval(() => void load(), 30_000); const b = window.setInterval(() => setClock(Date.now()), 1000); return () => { window.clearInterval(a); window.clearInterval(b); stopTrack(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const rot = st?.rotation ?? [];
  const np = nowPlaying(rot, clock + offsetRef.current);
  const cur = np ? rot[np.i] : undefined;

  const listen = async () => {
    if (!soundIsOn) enableSound();
    const pos = nowPlaying(rot, Date.now() + offsetRef.current); if (!pos) return;
    const t = rot[pos.i]!;
    setLoadingTrack(true);
    const url = await trackUrl(t);
    setLoadingTrack(false);
    if (!url) { toast(T("这首歌没加载出来", "Couldn't load the song")); return; }
    setListening(true);
    playTrack(url, pos.offset); // the next song starts from the effect below when the rotation moves on
  };
  useEffect(() => { if (listening && cur) void listen(); }, [cur?.id, np?.i]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!token) { openAccount(); return; }
    if (!file || !rights) return;
    if (file.size > 6_000_000) { toast(T("文件太大了，6 MB 以内", "Too big — 6 MB max")); return; }
    const durationSec = await new Promise<number>((ok) => { const a = new Audio(URL.createObjectURL(file)); a.addEventListener("loadedmetadata", () => ok(Math.round(a.duration || 0))); a.addEventListener("error", () => ok(0)); });
    if (durationSec < 30 || durationSec > 480) { toast(T("歌曲长度要在 30 秒到 8 分钟之间", "Songs must be 30 s to 8 min long")); return; }
    const buf = new Uint8Array(await file.arrayBuffer());
    const chunks = Math.ceil(buf.length / CHUNK_RAW);
    const mime = (["audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/x-m4a", "audio/wav"] as const).find((m) => m === file.type) ?? "audio/mpeg";
    const s = await api.startTrack({ token, artist: artist.trim() || "音乐人", title: title.trim() || file.name.replace(/\.[^.]+$/, "").slice(0, 30), mime, bytes: buf.length, durationSec, chunks, rights: true });
    if (!s.ok || !s.trackId) { toast(s.error ?? T("投稿失败", "Submission failed")); return; }
    for (let i = 0; i < chunks; i++) {
      setUpload(Math.round((i / chunks) * 100));
      const part = buf.subarray(i * CHUNK_RAW, (i + 1) * CHUNK_RAW);
      let bin = ""; for (let k = 0; k < part.length; k++) bin += String.fromCharCode(part[k]!);
      const r = await api.uploadChunk({ token, trackId: s.trackId, idx: i, data: btoa(bin), last: i === chunks - 1 });
      if (!r.ok) { setUpload(null); toast(r.error ?? T("上传中断了", "Upload interrupted")); return; }
    }
    setUpload(null); setFile(null); setTitle(""); setRights(false);
    toast(T("投稿成功！运营审核通过后，全城的 Livehouse 都会放你的歌。", "Submitted! Once approved, every Livehouse in town will play it."));
    void load();
  };
  const boost = async (id: number) => {
    const r = await api.boostTrack({ token, trackId: id });
    if (r.ok) toast(T("设为本周主打了，这 7 天轮播次数翻倍。", "Featured for 7 days — it plays twice as often.")); else { toast(r.error ?? T("没成功", "Didn't work")); if (r.error?.includes("✨")) openStore(); }
    void load();
  };
  const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const STATUS: Record<string, [string, string]> = { uploading: ["上传中", "Uploading"], pending: ["审核中", "In review"], approved: ["在轮播", "In rotation"], rejected: ["未通过", "Not approved"] };
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-label="Livehouse">
      <div className="rise max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[#d946ef] bg-[#140a1f] p-4 text-white">
        <p className="flex items-center justify-between"><span className="font-display text-xl font-black">🎶 Livehouse · {venue}</span><button type="button" onClick={() => { stopTrack(); onClose(); }} className="rounded-full border border-white/30 px-3 py-1 text-xs font-black">✕</button></p>
        <p className="mt-1 text-xs leading-relaxed text-white/60">{T("全城的 Livehouse 同步放同一首歌——你在这儿听到的，别人也正在听。放的都是独立音乐人的原创投稿。", "Every Livehouse in town plays the same song at the same moment — whoever's here hears it with you. All original songs from independent musicians.")}</p>
        <div className="mt-3 rounded-[16px] bg-gradient-to-br from-[#7c3aed] to-[#db2777] p-4">
          {cur && np ? (<>
            <p className="text-[11px] font-black tracking-[0.2em] text-white/80">{T("正在播放", "NOW PLAYING")}{cur.featured ? " · ⭐ " + T("本周主打", "featured") : ""}</p>
            <p className="font-display mt-1 text-2xl font-black">{cur.title}</p>
            <p className="text-sm font-bold text-white/85">{cur.artist}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/25"><div className="h-full bg-white" style={{ width: `${Math.min(100, (np.offset / cur.durationSec) * 100)}%` }} /></div>
            <p className="mt-1 flex justify-between text-[11px] text-white/75"><span>{fmtT(np.offset)}</span><span>{fmtT(cur.durationSec)}</span></p>
            <button type="button" disabled={loadingTrack} onClick={() => { if (listening) { stopTrack(); setListening(false); } else void listen(); }} className="mt-3 w-full rounded-full bg-white py-2.5 text-sm font-black text-[#7c3aed] disabled:opacity-60">{loadingTrack ? T("加载中…", "Loading…") : listening ? T("⏸ 停止收听", "⏸ Stop") : T("🎧 一起听", "🎧 Listen along")}</button>
          </>) : (
            <p className="text-sm font-bold">{T("还没有音乐人的歌在轮播——现在放的是店里的电子舞曲（打开 🔊 就能听到）。第一个投稿的音乐人，全城都会听到。", "No musicians' songs in rotation yet — the house beat is playing (turn on 🔊). The first musician to submit gets heard by the whole city.")}</p>
          )}
        </div>
        {rot.length > 1 && np && (<>
          <p className="mt-3 text-xs font-black text-white/70">{T("接下来", "Up next")}</p>
          {[1, 2, 3].map((k) => rot[(np.i + k) % rot.length]).filter((t, k, arr) => t && arr.indexOf(t) === k).map((t) => <p key={`n${t!.id}`} className="mt-1 text-sm">{t!.featured ? "⭐ " : "· "}{t!.title} <span className="text-white/60">— {t!.artist}</span></p>)}
        </>)}
        <div className="mt-4 rounded-[14px] border border-white/20 p-3">
          <p className="text-sm font-black">🎤 {T("我是音乐人：投稿我的原创", "I'm a musician: submit my original song")}</p>
          <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label={T("选择歌曲文件", "Choose a song file")} className="mt-2 block w-full text-xs" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input value={artist} onChange={(e) => setArtist(e.target.value.slice(0, 20))} placeholder={T("艺名", "Artist name")} aria-label={T("艺名", "Artist name")} className="rounded-full border border-white/25 bg-black/30 px-3 py-1.5 text-sm" />
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 30))} placeholder={T("歌名", "Song title")} aria-label={T("歌名", "Song title")} className="rounded-full border border-white/25 bg-black/30 px-3 py-1.5 text-sm" />
          </div>
          <label className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed text-white/75"><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5" />{T("我确认这是我自己创作或拥有全部版权的作品，同意它在游戏里免费播放；翻唱、他人作品会被拒绝。", "I confirm I wrote this song or own all its rights, and agree it plays free in the game; covers and others' work are rejected.")}</label>
          <button type="button" disabled={!!token && (!file || !rights || upload !== null)} onClick={() => void submit()} className="mt-2 w-full rounded-full bg-[#d946ef] py-2.5 text-sm font-black text-white disabled:opacity-40">{upload !== null ? T(`上传中 ${upload}%`, `Uploading ${upload}%`) : token ? T("投稿（6 MB 以内，30 秒–8 分钟）", "Submit (≤ 6 MB, 30 s – 8 min)") : T("先登录账号", "Log in first")}</button>
          {(st?.mine ?? []).map((t) => (
            <p key={`m${t.id}`} className="mt-2 flex items-center gap-2 text-xs"><span className="min-w-0 flex-1 truncate">{t.title} · {en ? STATUS[t.status]?.[1] : STATUS[t.status]?.[0]}{t.featured ? " · ⭐" : ""}</span>{t.status === "approved" && <button type="button" onClick={() => void boost(t.id)} className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 font-black">⭐ {T(`主打一周 ${st?.boostStars ?? 300}✨`, `Feature 1 week · ${st?.boostStars ?? 300}✨`)}</button>}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
