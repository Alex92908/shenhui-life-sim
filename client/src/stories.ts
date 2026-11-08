/* ---- 街坊连续剧：每个 NPC 一条多日剧情线 ----
   A chapter opens once your relationship reaches its bar, and at most one
   chapter per neighbour per game day — so there is always "what happens to
   阿强 tomorrow" pulling you back. Your choices set flags; the last
   chapter reads them and plays one of the endings, which shows on the
   result screen and earns 深漂档案 points. */

export interface StoryFx { money?: number; mood?: number; energy?: number; rel?: number; xp?: number; skill?: number; network?: number }
export interface StoryChoice { label: string; reply: string; fx: StoryFx; flag?: string }
export interface StoryChapter { need: number; title: string; text: string; choices: StoryChoice[] }
export interface StoryEnding { title: string; text: string; fx: StoryFx }
export interface NpcStory { npc: string; title: string; chapters: StoryChapter[]; ending: (flags: string[]) => StoryEnding }
/** Joins sentence parts with a marker so the English view can translate each part. */
export const PART = "\u200b";
const j = (...parts: string[]) => parts.filter(Boolean).join(PART);
export interface StoryProg { ch: number; day: number; flags: string[]; done?: string }

export const STORIES: NpcStory[] = [
  {
    npc: "阿强", title: "回老家开粉店",
    chapters: [
      { need: 0, title: "路边的馒头", text: "阿强蹲在路边啃馒头，手机屏保是县城一间小门面。「我想攒够五万，回老家开个粉店。在这儿一单八块，回去是给自己干。」", choices: [
        { label: "这想法好，我支持你", reply: "「你是第一个没笑我的人。」他把馒头塞进嘴里，笑得眼睛眯成一条缝。", fx: { rel: 5, mood: 3 } },
        { label: "县城开店能挣到钱吗？", reply: "「……也是，我再算算。」他低头看了半天手机计算器。", fx: { rel: 1 }, flag: "doubt" },
      ] },
      { need: 8, title: "暴雨夜的差评", text: "暴雨夜，阿强的单超时了二十分钟，被顾客投诉罚了 ¥200。他站在屋檐下，雨衣还在滴水：「这个月白跑了三天。」", choices: [
        { label: "替他垫上 ¥200", reply: "「这钱我一定还你！」他攥着手机，声音有点哑。", fx: { money: -200, rel: 10 }, flag: "lent" },
        { label: "请他喝碗糖水，陪他骂两句", reply: "两碗双皮奶下肚，他终于笑了：「算了，明天接着跑。」", fx: { money: -16, mood: 3, rel: 5 } },
      ] },
      { need: 18, title: "再干一年？", text: "阿强的存款到了四万二。「我妈说老家那间门面有人在问了。可再干一年就稳了……你说我是现在走，还是再等等？」", choices: [
        { label: "趁年轻，现在就回去闯", reply: "「行！我这周就去跟站长说。」他一拍大腿，电动车都晃了一下。", fx: { rel: 4 }, flag: "go" },
        { label: "再攒一年，更稳", reply: "「也对，钱多点心里不慌。」他点点头，又看了眼手机里的门面照片。", fx: { rel: 3 }, flag: "stay" },
      ] },
    ],
    ending: (f) => f.includes("go")
      ? { title: "阿强的粉店开张了", text: j("阿强发来一张照片：门头写着「强记米粉」，他穿着围裙站在锅前。", f.includes("lent") ? "附言：「之前借的 ¥200 连本带利还你 ¥300，下次回来吃粉免单！」" : "「下次来我这儿，粉管够！」"), fx: { mood: 12, money: f.includes("lent") ? 300 : 0 } }
      : { title: "阿强当上了站长", text: "阿强留下来又干了一年，被提成了片区站长。「现在我管着二十个兄弟。开店的事，我还没忘。」他塞给你两张奶茶券。", fx: { mood: 8, network: 2 } },
  },
  {
    npc: "小美", title: "要不要离开深圳",
    chapters: [
      { need: 0, title: "第三次改方向", text: "夜市拼桌，小美盯着手机里的需求文档叹气：「项目第三次改方向了。我做了两个月的方案，一句话就没了。」", choices: [
        { label: "听她吐槽完", reply: "她一口气说了二十分钟，最后长出一口气：「说出来好多了，谢谢你。」", fx: { rel: 5, mood: 2 } },
        { label: "给她讲个职场段子", reply: "「噗——」她笑得呛了一口柠檬茶，「你这人真是。」", fx: { rel: 3, mood: 4 } },
      ] },
      { need: 8, title: "被抢走的功劳", text: "小美的方案被组长拿去在大会上讲了，署的是组长的名字。她红着眼眶：「我要不要去找领导说清楚？」", choices: [
        { label: "帮她整理证据，正面说清楚", reply: "你们一起把邮件和文档版本时间线理了出来。「明天我就去。」她把电脑合上。", fx: { energy: -8, xp: 1, rel: 6 }, flag: "fight" },
        { label: "劝她先忍忍，留好记录", reply: "「也是，撕破脸对我没好处。」她把截图存进了一个文件夹。", fx: { rel: 4 }, flag: "calm" },
      ] },
      { need: 18, title: "惠州的 offer", text: "猎头给了小美一个惠州的 offer：工资少两成，但准点下班，公司离海边十分钟。「你说我该去吗？」", choices: [
        { label: "去吧，生活比工资重要", reply: "「我也是这么想的……就是有点舍不得深圳。」她看向远处的灯火。", fx: { rel: 4 }, flag: "hz" },
        { label: "留在深圳再拼一把", reply: "「好，那我就再拼一年！」她把 offer 邮件拖进了归档。", fx: { rel: 4 }, flag: "sz" },
      ] },
    ],
    ending: (f) => f.includes("hz")
      ? { title: "小美在海边安了家", text: "小美在惠州海边租了间带阳台的房子，每天傍晚去海边跑步。「周末来双月湾玩，我请你吃海鲜！」她发来一张日落照片。", fx: { mood: 14 } }
      : f.includes("fight")
        ? { title: "小美升了组长", text: "那次之后领导重新认识了小美，三个月后她升了组长。「那天要不是你陪我理证据，我肯定怂了。」她请你吃了顿大餐。", fx: { mood: 8, network: 3, xp: 2 } }
        : { title: "小美还在拼", text: "小美还在南山加班，但她说现在学会了给自己留退路。「谢谢你一直听我吐槽。」", fx: { mood: 6, network: 1 } },
  },
  {
    npc: "陈伯", title: "孙女的家长会",
    chapters: [
      { need: 0, title: "门岗里的照片", text: "陈伯值夜班，门岗桌上压着一张孙女的照片。「她在老家上小学，我一年就回去一次。上回见她，她都不太认得我了。」", choices: [
        { label: "陪他聊会儿孙女", reply: "说起孙女，陈伯的话一下多了：考了第几名，会背多少首诗……", fx: { rel: 5, mood: 2 } },
        { label: "给他带份夜宵", reply: "「哎，你这孩子，还惦记我。」他接过肠粉，热气糊了眼镜。", fx: { money: -15, rel: 7 } },
      ] },
      { need: 8, title: "老手机", text: "陈伯的老人机打不了视频，孙女每次只能听见声音。「她说想让我看看她的奖状。」", choices: [
        { label: "教他用智能机视频通话", reply: "你教了他一个小时，他终于自己拨通了视频。屏幕那头一声「爷爷！」，他愣住了。", fx: { energy: -10, rel: 8 }, flag: "video" },
        { label: "帮他挑一台便宜的二手机", reply: "「这么好用的手机才三百块？」他宝贝似的捧着。", fx: { rel: 5 }, flag: "phone" },
      ] },
      { need: 18, title: "请不下来的假", text: "孙女学校下周开家长会，第一次邀请爷爷。可物业说门岗缺人，陈伯请不下假。「算了，我这把年纪……」", choices: [
        { label: "帮他代半天班", reply: "「你替我？这……这怎么好意思！」他转身去打电话订票，手都在抖。", fx: { energy: -20, rel: 10 }, flag: "cover" },
        { label: "帮他去跟物业经理说情", reply: "你去物业磨了半天，经理松口给了一天假。", fx: { rel: 6, network: -1 }, flag: "talk" },
      ] },
    ],
    ending: (f) => f.includes("cover") || f.includes("talk")
      ? { title: "陈伯去了家长会", text: j("陈伯回来时拎着一大包老家的腊肉：「孙女在台上念作文，写的是我。」", f.includes("video") ? "现在他每天晚上都跟孙女视频，门岗里总是很热闹。" : "", "他硬塞给你一个红包。"), fx: { mood: 15, money: 88 } }
      : { title: "陈伯在视频里看了家长会", text: "陈伯没请到假，但孙女的老师开了视频。他在门岗里看完了整场，看到最后偷偷擦了擦眼睛。", fx: { mood: 6 } },
  },
  {
    npc: "大芬姐", title: "烧烤摊要搬家",
    chapters: [
      { need: 0, title: "城管的通知", text: "大芬姐一边翻烤串一边叹气：「下个月这条街要统一搬进美食城，摆了八年的摊，说没就没了。」", choices: [
        { label: "陪她算算搬进去的账", reply: "你们在餐巾纸上算了半天：租金贵了，但不怕下雨。「好像也不是不行。」", fx: { rel: 5, skill: 0 } },
        { label: "多点两串，帮衬生意", reply: "「今天的鸡翅给你烤焦一点，你最爱的那种。」", fx: { money: -30, mood: 5, rel: 4 } },
      ] },
      { need: 8, title: "差一点的押金", text: "美食城的新档口要交 ¥3000 押金，大芬姐凑来凑去还差五百。「实在不行……我就回老家算了。」", choices: [
        { label: "借她 ¥500", reply: "「你放心，开张第一个月就还你。」她把钱叠得整整齐齐。", fx: { money: -500, rel: 12 }, flag: "lend" },
        { label: "帮她在朋友圈发团购预售", reply: "你做了张预售海报发出去，一晚上卖了四十份。「够了够了！」", fx: { energy: -8, network: 1, rel: 8 }, flag: "promo" },
      ] },
      { need: 18, title: "新店起名", text: "档口要做招牌了，大芬姐拿不定主意：「叫老名字「大芬烧烤」，还是听我女儿的，叫「深夜食堂」？」", choices: [
        { label: "就叫「大芬烧烤」", reply: "「对！老熟客认这个。」她一拍案板。", fx: { rel: 3 }, flag: "classic" },
        { label: "叫「深夜食堂」，年轻人爱", reply: "「行，听你们年轻人的。」她笑着摇摇头。", fx: { rel: 3 }, flag: "trendy" },
      ] },
    ],
    ending: (f) => ({
      title: f.includes("trendy") ? "「深夜食堂」成了网红店" : "「大芬烧烤」老店新开",
      text: j(f.includes("trendy") ? "开张第二周就上了本地探店榜，门口排队排到街口。" : "开张那天老熟客全来了，鞭炮放了足足五分钟。", f.includes("lend") ? "大芬姐把 ¥700 塞给你：「多的是利息，不许推！」" : "", "「你来吃，永远免单。」"),
      fx: { mood: 12, money: f.includes("lend") ? 700 : 0, network: f.includes("promo") ? 2 : 1 },
    }),
  },
  {
    npc: "子健", title: "专升本",
    chapters: [
      { need: 0, title: "图书馆的邀请", text: "子健抱着一摞专升本真题坐到你旁边：「考试还有一个月，你要不要一起刷题？一个人实在坐不住。」", choices: [
        { label: "一起学一会儿", reply: "两个人对着做了一套卷子，你顺便也学到不少。", fx: { energy: -8, skill: 1, rel: 5 } },
        { label: "给他带杯咖啡打气", reply: "「有你这杯咖啡，我今晚能多刷十道题！」", fx: { money: -18, rel: 5 } },
      ] },
      { need: 8, title: "模考没过线", text: "子健模考差了十二分，把卷子揉成一团：「我是不是根本不是读书的料？要不直接去厂里上班算了。」", choices: [
        { label: "帮他把错题一道道讲明白", reply: "讲到第八题，他突然「啊」了一声：「原来是这么回事！」", fx: { energy: -12, skill: 1, rel: 8 }, flag: "tutor" },
        { label: "鼓励他：差十二分，追得回来", reply: "「……嗯，我再试试。」他把卷子展平，夹回书里。", fx: { rel: 5 }, flag: "cheer" },
      ] },
      { need: 18, title: "考前一夜", text: "考前一晚十一点，子健给你打电话：「我睡不着，脑子里全是公式，心跳得好快……」", choices: [
        { label: "陪他聊到他睡着", reply: "你们从考试聊到老家的荔枝，他的声音慢慢变小，最后传来了呼噜声。", fx: { energy: -10, rel: 8 }, flag: "night" },
        { label: "叫他放下手机，赶紧睡", reply: "「好……好，我试试。」电话挂断了。", fx: { rel: 2 } },
      ] },
    ],
    ending: (f) => f.includes("tutor") || f.includes("night")
      ? { title: "子健上岸了", text: "成绩出来，子健超了线十一分。他跑来塞给你一面锦旗，上面写着「最佳学伴」：「没有你，我早放弃了。」", fx: { mood: 15, skill: 1 } }
      : { title: "子健明年再战", text: "子健差了三分没考上，但他说明年还考：「这次至少知道差在哪了。」他已经在报名下一年的网课。", fx: { mood: 4 } },
  },
  {
    npc: "阿琳", title: "优化名单",
    chapters: [
      { need: 0, title: "茶水间的传言", text: "阿琳在茶水间压低声音：「听说下个季度要优化，名单已经在 HR 手里了。我这两天心里一直发慌。」", choices: [
        { label: "安慰她：慌也没用，先做好手上的", reply: "「你说得对。」她深吸一口气，把枸杞茶续满了。", fx: { rel: 5 } },
        { label: "跟她一起分析谁最危险", reply: "分析了一圈，你们俩都觉得自己挺危险，反而笑了。", fx: { rel: 4, mood: 3 } },
      ] },
      { need: 8, title: "抽屉里的副业", text: "你撞见阿琳下班后在偷偷写一个记账 App：「这是我的退路，你帮我保密好不好？」", choices: [
        { label: "帮她测 App、提意见", reply: "你找出十几个 bug，她连夜改完：「你比我们测试还专业！」", fx: { energy: -10, xp: 1, rel: 8 }, flag: "help" },
        { label: "答应保密，提醒她别在工位写", reply: "「明白，以后回家写。」她把电脑屏幕一合。", fx: { rel: 5 } },
      ] },
      { need: 18, title: "名单公布", text: "名单出来了，阿琳在上面。她抱着纸箱站在电梯口：「我打算全职做那个 App。你……要不要一起？」", choices: [
        { label: "下班后跟她一起干", reply: "「真的？那你就是联合创始人了！」她眼睛一下亮了。", fx: { rel: 8 }, flag: "join" },
        { label: "祝福她，帮她搬纸箱", reply: "你把她送到地铁口。「以后常联系。」她用力挥了挥手。", fx: { rel: 4 }, flag: "bless" },
      ] },
    ],
    ending: (f) => f.includes("join") && f.includes("help")
      ? { title: "记账 App 上线了", text: "App 上线第一周就有一万次下载，还上了应用商店推荐。阿琳给你转了第一笔分红：「联合创始人，这是你应得的！」", fx: { money: 1000, xp: 3, mood: 12 } }
      : f.includes("join")
        ? { title: "项目没成，人更强了", text: "App 做了三个月没做起来，但阿琳靠这个作品拿到了一家大厂的 offer：「跟你一起熬的夜，都值了。」", fx: { skill: 2, mood: 6, network: 2 } }
        : { title: "阿琳开始了新生活", text: "阿琳去了另一家公司，朋友圈里她在新工位上比耶：「这边不用天天开评审会了！」", fx: { mood: 5, network: 1 } },
  },
];

export const storyOf = (npc: string) => STORIES.find((s) => s.npc === npc) ?? null;

export type StoryStatus =
  | { kind: "ready"; chapter: StoryChapter; idx: number; total: number }
  | { kind: "ending"; total: number }
  | { kind: "locked"; need: number; idx: number; total: number }
  | { kind: "tomorrow"; idx: number; total: number }
  | { kind: "done"; title: string; total: number };

/** Chapters + the ending beat. */
export function storyStatus(story: NpcStory, prog: StoryProg | undefined, rel: number, day: number): StoryStatus {
  const p = prog ?? { ch: 0, day: 0, flags: [] };
  const total = story.chapters.length + 1;
  if (p.done) return { kind: "done", title: p.done, total };
  if (p.ch > 0 && p.day >= day) return { kind: "tomorrow", idx: p.ch, total };
  if (p.ch >= story.chapters.length) return { kind: "ending", total };
  const chapter = story.chapters[p.ch]!;
  if (rel < chapter.need) return { kind: "locked", need: chapter.need, idx: p.ch, total };
  return { kind: "ready", chapter, idx: p.ch, total };
}
