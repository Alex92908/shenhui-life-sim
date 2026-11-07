// 景点分布图 — every real place and game location drawn at its REAL position
// (km from OpenStreetMap, the same frame as the metro fare map), with the
// metro network faint underneath for orientation. Category chips filter what
// is shown (toggle, all, invert); tap a point for its details, then show it
// on the 3D map or go there. Huizhou (no OSM places yet) uses game positions.
import { useMemo, useState } from "react";
import {
  CITIES, PLACE_KINDS, getLocations, metroLinesForCity, placesForCity, realKmOf, resolveLoc,
  type CityKey, type LocType,
} from "./data";
import type { PlaceKind } from "./places-sz";
import { SZ_REAL_KM } from "./metro-sz";

type Group = "sight" | "nature" | "culture" | "shop" | "service" | "game";
const GROUPS: { id: Group; label: string; emoji: string; kinds: PlaceKind[] }[] = [
  { id: "game", label: "游戏地点", emoji: "⭐", kinds: [] },
  { id: "sight", label: "景点古迹", emoji: "📍", kinds: ["attraction", "historic", "themepark"] },
  { id: "nature", label: "公园 · 山海", emoji: "🌳", kinds: ["park", "nature", "peak", "beach"] },
  { id: "culture", label: "文化 · 校园", emoji: "🏛️", kinds: ["museum", "theatre", "library", "university", "stadium"] },
  { id: "shop", label: "商场", emoji: "🛍️", kinds: ["mall"] },
  { id: "service", label: "医院 · 公共服务", emoji: "🏥", kinds: ["hospital", "pharmacy", "police", "info"] },
];
const GAME_TYPE_COLOR: Partial<Record<LocType, string>> = { apec: "#dc2626", scenic: "#16a34a", fun: "#9333ea", mountain: "#4d7c0f", transit: "#2563eb", port: "#0891b2" };

interface Pt { id: string; name: string; en?: string; emoji: string; group: Group; color: string; kx: number; ky: number; mapX: number; mapZ: number; sub: string }

