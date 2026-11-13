/* ---- 小游戏引擎 ----
   Every activity (fishing, KTV, a date, a fight…) plays one of six short
   skill games and gets back a score 0..1 (plus "bust" for push-your-luck).
   The activity table turns that score into money / mood / drops / risk.
   Keyboard: Space for timing / reel / mash, D F J K for rhythm. */
import { useEffect, useRef, useState } from "react";

export type GameSpec =
  | { type: "timing"; rounds: number; width: number; speed: number; prompt: [string, string] }
  | { type: "reel"; seconds: number; pull: number; prompt: [string, string] }
  | { type: "rhythm"; notes: number; speed: number; prompt: [string, string] }
  | { type: "meter"; gains: number[]; risk: number; riskStep: number; push: [string, string]; stop: [string, string]; unit: [string, string]; prompt: [string, string] }
  | { type: "quiz"; questions: { q: [string, string]; opts: { t: [string, string]; pts: number; say?: [string, string] }[] }[]; prompt: [string, string] }
  | { type: "mash"; seconds: number; target: number; prompt: [string, string] };

export interface GameResult { score: number; bust?: boolean }

const T = (en: boolean, s: [string, string]) => (en ? s[1] : s[0]);
const shuffle = <X,>(a: X[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

export function MiniGame({ spec, title, en, onDone, onQuit, onPush }: { spec: GameSpec; title: string; en: boolean; onDone: (r: GameResult) => void; onQuit: () => void; onPush?: () => void }) {
  const [res, setRes] = useState<GameResult | null>(null);
  /* real-time games wait for the player to press Start */
  const [ready, setReady] = useState(spec.type === "quiz" || spec.type === "meter" || spec.type === "mash");
  const finish = (r: GameResult) => setRes((cur) => cur ?? { score: Math.max(0, Math.min(1, r.score)), bust: r.bust });
  const grade = !res ? "" : res.bust ? (en ? "💥 Bust!" : "💥 翻车了！") : res.score >= 0.85 ? (en ? "🌟 Perfect!" : "🌟 完美！") : res.score >= 0.55 ? (en ? "👍 Nice" : "👍 不错") : res.score >= 0.25 ? (en ? "😅 So-so" : "😅 一般般") : (en ? "😵 Flop" : "😵 搞砸了");
  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/65 p-3 sm:items-center" role="dialog" aria-label={title}>
      <div className="rise w-full max-w-md overflow-hidden rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-xl">
        <div className="flex items-center justify-between gap-2 bg-[var(--text)] px-4 py-3 text-[var(--bg)]">
          <p className="font-display text-lg font-black">{title}</p>
          {!res && <button type="button" onClick={onQuit} className="rounded-full bg-white/20 px-3 py-1 text-xs font-black">{en ? "Quit" : "不玩了"}</button>}
        </div>
        <div className="p-4">
          <p className="text-xs leading-relaxed text-[var(--dim)]">{T(en, spec.prompt)}</p>
          {!ready && <button type="button" autoFocus onClick={() => setReady(true)} className="mt-3 w-full rounded-full bg-[var(--accent)] py-4 text-base font-black text-white">{en ? "Ready — start!" : "准备好了，开始！"}</button>}
          {ready && <div className="mt-3">
            {spec.type === "timing" && <Timing spec={spec} en={en} done={!!res} onEnd={finish} />}
            {spec.type === "reel" && <Reel spec={spec} en={en} done={!!res} onEnd={finish} />}
            {spec.type === "rhythm" && <Rhythm spec={spec} en={en} done={!!res} onEnd={finish} />}
            {spec.type === "meter" && <Meter spec={spec} en={en} done={!!res} onEnd={finish} onPush={onPush} />}
            {spec.type === "quiz" && <Quiz spec={spec} en={en} done={!!res} onEnd={finish} />}
            {spec.type === "mash" && <Mash spec={spec} en={en} done={!!res} onEnd={finish} />}
          </div>}
          {res && (
            <div className="mt-4 text-center">
              <p className="font-display text-2xl font-black">{grade}</p>
              {!res.bust && <p className="text-xs font-bold text-[var(--dim)]">{en ? "Score" : "得分"} {Math.round(res.score * 100)}</p>}
              <button type="button" autoFocus onClick={() => onDone(res)} className="mt-3 w-full rounded-full bg-[var(--accent)] py-3 text-sm font-black text-white">{en ? "See how it went →" : "看看结果 →"}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Animation-frame loop that stops when `on` is false. */
function useLoop(on: boolean, fn: (dt: number) => void) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => {
    if (!on) return;
    let raf = 0; let last = performance.now();
    const tick = (t: number) => { const dt = Math.min(0.05, (t - last) / 1000); last = t; ref.current(dt); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);
}
function useKey(keys: string[], fn: (k: string, down: boolean) => void, on: boolean) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => {
    if (!on) return;
    const d = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (keys.includes(k) || (keys.includes("space") && e.code === "Space")) { e.preventDefault(); if (!e.repeat) ref.current(e.code === "Space" ? "space" : k, true); } };
    const u = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (keys.includes(k) || (keys.includes("space") && e.code === "Space")) ref.current(e.code === "Space" ? "space" : k, false); };
    window.addEventListener("keydown", d); window.addEventListener("keyup", u);
    return () => { window.removeEventListener("keydown", d); window.removeEventListener("keyup", u); };
  }, [on, keys.join()]);
}

/* 1. 时机条：指针来回摆，落在绿区里按下 */
function Timing({ spec, en, done, onEnd }: { spec: Extract<GameSpec, { type: "timing" }>; en: boolean; done: boolean; onEnd: (r: GameResult) => void }) {
  const [pos, setPos] = useState(0);
  const dir = useRef(1);
  const [round, setRound] = useState(0);
  const [zone, setZone] = useState(() => 20 + Math.random() * 60);
  const [hits, setHits] = useState<number[]>([]);
  const [flash, setFlash] = useState("");
  const speed = spec.speed * (1 + round * 0.15);
  useLoop(!done, (dt) => setPos((p) => { let n = p + dir.current * speed * dt; if (n > 100) { n = 200 - n; dir.current = -1; } if (n < 0) { n = -n; dir.current = 1; } return n; }));
  const press = () => {
    if (done) return;
    const off = Math.abs(pos - zone);
    const q = off <= spec.width / 2 ? 1 - (off / (spec.width / 2)) * 0.6 : 0;
    const next = [...hits, q];
    setHits(next);
    setFlash(q >= 0.85 ? (en ? "Perfect!" : "完美！") : q > 0 ? (en ? "Good" : "不错") : (en ? "Miss" : "失手"));
    if (next.length >= spec.rounds) onEnd({ score: next.reduce((a, b) => a + b, 0) / spec.rounds });
    else { setRound(next.length); setZone(15 + Math.random() * 70); }
  };
  useKey(["space"], (_k, down) => { if (down) press(); }, !done);
  return (
    <div>
      <div className="relative h-10 overflow-hidden rounded-full border-2 border-[var(--border)] bg-[var(--surface2)]">
        <div className="absolute inset-y-0 bg-emerald-400/70" style={{ left: `${zone - spec.width / 2}%`, width: `${spec.width}%` }} />
        <div className="absolute inset-y-0 bg-emerald-600" style={{ left: `${zone - 1}%`, width: "2%" }} />
        <div className="absolute inset-y-[-2px] w-1.5 rounded bg-[var(--accent)]" style={{ left: `calc(${pos}% - 3px)` }} />
      </div>
      <p className="mt-2 flex justify-between text-xs font-black"><span>{en ? "Round" : "第"} {Math.min(hits.length + 1, spec.rounds)}/{spec.rounds}{en ? "" : " 次"}</span><span>{flash}</span></p>
      <button type="button" disabled={done} onClick={press} className="mt-2 w-full rounded-full bg-[var(--text)] py-4 text-base font-black text-[var(--bg)]">{en ? "NOW! (Space)" : "就是现在！（空格）"}</button>
    </div>
  );
}

/* 2. 拉力条：按住加力、松开放线，张力留在区间里进度才涨（钓鱼、拔河、推车） */
function Reel({ spec, en, done, onEnd }: { spec: Extract<GameSpec, { type: "reel" }>; en: boolean; done: boolean; onEnd: (r: GameResult) => void }) {
  const S = useRef({ t: 40, p: 0, time: 0, lo: 35, hi: 70, slack: 0 });
  const [, force] = useState(0);
  const hold = useRef(false);
  const ended = useRef(false);
  useLoop(!done, (dt) => {
    if (ended.current) return;
    const s = S.current;
    const jitter = (Math.random() - 0.5) * spec.pull * 120 * dt + Math.sin(s.time * 2.3) * spec.pull * 30 * dt;
    s.t = Math.max(0, Math.min(100, s.t + (hold.current ? 55 : -38) * dt + jitter));
    s.p = Math.max(0, Math.min(100, s.p + (s.t >= s.lo && s.t <= s.hi ? 16 : -5) * dt));
    s.lo = Math.max(10, Math.min(60, s.lo + Math.sin(s.time * 0.9) * 8 * dt)); s.hi = s.lo + 32;
    s.time += dt;
    s.slack = s.t <= 2 ? s.slack + dt : 0;
    let r: GameResult | null = null;
    if (s.t >= 100 || s.slack > 2.5) r = { score: (s.p / 100) * 0.3 };
    else if (s.p >= 100) r = { score: 1 - Math.min(0.5, (s.time / spec.seconds) * 0.5) };
    else if (s.time >= spec.seconds) r = { score: (s.p / 100) * 0.5 };
    if (r) { ended.current = true; onEnd(r); }
    force((x) => x + 1);
  });
  const st = S.current;
  useKey(["space"], (_k, down) => { hold.current = down; }, !done);
  return (
    <div>
      <div className="relative h-8 overflow-hidden rounded-full border-2 border-[var(--border)] bg-[var(--surface2)]">
        <div className="absolute inset-y-0 bg-emerald-400/60" style={{ left: `${st.lo}%`, width: `${st.hi - st.lo}%` }} />
        <div className="absolute inset-y-0 right-0 w-[6%] bg-red-500/50" />
        <div className="absolute inset-y-[-2px] w-1.5 rounded bg-[var(--accent)]" style={{ left: `calc(${st.t}% - 3px)` }} />
      </div>
      <p className="mt-1 text-[11px] font-bold text-[var(--dim)]">{en ? "Tension — keep it in the green; red snaps the line, zero lets it go" : "张力：留在绿区；顶到红区会断线，松到底会跑掉"}</p>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-[var(--surface2)]"><div className="h-full bg-sky-500" style={{ width: `${st.p}%` }} /></div>
      <p className="mt-1 flex justify-between text-[11px] font-black"><span>{en ? "Progress" : "进度"} {Math.round(st.p)}%</span><span>⏱ {Math.max(0, Math.ceil(spec.seconds - st.time))}s</span></p>
      <button type="button" disabled={done} onPointerDown={() => { hold.current = true; }} onPointerUp={() => { hold.current = false; }} onPointerLeave={() => { hold.current = false; }} className="mt-2 w-full select-none rounded-full bg-[var(--text)] py-4 text-base font-black text-[var(--bg)]">{en ? "HOLD to pull (Space)" : "按住收线（空格）"}</button>
    </div>
  );
}

/* 3. 节奏：四条轨道往下掉音符，到线时按 D F J K（或点轨道） */
function Rhythm({ spec, en, done, onEnd }: { spec: Extract<GameSpec, { type: "rhythm" }>; en: boolean; done: boolean; onEnd: (r: GameResult) => void }) {
  const notes = useRef(Array.from({ length: spec.notes }, (_, i) => ({ lane: Math.floor(Math.random() * 4), at: 1.2 + i * (0.55 + Math.random() * 0.35), hit: 0 as 0 | 1 | 2 | -1 })));
  const [time, setTime] = useState(0);
  const [stats, setStats] = useState({ perfect: 0, good: 0, miss: 0, combo: 0 });
  const end = notes.current[notes.current.length - 1]!.at + 1;
  const tRef = useRef(0); const ended = useRef(false);
  useLoop(!done, (dt) => {
    if (ended.current) return;
    const n = tRef.current + dt; tRef.current = n;
    let missed = 0;
    for (const x of notes.current) if (x.hit === 0 && n - x.at > 0.22) { x.hit = -1; missed++; }
    if (missed) setStats((s) => ({ ...s, miss: s.miss + missed, combo: 0 }));
    setTime(n);
    if (n >= end) { ended.current = true; const s = notes.current; onEnd({ score: s.reduce((a, x) => a + (x.hit === 2 ? 1 : x.hit === 1 ? 0.6 : 0), 0) / s.length }); }
  });
  const hit = (lane: number) => {
    if (done) return;
    const cand = notes.current.filter((x) => x.lane === lane && x.hit === 0 && Math.abs(time - x.at) < 0.22).sort((a, b) => Math.abs(time - a.at) - Math.abs(time - b.at))[0];
    if (!cand) return;
    const d = Math.abs(time - cand.at);
    cand.hit = d < 0.09 ? 2 : 1;
    setStats((s) => ({ ...s, perfect: s.perfect + (cand.hit === 2 ? 1 : 0), good: s.good + (cand.hit === 1 ? 1 : 0), combo: s.combo + 1 }));
  };
  useKey(["d", "f", "j", "k"], (k, down) => { if (down) hit(["d", "f", "j", "k"].indexOf(k)); }, !done);
  const H = 220; const speed = spec.speed;
  return (
    <div>
      <div className="relative grid grid-cols-4 gap-1 overflow-hidden rounded-[12px] border-2 border-[var(--border)] bg-[#141018]" style={{ height: H }}>
        {[0, 1, 2, 3].map((l) => (
          <button key={l} type="button" onPointerDown={() => hit(l)} className="relative h-full border-x border-white/10" aria-label={`lane ${l + 1}`}>
            {notes.current.filter((x) => x.lane === l && x.hit === 0 && x.at - time < H / speed && time - x.at < 0.25).map((x, i) => (
              <span key={i} className="absolute left-1 right-1 h-4 rounded-full" style={{ top: H - 34 - (x.at - time) * speed, background: ["#f472b6", "#38bdf8", "#facc15", "#4ade80"][l] }} />
            ))}
            <span className="absolute bottom-1 left-0 right-0 text-center text-[11px] font-black text-white/60">{"DFJK"[l]}</span>
          </button>
        ))}
        <div className="pointer-events-none absolute left-0 right-0 h-1 bg-white/70" style={{ top: H - 28 }} />
      </div>
      <p className="mt-2 flex justify-between text-xs font-black"><span>🎯 {stats.perfect} · 👍 {stats.good} · ❌ {stats.miss}</span><span>{en ? "Combo" : "连击"} {stats.combo}</span></p>
    </div>
  );
}

/* 4. 见好就收：每再来一次收益更高，翻车概率也更高 */
function Meter({ spec, en, done, onEnd, onPush }: { spec: Extract<GameSpec, { type: "meter" }>; en: boolean; done: boolean; onEnd: (r: GameResult) => void; onPush?: () => void }) {
  const [step, setStep] = useState(0);
  const [shake, setShake] = useState(false);
  const total = spec.gains.slice(0, step).reduce((a, b) => a + b, 0);
  const max = spec.gains.reduce((a, b) => a + b, 0);
  const risk = Math.min(0.95, spec.risk + spec.riskStep * step);
  const push = () => {
    if (done || step >= spec.gains.length) return;
    onPush?.();
    if (Math.random() < risk) { setShake(true); onEnd({ score: 0, bust: true }); return; }
    const n = step + 1; setStep(n);
    if (n >= spec.gains.length) onEnd({ score: 1 });
  };
  return (
    <div className={shake ? "animate-pulse" : ""}>
      <div className="flex items-end justify-between">
        <p className="font-display text-4xl font-black">{total}<span className="ml-1 text-sm">{T(en, spec.unit)}</span></p>
        <p className="text-right text-xs font-black">{en ? "Bust risk next" : "下一步翻车概率"}<br /><span className={`text-2xl ${risk > 0.4 ? "text-[var(--accent)]" : ""}`}>{Math.round(risk * 100)}%</span></p>
      </div>
      <div className="mt-2 flex gap-1">{spec.gains.map((_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i < step ? "bg-[var(--accent)]" : "bg-[var(--surface2)]"}`} />)}</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={done} onClick={push} className="rounded-full bg-[var(--accent)] py-3 text-sm font-black text-white">{T(en, spec.push)}{step < spec.gains.length ? ` (+${spec.gains[step]})` : ""}</button>
        <button type="button" disabled={done || step === 0} onClick={() => onEnd({ score: total / max })} className="rounded-full bg-[var(--text)] py-3 text-sm font-black text-[var(--bg)] disabled:opacity-40">{T(en, spec.stop)}</button>
      </div>
    </div>
  );
}

/* 5. 对话选择：每个选项有分，选完对方有反应 */
function Quiz({ spec, en, done, onEnd }: { spec: Extract<GameSpec, { type: "quiz" }>; en: boolean; done: boolean; onEnd: (r: GameResult) => void }) {
  const qs = useRef(spec.questions.map((q) => ({ ...q, opts: shuffle(q.opts) })));
  const [i, setI] = useState(0);
  const [pts, setPts] = useState(0);
  const [say, setSay] = useState<string | null>(null);
  const q = qs.current[i];
  const max = qs.current.reduce((a, x) => a + Math.max(...x.opts.map((o) => o.pts)), 0);
  const pick = (o: (typeof qs.current)[number]["opts"][number]) => {
    if (done || say !== null) return;
    const np = pts + o.pts; setPts(np);
    setSay(o.say ? T(en, o.say) : o.pts >= 2 ? (en ? "😊 That landed well." : "😊 这句说到点子上了。") : o.pts === 1 ? (en ? "🙂 Fair enough." : "🙂 还行。") : (en ? "😬 Awkward…" : "😬 气氛有点尴尬……"));
    window.setTimeout(() => { setSay(null); if (i + 1 >= qs.current.length) onEnd({ score: max ? np / max : 1 }); else setI(i + 1); }, 1100);
  };
  if (!q) return null;
  return (
    <div>
      <p className="text-[11px] font-black text-[var(--dim)]">{i + 1}/{qs.current.length}</p>
      <p className="mt-1 rounded-[12px] bg-[var(--surface2)] px-3 py-2 text-sm font-bold">{T(en, q.q)}</p>
      {say ? <p className="mt-3 text-center text-sm font-black">{say}</p> : (
        <div className="mt-2 grid gap-1.5">{q.opts.map((o, k) => <button key={k} type="button" disabled={done} onClick={() => pick(o)} className="act-btn text-left text-[13px] font-bold">{T(en, o.t)}</button>)}</div>
      )}
    </div>
  );
}

/* 6. 连点：限时狂按 */
function Mash({ spec, en, done, onEnd }: { spec: Extract<GameSpec, { type: "mash" }>; en: boolean; done: boolean; onEnd: (r: GameResult) => void }) {
  const [n, setN] = useState(0);
  const [t, setT] = useState(0);
  const [go, setGo] = useState(false);
  const nRef = useRef(0);
  const tR = useRef(0); const ended = useRef(false);
  useLoop(go && !done, (dt) => { if (ended.current) return; tR.current += dt; setT(tR.current); if (tR.current >= spec.seconds) { ended.current = true; onEnd({ score: nRef.current / spec.target }); } });
  const tap = () => { if (done) return; if (!go) setGo(true); nRef.current += 1; setN(nRef.current); };
  useKey(["space"], (_k, down) => { if (down) tap(); }, !done);
  return (
    <div>
      <div className="h-4 overflow-hidden rounded-full bg-[var(--surface2)]"><div className="h-full bg-[var(--accent)]" style={{ width: `${Math.min(100, (n / spec.target) * 100)}%` }} /></div>
      <p className="mt-1 flex justify-between text-xs font-black"><span>{n}/{spec.target}</span><span>⏱ {go ? Math.max(0, spec.seconds - t).toFixed(1) : spec.seconds}s</span></p>
      <button type="button" disabled={done} onClick={tap} className="mt-2 w-full select-none rounded-full bg-[var(--text)] py-6 text-lg font-black text-[var(--bg)] active:scale-95">{go ? (en ? "TAP TAP TAP!" : "狂按！") : (en ? "Tap to start (Space)" : "点一下开始（空格）")}</button>
    </div>
  );
}
