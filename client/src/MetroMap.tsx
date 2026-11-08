// The full metro/rail network map: every operating line and station of the
// current city drawn as an SVG schematic from the same station coordinates
// the 3D map uses. Tap a station to set the origin, tap another for the
// destination, and the route (lines, transfers, stops, fare) is planned with
// the game's real router. "出发" hands the destination back to the game's
// normal metro ride flow.
import { useMemo, useState } from "react";
import {
CITIES,
curSym,
findMetroRoute,
getLocations,
metroLinesForCity,
type CityKey,
type MetroLine,
} from "./data";

interface StInfo {
  name: string;
  x: number;
  z: number;
  lines: MetroLine[];
  locId?: string;
}

interface Props {
  cityKey: CityKey;
  fromLocId: string;
  initialDest?: string | null;
  onClose: () => void;
  onRide: (toLocId: string) => void;
}

export function MetroMapModal({ cityKey, fromLocId, initialDest, onClose, onRide }: Props) {
  const locs = useMemo(() => getLocations(cityKey), [cityKey]);
  const lines = useMemo(() => metroLinesForCity(cityKey), [cityKey]);

  const stations = useMemo<StInfo[]>(() => {
    const m = new Map<string, StInfo>();
    for (const line of lines) {
      for (const st of line.stations) {
        const cur = m.get(st.name);
        if (cur) {
          if (!cur.lines.some((l) => l.id === line.id)) cur.lines.push(line);
          if (!cur.locId && st.locId) cur.locId = st.locId;
        } else {
          m.set(st.name, { name: st.name, x: st.x, z: st.z, lines: [line], locId: st.locId });
        }
      }
    }
    return [...m.values()];
  }, [lines]);
  const byName = useMemo(() => new Map(stations.map((s) => [s.name, s])), [stations]);

  // The game router starts and ends at locations that are themselves
  // stations, so a tapped station is anchored to the nearest station-
  // location: its own locId when it has one, otherwise the closest
  // station-with-locId, preferring one on the same line. Directional stubs
  // like 「广州南·新塘方向」 stay visual-only.
  const anchorOf = (st: StInfo | undefined): string | null => {
    if (!st) return null;
    if (st.locId && locs.some((l) => l.id === st.locId)) return st.locId;
    if (st.name.includes("·")) return null;
    let best: string | null = null;
    let bestScore = Infinity;
    for (const other of stations) {
      if (!other.locId || !locs.some((l) => l.id === other.locId)) continue;
      const sameLine = other.lines.some((l) => st.lines.some((sl) => sl.id === l.id)) ? 0 : 100;
      const score = sameLine + Math.hypot(other.x - st.x, other.z - st.z);
      if (score < bestScore) { bestScore = score; best = other.locId; }
    }
    return best;
  };

  const fromLoc = locs.find((l) => l.id === fromLocId) ?? locs[0]!;
  const defaultOrigin = useMemo(() => {
    const direct = stations.find((s) => s.locId === fromLocId);
    if (direct) return direct.name;
    let best: string | null = null;
    let bestD = Infinity;
    for (const s of stations) {
      const d = Math.hypot(s.x - fromLoc.x, s.z - fromLoc.z);
      if (d < bestD) { bestD = d; best = s.name; }
    }
    return best;
  }, [stations, fromLocId, fromLoc]);

  const [originName, setOriginName] = useState<string | null>(defaultOrigin);
  const [destName, setDestName] = useState<string | null>(
    initialDest && byName.has(initialDest) && initialDest !== defaultOrigin ? initialDest : null,
  );

  const origin = originName ? byName.get(originName) : undefined;
  const dest = destName ? byName.get(destName) : undefined;
  const originAnchor = anchorOf(origin);
  const destAnchor = anchorOf(dest);
  const route = originAnchor && destAnchor && originAnchor !== destAnchor
    ? findMetroRoute(cityKey, originAnchor, destAnchor)
    : null;
  const routeStations = new Set(route?.stations.map((s) => s.name) ?? []);
  const routeLineIds = new Set(route?.legs.map((l) => l.line.id) ?? []);
  const directFromHere = destAnchor ? findMetroRoute(cityKey, fromLocId, destAnchor) : null;

  const tap = (name: string) => {
    if (!originName || (originName && destName)) { setOriginName(name); setDestName(null); }
    else if (name !== originName) setDestName(name);
    else setOriginName(null);
  };

  const xs = stations.map((s) => s.x);
  const zs = stations.map((s) => s.z);
  const minX = Math.min(...xs) - 4, maxX = Math.max(...xs) + 6;
  const minZ = Math.min(...zs) - 3.5, maxZ = Math.max(...zs) + 3.5;

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/60 backdrop-blur-[2px] p-3 sm:items-center" role="dialog" aria-label={cityKey === "hz" ? "惠州城际高铁线网图" : cityKey === "hk" ? "香港港铁线网图" : "地铁线网图"}>
      <div className="rise flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-xl">
        <div className="flex items-center gap-2 px-4 pt-3.5">
          <p className="min-w-0 flex-1 text-base font-black">{cityKey === "hz" ? <>🚆 {CITIES[cityKey].name}城际 / 高铁线网图 <span className="text-xs font-bold text-[var(--dim)]">惠州没有地铁 · 莞惠城际 + 赣深/厦深/广汕高铁 · 点站点选起点和终点</span></> : cityKey === "hk" ? <>🚇 {CITIES[cityKey].name}港铁线网图 MTR <span className="text-xs font-bold text-[var(--dim)]">香港只有港铁，没有地铁 · 荃湾线/港岛线/观塘线/将军澳线/东铁线/南港岛线/屯马线/东涌线/机场快线 + 高铁 · 点站点选起点和终点</span></> : <>🚇 {CITIES[cityKey].name}地铁 / 城轨线网图 <span className="text-xs font-bold text-[var(--dim)]">全部运营线路 · 点站点选起点和终点</span></>}</p>
          <button type="button" aria-label="关闭线网图" onClick={onClose} className="shrink-0 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-black">✕ 关闭</button>
        </div>
        <div className="flex flex-wrap gap-1 px-4 pt-2">
          {lines.map((l) => (
            <span key={l.id} className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] font-bold">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: l.colorCss }} />{l.short}
            </span>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2 pt-1">
          <svg viewBox={`${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}`} className="w-full" role="img" aria-label={`${CITIES[cityKey].name}${cityKey === "hz" ? "城际高铁" : cityKey === "hk" ? "港铁" : "地铁"}线网示意图`}>
            {lines.map((line) => (
              <polyline
                key={line.id}
                points={line.stations.map((s) => `${s.x},${s.z}`).join(" ")}
                fill="none"
                stroke={line.colorCss}
                strokeWidth={route && routeLineIds.has(line.id) ? 0.95 : 0.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={route && !routeLineIds.has(line.id) ? 0.18 : 0.75}
              />
            ))}
            {stations.map((st) => {
              const isOrigin = st.name === originName;
              const isDest = st.name === destName;
              const onRoute = routeStations.has(st.name);
              const transfer = st.lines.length > 1;
              const r = isOrigin || isDest ? 1.05 : transfer ? 0.78 : 0.5;
              return (
                <g key={st.name} onClick={() => tap(st.name)} style={{ cursor: "pointer" }}>
                  <circle cx={st.x} cy={st.z} r={r + 0.55} fill="transparent" />
                  <circle
                    cx={st.x} cy={st.z} r={r}
                    fill={isOrigin ? "#16a34a" : isDest ? "#e63a1f" : "var(--surface)"}
                    stroke={isOrigin ? "#16a34a" : isDest ? "#e63a1f" : onRoute ? (st.lines[0]?.colorCss ?? "#888") : "#8a8f98"}
                    strokeWidth={onRoute || isOrigin || isDest ? 0.34 : 0.2}
                  />
                  <text
                    x={st.x + r + 0.45} y={st.z + 0.34}
                    fontSize={transfer || isOrigin || isDest ? 1.08 : 0.92}
                    fontWeight={transfer || isOrigin || isDest ? 800 : 500}
                    style={{ fill: "var(--text)", opacity: route && !onRoute && !isOrigin && !isDest ? 0.35 : 0.92 }}
                  >{st.name}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="border-t border-[var(--line)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
            <span className="rounded-full bg-[#16a34a] px-2.5 py-1 text-white">起点 · {originName ?? "点一个站"}</span>
            <span>→</span>
            <span className="rounded-full bg-[#e63a1f] px-2.5 py-1 text-white">终点 · {destName ?? "再点一个站"}</span>
            {(originName || destName) && (
              <button type="button" aria-label="清除起终点选择" onClick={() => { setOriginName(null); setDestName(null); }} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-black">清除</button>
            )}
            <span className="text-[11px] font-medium text-[var(--dim)]">示意线网图：按真实站点方位绘制，距离经压缩，非等比例测绘。</span>
          </div>
          {originName && destName ? (
            route ? (
              <div className="mt-2">
                <p className="text-sm font-black">{originName} → {destName}：{route.summary}</p>
                <p className="mt-0.5 text-xs text-[var(--dim)]">
                  共 {route.stops} 站 · 票价 {curSym(cityKey)}{route.fare}{route.isTransfer ? ` · 换乘 ${route.transferStations.length} 次（${route.transferStations.join("、")}）` : " · 不用换乘"}
                  {route.shuttleFrom.length > 0 ? ` · 含站外接驳巴士（${route.shuttleFrom.join("、")}）` : ""}
                  {route.legs.map((leg) => ` · ${leg.line.short} 坐 ${leg.stops} 站`).join("")}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button type="button" aria-label={`乘${cityKey === "hz" ? "城际/高铁" : cityKey === "hk" ? "港铁" : "地铁"}出发去${destName}`} onClick={() => destAnchor && onRide(destAnchor)} className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-xs font-black text-white">{cityKey === "hz" ? "🚆" : "🚇"} 从我这出发 → {destAnchor ? (locs.find((l) => l.id === destAnchor)?.name ?? destName) : destName}</button>
                  {!directFromHere ? <span className="text-[11px] text-[var(--dim)]">你现在（{fromLoc.name}）不在车站旁：点出发会先带你去最近的车站，再从那儿上车。</span> : originAnchor !== fromLocId ? <span className="text-[11px] text-[var(--dim)]">出发按你现在的位置（{fromLoc.name}）上车，上面的路线供参考比对。</span> : null}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs font-bold text-[var(--accent)]">{!originAnchor || !destAnchor ? "所选站点里有一个是城外方向站，暂不能作为起终点（可看不可点乘），换个站试试。" : originAnchor === destAnchor ? "这两个站就在同一片区，出站步行或骑行更合适。" : "这两个站之间没有直达或可换乘的轨道路线，换个终点试试。"}</p>
            )
          ) : (
            <p className="mt-2 text-xs text-[var(--dim)]">{originName ? "起点已选好，再点一个终点站就能规划路线。" : `点图上任意站点设为起点。你现在离「${defaultOrigin ?? ""}」站最近。`}</p>
          )}
        </div>
      </div>
    </div>
  );
}
