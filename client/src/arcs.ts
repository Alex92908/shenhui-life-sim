/* ---- 人生连续剧：发生在「你」身上的多日剧情线 ----
   和街坊连续剧（stories.ts，跟着某个 NPC 走）不同，这些是生活本身找上门：
   房东涨租、老乡借钱、恋爱、裁员、爸妈来看你、室友。每条三到四幕，
   一天最多推进一幕（第二天早上接着演），你的选择决定结局。 */

export interface ArcFx { money?: number; mood?: number; energy?: number; network?: number; xp?: number; /** weekly rent change, % */ rentPct?: number }
export interface ArcChoice { zh: string; en: string; replyZh: string; replyEn: string; fx: ArcFx; flag?: string }
export interface ArcStage { zh: string; en: string; textZh: string; textEn: string; choices: ArcChoice[] }
export interface ArcEnding { zh: string; en: string; textZh: string; textEn: string; fx: ArcFx }
export interface LifeArc {
  id: string; emoji: string; zh: string; en: string;
  /** can this arc start for this player? */
  when: (c: { day: number; money: number; wage: boolean; ownFlat: boolean; city: string }) => boolean;
  stages: ((flags: string[]) => ArcStage)[];
  ending: (flags: string[]) => ArcEnding;
}
export interface ArcProg { st: number; day: number; flags: string[]; done?: string }

const C = (zh: string, en: string, replyZh: string, replyEn: string, fx: ArcFx, flag?: string): ArcChoice => ({ zh, en, replyZh, replyEn, fx, flag });
const has = (f: string[], x: string) => f.includes(x);

