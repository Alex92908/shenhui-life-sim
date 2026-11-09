/* 分享 / 邀请 / 云存档码 / 画质 — the pieces that get the game passed around
   and keep a player's progress safe across devices.

   · 战绩卡: a 1080×1350 PNG drawn on a canvas (no external images, so it
     works offline and never taints the canvas), shared through the system
     share sheet when the browser supports files, otherwise downloaded.
   · 邀请链接: ?invite=<playerId>&from=<name>&co=<company>. A friend who opens
     it starts with an intro (内推) to the inviter's company and a welcome
     bonus; the inviter gets a thank-you reward when they arrive.
   · 云存档码: a random 10-character code (no 0/O/1/I) kept in this browser;
     entering it on another device pulls the cloud save down.
   · 画质: phones and low-memory devices default to 省电. */

const CODE_KEY = "shhr-cloud-code";
const QUALITY_KEY = "shhr-quality";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function cloudCode(): string {
  try {
    const have = localStorage.getItem(CODE_KEY);
    if (have && /^[A-Z2-9]{10}$/.test(have)) return have;
    const code = newCloudCode();
    localStorage.setItem(CODE_KEY, code);
    return code;
  } catch {
    return newCloudCode();
  }
}
export function newCloudCode(): string {
  const buf = new Uint32Array(10);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => ALPHABET[n % ALPHABET.length]).join("");
}
export function setCloudCode(code: string): void {
  try { localStorage.setItem(CODE_KEY, code); } catch { /* storage unavailable */ }
}
export const prettyCode = (c: string) => `${c.slice(0, 5)}-${c.slice(5)}`;

export function liteDefault(): boolean {
  try {
    const q = localStorage.getItem(QUALITY_KEY);
    if (q === "low") return true;
    if (q === "high") return false;
  } catch { /* fall through to detection */ }
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return coarse || window.innerWidth < 768 || (mem !== undefined && mem <= 4);
}
export function setQuality(lite: boolean): void {
  try { localStorage.setItem(QUALITY_KEY, lite ? "low" : "high"); } catch { /* storage unavailable */ }
}

export interface InviteInfo { from: string; fromId: string; co: string | null }
export function readInvite(): InviteInfo | null {
  try {
    const q = new URLSearchParams(window.location.search);
    const id = q.get("invite");
    if (!id || id.length < 4 || id.length > 64) return null;
    return { fromId: id, from: (q.get("from") ?? "朋友").slice(0, 12), co: q.get("co") };
  } catch {
    return null;
  }
}
export function inviteLink(playerId: string, name: string, employer: string | undefined): string {
  const u = new URL(window.location.href);
  u.search = "";
  u.hash = "";
  u.searchParams.set("invite", playerId);
  u.searchParams.set("from", name);
  if (employer && employer !== "startup") u.searchParams.set("co", employer);
  return u.toString();
}
export function clearInviteParams(): void {
  try {
    const u = new URL(window.location.href);
    for (const k of ["invite", "from", "co"]) u.searchParams.delete(k);
    window.history.replaceState(null, "", u.toString());
  } catch { /* history unavailable */ }
}

export interface CardData {
  name: string; cityName: string; day: number; money: number; goal: number;
  career: string; company: string; companyEmoji: string; title: string | null;
  stamps: number; stampTotal: number; places: number; lines: number;
  achievements: number; streak: number; event: string; link: string;
  /** 抽签投胎: where you started on the housing ladder → where you are now */
  climb?: { from: string; to: string; verdict: string; origin?: string };
}

/** Draw the share card; returns a PNG blob. */
export async function drawShareCard(d: CardData): Promise<Blob | null> {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  if (!g) return null;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0b1622"); grad.addColorStop(0.55, "#16324f"); grad.addColorStop(1, "#e63a1f");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // skyline silhouette
  g.fillStyle = "rgba(255,255,255,0.08)";
  const towers = [[80, 380], [170, 520], [250, 300], [330, 640], [420, 450], [500, 760], [590, 420], [660, 560], [760, 340], [850, 600], [940, 380]];
  for (const [x, h] of towers) g.fillRect(x!, 980 - h!, 70, h!);
  const font = (w: number, size: number) => `${w} ${size}px "PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif`;
  g.fillStyle = "#ffd34d"; g.font = font(900, 40); g.fillText("深惠人生模拟", 72, 110);
  g.fillStyle = "#fff"; g.font = font(900, 84); g.fillText(`${d.name}的${d.cityName}第 ${d.day} 天`, 72, 220);
  if (d.climb) {
    g.fillStyle = "#ffd34d"; g.font = font(800, 40); g.fillText(fit(g, `${d.climb.from} → ${d.climb.to} · ${d.climb.verdict}`, W - 144), 72, 290);
  } else if (d.title) { g.fillStyle = "#ffd34d"; g.font = font(800, 44); g.fillText(`🏅 ${d.title}`, 72, 290); }
  // big money
  g.fillStyle = "rgba(255,255,255,0.12)"; roundRect(g, 60, 330, W - 120, 250, 36); g.fill();
  g.fillStyle = "rgba(255,255,255,0.75)"; g.font = font(700, 40); g.fillText("存款", 110, 400);
  g.fillStyle = "#fff"; g.font = font(900, 120); g.fillText(`¥${Math.round(d.money).toLocaleString()}`, 110, 530);
  g.fillStyle = "rgba(255,255,255,0.75)"; g.font = font(700, 36); g.fillText(`目标 ¥${d.goal.toLocaleString()}`, W - 420, 400);
  // stats grid
  const stats: [string, string][] = [
    [`${d.companyEmoji} ${d.company}`, d.career],
    [`🎫 ${d.stamps}/${d.stampTotal}`, `地铁站章 · 集齐 ${d.lines} 条线`],
    [`📖 ${d.places}`, "去过的真实地点"],
    [`🏅 ${d.achievements}`, `成就 · 连续上线 ${d.streak} 天`],
  ];
  stats.forEach(([big, small], i) => {
    const x = 60 + (i % 2) * 490, y = 620 + Math.floor(i / 2) * 210;
    g.fillStyle = "rgba(255,255,255,0.12)"; roundRect(g, x, y, 470, 185, 30); g.fill();
    g.fillStyle = "#fff"; g.font = font(900, 54); g.fillText(fit(g, big, 420), x + 36, y + 90);
    g.fillStyle = "rgba(255,255,255,0.75)"; g.font = font(700, 32); g.fillText(fit(g, small, 420), x + 36, y + 145);
  });
  g.fillStyle = "#fff"; g.font = font(800, 38); g.fillText(fit(g, `今日城市事件：${d.event}`, W - 140), 72, 1090);
  g.fillStyle = "#fff"; roundRect(g, 60, 1140, W - 120, 150, 36); g.fill();
  g.fillStyle = "#e63a1f"; g.font = font(900, 46); g.fillText(d.climb ? "你会抽到什么出身？来抽一签 →" : "一起来深圳过日子 →", 100, 1205);
  g.fillStyle = "#14202b"; g.font = font(600, 28); g.fillText(fit(g, d.link, W - 200), 100, 1258);
  return new Promise((ok) => c.toBlob((b) => ok(b), "image/png"));
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function fit(g: CanvasRenderingContext2D, text: string, max: number): string {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && g.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}
