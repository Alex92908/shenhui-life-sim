/* 用户协议 / 隐私政策 — Terms of Service and Privacy Policy, Chinese + English.

   A practical starting text written for this game's actual data flows (what
   the client stores, what the server keeps, who else is involved). It is not
   legal advice: before a public launch the operator should fill in the
   placeholders below and have it reviewed for the countries it launches in. */

/** Fill these in before launch. */
export const OPERATOR = {
  name: "[运营方名称 / Operator name]",
  contact: "[联系邮箱 / contact email]",
  updated: "2026-11-08",
};

export const LEGAL_VERSION = "2026-11-08";

export interface LegalDoc { title: string; sections: { h: string; p: string[] }[] }

export const TERMS: Record<"zh" | "en", LegalDoc> = {
  zh: {
    title: "用户协议",
    sections: [
      { h: "1. 服务说明", p: [`《深惠人生模拟》（下称「本游戏」）由 ${OPERATOR.name} 运营，是一款免费的网页生活模拟游戏。使用本游戏即表示你同意本协议和《隐私政策》。`] },
      { h: "2. 虚构内容声明", p: [
        "游戏中的公司（如「某讯」「某为」「某音」等）、峰会活动（「湾区国际峰会」）、人物和剧情均为虚构，与任何真实企业、组织、活动或个人无关，不代表其立场。",
        "地图上的地铁站、公园、医院等真实地点数据来自 OpenStreetMap（© OpenStreetMap contributors，ODbL 许可），可能不准确或已过时。医院、药店、派出所等信息仅供参考，紧急情况请直接拨打 120 / 110。",
      ] },
      { h: "3. 账号与存档", p: [
        "本游戏不需要注册。你的浏览器会生成一个随机玩家编号作为身份；「云存档码」用于在其他设备恢复进度，请妥善保管，不要发给他人——拿到存档码的人可以读取你的存档。",
        "游戏内的金钱、物品、称号等均为虚拟数据，没有现实价值，不能兑换、转让或提现。",
      ] },
      { h: "4. 行为规范", p: [
        "在昵称、聊天、动态和送礼中，不得发布违法、色情、暴力、仇恨、骚扰、诈骗、广告或侵犯他人权利的内容，不得冒充他人或运营方。",
        "不得使用外挂、脚本、修改存档或攻击服务器等方式破坏公平。系统会自动过滤部分不当文字、限制发言频率，并将数据异常的玩家移出排行榜。",
        "违反规范的，运营方可删除相关内容、限制或停止提供服务。",
      ] },
      { h: "5. 服务变更与免责", p: [
        "本游戏按「现状」提供，可能随时调整玩法、清理数据或中止服务。在法律允许的范围内，运营方不对因使用本游戏产生的间接损失负责。",
      ] },
      { h: "6. 未成年人", p: ["未满 14 周岁的用户请在监护人陪同和同意下使用，并合理安排游戏时间。"] },
      { h: "7. 联系我们", p: [`如有问题或举报，请联系：${OPERATOR.contact}。本协议更新日期：${OPERATOR.updated}。`] },
    ],
  },
  en: {
    title: "Terms of Service",
    sections: [
      { h: "1. The service", p: [`"Shenzhen–Huizhou Life Sim" (the "Game") is a free browser-based life simulation operated by ${OPERATOR.name}. By using the Game you agree to these Terms and the Privacy Policy.`] },
      { h: "2. Fiction disclaimer", p: [
        "Companies in the Game (e.g. \"Xun Tech\", \"Wei Tech\", \"Yin Group\"), the \"Bay Area International Summit\", characters and storylines are fictional and are not affiliated with or endorsed by any real company, organisation, event or person.",
        "Real-world map data (metro stations, parks, hospitals, etc.) comes from OpenStreetMap (© OpenStreetMap contributors, ODbL) and may be inaccurate or out of date. Hospital, pharmacy and police information is for reference only — in an emergency in China call 120 (ambulance) or 110 (police).",
      ] },
      { h: "3. Accounts and saves", p: [
        "No sign-up is needed. Your browser creates a random player ID. Your \"cloud save code\" restores your progress on another device — keep it private; anyone with the code can read your save.",
        "In-game money, items and titles are virtual, have no real-world value and cannot be exchanged, transferred or cashed out.",
      ] },
      { h: "4. Conduct", p: [
        "Do not post illegal, sexual, violent, hateful, harassing, fraudulent, advertising or infringing content in nicknames, chat, the feed or gifts, and do not impersonate others or the operator.",
        "Do not use cheats, scripts, save editing or attacks on the server. The Game automatically filters some inappropriate text, rate-limits messages and removes players with implausible stats from leaderboards.",
        "The operator may remove content and restrict or end access for violations.",
      ] },
      { h: "5. Changes and liability", p: ["The Game is provided \"as is\" and may change, reset data or shut down at any time. To the extent permitted by law the operator is not liable for indirect losses arising from its use."] },
      { h: "6. Minors", p: ["Players under 14 should play with a parent or guardian's consent and supervision."] },
      { h: "7. Contact", p: [`Questions or reports: ${OPERATOR.contact}. Last updated ${OPERATOR.updated}.`] },
    ],
  },
};