interface Props {
  cityKey: CityKey;
  fromLocId: string;
  onClose: () => void;
  /** Walk / ride to a location id (game location or "pl:…"). */
  onGo: (locId: string) => void;
  /** Close and point the 3D map camera at a spot. */
  onLocate: (x: number, z: number, name: string) => void;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

export function PlacesMapModal({ cityKey, fromLocId, onClose, onGo, onLocate }: Props) {
  const real = cityKey === "sz";
  const points = useMemo<Pt[]>(() => {
    const out: Pt[] = [];
    for (const l of getLocations(cityKey)) {
      if (l.id === "home") continue;
      const k = real ? realKmOf(cityKey, l.id) : [l.x, l.z] as [number, number];
      if (!k) continue;
      out.push({ id: l.id, name: l.name, emoji: l.emoji, group: "game", color: GAME_TYPE_COLOR[l.type] ?? "#e63a1f", kx: k[0], ky: k[1], mapX: l.x, mapZ: l.z, sub: l.short });
    }
    for (const p of placesForCity(cityKey)) {
      const g = GROUPS.find((gr) => gr.kinds.includes(p.kind));
      if (!g) continue;
      const k = PLACE_KINDS[p.kind];
      out.push({ id: `pl:${p.id}`, name: p.name, en: p.en, emoji: k.emoji, group: g.id, color: hex(k.color), kx: p.kx, ky: p.ky, mapX: p.x, mapZ: p.z, sub: `${k.label} · 近「${p.st}」站` });
    }
    return out;
  }, [cityKey, real]);

  // metro lines as faint polylines (real km), for orientation
  const lines = useMemo(() => (real ? metroLinesForCity(cityKey)
    .map((l) => ({ color: l.colorCss, pts: l.stations.map((st) => SZ_REAL_KM[st.name]).filter((p): p is [number, number] => !!p) }))
    .filter((l) => l.pts.length > 1) : []), [cityKey, real]);

  const [shown, setShown] = useState<Set<Group>>(() => new Set<Group>(["game", "sight", "nature", "culture"]));
  const [zoom, setZoom] = useState(1);
  const [pick, setPick] = useState<Pt | null>(null);
  const [q, setQ] = useState("");

  // frame the middle 98% of points so a few far-off islands don't shrink the city
  const bounds = useMemo(() => {
    const q = (arr: number[], f: number) => { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.max(0, Math.round(f * (a.length - 1))))]!; };
    const xs = points.map((p) => p.kx), ys = points.map((p) => p.ky);
    return { x0: q(xs, 0.01) - 1.5, x1: q(xs, 0.99) + 1.5, y0: q(ys, 0.01) - 1.5, y1: q(ys, 0.99) + 1.5 };
  }, [points]);
  const W = 1000;
  const H = Math.round((W * (bounds.y1 - bounds.y0)) / (bounds.x1 - bounds.x0));
  const px = (x: number) => ((x - bounds.x0) / (bounds.x1 - bounds.x0)) * W;
  const py = (y: number) => ((y - bounds.y0) / (bounds.y1 - bounds.y0)) * H;

  const here = useMemo(() => {
    const r = real ? realKmOf(cityKey, fromLocId) : (() => { const l = resolveLoc(cityKey, fromLocId); return l ? [l.x, l.z] as [number, number] : null; })();
    return r;
  }, [cityKey, fromLocId, real]);
  const visible = points.filter((p) => shown.has(p.group) && (!q.trim() || p.name.includes(q.trim()) || (p.en ?? "").toLowerCase().includes(q.trim().toLowerCase())));
  const toggle = (g: Group) => setShown((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; });
  const distKm = (p: Pt) => (here ? Math.hypot(p.kx - here[0], p.ky - here[1]) * (real ? 1 : 1) : null);
  // greedy label placement (game places first, then by group) so names never overlap
  const labelled = useMemo(() => {
    const boxes: [number, number, number, number][] = [];
    const ids = new Set<string>();
    const order = [...visible].sort((a, b) => (a.group === "game" ? 0 : 1) - (b.group === "game" ? 0 : 1));
    for (const p of order) {
      if (pick?.id === p.id) { ids.add(p.id); continue; }
      const fs = (p.group === "game" ? 13 : 11) / zoom;
      const text = p.name.length > 10 ? 11 : p.name.length + 1.5;
      const x = px(p.kx) + 8 / zoom, y = py(p.ky);
      const b: [number, number, number, number] = [x, y - fs, x + text * fs * 1.05, y + fs * 0.35];
      if (boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue;
      boxes.push(b);
      ids.add(p.id);
    }
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, zoom, pick, bounds]);

  return (
    <div className="fixed inset-0 z-[66] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label="景点分布图">
      <div className="rise flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-4 py-3">
          <p className="text-base font-black">🗺️ {CITIES[cityKey].name}景点分布图</p>
          <span className="text-xs text-[var(--dim)]">{visible.length} 个地点 · 按真实位置绘制{real ? "，淡色线是地铁" : ""}</span>
          <button type="button" aria-label="关闭景点分布图" onClick={onClose} className="ml-auto rounded-full border border-[var(--line)] px-3 py-1 text-sm font-black">✕</button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">
          {GROUPS.map((g) => (
            <button key={g.id} type="button" aria-pressed={shown.has(g.id)} onClick={() => toggle(g.id)} className={`rounded-full px-2.5 py-1 text-[11px] font-black ${shown.has(g.id) ? "bg-[var(--text)] text-[var(--bg)]" : "border border-[var(--line)] text-[var(--dim)]"}`}>{g.emoji} {g.label}</button>
          ))}
          <button type="button" onClick={() => setShown(new Set(GROUPS.map((g) => g.id)))} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-black">全选</button>
          <button type="button" onClick={() => setShown((s) => new Set(GROUPS.map((g) => g.id).filter((g) => !s.has(g))))} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-black">反选</button>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜地点名…" aria-label="在景点分布图里搜索" className="ml-auto w-40 rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs" />
          <span className="flex gap-1">{[1, 1.5, 2, 3].map((z) => <button key={z} type="button" onClick={() => setZoom(z)} className={`rounded-full px-2 py-1 text-[11px] font-black ${zoom === z ? "bg-[var(--accent)] text-white" : "border border-[var(--line)]"}`}>{z * 100}%</button>)}</span>
        </div>
        <div className="relative mx-4 mt-2 min-h-0 flex-1 overflow-auto rounded-[14px] border border-[var(--line)] bg-[#eef4f6]">
          <svg viewBox={`0 0 ${W} ${H}`} width={W * zoom} style={{ maxWidth: zoom === 1 ? "100%" : undefined, display: "block" }} role="img" aria-label={`${CITIES[cityKey].name}景点分布示意图`}>
            {lines.map((l, i) => <polyline key={i} points={l.pts.map((p) => `${px(p[0])},${py(p[1])}`).join(" ")} fill="none" stroke={l.color} strokeOpacity={0.28} strokeWidth={3} strokeLinejoin="round" />)}
            {here && <circle cx={px(here[0])} cy={py(here[1])} r={9} fill="none" stroke="#e63a1f" strokeWidth={3} />}
            {visible.map((p) => {
              const big = p.group === "game";
              const isPick = pick?.id === p.id;
              return (
                <g key={p.id} onClick={() => setPick(p)} style={{ cursor: "pointer" }}>
                  <title>{p.name}{p.en ? ` · ${p.en}` : ""}</title>
                  <circle cx={px(p.kx)} cy={py(p.ky)} r={(isPick ? 9 : big ? 6.5 : 4.5) / Math.sqrt(zoom)} fill={p.color} stroke="#fff" strokeWidth={1.5} />
                  {labelled.has(p.id) && <text x={px(p.kx) + 8 / zoom} y={py(p.ky) + 4 / zoom} fontSize={(big ? 13 : 11) / zoom} fontWeight={big ? 800 : 600} fill="#14202b" stroke="#fff" strokeWidth={3 / zoom} paintOrder="stroke">{p.emoji} {p.name.length > 10 ? `${p.name.slice(0, 10)}…` : p.name}</text>}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="min-h-[96px] px-4 py-3">
          {pick ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xl">{pick.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black">{pick.name}</span>
                {pick.en && <span className="block text-[11px] text-[var(--dim)]">{pick.en}</span>}
                <span className="block text-xs text-[var(--dim)]">{pick.sub}{distKm(pick) !== null ? ` · 离你约 ${Math.max(0.1, distKm(pick)!).toFixed(1)} 公里` : ""}</span>
              </span>
              <button type="button" onClick={() => onLocate(pick.mapX, pick.mapZ, pick.name)} className="rounded-full border-2 border-[var(--border)] px-3 py-2 text-xs font-black">📍 在地图上定位</button>
              <button type="button" onClick={() => onGo(pick.id)} className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-black text-white">前往 →</button>
            </div>
          ) : (
            <p className="text-xs text-[var(--dim)]">点一个点看详情；名字放不下时会自动隐藏，放大能看到更多。红圈是你现在的位置。地点数据 © OpenStreetMap contributors。</p>
          )}
        </div>
      </div>
    </div>
  );
}
