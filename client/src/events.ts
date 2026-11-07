// Random life events, ported from the previous edition. APEC events only
// enter the pool during leaders' week (game days 14–19 = Nov 14–19).
import type { CityKey } from "./data";

export interface FxState {
  money: number;
  energy: number;
  mood: number;
  earned: number;
  xp: number;
  skill: number;
  network: number;
  pay: number;
  payMul: number;
}

export interface EventChoice {
  t: string;
  s: string;
  apply: (S: FxState) => string;
}

export interface GameEvent {
  ctx: "any" | "sz" | "hz" | "apec";
  tag: string;
  title: string;
  desc: string;
  choices: EventChoice[];
}

export const EVENTS: GameEvent[] = [
  { ctx: "any", tag: "房东来了", title: "房东阿姨敲门：下月可能涨租", desc: "房东站在门口，笑眯眯地说最近行情好，隔壁都涨了。你心里一紧——这握手楼/老房子，真值这个价吗？", choices: [
    { t: "好声好气商量", s: "夸阿姨人好、做饭香，争取不涨", apply: (S) => { S.mood += 4; return "你一顿彩虹屁，房东被哄开心了：行吧，你这间先不涨。心情 +4。"; } },
    { t: "硬刚：涨就搬走", s: "赌一把，大不了搬去更远的地方", apply: (S) => { if (Math.random() < 0.5) { S.mood += 6; return "房东反而怂了：哎别搬别搬，不涨了。心情 +6，爽！"; } S.money -= 120; S.mood -= 8; return "房东没挽留，你连夜看房花了 ¥120 中介咨询费，心情 -8。"; } },
  ] },
  { ctx: "sz", tag: "深圳地铁", title: "早高峰地铁，鞋被挤掉了一只", desc: "早高峰人贴人。你的一只鞋被踩掉，在人海里漂移了三站才找回来。", choices: [
    { t: "光脚也要准时打卡", s: "全勤奖比脸面重要", apply: (S) => { S.money += 50; S.mood -= 6; return "你光着一只脚打上卡，全勤奖 +¥50 保住了，但心情 -6。"; } },
    { t: "请假半天，回去补觉", s: "鞋没了，人也累了", apply: (S) => { S.energy += 12; S.mood += 5; S.money -= 40; return "请假扣了 ¥40，但补了个觉，能量 +12，心情 +5。"; } },
  ] },
  { ctx: "any", tag: "老板画饼", title: "老板开会：上市后人人有期权", desc: "老板在白板上画了个大饼，说公司明年上市，现在加班都是为自己奋斗。饼很香，就是不能当饭吃。", choices: [
    { t: "信了，今晚主动加班", s: "万一真上市了呢", apply: (S) => { const p = Math.round(S.pay * S.payMul * 0.6); S.money += p; S.earned += p; S.energy -= 15; return `加班费 +¥${p} 到账，期权还在天上飞。能量 -15。`; } },
    { t: "饼先放着，准时下班", s: "下班后的时间才是自己的", apply: (S) => { S.mood += 9; return "你准时下班去吃了猪脚饭，心情 +9。饼再大，不如饭香。"; } },
  ] },
  { ctx: "any", tag: "外卖翻车", title: "点的外卖洒了 / 被偷了", desc: "你满心期待的外卖，打开只剩个空袋子——洒了，或者被顺走了。", choices: [
    { t: "找商家重做一份", s: "等40分钟，饿着等", apply: (S) => { S.energy -= 6; S.mood -= 4; return "重做的终于到了，但你已经饿过头了，能量 -6，心情 -4。"; } },
    { t: "算了，去夜市吃一口", s: "花点小钱，马上吃上", apply: (S) => { S.money -= 16; S.energy += 18; return "夜市热乎饭下肚，能量 +18，花了 ¥16。"; } },
  ] },
  { ctx: "hz", tag: "海景房诱惑", title: "中介拉你看海景房：首付只要……", desc: "“这套双月湾海景房，推窗见海，现在上车还来得及！”中介说得天花乱坠。", choices: [
    { t: "心动，但捂紧钱包", s: "看看就好，存款要紧", apply: (S) => { S.mood += 5; return "你看了看海，拍了张照，心情 +5，一分没花。海是大家的。"; } },
    { t: "交了 ¥500 意向金", s: "万一涨了呢……", apply: (S) => { S.money -= 500; S.mood -= 3; return "意向金 -¥500 交出去了，回家越想越慌。心情 -3。"; } },
  ] },
  { ctx: "any", tag: "家里电话", title: "妈妈来电：工资多少？有对象没？", desc: "妈妈问了工资、房租、对象，最后说“在外面照顾好自己”。鼻子有点酸。", choices: [
    { t: "报喜不报忧", s: "“挺好的，钱够花”", apply: (S) => { S.mood += 7; return "挂了电话，你更想攒点钱了。心情 +7。"; } },
    { t: "转 ¥300 回家", s: "给爸妈买点好吃的", apply: (S) => { if (S.money < 300) { S.mood -= 4; return "想转钱发现余额不够，心情 -4。下个月一定。"; } S.money -= 300; S.mood += 10; return "转了 ¥300 回家，妈妈语气全是开心。心情 +10。"; } },
  ] },
  { ctx: "any", tag: "台风预警", title: "台风要来了，全城预警", desc: "气象台发了预警，风雨将至。超市的泡面货架快空了。", choices: [
    { t: "囤货在家躺一天", s: "泡面+可乐+剧，完美", apply: (S) => { S.money -= 35; S.energy += 15; S.mood += 10; return "花 ¥35 囤了货，在家躺了一天，能量 +15，心情 +10。"; } },
    { t: "风雨无阻去上班", s: "全勤不能断", apply: (S) => { S.money += 80; S.mood -= 7; S.energy -= 10; return "冒雨上班拿到 ¥80 补贴，但浑身湿透，心情 -7。"; } },
  ] },
  { ctx: "sz", tag: "人才补贴", title: "好消息：补贴/退税到账了", desc: "手机弹出到账提醒——人才补贴/个税退税，比想象中多一点。", choices: [
    { t: "存起来，不动", s: "目标又近了一步", apply: (S) => { S.money += 600; S.earned += 600; return "补贴 +¥600 到账！离目标又近了一截。"; } },
    { t: "请自己吃顿好的", s: "奖励一下辛苦的自己", apply: (S) => { S.money += 380; S.earned += 600; S.mood += 12; return "补贴 +¥600，花 ¥220 吃了顿好的，心情 +12。"; } },
  ] },
  { ctx: "any", tag: "同事随礼", title: "同事结婚，要随份子了", desc: "关系还不错的同事发来请柬。随少了不好看，随多了心疼。", choices: [
    { t: "随 ¥200，情谊到", s: "标准价，不多不少", apply: (S) => { S.money -= 200; S.mood += 3; return "随了 ¥200，吃了顿喜酒，心情 +3。"; } },
    { t: "借口加班，不去了", s: "省钱，但有点尴尬", apply: (S) => { S.mood -= 5; return "省下了份子钱，但接下来一周都有点尴尬，心情 -5。"; } },
  ] },
  { ctx: "hz", tag: "惠州日常", title: "楼下阿婆送了把青菜", desc: "卖菜阿婆多塞了把青菜：“后生仔，自己做饭食，健康！”", choices: [
    { t: "谢谢阿婆，自己做饭", s: "省钱又健康", apply: (S) => { S.energy += 16; S.mood += 8; return "用阿婆的菜炒了个饭，能量 +16，心情 +8。"; } },
    { t: "回赠一瓶凉茶", s: "礼尚往来", apply: (S) => { S.money -= 6; S.mood += 11; return "花 ¥6 回赠凉茶，阿婆笑得合不拢嘴，心情 +11。"; } },
  ] },
  { ctx: "any", tag: "城中村日常", title: "半夜停水了", desc: "洗头洗一半，水停了。房东在群里说“水泵坏了，明早修”。", choices: [
    { t: "用饮用水冲一冲", s: "凑合一晚", apply: (S) => { S.mood -= 5; S.energy -= 4; return "凑合洗完，心情 -5。这种日子，也是生活的一部分。"; } },
    { t: "去24h便利店蹭洗手池", s: "机智如你", apply: (S) => { S.mood += 4; return "便利店店员都认识你了，借了洗手池，心情 +4。"; } },
  ] },
  { ctx: "any", tag: "深夜emo", title: "深夜刷到同学买房的朋友圈", desc: "凌晨一点，有人晒房本，有人晒娃，你晒被子——明天还要晒。", choices: [
    { t: "关手机，睡觉", s: "别人的进度条不是我的", apply: (S) => { S.mood += 6; S.energy += 8; return "关掉手机睡了个好觉，心情 +6，能量 +8。"; } },
    { t: "emo到凌晨三点", s: "越刷越清醒", apply: (S) => { S.mood -= 12; S.energy -= 12; return "刷到三点，心情 -12，能量 -12。"; } },
  ] },
  { ctx: "apec", tag: "APEC 国际周", title: "一位外宾向你问路", desc: "会场门口，一位外宾拿着地图有点迷路，看到你像看到救星。你的英语，还够用吗？", choices: [
    { t: "热心指路 + 带一段", s: "顺便练口语", apply: (S) => { S.network += 1; S.mood += 8; return "你连说带比划把人带到会场门口，外宾送了你一枚 APEC 纪念徽章。人脉 +1，心情 +8。"; } },
    { t: "微笑摇头，快步走开", s: "怕说错话", apply: (S) => { S.mood -= 3; return "你笑着摆摆手走开了，心里有点后悔没多学两句英语。心情 -3。去图书馆学一课吧。"; } },
  ] },
  { ctx: "apec", tag: "APEC 国际周", title: "会务组招募临时志愿者", desc: "Lisa 在群里喊人：APEC 领导人周会务缺人手，先培训半天，之后接待外宾优先排你。", choices: [
    { t: "报名参加培训", s: "半天时间，换长期机会", apply: (S) => { S.energy -= 10; S.skill += 1; S.xp += 2; return "培训完拿到志愿者证，技能 +1，经验 +2。外宾接待的门槛，你达到了。"; } },
    { t: "这周只想搞钱", s: "培训不发钱", apply: (S) => { S.mood += 2; return "你婉拒了，先把这周的房租赚出来再说。心情 +2。"; } },
  ] },
  { ctx: "any", tag: "晋升季", title: "公司晋升答辩通知下来了", desc: "HR 发了通知：本季度晋升答辩开始报名。准备得越充分，评委越买账。", choices: [
    { t: "认真准备 PPT", s: "把项目数据都整理出来", apply: (S) => { if (S.skill >= 3) { S.money += 300; S.earned += 300; S.xp += 3; return "答辩很顺，评委当场给了 ¥300 项目奖金，经验 +3。升职，稳了。"; } S.mood -= 5; return "准备得很认真，但技能储备还差点，评委让你下季度再来。心情 -5。先去图书馆补补课。"; } },
    { t: "随缘吧，不折腾", s: "躺平也是一种态度", apply: (S) => { S.mood += 3; return "你没报名，准时下班吃了顿好的。心情 +3。"; } },
  ] },
  { ctx: "any", tag: "街坊群", title: "街坊拼单群里在团购水果", desc: "大芬姐在群里喊：整车荔枝/海鲜拼单，比市场价便宜一截，跟不跟？", choices: [
    { t: "跟一单", s: "街坊的便宜要占", apply: (S) => { S.money -= 45; S.energy += 12; S.mood += 5; return "花 ¥45 拼了一箱，甜到心里。能量 +12，心情 +5。"; } },
    { t: "看看就好", s: "钱包优先", apply: (S) => { S.mood += 1; return "你围观了一场热闹的拼单，一分没花。心情 +1。"; } },
  ] },
  { ctx: "sz", tag: "华强北", title: "柜台老板跟你砍价拉扯", desc: "你看中一台二手手机，老板开价咬得很死，就看谁先松口。", choices: [
    { t: "拿出砍价大法", s: "转身要走那一套", apply: (S) => { if (Math.random() < 0.55) { S.money += 120; S.earned += 120; S.mood += 5; return "老板服了，少了 ¥120 成交，你转手小赚。心情 +5。"; } S.money -= 150; S.mood -= 4; return "拉扯半天还是被老板带了节奏，多花了 ¥150。心情 -4。"; } },
  ] },
  { ctx: "hz", tag: "双月湾", title: "退潮了，本地人都在赶海", desc: "沙滩上全是小螃蟹和贝壳，隔壁阿叔的桶已经满了。", choices: [
    { t: "卷起裤脚一起挖", s: "快乐不要钱", apply: (S) => { S.energy += 8; S.mood += 10; return "挖了一桶花甲和贝壳，能量 +8，心情 +10。今晚加餐！"; } },
    { t: "挖到的拿去卖给排档", s: "快乐变现", apply: (S) => { S.money += 80; S.earned += 80; S.mood += 6; return "排档老板爽快收了，+¥80。心情 +6，海风真能换钱。"; } },
  ] },
];

export function pickEvent(day: number, cityKey: CityKey, seenTags: Set<string>): GameEvent | null {
  const apec = day >= 14 && day <= 19;
  const pool = EVENTS.filter(
    (e) =>
      !seenTags.has(e.title) &&
      (e.ctx === "any" || e.ctx === cityKey || (e.ctx === "apec" && apec && cityKey === "sz")),
  );
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}
