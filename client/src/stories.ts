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
  /* ---- 香港街坊 ---- */
  {
    npc: "华哥", title: "茶餐厅加租",
    chapters: [
      { need: 0, title: "一杯茶走", text: "华哥一边撞奶一边叹气：「业主话下个月加租三成。做咗三十年，可能要执笠喇。」他把一杯茶走推到你面前。", choices: [
        { label: "陪他倾下计", reply: "「你肯听我讲，我已经好开心。」他多送了你一件菠萝油。", fx: { rel: 5, mood: 3 } },
        { label: "帮他在网上发个好评", reply: "你写了一篇长长的食评，配上奶茶的照片。「哗，几十个赞！」", fx: { rel: 4, network: 1 } },
      ] },
      { need: 8, title: "老街坊的联署", text: "街坊们想联署求业主手下留情，华哥却拿不定主意：「求人唔似我性格……」", choices: [
        { label: "帮他挨家挨户收联署", reply: "你跑了一个下午，收到两百多个签名。华哥看着那叠纸，眼眶红了。", fx: { energy: -12, rel: 10, network: 2 }, flag: "petition" },
        { label: "建议他搬去租金平点的街", reply: "「搬……都系一条路。」他望住店里的卡位，没再说话。", fx: { rel: 4 }, flag: "move" },
      ] },
      { need: 18, title: "最后的决定", text: "业主约华哥见面。「你话我应该点？坚持留低，定系搬去深水埗重新开始？」", choices: [
        { label: "留低，老店就要在老地方", reply: "「好！我同佢倾到尽。」华哥把围裙绑紧了一点。", fx: { rel: 4 }, flag: "stay" },
        { label: "搬去深水埗，租平人情浓", reply: "「深水埗……我细个就喺嗰度大。」他笑了。", fx: { rel: 4 }, flag: "go" },
      ] },
    ],
    ending: (f) => f.includes("stay") && f.includes("petition")
      ? { title: "茶餐厅留低了", text: "业主看到两百多个街坊签名，只加了一成。华哥在墙上贴了一张「多谢街坊」，下面第一个名就是你。「你嘅奶茶，以后免费。」", fx: { mood: 15, money: 0, network: 2 } }
      : f.includes("go")
        ? { title: "深水埗新店开张", text: "华哥的新店开在深水埗，卡位、吊扇、手写餐牌全部搬了过来。开张第一日，老街坊坐满一屋。", fx: { mood: 12, network: 1 } }
        : { title: "茶餐厅执笠了", text: "华哥的店还是关了。最后一日，他冲了最后一杯茶走给你：「香港人，捱得过嘅。」他准备去连锁店做师傅。", fx: { mood: 4 } },
  },
  {
    npc: "船长辉", title: "最后一班船",
    chapters: [
      { need: 0, title: "船头的老人", text: "天星小轮靠岸，船长辉站在船头抛缆。「明年我就退休喇，开咗四十年，维港每一粒灯我都识。」", choices: [
        { label: "请他讲讲以前的维港", reply: "他讲起七十年代的维港，没有高楼，晚上只有渔火。「你哋后生好彩，见到咁靓嘅香港。」", fx: { rel: 5, mood: 4 } },
        { label: "帮他拍一张船头的照片", reply: "「影靓啲，我要寄俾我个孙。」他挺直了腰。", fx: { rel: 4, mood: 2 } },
      ] },
      { need: 8, title: "孙仔的愿望", text: "辉哥的孙仔想在他退休前坐一次他开的船，但孙仔在加拿大。「机票咁贵，算啦。」", choices: [
        { label: "教他用视频直播开船", reply: "那天你拿着手机站在船头，孙仔在视频里大叫「爷爷好劲！」，全船乘客都笑了。", fx: { energy: -8, rel: 10 }, flag: "video" },
        { label: "鼓励他亲自飞去探孙", reply: "「或者……退休之后去一转。」他把船票夹进了钱包。", fx: { rel: 5 }, flag: "fly" },
      ] },
      { need: 18, title: "退休那天", text: "退休前一晚，辉哥问你：「最后一班船，你嚟唔嚟？」", choices: [
        { label: "一定来，陪他开完最后一程", reply: "「好，我留个船头位俾你。」", fx: { rel: 6 }, flag: "lastferry" },
        { label: "帮他办一个小小的欢送会", reply: "你约了几个常客，准备了蛋糕和横额。", fx: { money: -150, rel: 8, network: 1 }, flag: "party" },
      ] },
    ],
    ending: (f) => ({
      title: f.includes("party") ? "码头上的欢送会" : "最后一班船",
      text: j(f.includes("party") ? "最后一班船靠岸，码头上站满了常客，横额写着「辉哥，一路顺风」。辉哥拉响汽笛，久久没有放手。" : "最后一班船，你站在船头，辉哥让你拉响了汽笛。对岸的灯一栋一栋亮起来。", f.includes("fly") ? "下个月，他寄来一张在温哥华跟孙仔的合照。" : f.includes("video") ? "孙仔在视频里看完了全程。" : "", "「维港交俾你哋喇。」"),
      fx: { mood: 15, network: f.includes("party") ? 2 : 1 },
    }),
  },
  {
    npc: "阿May", title: "深圳的 offer",
    chapters: [
      { need: 0, title: "三点钟的 lunch", text: "阿May 三点钟才吃上午饭：「中环啲人食饭都系开会。我都唔知几耐冇准时收工过。」", choices: [
        { label: "陪她吃完这顿饭", reply: "她终于放下手机，慢慢吃完了一碗云吞面。「多谢你，我好耐冇咁坐低过。」", fx: { rel: 5, mood: 3 } },
        { label: "约她周末去西贡行山", reply: "「好呀！我都想透下气。」她在手机日历上打了个星号。", fx: { rel: 4 }, flag: "hike" },
      ] },
      { need: 8, title: "前海的猎头", text: "一个前海的猎头找上阿May：薪水差不多，但每天准时下班，住深圳的房子大一倍。「你觉得我适合北上吗？」", choices: [
        { label: "陪她去深圳看看", reply: "你们坐高铁去了前海，在深圳湾公园看了一场日落。「原来深圳咁靓。」", fx: { energy: -10, rel: 8 }, flag: "visit" },
        { label: "劝她先想清楚家人那边", reply: "「我阿妈一个人住……我再谂下。」", fx: { rel: 5 }, flag: "family" },
      ] },
      { need: 18, title: "要不要签", text: "offer 摆在面前，阿May 手里的笔迟迟落不下去。「你话，我应唔应该签？」", choices: [
        { label: "签吧，换一种生活", reply: "她深吸一口气，签了。「深圳见！」", fx: { rel: 5 }, flag: "go" },
        { label: "留在香港，在本地找平衡", reply: "「或者我应该同老细倾下，唔好再咁做落去。」", fx: { rel: 5 }, flag: "stay" },
      ] },
    ],
    ending: (f) => f.includes("go")
      ? { title: "阿May 北上了", text: j("阿May 搬去了前海，每天六点准时下班，周末坐高铁回香港陪阿妈饮茶。", f.includes("visit") ? "「多谢你陪我去睇过，我先敢签。」" : "", "她发来一张深圳湾日落的照片。"), fx: { mood: 12, network: 2 } }
      : { title: "阿May 学会了收工", text: j("阿May 留在中环，但跟老板谈好了每周两天准时收工。", f.includes("hike") ? "周末她拉你去西贡行山，说这是她的「充电日」。" : "", "「原来平衡唔使搬城市，只需要讲出口。」"), fx: { mood: 10, network: 1 } },
  },
  {
    npc: "婆婆珍", title: "菜档传给谁",
    chapters: [
      { need: 0, title: "四十年的秤", text: "婆婆珍在春秧街卖了四十年菜，电车在她档口前叮叮驶过。「我个孙仔读大学，冇人接手喇。」", choices: [
        { label: "帮她卖一个早上的菜", reply: "你学会了用杆秤，还帮她招呼了几个熟客。「后生仔，有前途！」", fx: { energy: -8, rel: 6 } },
        { label: "买一大袋菜回家", reply: "她多塞了你一把葱：「下次再嚟。」", fx: { money: -40, rel: 4 } },
      ] },
      { need: 8, title: "孙仔的想法", text: "婆婆珍的孙仔阿杰说想把菜档做成网上订菜。婆婆珍摇头：「网上？菜要用手拣先知靓唔靓。」", choices: [
        { label: "帮阿杰做一个订菜小程序", reply: "你和阿杰熬了两个晚上，订单页上线了。第一单是隔壁楼的阿婆。", fx: { energy: -12, skill: 1, rel: 8 }, flag: "online" },
        { label: "劝阿杰先跟婆婆在档口学一年", reply: "「好，我暑假先嚟帮手。」阿杰挽起了袖子。", fx: { rel: 6 }, flag: "learn" },
      ] },
      { need: 18, title: "电车经过的早上", text: "婆婆珍最近腰痛，问你：「你话我系咪应该退休，俾阿杰试下？」", choices: [
        { label: "让阿杰接手，婆婆做顾问", reply: "「顾问？咁好听！」婆婆珍笑得眼睛都眯了。", fx: { rel: 5 }, flag: "handover" },
        { label: "多做几年，慢慢交接", reply: "「我都系舍唔得呢个档口。」", fx: { rel: 5 }, flag: "slow" },
      ] },
    ],
    ending: (f) => f.includes("handover") && f.includes("online")
      ? { title: "菜档有了接班人", text: "阿杰接手了菜档，网上订单一日几十单，婆婆珍每朝坐在档口旁边「监工」。电车叮叮驶过，她向你挥手：「呢个档口，唔会冇咗。」", fx: { mood: 15, network: 2 } }
      : f.includes("handover")
        ? { title: "婆婆珍退休了", text: "阿杰接过了杆秤，生意时好时坏，但每个熟客他都记得名字。婆婆珍说：「慢慢嚟，我四十年前都系咁。」", fx: { mood: 10, network: 1 } }
        : { title: "婆婆珍还在档口", text: "婆婆珍还在卖菜，阿杰每个周末来帮手。「做得一日得一日，呢度就系我嘅家。」", fx: { mood: 8 } },
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
