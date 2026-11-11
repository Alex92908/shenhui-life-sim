import { COMPANIES, billboardSpots, type CityKey } from "./data";

/** 招聘、招租、销售、三和日结。空着的广告牌挂这四类；写广告时也能照着这些句子改。 */
export type AdKind = "hire" | "rent" | "sale" | "sanhe";

export interface StreetAd {
  slot: number;
  kind: AdKind;
  emoji: string;
  text: string;
  owner: string;
  /** 点广告要去的地方。招聘是公司，招租是家，销售和日结就在这块牌下。 */
  go: string;
}

export interface MapAd {
  slot: number;
  text: string;
  emoji: string;
  owner: string;
  go?: string;
  kind?: AdKind;
}

export function listedRent(city: CityKey): number {
  return city === "hk" ? 900 : city === "hz" ? 180 : 260;
}

export function sanhePay(city: CityKey): number {
  return city === "hk" ? 200 : city === "hz" ? 160 : 220;
}

const clip = (s: string) => s.slice(0, 20);
const pick = (lines: string[], day: number) => lines[Math.abs(day) % lines.length] ?? lines[0] ?? "";

/** 三和大神口头上那套：做一天玩三天，日结，人才市场，网吧泡面。惠州、香港用当地的散工说法。 */
const SANHE_ADS: Record<CityKey, string[]> = {
  sz: ["三和日结 当天给钱", "做一天玩三天", "人才市场 站一天", "网吧过夜 泡面管饱", "有活就上 没活就睡", "日结现金 不拖明天"],
  hz: ["仲恺日结 当天给钱", "做一天玩三天", "厂门口 站一天", "网吧过夜 泡面管饱", "有活就上 没活就睡"],
  hk: ["散工日结 当天给钱", "做一天玩三天", "街市门口 站一天", "通宵网吧 杯面管饱", "有活就上 没活就睡"],
};

const SANHE_SAY: Record<CityKey, [string, string][]> = {
  sz: [
    ["做一天，玩三天。这单结了，明后天是自己的。", "One day on, three days off. This job is paid — the next two are yours."],
    ["人才市场门口站到中午。有活就上，现金当天结。", "Stood at the labour market till noon. Cash the same day, if there is work."],
    ["搬完货，网吧泡面。床位一天二十，不签合同。", "Haul done. Internet cafe, instant noodles. A bed is twenty a day, no contract."],
    ["不拖工资。干完这单就能走，明天再看有没有活。", "No waiting on wages. Finish this one and leave. Tomorrow, see if there is work."],
  ],
  hz: [
    ["仲恺厂门口等日结。做一天，玩三天。", "Waiting at the Zhongkai gate for day pay. One day on, three off."],
    ["有货就搬，现金当场给。没货就去网吧泡面。", "Haul if there is a load, cash on the spot. If not, noodles at the cafe."],
    ["不签合同，不拖到明天。干完就能走。", "No contract, no pay tomorrow. Done means you can leave."],
  ],
  hk: [
    ["街市门口等散工。做一天，玩三天。", "Waiting at the market for a day job. One day on, three off."],
    ["有货就搬，现金当天结。通宵就去网吧食杯面。", "Haul if there is a load, cash today. Overnight means cup noodles at the cafe."],
    ["唔签长约。做完这单就可以走。", "No long contract. Finish this one and go."],
  ],
};

export function sanheSay(city: CityKey, day: number): { zh: string; en: string } {
  const lines = SANHE_SAY[city];
  const line = lines[Math.abs(day) % lines.length] ?? lines[0]!;
  return { zh: line[0], en: line[1] };
}

function hireLines(city: CityKey): { emoji: string; text: string; owner: string; go: string }[] {
  return COMPANIES.filter((c) => (c.city ?? "sz") === city && c.id !== "startup").map((c) => ({
    emoji: c.emoji,
    text: clip(`${c.short}招聘 ${c.canteen ? "食堂管饭" : "去面试"}`),
    owner: c.short,
    go: c.locIds[0] ?? "work",
  }));
}

function rentLines(city: CityKey): string[] {
  return [clip(`单间招租 周租¥${listedRent(city)}`), city === "sz" ? "三和床位 一天20" : "床位招租 先到先住", "合租找人 押一付一"];
}

function saleLines(city: CityKey, shop?: string | null): string[] {
  return [...new Set([
    shop ? clip(`${shop} 今日特价`) : "",
    city === "hk" ? "街市特价 今日生鲜" : city === "sz" ? "华强北清货 当面验机" : "市集特价 第二份半价",
    "市集特价 第二份半价",
    "二手出清 当面验货",
  ].filter((x) => x.length >= 2))];
}

export function streetAds(city: CityKey, day: number, shop?: string | null): StreetAd[] {
  const spots = billboardSpots(city);
  const at = (i: number) => spots[i]?.id ?? spots[0]?.id ?? "home";
  const hires = hireLines(city);
  const hire = hires.length ? hires[Math.abs(day) % hires.length] : null;
  const rentText = pick(rentLines(city), day);
  const sales = saleLines(city, shop);
  const saleText = pick(sales, day + 1);
  const sanheText = pick(SANHE_ADS[city], day);
  const thirdSale = day % 2 === 0;
  const out: StreetAd[] = [];
  if (hire) out.push({ slot: 0, kind: "hire", emoji: hire.emoji, text: hire.text, owner: hire.owner, go: hire.go });
  out.push({ slot: 1, kind: "rent", emoji: "🏠", text: rentText, owner: "房东", go: "home" });
  out.push(thirdSale
    ? { slot: 2, kind: "sale", emoji: "🛍️", text: saleText, owner: shop ? shop : "摊主", go: at(2) }
    : { slot: 2, kind: "sanhe", emoji: "📋", text: sanheText, owner: city === "sz" ? "三和" : "散工", go: at(2) });
  return out;
}

/** 玩家租走的牌留着；空位补上今天的招聘、招租、销售或日结。 */
export function mapAds(city: CityKey, day: number, rented: { slot: number; text: string; emoji: string; owner: string }[], shop?: string | null): MapAd[] {
  const taken = new Set(rented.map((r) => r.slot));
  const street = streetAds(city, day, shop).filter((a) => !taken.has(a.slot));
  return [...rented.map((r) => ({ slot: r.slot, text: r.text, emoji: r.emoji, owner: r.owner })), ...street];
}

export interface AdLine {
  kind: AdKind;
  emoji: string;
  label: string;
  en: string;
  lines: string[];
}

/** 写广告时点一下就填上，字还能改。每条不超过广告牌的 20 字。 */
export function adLines(city: CityKey, shop?: string | null): AdLine[] {
  const hires = hireLines(city).slice(0, 6).map((h) => h.text);
  return [
    { kind: "hire", emoji: "💼", label: "招聘", en: "Hiring", lines: hires.length ? hires : ["小店招聘 当天结算"] },
    { kind: "rent", emoji: "🏠", label: "招租", en: "To let", lines: rentLines(city) },
    { kind: "sale", emoji: "🛍️", label: "销售", en: "For sale", lines: saleLines(city, shop) },
    {
      kind: "sanhe",
      emoji: "📋",
      label: city === "sz" ? "三和" : "日结",
      en: city === "sz" ? "Sanhe" : "Day labor",
      lines: SANHE_ADS[city],
    },
  ];
}