export const LIFE_ARCS: LifeArc[] = [
  {
    id: "rent", emoji: "🏚️", zh: "房东要涨租", en: "The landlord wants more rent",
    when: (c) => !c.ownFlat && c.day >= 2,
    stages: [
      () => ({ zh: "一条微信", en: "A WeChat message", textZh: "早上七点，房东发来一条语音：「下个月开始房租涨 15%，周边都涨了，你理解一下哈。」", textEn: "7 am, a voice note from the landlord: “Rent goes up 15% from next month. Everyone round here has put it up — hope you understand.”", choices: [
        C("好好商量", "Negotiate", "你回了一段很长的文字，从「住了这么久」讲到「我从没拖过租」。房东回：「我考虑一下。」", "You write a long reply — how long you've stayed, never paid late. The landlord: “I'll think about it.”", { mood: -2 }, "nego"),
        C("算了，涨就涨吧", "Fine, accept it", "你回了个「好的」。房东秒回：「爽快！」周租涨了 15%。", "You reply “OK”. The landlord instantly: “Great!” Weekly rent +15%.", { rentPct: 15 }, "accept"),
        C("开始在网上看别的房", "Start looking elsewhere", "你打开租房 App，刷到凌晨一点。", "You open the rental app and scroll until 1 am.", { energy: -6 }, "look"),
      ] }),
      (f) => has(f, "nego")
        ? { zh: "房东的还价", en: "The counter-offer", textZh: "房东回来了：「那就涨 8%，你帮我盯着点楼道灯，坏了跟我说。」", textEn: "The landlord comes back: “Make it 8% — and keep an eye on the stairwell lights for me.”", choices: [
          C("成交", "Deal", "「你这租客我喜欢。」周租涨 8%。", "“I like you as a tenant.” Weekly rent +8%.", { rentPct: 8 }, "deal"),
          C("坚持一分不涨", "Hold out for nothing", "房东没再回消息。你心里有点打鼓。", "No reply. You start to worry a little.", { mood: -3 }, "hold"),
        ] }
        : has(f, "look")
          ? { zh: "中介带看", en: "Viewing with an agent", textZh: "中介带你看了一间：便宜 10%，但离地铁站远，每天多走二十分钟。搬家还得花一笔。", textEn: "The agent shows you a place: 10% cheaper, but far from the metro — twenty more minutes a day. And moving costs money.", choices: [
            C("搬！", "Move!", "你叫了个货拉拉，一车装完。腰酸了一晚上，但每周省下一笔。", "One van load. Your back aches all night, but you save every week.", { money: -600, energy: -15, rentPct: -25 }, "moved"),
            C("算了，还是回去跟房东谈", "Never mind — go back to the landlord", "你厚着脸皮跟房东说「我想了想还是住这儿」，房东：「那就涨 10%。」", "You swallow your pride. The landlord: “Then 10%.”", { rentPct: 10 }, "back"),
          ] }
          : { zh: "一箱荔枝", en: "A box of lychees", textZh: "房东敲门，送来一箱荔枝：「老家寄来的，你上次那么爽快，给你尝尝。」", textEn: "A knock: the landlord with a box of lychees. “From my hometown — you were so easy about the rent.”", choices: [
            C("谢谢阿姨", "Thank her", "荔枝很甜，你分了一半给隔壁。", "Sweet lychees. You give half to the neighbours.", { mood: 6, network: 1 }),
          ] },
    ],
    ending: (f) => has(f, "hold")
      ? { zh: "房东松口了", en: "The landlord gave in", textZh: "一周后房东终于回复：「行吧，不涨了。但你要续签一年。」你赢了这一局。", textEn: "A week later: “Fine, no rise. But sign for another year.” You won this round.", fx: { mood: 10 } }
      : has(f, "moved") ? { zh: "新家", en: "A new place", textZh: "新房子虽然远一点，但窗外有棵大榕树，早上有鸟叫。", textEn: "The new place is further out, but there's a big banyan outside the window and birds in the morning.", fx: { mood: 8 } }
        : has(f, "deal") ? { zh: "楼道灯", en: "The stairwell lights", textZh: "你修好了楼道灯，邻居们都认识你了。", textEn: "You got the stairwell lights fixed. Now all the neighbours know you.", fx: { network: 2, mood: 4 } }
          : { zh: "照常过日子", en: "Life goes on", textZh: "租金涨了，日子还得过。你把每月预算表又改了一遍。", textEn: "The rent went up; life goes on. You redo your monthly budget.", fx: { xp: 1 } },
  },
  {
    id: "loan", emoji: "📞", zh: "老乡借钱", en: "A friend from home needs money",
    when: (c) => c.money >= 1500 && c.day >= 3,
    stages: [
      () => ({ zh: "深夜来电", en: "A late-night call", textZh: "晚上十一点，老家的发小阿伟打来电话：「我妈住院了，押金差一点……能借我三千吗？下个月一定还。」", textEn: "11 pm. Ah Wei, your childhood friend, calls: “Mum's in hospital and I'm short on the deposit… could you lend me 3,000? I'll pay you back next month.”", choices: [
        C("借他 3000", "Lend him 3,000", "你转了过去。他回了一串「谢谢兄弟」。", "You transfer it. He sends a string of thank-yous.", { money: -3000 }, "lent"),
        C("借 1000，多了真没有", "Lend 1,000 — that's all you have", "「够了够了，我再找别人凑。」", "“That's plenty, I'll ask around for the rest.”", { money: -1000 }, "half"),
        C("婉拒", "Say no gently", "你说最近手头也紧。挂了电话，你盯着天花板很久。", "You say money's tight. After the call you stare at the ceiling for a long time.", { mood: -4 }, "no"),
      ] }),
      (f) => has(f, "no")
        ? { zh: "朋友圈", en: "A post on WeChat Moments", textZh: "阿伟发了朋友圈：「妈妈出院了，谢谢所有帮过我们的人。」配图是病床边的一碗粥。", textEn: "Ah Wei posts: “Mum's out of hospital. Thank you to everyone who helped.” A photo of congee by the hospital bed.", choices: [
          C("点个赞", "Like it", "你点了个赞。", "You like it.", {}),
          C("转 200 块红包：给阿姨买点水果", "Send a ¥200 red packet for fruit", "阿伟回：「你有心了。」", "Ah Wei: “That's kind of you.”", { money: -200, mood: 3 }, "gift"),
        ] }
        : { zh: "还钱的日子到了", en: "Payback day comes", textZh: "说好的日子到了，阿伟发来消息：「工地老板拖工资，能不能再宽限两周？」", textEn: "The day comes. Ah Wei: “The site boss hasn't paid us — can you give me two more weeks?”", choices: [
          C("不急，先顾好阿姨", "No rush — look after your mum", "「你真是我兄弟。」", "“You're a real friend.”", { mood: 2 }, "patient"),
          C("每天提醒一次", "Remind him every day", "你每天发一句「在吗？」。他回得越来越慢。", "You send “you there?” every day. His replies get slower.", { mood: -3 }, "push"),
        ] },
    ],
    ending: (f) => has(f, "no")
      ? (has(f, "gift") ? { zh: "阿伟记得", en: "Ah Wei remembers", textZh: "过年回家，阿伟拎着两条腊肉来看你：「那两百块，我妈念叨了好久。」", textEn: "At New Year Ah Wei visits with cured pork: “Mum kept talking about that 200.”", fx: { mood: 8, network: 2 } } : { zh: "渐渐少联系了", en: "You drift apart", textZh: "后来你们很少联系。偶尔刷到他的朋友圈，你会停一下。", textEn: "You rarely talk now. When his posts come up, you pause for a moment.", fx: { mood: -2 } })
      : has(f, "push") ? { zh: "钱还了，人远了", en: "Paid back, but distant", textZh: "钱一分不少还了回来，附言只有两个字：「还你。」", textEn: "Every yuan comes back, with two words: “Paid. Bye.”", fx: { money: has(f, "half") ? 1000 : 3000, mood: -4 } }
        : { zh: "连本带利", en: "With interest", textZh: has(f, "half") ? "阿伟还了 1000，还寄来一箱老家的腊肠。" : "阿伟还了 3500：「多的五百是利息，别推。」还寄来一箱腊肠。", textEn: has(f, "half") ? "Ah Wei pays back 1,000 and sends a box of sausages from home." : "Ah Wei pays back 3,500: “The extra 500 is interest — don't argue.” Plus a box of sausages.", fx: { money: has(f, "half") ? 1000 : 3500, mood: 10, network: 1 } },
  },
  {
    id: "love", emoji: "💌", zh: "心动的人", en: "Someone you like",
    when: (c) => c.day >= 2,
    stages: [
      () => ({ zh: "加了微信", en: "A new WeChat contact", textZh: "上周组局认识的那个人加了你微信，发来一句：「上次你说的那家糖水铺，在哪呀？」", textEn: "Someone you met at a get-together last week adds you: “That dessert place you mentioned — where is it?”", choices: [
        C("「我周末带你去」", "“I'll take you this weekend”", "对方回了个「好呀 😊」。你盯着这个表情看了五分钟。", "“OK 😊”. You stare at that emoji for five minutes.", { mood: 8 }, "date"),
        C("发个定位过去", "Send the location", "「谢谢！」对话停在这里。你有点后悔。", "“Thanks!” The chat ends there. You regret it a little.", { mood: -2 }, "slow"),
      ] }),
      (f) => has(f, "slow")
        ? { zh: "又遇见了", en: "Bumping into them again", textZh: "地铁上又遇见了 TA。TA 笑着说：「糖水铺我去了，确实好吃。」", textEn: "On the metro, there they are. “I went to that dessert place — you were right.”", choices: [
          C("「下次一起？」", "“Together next time?”", "TA 点点头。到站了，你们挥手。", "They nod. Your stop; you wave.", { mood: 6 }, "date"),
          C("聊聊工作", "Talk about work", "你们聊了一路工作。下车时你想：刚才应该约的。", "You talk shop the whole way. Getting off, you think: should've asked.", { network: 1 }, "friend"),
        ] }
        : { zh: "第一次约会", en: "The first date", textZh: "周六晚上，你们吃完糖水，站在路口。去哪？", textEn: "Saturday night, desserts done, you stand at a crossing. Where next?", choices: [
          C("去海边散步", "A walk by the sea", "海风很大，你们聊到十二点，没注意时间。", "Strong sea breeze. You talk until midnight without noticing.", { mood: 10, energy: -6 }, "walk"),
          C("订一家好餐厅", "Book a nice restaurant", "灯光很好，菜很贵。TA 说：「其实路边摊也挺好的。」", "Nice lighting, expensive food. They say: “Honestly, street food is fine too.”", { money: -480, mood: 5 }, "fancy"),
        ] },
      (f) => has(f, "friend")
        ? { zh: "朋友也挺好", en: "Friends is good too", textZh: "TA 介绍你进了一个行业群：「这里有我认识的几个大佬。」", textEn: "They add you to an industry group: “A few big names I know are in here.”", choices: [C("谢谢！", "Thanks!", "群里第一天就有人私信你聊合作。", "On day one someone messages you about working together.", { network: 2 }, "friend")] }
        : { zh: "一个问题", en: "A question", textZh: "TA 突然问：「你会一直留在湾区吗？我不想再谈异地了。」", textEn: "Out of nowhere: “Are you staying in the Bay Area for good? I don't want long distance again.”", choices: [
          C("「会，我们一起」", "“Yes — together”", "TA 没说话，只是握住了你的手。", "They say nothing, just take your hand.", { mood: 10 }, "stay"),
          C("「我还不确定」", "“I'm not sure yet”", "「嗯，我懂。」TA 笑了笑，但有点勉强。", "“I get it.” A smile, a slightly forced one.", { mood: -4 }, "unsure"),
        ] },
    ],
    ending: (f) => has(f, "stay")
      ? { zh: "在一起了", en: "Together", textZh: "你们在一起了。周末一起买菜、做饭，在城中村的小房间里也觉得很满。", textEn: "You're together. Weekend markets and cooking — even a tiny room feels full.", fx: { mood: 20 } }
      : has(f, "friend") ? { zh: "很好的朋友", en: "A good friend", textZh: "你们成了很好的朋友。TA 后来帮你介绍了一份兼职。", textEn: "You became good friends. Later they introduced you to a side job.", fx: { money: 800, network: 1 } }
        : { zh: "擦肩而过", en: "Passing by", textZh: "TA 后来去了上海。偶尔点赞你的朋友圈。", textEn: "They moved to Shanghai. They still like your posts sometimes.", fx: { mood: -3, xp: 1 } },
  },
  {
    id: "layoff", emoji: "📉", zh: "公司要「优化」", en: "The company is “optimising”",
    when: (c) => c.wage && c.day >= 4,
    stages: [
      () => ({ zh: "传闻", en: "The rumour", textZh: "茶水间里有人小声说：「下周要裁 20%，名单已经定了。」整个下午没人说话。", textEn: "Whispers in the pantry: “20% cut next week — the list is done.” Nobody talks all afternoon.", choices: [
        C("偷偷更新简历", "Quietly update your CV", "你在厕所隔间里改了半小时简历。", "Half an hour editing your CV in a toilet cubicle.", { energy: -6, xp: 1 }, "prep"),
        C("这周加班表忠心", "Work late all week to look loyal", "你连续四天走在老板后面。", "Four nights in a row, you leave after the boss.", { energy: -14, mood: -4 }, "loyal"),
      ] }),
      (f) => has(f, "loyal")
        ? { zh: "你留下了", en: "You stayed", textZh: "名单出来了，没有你。但隔壁组走了一半，他们的活全转到了你手上。", textEn: "The list is out — you're not on it. But half the next team is gone, and their work lands on you.", choices: [
          C("认了，先干着", "Accept it for now", "你的待办列表从 12 条变成了 31 条。", "Your to-do list goes from 12 items to 31.", { energy: -8, xp: 2 }, "stay"),
          C("也开始投简历", "Start applying too", "晚上回家，你投出了第一份简历。", "That night you send your first application.", { energy: -4 }, "prep2"),
        ] }
        : { zh: "HR 找你", en: "HR wants a word", textZh: "周一上午，HR 把你叫进小会议室：「N+1，今天签字，明天不用来了。」", textEn: "Monday morning, HR, a small meeting room: “Statutory pay plus one month. Sign today; don't come in tomorrow.”", choices: [
          C("签", "Sign", "你签了字，抱着纸箱走出大楼。阳光很好。", "You sign and walk out with a cardboard box. It's a sunny day.", { mood: -6 }, "sign"),
          C("申请劳动仲裁，争 2N", "Go to arbitration for double", "你把劳动合同、工资条、打卡记录全打印了出来。", "You print out the contract, payslips and clock-in records.", { energy: -12 }, "fight"),
        ] },
    ],
    ending: (f) => has(f, "fight")
      ? { zh: "仲裁赢了", en: "You won at arbitration", textZh: "仲裁庭支持了你，公司按 2N 赔偿。你请帮过你的朋友吃了顿饭。", textEn: "The tribunal backed you — double compensation. You treat the friends who helped to dinner.", fx: { money: 9000, mood: 8 } }
      : has(f, "sign") ? (has(f, "prep") ? { zh: "无缝衔接", en: "Straight into the next job", textZh: "你拿着补偿金，两周后就入职了新公司，工资还涨了一点。幸好早就备好了简历。", textEn: "Two weeks later you start somewhere new, on slightly more pay. Good thing your CV was ready.", fx: { money: 6000, mood: 10, xp: 2 } } : { zh: "空窗期", en: "A gap", textZh: "补偿金到账了，但找工作花了一个多月。你学会了：简历要一直更新。", textEn: "The payout lands, but finding work takes over a month. Lesson: keep your CV current.", fx: { money: 6000, mood: -6, xp: 1 } })
        : has(f, "prep2") ? { zh: "跳槽", en: "Moving on", textZh: "你拿到了新 offer，涨薪 20%。离职那天，老板说：「其实我们很需要你。」", textEn: "A new offer, 20% more. On your last day the boss says: “We really need you, you know.”", fx: { money: 2000, mood: 12, network: 1 } }
          : { zh: "扛过去了", en: "You got through it", textZh: "你扛下了两个人的活。年底考评，你拿了个 A。", textEn: "You did two people's jobs. At year-end review, you get an A.", fx: { money: 1500, xp: 3, mood: -2 } },
  },
  {
    id: "parents", emoji: "👨‍👩‍👦", zh: "爸妈要来", en: "Your parents are coming",
    when: (c) => c.day >= 3,
    stages: [
      () => ({ zh: "妈妈的电话", en: "Mum calls", textZh: "妈妈打来电话：「我和你爸下周过来看看你，不用接，我们自己坐车。」", textEn: "Mum calls: “Your dad and I are coming next week. Don't pick us up, we'll take the train.”", choices: [
        C("「好啊，我带你们玩」", "“Great — I'll show you around”", "妈妈在电话那头笑出了声。", "You hear her laugh down the line.", { mood: 4 }, "host"),
        C("「最近太忙，下次吧」", "“Too busy right now — next time”", "「那好吧……你注意身体。」电话挂了，你有点难受。", "“Alright… look after yourself.” She hangs up. You feel bad.", { mood: -6 }, "later"),
      ] }),
      (f) => has(f, "later")
        ? { zh: "一个包裹", en: "A parcel", textZh: "快递到了：一箱腊肠、两罐辣椒酱，还有一张纸条：「别老吃外卖。」", textEn: "A parcel: sausages, two jars of chilli sauce, and a note: “Stop living on takeaway.”", choices: [
          C("打个视频电话", "Video-call them", "你爸在镜头后面假装没在听，其实一直在笑。", "Dad pretends not to listen behind the camera, but he's smiling.", { mood: 8 }, "call"),
        ] }
        : { zh: "带爸妈去哪", en: "Where to take them", textZh: "爸妈到了。你爸第一句话：「这楼真高。」你打算带他们去——", textEn: "They've arrived. Dad's first words: “Tall buildings.” You'll take them to—", choices: [
          C("世界之窗 + 吃顿好的", "Window of the World and a good meal", "你爸在埃菲尔铁塔下拍了二十张照片，每张姿势一样。", "Dad takes twenty photos under the Eiffel Tower, same pose every time.", { money: -500, mood: 12, energy: -10 }, "tour"),
          C("在家做顿饭", "Cook at home", "你妈一进厨房就开始收拾：「你这调料都过期了。」", "Mum walks into your kitchen and starts tidying: “These spices are expired.”", { money: -120, mood: 10 }, "cook"),
        ] },
    ],
    ending: (f) => has(f, "later")
      ? { zh: "下次一定", en: "Next time, for sure", textZh: "你在日历上写了：春节前请年假回家。", textEn: "You put it in your calendar: take leave before Spring Festival and go home.", fx: { mood: 4 } }
      : { zh: "你爸说", en: "Dad says", textZh: "送他们上车时，你爸拍了拍你的肩膀：「这城市挺好的。你也挺好的。」", textEn: "Seeing them off, Dad pats your shoulder: “Good city. You're doing well too.”", fx: { mood: 16 } },
  },
  {
    id: "roommate", emoji: "🎮", zh: "隔壁的室友", en: "The roommate next door",
    when: (c) => !c.ownFlat && c.day >= 2,
    stages: [
      () => ({ zh: "凌晨两点", en: "2 am", textZh: "凌晨两点，隔壁还在打游戏，键盘声和「冲冲冲」穿过薄墙。你明天八点要起。", textEn: "2 am. Next door is still gaming — keyboard clatter and shouting through the thin wall. You're up at eight.", choices: [
        C("去敲门沟通", "Knock and talk", "门开了，一个黑眼圈很重的年轻人：「啊，不好意思！」", "The door opens — a young guy with dark circles. “Oh, sorry!”", { energy: -3 }, "talk"),
        C("买副降噪耳塞", "Buy noise-cancelling earplugs", "耳塞很好用。但你还是有点烦。", "The earplugs work. You're still annoyed.", { money: -60, mood: -2 }, "plug"),
      ] }),
      (f) => has(f, "talk")
        ? { zh: "第二天", en: "The next day", textZh: "室友送来一杯奶茶：「昨天真抱歉。其实我上周被裁了，睡不着，就打游戏。」", textEn: "Your roommate brings you bubble tea. “Sorry about last night. I got laid off last week — can't sleep, so I game.”", choices: [
          C("帮他看看有没有内推机会", "See if you can refer him somewhere", "你把他的简历转给了几个朋友。", "You forward his CV to a few friends.", { network: 1, energy: -3 }, "help"),
          C("安慰两句", "Say something kind", "「会好的。」他点点头。", "“It'll get better.” He nods.", { mood: 2 }),
        ] }
        : { zh: "又多了一个人", en: "One more person", textZh: "室友的女朋友搬进来了。卫生间早上要排队了。", textEn: "His girlfriend moves in. Now there's a queue for the bathroom in the morning.", choices: [
          C("跟房东反映", "Tell the landlord", "房东说：「我跟他说说，水电费让他多分点。」", "The landlord: “I'll talk to him — he'll pay more of the bills.”", { money: 80 }, "landlord"),
          C("算了，早起十分钟", "Fine — get up ten minutes earlier", "你每天六点五十起床。", "You start getting up at 6:50.", { energy: -4 }),
        ] },
    ],
    ending: (f) => has(f, "help")
      ? { zh: "他找到工作了", en: "He found a job", textZh: "室友通过你朋友的内推拿到了 offer，请你吃了顿烤肉：「以后有事尽管找我。」", textEn: "Your roommate got an offer through your friend's referral. Barbecue's on him: “Anything you need, just ask.”", fx: { mood: 10, network: 2 } }
      : { zh: "合租的日常", en: "Shared-flat life", textZh: "合租就是这样，吵吵闹闹，也互相照应。", textEn: "That's sharing a flat: noisy, but people look out for each other.", fx: { mood: 3 } },
  },
];

export const arcById = (id: string) => LIFE_ARCS.find((a) => a.id === id) ?? null;