export const PRIVACY: Record<"zh" | "en", LegalDoc> = {
  zh: {
    title: "隐私政策",
    sections: [
      { h: "1. 我们收集什么", p: [
        "你填写的昵称和选择的头像；浏览器生成的随机玩家编号；游戏进度（存款、职级、所在地点、天数、站章、成就等）；你主动发送的聊天、动态和礼物。",
        "为了限流和防攻击，服务器会临时记录请求来源 IP；服务器日志可能包含 IP 和访问时间。",
        "我们不收集你的真实姓名、手机号、邮箱、定位或通讯录，也不使用广告追踪。",
      ] },
      { h: "2. 存在哪里", p: [
        "存档和长线进度保存在你自己的浏览器（localStorage）里；开启云存档后，会同时保存一份到游戏服务器，用你的存档码保护。",
        "昵称、在线状态、排行数据、聊天、动态和礼物保存在游戏服务器，并会被其他玩家看到（以公开编号显示，不显示你的私有玩家编号）。",
      ] },
      { h: "3. 用来做什么", p: ["仅用于运行游戏：多人在线、聊天、排行榜、送礼、云存档、防作弊和防滥用。不出售、不出租你的数据。"] },
      { h: "4. 第三方", p: [
        "真实天气由服务器向 Open-Meteo 查询城市天气，只发送城市坐标，不包含你的任何信息。地图数据来自 OpenStreetMap，随游戏一起打包，不会向其请求你的数据。",
        "如果游戏部署在第三方云服务商上，数据会存放在该服务商的服务器中。",
      ] },
      { h: "5. 保存多久、怎么删除", p: [
        "聊天和动态可能长期保留以便展示；你可以随时清除浏览器数据删除本地存档。",
        `如需删除服务器上的昵称、进度、聊天和云存档，请把你的存档码发到 ${OPERATOR.contact}，我们会在 15 个工作日内处理。`,
      ] },
      { h: "6. 未成年人", p: ["本游戏不面向未满 14 周岁的儿童单独使用；监护人如发现孩子提交了信息，可联系我们删除。"] },
      { h: "7. 变更与联系", p: [`政策更新会在游戏内提示。联系：${OPERATOR.contact}。更新日期：${OPERATOR.updated}。`] },
    ],
  },
  en: {
    title: "Privacy Policy",
    sections: [
      { h: "1. What we collect", p: [
        "The nickname and avatar you choose; a random player ID created by your browser; game progress (money, rank, location in the game, day, stamps, achievements…); chat messages, feed posts and gifts you send.",
        "To rate-limit and block abuse the server briefly keeps the requesting IP address; server logs may include IP addresses and timestamps.",
        "We do not collect your real name, phone number, email, location or contacts, and we use no advertising trackers.",
      ] },
      { h: "2. Where it is stored", p: [
        "Your save and long-term progress live in your own browser (localStorage). With cloud save on, a copy is also kept on the game server, protected by your save code.",
        "Nicknames, online status, leaderboard data, chat, feed posts and gifts are stored on the game server and are visible to other players (under a public ID — never your private player ID).",
      ] },
      { h: "3. How it is used", p: ["Only to run the Game: multiplayer presence, chat, leaderboards, gifts, cloud save, anti-cheat and anti-abuse. We do not sell or rent your data."] },
      { h: "4. Third parties", p: [
        "Live weather is fetched by the server from Open-Meteo using city coordinates only — nothing about you is sent. Map data from OpenStreetMap is bundled with the Game; no request about you is made to it.",
        "If the Game is hosted on a cloud provider, data is stored on that provider's servers.",
      ] },
      { h: "5. Retention and deletion", p: [
        "Chat and feed posts may be kept for display. You can delete your local save any time by clearing browser data.",
        `To delete your nickname, progress, chat and cloud save from the server, send your save code to ${OPERATOR.contact}; we will act within 15 business days. EU/UK users may also request access, correction or deletion under the GDPR.`,
      ] },
      { h: "6. Children", p: ["The Game is not intended for unsupervised use by children under 14. Parents who believe their child submitted data can contact us for deletion."] },
      { h: "7. Changes and contact", p: [`Updates are announced in the Game. Contact: ${OPERATOR.contact}. Last updated ${OPERATOR.updated}.`] },
    ],
  },
};
