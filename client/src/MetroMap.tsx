// The full metro/rail network map: every operating line and station of the
// current city drawn as an SVG schematic from the same station coordinates
// the 3D map uses. Tap a station to set the origin, tap another for the
// destination, and the route (lines, transfers, stops, fare) is planned with
// the game's real router — between ANY two stations. The line chips filter
// what is drawn (toggle, select all, invert, or solo one line); a picked
// station can be located on the 3D map; 出发 rides exactly the planned route.
import { useMemo, useState } from "react";
import {
CITIES,
curSym,
findStationRoute,
getLocations,
metroLinesForCity,
resolveLoc,
stationLocId,
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
  /** Ride the planned route from station `fromName` to station `toName`. */
  onRide: (fromName: string, toName: string) => void;
  /** Close the line map and point the 3D map camera at a station. */
  onLocate: (x: number, z: number, name: string) => void;
}

export function MetroMapModal({ cityKey, fromLocId, initialDest, onClose, onRide, onLocate }: Props) {
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

  const fromLoc = resolveLoc(cityKey, fromLocId) ?? locs[0]!;
  const defaultOrigin = useMemo(() => {
    const direct = stations.find((s) => s.locId === fromLocId || stationLocId(s.name) === fromLocId);
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
  // Direction stubs (names ending in 方向, e.g. 「东莞·广州方向」) are drawn but not ridable.
  const isStub = (name: string | null | undefined) => !!name && name.endsWith("方向");
  const route = originName && destName && !isStub(originName) && !isStub(destName)
    ? findStationRoute(cityKey, originName, destName)
    : null;
  const routeStations = new Set(route?.stations.map((s) => s.name) ?? []);
  const routeLineIds = new Set(route?.legs.map((l) => l.line.id) ?? []);
  const atOrigin = !!origin && origin.locId === fromLocId;
  const hereRoute = destName && defaultOrigin && defaultOrigin !== originName && !isStub(destName)
    ? findStationRoute(cityKey, defaultOrigin, destName)
    : null;

  // Line filter: which lines are drawn. Route legs are always drawn.
  const [shown, setShown] = useState<Set<string>>(() => new Set(lines.map((l) => l.id)));
  const [soloMode, setSoloMode] = useState(false);
  const allShown = shown.size === lines.length;
  const clickChip = (id: string) => {
    if (soloMode) { setShown(new Set([id])); return; }
    setShown((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const lineVisible = (id: string) => shown.has(id) || routeLineIds.has(id);
  const stationVisible = (st: StInfo) =>
    st.lines.some((l) => lineVisible(l.id)) || st.name === originName || st.name === destName;
  const pickedSt = dest ?? origin;
  // ~380 stations: full labels only when zoomed in or few lines are shown.
  const [zoom, setZoom] = useState(1);
  const terminals = useMemo(() => new Set(lines.flatMap((l) => [l.stations[0]?.name, l.stations[l.stations.length - 1]?.name].filter((n): n is string => !!n))), [lines]);
  const allLabels = zoom >= 2 || shown.size <= 3;

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
        <div className="flex flex-wrap items-center gap-1 px-4 pt-2">
          <button type="button" aria-label="显示全部线路" onClick={() => setShown(new Set(lines.map((l) => l.id)))} className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black ${allShown ? "border-[var(--border)] bg-[var(--surface2)]" : "border-[var(--line)]"}`}>全选</button>
          <button type="button" aria-label="反选线路" onClick={() => setShown((cur) => new Set(lines.filter((l) => !cur.has(l.id)).map((l) => l.id)))} className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[10px] font-black">反选</button>
          <button type="button" aria-pressed={soloMode} title="单选模式：点一条线就只看这一条" aria-label="单选模式：点一条线只显示这一条" onClick={() => setSoloMode((v) => !v)} className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black ${soloMode ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--line)]"}`}>{soloMode ? "● 单选中" : "○ 单选"}</button>
          <span className="mx-0.5 h-4 w-px bg-[var(--line)]" aria-hidden="true" />
          {lines.map((l) => {
            const on = shown.has(l.id);
            return (
              <button key={l.id} type="button" aria-pressed={on} aria-label={`${soloMode ? "只看" : on ? "隐藏" : "显示"}${l.name}`} title={l.name} onClick={() => clickChip(l.id)} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold transition ${on ? "border-[var(--line)]" : "border-dashed border-[var(--line)] opacity-40"}`}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: l.colorCss }} />{l.short}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1 px-4 pt-1.5 text-[10px] font-bold text-[var(--dim)]">
          <span>缩放</span>
          {[1, 1.5, 2, 3].map((zv) => (
            <button key={zv} type="button" aria-pressed={zoom === zv} aria-label={`线网图缩放到 ${zv * 100}%`} onClick={() => setZoom(zv)} className={`rounded-full border px-2 py-0.5 font-black ${zoom === zv ? "border-[var(--border)] bg-[var(--surface2)] text-[var(--text)]" : "border-[var(--line)]"}`}>{zv * 100}%</button>
          ))}
          <span className="ml-1">{allLabels ? "显示全部站名" : "放大到 200% 或只看 ≤3 条线时显示全部站名，鼠标停在站点上也能看站名"}</span>
          <span className="ml-auto">线路数据 © OpenStreetMap contributors</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2 pt-1">
          <svg viewBox={`${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}`} style={{ width: `${zoom * 100}%`, maxWidth: "none" }} role="img" aria-label={`${CITIES[cityKey].name}${cityKey === "hz" ? "城际高铁" : cityKey === "hk" ? "港铁" : "地铁"}线网示意图`}>
            {lines.filter((line) => lineVisible(line.id)).map((line) => (
              <polyline
                key={line.id}
                points={line.stations.map((s) => `${s.x},${s.z}`).join(" ")}
                fill="none"
                stroke={line.colorCss}
                strokeWidth={route && routeLineIds.has(line.id) ? 0.7 : 0.36}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={route && !routeLineIds.has(line.id) ? 0.18 : 0.75}
              />
            ))}
            {stations.filter(stationVisible).map((st) => {
              const isOrigin = st.name === originName;
              const isDest = st.name === destName;
              const onRoute = routeStations.has(st.name);
              const transfer = st.lines.length > 1;
              const r = isOrigin || isDest ? 0.95 : transfer ? 0.5 : 0.3;
              const labelled = allLabels || transfer || isOrigin || isDest || onRoute || terminals.has(st.name) || !!st.locId;
              return (
                <g key={st.name} onClick={() => tap(st.name)} style={{ cursor: "pointer" }}>
                  <title>{`${st.name} · ${st.lines.map((l) => l.short).join(" / ")}`}</title>
                  <circle cx={st.x} cy={st.z} r={r + 0.45} fill="transparent" />
                  <circle
                    cx={st.x} cy={st.z} r={r}
                    fill={isOrigin ? "#16a34a" : isDest ? "#e63a1f" : "var(--surface)"}
                    stroke={isOrigin ? "#16a34a" : isDest ? "#e63a1f" : onRoute ? (st.lines[0]?.colorCss ?? "#888") : "#8a8f98"}
                    strokeWidth={onRoute || isOrigin || isDest ? 0.26 : 0.15}
                  />
                  {labelled && <text
                    x={st.x + r + 0.25} y={st.z + 0.22}
                    fontSize={isOrigin || isDest ? 1.0 : transfer ? 0.72 : 0.6}
                    fontWeight={transfer || isOrigin || isDest ? 800 : 500}
                    style={{ fill: "var(--text)", opacity: route && !onRoute && !isOrigin && !isDest ? 0.35 : 0.92 }}
                  >{st.name}</text>}
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
            {pickedSt && (
              <button type="button" aria-label={`在大地图上定位${pickedSt.name}站`} onClick={() => onLocate(pickedSt.x, pickedSt.z, pickedSt.name)} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-black">📍 在地图上定位「{pickedSt.name}」</button>
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
                  <button type="button" aria-label={`从${originName}站坐到${destName}站`} onClick={() => onRide(originName, destName)} className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-xs font-black text-white">{cityKey === "hz" ? "🚆" : "🚇"} 从「{originName}」坐到「{destName}」</button>
                  {hereRoute && (
                    <button type="button" aria-label={`从离我最近的${defaultOrigin}站出发去${destName}站`} onClick={() => onRide(defaultOrigin!, destName)} className="rounded-full border-2 border-[var(--accent)] px-3.5 py-2 text-xs font-black text-[var(--accent)]">从我这出发（最近站 {defaultOrigin}）→ {destName} · {hereRoute.summary} · ¥{hereRoute.fare}</button>
                  )}
                  <span className="text-[11px] text-[var(--dim)]">{atOrigin ? "你就在起点站，点出发直接进站上车。" : `你现在在${fromLoc.name}：点出发会先走到「${originName}」站再上车。`}</span>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs font-bold text-[var(--accent)]">{isStub(originName) || isStub(destName) ? "所选站点里有一个是城外方向站，暂不能作为起终点（可看不可点乘），换个站试试。" : "这两个站之间没有直达或可换乘的轨道路线，换个终点试试。"}</p>
            )
          ) : (
            <p className="mt-2 text-xs text-[var(--dim)]">{originName ? "起点已选好，再点一个终点站就能规划路线。" : `点图上任意站点设为起点。你现在离「${defaultOrigin ?? ""}」站最近。`}</p>
          )}
        </div>
      </div>
    </div>
  );
}
