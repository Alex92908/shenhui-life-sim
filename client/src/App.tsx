import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { loadMeta, saveMeta, touchStreak, streakReward, bump, rollWeek, checkAchievements, dailyEvent, dateKey, ACHIEVEMENTS, WEEKLY_GOALS, type Meta, type CityEvent } from "./meta";
import { api, type ApiResponse } from "./api";
import { AREA_LABELS } from "./areas";
import { AccountModal, accountToken } from "./Account";
import { StoreModal, LOOK_COLOR, LOOK_TITLE } from "./Store";
import { UpdatesModal, BondsModal, CommitteeModal, GigsModal, BillboardModal, BOND_INFO, PLEDGE_INFO, policyMul, LATEST_UPDATE, type BondKind } from "./Social";
const lookOf = (b: object): string | null => storeLook((b as { look?: string | null }).look ?? null);
import { TERMS, PRIVACY, LEGAL_VERSION, OPERATOR_MISSING } from "./legal";
import { ACCESSORIES, HAIRS, CAR_PRICE, KID_NAMES, PLOT_PRICE, clamp100, furnUse, accessoryFromLook, hairFromLook, npcHome, plotWorth, storeLook } from "./living";
import { listedRent, mapAds, sanhePay, sanheSay } from "./ads";
import { getLang, setLangStored, installTranslator, LANGS, trText, type Lang } from "./i18n";
import { cloudCode, newCloudCode, setCloudCode, prettyCode, liteDefault, setQuality, readInvite, inviteLink, clearInviteParams, drawShareCard } from "./share";
import {
APPS, CAREERS, COMPANIES, companyAt, companyById, companyGaps, employerHere, type Company, CITIES, FOODS, FURNITURE, IDENTITIES, NPCS, npcsForCity, OFFERS, TEMPLATES,
apecPhase, apecVenueMul, getLocations, isApecWeek, isSaturday, tplQuote, setSeason, isApecSeason,
APEC_TASKS, apecTaskOfDay, APEC_SLOGAN, APEC_CERT_NAME,
weatherOf, weekday, modesForCity, railWord, etaMinutes, modeById, SCENIC_SPOTS, scenicOf, taxiFare, busFare, bikeFare, driveFare, parkingFee,
curSym, fmtMoney, crossFareLabel,
findMetroRoute, findStationRoute, exitLocForStation, resolveLoc, partialFare, nearbyPlaces, nearbyServices, placesForCity, PLACE_KINDS, type MetroLine, planRailTrip, allMetroDestinations, linesForLoc, metroLinesForCity, crowdForRide, motoFare,
RESTAURANTS, DELIVERY_PLATFORMS, SHOP_VENUES, LODGINGS, rentFlatWeekly, OUTFITS, outfitOf, isRainy, HOME_ROOMS,
LOC_EN, LOC_GRADE, CITY_INTRO,
type AppId, type CityKey, type Loc, type TransportModeId, type MetroRoute,
crossRoutes, isCrossOpen, crossHoursStr, crossFareStr, crossName, crossNote, CROSS_ROUTES, type CrossRoute, areaLocId, stationLocId, billboardSpots
} from "./data";
import { pickEvent, type GameEvent } from "./events";
import { LIFE_ARCS, arcById, type ArcProg, type ArcFx } from "./arcs";
import {
generateDailyPosts, authorReply, chatReply, greetLine, hashStr, memOf, relLabel, moodEmoji, moodWord, personaOf, scheduleOf,
type ChatAction, type MemMap, type NpcPost, type PlayerNews,
} from "./npc";
import { MapView } from "./MapView";
import { setSound, soundWanted, wakeSound, setScene, setWorld, sfx, musicPick, setMusicPick, nowPlayingCredit, MUSIC_PICKS, MUSIC_CREDITS, EXTRA_CREDITS, setKaraokeLang, playFerryHorn, type SoundScene, type MusicPick, type PlaceTone, type TravelTone, type SceneSfxId } from "./sound";
import { npcAllowedAt, type LocType, type VenueSetId, type AnimKindId } from "./data";
import { vendorSellFor } from "./routines";
/* ---- round-2 feature modules (see ROUND2-LOG-*.md for the integration snippets) ---- */
import { venueSetFor, animFor } from "./round2/venues";
import { adoptPet, interactWithPet, homecomingGreeting, tickPetDay, PET_STORAGE_KEY, serializePets, deserializePets, type PetsState, type InteractionKind } from "./round2/pets";
import { buildNotice, feedStrayLocal, strayToAdoptInput, validateNotice, validateSnakeReport, validateFishingSpot } from "./round2/community";
import { emptyEconomyState, economyDailyTick, buyUsedFurniture as buyUsedFurnitureLocal, buyCheapGood as buyCheapGoodLocal, resellUsedFurniture as resellUsedFurnitureLocal, postSubletListing, acceptSublet as acceptSubletLocal, postTradeTask as postTradeTaskLocal, searchTradeTasks, acceptTradeTask as acceptTradeTaskLocal, escrowTradeTask as escrowTradeTaskLocal, completeTradeTask as completeTradeTaskLocal, cancelTradeTask as cancelTradeTaskLocal, disputeTradeTask as disputeTradeTaskLocal, OVERSEAS_CATALOG, placeOverseasOrder as placeOverseasOrderLocal, payOverseasDuty as payOverseasDutyLocal, USED_FURNITURE, TRADE_TASK_EXAMPLES, type EconomyState, type TradeTask, type TradeTaskKind, type PlayerRef } from "./round2/economy";
import { asReportTransport, buildRentEvidence, buildWageEvidence, canFile, validateDraft, reputationWarning, applyLandlordVerdict, applyEmployerVerdict, applyFalseReportPenalty, applyTrueReportGain, exposureLine, jurySummary, SUGGESTED_CHARGES, ReportBook, type ReportDraft, type BlackReport, type LandlordRemedy, type EmployerRemedy } from "./round2/report";
import { defaultLifestyleState, sanitizeLifestyleState, type LifestyleState, type PlayerProfile, SANHE_SHIFTS, SANHE_SLEEP, SANHE_EATS, SANHE_MATES, takeSanheShift, sanheSleep, sanheEat, chatMate, SMALL_JOYS, doSmallJoy, encouragementFor, checkinDue, doCheckin, RENT_TALKS, negotiateRent, SECONDHAND_FLOOR, sellSecondHand, subletBunk, openStall, STALL_KINDS, JOB_CENTER_TABS, COURSES, INTERVIEW_QUESTIONS, listingsFor, applyForJob, bookGuidance, suggestRoute, enrollCourse, courseDayTick, mockInterview, startTrial, trialWorkDay, resolveTrial, flatDays, flatStatusLine, isJobCenterPlace, REAL_HELP, type LifeResult } from "./round2/lifestyles";
import { advanceOrder, cancelOrder, courierTodaySummary, deliveryMenu, eatDelivered, emptyDeliveryState, generateCourierBoard, isDeliveryState, placeOrder, poolOrderToGig, poolPayloadFor, pushOrder, updateOrder, activeOrder, acceptGig, pickupGig, deliverGig, cancelGig, fmtDeliveryCountdown, MEMBERSHIP_PRICE, MEMBERSHIP_DAYS, membershipActive, type CourierGig, type CustomerOrder, type DeliveryState, type MenuItem } from "./round2/delivery";
import { emptyHouseLayout, loadHouseLayout, saveHouseLayout, validateHouseLayout, houseLayoutToPlacedFurn, HOUSE_FURN_CATALOG, HOUSE_ROOM_KINDS, addHouseRoom, placeHouseFurniture, removeHousePiece, type HouseLayout } from "./round2/house";
import { startPatrol, stopPatrol, observe, isWatched, isGameAvatarId } from "./round2/police";
import { togglePhoneFullscreen } from "./round2/phone";
import { voiceMode, setVoiceMode, VOICE_MODES, playNpcVoice } from "./round2/sounds";
import { momentsAt, inBest, seawardAz, SCENIC_MOMENTS, type ScenicMoment } from "./scenic";
import { LivehouseModal } from "./Livehouse";
import { drawOrigin, originById, tierOfIden, tierNow, TIERS, climbVerdict, randomNick, ORIGINS, type Origin } from "./origin";
import { MetroMapModal } from "./MetroMap";
import { PlacesMapModal } from "./PlacesMap";
import { LifeStage3D, FURN_SLOTS, type LifeSet, type LifePose } from "./LifeStage";


/* 店里的人物互动：点一下，店员 / 熟人走过来跟你说话，角色换动作；
   心情、人脉奖励每天每项一次，花钱的每次都花 */
interface VenueTalk { open?: "live"; id: string; emoji: string; zh: string; en: string; who: string; whoEn: string; say: string; sayEn: string; pose: LifePose; partner?: [number, number]; money?: number; mood?: number; energy?: number; hunger?: number; network?: number; xp?: number }
const VENUE_TALK: Partial<Record<LifeSet, VenueTalk[]>> = {
  restaurant: [
    { id: "order", emoji: "🍚", zh: "点一份猪脚饭", en: "Order trotter rice", who: "老板娘", whoEn: "The owner", say: "「靓仔/靓女，加个卤蛋？今日猪脚好靓。」", sayEn: "“Add a braised egg? The trotters are lovely today.”", pose: "eat", partner: [0xf3ead8, 0x4a3226], money: -25, energy: 14, mood: 4 },
    { id: "chat", emoji: "💬", zh: "跟老板娘聊两句", en: "Chat with the owner", who: "老板娘", whoEn: "The owner", say: "「我在这条街开了十二年店，楼都拆了两轮了。」", sayEn: "“Twelve years on this street. They've rebuilt the block twice.”", pose: "talk", partner: [0xf3ead8, 0x4a3226], mood: 5, network: 1 },
    { id: "share", emoji: "🪑", zh: "跟陌生人拼桌", en: "Share a table with a stranger", who: "拼桌的大哥", whoEn: "A man at your table", say: "「你也是外地来的吧？我湖南的，来深圳第八年了。」", sayEn: "“Not from here either? I'm from Hunan — eighth year in Shenzhen.”", pose: "eat", partner: [0x3b82f6, 0x2b2b33], mood: 6, network: 1 },
    { id: "toilet", emoji: "🚻", zh: "去洗手间", en: "Use the restroom", who: "自己", whoEn: "You", say: "「好了。」", sayEn: "“That's better.”", pose: "idle" },
  ],
  mall: [
    { id: "try", emoji: "👗", zh: "试一件衣服", en: "Try something on", who: "店员", whoEn: "Shop assistant", say: "「这件很衬你，今天满 300 减 50。」", sayEn: "“That suits you — ¥50 off over ¥300 today.”", pose: "talk", partner: [0x111827, 0x111827], mood: 5 },
    { id: "milktea", emoji: "🧋", zh: "排队买杯奶茶", en: "Queue for bubble tea", who: "奶茶店员", whoEn: "Tea shop staff", say: "「三分糖去冰，前面还有 23 杯哦。」", sayEn: "“30% sugar, no ice — 23 cups ahead of you.”", pose: "idle", partner: [0xec4899, 0x1f2937], money: -18, mood: 6, energy: 4 },
    { id: "toilet", emoji: "🚻", zh: "去洗手间", en: "Use the restroom", who: "自己", whoEn: "You", say: "「好了。」", sayEn: "“That's better.”", pose: "idle" },
  ],
  market: [
    { id: "haggle", emoji: "🥬", zh: "跟菜档阿姨讲价", en: "Haggle at the veg stall", who: "菜档阿姨", whoEn: "Veg stall auntie", say: "「两块五一斤啦，送你一把葱，下次再来！」", sayEn: "“¥2.50 a jin — have some spring onions free, come again!”", pose: "talk", partner: [0x65a30d, 0x374151], money: -12, mood: 5 },
    { id: "fish", emoji: "🐟", zh: "让鱼档老板挑条鱼", en: "Let the fishmonger pick a fish", who: "鱼档老板", whoEn: "The fishmonger", say: "「这条鲈鱼早上刚到，蒸八分钟，包你鲜。」", sayEn: "“This sea bass came in this morning — steam it eight minutes.”", pose: "talk", partner: [0x0ea5e9, 0x1f2937], money: -30, mood: 3, xp: 1 },
  ],
  electronics: [
    { id: "check", emoji: "📱", zh: "让档口老板验一部二手手机", en: "Have the stall owner check a used phone", who: "档口老板", whoEn: "The stall owner", say: "「电池健康 87%，面容能用。当场过机，不靠谱你别拿。」", sayEn: "“Battery health 87%, Face ID works. Check it here — don't take it if it isn't right.”", pose: "talk", partner: [0x0e7490, 0x1f2937], money: -80, mood: 4 },
    { id: "parts", emoji: "🔌", zh: "配一套装机配件", en: "Pick parts for a build", who: "档口老板", whoEn: "The stall owner", say: "「内存和固态我给你配兼容的。装不好，你拿回来。」", sayEn: "“I'll match the RAM and the SSD. If it doesn't fit, bring it back.”", pose: "talk", partner: [0x0e7490, 0x1f2937], money: -120, xp: 1, mood: 3 },
  ],
  office: [
    { id: "coffee", emoji: "☕", zh: "茶水间跟同事聊天", en: "Chat in the pantry", who: "同事", whoEn: "A colleague", say: "「听说下个月要调整架构……你那边有消息吗？」", sayEn: "“Heard there's a reorg next month… heard anything?”", pose: "talk", partner: [0x6366f1, 0x374151], mood: 3, network: 1 },
    { id: "ask", emoji: "🙋", zh: "请教前辈一个问题", en: "Ask a senior for advice", who: "前辈", whoEn: "A senior colleague", say: "「别急着做完，先想清楚谁来验收。」", sayEn: "“Don't rush to finish — first work out who signs it off.”", pose: "talk", partner: [0x1f2937, 0x374151], xp: 2, network: 1 },
    { id: "toilet", emoji: "🚻", zh: "去洗手间", en: "Use the restroom", who: "自己", whoEn: "You", say: "「好了。」", sayEn: "“That's better.”", pose: "idle" },
  ],
  gym: [
    { id: "coach", emoji: "🏋️", zh: "让教练看看动作", en: "Ask the coach to check your form", who: "教练", whoEn: "The coach", say: "「核心收紧，背打直——对，就这样。办个私教课？」", sayEn: "“Brace your core, back straight — that's it. Fancy a PT package?”", pose: "lift", partner: [0xef4444, 0x111827], energy: -6, mood: 5 },
    { id: "spot", emoji: "🤝", zh: "帮别人保护一组", en: "Spot someone's set", who: "健身的小哥", whoEn: "A gym regular", say: "「谢了兄弟！下次我帮你。」", sayEn: "“Cheers! I'll spot you next time.”", pose: "talk", partner: [0x0ea5e9, 0x111827], mood: 4, network: 1 },
  ],
  club: [
    { id: "sing", emoji: "🎤", zh: "上台点一首歌唱", en: "Get up and sing one", who: "台下的人", whoEn: "The crowd", say: "「再来一首！再来一首！」", sayEn: "“Encore! Encore!”", pose: "sing", money: -30, energy: -6, mood: 14 },
    { id: "live", open: "live", emoji: "🎧", zh: "听全城正在放的原创歌", en: "Hear the original playing citywide", who: "DJ", whoEn: "The DJ", say: "「下一首，是我们城里音乐人自己写的。」", sayEn: "“Next up — a song by one of our own musicians.”", pose: "idle" },
    { id: "dance", emoji: "🕺", zh: "挤到台前跟着跳", en: "Dance up front", who: "主唱", whoEn: "The singer", say: "「深圳的朋友们，手举起来！」", sayEn: "“Shenzhen, hands up!”", pose: "dance", energy: -8, mood: 12 },
    { id: "drink", emoji: "🍹", zh: "吧台点一杯", en: "Get a drink at the bar", who: "调酒师", whoEn: "The bartender", say: "「今晚乐队是自己写歌的，第三首最好听。」", sayEn: "“The band write their own songs — the third one's the best.”", pose: "talk", partner: [0x0ea5e9, 0x111827], money: -68, mood: 8 },
    { id: "friend", emoji: "🙌", zh: "跟旁边的人聊乐队", en: "Talk to someone about the band", who: "旁边的乐迷", whoEn: "A fan next to you", say: "「我追了他们三年，从二十个人看到现在满场。」", sayEn: "“Followed them three years — from twenty people to a full house.”", pose: "talk", partner: [0xf59e0b, 0x1f2937], mood: 6, network: 2 },
  ],
  clinic: [
    { id: "see", emoji: "🩺", zh: "挂个号看看", en: "See a doctor", who: "医生", whoEn: "The doctor", say: "「最近熬夜多吧？少喝冰的，早点睡。」", sayEn: "“Late nights lately? Fewer iced drinks, sleep earlier.”", pose: "talk", partner: [0xffffff, 0x1e3a8a], money: -60, energy: 10, mood: 4 },
    { id: "nurse", emoji: "💉", zh: "问护士怎么报医保", en: "Ask the nurse about insurance", who: "护士", whoEn: "The nurse", say: "「社保卡绑定了吗？门诊统筹能报一半。」", sayEn: "“Linked your social security card? Outpatient cover pays half.”", pose: "talk", partner: [0xf9a8d4, 0xffffff], xp: 1, mood: 2 },
  ],
  classroom: [
    { id: "class", emoji: "📖", zh: "坐下来听一节课", en: "Sit in on a class", who: "老师", whoEn: "The teacher", say: "「今天讲的这个，下个月考证一定考。」", sayEn: "“What we cover today is definitely on next month's exam.”", pose: "type", partner: [0x7c3aed, 0x374151], energy: -6, xp: 3 },
    { id: "classmate", emoji: "🤝", zh: "跟同学加个微信", en: "Swap WeChat with a classmate", who: "同学", whoEn: "A classmate", say: "「我在前海做跨境电商，有机会一起搞点事？」", sayEn: "“I do cross-border e-commerce in Qianhai — let's do something together sometime?”", pose: "talk", partner: [0x10b981, 0x1f2937], network: 2, mood: 3 },
  ],
  bedroom: [
    { id: "desk", emoji: "🛎️", zh: "问前台附近哪里好吃", en: "Ask the front desk where to eat", who: "前台", whoEn: "The receptionist", say: "「出门右转第二个路口，那家砂锅粥开到凌晨。」", sayEn: "“Right out the door, second corner — that claypot congee is open till late.”", pose: "talk", partner: [0x1f2937, 0x1f2937], mood: 4 },
  ],
  concourse: [
    { id: "toilet", emoji: "🚻", zh: "去洗手间", en: "Use the restroom", who: "自己", whoEn: "You", say: "「好了。」", sayEn: "“That's better.”", pose: "idle" },
    { id: "wait", emoji: "🪑", zh: "在大厅坐一会儿", en: "Sit in the hall", who: "自己", whoEn: "You", say: "「下一班还早，先坐着。」", sayEn: "“The next one isn't for a while.”", pose: "sit", mood: 3 },
    { id: "water", emoji: "🧴", zh: "便利店买瓶水", en: "Buy a bottle of water", who: "店员", whoEn: "The clerk", say: "「冰的热的？扫码。」", sayEn: "“Cold or hot? Scan here.”", pose: "talk", partner: [0x0ea5e9, 0x1f2937], money: -6, mood: 2 },
  ],
  park: [
    { id: "bench", emoji: "🪑", zh: "在长椅上坐一会儿", en: "Sit on the bench", who: "自己", whoEn: "You", say: "「风过来了。」", sayEn: "“Here comes the wind.”", pose: "sit", mood: 6 },
    { id: "stroll", emoji: "🚶", zh: "沿着园路走一圈", en: "Walk the path", who: "自己", whoEn: "You", say: "「慢慢走，不赶。」", sayEn: "“No rush.”", pose: "idle", mood: 8, energy: -4 },
    { id: "photo", emoji: "📸", zh: "在树下拍一张", en: "Take a photo under the trees", who: "自己", whoEn: "You", say: "「这张能发。」", sayEn: "“This one's worth posting.”", pose: "idle", mood: 6 },
  ],
  beach: [
    { id: "waves", emoji: "🌊", zh: "踩进浪里", en: "Step into the wash", who: "自己", whoEn: "You", say: "「凉的，一下就醒了。」", sayEn: "“Cold. That woke you up.”", pose: "idle", mood: 10 },
    { id: "shade", emoji: "⛱️", zh: "在伞下歇一会儿", en: "Sit in the shade", who: "自己", whoEn: "You", say: "「听着浪就行。」", sayEn: "“Just the waves.”", pose: "sit", mood: 6 },
  ],
  hike: [
    { id: "climb", emoji: "🥾", zh: "再往上走一截", en: "Climb a bit further", who: "自己", whoEn: "You", say: "「腿酸，风倒是干净。」", sayEn: "“Legs burn. The air is clean.”", pose: "idle", mood: 8, energy: -6 },
    { id: "view", emoji: "🏙️", zh: "停下来看一眼城", en: "Stop and look at the city", who: "自己", whoEn: "You", say: "「楼下那些灯，都是别人的班。」", sayEn: "“Those lights are other people's shifts.”", pose: "idle", mood: 8 },
  ],
  /* ---- round-2 (b+g): walk-in dialogue for the new venue sets.
     Spot ids MUST match ROAM_SPOTS in LifeStage (they do — same ids).
     Reconciliation note (see ROUND2-LOG-int.md): area (b)'s venueSet names
     cycle/gallery/nature/wetland have no LifeSet, so venueFor maps them
     cycle→bikehub, gallery→museum, nature→park, wetland→farm; the talk
     entries below are keyed by the LifeSet names. Where (b) and (g) gave
     different ids for the same spot, the ROAM_SPOTS id wins (g's copy for
     the 8 market/museum/library/factory sets; b's copy for the scenic sets
     where it matches). ---- */
  oilpainting: [
    { id: "buy", emoji: "🖼️", zh: "买幅画挂家里", en: "Buy a painting for home", who: "画廊老板", whoEn: "The gallery owner", say: "「这幅是临摹的梵高，挂出租屋里，整个屋子都亮了。」", sayEn: "“This one's after Van Gogh — hang it in your flat and the whole room lights up.”", pose: "talk", partner: [0x7c3aed, 0x1f2937], money: -120, mood: 8 },
    { id: "paint", emoji: "🎨", zh: "看画家作画", en: "Watch the painter", who: "画家", whoEn: "The painter", say: "「画画就是一笔一笔熬出来的，跟你们写代码一样。」", sayEn: "“Painting is one stroke at a time — like your code.”", pose: "talk", partner: [0xe8e2d4, 0x374151], mood: 5, xp: 1 },
    { id: "frame", emoji: "🪟", zh: "装裱一幅画", en: "Frame a painting", who: "装裱师傅", whoEn: "The framer", say: "「这框一配，画立刻贵三成。」", sayEn: "“A good frame and the painting's worth 30% more.”", pose: "talk", partner: [0x7c3aed, 0x1f2937], money: -40, mood: 3 },
  ],
  secondhand: [
    { id: "browse", emoji: "📻", zh: "淘淘旧货", en: "Browse the old goods", who: "摊主", whoEn: "The stall owner", say: "「这收音机还能响，三十块拿走。」", sayEn: "“This radio still plays — ¥30, take it.”", pose: "talk", partner: [0x78716c, 0x2f333a], money: -30, mood: 5 },
    { id: "haggle", emoji: "💬", zh: "跟摊主讲价", en: "Haggle", who: "摊主", whoEn: "The stall owner", say: "「最低二十五，再低我亏本了。」", sayEn: "“¥25, lowest — any less and I lose money.”", pose: "talk", partner: [0x78716c, 0x2f333a], money: -12, mood: 5 },
  ],
  seafood: [
    { id: "buy", emoji: "🦐", zh: "挑点海鲜", en: "Pick some seafood", who: "海鲜档老板", whoEn: "The seafood seller", say: "「这虾刚上岸，活蹦乱跳的，称给你。」", sayEn: "“These shrimp just came ashore — still jumping.”", pose: "talk", partner: [0x0e7490, 0x1f2937], money: -45, mood: 4 },
    { id: "eat", emoji: "🍲", zh: "大排档代加工", en: "Have it cooked at the dai pai dong", who: "大排档老板", whoEn: "The dai pai dong cook", say: "「清蒸还是椒盐？坐下等十分钟。」", sayEn: "“Steamed or salt-and-pepper? Sit down, ten minutes.”", pose: "eat", partner: [0x7a9a4d, 0x44403c], money: -35, hunger: 28, mood: 6 },
    { id: "boat", emoji: "⛵", zh: "跟渔民出海", en: "Go out with a fisherman", who: "渔民阿海", whoEn: "Ah Hai the fisherman", say: "「明早五点码头见，晕船可别怪我。」", sayEn: "“Five tomorrow at the pier — don't blame me if you're seasick.”", pose: "talk", partner: [0x0e7490, 0x1f2937], mood: 6, network: 1 },
  ],
  oldtown: [
    { id: "snack", emoji: "🍢", zh: "吃客家小吃", en: "Try a Hakka snack", who: "小吃档老板", whoEn: "The snack seller", say: "「酿豆腐现做的，趁热吃。」", sayEn: "“Stuffed tofu, fresh — eat it hot.”", pose: "eat", partner: [0x7a9a4d, 0x44403c], money: -15, hunger: 18, mood: 5 },
    { id: "stroll", emoji: "🚶", zh: "逛逛骑楼老街", en: "Walk the old street", who: "自己", whoEn: "You", say: "「这条街比我爷爷年纪还大。」", sayEn: "“This street is older than my grandad.”", pose: "idle", mood: 6 },
  ],
  womensstreet: [
    { id: "clothes", emoji: "👗", zh: "淘件衣服", en: "Browse the clothes", who: "服装档老板", whoEn: "The clothes seller", say: "「这件卖得最好，穿上身看看。」", sayEn: "“This one's our bestseller — try it on.”", pose: "talk", partner: [0xec4899, 0x2f333a], money: -60, mood: 6 },
    { id: "fish", emoji: "🐠", zh: "买条金鱼", en: "Buy a goldfish", who: "金鱼档老板", whoEn: "The goldfish seller", say: "「这条红白的，养得活。」", sayEn: "“This red-and-white one — it'll live.”", pose: "talk", partner: [0x65a30d, 0x374151], money: -12, mood: 4 },
    { id: "flower", emoji: "🌸", zh: "买束花", en: "Buy flowers", who: "花档阿姨", whoEn: "The flower seller", say: "「今天的花新，拿回去插瓶。」", sayEn: "“Today's flowers are fresh — take some home.”", pose: "talk", partner: [0x65a30d, 0x374151], money: -20, mood: 5 },
  ],
  museum: [
    { id: "exhibit", emoji: "🏺", zh: "慢慢看展", en: "See the exhibit", who: "自己", whoEn: "You", say: "「原来这座城是这样长起来的。」", sayEn: "“So this is how the city grew.”", pose: "idle", mood: 6, xp: 1 },
    { id: "guide", emoji: "🎧", zh: "听讲解员讲", en: "Hear the guide", who: "讲解员", whoEn: "The guide", say: "「这件展品背后，是整整一代人的故事。」", sayEn: "“Behind this piece is a whole generation's story.”", pose: "talk", partner: [0x0ea5e9, 0x1f2937], mood: 5, xp: 2 },
  ],
  library: [
    { id: "borrow", emoji: "📚", zh: "借本书回去", en: "Borrow a book", who: "图书管理员", whoEn: "The librarian", say: "「这本这个月借了十七次，你眼光不错。」", sayEn: "“This one's gone out seventeen times this month — good taste.”", pose: "talk", partner: [0x78716c, 0x374151], mood: 4, xp: 1 },
    { id: "study", emoji: "📖", zh: "坐下自修一会儿", en: "Sit and study", who: "自己", whoEn: "You", say: "「安静得能听见自己的想法。」", sayEn: "“Quiet enough to hear yourself think.”", pose: "sit", mood: 5, energy: 4 },
  ],
  factory: [
    { id: "tour", emoji: "🏭", zh: "看看产线", en: "See the production line", who: "班长", whoEn: "The shift lead", say: "「这条线一个班出三千件，安全帽戴好。」", sayEn: "“Three thousand a shift on this line. Helmet on.”", pose: "talk", partner: [0xf5b301, 0x2e3440], mood: 3, xp: 1 },
    { id: "ask", emoji: "🙋", zh: "问问三班倒", en: "Ask about the shifts", who: "班长", whoEn: "The shift lead", say: "「夜班补贴多，就是熬人。年轻人，先想清楚。」", sayEn: "“Nights pay more — they just wear you out. Think it over.”", pose: "talk", partner: [0xf5b301, 0x2e3440], mood: 3, network: 1 },
  ],
  disney: [
    { id: "castle", emoji: "🏰", zh: "在城堡前拍一张", en: "Take a photo at the castle", who: "自己", whoEn: "You", say: "「这张能发。」", sayEn: "“This one's worth posting.”", pose: "idle", mood: 10 },
    { id: "ride", emoji: "🎢", zh: "排队坐一次过山车", en: "Queue for the coaster", who: "自己", whoEn: "You", say: "「下来腿软，心还在飞。」", sayEn: "“Legs like jelly. Heart still flying.”", pose: "idle", mood: 12, energy: -4 },
    { id: "parade", emoji: "🎭", zh: "等花车游行", en: "Watch the parade", who: "自己", whoEn: "You", say: "「花车过来了，音乐一响，全场都站起来了。」", sayEn: "“Here comes the parade — the music starts and everyone stands up.”", pose: "idle", mood: 10 },
  ],
  tram: [
    { id: "ride", emoji: "🚃", zh: "坐上层最前排", en: "Take the front seat upstairs", who: "自己", whoEn: "You", say: "「三块钱，整座城慢慢过。」", sayEn: "“Three dollars, and the whole city goes by slowly.”", pose: "sit", mood: 8 },
    { id: "photo", emoji: "📸", zh: "给叮叮车拍一张", en: "Photo the tram", who: "自己", whoEn: "You", say: "「叮叮声一响，香港的味道就来了。」", sayEn: "“The ding-ding, and it smells like Hong Kong.”", pose: "idle", mood: 6 },
  ],
  temple: [
    { id: "fortune", emoji: "🏮", zh: "摇一支签", en: "Draw a fortune stick", who: "解签师傅", whoEn: "The fortune reader", say: "「中上签。心诚，路就顺。」", sayEn: "“A good draw. A sincere heart, a smooth road.”", pose: "talk", partner: [0xdc2626, 0x1f2937], mood: 8 },
    { id: "pray", emoji: "🙏", zh: "上香祈福", en: "Offer incense", who: "自己", whoEn: "You", say: "「香烟袅袅，心里安静了。」", sayEn: "“The incense curls up, and everything goes quiet inside.”", pose: "idle", mood: 8 },
  ],
  miniature: [
    { id: "photo", emoji: "📸", zh: "在微缩铁塔下拍一张", en: "Photo under the miniature tower", who: "自己", whoEn: "You", say: "「上午巴黎，下午开罗。」", sayEn: "“Paris in the morning, Cairo in the afternoon.”", pose: "idle", mood: 8 },
    { id: "tour", emoji: "🗼", zh: "跟着讲解走一圈", en: "Take the guided tour", who: "讲解员", whoEn: "The guide", say: "「这个比例是 1:15，细节都是手工做的。」", sayEn: "“It's 1:15 scale — every detail handmade.”", pose: "talk", partner: [0x0ea5e9, 0x1f2937], mood: 6, xp: 1 },
  ],
  farm: [
    { id: "milk", emoji: "🐄", zh: "亲手挤一回牛奶", en: "Try milking a cow", who: "农场工人", whoEn: "The farmhand", say: "「轻点，顺着来——第一次都这样。」", sayEn: "“Gently, like this — everyone's first time is like that.”", pose: "talk", partner: [0x84cc16, 0x1f2937], mood: 8, xp: 1 },
    { id: "pick", emoji: "🌽", zh: "摘一根玉米", en: "Pick some corn", who: "农场工人", whoEn: "The farmhand", say: "「现摘的玉米，回去煮着吃最甜。」", sayEn: "“Fresh-picked corn — boil it at home, sweetest that way.”", pose: "talk", partner: [0x84cc16, 0x1f2937], mood: 6 },
    { id: "crab", emoji: "🦀", zh: "下滩涂摸一只蟹", en: "Catch a crab on the mudflat", who: "自己", whoEn: "You", say: "「它比我跑得快。」", sayEn: "“It's faster than I am.”", pose: "idle", mood: 8 },
  ],
  watershow: [
    { id: "show", emoji: "⛲", zh: "看一场水秀", en: "Watch the water show", who: "自己", whoEn: "You", say: "「灯光在湖面上开花。」", sayEn: "“The lights bloom on the lake.”", pose: "idle", mood: 10 },
    { id: "mall", emoji: "🛍️", zh: "逛逛滨海商场", en: "Browse the waterfront mall", who: "自己", whoEn: "You", say: "「海风从门口吹进来，商场里全是人。」", sayEn: "“Sea breeze through the doors, the mall full of people.”", pose: "idle", mood: 6 },
  ],
  boardwalk: [
    { id: "stroll", emoji: "🚶", zh: "沿着栈道走到灯塔", en: "Walk the boardwalk to the lighthouse", who: "自己", whoEn: "You", say: "「海风追着你跑。」", sayEn: "“The sea wind chases you.”", pose: "idle", mood: 8 },
    { id: "view", emoji: "🌅", zh: "扶着栏杆看海", en: "Watch the sea from the rail", who: "自己", whoEn: "You", say: "「不用下水，也能看一整个下午的海。」", sayEn: "“No need to get wet to watch the sea all afternoon.”", pose: "idle", mood: 8 },
  ],
  fishingport: [
    { id: "buy", emoji: "🐟", zh: "买刚上岸的海鲜", en: "Buy the fresh catch", who: "鱼贩", whoEn: "The fish seller", say: "「刚卸船的，还蹦呢，称给你。」", sayEn: "“Just off the boat — still jumping.”", pose: "talk", partner: [0x0891b2, 0x1f2937], money: -50, mood: 6 },
    { id: "boat", emoji: "⛵", zh: "问渔民能不能跟船", en: "Ask about going out on a boat", who: "渔民", whoEn: "The fisherman", say: "「天不亮就出海，晕船可别怪我。」", sayEn: "“We sail before dawn — don't blame me if you're seasick.”", pose: "talk", partner: [0x0369a1, 0x1f2937], mood: 5, network: 1 },
  ],
  bikehub: [
    { id: "ride", emoji: "🚲", zh: "租辆车骑一段绿道", en: "Hire a bike for the greenway", who: "租车点老板", whoEn: "The bike-hire owner", say: "「这段路最平，骑到桥底再回来。」", sayEn: "“This stretch is the flattest — ride to the bridge and back.”", pose: "talk", partner: [0x84cc16, 0x1f2937], money: -20, mood: 8, energy: -4 },
    { id: "rent", emoji: "🚲", zh: "挑一辆车租一天", en: "Rent a bike for the day", who: "租车点老板", whoEn: "The bike-hire owner", say: "「这辆变速最顺，押金一百，回来退你。」", sayEn: "“This one's gears are the smoothest — ¥100 deposit, back when you return it.”", pose: "talk", partner: [0x84cc16, 0x1f2937], money: -30, mood: 6 },
  ],
};

/* ---- round-2 (b+g): venueSet → LifeSet. Area (b)'s VenueSetId names
   cycle/gallery/nature/wetland have no LifeSet in LifeStage (area (g)
   built bikehub/fishingport instead), so they are aliased here — the
   only place that may rename keys (App.tsx owns this mapping; data.ts
   and LifeStage.tsx are untouched). ---- */
const VENUE_SET_ALIAS: Partial<Record<string, LifeSet>> = { cycle: "bikehub", gallery: "museum", nature: "park", wetland: "farm" };
function venueFor(loc: { type: string; id: string; name: string; venueSet?: VenueSetId; animKind?: AnimKindId }): { set: LifeSet; zh: string; en: string } | null {
  // Round-2: per-place venueSet first (round2/venues.ts), then the type map
  // + regex fallbacks there. Aliased sets are mapped to the LifeSet (g) built.
  const r = venueSetFor(loc);
  if (!r) return null;
  return { set: (VENUE_SET_ALIAS[r.set] ?? r.set) as LifeSet, zh: r.zh, en: r.en };
}
import { routineRole, routineSteps, CORE_FOR_FULL_DAY, ROLE_META, isOrderRole, type RoutineDay, type RiderOrder, type RoutineStep, type RoutineRole } from "./routines";
import { GUIDE, SCENE_PHOTOS, guideForLocName, tourForCity, type DayTour, type GuidePlace } from "./experience";
import { creditFor } from "./photo-credits";
import { SEASON_START, actionMinutes, clockStr, timeBlock, nowMin, countdown, cooldownMs, realMinLabel, venueClosed, inWindow, windowStr, RAIL_HOURS, modeHours, realGameDay, seasonStartFor, seasonLength, seasonMonth, bjNow } from "./clock";
import { PERKS, MAX_EQUIP, perkById, runPoints } from "./legacy";
import { STORIES, PART, storyOf, storyStatus, type StoryFx, type StoryProg } from "./stories";
import { storyEN } from "./stories-en";
import { MiniGame, type GameSpec, type GameResult } from "./MiniGame";
import { ACTIVITIES as ACTIVITIES_LIST, CAT_LABEL, DATE_QUESTIONS, DROP_SETS, ROMANCE_STAGES, activitiesAt, activityById, dropById, romanceStage, type Activity, type ActCat } from "./activities";
import { resolveActivity, isRushHour } from "./playlogic";
import { track, setAnalyticsPlayer, deviceId } from "./analytics";

/** Unique station names of a city with the lines serving each — the index
    behind the map search box. */
const stationIndexOf = (cityKey: CityKey): { name: string; lines: string[] }[] => {
const m = new Map<string, string[]>();
for (const line of metroLinesForCity(cityKey)) for (const st of line.stations) {
const arr = m.get(st.name) ?? [];
if (!arr.includes(line.short)) arr.push(line.short);
m.set(st.name, arr);
}
return [...m.entries()].map(([name, lines]) => ({ name, lines }));
};

type World = ApiResponse<typeof api, "getWorld">["world"];
type InboxGift = ApiResponse<typeof api, "syncPresence">["inbox"][number];

/* ---- 长线玩法 helpers (see meta.ts) ---- */
const stationNamesOf = (ck: CityKey): string[] => [...new Set(metroLinesForCity(ck).flatMap((l) => l.stations.map((x) => x.name)).filter((n) => !n.endsWith("方向")))];
const SZ_STATION_COUNT = stationNamesOf("sz").length;
const isBeachLoc = (l: Loc) => l.emoji === "🏖️" || l.emoji === "🏝️";
/** A company's hiring bar after today's 开放日 and any 内推 you hold. */
const effCompany = (co: Company, ev: CityEvent, referrals: string[] | undefined): Company => {
  let c = co;
  if (ev.openDay === co.id) c = { ...c, needSkill: Math.max(0, c.needSkill - 1), needXp: Math.max(0, c.needXp - 4) };
  if (referrals?.includes(co.id)) c = { ...c, needSkill: Math.max(0, c.needSkill - 2), needXp: Math.max(0, c.needXp - 6) };
  return c;
};
const GIFTS = {
  tea: { emoji: "🧋", name: "奶茶", cost: 18, effect: "心情 +8、能量 +5" },
  breakfast: { emoji: "🥟", name: "早餐", cost: 12, effect: "能量 +15" },
  hongbao: { emoji: "🧧", name: "红包", cost: 88, effect: "¥88" },
  referral: { emoji: "🤝", name: "内推", cost: 0, effect: "你公司的面试门槛降低" },
  invite: { emoji: "🎉", name: "邀请报到", cost: 0, effect: "¥200 邀请奖励" },
  share: { emoji: "💴", name: "分成", cost: 0, effect: "进钱包" },
} as const;
type GiftKind = keyof typeof GIFTS;
type RealWeather = ApiResponse<typeof api, "getRealWeather">;
type Phase = "setup" | "game" | "result";

/* Real-weather presentation: the game's sky and rain follow the city's
   REAL current weather (fetched server-side), not the old per-game-day
   invented table — that table now only fills the in-fiction calendar. */
const RW_EMOJI: Record<RealWeather["kind"], string> = { clear: "☀️", partly: "🌤️", cloudy: "☁️", overcast: "☁️", fog: "🌫️", rain: "🌧️", storm: "⛈️", unknown: "🌡️" };
const RW_LABEL: Record<RealWeather["kind"], string> = { clear: "晴", partly: "多云", cloudy: "多云", overcast: "阴", fog: "雾", rain: "雨", storm: "雷雨", unknown: "实况" };

interface GameState {
cityKey: CityKey;
/** the game day a pain-point event already took its mood toll */
moodHitDay?: number;
/** 转行: the game day of the last job switch (one every three days) */
switchDay?: number;
/** real-player roommate (rent split in half) and the committee rent cut, kept in the save so the Saturday rent is right even before the server answers */
roommate?: string;
rentPolicy?: number;
/** the origin drawn at the start (抽签投胎) and the housing rung it started on */
origin?: string;
startTier?: number;
/** where you were standing when the game last saved (reopening puts you back there) */
loc?: string;
idenId: string;
day: number;
money: number;
energy: number;
mood: number;
/** 0–100. They fall while you are away and pull you back to a meal, a wash, a person. */
hunger: number;
clean: number;
social: number;
/** 100 is content. Fun only comes back in a real place. Bladder is comfort — low means find a restroom. */
fun: number;
bladder: number;
/** index into HAIRS — the silhouette other players can pick you out by */
hair: number;
/** index into ACCESSORIES. Bag, cap and tie stay visible from behind. */
accessory: number;
spouse?: string;
kids: { name: string; day: number }[];
plots: { city: CityKey; paid: number; day: number }[];
rent: number;
baseRent: number;
goal: number;
earned: number;
rentPaid: number;
workCount: number;
otCount: number;
mealCount: number;
maxMoney: number;
homeStyle: string | null;
furniture: string[];
/** where each piece sits in the 3D home (FURN_SLOTS index, -1 = put away) */
furnPos?: Record<string, number>;
/** venue interactions already rewarded today ("day:set:id") */
venueFx?: string[];
/** 人生连续剧进度 */
arcs?: Record<string, ArcProg>;
/** NPC gigs already done ("day:id") */
npcGigs?: string[];
/** 三和 / 日结今天已经结过一单 */
sanheDay?: number;
/** round-2 (f): Sanhe + lying-flat lifestyle state (see round2/lifestyles.ts). */
life?: LifestyleState;
/** round-2 (h): 外卖 / 跑单 — 顾客订单、券、会员、骑手档案、手上的单 */
delivery?: DeliveryState;
/** 长线目标：买了房、开了店、带了徒弟 */
ownFlat?: boolean; flatDay?: number;
shop?: { kind: string; day: number; lvl: number; till: number; partner?: string };
apprentice?: { name: string; day: number; lvl: number };
homeSpent: number;
xp: number;
skill: number;
careerIdx: number;
network: number;
fit: number;
invest: number;
apecCount: number;
apecTasks: string[];
apecCheckins: string[];
seenEvents: string[];
visitedScenic: string[];
/* 真实经历图鉴：一日游进度 + 已打卡解锁的真实地点（老存档缺失时回填） */
album?: string[];
tourKey?: string;
tourIdx?: number;
tourDone?: boolean;
metroRides: number;
outfit: string;
ownedOutfits: string[];
groceries: number;
greeted: string[];
npcMem: MemMap;
npcFeed: NpcPost[];
npcNews: PlayerNews[];
log: { day: number; text: string}[];
finished: boolean;
/* 手游件：每日签到与每日任务（按游戏日记账，老存档缺失时按 0 回填） */
signDay?: number;
dayBase?: { day: number; work: number; meal: number; scenic: number };
dayClaim?: string[];
/* 大厂跳槽：现在在哪家上班（深圳）、拿到的 offer、面试记录（「天:公司」每家每天一次） */
employer?: string;
offers?: string[];
interviews?: string[];
/* 别的玩家送来的内推（公司 id）：面试门槛降低 */
referrals?: string[];
/* 一天的时间预算：现在几点（分钟），今天歇了几次、上没上班、加没加班 */
minute?: number;
restDay?: number; restN?: number;
workDay?: number; otDay?: number;
/* 街坊连续剧进度 + 本局带上的深漂档案传承 */
story?: Record<string, StoryProg>;
perks?: string[];
/* 独立玩法：驾照（科目 0–3）、租车日 / 自己的车、宿醉、案底、恋爱、组局次数 */
/* 真实时间：冷却到什么时候、在忙什么、本局从哪天开始、今天睡没睡、哪天真正上过线、能量自然恢复的计时 */
busyUntil?: number; busyWhat?: string; startKey?: string; sleptDay?: number; lastActiveDay?: number; regenAt?: number;
license?: number; licDay?: number; carDay?: number; carOwned?: boolean;
hangover?: boolean; record?: number;
romance?: Record<string, number>; cohabit?: boolean;
/* 工作日常：今天做了哪些步骤、迟到 / 绩效扣分、骑手手上的单 */
routine?: RoutineDay;
actCount?: number; partyPlays?: number;
}

interface Profile {
playerId: string;
name: string;
}

export const LS_KEY = "shhr-pc-save-v1";
const CITY_EN: Record<CityKey, string> = { sz: "Shenzhen", hz: "Huizhou", hk: "Hong Kong" };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const fmt = (n: number, ck: CityKey = "sz") => fmtMoney(n, ck);
const hexCss = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
/** blend colour a toward b (t = share of b) */
const mixHex = (a: number, b: number, t: number) => { const ch = (sh: number) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t) << sh; return ch(16) | ch(8) | ch(0); };

function idenOf(gs: GameState) {
return IDENTITIES.find((i) => i.id === gs.idenId)?? IDENTITIES[0]!;
}
function tplByName(name: string | null) {
return TEMPLATES.find((t) => t.name === name)?? null;
}
function furnById(id: string) {
return FURNITURE.find((f) => f.id === id)?? null;
}
/** Round-2 (e): one-off used-furniture pieces (baseId null) live in
    GameState.furniture under their own `usedfurn-…` id. Give them a
    fallback entry so the home render / comfort math never breaks on an
    unknown id — comfort is the used-piece comfort at middling condition,
    and they never count toward a style match. */
function furnByIdOrUsed(id: string) {
const f = furnById(id);
if (f) return f;
if (id.startsWith("usedfurn-")) return { id, name: "二手家具", emoji: "🪑", room: "living", comfort: USED_FURNITURE.comfortAtCondition(10, 50), color: 0x8a7a5f, styles: [] as string[] };
return null;
}
function styleMatchCount(gs: GameState): number {
if (!gs.homeStyle) return 0;
return gs.furniture.filter((id) => furnById(id)?.styles.includes(gs.homeStyle!)).length;
}
/* ---- 冷启动：真人还少的时候，街坊发的零工补位；每晚 8–9 点是黄金档 ---- */
const NPC_GIG_POOL = [
  { id: "move", emoji: "📦", zh: "帮忙搬家（四楼没电梯）", en: "Help with a move (4th floor, no lift)", pay: 180, energy: 18 },
  { id: "dog", emoji: "🐕", zh: "帮忙遛狗一小时", en: "Walk a dog for an hour", pay: 60, energy: 6 },
  { id: "queue", emoji: "🧾", zh: "帮忙排队取号（医院 / 办证）", en: "Hold a place in a queue (hospital / permits)", pay: 80, energy: 8 },
  { id: "flyer", emoji: "📰", zh: "在地铁口发传单", en: "Hand out flyers at a metro exit", pay: 120, energy: 12 },
  { id: "tutor", emoji: "📚", zh: "给邻居小孩辅导作业", en: "Help a neighbour's kid with homework", pay: 150, energy: 10 },
  { id: "photo", emoji: "📷", zh: "帮小店拍几张产品图", en: "Shoot product photos for a little shop", pay: 200, energy: 10 },
  { id: "pc", emoji: "💻", zh: "帮阿姨修电脑、装微信", en: "Fix an auntie's computer and set up WeChat", pay: 90, energy: 6 },
  { id: "stall", emoji: "🍢", zh: "夜市帮看半小时摊", en: "Mind a night-market stall for half an hour", pay: 70, energy: 5 },
];
const isPrime = () => inWindow(nowMin(), [20 * 60, 21 * 60]);
function npcGigsToday(gs: GameState) {
const npcs = npcsForCity(gs.cityKey);
const start = (gs.day * 7 + gs.cityKey.length * 3) % NPC_GIG_POOL.length;
return [0, 1, 2].map((i) => { const g = NPC_GIG_POOL[(start + i * 3) % NPC_GIG_POOL.length]!; const n = npcs[(gs.day + i * 2) % Math.max(1, npcs.length)]; return { ...g, who: n?.name ?? "街坊", whoEmoji: n?.emoji ?? "🙂" }; });
}
/* ---- 长线目标：爬到顶以后还有事做 ---- */
const SHOP_KINDS = [
  { id: "tangshui", emoji: "🍧", zh: "糖水铺", en: "Dessert shop", base: 160 },
  { id: "changfen", emoji: "🥟", zh: "肠粉档", en: "Rice-roll stall", base: 140 },
  { id: "milktea", emoji: "🧋", zh: "奶茶店", en: "Bubble tea shop", base: 190 },
];
const flatPrice = (gs: GameState) => Math.round((gs.goal * 3) / 100) * 100;
const shopPrice = (gs: GameState) => Math.round(gs.goal / 100) * 100;
const shopUpgrade = (gs: GameState) => Math.round((gs.goal * 0.6 * (gs.shop?.lvl ?? 1)) / 100) * 100;
/** which life arc plays this morning: an arc already under way (one act a day), else maybe a new one */
function pickArc(gs: GameState): string | null {
const live = Object.entries(gs.arcs ?? {}).find(([, p]) => !p.done && p.day < gs.day);
if (live) return live[0];
if (Object.values(gs.arcs ?? {}).some((p) => !p.done)) return null;
if (Math.random() > 0.45) return null;
const wage = ROLE_META[routineRole(gs.idenId)].pay === "wage";
const pool = LIFE_ARCS.filter((a) => !gs.arcs?.[a.id] && a.when({ day: gs.day, money: gs.money, wage, ownFlat: !!gs.ownFlat, city: gs.cityKey }));
return pool.length ? pool[Math.floor(Math.random() * pool.length)]!.id : null;
}
function applyArcFx(x: GameState, fx: ArcFx) {
x.money += fx.money ?? 0;
if ((fx.money ?? 0) > 0) x.earned += fx.money!;
x.mood = clamp(x.mood + (fx.mood ?? 0), 0, 100);
x.energy = clamp(x.energy + (fx.energy ?? 0), 0, 100);
x.network += fx.network ?? 0; x.xp += fx.xp ?? 0;
if (fx.rentPct && !x.ownFlat) { x.rent = Math.max(0, Math.round((x.rent * (1 + fx.rentPct / 100)) / 10) * 10); x.baseRent = Math.max(0, Math.round((x.baseRent * (1 + fx.rentPct / 100)) / 10) * 10); }
}
function arcFxText(fx: ArcFx, en: boolean, ck: CityKey): string {
return [fx.money ? `${fx.money > 0 ? "+" : "−"}${fmtMoney(Math.abs(fx.money), ck)}` : "", fx.mood ? `${en ? "mood" : "心情"} ${fx.mood > 0 ? "+" : ""}${fx.mood}` : "", fx.energy ? `${en ? "energy" : "能量"} ${fx.energy > 0 ? "+" : ""}${fx.energy}` : "", fx.network ? `${en ? "contacts" : "人脉"} +${fx.network}` : "", fx.xp ? `${en ? "XP" : "经验"} +${fx.xp}` : "", fx.rentPct ? `${en ? "rent" : "周租"} ${fx.rentPct > 0 ? "+" : ""}${fx.rentPct}%` : ""].filter(Boolean).join(" · ");
}
/** furniture placed in the 3D home: saved spot, else the next free spot in purchase order */
function rentYouPay(gs: { rent: number; rentPolicy?: number; roommate?: string }): number {
  return Math.round(gs.rent * (gs.rentPolicy ?? 1) * (gs.roommate ? 0.5 : 1));
}
function placedFurn(gs: GameState): { id: string; slot: number; color: number }[] {
const used = new Set<number>(); const out: { id: string; slot: number; color: number }[] = [];
for (const id of gs.furniture) { const p = gs.furnPos?.[id]; if (p !== undefined && p >= 0) used.add(p); }
for (const id of gs.furniture) {
const f = furnByIdOrUsed(id); if (!f) continue;
let slot = gs.furnPos?.[id];
if (slot === undefined) { slot = FURN_SLOTS.findIndex((_, i) => !used.has(i)); if (slot >= 0) used.add(slot); }
if (slot >= 0) out.push({ id, slot, color: f.color });
}
return out;
}
function computeComfort(gs: GameState): number {
const base = gs.homeStyle? (tplByName(gs.homeStyle)?.comfort?? 30): 12;
let sum = base;
for (const id of gs.furniture) {
const f = furnByIdOrUsed(id);
if (f) sum += f.comfort;
}
return sum + styleMatchCount(gs) * 6;
}
function homeMoodBonus(gs: GameState): number {
return Math.floor(computeComfort(gs) / 12) + styleMatchCount(gs) * 3;
}
function homeName(gs: GameState): string {
if (gs.homeStyle) return `精装房 · ${gs.homeStyle}`;
return gs.cityKey === "hz" ? "海边出租屋" : gs.cityKey === "hk" ? "深水埗唐楼" : "城中村出租屋";
}
function newPlayerId(): string {
try {
return crypto.randomUUID();
} catch {
return `p-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}
}

function computeResult(gs: GameState, reason: "done" | "debt") {
const city = CITIES[gs.cityKey];
const iden = idenOf(gs);
let title: string;
let quote: string;
if (reason === "debt" || gs.money < -500) {
title = "被房东请出门";
quote = `“钱没攒下，故事攒了一堆。” 这次${city.name}之旅提前结束了——不是你不行，是房租太准时。下次记得：周六之前，钱包里一定要留够房租。`;
} else if (gs.money >= gs.goal * 1.5) {
title = gs.cityKey === "sz" ? "深圳湾预备业主" : gs.cityKey === "hk" ? "维港看房人" : "海景房候选人";
quote = `别人还在挤地铁，你已经在看房了。这30天你卷得明白、活得清醒——${gs.cityKey === "sz" ? "深圳不相信眼泪，但相信存款。" : gs.cityKey === "hk" ? "维港的灯火里，终于有一扇窗是为你留的。" : "惠州的海，终于有一扇窗是为你留的。"}`;
} else if (gs.money >= gs.goal) {
title = gs.cityKey === "sz" ? "深漂上岸者" : gs.cityKey === "hk" ? "港漂扎根者" : "惠州安家者";
quote = `目标达成！${fmt(gs.money, gs.cityKey)} 是你一天一天、一顿一顿饭省出来、赚出来的。${city.name}没有辜负认真生活的人。`;
} else if (gs.money >= 0) {
title = "平凡生存家";
quote = "没到目标，但你完整地活过了30天，交齐了每一周的房租，吃了每一顿该吃的饭。平凡地活着，本身就很了不起。";
} else {
title = "月光边缘人";
quote = "存款是负的，但人还在、故事还在。下个月少点外卖、少点冲动消费，你完全可以翻盘。";
}
if (iden.id === "rich" && gs.money >= gs.goal) title = "富二代自证成功";
if (iden.id === "flat" && gs.mood >= 80 && gs.money >= 0) title = "真正会躺的人";
if (gs.otCount >= 8) title = "加班战神（慎）";
const badges: string[] = [];
if (gs.workCount >= 15) badges.push("🏅 打工狂魔");
if (gs.otCount >= 5) badges.push("🔥 加班达人");
if (gs.mealCount >= 10) badges.push("🍚 干饭自由");
if (gs.mood >= 70) badges.push("😊 心态大师");
if (gs.careerIdx >= 2) badges.push("📈 升职达人");
if (gs.careerIdx >= 4) badges.push("👑 城市合伙人");
if (gs.network >= 5) badges.push("🤝 人脉渐广");
if (gs.apecCount >= 3) badges.push("🌐 峰会服务之星");
if ((gs.apecTasks ?? []).length >= APEC_TASKS.length) badges.push(APEC_CERT_NAME);
else if ((gs.apecCheckins ?? []).length >= 3) badges.push("📍 峰会三会场全打卡");
if (gs.furniture.length >= 3) badges.push("🛋️ 安家小能手");
if (computeComfort(gs) >= 80) badges.push("🏠 舒适小窝");
if ((gs.metroRides ?? 0) >= 5) badges.push(gs.cityKey === "hz" ? "🚆 城轨达人" : gs.cityKey === "hk" ? "🚇 港铁达人" : "🚇 地铁达人");
if ((gs.visitedScenic ?? []).length >= 5) badges.push("📸 风景收藏家");
if ((gs.actCount ?? 0) >= 15) badges.push("🎮 会玩的人");
if ((gs.partyPlays ?? 0) >= 3) badges.push("🤝 组局达人");
if (Object.values(gs.romance ?? {}).some((v) => v >= 55)) badges.push("💕 脱单成功");
if ((gs.license ?? 0) >= 3) badges.push("🪪 有证司机");
if ((gs.record ?? 0) > 0) badges.push("🚓 进过派出所");
return { title, quote, badges};
}


/* ---------- 生活动画: short acted scenes for the moments of a day ----------
   Each scene is a few steps on a warm cinematic stage: the character walks
   in with eased motion, props act (typing, steam, chewing, lifting), and
   captions tell the beat. Triggered by the real actions (finishing a rail
   ride, working, eating, cooking, sleeping…) and by the 今日生活 replay. */
type LifeKind = "routine" | "day" | "alightRail" | "crossing" | "metro" | "code" | "overtime" | "eat" | "cook" | "sleep" | "wash" | "groceries" | "shopping" | "gym" | "stroll" | "gathering" | "cruise" | "wheel" | "aquarium" | "turtle" | "coaster" | "safari" | "hike" | "beach" | "cablecar";
interface LifeStep { bg: string; prop: string; caption: string; sub: string; move?: "walk" | "stay"; fx?: "type" | "steam" | "zzz" | "rain" | "chew" | "lift" | "shine"; dawn?: boolean; }
interface LifeScene { title: string; tone?: "night" | "indoor"; steps: LifeStep[]; }
/* the routine scene is filled in just before it plays (one beat per step) */
let routineStage: { set: LifeSet; pose: LifePose } = { set: "office", pose: "type" };
const LIFE_SCENES: Record<LifeKind, LifeScene> = {
routine: { title: "工作日常", tone: "indoor", steps: [{ bg: "🏢", prop: "⌨️", caption: "", sub: "", move: "stay" }] },
day: { title: "今日生活 · 从清晨到夜里", steps: [
  { bg: "🏠 🪟 🌅", prop: "🪥", caption: "清晨，闹钟响了", sub: "起床、刷牙、洗脸，镜子里的自己慢慢精神起来", move: "stay", fx: "shine" },
  { bg: "🏠 👕 🪞", prop: "👔", caption: "换上正装出门", sub: "上班穿正装，临出门照了照镜子——今天也要体面", move: "stay" },
  { bg: "🚄 🏙️ 🌤️", prop: "🚄", caption: "高铁到站，下车", sub: "车门打开，拎着包走下站台，跟着人流往出站口走", move: "walk" },
  { bg: "🚇 👥 👥", prop: "🚇", caption: "换乘地铁", sub: "刷卡进闸，早高峰的车厢挤满了人，扶稳站好", move: "walk" },
  { bg: "🏢 💻 👩‍💻", prop: "💻", caption: "到公司，坐下敲代码", sub: "打开电脑，键盘声噼里啪啦，需求一个一个被推平", move: "stay", fx: "type" },
  { bg: "🍜 🏮 👥", prop: "🍜", caption: "中午去吃饭", sub: "楼下食街来一碗热的，吃饱了才有力气过日子", move: "stay", fx: "chew" },
  { bg: "🥬 🧺 🌇", prop: "🥬", caption: "下班绕去买菜", sub: "挑了青菜、鸡蛋和一块肉，拎着慢慢走回家", move: "walk" },
  { bg: "🍳 🏠 💡", prop: "🍳", caption: "回家做饭", sub: "洗菜、切菜、下锅——蒸汽和香气一起升起来", move: "stay", fx: "steam" },
  { bg: "🛏️ 🌙 🏠", prop: "🛏️", caption: "洗漱完，躺下睡觉", sub: "灯关了。今天过得很满，明天继续好好过日子", move: "stay", fx: "zzz" },
] },
alightRail: { title: "下高铁", steps: [
  { bg: "🚄 🏙️", prop: "🚄", caption: "列车缓缓进站", sub: "广播响起：前方到站，请拿好随身行李", move: "stay" },
  { bg: "🚪 🧳 👥", prop: "🧳", caption: "车门打开，下车", sub: "拎着包走下站台，脚踏实地的感觉真好", move: "walk" },
  { bg: "🏙️ ☀️ 🚇", prop: "🎫", caption: "刷卡出站", sub: "跟着人流走出站厅，城市的热气扑面而来", move: "walk" },
] },
crossing: { title: "过关 · 深港之间", steps: [
  { bg: "🛃 👥 🧳", prop: "🪪", caption: "排队过关，先出示证件", sub: "口岸大堂人流如织：把回乡证 / 港澳通行证拿在手里，跟着队伍慢慢往前挪", move: "stay" },
  { bg: "🛂 🧳 🔍", prop: "🧳", caption: "安检 + 出入境检查", sub: "行李过机、人过闸口，证件一刷——内地的章和香港的入境记录，一次过完成", move: "walk" },
  { bg: "🇭🇰 🏙️ 🚇", prop: "🎫", caption: "过关成功，入城", sub: "走出大堂，空气里的语言都变了：广播先讲广东话，再讲普通话，最后是英文", move: "walk" },
] },
metro: { title: "坐地铁", steps: [
  { bg: "🚇 💺 👥", prop: "💺", caption: "坐进车厢", sub: "找个座位坐下，扶好扶手——车厢晃着往前开，窗外的城市一段段往后跑", move: "stay" },
  { bg: "🚇 👥 👥", prop: "🚇", caption: "到站下车", sub: "车门打开，先下后上，跟着人流往外走", move: "walk" },
  { bg: "🏙️ ☀️", prop: "🎫", caption: "刷卡出闸", sub: "出站口的风一吹，新的一段路开始了", move: "walk" },
] },
code: { title: "去公司 · 敲代码", tone: "indoor", steps: [
  { bg: "🏢 🪪 👩‍💻", prop: "🪪", caption: "刷卡进公司", sub: "闸机滴的一声，和同事阿琳打了个招呼", move: "walk" },
  { bg: "💻 🪑 📋", prop: "💻", caption: "坐下，打开电脑", sub: "工位上的保温杯还温着，先看一眼今天的需求列表", move: "stay" },
  { bg: "⌨️ 💻 🖥️", prop: "⌨️", caption: "敲代码", sub: "键盘声噼里啪啦，思路顺的时候时间过得飞快", move: "stay", fx: "type" },
  { bg: "✅ ☕ 🧍", prop: "☕", caption: "提交，起身接杯水", sub: "代码推上去了，肩膀终于松下来", move: "stay", fx: "shine" },
] },
overtime: { title: "加班的夜晚", tone: "night", steps: [
  { bg: "🏢 🌃 💡", prop: "💻", caption: "办公室只剩几盏灯", sub: "窗外是整座城的灯火，屏幕上是没改完的 bug", move: "stay", fx: "type" },
  { bg: "⌨️ ☕ 🌙", prop: "⌨️", caption: "再敲最后一行", sub: "咖啡见底了，代码终于跑通——保存，关机", move: "stay", fx: "type" },
  { bg: "🚪 🌙 🧍", prop: "🌙", caption: "走出大楼", sub: "夜里风凉，心里默念：钱是赚到了，人也要好好休息", move: "walk" },
] },
eat: { title: "夜市吃面", tone: "night", steps: [
  { bg: "🏮 🍜 👥", prop: "🍜", caption: "走到面摊前", sub: "夜市的灯串亮着，大排档的招牌下人声鼎沸——老规矩，先找个折叠桌坐下", move: "walk" },
  { bg: "🍜 🔥 💨", prop: "🍜", caption: "面端上来了", sub: "摊主的大锅还冒着热气，一碗面浇上卤汁端到面前，先闻一闻——就是这个味儿", move: "stay", fx: "steam" },
  { bg: "🥢 🍜 😋", prop: "🥢", caption: "挑起面，开吃", sub: "筷子挑起一大口，吸溜吸溜——夜市的面，吃的是热气和人气", move: "stay", fx: "chew" },
] },
cook: { title: "回家做饭", tone: "indoor", steps: [
  { bg: "🚰 🥬 🍅", prop: "🥬", caption: "洗菜", sub: "青菜在水里过三遍，鸡蛋磕进碗里搅匀", move: "stay", fx: "shine" },
  { bg: "🔪 🥕 🧄", prop: "🔪", caption: "切菜备料", sub: "刀落在案板上笃笃响，备菜整齐码好", move: "stay" },
  { bg: "🍳 🔥 🧂", prop: "🍳", caption: "下锅翻炒", sub: "油热下锅，蒸汽和香气一起升起来，隔壁都闻得到", move: "stay", fx: "steam" },
  { bg: "🍽️ 🍚 🏠", prop: "🍽️", caption: "上桌，开饭", sub: "自己做的饭，坐在自己的餐桌前慢慢吃", move: "stay", fx: "chew" },
] },
sleep: { title: "睡觉 · 到天亮", tone: "night", steps: [
  { bg: "🚿 🪥 🏠", prop: "🪥", caption: "洗漱", sub: "冲个热水澡，刷牙洗脸，一天的灰都洗掉", move: "stay", fx: "shine" },
  { bg: "🩳 🛏️ 💡", prop: "🛏️", caption: "换上睡衣，躺下", sub: "被子拉好，手机放远，灯关了", move: "stay" },
  { bg: "🌙 ⭐ 🛏️", prop: "😴", caption: "睡着了", sub: "呼吸慢慢平稳，闹钟在床头安安静静地等着天亮", move: "stay", fx: "zzz" },
  { bg: "🌅 🛏️ 🧍", prop: "🌅", caption: "天亮了，伸个懒腰醒来", sub: "晨光透过窗帘洒进来——伸个大大的懒腰，新的一天开始了", move: "stay", fx: "shine", dawn: true },
] },
wash: { title: "起床洗漱", tone: "indoor", steps: [
  { bg: "⏰ 🛏️ 🌅", prop: "⏰", caption: "闹钟响了，起床", sub: "伸个懒腰，新的一天从掀开被子开始", move: "stay", fx: "shine" },
  { bg: "🪥 🚿 🪞", prop: "🪥", caption: "刷牙洗脸", sub: "卫生间里水声哗哗，镜子蒙上一层水汽", move: "stay", fx: "shine" },
  { bg: "👕 🪞 ☀️", prop: "👕", caption: "换好衣服，精神了", sub: "照照镜子——可以出门了", move: "stay" },
] },
groceries: { title: "去买菜", steps: [
  { bg: "🥬 🍅 🧺", prop: "🥬", caption: "在菜摊前挑挑拣拣", sub: "郭叔的摊子菜新鲜，青菜、番茄、鸡蛋一样样看", move: "walk" },
  { bg: "⚖️ 🥩 👛", prop: "🥩", caption: "称好，付钱", sub: "摊主多塞了把葱：拿去，炒鸡蛋香", move: "stay", fx: "shine" },
  { bg: "🧺 🏠 🌇", prop: "🧺", caption: "拎着菜回家", sub: "满满一篮子，今晚的饭有着落了", move: "walk" },
] },
shopping: { title: "逛街", steps: [
  { bg: "🛍️ 🏬 👥", prop: "🏬", caption: "走进商场", sub: "灯光明亮，橱窗一家比一家好看", move: "walk" },
  { bg: "👕 🪞 👟", prop: "👕", caption: "试穿比划", sub: "在镜子前转一圈，这件还真合身", move: "stay", fx: "shine" },
  { bg: "🛍️ 😊 🌆", prop: "🛍️", caption: "拎着袋子出来", sub: "逛街的快乐，一半在买，一半在逛", move: "walk" },
] },
gym: { title: "健身", tone: "indoor", steps: [
  { bg: "🏃 🧘 🏋️", prop: "🏃", caption: "热身", sub: "换上运动装，活动开筋骨", move: "stay" },
  { bg: "🏋️ 💪 🔥", prop: "🏋️", caption: "认真练一组", sub: "一下，一下，出汗的感觉很实在", move: "stay", fx: "lift" },
  { bg: "🧘 💦 😌", prop: "🧘", caption: "拉伸放松", sub: "练完神清气爽，明天肌肉会酸，但人是轻的", move: "stay", fx: "shine" },
] },
stroll: { title: "散步", steps: [
  { bg: "🌳 🚶 🌤️", prop: "🚶", caption: "慢慢走", sub: "不赶时间，沿着树荫和水边走", move: "walk" },
  { bg: "🌅 🪑 🌊", prop: "🌅", caption: "坐下来看看风景", sub: "风把一天的疲惫吹散了不少", move: "stay", fx: "shine" },
] },
cruise: { title: "东江夜游 · 坐游船", tone: "night", steps: [
  { bg: "⛴️ 🏮 🌃", prop: "🎫", caption: "检票上船", sub: "码头的灯串亮了，踩着跳板上船，找个靠栏杆的位置坐下", move: "walk" },
  { bg: "🌊 🏯 ✨", prop: "⛴️", caption: "船开了，两岸灯火慢慢后退", sub: "江风迎面吹来，灯笼在头顶轻轻晃，江面上碎成一片金光", move: "stay", fx: "shine" },
  { bg: "🏯 🌉 📸", prop: "📸", caption: "合江楼就在正前方", sub: "两江交汇处，楼体的灯影倒映在水里——拍一张，今晚值了", move: "stay", fx: "shine" },
] },
wheel: { title: "坐摩天轮", steps: [
  { bg: "🎡 🎫 👥", prop: "🎫", caption: "走进透明轿厢", sub: "舱门合上，轿厢轻轻一晃，开始慢慢往上升", move: "stay" },
  { bg: "🏙️ ⬇️ 🌤️", prop: "🎡", caption: "城市一点点沉下去", sub: "楼顶、马路、海湾都变小了，脚下是整片前海", move: "stay", fx: "shine" },
  { bg: "🌇 🌊 ✨", prop: "📸", caption: "到最高点了", sub: "海风、晚霞、远处的大桥——在最高点拍一张，再慢慢转下来", move: "stay", fx: "shine" },
] },
aquarium: { title: "海洋馆 · 海底隧道", steps: [
  { bg: "🐠 🌊 🐟", prop: "🐟", caption: "走进海底隧道", sub: "四周一下子变成蓝色，鱼群就在头顶和身边游", move: "walk" },
  { bg: "🦈 🐠 💙", prop: "🦈", caption: "一条鲨鱼从头顶滑过", sub: "鳐鱼像风筝一样扇着翅膀，小朋友们趴在玻璃上不肯走", move: "stay", fx: "shine" },
  { bg: "🪼 💡 📸", prop: "🪼", caption: "水母馆里慢慢看", sub: "灯光下的水母一呼一吸地漂着，整个人都安静下来", move: "stay" },
] },
turtle: { title: "海龟湾 · 看海龟", steps: [
  { bg: "🏖️ 🐢 🌊", prop: "🐢", caption: "走到保护区的观景沙滩", sub: "工作人员提醒：别用闪光灯，别伸手摸，远远看就好", move: "walk" },
  { bg: "🐢 🐢 🌊", prop: "🐢", caption: "海龟慢慢爬向大海", sub: "鳍肢一下一下划着沙子，留下一道道爬痕", move: "stay", fx: "shine" },
  { bg: "🐣 🌊 💚", prop: "🌊", caption: "小海龟奔向浪花", sub: "一个浪打上来，小家伙们就不见了——祝你们一路顺风", move: "stay", fx: "shine" },
] },
coaster: { title: "坐过山车", steps: [
  { bg: "🎢 🎫 😬", prop: "🎢", caption: "坐进第一排，压杠落下", sub: "咔哒咔哒——车慢慢爬上最高点，心跳比链条还响", move: "stay" },
  { bg: "🎢 ⬇️ 😱", prop: "😱", caption: "俯冲！", sub: "失重的一秒，尖叫声和风一起灌进耳朵", move: "stay", fx: "shine" },
  { bg: "🎢 🔄 🤣", prop: "🤣", caption: "翻完大回环，腿是软的", sub: "下车时还在笑，嗓子已经喊哑了", move: "stay", fx: "shine" },
] },
safari: { title: "坐观光车逛动物园", steps: [
  { bg: "🚌 🦒 🌳", prop: "🚌", caption: "坐上带铁笼的观光车", sub: "司机提醒：关好车窗，不要投喂，不要伸手", move: "stay" },
  { bg: "🦓 🦒 🌾", prop: "🦒", caption: "长颈鹿和斑马慢悠悠走过", sub: "长颈鹿低头看了你一眼，又继续嚼它的树叶", move: "stay", fx: "shine" },
  { bg: "🦁 😮 📸", prop: "🦁", caption: "狮子就在车窗外", sub: "隔着铁笼都能感到它的气场——全车人屏住呼吸按快门", move: "stay", fx: "shine" },
] },
hike: { title: "爬山登顶", steps: [
  { bg: "⛰️ 🥾 🌳", prop: "🥾", caption: "沿石阶往上爬", sub: "一级一级，汗顺着脖子往下流，树荫里有风", move: "walk" },
  { bg: "🌫️ ⛰️ 💪", prop: "💧", caption: "半山腰歇一口气", sub: "喝口水，回头一看，城市已经在脚下了", move: "stay" },
  { bg: "🏯 🌇 🙌", prop: "🙌", caption: "登顶！", sub: "山顶的风一吹，整座城尽收眼底——值了", move: "stay", fx: "shine" },
] },
beach: { title: "去海边", steps: [
  { bg: "🏖️ 👣 ☀️", prop: "👣", caption: "光脚踩上沙滩", sub: "沙子有点烫，海风是咸的", move: "walk" },
  { bg: "🌊 🏊 😆", prop: "🌊", caption: "下海玩水", sub: "一个浪打过来，从头湿到脚，笑得停不下来", move: "stay", fx: "shine" },
  { bg: "🌅 🪑 🍹", prop: "🌅", caption: "坐在伞下看日落", sub: "海面一点点变成金色，今天的烦恼都留在了沙滩上", move: "stay", fx: "shine" },
] },
cablecar: { title: "坐缆车上山", steps: [
  { bg: "🚡 🎫 ⛰️", prop: "🚡", caption: "坐进缆车", sub: "门一关，车厢轻轻一晃，离开站台往山上滑", move: "stay" },
  { bg: "⛰️ 🌊 ✨", prop: "🌊", caption: "海湾在脚下展开", sub: "越升越高，山、海和城市的边界一下子都看清了", move: "stay", fx: "shine" },
  { bg: "🏔️ 🙌 📸", prop: "📸", caption: "到山顶站了", sub: "下缆车前回头拍一张，这一段风景值回票价", move: "walk" },
] },
gathering: { title: "朋友聚餐", tone: "indoor", steps: [
  { bg: "🍻 👥 🎤", prop: "🍻", caption: "朋友们到齐了", sub: "拼桌坐下，先碰一杯，聊聊最近怎么样", move: "stay", fx: "shine" },
  { bg: "🍲 🥢 😂", prop: "🍲", caption: "边吃边聊", sub: "菜一盘盘上，笑声一阵阵——人脉就是这样攒下的", move: "stay", fx: "chew" },
] },
};

function lifeStageFor(kind: LifeKind, idx: number): { set: LifeSet; pose: LifePose } {
switch (kind) {
case "routine": return routineStage;
case "day": return ([{ set: "bathroom", pose: "wash" }, { set: "home", pose: "idle" }, { set: "station", pose: "walk" }, { set: "metro", pose: "walk" }, { set: "office", pose: "type" }, { set: "restaurant", pose: "eat" }, { set: "market", pose: "walk" }, { set: "kitchen", pose: "cook" }, { set: "bedroom", pose: "sleep" }] as { set: LifeSet; pose: LifePose }[])[idx] ?? { set: "home", pose: "idle" };
case "alightRail": return { set: "station", pose: idx === 0 ? "idle" : "walk" };
case "crossing": return idx === 0 ? { set: "concourse", pose: "idle" } : idx === 1 ? { set: "concourse", pose: "walk" } : { set: "station", pose: "walk" };
case "metro": return idx === 0 ? { set: "metro", pose: "sit" } : idx === 1 ? { set: "metro", pose: "walk" } : { set: "concourse", pose: "walk" };
case "code": return { set: "office", pose: idx === 0 ? "walk" : idx === 3 ? "idle" : "type" };
case "overtime": return { set: "office", pose: idx === 2 ? "walk" : "type" };
case "eat": return { set: "market", pose: idx === 0 ? "walk" : "eat" };
case "cook": return { set: "kitchen", pose: idx === 3 ? "eat" : "cook" };
case "sleep": return idx === 0 ? { set: "bathroom", pose: "wash" } : idx === 1 ? { set: "bedroom", pose: "idle" } : idx === 2 ? { set: "bedroom", pose: "sleep" } : { set: "bedroom", pose: "stretch" };
case "wash": return idx === 0 ? { set: "bedroom", pose: "stretch" } : { set: "bathroom", pose: "wash" };
case "groceries": return { set: "market", pose: idx === 1 ? "idle" : "walk" };
case "shopping": return { set: "mall", pose: idx === 1 ? "idle" : "walk" };
case "gym": return { set: "gym", pose: idx === 1 ? "lift" : "idle" };
case "stroll": return { set: "park", pose: idx === 0 ? "walk" : "idle" };
case "gathering": return { set: "restaurant", pose: "eat" };
case "cruise": return { set: "cruise", pose: idx === 0 ? "walk" : "sit" };
case "wheel": return { set: "wheel", pose: idx === 0 ? "idle" : "sit" };
case "aquarium": return { set: "aquarium", pose: idx === 0 ? "walk" : "idle" };
case "turtle": return { set: "turtle", pose: idx === 0 ? "walk" : "idle" };
case "coaster": return { set: "coaster", pose: "sit" };
case "safari": return { set: "safari", pose: "sit" };
case "hike": return { set: "hike", pose: idx === 2 ? "stretch" : idx === 1 ? "idle" : "walk" };
case "beach": return { set: "beach", pose: idx === 0 ? "walk" : idx === 1 ? "stretch" : "idle" };
case "cablecar": return { set: "cablecar", pose: idx === 2 ? "walk" : "sit" };
}
}

/* Collapsible group used to layer the right-hand panel (and any dense
   block): a clear header row with a summary, content only when opened.
   `groupKey` resets the open state when the context (e.g. the selected
   place) changes, so each place starts from the same layered layout. */
/* 「真实经历」卡：弹出的经历锚在真实地点上——实拍照片轮播 + 真实信息
   （地址/价格/时间/贴士，带来源）+ 城市知识（中英双语）+ NPC 带路讲的
   真实故事；下面的地点行动就是这张卡的互动选择。到场打卡把它收进图鉴。 */
function ExperienceCard({ g, here, unlocked, onCheckin }: { g: GuidePlace; here: boolean; unlocked: boolean; onCheckin: () => void }) {
const [pi, setPi] = useState(0);
const photos = g.photos;
const idx = Math.min(pi, photos.length - 1);
const photo = photos[idx] ?? photos[0]!;
return (
<div className="mt-3 overflow-hidden rounded-[14px] border-2 border-[var(--border)] bg-[var(--surface)]">
<div className="relative">
<img src={photo} alt={`${g.locName}实拍照片`} className="h-44 w-full object-cover" />
{photos.length > 1 && (
<>
<button type="button" aria-label="上一张实拍照片" onClick={() => setPi((idx + photos.length - 1) % photos.length)} className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-base font-black text-white">‹</button>
<button type="button" aria-label="下一张实拍照片" onClick={() => setPi((idx + 1) % photos.length)} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-base font-black text-white">›</button>
<span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-black text-white">{idx + 1}/{photos.length}</span>
</>
)}
<span className="absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-black tracking-wide text-white">📷 真实经历 · 实拍 {g.nameEn}</span>
</div>
<PhotoCreditLine url={photo} note={g.photoNote} />
<div className="p-3">
<p className="text-xs leading-relaxed"><span className="font-black">📍 地址 </span>{g.address}</p>
<p className="mt-1 text-xs leading-relaxed"><span className="font-black">🎫 价格 </span>{g.price}<span className="mx-1.5 text-[var(--dim)]">·</span><span className="font-black">🕘 时间 </span>{g.hours}</p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">💡 {g.tip}</p>
<p className="mt-2 rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-xs leading-relaxed">🧭 <b>城市知识：</b>{g.fact}<span className="mt-0.5 block text-[11px] italic text-[var(--dim)]">{g.factEn}</span></p>
<p className="mt-2 text-xs leading-relaxed">🗣️ <b>{g.npc}带路：</b>{g.story}</p>
<div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
<a href={g.sourceUrl} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-[var(--accent2)] underline">资料来源：{g.sourceName}</a>
{unlocked ? <span className="chip" style={{ borderColor: "var(--green)", color: "var(--green)" }}>✓ 已收进图鉴</span> : (
<button type="button" disabled={!here} aria-label={`在${g.locName}打卡解锁图鉴`} onClick={onCheckin} className="rounded-full bg-[var(--text)] px-3.5 py-1.5 text-[11px] font-black text-[var(--bg)] disabled:opacity-45">{here ? "📸 打卡收进图鉴" : "到了这里才能打卡"}</button>
)}
</div>
</div>
</div>
);
}

/** Attribution under a real photo (CC BY / BY-SA need it): author · licence · file page. */
function PhotoCreditLine({ url, note }: { url: string | undefined; note?: string }) {
const c = creditFor(url);
if (!c && !note) return null;
return (
<p className="px-3 pt-1.5 text-[10px] leading-snug text-[var(--dim)]">
{note && <span className="mr-1">ℹ️ {note}。</span>}
{c && <>📷 <a href={c.page} target="_blank" rel="noreferrer" className="underline">{c.artist || c.title}</a> · {c.license} · {c.source ?? "Wikimedia Commons"}</>}
</p>
);
}

/** Check-in targets in a city: the curated scenic spots plus every real
    park / beach / peak / landmark from the OSM place list. */
function scenicTotal(ck: CityKey): number {
  return SCENIC_SPOTS.filter((x) => x.cityKey === ck).length
    + placesForCity(ck).filter((p) => PLACE_KINDS[p.kind].type === "scenic" || PLACE_KINDS[p.kind].type === "mountain").length;
}

function Fold({ title, summary, defaultOpen = false, groupKey, children, tone }: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  groupKey?: string;
  children: ReactNode;
  tone?: "gold" | "plain";
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { setOpen(defaultOpen); }, [groupKey, defaultOpen]);
  return (
    <div className={`mt-3 overflow-hidden rounded-[14px] border ${tone === "gold" ? "border-[var(--gold)] bg-[#fdf6da]/60" : "border-[var(--line)] bg-[var(--surface)]"}`}>
      <button
        type="button"
        aria-label={open ? `收起${title}` : `展开${title}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-black leading-tight">{title}</span>
          {summary && <span className="mt-0.5 block break-words text-[11px] font-bold leading-snug text-[var(--dim)]">{summary}</span>}
        </span>
        <span className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-black">{open ? "收起 ▴" : "展开 ▾"}</span>
      </button>
      {open && <div className="border-t border-[var(--line)] px-3 pb-3 pt-2">{children}</div>}
    </div>
  );
}

export function App() {
const queryClient = useQueryClient();
const [phase, setPhase] = useState<Phase>("setup");
const [profile, setProfile] = useState<Profile | null>(null);
const [gs, setGs] = useState<GameState | null>(null);
const gsRef = useRef<GameState | null>(null);
const profileRef = useRef<Profile | null>(null);
const [currentLoc, setCurrentLoc] = useState("home");
const [selectedLoc, setSelectedLoc] = useState("home");
const [walking, setWalking] = useState(false);
const [travelMode, setTravelMode] = useState<TransportModeId>("walk");
interface CarriageRide { route: MetroRoute; fromLoc: string; toLoc: string; stopIdx: number; legIdx: number; awaitingTransfer: boolean; crowdLabel: string; crowdDesc: string; crowdLevel: number; seated: boolean; gaveSeat: boolean; phoneUsed: boolean; heldRail: boolean; }

/** The acted-out start of every metro ride: walk into the concourse, pass
    security, wait on the platform, board when the doors open. */
const ENTRY_STEPS: { set: LifeSet; pose: LifePose; caption: string; sub: string }[] = [
{ set: "concourse", pose: "walk", caption: "进站", sub: "刷码过闸机，走进站厅，两边就是地铁商城——先过安检" },
{ set: "concourse", pose: "idle", caption: "安检", sub: "包放进安检机，人走过安检门，滴一声——通过" },
{ set: "platform", pose: "idle", caption: "站台等车", sub: "站在屏蔽门前等车。广播：列车即将进站，请站在黄线后" },
{ set: "platform", pose: "walk", caption: "车门打开，上车", sub: "屏蔽门和车门一起打开——先下后上，你侧身进了车厢" },
];
const [carriage, setCarriage] = useState<CarriageRide | null>(null);
/* rides play ON the map (the train runs the line, the car drives the city);
   the full carriage / cab scene is one tap away */
const [rideBig, setRideBig] = useState(false);
/* the mode this trip really uses (driving without a car falls back to a taxi…) */
const [tripMode, setTripMode] = useState<TransportModeId | null>(null);
/* when the current trip arrives (epoch ms): the figure on the map paces itself to it */
const [tripEta, setTripEta] = useState<number | null>(null);
/* after changing city: which way you travelled, so the map shows you arriving from the right side */
const [arrival, setArrival] = useState<{ dx: number; dz: number; nonce: number } | undefined>(undefined);
const [carriageLog, setCarriageLog] = useState<string>("");
/* 车厢顶部的站点条：列车每到一站就把当前站滚到中间 */
const routeStripRef = useRef<HTMLDivElement | null>(null);
useEffect(() => {
const el = routeStripRef.current;
if (!el || !carriage) return;
const cur = el.querySelector<HTMLElement>(`[data-stop="${carriage.stopIdx}"]`);
if (!cur) return;
el.scrollTo({ left: Math.max(0, cur.offsetLeft - el.clientWidth / 2 + cur.offsetWidth / 2), behavior: "smooth" });
}, [carriage?.stopIdx, carriage?.route, carriage]);
/** 公交/打车的搭乘电影动画：和地铁车厢一样是弹出的活动场景
    （等车→上车→坐进车厢看窗外风景→到站下车）。每趟车都演，不管远近；
    四步按这趟行程的实际时长等分推进（每步 = 行程时长 ÷ 4），
    行程到点时若最后一步还没演满它那一份，弹窗等它演完再收起——
    绝不中途掐断。durMs 是这趟行程的地图移动时长，startedAt 是开演时刻。 */
const [roadRide, setRoadRide] = useState<{ mode: "bus" | "taxi" | "drive"; fromName: string; toName: string; fare: number; durMs: number; startedAt: number } | null>(null);
const [roadRideStep, setRoadRideStep] = useState(0);
/** 行程本身已到站（walk 定时器到点）：人物和结算照常落地，只是弹窗
    还在等最后一步演完；演完由下面的 effect 统一收起。 */
const [roadRideArrived, setRoadRideArrived] = useState(false);
useEffect(() => {
if (!roadRide || roadRideStep >= 4) return;
const stepMs = Math.max(120, roadRide.durMs / 5);
const elapsed = Date.now() - roadRide.startedAt;
const remain = Math.max(30, stepMs * (roadRideStep + 1) - elapsed);
const tm = window.setTimeout(() => setRoadRideStep((v) => Math.min(4, v + 1)), remain);
return () => window.clearTimeout(tm);
}, [roadRide, roadRideStep]);
useEffect(() => {
if (!roadRide || !roadRideArrived) return;
if (roadRideStep >= 4 && Date.now() - roadRide.startedAt >= roadRide.durMs) {
setRoadRide(null);
setRoadRideArrived(false);
}
}, [roadRide, roadRideArrived, roadRideStep]);
const [rideEntry, setRideEntry] = useState<number | null>(null);
const [mapQuery, setMapQuery] = useState("");
/* search: recent searches (kept on this device) and the place pinned on the map until the next search */
type SearchHit = { locId: string; name: string; city: CityKey; station?: boolean };
const [searchHist, setSearchHist] = useState<SearchHit[]>(() => { try { const v = JSON.parse(localStorage.getItem("shhr-search-hist") ?? "[]"); return Array.isArray(v) ? v.slice(0, 20) : []; } catch { return []; } });
const [searchFocus, setSearchFocus] = useState(false);
const [pinLoc, setPinLoc] = useState<string | null>(null);
const rememberSearch = (h: SearchHit) => setSearchHist((old) => { const next = [h, ...old.filter((x) => !(x.locId === h.locId && x.city === h.city))].slice(0, 20); try { localStorage.setItem("shhr-search-hist", JSON.stringify(next)); } catch { /* storage unavailable */ } return next; });
const clearSearchHist = () => { setSearchHist([]); try { localStorage.removeItem("shhr-search-hist"); } catch { /* storage unavailable */ } };
const [mapFocus, setMapFocus] = useState<{ locId?: string; x?: number; z?: number; nonce: number } | null>(null);
const [metroMapOpen, setMetroMapOpen] = useState(false);
const [navOpen, setNavOpen] = useState(false);
const [metroMapDest, setMetroMapDest] = useState<string | null>(null);
type VenueScene = { kind: "dine" | "shop" | "stay"; id: string };
const [venueScene, setVenueScene] = useState<VenueScene | null>(null);
const [sceneFlags, setSceneFlags] = useState<Record<string, boolean>>({});
const walkTimer = useRef<number | null>(null);
const pendingSleep = useRef(false);
const pendingRide = useRef<string | null>(null);
/* A station-to-station ride picked on the line map: walk to the boarding
   station's exit location first, then board this exact route. */
const pendingStationRide = useRef<{ route: MetroRoute; board: string; alight: string } | null>(null);
/** Final walking leg of a staged rail trip: after the ride ends at the
    station nearest the destination, walk the rest of the way there. */
const pendingAfterRide = useRef<string | null>(null);
/** the trip under way: where the figure is heading (the map follows this, not
    whatever place you happen to be browsing), and enough to stop it midway */
const [tripTo, setTripTo] = useState<string | null>(null);
const tripRef = useRef<{ fromId: string; toId: string; fx: number; fz: number; tx: number; tz: number; startedAt: number; ms: number; cost: number; mode: TransportModeId } | null>(null);
/** Latest walkTo, for callbacks (life-anim `after`) that fire from a stale
    render closure where walkTo's own walking/carriage guards are outdated. */
const [switchTrip, setSwitchTrip] = useState<{ to: string; mode: TransportModeId } | null>(null);
const walkToRef = useRef<((locId: string, modeOverride?: TransportModeId) => void) | null>(null);
const [toast, setToast] = useState<string | null>(null);
const [activeEvent, setActiveEvent] = useState<GameEvent | null>(null);
const [arcCard, setArcCard] = useState<{ id: string; reply?: string } | null>(null);
/* reopening the game mid-story: the act waiting for today comes back up */
useEffect(() => {
if (phase !== "game") return;
const t = window.setTimeout(() => { const g = gsRef.current; if (!g) return; const live = Object.entries(g.arcs ?? {}).find(([, p]) => !p.done && p.day < g.day); if (live) setArcCard((c) => c ?? { id: live[0] }); }, 2500);
return () => window.clearTimeout(t);
}, [phase]);
const [phoneApp, setPhoneApp] = useState<AppId | "trade" | null>(null);
/* round-2 (e S2): the "交易" phone app lives in App.tsx — AppId lives in
   data.ts (unowned), so the extra app is appended locally. */
const PHONE_APPS: { id: AppId | "trade"; n: string; e: string }[] = [...APPS, { id: "trade", n: "交易", e: "🛒" }];
const [phoneOpen, setPhoneOpen] = useState(false);
const [asideTab, setAsideTab] = useState<"place" | "feed" | "wall" | "chat" | "board" | "guide" | "collect">("place");
/* 长线进度：跨局保留（集章 / 图鉴 / 连续登录 / 本周目标 / 成就称号） */
const [meta, setMetaState] = useState<Meta>(() => loadMeta());
const metaRef = useRef(meta);
metaRef.current = meta;
const flashGiven = useRef("");
const claimingGifts = useRef(new Set<number>());
/* 公开编号：playerId 是只有本机知道的私钥；别人看到、邀请链接里用的都是
   它的 sha256 前 16 位（和服务器 pubOf 一致）。 */
const [myPub, setMyPub] = useState("");
const myPubRef = useRef("");
myPubRef.current = myPub;
useEffect(() => {
const id = profile?.playerId;
if (!id || !crypto?.subtle) return;
void crypto.subtle.digest("SHA-256", new TextEncoder().encode(id)).then((buf) => {
setMyPub(Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16));
}).catch(() => { /* the server's heartbeat reply fills it in */ });
}, [profile?.playerId]);
/* 分享 / 邀请 / 云存档 / 画质 */
const [lite] = useState(() => liteDefault());
const [invite] = useState(() => readInvite());
const [shareOpen, setShareOpen] = useState(false);
const [shareImg, setShareImg] = useState<{ url: string; blob: Blob } | null>(null);
const [cloudAt, setCloudAt] = useState("");
const [restoreCode, setRestoreCode] = useState("");
const [placesMapOpen, setPlacesMapOpen] = useState(false);
/* 语言 + 用户协议 / 隐私政策 */
const [lang, setLangState] = useState<Lang>(() => getLang());
/* 剧情 / 传承的文案：英文界面直接取英文稿（整段长句交给 DOM 翻译器容易漏） */
const L = (zh: string) => (lang === "en" ? storyEN(zh) : zh.split(PART).join(""));
const en = lang === "en";
const switchLang = (l: Lang) => {
setLangStored(l);
// back to Chinese: reload so every translated text node returns to its source
if (l === "zh" && lang !== "zh") { window.location.reload(); return; }
setLangState(l);
};
useEffect(() => { installTranslator(lang); }, [lang]);
const langToggle = (cls = "") => (
<span className={`inline-flex shrink-0 overflow-hidden rounded-full border border-[var(--line)] ${cls}`}>{LANGS.map((l) => <button key={l.id} type="button" aria-label={l.id === "zh" ? "切换到中文" : "Switch to English"} onClick={() => switchLang(l.id)} className={`px-2.5 py-1.5 text-[11px] font-black ${lang === l.id ? "bg-[var(--text)] text-[var(--bg)]" : "bg-[var(--surface)]"}`}>{l.label}</button>)}</span>
);
const [legalDoc, setLegalDoc] = useState<null | "terms" | "privacy">(null);
const [agreed, setAgreed] = useState(() => { try { return localStorage.getItem("shhr-legal") === LEGAL_VERSION; } catch { return false; } });
const setAgreedStored = (v: boolean) => { setAgreed(v); try { if (v) localStorage.setItem("shhr-legal", LEGAL_VERSION); else localStorage.removeItem("shhr-legal"); } catch { /* storage unavailable */ } };
const [quiz, setQuiz] = useState<{ key: string; opts: string[]; picked: string | null } | null>(null);
/* 📌 固定收起：钉住后地区面板不再自动弹出，只有点右侧竖条才展开 */
const [asideOpen, setAsideOpen] = useState(false);
/* Top-area compaction: status detail / Summit activity / city intro all
   start folded away behind one-line bars so the map stays the hero. */
const [fold, setFold] = useState<"hud" | "apec" | "intro" | null>(null);
/* Whole-bar collapse: each of the three floating bars folds away
   VERTICALLY into the rail of small buttons down the screen's left edge
   （状态 / Summit / 深圳/惠州）, freeing more of the map; tapping a rail
   button brings its bar back. All shown by default. */
const [barsHidden, setBarsHidden] = useState(false);
/* 观景时刻: the running scenic moment (camera flies in, sky turns to sunset / night) */
const [scenicMoment, setScenicMoment] = useState<{ m: ScenicMoment; at: number; nonce: number } | null>(null);
const [scenicLine, setScenicLine] = useState(0);
/* phones: the status card shows the essentials; the rest folds behind “⋯ More” */
const [hudMore] = useState(false);
const [menuOpen, setMenuOpen] = useState(false);
const [musicOpen, setMusicOpen] = useState(false);
const [musicSel, setMusicSel] = useState<MusicPick>(musicPick);
const [placeCardOff, setPlaceCardOff] = useState(false);
/* 🔊 sound: on by default, starts on the first tap (browsers and WeChat need one); 🔇 turns it off and is remembered */
const [soundIsOn, setSoundIsOn] = useState(soundWanted);
const toggleSound = () => { const next = !soundIsOn; setSoundIsOn(next); setSound(next); track("sound", { on: next }); };
useEffect(() => {
  const wake = () => wakeSound();
  const tap = (e: Event) => { if ((e.target as HTMLElement | null)?.closest?.("button")) sfx("click"); };
  window.addEventListener("pointerdown", wake);
  window.addEventListener("touchend", wake);
  window.addEventListener("click", wake);
  window.addEventListener("click", tap, true);
  return () => { window.removeEventListener("pointerdown", wake); window.removeEventListener("touchend", wake); window.removeEventListener("click", wake); window.removeEventListener("click", tap, true); };
}, []);
/* map mode A/B: each device starts in "city" (A, see the whole city) or "follow" (B, camera on you + minimap) at random; players can switch */
const [mapMode, setMapModeState] = useState<"city" | "follow">(() => {
  try {
    const v = localStorage.getItem("shhr-mapmode"); if (v === "city" || v === "follow") return v;
    const pick = Math.random() < 0.5 ? "city" : "follow";
    localStorage.setItem("shhr-mapmode", pick); localStorage.setItem("shhr-mapmode-ab", pick);
    return pick;
  } catch { return "city"; }
});
const mapAb = (() => { try { return localStorage.getItem("shhr-mapmode-ab") ?? "?"; } catch { return "?"; } })();
const setMapMode = (m: "city" | "follow") => {
  setMapModeState(m);
  try { localStorage.setItem("shhr-mapmode", m); } catch { /* storage unavailable */ }
  track("map_mode_switch", { to: m, ab: mapAb });
  const phone = typeof window !== "undefined" && (window.innerWidth < 820 || window.innerHeight < 520);
  showToast(m === "follow"
    ? (en ? "🎯 Close view: the streets around you fill the screen." : "🎯 近景：你身边的楼占满屏幕。")
    : phone
      ? (en ? "🗺️ A wider look at your part of the city. Pinch out for the whole city." : "🗺️ 拉开一点，看你这一片。再捏合能看全城。")
      : (en ? "🗺️ Whole-city view." : "🗺️ 全城视角：一眼看全城。"));
};
const [retrainOpen, setRetrainOpen] = useState(false);
const [liveOpen, setLiveOpen] = useState(false);
const [home3d, setHome3d] = useState(false);
const [lifeOpen, setLifeOpen] = useState(false);
const [homeGuest, setHomeGuest] = useState<string | null>(null);
const [visitHome, setVisitHome] = useState<{ tier: number; style: string | null; layout: { id: string; slot: number; color: number }[] } | null>(null);
const [homePose, setHomePose] = useState<"idle" | "sit" | "sleep">("idle");
const [furnSel, setFurnSel] = useState<string | null>(null);
const [venue3d, setVenue3d] = useState<{ set: LifeSet; name: string; line: string; id?: string; emoji?: string; color?: number } | null>(null);
const [venueTalk, setVenueTalk] = useState<VenueTalk | null>(null);
/* compact screens: the right-hand panel rail folds behind one ☰ button */
/* Map fullscreen: the map shell becomes a fixed full-viewport stage
   (plus the native Fullscreen API when the browser allows it). */
const [mapFullscreen, setMapFullscreen] = useState(false);
const mapShellRef = useRef<HTMLDivElement | null>(null);
/* 全屏看地图时地区面板默认收起：选地点、搜索、换城市都不再自动弹出，
   只有点右侧竖条才展开。 */
const mapFullscreenRef = useRef(false);
/* 📌 固定：面板钉住后不被点空白收起、不挡地图操作，全屏也保持打开 */
const [asidePinned, setAsidePinned] = useState(() => { try { return localStorage.getItem("shhr-pin-aside") === "1"; } catch { return false; } });
const [navPinned, setNavPinned] = useState(() => { try { return localStorage.getItem("shhr-pin-nav") === "1"; } catch { return false; } });
const asidePinnedRef = useRef(asidePinned); asidePinnedRef.current = asidePinned;
const navPinnedRef = useRef(navPinned); navPinnedRef.current = navPinned;
const togglePin = (which: "aside" | "nav") => {
const set = which === "aside" ? setAsidePinned : setNavPinned;
set((v) => { const nv = !v; try { localStorage.setItem(`shhr-pin-${which}`, nv ? "1" : "0"); } catch { /* storage unavailable */ } return nv; });
};
mapFullscreenRef.current = mapFullscreen;
/* the bottom place card shows the selected place; the full panel opens only when asked (its column is always on screen) */
const autoOpenAside = () => { setPlaceCardOff(false); };
const wasFullscreen = useRef(false);
useEffect(() => {
if (mapFullscreen) setAsideOpen(false);

wasFullscreen.current = mapFullscreen;
}, [mapFullscreen]);
const exitMapFullscreen = () => {
  setMapFullscreen(false);
  const doc = document as Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  else if (doc.webkitFullscreenElement) doc.webkitExitFullscreen?.();
};
useEffect(() => {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  const onFs = () => { if (!document.fullscreenElement && !doc.webkitFullscreenElement) setMapFullscreen(false); };
  document.addEventListener("fullscreenchange", onFs);
  document.addEventListener("webkitfullscreenchange", onFs);
  // Capture so Esc still leaves while the search box is focused. The browser
  // often swallows Esc for its own fullscreen exit and never delivers the key,
  // so fullscreenchange above is the other path; when the key does arrive,
  // exit the Fullscreen API ourselves instead of only flipping React state.
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape" && e.key !== "Esc") return;
    if (!mapFullscreenRef.current && !document.fullscreenElement && !doc.webkitFullscreenElement) return;
    e.preventDefault();
    exitMapFullscreen();
  };
  window.addEventListener("keydown", onKey, true);
  return () => {
    document.removeEventListener("fullscreenchange", onFs);
    document.removeEventListener("webkitfullscreenchange", onFs);
    window.removeEventListener("keydown", onKey, true);
  };
}, []);
useEffect(() => {
  if (!mapFullscreen) return;
  const prev = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => { document.body.style.overflow = prev; };
}, [mapFullscreen]);
const toggleMapFullscreen = () => {
  if (mapFullscreen) {
    exitMapFullscreen();
  } else {
    setMapFullscreen(true);
    setAsideOpen(false);
    // Fullscreen the whole page, not the map shell: in native fullscreen
    // only the fullscreen element's subtree is painted, so popups living
    // outside the shell (metro carriage, bus/taxi ride, life scenes, toasts,
    // daily tasks, share…) would never show up.
    const el = document.documentElement;
    if (el.requestFullscreen) void el.requestFullscreen().catch(() => {});
  }
};
/* ---- 手游件：弹幕 / 奖励飘字 / 每日任务弹窗 / 升职特效 ----
   弹幕借鉴直播间：联机动态、城市聊天、街坊发言飘过地图；峰会上岗、
   打卡成功、升职这些时刻由街坊弹幕刷屏庆祝。可在地图左中开关。 */
const [danmakuOn, setDanmakuOn] = useState(true);
const [danmaku, setDanmaku] = useState<{ id: number; text: string; top: number; dur: number; color: string }[]>([]);
const danmakuIdRef = useRef(0);
const danmakuOnRef = useRef(true);
danmakuOnRef.current = danmakuOn;
const pushDanmaku = (text: string) => {
if (!danmakuOnRef.current) return;
const id = ++danmakuIdRef.current;
const colors = ["#ffffff", "#ffd34d", "#7ef0c9", "#ffb3c7", "#a8d8ff"];
const item = { id, text: text.slice(0, 46), top: 4 + Math.random() * 34, dur: 8 + Math.random() * 5, color: colors[id % colors.length]! };
setDanmaku((arr) => [...arr.slice(-13), item]);
window.setTimeout(() => setDanmaku((arr) => arr.filter((d) => d.id !== id)), item.dur * 1000 + 400);
};
const pushDanmakuRef = useRef(pushDanmaku);
pushDanmakuRef.current = pushDanmaku;
const burstDanmaku = (lines: string[]) => {
lines.forEach((t, i) => window.setTimeout(() => pushDanmakuRef.current(t), i * 300));
};
const [floaters, setFloaters] = useState<{ id: number; text: string; tone: "gold" | "green" | "red" | "blue" }[]>([]);
const floatIdRef = useRef(0);
const floatReward = (text: string, tone: "gold" | "green" | "red" | "blue" = "gold") => {
if (tone === "gold") sfx("coin");
const id = ++floatIdRef.current;
setFloaters((arr) => [...arr.slice(-4), { id, text, tone }]);
window.setTimeout(() => setFloaters((arr) => arr.filter((f) => f.id !== id)), 2000);
};
const [levelFx, setLevelFx] = useState<{ name: string; nonce: number } | null>(null);
const [dailyOpen, setDailyOpen] = useState(false);
const justStartedRef = useRef(false);
const dailyShownRef = useRef(0);
const [chatInput, setChatInput] = useState("");
const [result, setResult] = useState<ReturnType<typeof computeResult> | null>(null);
const [legacyGain, setLegacyGain] = useState<{ pts: number; parts: string[] } | null>(null);
/* 独立玩法：正在玩的小游戏、约会对象选择、组局广场、组局结果 */
const [play, setPlay] = useState<{ act: Activity; spec: GameSpec; partyId?: number; mate?: string } | null>(null);
const [datePick, setDatePick] = useState<Activity | null>(null);
const [partyOpen, setPartyOpen] = useState(false);
/** 跨城路线选择：去哪座城（null = 关着） */
const [crossTo, setCrossTo] = useState<CityKey | null>(null);
const [partyResult, setPartyResult] = useState<number | null>(null);
/* 点人：玩家名片、私信窗口（peer = 对方公开 id） */
const [cardOf, setCardOf] = useState<string | null>(null);
const [dmOpen, setDmOpen] = useState(false);
const [accountOpen, setAccountOpen] = useState(false);
const [storeOpen, setStoreOpen] = useState(false);
const [updatesOpen, setUpdatesOpen] = useState(false);
const [updateSeen, setUpdateSeen] = useState(() => { try { return localStorage.getItem("shhr-update-seen") ?? ""; } catch { return ""; } });
const [bondsOpen, setBondsOpen] = useState(false);
const [committeeOpen, setCommitteeOpen] = useState(false);
const [gigsOpen, setGigsOpen] = useState(false);
const [adsOpen, setAdsOpen] = useState(false);
/* back from the Stripe payment page: ?paid=<order> (or cancel) */
useEffect(() => {
  const q = new URLSearchParams(window.location.search).get("paid");
  if (!q) return;
  window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  if (q !== "cancel") window.setTimeout(() => setStoreOpen(true), 2500); // the webhook usually lands within a second or two
}, []);
const [loggedIn, setLoggedIn] = useState(() => !!accountToken());
const [dmPeer, setDmPeer] = useState<string | null>(null);
const [dmInput, setDmInput] = useState("");
/* 「现在能干嘛」总览 */
const [hubOpen, setHubOpen] = useState(false);
const [hubCat, setHubCat] = useState<ActCat | "all">("all");
const [hubOpenOnly, setHubOpenOnly] = useState(true);
const [lifeAnim, setLifeAnim] = useState<{ kind: LifeKind; idx: number } | null>(null);
const lifeAfterRef = useRef<(() => void) | null>(null);
/* NPC simulation: who you're chatting with + the running conversation */
const [npcChat, setNpcChat] = useState<string | null>(null);
const [npcLog, setNpcLog] = useState<{ from: "me" | "npc"; text: string }[]>([]);
/* 街坊连续剧：聊天窗里当前摊开的这一章（等你做选择） */
const [storyOpen, setStoryOpen] = useState<string | null>(null);
const [setupName, setSetupName] = useState("");
const [setupCity, setSetupCity] = useState<CityKey>("sz");
const [setupIden, setSetupIden] = useState(IDENTITIES[0]!.id);
/* 抽签投胎: the drawn origin, the slot-machine flicker while drawing, rerolls left */
const [drawn, setDrawn] = useState<Origin | null>(null);
const [shuffle, setShuffle] = useState<Origin | null>(null);
const [rerolls, setRerolls] = useState(2);
const tierAt = (st: GameState) => tierNow(st.startTier ?? tierOfIden(st.idenId), st.money, st.goal, IDENTITIES.find((i) => i.id === st.idenId)?.money ?? 1500);
const drawFate = () => {
  if (shuffle) return;
  if (drawn) { if (rerolls <= 0) return; setRerolls((n) => n - 1); }
  const final = drawOrigin(Math.random, drawn?.id, { apec: setupCity === "sz" && isApecSeason() });
  let k = 0;
  const tick = () => {
    k += 1;
    if (k < 12) { setShuffle(ORIGINS[Math.floor(Math.random() * ORIGINS.length)]!); window.setTimeout(tick, 45 + k * 9); }
    else { setShuffle(null); setDrawn(final); track("origin_draw", { origin: final.id, tier: final.tier }); }
  };
  tick();
};
const finishedSent = useRef(false);
const toastTimer = useRef<number | null>(null);

/* Display currency follows the city you are standing in — Hong Kong
   prices everything in HK$, Shenzhen/Huizhou in ¥. This `fmt` shadows
   the module-level one so every amount rendered or logged inside the
   game (balance, pay, rent, food, fares, other players' board rows
   aside) uses the current city's currency; on the setup screen it
   follows the city being picked (identity money, daily pay, the rules
   line), so picking 香港 shows HK$ from the very first screen. The one
   deliberate exception is a cross-border fare, which is labelled in
   the DEPARTURE city's currency via crossFareLabel. `Y` is the bare
   symbol for strings that build their own number formatting, and
   locText re-denominates fixed copy (random-event text authored with
   ¥) when the player is in Hong Kong. */
const fmt = (n: number, ck?: CityKey) => fmtMoney(n, ck ?? gsRef.current?.cityKey ?? setupCity);
const Y = curSym(gs?.cityKey ?? setupCity);
const locText = (t: string, ck?: CityKey) => ((ck ?? gsRef.current?.cityKey) === "hk" ? t.replaceAll("¥", "HK$") : t);

const cityKey: CityKey = gs?.cityKey?? "sz";
/* 赛季 = 北京时间的一个自然月；星期、峰会都按本局所在的月份算 */
setSeason(gs?.startKey ?? seasonStartFor());
const seasonLen = seasonLength(gs?.startKey ?? seasonStartFor());
const seasonMo = seasonMonth(gs?.startKey ?? seasonStartFor());
/* 今日城市事件：同一天、同城、同游戏日的玩家看到的一样 */
const todayEvent: CityEvent = useMemo(() => dailyEvent(gs?.cityKey ?? "sz", gs?.day ?? 1, COMPANIES, stationNamesOf(gs?.cityKey ?? "sz")), [gs?.cityKey, gs?.day]);
const evRef = useRef(todayEvent);
evRef.current = todayEvent;
const worldQuery = useQuery({
queryKey: ["world", cityKey],
queryFn: () => api.getWorld({ cityKey}),
// during play the 6 s heartbeat already returns the world snapshot; this
// poll is only a fallback
refetchInterval: phase === "game"? 20000: 15000,
});
const world: World | undefined = worldQuery.data?.world;
/* 组局广场：同城的局，4 秒刷新一次（世界快照有缓存，组局要更及时） */
const partiesQuery = useQuery({
queryKey: ["parties", cityKey, profile?.playerId ?? ""],
queryFn: () => api.getParties({ cityKey, playerId: profile!.playerId }),
enabled: !!profile && phase === "game",
refetchInterval: 4000,
});
const parties = partiesQuery.data?.parties ?? [];
/* 统计：进入游戏算一次会话 */
useEffect(() => {
if (phase !== "game" || !profile) return;
setAnalyticsPlayer(profile.playerId);
track("session_start", { city: gs?.cityKey ?? "sz", day: gs?.day ?? 0, lang, mapMode, mapAb });
}, [phase, profile?.playerId]);
/* 私信：5 秒刷新一次收件箱 */
const inboxQuery = useQuery({
queryKey: ["inbox", profile?.playerId ?? ""],
queryFn: () => api.getInbox({ playerId: profile!.playerId }),
enabled: !!profile && phase === "game",
refetchInterval: 5000,
});
const threads = inboxQuery.data?.threads ?? [];
const unreadDm = threads.reduce((n, t) => n + t.unread, 0);
/* 真人关系 + 业委会：一分钟刷新一次 */
const bondsQuery = useQuery({
queryKey: ["bonds", profile?.playerId ?? ""],
queryFn: () => api.getBonds({ playerId: profile!.playerId }),
enabled: !!profile && phase === "game",
refetchInterval: 60_000,
});
const bonds = bondsQuery.data?.bonds ?? [];
const bondInvites = bonds.filter((b) => b.status === "pending" && !b.mine).length;
const committeeQuery = useQuery({
queryKey: ["committee", profile?.playerId ?? "", gs?.cityKey ?? "sz"],
queryFn: () => api.committeeState({ playerId: profile!.playerId, city: gs?.cityKey ?? "sz" }),
enabled: !!profile && phase === "game" && !!gs,
refetchInterval: 120_000,
});
/* 📢 广告牌 + 📣 运营公告 */
const billboardsQuery = useQuery({
queryKey: ["billboards", gs?.cityKey ?? "sz"],
queryFn: () => api.getBillboards({ city: gs?.cityKey ?? "sz" }),
enabled: phase === "game" && !!gs,
refetchInterval: adsOpen ? 15_000 : 300_000,
});
const newsQuery = useQuery({ queryKey: ["news"], queryFn: () => api.getAnnouncements({}), enabled: phase === "game", refetchInterval: 600_000 });
const news = newsQuery.data?.items ?? [];
const latestKey = news[0] ? `${LATEST_UPDATE}#${news[0].id}` : LATEST_UPDATE;
/* 零工：一分钟刷新；有到账的工钱 / 退款自动收进钱包 */
const gigsQuery = useQuery({
queryKey: ["gigs", profile?.playerId ?? "", gs?.cityKey ?? "sz"],
queryFn: () => api.getGigs({ playerId: profile!.playerId, city: gs?.cityKey ?? "sz" }),
enabled: !!profile && phase === "game" && !!gs,
refetchInterval: gigsOpen ? 15_000 : 60_000,
});
const gigClaiming = useRef(false);
useEffect(() => {
  if (!profile || phase !== "game" || !(gigsQuery.data?.unclaimed) || gigClaiming.current) return;
  gigClaiming.current = true;
  void api.claimGigMoney({ playerId: profile.playerId }).then((r) => {
    if (r.ok && r.money > 0) { mutate((x) => { x.money += r.money; x.earned += r.money; }); floatReward(`+${fmt(r.money)}`, "gold"); showToast(`💼 ${r.lines.join("；")}`); void gigsQuery.refetch(); }
  }).catch(() => {}).finally(() => { gigClaiming.current = false; });
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [gigsQuery.data?.unclaimed, phase]);
const gigActive = (gigsQuery.data?.mine ?? []).filter((g) => (g.role === "worker" && g.status === "taken") || (g.role === "employer" && g.status === "delivered")).length;

/* ================= round-2: feature state + server queries ================= */
/* (c) pets — localStorage-backed, server sync is fire-and-forget */
const [pets, setPets] = useState<PetsState>(() => deserializePets(localStorage.getItem(PET_STORAGE_KEY)));
const petsRef = useRef(pets); petsRef.current = pets;
useEffect(() => { try { localStorage.setItem(PET_STORAGE_KEY, serializePets(pets)); } catch { /* storage unavailable */ } }, [pets]);
/* (e) economy — local book (server is source of truth for shared listings) */
const [econ, setEcon] = useState<EconomyState>(() => emptyEconomyState());
const econRef = useRef(econ); econRef.current = econ;
/* (d) black landlord / company reports */
const reportBook = useMemo(() => new ReportBook(), []);
const reportApi = useMemo(() => asReportTransport(api), []);
const [reportDraft, setReportDraft] = useState<ReportDraft | null>(null);
const reportsQuery = useQuery({
  queryKey: ["blackReports", gs?.cityKey],
  enabled: !!profile && !!gs,
  queryFn: () => reportApi.getBlackReports({ playerId: profile!.playerId, city: gs?.cityKey ?? "sz" }),
});
/* (c) community — strays / notices / snakes / fishing spots */
const straysQuery = useQuery({ queryKey: ["strays", cityKey], queryFn: () => api.getStrays({ cityKey, playerId: profile!.playerId }), enabled: phase === "game" && !!profile });
const noticesQuery = useQuery({ queryKey: ["notices", cityKey], queryFn: () => api.getNotices({ cityKey, playerId: profile!.playerId }), refetchInterval: 120_000, enabled: phase === "game" && !!profile });
const snakesQuery = useQuery({ queryKey: ["snakes", cityKey], queryFn: () => api.getSnakeWarnings({ cityKey, playerId: profile!.playerId }), refetchInterval: 120_000, enabled: phase === "game" && !!profile });
const fishingQuery = useQuery({ queryKey: ["fishing", cityKey], queryFn: () => api.getFishingSpots({ cityKey, playerId: profile!.playerId }), refetchInterval: 300_000, enabled: phase === "game" && !!profile });
/* (e) flea stock (server deterministic ids) + trade board (server) */
const [fleaOpen, setFleaOpen] = useState(false);
const fleaQuery = useQuery({ queryKey: ["flea", cityKey, gs?.day], queryFn: () => api.getFleaStock({ city: gs?.cityKey ?? "sz", day: gs?.day ?? 1 }), enabled: fleaOpen && phase === "game" });
const tradeQuery = useQuery({ queryKey: ["tradeTasks", cityKey], queryFn: () => api.getTradeTasks({ city: gs?.cityKey ?? "sz", openOnly: true, limit: 50 }), enabled: phase === "game" && !!profile });
/* (e) sublet listings (server) */
const subletQuery = useQuery({ queryKey: ["sublets", cityKey], queryFn: () => api.getSubletListings({ city: gs?.cityKey ?? "sz", openOnly: true }), enabled: phase === "game" && !!profile });
/* (f) job board (server ladder + player gigs) */
const [jobCenterOpen, setJobCenterOpen] = useState(false);
const [jobTab, setJobTab] = useState<"jobs" | "guide" | "interview" | "help">("jobs");
const jobBoardQuery = useQuery({ queryKey: ["jobBoard", cityKey], queryFn: () => api.listJobBoard({ city: gs?.cityKey ?? "sz", playerId: profile?.playerId }), enabled: jobCenterOpen && !!profile });
/* (h) shared delivery pool (server) */
const poolQuery = useQuery({ queryKey: ["pool", cityKey], queryFn: () => api.deliveryPoolList({ playerId: profile!.playerId, city: gs?.cityKey ?? "sz" }), refetchInterval: 30_000, enabled: phase === "game" && !!profile });
/* (h) delivery cart (hoisted: renderPhoneApp is a plain function, not a component) */
const [deliveryCart, setDeliveryCart] = useState<{ key: string; qty: number }[]>([]);
const [courierBoard, setCourierBoard] = useState<CourierGig[]>([]);
/* (g) phone fullscreen + house building + police + lifestyles panels */
const [phoneFull, setPhoneFull] = useState(false);
const phoneSheetRef = useRef<HTMLDivElement | null>(null);
const [buildOpen, setBuildOpen] = useState(false);
const [houseLayout, setHouseLayout] = useState<HouseLayout>(() => loadHouseLayout() ?? emptyHouseLayout());
const [patrolling, setPatrolling] = useState(false);
const [sanheOpen, setSanheOpen] = useState(false);
const [checkinOpen, setCheckinOpen] = useState(false);
const [tradeTab, setTradeTab] = useState<"board" | "overseas">("board");
const [tradeTitle, setTradeTitle] = useState("");
const [tradeBody, setTradeBody] = useState("");
const [tradePrice, setTradePrice] = useState("");
const [tradeKind, setTradeKind] = useState<"buy" | "sell" | "swap" | "service" | "other">("sell");
/* (c) community post forms */
const [noticeTitle, setNoticeTitle] = useState("");
const [noticeBody, setNoticeBody] = useState("");
const [noticeKind, setNoticeKind] = useState<"lost-pet" | "lost-item" | "found-pet" | "found-item">("lost-pet");
const [snakeSpecies, setSnakeSpecies] = useState("");
const [snakeDesc, setSnakeDesc] = useState("");
const [fishDesc, setFishDesc] = useState("");
/* (e) overseas orders (server) */
const overseasQuery = useQuery({ queryKey: ["overseas", profile?.playerId ?? ""], queryFn: () => api.getOverseasOrders({ playerId: profile!.playerId }), enabled: phase === "game" && !!profile && phoneOpen && phoneApp === "trade" });
/* (f) rent negotiation stash — the Saturday rent run reads this */
const rentDealRef = useRef<{ delayDays?: number; dueMul?: number }>({});
const lastTickDayRef = useRef(0);
const lifeSavedRef = useRef("");
/* (d) merge server reports into the local book; apply the server-side rent
   rollback on load (S, critical) — otherwise a save/load resurrects the
   raised rent. getBlackReports also returns `standing` + `rentRollback`,
   which the client type doesn't declare, so read them via a cast. */
useEffect(() => {
  if (!reportsQuery.data) return;
  const d = reportsQuery.data as typeof reportsQuery.data & { standing?: { credibility: number; filedCount: number; upheldCount: number; rejectedCount: number; lockedUntil: string | null }; rentRollback?: { rent: number; baseRent: number } | null };
  reportBook.mergeReports([...d.mine, ...d.jury, ...d.exposed]);
  for (const r of d.reputations) reportBook.noteReputation(r);
  if (d.standing) {
    reportBook.state.standing = { ...reportBook.state.standing, credibility: d.standing.credibility, filedCount: d.standing.filedCount, upheldCount: d.standing.upheldCount, rejectedCount: d.standing.rejectedCount, lockedUntil: d.standing.lockedUntil };
    reportBook.save();
  }
  if (d.rentRollback) {
    const rb = d.rentRollback;
    mutate((x) => { x.rent = rb.rent; x.baseRent = rb.baseRent; });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [reportsQuery.data]);
/* (f) push the lifestyle state to the server when it changes (fire-and-forget;
   local is the source of truth for money — no endpoint here moves real money). */
useEffect(() => {
  const l = gs?.life; if (!l || !profile) return;
  const key = JSON.stringify(l); if (key === lifeSavedRef.current) return;
  lifeSavedRef.current = key;
  void api.saveLifestyle({ playerId: profile.playerId, day: gs?.day ?? 1, life: l as unknown as Record<string, unknown> }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [gs?.life, profile?.playerId]);
/* (c) homecoming greeting — first return home each day */
useEffect(() => {
  if (phase !== "game" || currentLoc !== "home") return;
  const greet = homecomingGreeting(petsRef.current);
  if (greet) { setPets((p) => ({ ...p, pets: [...p.pets] })); showToast(greet.text); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentLoc, phase]);
/* (f) profile builder + generic lifestyle-action handler (LOG-f S6/S7) */
const lifeProfile = (st: GameState): PlayerProfile => ({
  skill: st.skill, xp: st.xp,
  gigs: [...(st.npcGigs ?? []).map((g) => g.split(":").pop() ?? g), ...(st.arcs ? Object.keys(st.arcs) : [])],
  coursesDone: (st.life?.flat.courses ?? []).filter((c) => c.done).map((c) => c.id),
  interviewReady: st.life?.flat.interviewReady ?? 0,
  day: st.day, city: st.cityKey,
});
const applyLife = (res: LifeResult) => {
  if (!res.ok) { showToast(res.reason ? (en ? res.reason[1] : res.reason[0]) : ""); return; }
  if (res.rentDelayDays !== undefined || res.rentDueMul !== undefined) rentDealRef.current = { delayDays: res.rentDelayDays, dueMul: res.rentDueMul };
  mutate((x) => {
    x.life = res.state;
    const d = res.delta;
    if (d.money) { x.money += d.money; if (d.money > 0) x.earned += d.money; x.maxMoney = Math.max(x.maxMoney, x.money); }
    if (d.energy) x.energy = clamp(x.energy + d.energy, 0, 100);
    if (d.mood) x.mood = clamp(x.mood + d.mood, 0, 100 + (res.state.flat.moodCapBonus ?? 0));
    if (d.hunger) x.hunger = clamp100(x.hunger + d.hunger);
    if (d.clean) x.clean = clamp100(x.clean + d.clean);
    if (d.social) x.social = clamp100(x.social + d.social);
    if (d.fun) x.fun = clamp100(x.fun + d.fun);
    if (d.xp) x.xp += d.xp;
    if (d.skill) x.skill += d.skill;
    if (d.network) x.network += d.network;
    if (d.fit) x.fit += d.fit;
    if (res.hiredIdentityId) { x.idenId = res.hiredIdentityId; }
  });
  res.lines.forEach((l) => showToast(en ? l[1] : l[0]));
};
/* (d) jury vote + claim a verdict (mirrors the gig jury flow) */
const voteBlack = async (report: BlackReport, side: "uphold" | "reject") => {
  if (!profile) return;
  try {
    const r = await reportApi.blackReportVote({ playerId: profile.playerId, reportId: report.id, side });
    if (r.ok) { showToast(en ? "Voted — the majority decides when it closes." : "投票了，结案后按多数执行。"); void reportsQuery.refetch(); }
    else showToast(r.error ?? "");
  } catch { showToast(en ? "Network hiccup" : "网络不太好"); }
};
const claimBlack = async (report: BlackReport) => {
  if (!profile) return;
  try {
    const r = await reportApi.claimBlackReport({ playerId: profile.playerId, reportId: report.id });
    if (!r.ok) { showToast(r.error ?? ""); return; }
    if (report.status === "upheld" && r.remedy) {
      const lines: string[] = [];
      mutate((x) => {
        if (!r.remedy) return;
        const ls = report.kind === "landlord"
          ? applyLandlordVerdict(x, r.remedy as LandlordRemedy, en)
          : applyEmployerVerdict(x, r.remedy as EmployerRemedy, en);
        lines.push(...ls);
      });
      for (const l of [...lines, ...r.lines]) addLog(l);
      reportBook.state.standing = applyTrueReportGain(reportBook.state.standing);
      addLog(exposureLine(report, en));
    } else if (report.status === "rejected") {
      const p = applyFalseReportPenalty(reportBook.state.standing, en);
      reportBook.state.standing = p.standing;
      for (const l of p.lines) addLog(l);
    }
    reportBook.save();
    void reportsQuery.refetch();
  } catch { showToast(en ? "Network hiccup" : "网络不太好"); }
};
/* (c) sync the local pet book to the server (device-switch backup) */
const syncPetsToServer = (state: PetsState, adoptedStrayId?: string) => {
  if (!profile) return;
  void api.syncPets({
    playerId: profile.playerId,
    pets: state.pets.slice(0, 3).map((p) => ({ id: p.id, kind: p.kind, breed: p.breed.slice(0, 16), name: p.name, color: p.color, source: p.source, adoptedDay: p.adoptedDay, adoptedAt: p.adoptedAt, stats: p.stats, tricks: p.tricks, personality: p.personality, interactionsToday: p.interactionsToday, lastTickDay: p.lastTickDay, greetedToday: p.greetedToday })),
    activePetId: state.activePetId ?? null,
    ...(adoptedStrayId ? { adoptedStrayId } : {}),
  }).catch(() => {});
};
/* (h) delivery handlers */
const publishDeliveryToPool = (order: CustomerOrder) => {
  const s0 = gsRef.current; if (!s0 || !profile) return;
  const dest = locById(currentLocRef.current);
  void api.deliveryPoolPublish({ playerId: profile.playerId, city: s0.cityKey, order: { ...poolPayloadFor(order, dest?.name ?? "家"), destId: dest?.id } }).catch(() => {});
};
const submitDeliveryOrder = (cart: { key: string; qty: number }[], platformId = DELIVERY_PLATFORMS[0]!.id, couponId?: string) => {
  const s0 = gsRef.current; if (!s0) return;
  const d = s0.delivery ?? emptyDeliveryState();
  const r = placeOrder({ city: s0.cityKey, platformId, items: cart, couponId, coupons: d.coupons, memberUntilDay: d.memberUntilDay, day: s0.day, now: Date.now() });
  if (!r.ok || !r.order || r.charge === undefined) { showToast(r.error ?? "下单失败。"); return; }
  if (s0.money < r.charge) { showToast("钱不够点这单外卖。"); return; }
  mutate((x) => {
    x.money -= r.charge!; x.delivery = pushOrder(x.delivery ?? emptyDeliveryState(), r.order!);
    if (couponId) x.delivery.coupons = (x.delivery ?? emptyDeliveryState()).coupons.filter((c) => c.id !== couponId);
  });
  addLog(`用${DELIVERY_PLATFORMS.find((p) => p.id === platformId)?.name ?? ""}点了${r.order.restaurantName}外卖，-${fmt(r.charge)}。`);
  showToast(`🛵 下单成功！${r.order.riderName}正在赶往商家，预计 ${Math.round((r.order.etaAt - Date.now()) / 60_000)} 分钟送达。`);
  setDeliveryCart([]);
  setPhoneOpen(false);
  void publishDeliveryToPool(r.order);
};
const eatDeliveryOrder = (orderId: string) => {
  const s0 = gsRef.current; if (!s0?.delivery) return;
  const o = s0.delivery.orders.find((x) => x.id === orderId); if (!o) return;
  const r = eatDelivered(o);
  if (!r.ok) { showToast(r.error ?? "还没送到。"); return; }
  mutate((x) => {
    const d = x.delivery ?? emptyDeliveryState();
    x.energy = clamp100(x.energy + r.energy); x.mood = clamp100(x.mood + r.mood);
    x.hunger = clamp100(x.hunger + r.hunger); x.mealCount += 1;
    x.delivery = updateOrder(d, { ...o, stage: "eaten" });
  });
  showToast(`🍽️ ${o.items.map((i) => i.name).join("、")}吃完了，能量 +${r.energy}，心情 +${r.mood}。`);
  playLifeAnim("eat");
};
const cancelDeliveryOrder = (orderId: string) => {
  const s0 = gsRef.current; if (!s0?.delivery) return;
  const o = s0.delivery.orders.find((x) => x.id === orderId); if (!o) return;
  const { order, refund } = cancelOrder(o, Date.now());
  mutate((x) => {
    x.money += refund;
    x.delivery = updateOrder(x.delivery ?? emptyDeliveryState(), order);
  });
  showToast(refund > 0 ? `订单已取消，退回 ${fmt(refund)}。` : "订单已取消。");
};
const buyDeliveryMembership = () => {
  const s0 = gsRef.current; if (!s0 || s0.money < MEMBERSHIP_PRICE) { showToast("钱不够买月卡。"); return; }
  mutate((x) => {
    const d = x.delivery ?? emptyDeliveryState();
    x.money -= MEMBERSHIP_PRICE;
    x.delivery = { ...d, memberUntilDay: s0.day + MEMBERSHIP_DAYS };
  });
  showToast(`💳 外卖月卡已开通，30 天内免配送费 + 95 折。`);
};
const refreshCourierBoard = () => {
  const s0 = gsRef.current; if (!s0) return;
  const d = s0.delivery ?? emptyDeliveryState();
  const stops = getLocations(s0.cityKey).map((l) => ({ id: l.id, name: l.name, type: l.type, x: l.x, z: l.z }));
  const board = generateCourierBoard({
    stops, city: s0.cityKey, now: Date.now(), nowMin: nowMin(),
    rainy: nowRainy, profile: d.courier,
    excludeShopIds: routineToday(s0).order?.shop ? [routineToday(s0).order!.shop] : [],
  });
  setCourierBoard(board);
};
const courierAccept = (g: CourierGig) => {
  const s0 = gsRef.current; if (!s0 || !profile) return;
  const d = s0.delivery ?? emptyDeliveryState();
  const r = acceptGig(g, d.activeGigs, d.courier, Date.now());
  if (!r.ok || !r.gig) { showToast(r.error ?? "接不了这单。"); return; }
  mutate((x) => { const dd = x.delivery ?? emptyDeliveryState(); x.delivery = { ...dd, activeGigs: [...dd.activeGigs, r.gig!] }; });
  setCourierBoard((b) => b.filter((x) => x.id !== g.id));
  if (g.poolId !== undefined) void api.deliveryPoolClaim({ playerId: profile.playerId, city: s0.cityKey, poolId: String(g.poolId) }).catch(() => {});
  showToast(`接单：${g.shopName} → ${g.destName}，先去商家取餐。`);
};
const courierPickup = (g: CourierGig) => {
  const s0 = gsRef.current; if (!s0 || !profile) return;
  const r = pickupGig(g, currentLoc === g.shopId, Date.now());
  if (!r.ok || !r.gig) { showToast(r.error ?? ""); return; }
  mutate((x) => { const dd = x.delivery ?? emptyDeliveryState(); x.delivery = { ...dd, activeGigs: dd.activeGigs.map((gg) => gg.id === g.id ? r.gig! : gg) }; });
  if (g.poolId !== undefined) void api.deliveryPoolPickedUp({ playerId: profile.playerId, poolId: String(g.poolId) }).catch(() => {});
  showToast(`已取餐，送往${g.destName}。`);
};
const courierDeliver = async (g: CourierGig) => {
  const s0 = gsRef.current; if (!s0 || !profile) return;
  const d = s0.delivery ?? emptyDeliveryState();
  const r = deliverGig(g, { atDest: currentLoc === g.destId, climbedStairs: true, now: Date.now(), day: s0.day, profile: d.courier });
  if (!r.ok) { showToast(r.error ?? ""); return; }
  let pay = r.pay, tip = r.tip;
  if (g.poolId !== undefined) {
    try {
      const pr = await api.deliveryPoolDelivered({ playerId: profile.playerId, poolId: String(g.poolId) });
      if (pr.ok && pr.pay !== undefined) { pay = pr.pay; tip = pr.tip ?? 0; }
    } catch { /* server unreachable — keep the local pay */ }
  }
  mutate((x) => {
    const dd = x.delivery ?? emptyDeliveryState();
    x.money += pay; x.earned += pay;
    x.delivery = { ...dd, courier: r.profile, activeGigs: dd.activeGigs.filter((gg) => gg.id !== g.id), gigHistory: [{ id: g.id, shopName: g.shopName, destName: g.destName, pay, late: r.late, day: s.day }, ...dd.gigHistory] };
  });
  showToast(`送达！收入 ${fmt(pay)}${tip > 0 ? `（含小费 ${fmt(tip)}）` : ""}${r.late ? "（超时了，扣了点钱）" : ""}。`);
};
const courierCancel = (g: CourierGig) => {
  const s0 = gsRef.current; if (!s0) return;
  const d = s0.delivery ?? emptyDeliveryState();
  const r = cancelGig(g, d.courier);
  mutate((x) => { const dd = x.delivery ?? emptyDeliveryState(); x.delivery = { ...dd, courier: r.profile, activeGigs: dd.activeGigs.filter((gg) => gg.id !== g.id) }; });
  showToast(r.blockedToday ? "今天取消太多次了，明天再接单。" : "这单取消了，评分掉了 0.2。");
};
/* (h) advance the active customer order in real time */
useEffect(() => {
  const t = window.setInterval(() => {
    const s0 = gsRef.current; if (!s0?.delivery?.activeOrderId) return;
    const o = activeOrder(s0.delivery); if (!o) return;
    const { order, advancedTo } = advanceOrder(o, Date.now());
    if (!advancedTo) return;
    mutate((x) => { x.delivery = updateOrder(x.delivery ?? emptyDeliveryState(), order); });
    if (advancedTo === "delivered") {
      showToast(`🛵 外卖到了！${order.restaurantName}的餐在楼下，快趁热吃。`);
      sfx("notify");
    } else if (advancedTo === "pickedUp") {
      showToast(`🛵 ${order.riderName}已取餐，正在送来的路上。`);
    }
  }, 15_000);
  return () => window.clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
/* the week's prices follow the elected chair's pledge; a roommate halves your rent */
const policyRef = useRef(policyMul(null));
policyRef.current = policyMul(committeeQuery.data?.chair?.pledge);
const roommateRef = useRef<string | null>(null);
roommateRef.current = bonds.find((b) => b.kind === "roommate" && b.status === "active")?.peerName ?? null;
/* mirror the roommate and the rent policy into the save once the server has answered */
useEffect(() => {
  const g = gsRef.current; if (!g || phase !== "game" || !bondsQuery.isSuccess) return;
  const mate = roommateRef.current ?? undefined;
  if (g.roommate !== mate) { mutate((x) => { x.roommate = mate; }); if (mate) showToast(en ? `🏠 You now share a flat with ${mate} — rent split in half.` : `🏠 和${mate}合租了，房租各付一半。`); }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [bondsQuery.dataUpdatedAt, phase]);
useEffect(() => {
  const g = gsRef.current; if (!g || phase !== "game" || !committeeQuery.isSuccess) return;
  const pol = policyRef.current.rent;
  if ((g.rentPolicy ?? 1) !== pol) mutate((x) => { x.rentPolicy = pol; });
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [committeeQuery.dataUpdatedAt, phase]);
const proposeBond = async (toId: string, kind: BondKind) => {
  if (!profile) return;
  try {
    const r = await api.proposeBond({ playerId: profile.playerId, toId, kind });
    if (r.ok) { showToast(en ? `${BOND_INFO[kind].emoji} Invitation sent — they'll see it in their messages.` : `${BOND_INFO[kind].emoji} 邀请发出去了，对方会在私信里看到。`); void bondsQuery.refetch(); }
    else { showToast(r.error ?? (en ? "Couldn't send the invitation" : "邀请没发出去")); if (r.error?.includes("账号")) setAccountOpen(true); }
  } catch { showToast(en ? "Network hiccup — try again." : "网络不太好，稍后再试。"); }
};
const cardQuery = useQuery({
queryKey: ["card", cardOf ?? "", profile?.playerId ?? ""],
queryFn: () => api.getPlayerCard({ playerId: profile!.playerId, targetId: cardOf! }),
enabled: !!profile && !!cardOf,
});

/* Real weather for the city being played: drives the HUD readout, the
   raincoat prompts, the wet-weather travel penalty and the 3D sky. */
const weatherQuery = useQuery({
queryKey: ["real-weather", cityKey],
queryFn: () => api.getRealWeather({ cityKey }),
refetchInterval: 30 * 60_000,
enabled: phase === "game",
});
const realWeather: RealWeather | undefined = weatherQuery.data;
const rwOk = !!realWeather?.ok;
const nowRainy = rwOk ? realWeather!.kind === "rain" || realWeather!.kind === "storm" : isRainy(weatherOf(gs?.day ?? 1, cityKey));
const nowWeatherText = rwOk
? `${RW_EMOJI[realWeather!.kind]} ${realWeather!.description || RW_LABEL[realWeather!.kind]}${realWeather!.temperature != null ? ` ${Math.round(realWeather!.temperature)}°` : ""} · 实况`
: weatherOf(gs?.day ?? 1, cityKey);

/* 弹幕数据源：全城动态和城市聊天里的新消息飘过地图（自己的不飘） */
const lastFeedIdRef = useRef(0);
const lastChatIdRef = useRef(0);
useEffect(() => {
if (phase !== "game" || !world) return;
const feed = world.feed ?? [];
const maxFeed = feed.reduce((m, f) => Math.max(m, f.id), 0);
if (lastFeedIdRef.current === 0) { lastFeedIdRef.current = maxFeed; }
else {
feed.filter((f) => f.id > lastFeedIdRef.current).slice(0, 3).forEach((f, i) => {
window.setTimeout(() => pushDanmakuRef.current(`${f.playerName} ${f.text}`), i * 500);
});
lastFeedIdRef.current = Math.max(lastFeedIdRef.current, maxFeed);
}
const chat = world.chat ?? [];
const maxChat = chat.reduce((m, c) => Math.max(m, c.id), 0);
if (lastChatIdRef.current === 0) { lastChatIdRef.current = maxChat; }
else {
chat.filter((c) => c.id > lastChatIdRef.current && c.playerId !== profileRef.current?.playerId).slice(0, 2).forEach((c, i) => {
window.setTimeout(() => pushDanmakuRef.current(`💬 ${c.playerName}：${c.body}`), 800 + i * 600);
});
lastChatIdRef.current = Math.max(lastChatIdRef.current, maxChat);
}
}, [world, phase]);

/* 每日任务弹窗：进游戏和睡醒到新一天时各弹一次（手游的每日上线仪式） */
useEffect(() => {
if (phase !== "game" || !gs) return;
if (dailyShownRef.current !== gs.day) {
dailyShownRef.current = gs.day;
/* a brand-new player sees the map first — the daily-tasks sheet waits for their next day */
if (justStartedRef.current) justStartedRef.current = false; else if (!scenicMoment) setDailyOpen(true);
const posts = (gs.npcFeed ?? []).slice(0, 2);
posts.forEach((p, i) => window.setTimeout(() => pushDanmakuRef.current(`${p.author}：${p.text}`), 1200 + i * 900));
}
}, [phase, gs?.day]);

const showToast = (msg: string) => {
setToast(msg);
if (toastTimer.current) window.clearTimeout(toastTimer.current);
toastTimer.current = window.setTimeout(() => setToast(null), 3400);
};

/* ---- 真实经历：图鉴打卡 / 一日游 / 看图认地方 ---- */
const checkinGuide = (g: GuidePlace) => {
let count = 0;
mutate((d) => {
if (!(d.album ?? []).includes(g.key)) d.album = [...(d.album ?? []), g.key];
count = (d.album ?? []).length;
d.mood = clamp(d.mood + 8, 0, 100);
d.log = [{ day: d.day, text: `📖 在${g.locName}打卡，收进城市图鉴（${count}/${GUIDE.length}）` }, ...d.log].slice(0, 40);
});
showToast(`📸 ${g.locName} 已收进图鉴！解锁 ${count}/${GUIDE.length} 处真实地点`);
postFeed("life", `在${g.locName}打卡，解锁了图鉴里的实拍和城市故事`);
};
const restartTour = (tour: DayTour) => {
mutate((d) => { d.tourKey = tour.id; d.tourIdx = 0; d.tourDone = false; });
showToast(`🧭 「${tour.name}」出发！第一站：${tour.stops[0]}`);
};
const nextQuiz = () => {
const target = GUIDE[Math.floor(Math.random() * GUIDE.length)]!;
const others = GUIDE.filter((g) => g.key !== target.key).sort(() => Math.random() - 0.5).slice(0, 3);
const opts = [target.locName, ...others.map((g) => g.locName)].sort(() => Math.random() - 0.5);
setQuiz({ key: target.key, opts, picked: null });
};
const answerQuiz = (name: string) => {
if (!quiz || quiz.picked) return;
const target = GUIDE.find((g) => g.key === quiz.key);
setQuiz({ ...quiz, picked: name });
if (target && name === target.locName) {
mutate((d) => { d.money += 10; d.maxMoney = Math.max(d.maxMoney, d.money); });
showToast(`🎉 认对了！+${fmt(10)} —— 这张实拍你记住了`);
}
};
/* 一日游：按顺序到达每一站自动结算（换城市时按当前城市的路线算） */
useEffect(() => {
if (phase !== "game") return;
const s = gsRef.current;
if (!s || s.tourDone) return;
const tour = tourForCity(s.cityKey);
const active = s.tourKey === tour.id;
const idx = active ? (s.tourIdx ?? 0) : 0;
const stopName = tour.stops[idx];
if (!stopName) return;
if (locById(currentLoc).name !== stopName) return;
const isLast = idx >= tour.stops.length - 1;
mutate((d) => {
d.tourKey = tour.id;
d.money += isLast ? tour.rewardPerStop + tour.rewardFinish : tour.rewardPerStop;
d.maxMoney = Math.max(d.maxMoney, d.money);
d.tourIdx = idx + 1;
if (isLast) d.tourDone = true;
d.log = [{ day: d.day, text: isLast ? `🏁 走完一日游「${tour.name}」，完赛奖励 ${fmt(tour.rewardFinish)}` : `🧭 一日游打卡 ${idx + 1}/${tour.stops.length}：${stopName} +${fmt(tour.rewardPerStop)}` }, ...d.log].slice(0, 40);
});
showToast(isLast ? `🏁 「${tour.name}」全程走完！完赛奖励 ${fmt(tour.rewardFinish)}` : `🧭 一日游 ${idx + 1}/${tour.stops.length}：${stopName} ✓ 下一站 ${tour.stops[idx + 1]}`);
if (isLast) postFeed("life", `走完了一日游「${tour.name}」，又认识了这座城一层`);
}, [currentLoc, phase]);

/* Key moments are acted out IN-GAME: the game's own 3D character performs
   them in dressed 3D sets (station platform, carriage, office, night-market
   stall, kitchen, bedroom) with the warm cinematic grade and camera push-in.
   No pre-rendered video anywhere — what you see is the game rendering live. */
const CUTSCENE_ROAM: Partial<Record<LifeKind, LifeSet>> = {
  sleep: "bedroom", cook: "kitchen", eat: "market", wash: "bathroom",
  groceries: "market", gym: "gym", stroll: "park", shopping: "mall",
};
const playLifeAnim = (kind: LifeKind, after?: () => void) => {
lifeAfterRef.current = after ?? null;
setLifeAnim({ kind, idx: 0 });
};
const finishLifeAnim = () => {
const after = lifeAfterRef.current;
lifeAfterRef.current = null;
setLifeAnim(null);
if (after) after();
};
useEffect(() => {
if (!lifeAnim) return;
// round-2 (g S5): walkable beats are not time-boxed — onSpot / 跳过 advances.
if (CUTSCENE_ROAM[lifeAnim.kind]) return;
const scene = LIFE_SCENES[lifeAnim.kind];
const tm = window.setTimeout(() => {
if (lifeAnim.idx + 1 >= scene.steps.length) finishLifeAnim();
else setLifeAnim({ kind: lifeAnim.kind, idx: lifeAnim.idx + 1 });
}, 2300);
return () => window.clearTimeout(tm);
}, [lifeAnim]);

const saveLocal = (prof: Profile | null, state: GameState | null) => {
try {
if (prof && state) localStorage.setItem(LS_KEY, JSON.stringify({ profile: prof, gs: state}));
else localStorage.removeItem(LS_KEY);
} catch { /* storage unavailable */}
};

const update = (next: GameState) => {
next.energy = clamp(next.energy, 0, 100);
/* round-2 (f): the mood cap grows with small joys (max +15). */
next.mood = clamp(next.mood, 0, 100 + (next.life?.flat.moodCapBonus ?? 0));
next.maxMoney = Math.max(next.maxMoney, next.money);
gsRef.current = next;
setGs(next);
if (profileRef.current) saveLocal(profileRef.current, next);
};

const mutate = (fn: (draft: GameState) => void): GameState | null => {
const cur = gsRef.current;
if (!cur) return null;
const next: GameState = {...cur, furniture: [...cur.furniture], log: [...cur.log], seenEvents: [...cur.seenEvents], greeted: [...cur.greeted], visitedScenic: [...(cur.visitedScenic ?? [])], album: [...(cur.album ?? [])], npcMem: Object.fromEntries(Object.entries(cur.npcMem ?? {}).map(([k, v]) => [k, { ...v }])), npcFeed: [...(cur.npcFeed ?? [])], npcNews: [...(cur.npcNews ?? [])]};
fn(next);
update(next);
return next;
};

const addLog = (text: string) => {
mutate((s) => {
s.log = [{ day: s.day, text},...s.log].slice(0, 40);
});
};

const postFeedMut = useMutation({
mutationFn: (args: { kind: "career" | "apec" | "home" | "money" | "life"; text: string}) =>
api.postFeed({ playerId: profileRef.current?.playerId?? "", kind: args.kind, text: args.text}),
});
const postFeed = (kind: "career" | "apec" | "home" | "money" | "life", text: string) => {
if (!profileRef.current) return;
postFeedMut.mutate({ kind, text});
};

/* ---------- presence heartbeat ---------- */
const currentLocRef = useRef(currentLoc);
currentLocRef.current = currentLoc;
const syncMut = useMutation({
mutationFn: () => {
const s = gsRef.current;
const prof = profileRef.current;
if (!s ||!prof) throw new Error("no game");
return api.syncPresence({
device: deviceId() || undefined,
playerId: prof.playerId,
cityKey: s.cityKey,
locId: currentLocRef.current,
gameDay: Math.min(31, s.day),
season: (s.startKey ?? SEASON_START).slice(0, 7),
money: Math.round(s.money),
careerIdx: s.careerIdx,
apecCount: s.apecCount,
employer: s.employer ?? "startup",
stamps: Math.min(999, metaRef.current.stamps.length),
title: metaRef.current.title,
hair: Math.max(0, Math.min(3, Math.round(s.hair ?? 0))),
accessory: Math.max(0, Math.min(3, Math.round(s.accessory ?? 0))),
});
},
onSuccess: (data) => {
if (data.me && data.me !== myPubRef.current) setMyPub(data.me);
for (const g of data.inbox ?? []) receiveGift(g);
/* the server keeps the real balance: earnings it could not account for are
   taken back, and the game falls back to its figure */
if (data.bank?.corrected) {
  const fix = data.bank.money;
  mutate((x) => { x.money = fix; });
  showToast(en ? "💳 Balance corrected to the server's books (earnings faster than the game allows were not counted)." : "💳 余额已按服务器账本校正：超出游戏节奏的进账没有入账。");
}
const s = gsRef.current;
queryClient.setQueryData(["world", s?.cityKey?? "sz"], data);
},
});
const syncMutRef = useRef(syncMut);
syncMutRef.current = syncMut;
useEffect(() => {
if (phase!== "game") return;
syncMutRef.current.mutate();
const t = window.setInterval(() => syncMutRef.current.mutate(), 6000);
return () => window.clearInterval(t);
}, [phase, currentLoc]);

/* ---------- carriage ride progression ---------- */
// Global flattened index at which each leg ends (= the transfer station).
const legEndIdx = (r: MetroRoute, legIdx: number): number => {
let acc = 0;
for (let i = 0; i <= legIdx; i++) acc += (r.legs[i]?.stops ?? 0);
return acc;
};
/* ---------- metro entry sequence: concourse → security → platform → board ---------- */
useEffect(() => {
if (rideEntry === null) return;
const tm = window.setTimeout(() => {
setRideEntry((e) => (e === null || e >= ENTRY_STEPS.length - 1 ? null : e + 1));
}, 900);
return () => window.clearTimeout(tm);
}, [rideEntry]);

useEffect(() => {
if (!carriage) return;
if (rideEntry !== null) return;
if (carriage.awaitingTransfer) return;
if (carriage.stopIdx >= carriage.route.stations.length - 1) return;
const tm = window.setTimeout(() => {
setCarriage((c) => {
if (!c || c.awaitingTransfer) return c;
const nextIdx = Math.min(c.stopIdx + 1, c.route.stations.length - 1);
const st = c.route.stations[nextIdx];
const isTransferStop = c.route.isTransfer && nextIdx === legEndIdx(c.route, c.legIdx) && c.legIdx < c.route.legs.length - 1;
if (isTransferStop) {
const nextLine = c.route.legs[c.legIdx + 1]?.line;
if (c.route.shuttleFrom.includes(st?.name ?? "")) {
const partner = c.route.stations[nextIdx + 1];
setCarriageLog(`🚌 ${st?.name ?? ""}站到了。两个站在城里两头，不是一个站——出站坐接驳巴士到${partner?.name ?? "对面站"}站，再进站换乘 ${nextLine?.name ?? "下一条线"}。点下面的按钮坐接驳巴士过去。`);
} else {
setCarriageLog(`🔁 ${st?.name ?? ""}站到了，这里要换乘 ${nextLine?.name ?? "下一条线"}。下车，跟着站台的换乘指示牌走到对面站台，点「换乘上车」继续。`);
}
sfx("chime");
return { ...c, stopIdx: nextIdx, awaitingTransfer: true };
}
setCarriageLog(nextIdx >= c.route.stations.length - 1 ? `🔔 ${st?.name ?? ""}站到了，这就是你的目的地，点「下车出站」下车。先下后上，别挡门。` : `📢 列车运行前方是 ${st?.name ?? ""} 站。${c.crowdLevel >= 2 && nextIdx % 2 === 0 ? "这一站上来不少人，车厢更挤了，你往里挪了挪。" : "有乘客上下车，车厢轻轻晃了一下。"}`);
sfx("chime");
return { ...c, stopIdx: nextIdx };
});
/* each hop lasts as long as the real distance to the next station needs */
}, hopMs(carriage.route, carriage.stopIdx));
return () => window.clearTimeout(tm);
}, [carriage, rideEntry]);
const doTransfer = () => {
setCarriage((c) => {
if (!c || !c.awaitingTransfer) return c;
const nextLeg = c.route.legs[c.legIdx + 1];
const st = c.route.stations[c.stopIdx];
if (c.route.shuttleFrom.includes(st?.name ?? "")) {
const partner = c.route.stations[c.stopIdx + 1];
setCarriageLog(`🚌 你出站坐上接驳巴士，穿过大半个惠州城，到了${partner?.name ?? "对面站"}站，进站上了 ${nextLeg?.line.name ?? ""}。${nextLeg?.line.short ?? ""} 往下一段开，坐稳扶好。`);
} else {
setCarriageLog(`🚶 你在${st?.name ?? ""}站下了车，穿过换乘通道，上了 ${nextLeg?.line.name ?? ""} 的列车。${nextLeg?.line.short ?? ""} 往下一段开，坐稳扶好。`);
}
return { ...c, legIdx: c.legIdx + 1, awaitingTransfer: false, seated: c.crowdLevel === 0, heldRail: false };
});
};

/* ---------- restore a saved run ---------- */
// Saves are written by whichever build the player last ran, and this game has
// grown new GameState fields across many builds. An old or partially-written
// save must never reach the render path raw: every field is re-validated and
// coerced here, and a save whose core shape is unusable is discarded (back to
// the setup screen) instead of white-screening the whole app on open.
const sanitizeSave = (rawParsed: unknown): { profile: Profile; gs: GameState } | null => {
if (!rawParsed || typeof rawParsed !== "object") return null;
const p = rawParsed as { profile?: unknown; gs?: unknown };
if (!p.profile || typeof p.profile !== "object" || !p.gs || typeof p.gs !== "object") return null;
const prof = p.profile as Partial<Profile>;
const g = p.gs as Partial<GameState> & Record<string, unknown>;
if (typeof prof.playerId !== "string" || prof.playerId.length < 4) return null;
if (typeof prof.name !== "string" || prof.name.trim() === "") return null;
if (g.cityKey !== "sz" && g.cityKey !== "hz" && g.cityKey !== "hk") return null;
if (g.finished) return null;
const num = (v: unknown, dflt: number): number => (typeof v === "number" && Number.isFinite(v) ? v : dflt);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const iden = IDENTITIES.find((i) => i.id === g.idenId) ?? IDENTITIES[0]!;
const gs: GameState = {
cityKey: g.cityKey,
idenId: iden.id,
day: Math.min(30, Math.max(1, Math.round(num(g.day, 1)))),
money: Math.round(num(g.money, iden.money)),
energy: clamp(num(g.energy, 90), 0, 100),
mood: clamp(num(g.mood, iden.mood), 0, 100 + (sanitizeLifestyleState(g.life).flat.moodCapBonus ?? 0)),
hunger: clamp100(num(g.hunger, 78)),
clean: clamp100(num(g.clean, 78)),
social: clamp100(num(g.social, 70)),
fun: clamp100(num(g.fun, 72)),
bladder: clamp100(num(g.bladder, 84)),
hair: Math.max(0, Math.min(HAIRS.length - 1, Math.round(num(g.hair, 0)))),
accessory: Math.max(0, Math.min(ACCESSORIES.length - 1, Math.round(num(g.accessory, 0)))),
sanheDay: Math.max(0, Math.round(num(g.sanheDay, 0))),
/* round-2 (f): lifestyle state, sanitized (old saves get the default). */
life: sanitizeLifestyleState(g.life),
/* round-2 (h): delivery state, guarded (old saves get an empty one). */
delivery: isDeliveryState(g.delivery) ? g.delivery : emptyDeliveryState(),
spouse: typeof g.spouse === "string" && g.spouse ? g.spouse : undefined,
kids: Array.isArray(g.kids) ? g.kids.flatMap((k) => { const o = k as { name?: unknown; day?: unknown }; return typeof o?.name === "string" ? [{ name: o.name, day: num(o.day, 1) }] : []; }).slice(0, 3) : [],
plots: (() => { const out: GameState["plots"] = []; if (!Array.isArray(g.plots)) return out; for (const k of g.plots) { const o = k as { city?: unknown; paid?: unknown; day?: unknown }; const city = o?.city; if (city === "sz" || city === "hz" || city === "hk") out.push({ city, paid: num(o.paid, 0), day: num(o.day, 1) }); if (out.length >= 3) break; } return out; })(),
rent: num(g.rent, 0),
baseRent: num(g.baseRent, 0),
goal: num(g.goal, iden.id === "rich" ? 30000 : iden.id === "flat" ? 5000 : CITIES[g.cityKey].goal),
earned: num(g.earned, 0),
rentPaid: num(g.rentPaid, 0),
workCount: num(g.workCount, 0),
otCount: num(g.otCount, 0),
mealCount: num(g.mealCount, 0),
maxMoney: num(g.maxMoney, num(g.money, iden.money)),
homeStyle: typeof g.homeStyle === "string" ? g.homeStyle : null,
furniture: strArr(g.furniture),
furnPos: g.furnPos && typeof g.furnPos === "object" && !Array.isArray(g.furnPos) ? Object.fromEntries(Object.entries(g.furnPos as Record<string, unknown>).filter(([, v]) => typeof v === "number").map(([k, v]) => [k, v as number])) : {},
venueFx: strArr(g.venueFx),
npcGigs: strArr(g.npcGigs),
arcs: g.arcs && typeof g.arcs === "object" && !Array.isArray(g.arcs) ? Object.fromEntries(Object.entries(g.arcs as Record<string, unknown>).filter(([k, v]) => arcById(k) && v && typeof v === "object").map(([k, v]) => { const o = v as Record<string, unknown>; return [k, { st: num(o.st, 0), day: num(o.day, 0), flags: strArr(o.flags), ...(typeof o.done === "string" ? { done: o.done } : {}) }]; })) : {},
ownFlat: g.ownFlat === true, flatDay: typeof g.flatDay === "number" ? g.flatDay : undefined,
shop: g.shop && typeof g.shop === "object" && typeof (g.shop as { kind?: unknown }).kind === "string" ? { kind: String((g.shop as { kind: string }).kind), day: num((g.shop as { day?: unknown }).day, 0), lvl: num((g.shop as { lvl?: unknown }).lvl, 1), till: num((g.shop as { till?: unknown }).till, 0), partner: typeof (g.shop as { partner?: unknown }).partner === "string" ? (g.shop as { partner: string }).partner : undefined } : undefined,
apprentice: g.apprentice && typeof g.apprentice === "object" && typeof (g.apprentice as { name?: unknown }).name === "string" ? { name: String((g.apprentice as { name: string }).name).slice(0, 20), day: num((g.apprentice as { day?: unknown }).day, 0), lvl: num((g.apprentice as { lvl?: unknown }).lvl, 0) } : undefined,
homeSpent: num(g.homeSpent, 0),
xp: num(g.xp, 0),
skill: num(g.skill, 0),
careerIdx: Math.min(4, Math.max(0, Math.round(num(g.careerIdx, 0)))),
network: num(g.network, 0),
fit: num(g.fit, 0),
invest: num(g.invest, 0),
apecCount: num(g.apecCount, 0),
apecTasks: strArr(g.apecTasks),
apecCheckins: strArr(g.apecCheckins),
seenEvents: strArr(g.seenEvents),
visitedScenic: strArr(g.visitedScenic),
album: strArr(g.album),
tourKey: typeof g.tourKey === "string" ? g.tourKey : undefined,
tourIdx: num(g.tourIdx, 0),
tourDone: g.tourDone === true,
metroRides: num(g.metroRides, 0),
outfit: typeof g.outfit === "string" ? g.outfit : "casual",
ownedOutfits: strArr(g.ownedOutfits).length > 0 ? strArr(g.ownedOutfits) : ["casual", "pajamas"],
groceries: num(g.groceries, 0),
greeted: strArr(g.greeted),
npcMem: g.npcMem && typeof g.npcMem === "object" && !Array.isArray(g.npcMem) ? (g.npcMem as GameState["npcMem"]) : {},
npcFeed: Array.isArray(g.npcFeed) ? (g.npcFeed as GameState["npcFeed"]) : [],
npcNews: Array.isArray(g.npcNews) ? (g.npcNews as GameState["npcNews"]) : [],
log: Array.isArray(g.log) ? (g.log as GameState["log"]).filter((e) => e && typeof e === "object" && typeof (e as { text?: unknown }).text === "string") : [],
finished: false,
signDay: num(g.signDay, 0),
dayBase: g.dayBase && typeof g.dayBase === "object" && !Array.isArray(g.dayBase) ? { day: num((g.dayBase as { day?: unknown }).day, 0), work: num((g.dayBase as { work?: unknown }).work, 0), meal: num((g.dayBase as { meal?: unknown }).meal, 0), scenic: num((g.dayBase as { scenic?: unknown }).scenic, 0) } : undefined,
dayClaim: strArr(g.dayClaim),
employer: typeof g.employer === "string" && COMPANIES.some((c) => c.id === g.employer) ? g.employer : "startup",
offers: strArr(g.offers).filter((id) => COMPANIES.some((c) => c.id === id)),
interviews: strArr(g.interviews),
referrals: strArr(g.referrals),
busyUntil: num(g.busyUntil, 0), busyWhat: typeof g.busyWhat === "string" ? g.busyWhat : "", startKey: typeof g.startKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g.startKey) ? g.startKey : SEASON_START,
sleptDay: num(g.sleptDay, 0), lastActiveDay: num(g.lastActiveDay, 0), regenAt: num(g.regenAt, Date.now()),
restDay: num(g.restDay, 0), restN: num(g.restN, 0),
workDay: num(g.workDay, 0), otDay: num(g.otDay, 0),
story: g.story && typeof g.story === "object" && !Array.isArray(g.story) ? Object.fromEntries(Object.entries(g.story as Record<string, unknown>).filter(([k, v]) => storyOf(k) && v && typeof v === "object").map(([k, v]) => { const o = v as Record<string, unknown>; return [k, { ch: num(o.ch, 0), day: num(o.day, 0), flags: strArr(o.flags), ...(typeof o.done === "string" ? { done: o.done } : {}) }]; })) : {},
perks: strArr(g.perks).filter((id) => perkById(id)),
license: num(g.license, 0), licDay: num(g.licDay, 0), carDay: num(g.carDay, 0), carOwned: g.carOwned === true,
hangover: g.hangover === true, record: num(g.record, 0),
romance: g.romance && typeof g.romance === "object" && !Array.isArray(g.romance) ? Object.fromEntries(Object.entries(g.romance as Record<string, unknown>).filter(([k, v]) => NPCS.some((n) => n.name === k) && typeof v === "number")) as Record<string, number> : {},
cohabit: g.cohabit === true, moodHitDay: typeof g.moodHitDay === "number" ? Math.round(g.moodHitDay) : undefined, switchDay: typeof g.switchDay === "number" ? Math.round(g.switchDay) : undefined, roommate: typeof g.roommate === "string" && g.roommate.length < 40 ? g.roommate : undefined, rentPolicy: typeof g.rentPolicy === "number" && g.rentPolicy >= 0.9 && g.rentPolicy <= 1 ? g.rentPolicy : undefined, origin: typeof g.origin === "string" && g.origin.length < 40 ? g.origin : undefined, startTier: typeof g.startTier === "number" && g.startTier >= 0 && g.startTier <= 3 ? Math.round(g.startTier) : undefined, loc: typeof g.loc === "string" && g.loc.length < 120 ? (g.cityKey === "hz" && g.loc === "hq" ? "qiaodong" : g.cityKey === "hz" && g.loc === "work" ? "work-hz" : g.loc) : undefined, routine: g.routine && typeof g.routine === "object" && !Array.isArray(g.routine) ? (g.routine as RoutineDay) : undefined, actCount: num(g.actCount, 0), partyPlays: num(g.partyPlays, 0),
};
return { profile: { playerId: prof.playerId, name: prof.name }, gs };
};

useEffect(() => {
try {
const raw = localStorage.getItem(LS_KEY);
if (!raw) return;
const clean = sanitizeSave(JSON.parse(raw));
if (!clean) {
try { localStorage.removeItem(LS_KEY); } catch { /* storage unavailable */ }
return;
}
const { profile: prof, gs: restored } = clean;
if (!Array.isArray(restored.npcFeed) || restored.npcFeed.length === 0) {
try {
const gen = generateDailyPosts({ day: restored.day, cityKey: restored.cityKey, playerName: prof.name }, [], restored.npcMem);
restored.npcFeed = gen.posts;
restored.npcMem = gen.mems;
} catch { restored.npcFeed = []; }
}
profileRef.current = prof;
setProfile(prof);
gsRef.current = restored;
setGs(restored);
{ const back = restored.loc && restored.loc !== "home" && resolveLoc(restored.cityKey, restored.loc) ? restored.loc : "home";
  setCurrentLoc(back); currentLocRef.current = back; setSelectedLoc(back); }
setPhase("game");
const iden = IDENTITIES.find((i) => i.id === restored.idenId) ?? IDENTITIES[0]!;
void api.joinWorld({
device: deviceId() || undefined,
playerId: prof.playerId,
name: prof.name,
emoji: iden.emoji,
color: iden.color,
cityKey: restored.cityKey,
});
} catch { /* a corrupt save must never block the setup screen */ }
}, []);

const locById = (id: string): Loc => {
const ck = gsRef.current?.cityKey ?? "sz";
return resolveLoc(ck, id) ?? getLocations(ck)[0]!;
};

/* ---------- movement ---------- */
/* one hop of a metro / rail ride takes as long as its real spacing needs at the line's speed
   (metro 7 map units/s, high-speed and intercity 12) — faster than any road vehicle */
const RAIL_LINE_IDS = ["szhz-rail", "guangshen", "hz-intercity", "ganshen-rail", "guangshan-rail", "hsr-hk"];
const hopMs = (route: MetroRoute, idx: number): number => {
  const a = route.stations[idx], b = route.stations[idx + 1];
  if (!a || !b) return 900;
  const rail = route.legs.some((l) => RAIL_LINE_IDS.includes(l.line.id));
  return clamp((Math.hypot(b.x - a.x, b.z - a.z) / (rail ? 12 : 7)) * 1000 * (!rail && evRef.current.metroSlow ? 2 : 1), 450, 6000);
};
const startMetroRide = (fromLocId: string, toLocId: string, routeOverride?: MetroRoute) => {
const s0 = gsRef.current; if (!s0) return;
if (!inWindow(nowMin(), RAIL_HOURS[s0.cityKey])) { showToast(`🚇 ${railWord(s0.cityKey)}已经停运了（运营 ${windowStr(RAIL_HOURS[s0.cityKey])}，北京时间）。打车或者明早再坐。`); return; }
const route = routeOverride ?? findMetroRoute(s0.cityKey, fromLocId, toLocId);
if (!route) { showToast("这趟车暂时没规划出来，换个目的地试试。"); return; }
const due = evRef.current.metroFree ? 0 : Math.round(route.fare * policyRef.current.metro);
if (s0.money < due) { showToast(`车票 ${Y}${due}，钱包不够，先打工攒点钱。`); return; }
const crowd = crowdForRide(route.line.id, s0.day, s0.metroRides ?? 0);
setRideBig(true);
setCarriage({ route, fromLoc: fromLocId, toLoc: toLocId, stopIdx: 0, legIdx: 0, awaitingTransfer: false, crowdLabel: crowd.label, crowdDesc: crowd.desc, crowdLevel: crowd.level, seated: crowd.level === 0, gaveSeat: false, phoneUsed: false, heldRail: false });
setRideEntry(0);
setTripTo(toLocId);
setCarriageLog(`🚪 在${route.stations[0]?.name ?? ""}站刷卡进闸，上了 ${route.line.name}。${route.isTransfer ? `这趟要换乘：${route.summary}，在 ${route.transferStations.join("、")} 站下车换乘，跟着车厢走就行，一次坐到底。` : ""}${route.shuttleFrom.length > 0 ? `其中 ${route.shuttleFrom.join("、")} 是站外接驳：两个站不在一处，下车后坐接驳巴士到另一个站再上车。` : ""}${crowd.desc}`);
setSelectedLoc(toLocId);
setAsideTab("place");
};
const finishMetroRide = (earlyIdx?: number) => {
const c0 = carriage; const s0 = gsRef.current; if (!c0 || !s0) return;
/* Getting off before the destination: the trip ends at that station, the
   fare covers only the distance ridden, and any planned onward walk is
   dropped — the player chose to stop here. */
const early = earlyIdx !== undefined && earlyIdx > 0 && earlyIdx < c0.route.stations.length - 1;
let c = c0;
if (early) {
const st = c0.route.stations[earlyIdx]!;
const exitId = exitLocForStation(s0.cityKey, st.name) ?? c0.toLoc;
const stations = c0.route.stations.slice(0, earlyIdx + 1);
c = { ...c0, toLoc: exitId, route: { ...c0.route, stations, stops: earlyIdx, fare: partialFare(c0.route, earlyIdx), transferStations: c0.route.transferStations.filter((n) => stations.slice(1, -1).some((x) => x.name === n)) } };
pendingAfterRide.current = null;
pendingSleep.current = false;
}
const isRail = c.route.legs.some((l) => ["szhz-rail", "guangshen", "hz-intercity", "ganshen-rail", "guangshan-rail"].includes(l.line.id));
const fareNow = evRef.current.metroFree ? 0 : Math.round(c.route.fare * policyRef.current.metro);
mutate((s) => { s.money -= fareNow; s.energy -= Math.max(3, Math.round(c.route.stops * 1.2)) + (c.gaveSeat ? 2 : 0); s.metroRides = (s.metroRides ?? 0) + 1; if (c.gaveSeat) { s.network += 1; s.mood += 4; } if (c.phoneUsed) s.mood += 2; });
setCurrentLoc(c.toLoc); currentLocRef.current = c.toLoc; setSelectedLoc(c.toLoc);
const lastSt = c.route.stations[c.route.stations.length - 1]?.name ?? "";
showToast(`${isRail ? "🚄" : "🚇"} 到达${lastSt && !locById(c.toLoc).name.includes(lastSt) ? `${lastSt}站，出站就是${locById(c.toLoc).short}` : locById(c.toLoc).name}，车票 ${fareNow ? `-${Y}${fareNow}` : "免费（绿色出行日）"}，共 ${c.route.stops} 站${c.route.isTransfer ? `（换乘 ${c.route.transferStations.length} 次：${c.route.summary}）` : ""}${pendingAfterRide.current && pendingAfterRide.current !== c.toLoc ? `，出站再步行到${locById(pendingAfterRide.current).short}` : ""}。`);
addLog(`坐 ${c.route.summary} 从${locById(c.fromLoc).short}到${locById(c.toLoc).short}，${c.route.stops}站${c.route.isTransfer ? `，在${c.route.transferStations.join("、")}换乘` : ""}${c.route.shuttleFrom.length > 0 ? `（${c.route.shuttleFrom.join("、")}坐接驳巴士）` : ""} -¥${fareNow}${c.gaveSeat ? "，车厢里让了个座，人脉+1" : ""}${pendingAfterRide.current && pendingAfterRide.current !== c.toLoc ? `，再步行到${locById(pendingAfterRide.current).short}` : ""}。`);
setRideEntry(null);
setCarriage(null);
stampStations([c.route.stations[0]?.name, c.route.stations[c.route.stations.length - 1]?.name, ...c.route.transferStations]);
updMeta((m) => bump(m, "rides"));
const finalWalk = pendingAfterRide.current;
pendingAfterRide.current = null;
playLifeAnim(isRail ? "alightRail" : "metro", finalWalk && finalWalk !== c.toLoc ? () => {
showToast(`出了「${locById(c.toLoc).short}」站，最后一段路走到${locById(finalWalk).name}。`);
walkToRef.current?.(finalWalk, "walk");
} : pendingSleep.current ? () => {
// Rode home with 「回家睡觉」 pending and the station is the last leg:
// honour the sleep instead of stranding the flag on a later walk.
pendingSleep.current = false;
playLifeAnim("sleep", () => doSleep());
} : undefined);
};
const walkTo = (locId: string, modeOverride?: TransportModeId) => {
if (!gsRef.current || walking || carriage) return;
const s0 = gsRef.current;
setSelectedLoc(locId);
setAsideTab("place");
/* on a phone (or a landscape phone) the panel would cover the map and the ride: open it only when you're not setting off */
if (!(window.innerWidth < 640 || window.innerHeight < 500) || locId === currentLocRef.current) autoOpenAside();
if (locId === currentLocRef.current) return;
let mode = modeOverride ?? travelMode;
{
const tn = nowMin();
if ((mode === "metro" || mode === "rail") && !inWindow(tn, RAIL_HOURS[s0.cityKey])) { showToast(`🚇 ${railWord(s0.cityKey)}已经停运（运营 ${windowStr(RAIL_HOURS[s0.cityKey])}，北京时间），这次改打车。`); mode = "taxi"; }
else if (modeHours(mode, s0.cityKey) && !inWindow(tn, modeHours(mode, s0.cityKey)!)) { showToast(`这个点${mode === "bus" ? "公交" : mode === "ferry" ? "轮渡" : "航班"}已经没有了（${windowStr(modeHours(mode, s0.cityKey)!)}），这次改打车。`); mode = "taxi"; }
}
const from = locById(currentLocRef.current);
const to = locById(locId);
const dist = Math.hypot(to.x - from.x, to.z - from.z);
if (mode === "metro" || mode === "rail") {
  // Full-network routing, transfers included — and it works between ANY
  // two places, not just ones that are stations themselves. Places with
  // no station of their own (大梅沙以外的海滩、公园、景区…) board at the
  // nearest station and alight at the station nearest the destination;
  // both access legs are walked and acted out, so a trip is never
  // cancelled just because an endpoint has no station.
  const plan = planRailTrip(s0.cityKey, currentLocRef.current, locId);
  if (plan) {
    const ticket = Math.round(plan.route.fare * policyRef.current.metro);
    if (s0.money < ticket) {
      showToast(`这趟车票 ${Y}${ticket}（${plan.route.summary}），钱包不够，先打工攒点钱再坐。`);
      setSelectedLoc(currentLocRef.current);
      return;
    }
    pendingAfterRide.current = plan.alightLoc !== locId ? locId : null;
    const legsText = `${plan.route.summary}${plan.route.isTransfer ? `，在${plan.route.transferStations.join("、")}换乘` : ""}`;
    if (plan.boardLoc !== currentLocRef.current) {
      pendingRide.current = plan.alightLoc;
      showToast(`你这儿没有站：先走到最近的「${locById(plan.boardLoc).name}」上车，坐 ${legsText} 到「${locById(plan.alightLoc).short}」${plan.alightLoc !== locId ? `，下车再走到${to.short}` : ""}。全程都安排好了，跟着走就行。`);
      walkTo(plan.boardLoc, "walk");
      return;
    }
    if (plan.alightLoc !== locId) {
      showToast(`「${to.name}」没有自己的站：坐 ${legsText} 到最近的「${locById(plan.alightLoc).name}」下车，再步行过去——出站那段路也演给你看。`);
    }
    startMetroRide(currentLocRef.current, plan.alightLoc);
    return;
  }
  // planRailTrip returned null: the two places are so close to the same
  // station area that the access walks alone would be longer than walking
  // straight there. Announce it and fall through to the walking code
  // below (modeLabel stays 步行) — a stated choice, never a silent switch.
  showToast(`「${from.short}」到「${to.short}」走过去比坐车还近：坐车光是走到站、下车再走回来就比直达更远，这次直接步行。`);
}
let cost = 0; let energyCost = 0; let effMode: TransportModeId = "walk"; let modeLabel = "步行";
if (mode === "run") { cost = 0; energyCost = Math.round(dist * 0.85); effMode = "run"; modeLabel = "跑步"; }
else if (mode === "taxi") { cost = s0.idenId === "driver" ? 0 : Math.round(taxiFare(dist) * (evRef.current.taxiMul ?? 1)); /* a cabbie drives their own taxi */ energyCost = 1; effMode = "taxi"; modeLabel = s0.idenId === "driver" ? "开的士" : "打车"; if (s0.money < cost) { showToast(`打车要 ${Y}${cost}，钱不够，改步行了。`); cost = 0; energyCost = Math.round(dist * 0.5); effMode = "walk"; modeLabel = "步行"; } }
else if (mode === "moto") { cost = s0.idenId === "rider" ? 0 : motoFare(dist); /* riders ride their own e-bike: battery swaps are the cost */ energyCost = Math.max(1, Math.round(dist * 0.18)); effMode = "moto"; modeLabel = "电动车"; if (s0.money < cost) { showToast(`电动车要 ${Y}${cost}，钱不够，改步行了。`); cost = 0; energyCost = Math.round(dist * 0.5); effMode = "walk"; modeLabel = "步行"; } else if (dist > 22) { showToast(`路太远，电动车电量告急，骑到一半推了一段——远途还是坐${railWord(s0.cityKey)}/打车吧。`); energyCost += 4; } }
else if (mode === "bike") { cost = bikeFare(dist); energyCost = Math.round(dist * 0.3); effMode = "bike"; modeLabel = "骑行"; if (s0.money < cost) { cost = 0; showToast(`骑行去${to.short}要 ${Y}${bikeFare(dist)}，钱包不够——共享单车免押金，这趟先免费骑。任何地点都能骑到，别让钱拦路。`); } }
else if (mode === "bus") { cost = busFare(dist); energyCost = Math.max(1, Math.round(dist * 0.12)); effMode = "bus"; modeLabel = "公交"; if (s0.money < cost) cost = 0; }
else if (mode === "ferry") { cost = 60; energyCost = 4; effMode = "ferry"; modeLabel = "轮渡"; if (s0.money < cost) { showToast(`轮渡船票要 ${Y}${cost}，钱不够，改步行了。`); cost = 0; energyCost = Math.round(dist * 0.5); effMode = "walk"; modeLabel = "步行"; } }
else if (mode === "flight") { cost = 420; energyCost = 6; effMode = "flight"; modeLabel = "飞机"; if (s0.money < cost) { showToast(`机票要 ${Y}${cost}，钱不够，改步行了。`); cost = 0; energyCost = Math.round(dist * 0.5); effMode = "walk"; modeLabel = "步行"; } }
else if (mode === "drive") {
  const hasCar = (s0.license ?? 0) >= 3 && (s0.carOwned || s0.carDay === s0.day);
  if (!hasCar) { showToast((s0.license ?? 0) < 3 ? "还没有驾照：去图书馆/车站的「驾校练车」考三科。这次改打车。" : "今天没有车：去车站「租一天车」。这次改打车。"); cost = Math.round(taxiFare(dist) * (evRef.current.taxiMul ?? 1)); energyCost = 1; effMode = "taxi"; modeLabel = "打车"; if (s0.money < cost) { cost = 0; energyCost = Math.round(dist * 0.5); effMode = "walk"; modeLabel = "步行"; } }
  else { const park = parkingFee(to); cost = driveFare(dist) + park; energyCost = 1; effMode = "drive"; modeLabel = "自驾"; if (s0.money < cost) { showToast(`自驾去${to.short}要油费/电费 ${Y}${driveFare(dist)}${park > 0 ? ` + 停车费 ${Y}${park}` : ""}，钱不够，改步行了。`); cost = 0; energyCost = Math.round(dist * 0.5); effMode = "walk"; modeLabel = "步行"; } else if (park > 0) { showToast(`自驾去${to.short}：油费/电费 ${Y}${driveFare(dist)} + 那边停车 ${Y}${park}。开自己的车就是这点好——比打车便宜，停车得自己找车位。`); } }
}
else { energyCost = Math.round(dist * 0.5); }
const jam = ["drive", "taxi", "bus"].includes(effMode) && isRushHour(nowMin(s0));
if (jam) showToast(`🚦 高峰期，路上堵车，${modeLabel}要多花一半时间。`);
mutate((s) => { s.money -= cost; s.energy -= energyCost; });
if (en) { const ml = ({ 开的士: "Driving your taxi", 打车: "Taxi", 步行: "Walking" } as Record<string, string>)[modeLabel] ?? trText(modeLabel); showToast(`${ml} to ${trText(to.short)}${cost > 0 ? `, -${Y}${cost}` : ""}${energyCost && cost > 0 ? `, energy -${energyCost}` : ""} · about ${etaMinutes(effMode, dist)} min.${effMode === "walk" && cost <= 0 ? " A faster way would save a lot of time." : ""}`); }
else if (cost > 0) showToast(`${modeLabel}去${to.short}，-${Y}${cost}${energyCost ? `，能量 -${energyCost}` : ""}，预计约 ${etaMinutes(effMode, dist)} 分钟到。`);
else showToast(`${modeLabel}去${to.short}，预计约 ${etaMinutes(effMode, dist)} 分钟到。${effMode === "walk" ? "换个更快的出行方式能省不少时间。" : ""}`);
if (nowRainy) {
if (s0.outfit === "raincoat") showToast("🌧️ 下雨天，你穿着雨衣出门，雨点都顺着衣角滑下去了，没淋着。");
else { mutate((x) => { x.mood -= 2; }); showToast("🌧️ 下雨没穿雨衣，淋了点雨，心情 -2。回家衣柜里备一件雨衣吧。"); }
}
setWalking(true);
/* Trip duration derives from the mode's real map speed — the same
   number that drives the figure's movement speed on the 3D map, so a
   taxi visibly crosses the city ~3× faster than walking. */
/* vehicles take long enough to watch on the map (the car / bike / bus
   really drives there, camera following); walks keep their pace */
/* each mode keeps its own pace (bike < e-bike/bus < taxi < own car) — a loose limit only, so speeds stay visibly different */
/* on-screen pace per mode (map units / s): slow enough to watch, always walk < run < bike < e-bike < bus < taxi < car */
const WATCH: Partial<Record<TransportModeId, number>> = { walk: 1.6, run: 2.4, bike: 3, moto: 3.8, bus: 4.2, taxi: 5, drive: 5.5 };
const ms = clamp((dist / (WATCH[effMode] ?? modeById(effMode).mapSpeed)) * 1000 * (jam ? 1.5 : 1), effMode === "bus" ? 12000 : effMode === "taxi" || effMode === "drive" ? 10000 : 1500, 45000);
setTripEta(Date.now() + ms);
tripRef.current = { fromId: from.id, toId: locId, fx: from.x, fz: from.z, tx: to.x, tz: to.z, startedAt: Date.now(), ms, cost, mode: effMode };
setTripTo(locId);
/* 公交/打车不是地图上挪个小人就算搭乘：和地铁一样弹出车厢电影动画
   （站台等车→上车→坐进车厢看窗外→到站下车）。所有行程都触发，
   不分远近；四步动画按这趟的实际时长 ms 等分缩放，行程到点时
   最后一步没演完就等它演完再收（见 roadRideArrived 的处理）。 */
setTripMode(effMode);
if (effMode === "taxi") sfx("horn");
if (effMode === "bus" || effMode === "taxi" || effMode === "drive") {
setRideBig(true);
setRoadRide({ mode: effMode, fromName: from.name, toName: to.name, fare: cost, durMs: ms, startedAt: Date.now() });
setRoadRideStep(0);
setRoadRideArrived(false);
}
if (walkTimer.current) window.clearTimeout(walkTimer.current);
walkTimer.current = window.setTimeout(() => {
setCurrentLoc(locId);
currentLocRef.current = locId;
setWalking(false);
setTripMode(null);
setTripEta(null);
setTripTo(null); tripRef.current = null;
/* 到站不直接掐断搭乘动画：只标记已到达，弹窗等四步演完再收起。 */
setRoadRideArrived(true);
if (pendingStationRide.current) {
const pr = pendingStationRide.current;
pendingStationRide.current = null;
if (pr.board === locId) {
showToast(`到「${pr.route.stations[0]?.name ?? ""}」站了，进站上车：${pr.route.summary}。`);
startMetroRide(pr.board, pr.alight, pr.route);
}
} else if (pendingRide.current) {
const dest = pendingRide.current;
pendingRide.current = null;
const ck = gsRef.current?.cityKey ?? "sz";
if (dest !== locId && findMetroRoute(ck, locId, dest)) {
showToast(`到「${locById(locId).name}」了，接着坐${railWord(ck)}去${locById(dest).name}。`);
startMetroRide(locId, dest);
}
} else if (pendingSleep.current) { pendingSleep.current = false; playLifeAnim("sleep", () => doSleep()); }
}, ms);
};

useEffect(() => { walkToRef.current = walkTo; });
/* switching mid-trip: set off again only once the old trip has really ended (a fixed delay missed it on slow phones) */
useEffect(() => {
if (!switchTrip || walking || carriage) return;
const st = switchTrip; setSwitchTrip(null);
walkTo(st.to, st.mode);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [switchTrip, walking, carriage]);

/* 到了一个地方：车站盖章、真实地点进图鉴（跨局保留） */
useEffect(() => {
if (phase !== "game") return;
const s0 = gsRef.current;
if (!s0 || currentLoc === "home") return;
const names: string[] = [];
if (currentLoc.startsWith("st:")) names.push(currentLoc.slice(3));
else for (const l of metroLinesForCity(s0.cityKey)) for (const st of l.stations) if (st.locId === currentLoc) names.push(st.name);
if (names.length) stampStations(names);
const atlasId = `${s0.cityKey}:${currentLoc}`;
if (!currentLoc.startsWith("st:") && !metaRef.current.atlas.includes(atlasId)) {
updMeta((m) => { m.atlas = [...m.atlas, atlasId]; bump(m, "places"); });
floatReward(`📖 图鉴 +1`, "green");
}
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentLoc, phase]);
/* 云存档：存档或进度变了、安静 12 秒后上传；切到后台时立刻上传 */
const pushCloud = () => {
const prof = profileRef.current; const st = gsRef.current;
if (!prof || !st) return;
void api.cloudSave({ playerId: prof.playerId, secret: cloudCode(), save: JSON.stringify({ profile: prof, gs: st }), meta: JSON.stringify(metaRef.current) })
.then((r) => {
if (r.ok) setCloudAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
else if (r.error === "存档码已被占用") setCloudCode(newCloudCode());
}).catch(() => { /* offline: the next change retries */ });
};
useEffect(() => {
if (phase !== "game") return;
const t = window.setTimeout(pushCloud, 12000);
return () => window.clearTimeout(t);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [gs, meta, phase]);
useEffect(() => {
const onHide = () => { if (document.visibilityState === "hidden" && phase === "game") pushCloud(); };
document.addEventListener("visibilitychange", onHide);
return () => document.removeEventListener("visibilitychange", onHide);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [phase]);
const restoreFromCloud = async () => {
const code = restoreCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
if (code.length !== 10) { showToast("存档码是 10 位字母数字，比如 ABCDE-FGH23。"); return; }
try {
const r = await api.cloudLoad({ secret: code });
if (!r.ok || !r.save) { showToast("没找到这个存档码，检查一下有没有输错。"); return; }
localStorage.setItem(LS_KEY, r.save);
if (r.meta) localStorage.setItem("shhr-meta-v1", r.meta);
setCloudCode(code);
showToast("找到云存档了，正在载入…");
window.setTimeout(() => window.location.reload(), 600);
} catch { showToast("网络不太好，稍后再试。"); }
};
const openShare = async () => {
const st = gsRef.current; const prof = profileRef.current;
if (!st || !prof) return;
setShareOpen(true);
const blob = await drawShareCard({
name: prof.name, cityName: CITIES[st.cityKey].name, day: Math.min(30, st.day), money: st.money, goal: st.goal,
career: (CAREERS[st.careerIdx] ?? CAREERS[0]!).name, company: employerHere(st)?.short ?? "仲恺公司", companyEmoji: employerHere(st)?.emoji ?? "🏭",
title: metaRef.current.title, stamps: metaRef.current.stamps.length, stampTotal: SZ_STATION_COUNT, places: metaRef.current.atlas.length,
lines: metaRef.current.linesDone.length, achievements: metaRef.current.achievements.length, streak: metaRef.current.streak.count,
event: `${evRef.current.emoji} ${evRef.current.name}`, link: inviteLink(myPubRef.current, prof.name, st.employer),
climb: (() => { const T = TIERS[st.cityKey]; const t0 = st.startTier ?? tierOfIden(st.idenId); const t1 = tierAt(st); return { from: `${T[t0]!.emoji} ${T[t0]!.zh}`, to: `${T[t1]!.emoji} ${T[t1]!.zh}`, verdict: climbVerdict(t0, t1, false), origin: originById(st.origin)?.zh }; })(),
});
if (blob) setShareImg((old) => { if (old) URL.revokeObjectURL(old.url); return { url: URL.createObjectURL(blob), blob }; });
};
const shareNative = async () => {
const st = gsRef.current; const prof = profileRef.current;
if (!st || !prof) return;
const link = inviteLink(myPubRef.current, prof.name, st.employer);
const T = TIERS[st.cityKey]; const t0 = st.startTier ?? tierOfIden(st.idenId); const t1 = tierAt(st); const og = originById(st.origin);
const text = `我在《湾区人生》${og ? `抽到的出身是「${og.zh}」，` : ""}从「${T[t0]!.zh}」开始，第 ${Math.min(30, st.day)} 天${t1 > t0 ? "已经爬到" : t1 < t0 ? "跌到了" : "还在"}「${T[t1]!.zh}」。30 天能搬进${T[3]!.zh}吗？你也来抽一签：`;
try {
const file = shareImg ? new File([shareImg.blob], "bay-area-life.png", { type: "image/png" }) : null;
if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text, url: link });
else if (navigator.share) await navigator.share({ text, url: link });
else { await navigator.clipboard.writeText(`${text}${link}`); showToast("分享文案和邀请链接已复制，粘贴给朋友就行。"); }
} catch { /* user closed the share sheet */ }
};
/* ready-made posts for 朋友圈 / 小红书 / 抖音: the origin and the climb are the hook */
const copyPost = async (where: "moments" | "xhs" | "douyin") => {
const st = gsRef.current; const prof = profileRef.current;
if (!st || !prof) return;
const T = TIERS[st.cityKey]; const t0 = st.startTier ?? tierOfIden(st.idenId); const t1 = tierAt(st); const og = originById(st.origin);
const link = inviteLink(myPubRef.current, prof.name, st.employer);
const who = og ? og.zh : IDENTITIES.find((i) => i.id === st.idenId)?.name ?? "深漂";
const climb = `${T[t0]!.zh} → ${T[t1]!.zh}`;
const text = where === "moments"
  ? `在《湾区人生》抽签投胎，抽到「${who}」😂 第 ${Math.min(30, st.day)} 天，${climb}。30 天能搬进${T[3]!.zh}吗？你也来抽一签：${link}`
  : where === "xhs"
  ? `🎲 抽签投胎｜我在深圳的 30 天\n\n开局抽到：${who}\n现在：${climb}（${climbVerdict(t0, t1, false)}）\n\n真实地图 + 真实地铁 + 真人联机，11 月 14–19 日峰会周还能去会场当志愿者。你会抽到什么出身？👉 ${link}\n\n#湾区人生 #抽签投胎 #深圳打工人 #APEC深圳 #模拟人生`
  : `开局抽到「${who}」，30 天能不能从${T[t0]!.zh}爬到${T[3]!.zh}？第 ${Math.min(30, st.day)} 天战报：${climb}。评论区晒你的出身👇 ${link} #湾区人生 #抽签投胎`;
try { await navigator.clipboard.writeText(text); showToast(en ? "Copied — paste it with the image." : "文案已复制，配上分享图发出去吧。"); track("share_copy", { where }); }
catch { showToast(en ? "Couldn't copy — long-press to copy the link instead." : "复制失败，长按链接手动复制。"); }
};
const copyInvite = async () => {
const st = gsRef.current; const prof = profileRef.current;
if (!st || !prof) return;
try { await navigator.clipboard.writeText(inviteLink(myPubRef.current, prof.name, st.employer)); showToast("邀请链接已复制：朋友点开就能进同一个世界。朋友玩满 3 天、和真人组过一次局后，你会收到 ¥200 邀请奖励（每周最多 10 份）。"); }
catch { showToast("复制失败，长按下面的链接手动复制。"); }
};

/* 连续登录：按真实日历算，每天进游戏时滚动一次 */
useEffect(() => {
if (phase === "game") updMeta((m) => { touchStreak(m); });
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [phase]);
/* background music follows the moment; ambience follows the place */
const [musicTick, setMusicTick] = useState(0);
const [singing, setSinging] = useState(false);
useEffect(() => { if (!lifeAnim) setSinging(false); }, [lifeAnim]);
useEffect(() => { if (lifeAnim?.kind === "gathering") sfx("laugh"); }, [lifeAnim?.kind]);
useEffect(() => { const id = window.setInterval(() => setMusicTick((n) => n + 1), 60_000); return () => window.clearInterval(id); }, []);
useEffect(() => {
  if (phase !== "game") { setScene("off"); return; }
  const here = getLocations(gs?.cityKey ?? "sz").find((l) => l.id === currentLoc);
  const tn = nowMin();
  const sc: SoundScene = scenicMoment ? "scenic" : venue3d?.set === "club" || (here?.type === "social" && !walking) ? "club" : nowRainy ? "rain" : tn >= 19 * 60 || tn < 6 * 60 ? "night" : "day";
  const sea = !!here && (here.type === "port" || /海|滩|湾|岛|港|泳|沙|渔/.test(here.name) || here.emoji === "🌊" || here.emoji === "🏖️");
  const place: PlaceTone = !here ? "street" : sea ? "sea" : here.type === "mountain" || /山|峰|岭/.test(here.name) ? "mountain" : here.type === "market" ? "market" : here.type === "mall" ? "mall" : here.type === "food" || here.type === "transit" ? "crowd" : here.type === "social" ? "social" : here.type === "home" ? "home" : here.type === "scenic" || here.type === "fun" ? "park" : here.type === "work" || here.type === "learn" || here.type === "health" || here.type === "gym" || here.type === "bank" || here.type === "service" || here.type === "lodging" ? "indoor" : "street";
  const travel: TravelTone = carriage ? "metro" : walking && (tripMode === "walk" || tripMode === "run") ? "walk" : "still";
  const clock = bjNow();
  const storm = rwOk ? realWeather!.kind === "storm" : weatherOf(gs?.day ?? 1, gs?.cityKey ?? "sz").includes("暴雨");
  /* round-2 (g S10): scene-matched sounds2 bed under the music */
  const sceneSfx: SceneSfxId | undefined =
    lifeAnim?.kind === "cook" ? "cooking"
    : lifeAnim?.kind === "gym" ? "gym"
    : lifeAnim?.kind === "sleep" ? "sleep"
    : venue3d?.set === "restaurant" ? "cooking"
    : venue3d?.set === "gym" ? "gym"
    : venue3d?.set === "clinic" ? "hospital"
    : undefined;
  setWorld({ scene: sc, minute: tn, day: clock.d, month: clock.mo, place, travel, storm, karaoke: singing, sceneSfx });
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [phase, currentLoc, walking, nowRainy, musicTick, soundIsOn, scenicMoment, venue3d, carriage, tripMode, singing]);
const heardLoc = useRef<string | null>(null);
useEffect(() => {
  if (phase !== "game") return;
  if (heardLoc.current === null) { heardLoc.current = currentLoc; return; }
  if (heardLoc.current === currentLoc) return;
  heardLoc.current = currentLoc;
  const loc = getLocations(gs?.cityKey ?? "sz").find((l) => l.id === currentLoc);
  if (loc && ["home", "mall", "market", "food", "social", "work", "lodging"].includes(loc.type)) sfx("door");
}, [currentLoc, phase]); // eslint-disable-line react-hooks/exhaustive-deps
useEffect(() => { if (venue3d) sfx("door"); }, [venue3d]);
/* 今日城市事件：新的一天播报一次，并记进「见过的事件」 */
useEffect(() => {
if (phase !== "game") return;
if (!metaRef.current.eventsSeen.includes(todayEvent.id)) updMeta((m) => { m.eventsSeen = [...m.eventsSeen, todayEvent.id]; });
/* a pain-point day (回南天…) hits the mood once per game day */
if (todayEvent.moodHit && gsRef.current && gsRef.current.moodHitDay !== gsRef.current.day) mutate((x) => { x.mood = clamp(x.mood + (todayEvent.moodHit ?? 0), 0, 100); x.moodHitDay = x.day; });
showToast(`${todayEvent.emoji} 今日城市事件「${todayEvent.name}」：${todayEvent.desc}`);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [phase, todayEvent.id, todayEvent.desc]);

/* round-2: once-per-day ticks (economy, courses, pets, encouragement, check-in) */
useEffect(() => {
  const d = gs?.day; if (phase !== "game" || !d || lastTickDayRef.current >= d) return;
  lastTickDayRef.current = d;
  const s0 = gsRef.current; if (!s0) return;
  setPets((p) => ({ ...p, pets: p.pets.map((pet) => { const pp = { ...pet, stats: { ...pet.stats } }; for (const l of tickPetDay(pp, d)) addLog(l); return pp; }) }));
  const et = economyDailyTick(econRef.current, d, s0.rent);
  setEcon(et.state);
  if (et.subletRentDue > 0) mutate((x) => { x.money += et.subletRentDue; x.earned += et.subletRentDue; });
  for (const e of et.events) addLog(e);
  if (s0.life) {
    const cr = courseDayTick(s0.life, d);
    if (cr.ok && (cr.lines.length || (cr.state.flat.courses ?? []).some((c) => c.done))) applyLife(cr);
    const enc = encouragementFor(d);
    showToast(`${enc.who[0]}：${enc.line[0]}`);
    if (checkinDue(s0.life, d)) setCheckinOpen(true);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [gs?.day, phase]);

/* Ride exactly the route picked on the line map, between ANY two stations
   (not only stations that are also game locations). Not at the boarding
   station yet → walk to it first, then board automatically. */
const rideStations = (fromName: string, toName: string) => {
const s0 = gsRef.current;
if (!s0 || walking || carriage) return;
const route = findStationRoute(s0.cityKey, fromName, toName);
const board = exitLocForStation(s0.cityKey, fromName);
const alight = exitLocForStation(s0.cityKey, toName);
if (!route || !board || !alight) { showToast("这两个站之间规划不出线路，换个站试试。"); return; }
const due = evRef.current.metroFree ? 0 : Math.round(route.fare * policyRef.current.metro);
if (s0.money < due) { showToast(`这趟车票 ¥${due}（${route.summary}），钱包不够，先打工攒点钱再坐。`); return; }
pendingRide.current = null;
pendingAfterRide.current = null;
if (board !== currentLocRef.current) {
pendingStationRide.current = { route, board, alight };
showToast(`先走到「${fromName}」站（${locById(board).short}旁）进站，再坐 ${route.summary} 到「${toName}」。`);
walkTo(board, "walk");
return;
}
startMetroRide(board, alight, route);
};

const goHomeAndSleep = () => {
if (currentLocRef.current === "home" &&!walking) {
doSleep();
} else {
pendingSleep.current = true;
walkTo("home");
}
};

/* ---------- 跨城切换：高铁去惠州，过关去香港 ----------
   One save, three cities: the run itself (money, career, home, furniture,
   progress) does NOT change — only the city you stand in. Map, locations,
   real weather, the online channel, foods/gigs and the neighbours' wall
   all resolve from gs.cityKey, so the switch is: play the in-game scene,
   then flip cityKey, land at the other city's gateway station, and
   rebuild today's NPC wall for the new city. Shenzhen ⇄ Huizhou rides
   the 厦深高铁 (no border). Anything touching Hong Kong is a real border
   crossing — 高铁到西九龙站一地两检，或罗湖/福田/深圳湾口岸过关 — so it
   plays the 过关 scene （出示证件 → 安检 → 入境） instead. The presence
   heartbeat follows on its own (it syncs gs.cityKey + currentLoc). */
const INTERCITY_STATION: Record<CityKey, string> = { sz: "north", hz: "hzsouth", hk: "westkowloon" };
const INTERCITY_FARE = 40;
/** Real-ish one-way fares: 深圳北↔惠州南 ≈ ¥40 （厦深）; 深圳北↔西九龙
    二等座 ¥75 （广深港高铁）; 惠州南↔西九龙 ≈ ¥120 (via 深圳）. The fare
    is always NAMED in the departure city's currency (crossFareLabel):
    the same 75 reads ¥75（深圳出发 · 人民币）one way and HK$75（西九龙
    出发 · 港币）the other. */
function intercityFare(from: CityKey, to: CityKey): number {
  const pair = [from, to].sort().join("-");
  if (pair === "hk-sz") return 75;
  if (pair === "hk-hz") return 120;
  return INTERCITY_FARE;
}
const switchCity = (to: CityKey, route?: CrossRoute) => {
const s0 = gsRef.current;
if (!s0) return;
if (walking || carriage || lifeAnim) { showToast("先等这趟行程结束，再去坐跨城的车。"); return; }
const from = s0.cityKey;
if (to === from) return;
const fare = route ? route.fare : intercityFare(from, to);
const crossing = from === "hk" || to === "hk";
const arrLoc = route?.toLoc ?? INTERCITY_STATION[to];
/* Fare as the player sees it: cross-border fares are labelled in the
   DEPARTURE currency (West Kowloon → HK$, Shenzhen/Huizhou → ¥, named
   as such); the domestic Shenzhen⇄Huizhou fare stays a plain ¥40. */
const fareTxt = route ? crossFareStr(route) : crossing ? crossFareLabel(from, fare) : `¥${fare}`;
/* The fare is charged when the player can afford it, but a switch is
   NEVER blocked by an empty wallet （绝不拦路， same rule as cycling):
   broke players ride free and are told so plainly. */
const charged = s0.money >= fare;
const fromStation = getLocations(from).find((l) => l.id === (route && route.fromLoc !== "*" ? route.fromLoc : INTERCITY_STATION[from]))?.name ?? CITIES[from].name;
const toStationLoc = getLocations(to).find((l) => l.id === arrLoc);
const toStation = toStationLoc?.name ?? CITIES[to].name;
const arrive = () => {
/* real bearings between the cities (x east, z south): Hong Kong is south of Shenzhen, Huizhou east-north-east, Hong Kong→Huizhou north-east */
const DIR: Record<string, [number, number]> = { "sz>hk": [0, 1], "hk>sz": [0, -1], "sz>hz": [0.9, -0.35], "hz>sz": [-0.9, 0.35], "hk>hz": [0.6, -0.8], "hz>hk": [-0.6, 0.8] };
const d = DIR[`${from}>${to}`] ?? [0, 0];
setArrival({ dx: d[0], dz: d[1], nonce: Date.now() });
const wall = generateDailyPosts({ day: s0.day, cityKey: to, playerName: profileRef.current?.name ?? "我" }, [], gsRef.current?.npcMem ?? {});
mutate((s) => {
s.cityKey = to;
if (charged) s.money -= fare;
s.energy = clamp(s.energy - 6, 1, 100);
s.metroRides = (s.metroRides ?? 0) + 1;
s.npcFeed = wall.posts;
s.npcMem = wall.mems;
if (route) s.energy = clamp(s.energy - Math.round(route.min / 15), 1, 100); // the trip is already acted out: it tires you, it does not lock you
s.log = [{ day: s.day, text: route
  ? `${route.emoji} ${route.name}：从${fromStation}出发${crossing ? "，出示证件、安检、入境" : ""}，${route.min} 分钟后到了${toStation}——接下来在${CITIES[to].name}过日子，进度、家当原样带着${charged ? (fare ? `（${fareTxt}）` : "") : "（钱包不够，这趟免费）"}。`
  : crossing
  ? `过关啦：坐高铁从${fromStation}出发，在${to === "hk" ? "西九龙站一地两检" : "口岸"}办完出示证件、安检、入境手续，抵达${toStation}——接下来在${CITIES[to].name}过日子，进度、家当原样带着走${charged ? `（车票 ${fareTxt}）` : "（钱包不够车票钱，这趟免费坐）"}。`
  : `坐厦深高铁从${fromStation}到${toStation}，接下来在${CITIES[to].name}过日子——进度、家当都原样带着走${charged ? `（车票 ${fareTxt}）` : "（钱包不够车票钱，这趟免费坐）"}。` }, ...s.log].slice(0, 40);
});
setCurrentLoc(arrLoc); currentLocRef.current = arrLoc;
setSelectedLoc(arrLoc);
setAsideTab("place"); autoOpenAside();
setMapFocus({ locId: arrLoc, nonce: Date.now() });
showToast(charged
  ? `${crossing ? "🛃 过关成功" : "🚄 到站"}——${toStation}！这里是${CITIES[to].name}——地图、天气、街坊都换了，进度原样带着（车票 ${fareTxt}）。`
  : `${crossing ? "🛃 过关成功" : "🚄 到站"}——${toStation}！钱包不够车票钱，这趟免费坐，绝不拦路。这里是${CITIES[to].name}，进度原样带着。`);
burstDanmaku([`${crossing ? "🛃" : "🚄"} ${profileRef.current?.name ?? "我"} ${crossing ? "过关去了" : "坐高铁去了"}${CITIES[to].name}`, `欢迎来到${CITIES[to].name} 🎉`]);
postFeed("life", crossing ? `过关去了${CITIES[to].name}，换座城市过日子` : `坐厦深高铁去了${CITIES[to].name}，换座城市过日子`);
};
/* The trip is acted out on the game's own 3D sets — the 过关 concourse
   sequence for Hong Kong, the 下高铁 platform scene for Huizhou — then
   the arrival callback flips the city. */
playLifeAnim(crossing ? "crossing" : "alightRail", arrive);
};
/* ---------- 工作日常：每种职业一天里的真实步骤 ---------- */
const routineToday = (g: GameState): RoutineDay => (g.routine && g.routine.day === g.day ? g.routine : { day: g.day, done: {} });
const isWorkplace = (l: Loc, g: GameState) => l.type === "work" || !!companyAt(g.cityKey, l.id);
const atJob = (role: RoutineRole, l: Loc, g: GameState) => { const w = ROLE_META[role].where; return w === "any" ? true : w === "work" ? isWorkplace(l, g) : w.includes(l.type); };
/** shops a rider picks up from, and places they deliver to (any game place or town / village) */
const riderPick = (g: GameState, role: RoutineRole = "rider"): { shop: string; dest: string; d: number } | null => {
  const locs = getLocations(g.cityKey);
  const shops = role === "driver"
    ? [...locs.filter((l) => l.id !== currentLocRef.current)] // a fare can wave from anywhere
    : locs.filter((l) => ["food", "mall", "market", "social"].includes(l.type) && !venueClosed(l)); // only places open right now take orders
  const shop = shops[Math.floor(Math.random() * shops.length)];
  if (!shop) return null;
  const pool = [...locs.filter((l) => l.id !== shop.id && ["home", "work", "learn", "health", "hotel", "fun", "scenic", "transit"].includes(l.type)).map((l) => ({ id: l.id, x: l.x, z: l.z })),
    ...AREA_LABELS.filter((a) => a.c === g.cityKey).map((a) => ({ id: areaLocId(a.c, a.n), x: a.x, z: a.z }))];
  const near = pool.filter((p) => { const d = Math.hypot(p.x - shop.x, p.z - shop.z); return d > 2.5 && d < 16; });
  const dest = (near.length ? near : pool)[Math.floor(Math.random() * (near.length || pool.length))];
  return dest ? { shop: shop.id, dest: dest.id, d: Math.hypot(dest.x - shop.x, dest.z - shop.z) } : null;
};
const doRoutine = (id: string) => {
  const s0 = gsRef.current; if (!s0 || walking || carriage) return;
  if (s0.busyUntil && Date.now() < s0.busyUntil) { showToast(en ? `Still busy with “${s0.busyWhat ?? "something"}”.` : `还在忙「${s0.busyWhat ?? "上一件事"}」，忙完再说。`); return; }
  const role = routineRole(s0.idenId);
  const step = routineSteps(role).find((x) => x.id === id); if (!step) return;
  const rd = routineToday(s0); const n = rd.done[id] ?? 0; const tn = nowMin();
  const name = en ? step.en : step.zh;
  if (step.max && n >= step.max) { showToast(en ? `That's enough “${name}” for today.` : `「${name}」今天已经够了。`); return; }
  if (step.hours && !inWindow(tn, step.hours)) { showToast(en ? `“${name}” happens between ${windowStr(step.hours)} (Beijing time).` : `「${name}」要在 ${windowStr(step.hours)} 之间做（北京时间）。`); return; }
  if (s0.energy + step.energy < 0) { showToast(en ? "Out of energy — eat or rest first." : "没力气了，先吃点东西或者歇会儿。"); return; }
  if (step.cash && s0.money + step.cash < 0) { showToast(en ? "Not enough money." : "钱不够。"); return; }
  const base = basePay(s0);
  let pay = step.pay ? Math.round(base * step.pay) : 0;
  let mood = step.mood; let note = ""; const xp = step.xp ?? 0;
  let late = rd.late; let payCut = rd.payCut ?? 0;
  let order: RiderOrder | null | undefined = rd.order; let orders = rd.orders ?? 0;
  const hasClock = routineSteps(role).some((x) => x.id === "clockin");
  if (!isOrderRole(role)) {
    if (!atJob(role, locById(currentLocRef.current), s0)) { const w = ROLE_META[role].where; { const TL: Record<string, [string, string]> = { food: ["餐厅", "a restaurant"], market: ["市场", "a market"], mall: ["商场", "a mall"], social: ["娱乐场所", "a nightlife spot"], learn: ["学校 / 图书馆", "a school"], lodging: ["酒店", "a hotel"], health: ["医院", "a hospital"], gym: ["健身房", "a gym"], transit: ["车站", "a station"], bank: ["银行", "a bank"], home: ["小区", "a housing estate"], scenic: ["景区", "a sight"], fun: ["游乐场所", "an attraction"], electronics: ["电子市场", "an electronics market"], oilpainting: ["油画村", "an oil-painting village"], secondhand: ["二手市集", "a second-hand market"], seafood: ["海鲜街", "a seafood street"], oldtown: ["老街", "an old street"], womensstreet: ["女人街", "the Ladies' Market"], museum: ["博物馆", "a museum"], library: ["图书馆", "a library"], factory: ["厂区", "a factory"] };
      showToast(w === "work" ? (en ? "Do this at your workplace (a company or industrial park)." : "这些要到公司 / 厂里 / 工地做。") : en ? `Do this at ${(w as string[]).map((t) => TL[t]?.[1] ?? t).join(", ")}.` : `这些要到${(w as string[]).map((t) => TL[t]?.[0] ?? t).join("、")}做。`); } return; }
    if (hasClock && id !== "clockin" && !rd.done.clockin) { showToast(en ? "Clock in first." : "先打卡上班。"); return; }
    const lateAfter = (step.hours?.[0] ?? 9 * 60) + 90; // over 1.5 h after the start window opens counts as late
    if (id === "clockin" && tn > lateAfter) { late = true; mood -= 4; note = en ? "Late — attendance bonus gone." : "迟到了，全勤奖没了。"; }
    if (id === "clockout") {
      const core = routineSteps(role).filter((x) => x.core && x.id !== "clockin").reduce((t, x) => t + Math.min(x.max ?? 1, rd.done[x.id] ?? 0), 0);
      const share = Math.min(1.15, 0.35 + 0.16 * core) * (late ? 0.95 : 1) * (1 - payCut);
      pay = Math.round(base * share);
      note = en ? `Today's pay settled: ${core}/${CORE_FOR_FULL_DAY + 1} work blocks done.` : `今天的工资结算：完成了 ${core} 项正事${core >= CORE_FOR_FULL_DAY ? "，满勤" : "，还能更多"}${payCut ? `，绩效扣了 ${Math.round(payCut * 100)}%` : ""}。`;
    }
  } else {
    if (id !== "online" && !rd.online && ["grab", "wait", "climb", "handover"].includes(id)) { showToast(en ? "Start your shift first." : role === "driver" ? "先出车。" : "先上线开工。"); return; }
    if (id === "grab") {
      if (order) { showToast(en ? "Finish the order you have first." : "手上还有一单，先送完。"); return; }
      if (Math.random() < 0.42) { note = en ? "Too slow — someone else got it." : "手慢了，被别人抢走了。"; }
      else {
        const pk = riderPick(s0, role);
        if (!pk) note = en ? "No restaurants are open right now — no orders." : "这个点附近没有开门的商家，没单可抢。";
        if (pk) {
          const bonus = nowRainy ? 4 : 0;
          const fare = role === "driver" ? Math.round(12 + pk.d * 2.2) : Math.round(6 + pk.d * 0.9 + base * 0.02 + bonus);
          order = { shop: pk.shop, dest: pk.dest, pay: fare, at: Date.now(), stage: currentLocRef.current === pk.shop ? "waiting" : "toShop", stairs: role === "rider" && (Math.random() < 0.45 || pk.dest.startsWith("ar:")), climbed: false };
          note = role === "driver"
            ? (en ? `Fare: pick up at ${trText(locById(pk.shop).name)}, to ${trText(locById(pk.dest).name)} · about ${Y}${fare}.` : `来单了！去「${locById(pk.shop).name}」接乘客，送到「${locById(pk.dest).name}」，打表约 ${Y}${fare}。`)
            : (en ? `Got it: pick up at ${trText(locById(pk.shop).name)}, deliver to ${trText(locById(pk.dest).name)} · ${Y}${order.pay}${bonus ? " (rain bonus)" : ""}.` : `抢到了！去「${locById(pk.shop).name}」取餐，送到「${locById(pk.dest).name}」，这单 ${Y}${order.pay}${bonus ? "（下雨加价）" : ""}。`);
        }
      }
    }
    if (id === "wait") {
      if (!order || order.stage !== "waiting" || currentLocRef.current !== order.shop) { showToast(en ? "Get there first." : role === "driver" ? "先开到乘客那儿。" : "到了商家再等餐。"); return; }
      const slow = Math.random() < 0.3; if (slow) { mood -= 3; note = role === "driver" ? (en ? "The passenger kept you waiting." : "乘客磨磨蹭蹭让你等了好久。") : (en ? "The kitchen took forever." : "出餐巨慢，站在门口干着急。"); }
      order = { ...order, stage: "toDest" };
    }
    if (id === "climb") {
      if (!order || order.stage !== "atDoor" || !order.stairs || order.climbed) { showToast(en ? "No stairs to climb right now." : "现在没楼可爬。"); return; }
      order = { ...order, climbed: true };
    }
    if (id === "handover") {
      if (!order || order.stage !== "atDoor") { showToast(en ? "Get to the customer first." : "先把餐送到顾客那儿。"); return; }
      if (order.stairs && !order.climbed) { showToast(en ? "It's on the 7th floor — climb up first." : "顾客住七楼，先爬上去。"); return; }
      const lateBy = Date.now() - order.at > 10 * 60_000;
      pay = Math.round(order.pay * (lateBy ? 0.7 : 1));
      const tip = !lateBy && Math.random() < 0.22 ? 3 + Math.floor(Math.random() * 6) : 0;
      pay += tip; if (lateBy) mood -= 4;
      note = role === "driver"
        ? (en ? `Fare collected: ${Y}${pay}${tip ? ` incl. ${Y}${tip} tip` : ""}${lateBy ? " (took too long — the passenger complained)" : ""}.` : `到了，收款 ${Y}${pay}${tip ? `（含小费 ${Y}${tip}）` : ""}${lateBy ? "（绕得太久被投诉，少收了）" : ""}。`)
        : (en ? `Delivered! ${Y}${pay}${tip ? ` incl. a ${Y}${tip} tip` : ""}${lateBy ? " (late — 30% deducted)" : ""}.` : `送达！这单 ${Y}${pay}${tip ? `（含小费 ${Y}${tip}）` : ""}${lateBy ? "（超时扣了三成）" : ""}。`);
      order = null; orders += 1;
    }
  }
  const risky = step.risk && Math.random() < step.risk.p;
  if (risky && step.risk) { mood += step.risk.mood; if (step.risk.payCut) { payCut = Math.min(0.6, payCut + step.risk.payCut); if (step.pay) pay = Math.round(pay * 0.3); } note = en ? step.risk.en : step.risk.zh; }
  mutate((x) => {
    x.routine = { ...rd, done: { ...rd.done, [id]: n + 1 }, late, payCut, order, orders, online: rd.online || id === "online" };
    x.energy = clamp(x.energy + step.energy, 0, 100); x.mood = clamp(x.mood + mood, 0, 100);
    x.money += pay + (step.cash ?? 0); x.earned += pay; x.xp += risky ? 0 : xp;
    if (step.skill && !risky) x.skill += step.skill;
    if (step.network) x.network += step.network;
    x.busyUntil = Date.now() + cooldownMs(step.min); x.busyWhat = en ? step.en : step.zh;
    if (id === "clockout" || id === "handover") { x.workDay = x.day; if (id === "clockout") x.workCount += 1; }
  });
  if (pay > 0) floatReward(`+${fmt(pay)}`, "gold");
  showToast(`${step.emoji} ${name}${note ? ` — ${note}` : en ? ` — ${step.subEn}` : ` —— ${step.sub}`}`);
  track("routine", { role, step: id });
  if (step.scene) {
    routineStage = { set: step.scene.set, pose: step.scene.pose };
    LIFE_SCENES.routine = { title: en ? step.en : step.zh, tone: "indoor", steps: [{ bg: step.scene.bg, prop: step.scene.prop, caption: name, sub: note || (en ? step.subEn : step.sub), move: "stay", fx: step.scene.pose === "type" ? "type" : step.scene.pose === "eat" ? "chew" : step.scene.pose === "sleep" ? "zzz" : undefined }] };
    playLifeAnim("routine");
  }
};
/* the rider rides the order: to the shop, then to the customer — real trips on the map by e-bike */
const riderGo = () => {
  const s0 = gsRef.current; const o = s0 ? routineToday(s0).order : null; if (!s0 || !o) return;
  const target = o.stage === "toShop" || o.stage === "waiting" ? o.shop : o.dest;
  if (!target) return;
  if (target === currentLocRef.current) return;
  walkTo(target, routineRole(s0.idenId) === "driver" ? "taxi" : "moto");
};
/* stop a trip midway: get off at the nearest place / station / neighbourhood
   to where you are right now (the unused part of a taxi / car / bike fare
   comes back), optionally carrying on to the same destination another way */
const stopTrip = (nextMode?: TransportModeId) => {
  const t = tripRef.current; const s0 = gsRef.current;
  if (!walking || carriage || !t || !s0) return;
  const frac = clamp((Date.now() - t.startedAt) / t.ms, 0, 1);
  const px = t.fx + (t.tx - t.fx) * frac, pz = t.fz + (t.tz - t.fz) * frac;
  let best = t.fromId; let bd = Infinity;
  const consider = (id: string, x: number, z: number) => { const d = Math.hypot(x - px, z - pz); if (d < bd) { bd = d; best = id; } };
  for (const l of getLocations(s0.cityKey)) consider(l.id, l.x, l.z);
  for (const pl of placesForCity(s0.cityKey)) consider(`pl:${pl.id}`, pl.x, pl.z);
  for (const line of metroLinesForCity(s0.cityKey)) for (const st of line.stations) if (!st.name.endsWith("方向")) consider(stationLocId(st.name), st.x, st.z);
  for (const a of AREA_LABELS) if (a.c === s0.cityKey) consider(areaLocId(a.c, a.n), a.x, a.z);
  const refund = ["taxi", "drive", "moto", "bike"].includes(t.mode) ? Math.max(0, Math.round(t.cost * (1 - frac))) : 0;
  if (walkTimer.current) window.clearTimeout(walkTimer.current);
  pendingRide.current = null; pendingAfterRide.current = null; pendingStationRide.current = null; pendingSleep.current = false;
  setRoadRide(null); setRoadRideArrived(false);
  setWalking(false); setTripMode(null); setTripEta(null); setTripTo(null); tripRef.current = null;
  setCurrentLoc(best); currentLocRef.current = best;
  if (refund > 0) mutate((x) => { x.money += refund; });
  const here = locById(best);
  showToast(en ? `🛑 Stopped near ${trText(here.name)}${refund > 0 ? ` · ${Y}${refund} of the fare back` : ""}.` : `🛑 在「${here.name}」附近下了车${refund > 0 ? `，没坐完的 ${Y}${refund} 退回来了` : ""}。`);
  if (nextMode && t.toId !== best) { setTravelMode(nextMode); setSwitchTrip({ to: t.toId, mode: nextMode }); }
  else setSelectedLoc(best);
};
/* remember where you stand, so reopening the game puts you back there */
useEffect(() => {
  const g = gsRef.current; if (!g || phase !== "game" || g.loc === currentLoc) return;
  mutate((x) => { x.loc = currentLoc; });
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentLoc, phase]);
/* arriving moves the order on: at the shop you wait for the food, at the door you hand it over */
useEffect(() => {
  const s0 = gsRef.current; if (!s0) return;
  const rd = routineToday(s0); const o = rd.order; if (!o) return;
  if (o.stage === "toShop" && currentLoc === o.shop) mutate((x) => { x.routine = { ...rd, order: { ...o, stage: "waiting" } }; });
  else if (o.stage === "toDest" && currentLoc === o.dest) mutate((x) => { x.routine = { ...rd, order: { ...o, stage: "atDoor" } }; });
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentLoc]);
/* ---------- 观景时刻 ---------- */
const startScenic = (id: string) => {
  const m = SCENIC_MOMENTS.find((x) => x.id === id); const g = gsRef.current;
  if (!m || !g || scenicMoment) return;
  const here = locById(currentLocRef.current);
  setAsideOpen(false); setNavOpen(false); setDailyOpen(false);
  setScenicLine(0);
  setScenicMoment({ m, at: Date.now(), nonce: Date.now() });
  track("scenic_start", { id: m.id, best: inBest(m, nowMin()) });
  void here;
};
const finishScenic = () => {
  const cur = scenicMoment; if (!cur) return;
  setScenicMoment(null);
  const g = gsRef.current; if (!g) return;
  const best = inBest(cur.m, nowMin());
  const watchedEnough = Date.now() - cur.at > cur.m.durMs * 0.6;
  if (!watchedEnough) return;
  const key = `${g.cityKey}:scenic:${cur.m.id}`;
  const first = !(g.visitedScenic ?? []).includes(key);
  const gain = (best ? 20 : 12) + (first ? 4 : 0);
  mutate((x) => { x.mood = clamp(x.mood + gain, 0, 100); x.fun = clamp100(x.fun + gain); if (first) x.visitedScenic = [...(x.visitedScenic ?? []), key]; });
  floatReward(`${en ? "mood" : "心情"} +${gain}`, "green");
  sfx("applause");
  showToast(en ? `${cur.m.emoji} ${cur.m.en}${best ? " — at the perfect time" : ""}. Mood +${gain}.` : `${cur.m.emoji} ${cur.m.zh}${best ? "，赶上了最好的时候" : ""}。心情 +${gain}。`);
  track("scenic_done", { id: cur.m.id, best, first });
};
useEffect(() => {
  if (!scenicMoment) return;
  const n = scenicMoment.m.lines.length;
  const step = scenicMoment.m.durMs / n;
  const ids = scenicMoment.m.lines.map((_, i) => window.setTimeout(() => setScenicLine(i), i * step));
  const end = window.setTimeout(() => finishScenic(), scenicMoment.m.durMs + 600);
  return () => { ids.forEach((t) => window.clearTimeout(t)); window.clearTimeout(end); };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [scenicMoment?.nonce]);
/* ---------- 转行 / 考证：换一份工作 ---------- */
/** what a new job asks of you: skill points for the skilled trades, start-up money for a business */
const RETRAIN_NEED: Record<string, { skill?: number; cash?: number }> = { coder: { skill: 5 }, nurse: { skill: 4 }, teacher: { skill: 4 }, chef: { skill: 2 }, coach: { skill: 1 }, barber: { skill: 1 }, masseur: { skill: 1 }, boss: { cash: 8000 } };
const retrainFee = (idenId: string, g: GameState) => { const it = IDENTITIES.find((i) => i.id === idenId); return Math.round(((it?.pay ?? 200) * 4 * CITIES[g.cityKey].payMul) / 10) * 10 + (RETRAIN_NEED[idenId]?.cash ?? 0); };
const retrainBlock = (idenId: string, g: GameState): string | null => {
  const need = RETRAIN_NEED[idenId];
  if (need?.skill && g.skill < need.skill) return en ? `Needs skill ${need.skill} (you have ${g.skill}) — study at the library or night school first` : `需要技能 ${need.skill}（你现在 ${g.skill}），先去图书馆 / 夜校学`;
  if (g.money < retrainFee(idenId, g)) return en ? "Not enough money for the course" : "钱不够交培训费";
  return null;
};
const switchJob = (idenId: string) => {
  const g = gsRef.current; if (!g) return;
  const it = IDENTITIES.find((i) => i.id === idenId); if (!it || it.id === g.idenId || it.id === "rich") return;
  if (g.switchDay !== undefined && g.day - g.switchDay < 3) { showToast(en ? `You changed jobs recently — try again on day ${g.switchDay + 3}.` : `刚转过行，第 ${g.switchDay + 3} 天之后才能再转。`); return; }
  const block = retrainBlock(idenId, g); if (block) { showToast(block); return; }
  const fee = retrainFee(idenId, g);
  const from = idenOf(g);
  mutate((x) => { x.money -= fee; x.idenId = it.id; x.careerIdx = 0; x.routine = undefined; x.switchDay = x.day; x.mood = clamp(x.mood + 6, 0, 100); });
  addLog(`转行：从「${from.name}」换成「${it.name}」，培训费 ${fmt(fee)}。`);
  showToast(en ? `${it.emoji} You're now a ${trText(it.name).toLowerCase()} (course fee ${fmt(fee)}). New daily routine unlocked.` : `${it.emoji} 转行成功：现在是「${it.name}」了（培训费 ${fmt(fee)}），新的日常已解锁。`);
  track("job_switch", { from: from.id, to: it.id });
  setRetrainOpen(false);
};
const routineActs = (loc: Loc, g: GameState): ActDef[] => {
  const role = routineRole(g.idenId);
  if (!isOrderRole(role) && !atJob(role, loc, g)) return [];
  const rd = routineToday(g); const tn = nowMin(); const o = rd.order;
  const out: ActDef[] = [];
  const fmtCost = (st: RoutineStep) => [st.pay ? `+${fmt(Math.round(basePay(g) * st.pay))}` : "", st.cash ? `${st.cash > 0 ? "+" : "-"}${Y}${Math.abs(st.cash)}` : "", st.energy ? `${en ? "energy" : "能量"} ${st.energy > 0 ? "+" : ""}${st.energy}` : "", st.mood ? `${en ? "mood" : "心情"} ${st.mood > 0 ? "+" : ""}${st.mood}` : "", `⏳ ${st.min}${en ? " min" : " 分钟"}`, st.risk ? (en ? "⚠️ risky" : "⚠️ 有风险") : ""].filter(Boolean).join(" · ");
  if (isOrderRole(role) && o) {
    const toShop = o.stage === "toShop" || o.stage === "waiting";
    const tgt = toShop ? o.shop : o.dest;
    const dest = locById(tgt);
    if (toShop) out.push({ kind: "__rider-cancel", emoji: "✖️", title: en ? (role === "driver" ? "Cancel this fare" : "Cancel this order") : "取消这单", desc: role === "driver" ? (en ? "Too far to bother — the app deducts a little." : "太远了不想跑：平台扣一点钱、心情也差点。") : en ? "The shop is closed or too far — the platform deducts a little." : "商家关门了或者太远：平台扣一点钱、心情也差点。", cost: `-${Y}2 · ${en ? "mood" : "心情"} -3` });
    if (currentLoc !== tgt) out.push({ kind: "__rider-go", emoji: role === "driver" ? "🚕" : "🛵", title: role === "driver" ? (en ? (toShop ? `Drive to the passenger · ${trText(dest.name)}` : `Drive to ${trText(dest.name)}`) : (toShop ? `开去接乘客 · ${dest.name}` : `送乘客去 · ${dest.name}`)) : en ? (toShop ? `Ride to pick up · ${trText(dest.name)}` : `Ride to the customer · ${trText(dest.name)}`) : (toShop ? `骑去取餐 · ${dest.name}` : `骑去送餐 · ${dest.name}`), desc: role === "driver" ? (en ? `Meter about ${Y}${o.pay}; take over 10 minutes and the passenger complains (−30%). Watch your taxi on the map.` : `打表约 ${Y}${o.pay}，超过 10 分钟乘客会投诉（少收三成）。地图上看你开过去。`) : en ? `Order worth ${Y}${o.pay}; over 10 minutes late loses 30%.` : `这单 ${Y}${o.pay}，超过 10 分钟算超时扣三成。地图上看你骑过去。`, cost: role === "driver" ? (en ? "your taxi" : "自己的的士") : en ? "e-bike" : "电动车" });
  }
  for (const rawSt of routineSteps(role)) {
    // Round-2 (b S6): the street vendor sells different goods per market subtype.
    const st = role === "vendor" && rawSt.id === "sell"
      ? { ...rawSt, ...vendorSellFor(locById(currentLoc)?.type ?? "market") }
      : rawSt;
    if (isOrderRole(role)) {
      if (st.id === "wait" && !(o?.stage === "waiting" && currentLoc === o.shop)) continue;
      if ((st.id === "climb" || st.id === "handover") && !(o?.stage === "atDoor" && currentLoc === o.dest)) continue;
      if (st.id === "climb" && (!o?.stairs || o.climbed)) continue;
      if (st.id === "grab" && o) continue;
      if (st.id === "online" && rd.online) continue;
    }
    const used = rd.done[st.id] ?? 0;
    const closed = st.hours && !inWindow(tn, st.hours);
    const full = st.max !== undefined && used >= st.max;
    out.push({ kind: `__routine-${st.id}`, emoji: st.emoji, title: `${en ? st.en : st.zh}${st.max && st.max > 1 ? ` (${used}/${st.max})` : full ? " ✓" : ""}`, desc: closed ? (en ? `Between ${windowStr(st.hours!)}` : `${windowStr(st.hours!)} 之间`) : en ? st.subEn : st.sub, cost: fmtCost(st), disabled: !!closed || full });
  }
  return out;
};
/** Take one real route: it runs only in its real hours, a car route needs a
    licence and a car, and you board where the route starts. */
const takeRoute = (r: CrossRoute) => {
const s0 = gsRef.current; if (!s0) return;
if (r.shut) { showToast(en ? `${r.emoji} ${crossName(r, true)}: ${crossHoursStr(r, true)}.` : `${r.emoji} ${r.name}：${r.shut}。`); return; }
if (!isCrossOpen(r, nowMin())) { showToast(en ? `${r.emoji} ${crossName(r, true)} isn't running now (${crossHoursStr(r, true)}, Beijing time). The Huanggang cross-border bus runs 24 hours.` : `${r.emoji} ${r.name} 现在不开（${crossHoursStr(r)}，北京时间）。换一条：皇岗口岸的跨境巴士 24 小时都有。`); return; }
if (r.car && !((s0.license ?? 0) >= 3 && (s0.carOwned || s0.carDay === s0.day))) { showToast("自驾要先考到驾照、有车（买车或者租一天）。"); return; }
if (s0.busyUntil && Date.now() < s0.busyUntil) { showToast(`还在忙「${s0.busyWhat ?? "上一件事"}」，忙完再出发。`); return; }
if (r.fromLoc !== "*" && currentLocRef.current !== r.fromLoc) {
  const l = getLocations(s0.cityKey).find((x) => x.id === r.fromLoc);
  setCrossTo(null); setSelectedLoc(r.fromLoc); walkTo(r.fromLoc);
  showToast(`先去${l?.name ?? "出发点"}——到了在那里点「${r.name}」出发。`);
  return;
}
setCrossTo(null);
track("cross_city", { route: r.id });
switchCity(r.to, r);
};

/* ---------- core numbers ---------- */
const basePay = (s: GameState) => {
const iden = idenOf(s);
const career = CAREERS[s.careerIdx]?? CAREERS[0]!;
return Math.round(iden.pay * CITIES[s.cityKey].payMul * career.mul);
};

/* ---------- 长线进度：集章 / 图鉴 / 周目标 / 成就 ---------- */
const updMeta = (fn: (m: Meta) => void) => {
const m: Meta = structuredClone(metaRef.current);
rollWeek(m);
fn(m);
const fresh = checkAchievements(m, { totalStations: SZ_STATION_COUNT, totalPlaces: placesForCity("sz").length });
metaRef.current = m;
saveMeta(m);
setMetaState(m);
for (const a of fresh) {
floatReward(`🏅 ${a.title}`, "gold");
showToast(`🏅 解锁成就「${a.title}」：${a.desc}。在右侧「🎫 集章」里可以戴上这个称号。`);
}
};
/** Stamp the stations you got on / off / changed at; finishing a line pays out. */
const stampStations = (names: (string | undefined)[]) => {
const clean = [...new Set(names.filter((n): n is string => !!n && !n.endsWith("方向")))];
if (clean.length === 0) return;
let fresh: string[] = [];
const done: MetroLine[] = [];
updMeta((m) => {
fresh = clean.filter((n) => !m.stamps.includes(n));
if (fresh.length === 0) return;
m.stamps = [...m.stamps, ...fresh];
bump(m, "stamps", fresh.length);
for (const ck of ["sz", "hz"] as const) for (const line of metroLinesForCity(ck)) {
if (m.linesDone.includes(line.id)) continue;
const need = line.stations.map((x) => x.name).filter((n) => !n.endsWith("方向"));
if (need.length > 1 && need.every((n) => m.stamps.includes(n))) { m.linesDone = [...m.linesDone, line.id]; done.push(line); }
}
});
if (fresh.length > 0) floatReward(`🎫 新站章 ×${fresh.length}`, "blue");
for (const line of done) {
const reward = 100 + 10 * line.stations.length;
mutate((x) => { x.money += reward; x.mood += 10; });
showToast(`🏁 集齐「${line.name}」全部 ${line.stations.length} 个站章！奖励 ${fmt(reward)}、心情 +10。`);
burstDanmaku([`🏁 ${profileRef.current?.name ?? "你"}集齐了${line.short}全部站章！`, "老周：这条线我坐了十年都没集齐", "阿琳：太强了 🎫", "子健：下一条线冲！"]);
postFeed("life", `集齐了${line.short}全部站章`);
}
const ev = evRef.current;
const flashKey = `${dateKey()}|${gsRef.current?.day ?? 0}|${ev.flashStation ?? ""}`;
if (ev.flashStation && clean.includes(ev.flashStation) && flashGiven.current !== flashKey) {
flashGiven.current = flashKey;
mutate((x) => { x.money += 88; x.mood += 10; });
floatReward("🎤 快闪 +¥88", "gold");
showToast(`🎤 「${ev.flashStation}」站的快闪演出正好赶上了！大家跟着节奏拍手，奖励 ¥88、心情 +10。`);
}
};
/* A gift another player sent: claim it on the server, then apply it here. */
const receiveGift = (g: InboxGift) => {
const prof = profileRef.current;
if (!prof || claimingGifts.current.has(g.id)) return;
claimingGifts.current.add(g.id);
void api.claimGift({ playerId: prof.playerId, giftId: g.id }).then((r) => {
if (!r.ok || !r.gift) return;
const kind = r.gift.kind as GiftKind;
const meta0 = GIFTS[kind];
if (!meta0) return;
mutate((x) => {
if (kind === "tea") { x.mood += 8; x.energy += 5; x.social = clamp100(x.social + 8); }
else if (kind === "breakfast") { x.energy += 15; x.hunger = clamp100(x.hunger + 22); }
else if (kind === "hongbao") x.money += 88;
else if (kind === "share") x.money += r.gift?.amount ?? 0;
else if (kind === "referral" && r.gift?.company) x.referrals = [...new Set([...(x.referrals ?? []), r.gift.company])];
else if (kind === "invite") x.money += 200;
});
updMeta((m) => bump(m, "social"));
const coName = kind === "referral" ? companyById(r.gift.company ?? undefined).short : "";
floatReward(`${meta0.emoji} 来自${r.gift.fromName}`, "green");
showToast(kind === "invite" ? `🎉 你邀请的${r.gift.fromName}在城里站稳了脚跟！邀请奖励 ¥200 已到账。` : kind === "share" ? `💴 ${r.gift.fromName}的店分了你 ¥${r.gift.amount ?? 0}，已经进钱包。` : kind === "referral" ? `🤝 ${r.gift.fromName}把你内推进了${coName}：去${coName}面试，门槛降低（技能 -2、经验 -6）。` : `${meta0.emoji} ${r.gift.fromName}送了你一份${meta0.name}（${meta0.effect}）。在聊天页可以回赠。`);
addLog(`收到${r.gift.fromName}送的${meta0.name}。`);
}).catch(() => { claimingGifts.current.delete(g.id); });
};
const sendGift = (toId: string, toName: string, kind: GiftKind, amount?: number) => {
const s0 = gsRef.current; const prof = profileRef.current;
if (!s0 || !prof) return;
const gm = GIFTS[kind];
if (s0.money < gm.cost) { showToast(`${gm.name}要 ¥${gm.cost}，钱包不够。`); return; }
if (kind === "referral" && (s0.employer ?? "startup") === "startup") { showToast("先进一家大厂，才能给别人内推。"); return; }
void api.sendGift({ playerId: prof.playerId, toId, kind, amount }).then((r) => {
if (!r.ok) { showToast(r.error ?? "没送出去，稍后再试。"); return; }
if (gm.cost) mutate((x) => { x.money -= gm.cost; x.mood += 3; });
updMeta((m) => { m.giftsSent += 1; bump(m, "social"); });
showToast(kind === "share" ? `💴 ${toName}的分成 ¥${amount ?? 0} 已记上，对方下次上线进钱包。` : `${gm.emoji} 给${toName}送了${gm.name}${gm.cost ? `，-¥${gm.cost}` : ""}。对方下次上线就能收到。`);
}).catch(() => showToast("网络不太好，礼物没送出去。"));
};

/* ---------- actions ---------- */
const doAction = (kind: string, arg = 0) => {
const s0 = gsRef.current;
if (!s0 || walking || currentLoc!== selectedLoc || activeEvent) return;
const tBlock = timeBlock(kind, s0);
if (tBlock) { showToast(`⏰ ${tBlock}。`); return; }
const loc = locById(selectedLoc);
const vClosed = kind === "rest" ? null : venueClosed(loc);
if (vClosed) { showToast(`🔒 ${loc.short}${vClosed}。`); return; }
const base = basePay(s0);
const fitSave = s0.fit >= 3? 3: 0;
const co0 = companyAt(s0.cityKey, loc.id);
const ev = evRef.current;
const co = co0 ? effCompany(co0, ev, s0.referrals) : null;
const colleagues = co ? (world?.online ?? []).filter((p) => p.id !== myPubRef.current && p.employer === co.id && p.cityKey === s0.cityKey) : [];
let msg = "";
const feeds: { kind: "career" | "apec" | "home" | "money" | "life"; text: string }[] = [];
let spent = 0;
mutate((s) => {
const snap = JSON.stringify([s.money, s.energy, s.mood, s.xp, s.skill, s.groceries, s.offers, s.employer, s.fit, s.invest, s.network, s.outfit, s.album, s.apecTasks, s.apecCheckins, s.visitedScenic]);
switch (kind) {
case "rest":
s.energy += 14 + (s.outfit === "pajamas" ? 6 : 0); s.mood += 8;
msg = `歇了一会儿，能量 +${14 + (s.outfit === "pajamas" ? 6 : 0)}，心情 +8${s.outfit === "pajamas" ? "（穿睡衣躺平更舒服）" : ""}。`;
break;
case "work": {
const cost = (co?.energy ?? 28) - fitSave;
let wage = Math.round(base * (co?.payMul ?? 1) * (ev.payMul ?? 1));
const formalXp = s.outfit === "formal" ? 1 : 0;
const buddy = colleagues.length > 0 ? 3 : 0;
s.hunger = clamp100(s.hunger - 8); s.clean = clamp100(s.clean - 4); s.social = clamp100(s.social - 2); s.fun = clamp100(s.fun - 4); s.bladder = clamp100(s.bladder - 8);
let hungryNote = "";
if (s.hunger < 28) { wage = Math.round(wage * 0.85); s.mood -= 3; hungryNote = "，空着肚子干活，工钱打了八五折"; }
s.money += wage; s.earned += wage; s.energy -= cost; s.xp += 2 + formalXp; s.workCount += 1; s.mood += (co?.mood ?? 0) + buddy;
msg = `${co ? `在${co.short}` : ""}上班一天，工资 +${fmt(wage)}${ev.payMul ? "（今天发奖金 ×1.3）" : ""}，经验 +${2 + formalXp}${formalXp ? "（正装加成 +1）" : ""}${co?.mood ? `，心情 ${co.mood > 0 ? "+" : ""}${co.mood}` : ""}${buddy ? `，和同事${colleagues.map((p) => p.name).slice(0, 2).join("、")}一起上班心情 +3` : ""}${hungryNote}。`;
break;
}
case "overtime": {
const cost = (co ? co.energy + 14 : 42) - fitSave;
let pay = Math.round(base * (co?.payMul ?? 1) * 1.75 * (co?.otMul ?? 1) * (ev.payMul ?? 1));
s.hunger = clamp100(s.hunger - 10); s.clean = clamp100(s.clean - 6); s.fun = clamp100(s.fun - 6); s.bladder = clamp100(s.bladder - 10);
if (s.hunger < 28) pay = Math.round(pay * 0.85);
s.money += pay; s.earned += pay; s.energy -= cost; s.mood -= 12; s.xp += 3; s.otCount += 1;
msg = `${co ? `在${co.short}` : ""}加班到深夜，+${fmt(pay)}，经验 +3，心情 -12。`;
break;
}
/* ---- 大厂：面试 → offer → 跳槽 ---- */
case "interview": {
if (!co) break;
const key = `${s.day}:${co.id}`;
if ((s.interviews ?? []).includes(key)) break;
s.interviews = [...(s.interviews ?? []).slice(-60), key];
s.energy -= 12;
const gaps = companyGaps(co, s);
if ((s.record ?? 0) >= 2 || ((s.record ?? 0) >= 1 && co.formal)) {
s.mood -= 6; s.xp += 1;
msg = `${co.short}做了背景调查，发现你有违法记录，没有通过。好好过日子，案底会跟着你一整局。`;
} else if (co.formal && s.outfit !== "formal") {
s.mood -= 4; s.xp += 1;
msg = `${co.short}的面试官上下打量了你一眼：「我们这儿面试要穿正装。」这次没过。去商场买身正装再来，经验 +1。`;
} else if (gaps.length > 0) {
s.mood -= 3; s.xp += 1;
msg = `${co.short}面试没过，还差：${gaps.join("、")}。面试官说「再沉淀沉淀」。多上班攒经验、去图书馆学技能，明天还能再来，经验 +1。`;
} else {
s.offers = [...new Set([...(s.offers ?? []), co.id])];
s.mood += 10;
msg = `🎉 ${co.short}面试通过，拿到 offer！日薪约 ${fmt(Math.round(base * co.payMul))}，点「接受 offer」就能入职。`;
feeds.push({ kind: "career", text: `拿到了${co.short}的 offer` });
}
break;
}
case "join-company": {
if (!co || !(s.offers ?? []).includes(co.id)) break;
const from = companyById(s.employer);
s.employer = co.id;
s.offers = (s.offers ?? []).filter((x) => x !== co.id);
s.mood += 8;
s.npcNews = [...(s.npcNews ?? []), { kind: "career" as const, text: `跳槽去了${co.short}`, day: s.day }];
msg = `🤝 从${from.short}跳槽到${co.short}！以后来这里上班，日薪 ×${co.payMul}。${co.culture}`;
feeds.push({ kind: "career", text: `从${from.short}跳槽到${co.short}` });
break;
}
case "canteen":
s.money -= 12; s.energy += 22; s.mood += 4; s.mealCount += 1; s.hunger = clamp100(s.hunger + 34);
msg = `在${co?.short ?? "公司"}食堂刷工卡吃了一顿，¥12 吃到饱，能量 +22。`;
break;
case "campus-tour":
s.energy -= 3; s.mood += 6;
if (co && ev.openDay === co.id) s.xp += 1;
msg = `在${loc.short}园区里逛了一圈：咖啡厅、工牌、步履匆匆的打工人。心情 +6${co && ev.openDay === co.id ? "，开放日听了场分享，经验 +1" : ""}。`;
break;
case "gig": {
let mul = 0.9 + Math.random() * 0.4;
if (loc.id === "hotel" && isApecWeek(s.day)) mul *= 1.3;
const pay = Math.round(base * 0.55 * mul);
s.money += pay; s.earned += pay; s.energy -= 18; s.xp += 1;
msg = `${loc.gigName?? CITIES[s.cityKey].gigName}接了几单，+${fmt(pay)}，经验 +1。`;
break;
}
case "eat": {
const f = FOODS[s.cityKey][arg];
if (!f) break;
const fc = Math.round(f.cost * (ev.eatMul ?? 1) * policyRef.current.eat);
const fm = f.mood + (ev.eatMood ?? 0);
s.money -= fc; s.energy += f.energy; s.mood += fm; s.mealCount += 1; s.hunger = clamp100(s.hunger + 40); s.fun = clamp100(s.fun + 6);
msg = `${f.name}下肚，能量 +${f.energy}，心情 +${fm}${ev.eatMul ? `（美食节价 ¥${fc}）` : ""}。`;
break;
}
/* round-2 (b S4d): per-subtype venue actions */
case "seafood-feast": {
  s.money -= 80; s.mood += 15; s.energy += 20; s.mealCount += 1; s.hunger = clamp100(s.hunger + 40); s.fun = clamp100(s.fun + 6);
  msg = "现捞现做的海鲜大餐下肚，能量 +20，心情 +15。";
  break;
}
case "snack-eat": {
  s.money -= 25; s.mood += 8; s.energy += 10; s.mealCount += 1; s.hunger = clamp100(s.hunger + 20); s.fun = clamp100(s.fun + 4);
  msg = "老街小吃吃到饱，能量 +10，心情 +8。";
  break;
}
case "wash":
if (evRef.current.noWater) { msg = `🚱 今天${evRef.current.name}，水龙头拧开只有嘶嘶声。下楼买瓶水凑合吧。`; break; }
s.energy += 6; s.mood += 6; s.clean = clamp100(s.clean + 46);
msg = "洗漱整理了一番，神清气爽，能量 +6，心情 +6。";
break;
case "cook": {
if (evRef.current.noWater) { msg = `🚱 今天${evRef.current.name}，做不了饭——出去吃，或者叫个外卖。`; break; }
if (s.groceries <= 0) { msg = "冰箱空了，先去买菜（夜市/市场/商场都有买菜）再回来做饭。"; break; }
s.groceries -= 1; s.energy += 34; s.mood += 9; s.mealCount += 1; s.hunger = clamp100(s.hunger + 48);
msg = "自己做了一顿饭：洗菜、切菜、下锅，热气腾腾端上桌。能量 +34，心情 +9。";
break;
}
case "buy-groceries": {
if (s.money < 28) { msg = `买菜要 ${fmt(28)}，钱包不够。`; break; }
s.money -= 28; s.groceries += 1;
msg = `买了一篮子菜（青菜、鸡蛋、肉），食材 +1，现在有 ${s.groceries} 份，回家就能做饭。`;
break;
}
case "stroll":
s.energy -= 4; s.mood += 12;
msg = "慢慢散了会儿步，风很舒服，心情 +12。";
break;
case "fun": {
if (ev.beachClosed && isBeachLoc(loc)) { msg = "🌀 台风预警，海边今天封闭了，改天再来。"; break; }
const cost = loc.funCost?? CITIES[s.cityKey].funCost;
const mood = (loc.funMood?? CITIES[s.cityKey].moodFun) + (ev.funMood ?? 0);
s.money -= cost; s.mood += mood; s.fun = clamp100(s.fun + Math.max(12, mood));
msg = `${loc.funName?? CITIES[s.cityKey].funName}，心情 +${mood}。`;
break;
}
case "learn-course":
s.money -= 30; s.energy -= 15; s.skill += 1; s.xp += 1;
msg = "夜校一节课上完，技能 +1，经验 +1。";
break;
case "learn-self":
s.energy -= 10; s.skill += 1; s.mood += 2;
msg = "自习两小时，技能 +1。";
break;
case "apec-staff": {
const mul = apecVenueMul(s.day, loc.id);
const pay = Math.round(base * 0.9 * mul);
s.money += pay; s.earned += pay; s.energy -= 22; s.xp += 2;
if (isApecWeek(s.day)) {
s.apecCount += 1;
if (s.apecCount === 3) s.npcNews = [...(s.npcNews ?? []), { kind: "apec" as const, text: "在 峰会会场服务满 3 场了", day: s.day }];
if (mul >= 1.5) feeds.push({ kind: "apec", text: `在${loc.short}做了一场会务服务，+${fmt(pay)}` });
}
msg = `会务服务一场，+${fmt(pay)}${mul > 1? `（峰会 ×${mul}）`: ""}，经验 +2。`;
break;
}
case "apec-host": {
const mul = apecVenueMul(s.day, loc.id);
const pay = Math.round(base * 1.25 * mul);
s.money += pay; s.earned += pay; s.energy -= 20; s.xp += 3; s.network += 1;
if (isApecWeek(s.day)) {
s.apecCount += 1;
if (s.apecCount === 3) s.npcNews = [...(s.npcNews ?? []), { kind: "apec" as const, text: "在 峰会会场服务满 3 场了", day: s.day }];
if (mul >= 1.5) feeds.push({ kind: "apec", text: `在${loc.short}接待了外宾团，+${fmt(pay)}，人脉 +1` });
}
msg = `外宾接待一场，+${fmt(pay)}${mul > 1? `（峰会 ×${mul}）`: ""}，经验 +3，人脉 +1。`;
break;
}
case "apec-visit": {
s.money -= 20; s.mood += 10;
if (Math.random() < 0.3) { s.network += 1; msg = "逛了一圈会场，认识了位同行，人脉 +1，心情 +10。";}
else msg = "在会场逛了逛，集了几个章，心情 +10。";
break;
}
case "apec-checkin": {
if ((s.apecCheckins ?? []).includes(loc.id)) { s.mood += 3; msg = `📸 ${loc.name}已经打过卡了，再看看会场，心情 +3。`; }
else {
s.apecCheckins = [...(s.apecCheckins ?? []), loc.id];
s.mood += 6;
const n = (s.apecCheckins ?? []).length;
msg = `📸 在${loc.name}打卡成功！峰会会场已打卡 ${n} / 3，心情 +6。${apecTaskOfDay(s.day)?.venueLocId === loc.id ? "今天的岗位任务就在这里，先打卡再上岗。" : ""}`;
feeds.push({ kind: "apec", text: `在${loc.short}完成了 峰会会场打卡（${n}/3）` });
}
break;
}
case "apec-task": {
const task = apecTaskOfDay(s.day);
if (!task || task.venueLocId !== loc.id) { msg = "今天这里没有峰会周的岗位任务——看看 峰会活动卡，今天的班在另一个会场。"; break; }
if ((s.apecTasks ?? []).includes(task.id)) { msg = `今天的任务「${task.title}」已经完成了，明天还有新的一班。`; break; }
if (!(s.apecCheckins ?? []).includes(loc.id)) { msg = "先在会场打卡再上岗——点上方的「会场打卡」，这也是认会场、认深圳的一部分。"; break; }
if (s.energy < task.energy) { msg = `这个岗位要站一整班，能量至少 ${task.energy}，先去吃点东西或者歇一会儿。`; break; }
const pay = Math.round(base * task.payMul);
s.money += pay; s.earned += pay; s.energy -= task.energy; s.xp += task.xp; s.network += task.network;
s.apecCount += 1;
s.apecTasks = [...(s.apecTasks ?? []), task.id];
const doneN = (s.apecTasks ?? []).length;
if (s.apecCount === 3) s.npcNews = [...(s.npcNews ?? []), { kind: "apec" as const, text: "在 峰会会场服务满 3 场了", day: s.day }];
feeds.push({ kind: "apec", text: `以${task.role}身份完成了 峰会任务「${task.title}」（${doneN}/${APEC_TASKS.length}），+${fmt(pay)}` });
if (doneN >= APEC_TASKS.length) {
s.npcNews = [...(s.npcNews ?? []), { kind: "apec" as const, text: "拿到了湾区峰会服务证书，六天任务全做完", day: s.day }];
msg = `🏅 「${task.title}」完成，+${fmt(pay)}，经验 +${task.xp}，人脉 +${task.network}。六天的峰会周任务全部完成——${APEC_CERT_NAME}已经记在你的名下，结算时见！`;
} else {
msg = `✅ 峰会任务「${task.title}」完成（${task.roleEmoji} ${task.role}），+${fmt(pay)}，经验 +${task.xp}，人脉 +${task.network}。进度 ${doneN} / ${APEC_TASKS.length}，明天继续。`;
}
break;
}
case "mall-shop": {
const c = Math.round(120 * (ev.mallMul ?? 1));
s.money -= c; s.mood += 14;
msg = `逛了圈商场买了点小东西${ev.mallMul ? `（大促只花了 ¥${c}）` : ""}，心情 +14。`;
break;
}
case "mall-cloth": {
const c = Math.round(300 * (ev.mallMul ?? 1));
s.money -= c; s.mood += 20; s.network += 1;
msg = `换了身新行头${ev.mallMul ? `（大促只花了 ¥${c}）` : ""}，人精神了，心情 +20。`;
break;
}
case "mall-promo": {
const pay = Math.round(base * 0.5);
s.money += pay; s.earned += pay; s.energy -= 16; s.xp += 1;
msg = `促销兼职半天，+${fmt(pay)}，经验 +1。`;
break;
}
case "health-check":
s.money -= 150; s.energy += 8; s.mood += 6; s.fit += 1;
msg = "体检报告一切正常，体质 +1，心里踏实了。";
break;
case "health-cure":
s.money -= 80; s.energy += 18; s.mood += 3;
msg = "调理完神清气爽，能量 +18。";
break;
case "gym":
s.money -= 30; s.energy -= 10; s.mood += 10 + (s.outfit === "sport" ? 4 : 0); s.fit += 1;
msg = `认真练了一次，体质 +1（已练 ${s.fit} 次）。`;
break;
case "bank-buy":
s.money -= 1000; s.invest += 1000;
msg = `买入理财 ${fmt(1000)}，每晚结算收益。`;
break;
case "bank-sell": {
const amt = s.invest;
s.money += amt; s.invest = 0;
msg = `取出全部理财，+${fmt(amt)} 回到存款。`;
break;
}
case "social-ktv":
s.money -= 88; s.mood += 18; s.network += 1; s.social = clamp100(s.social + 24);
msg = "唱K吼了两嗓子，心情 +18，人脉 +1。";
break;
case "social-drink":
s.money -= 45; s.mood += 10; s.energy += 4; s.social = clamp100(s.social + 16);
msg = "小酌一杯，聊了聊最近的行情，心情 +10。";
break;
case "market-phone": {
s.money -= 400;
if (Math.random() < 0.5) {
s.money += 650; s.earned += 250; s.mood += 5;
msg = `眼光不错！二手手机转手 +${fmt(650)}，净赚 ${fmt(250)}。`;
} else {
s.mood -= 4;
msg = `踩坑了，手机只值自用。-${fmt(400)}，心情 -4。`;
}
break;
}
case "market-fix": {
const pay = Math.round(base * 0.6);
s.money += pay; s.earned += pay; s.energy -= 20; s.xp += 1;
msg = `帮摊主装机维修，+${fmt(pay)}，经验 +1。`;
break;
}
case "checkin": {
const key = `${s.cityKey}:${loc.id}`;
if ((s.visitedScenic ?? []).includes(key)) { msg = "这里已经打过卡了，再静静看一会儿风景。"; s.mood += 3; }
else { s.visitedScenic = [...(s.visitedScenic ?? []), key]; s.mood += 12; msg = `📸 在${loc.name}打卡成功！心情 +12，已打卡 ${(s.visitedScenic ?? []).length} 处风景。`; feeds.push({ kind: "life", text: `在${loc.name}打卡，集齐风景 ${(s.visitedScenic ?? []).length} 处` }); }
break;
}
case "hk-trip":
s.money -= 180; s.mood += 22; s.energy -= 16; s.network += 1;
msg = "过关去香港玩了一天：逛旺角、坐天星小轮、吃茶餐厅，心情 +22，人脉 +1。";
break;
case "ferry":
s.money -= 60; s.mood += 18; s.energy -= 6;
msg = "从蛇口坐轮渡出海，甲板上吹海风看港珠澳大桥，心情 +18。";
playFerryHorn();
break;
case "flight":
s.money -= 420; s.mood += 26; s.energy -= 14;
msg = "坐飞机出门远行一天，落地看陌生城市的灯，心情 +26。回来继续好好过日子。";
break;
case "buy-medicine":
s.money -= 35; s.energy += 10; s.mood += 2;
msg = "在药店买了常备药，药师顺便叮嘱了用法。能量 +10。";
break;
case "ask-help":
s.mood += 3;
msg = loc.placeKind === "police" ? "民警耐心给你指了路，还提醒有急事直接打 110。心情 +3。" : "药师说小问题不用跑医院，真不舒服就去最近的急诊。心情 +3。";
break;
case "tourist-map":
s.mood += 4;
msg = "领了一份中英文地图：地铁线网、景点、医院和 120/110 应急电话都在上面。心情 +4。";
break;
case "volunteer":
s.energy -= 10; s.network += 1; s.xp += 1; if (isApecWeek(s.day)) s.mood += 8;
msg = `当了一会儿志愿者，帮${isApecWeek(s.day) ? "外宾" : "游客"}指路找地铁站，人脉 +1、经验 +1${isApecWeek(s.day) ? "、心情 +8" : ""}。`;
break;
case "hike":
s.energy -= 16; s.mood += 20; s.fit += 1;
msg = `登山徒步一趟，体质 +1（已练 ${s.fit} 次），心情 +20。`;
break;
default:
break;
}
/* 一天的时间预算：真正做成了的行动才走表 */
if (msg && JSON.stringify([s.money, s.energy, s.mood, s.xp, s.skill, s.groceries, s.offers, s.employer, s.fit, s.invest, s.network, s.outfit, s.album, s.apecTasks, s.apecCheckins, s.visitedScenic]) !== snap) {
spent = actionMinutes(kind);
s.busyUntil = Date.now() + cooldownMs(spent, (s.perks ?? []).includes("route"));
s.busyWhat = ({ work: "上班", overtime: "加班", gig: "接活", "apec-staff": "峰会上岗", "apec-task": "做峰会任务", "learn-course": "上课", "learn-self": "自习", gym: "健身", hike: "爬山", "hk-trip": "去香港", interview: "面试", cook: "做饭", eat: "吃饭", rest: "歇着", fun: "玩" } as Record<string, string>)[kind] ?? "忙";
s.lastActiveDay = s.day;
if (kind === "rest") { s.restN = s.restDay === s.day ? (s.restN ?? 0) + 1 : 1; s.restDay = s.day; }
if (kind === "work") s.workDay = s.day;
if (kind === "overtime") s.otDay = s.day;
}
});
if (msg && spent) {
track(`act:${kind}`);
window.setTimeout(() => floatReward(`⏳ ${realMinLabel(spent, (s0.perks ?? []).includes("route"))}`, "blue"), 250);
}
if (msg) {
showToast(msg);
addLog(msg);
}
for (const f of feeds) postFeed(f.kind, f.text);
/* 奖励飘字：把这一步的钱 / 经验 / 心情变化飘在地图上（手游式反馈） */
{
const after = gsRef.current;
if (after && msg) {
const dMoney = Math.round(after.money - s0.money);
const dXp = after.xp - s0.xp;
const dMood = Math.round(after.mood - s0.mood);
if (dMoney > 0) floatReward(`+${fmt(dMoney)}`, "gold");
else if (dMoney < 0) floatReward(`-${fmt(-dMoney)}`, "red");
if (dXp > 0) floatReward(`经验 +${dXp}`, "blue");
if (dMood >= 6) floatReward(`心情 +${dMood}`, "green");
}
}
/* 弹幕刷屏时刻：打卡成功 / 峰会打卡与上岗，街坊们发弹幕庆祝 */
if (msg && kind === "checkin" && !msg.includes("已经打过卡")) {
const spot = scenicOf(s0.cityKey, selectedLoc);
burstDanmaku([`📸 ${profileRef.current?.name ?? "你"} 在${spot?.name ?? loc.short}打卡成功！`, "阿琳：这张拍得真好 👍", "大芬姐：风景册又多一页啦", "子健：我也要去打卡 📍", "Lisa：Great shot! 🌟"]);
}
if (msg && kind === "work") updMeta((m) => bump(m, "work"));
if (msg && kind === "interview") updMeta((m) => bump(m, "interviews"));
if (msg && kind === "join-company" && co) updMeta((m) => { if (!m.companies.includes(co.id)) m.companies = [...m.companies, co.id]; });
if (msg && kind === "join-company" && co) {
setLevelFx({ name: `入职${co.short}`, nonce: Date.now() });
window.setTimeout(() => setLevelFx(null), 2600);
burstDanmaku([`🤝 ${profileRef.current?.name ?? "你"}跳槽去${co.short}啦！`, "阿琳：大厂见！别忘了老同事 🥲", "老周：深圳打工人的高光时刻", "小美：请客请客 🍻", "子健：内推我一个呗"]);
}
if (msg && kind === "apec-checkin") {
burstDanmaku([`🌐 峰会会场打卡 +1！`, "Lisa：三个会场集齐有徽章哦", "老周：峰会周，深圳准备好了", "小美：志愿者辛苦啦 🎽"]);
}
if (msg && kind === "apec-task") {
burstDanmaku([`🎉 峰会今日任务完成！`, "Lisa：干得漂亮，这就是深圳服务 🌐", "阿强：给 峰会打工的人点赞", "陈伯：盛会办得好，街坊脸上有光", "王姨：辛苦啦，回来喝碗糖水"]);
}
const animMap: Partial<Record<string, LifeKind>> = { work: "code", overtime: "overtime", eat: "eat", canteen: "eat", interview: "code", "campus-tour": "stroll", gym: "gym", wash: "wash", cook: "cook", "buy-groceries": "groceries", stroll: "stroll", "social-ktv": "gathering", "social-drink": "gathering", "mall-shop": "shopping", "mall-cloth": "shopping", fun: "stroll", "seafood-feast": "eat", "snack-eat": "eat" };
// signature rides and sights get their own scene instead of a plain stroll
// Round-2 (b): the signature animation is a table lookup by place id
// (round2/venues.ts), not name regex. The new anim kinds (tram, temple,
// oldtown, miniature, nature, farm, wetland, watershow, cycle, gallery)
// are not LifeKinds yet — they fall back to the nearest existing scene
// (stroll, beach for the wetland) until area (g) adds dedicated scenes.
const ANIM_TO_LIFE: Partial<Record<string, LifeKind>> = { tram: "stroll", temple: "stroll", oldtown: "stroll", miniature: "stroll", nature: "stroll", farm: "stroll", wetland: "beach", watershow: "stroll", cycle: "stroll", gallery: "stroll" };
const animRaw = animFor(loc, kind);
const special: LifeKind | undefined = animRaw ? (ANIM_TO_LIFE[animRaw] ?? (animRaw as LifeKind)) : undefined;
const ak = special ?? animMap[kind];
if (kind === "social-ktv") setSinging(true);
if (ak && msg && !(kind === "cook" && s0.groceries <= 0) && !(kind === "buy-groceries" && s0.money < 28)) playLifeAnim(ak);
};

/* ---------- sleep / day rollover ---------- */
/* ---------- 真实时间：睡觉不再跳天，日子跟着北京时间走 ---------- */
const doSleep = () => {
const s0 = gsRef.current;
if (!s0 || s0.finished) return;
const tb = timeBlock("__sleep", s0);
if (tb) { showToast(`⏰ ${tb}。`); return; }
const first = s0.sleptDay !== s0.day;
const night = inWindow(nowMin(), [20 * 60, 34 * 60]);
mutate((s) => {
if (first) { s.energy = 100; s.sleptDay = s.day; s.mood += homeMoodBonus(s) + (night ? 4 : 0); s.clean = clamp100(s.clean + 28); s.hunger = clamp100(s.hunger - 16); s.bladder = clamp100(s.bladder + 40); s.fun = clamp100(s.fun + 8); }
else s.energy = Math.min(100, s.energy + 20);
s.busyUntil = Date.now() + cooldownMs(first ? actionMinutes("sleep") : 40); s.busyWhat = "睡觉";
s.lastActiveDay = s.day;
});
showToast(first ? `😴 美美睡了一觉，能量回满${night ? "，按时睡觉心情 +4" : ""}。睡醒会饿一点。日子跟着北京时间走，睡觉不会跳到明天。` : "😴 又眯了一会儿，能量 +20（今天已经睡过整觉了）。");
};
const eatBowl = () => {
  const s0 = gsRef.current; if (!s0) return;
  if (s0.money < 25) { showToast(en ? "A bowl of noodles is ¥25." : "一碗面 ¥25，钱包不够。"); return; }
  mutate((s) => { s.money -= 25; s.hunger = clamp100(s.hunger + 36); s.fun = clamp100(s.fun + 6); s.energy = Math.min(100, s.energy + 8); s.mood = Math.min(100, s.mood + 2); s.mealCount += 1; });
  showToast(en ? "A bowl of noodles. Less hungry." : "吃了碗面，不那么饿了。");
};
const washHome = () => {
  if (!home3d && !homeGuest && currentLocRef.current !== "home") { showToast(en ? "Go home to wash." : "回家才能洗澡。点地图上的家，走到了再洗。"); return; }
  if (evRef.current.noWater) { showToast(en ? "No water today." : `今天停水，洗不了。`); return; }
  mutate((s) => { s.energy = Math.min(100, s.energy + 6); s.mood = Math.min(100, s.mood + 6); s.clean = clamp100(s.clean + 46); s.bladder = 100; });
  showToast(en ? "Washed up." : "洗了个澡，干净了。");
};
const seeSomeone = () => {
  const s0 = gsRef.current; if (!s0) return;
  const loc = locById(currentLocRef.current);
  const lively = ["food", "mall", "work", "fun", "market", "gym", "transit", "scenic", "home", "lodging"].includes(loc.type);
  if (!lively) { showToast(en ? "Go where people are — a mall, a food street, the office — then try again." : "去人多的地方再说：夜市、商场、公司，或者回家。"); return; }
  const cast = npcsForCity(s0.cityKey);
  const who = (s0.spouse && loc.type === "home" ? s0.spouse : null) ?? cast.find((n) => npcAllowedAt(n, loc))?.name ?? cast[0]?.name ?? "街坊";
  mutate((s) => {
    s.social = clamp100(s.social + 22); s.mood = Math.min(100, s.mood + 4);
    const m = { ...memOf(s.npcMem ?? {}, who) }; m.rel = Math.max(-100, Math.min(100, m.rel + 2)); m.lastDay = s.day; s.npcMem = { ...(s.npcMem ?? {}), [who]: m };
  });
  showToast(en ? `You talked with ${who}.` : `和${who}说了会儿话，心里松一点。`);
};
const askOut = (name: string) => {
  const s0 = gsRef.current; if (!s0) return;
  if (s0.spouse && s0.spouse !== name) { showToast(en ? "You already registered with someone." : `你已经和${s0.spouse}领过证了。`); return; }
  if (s0.money < 60) { showToast(en ? "A date is ¥60." : "约会一顿要 ¥60，钱包不够。"); return; }
  mutate((s) => {
    s.money -= 60;
    const pts = (s.romance?.[name] ?? 0) + 14;
    s.romance = { ...(s.romance ?? {}), [name]: pts };
    s.social = clamp100(s.social + 18); s.fun = clamp100(s.fun + 14); s.mood = Math.min(100, s.mood + 6);
    const m = { ...memOf(s.npcMem ?? {}, name) }; m.rel = Math.max(-100, Math.min(100, m.rel + 6)); m.lastDay = s.day; s.npcMem = { ...(s.npcMem ?? {}), [name]: m };
  });
  const stage = ROMANCE_STAGES[romanceStage((gsRef.current?.romance?.[name] ?? 0))]?.name[en ? 1 : 0] ?? "";
  showToast(en ? `Date with ${name}. ${stage}` : `和${name}吃了一顿，现在是「${stage}」。再到「恋人」就能领证。`);
};
const spotsOf = (layout: { id: string; slot: number }[]) => layout.flatMap((p) => { const f = furnById(p.id); return f && p.slot >= 0 && p.slot <= 6 ? [{ id: p.id, slot: p.slot, color: f.color }] : []; });
const publishHome = () => {
  const s0 = gsRef.current; const prof = profileRef.current;
  if (!s0 || !prof) return;
  void api.publishHome({ playerId: prof.playerId, tier: tierAt(s0), style: s0.homeStyle, layout: placedFurn(s0).map((p) => ({ id: p.id, slot: p.slot })) }).catch(() => {});
};
const openVisit = (name: string) => {
  mutate((s) => { s.social = clamp100(s.social + 12); s.mood = Math.min(100, s.mood + 4); });
  const npc = npcHome(name);
  setVisitHome(npc ? { tier: npc.tier, style: null, layout: spotsOf(npc.layout) } : null);
  setHomePose("idle");
  setHomeGuest(name); setLifeOpen(false); setHome3d(true);
  const pub = (world?.online ?? []).find((p) => p.name === name)?.id ?? bonds.find((b) => b.status === "active" && b.peerName === name)?.peerId;
  if (pub) void api.getHome({ pub }).then((r) => { if (r.home) setVisitHome({ tier: r.home.tier, style: r.home.style, layout: spotsOf(r.home.layout) }); }).catch(() => {});
  showToast(en ? `You walked into ${name}'s place.` : `走进${name}的家。人已经坐着了，你自己走过去。`);
};
const usePlacedFurn = (id: string) => {
  const u = furnUse(id);
  if (!u) { showToast(en ? "This piece is just for the room." : "这件是摆设，用不上。"); return; }
  if (!home3d && !homeGuest && currentLocRef.current !== "home") { showToast(en ? "You can use furniture once you're home." : "人要在家里才能用家具。先走回家。"); return; }
  if (u === "cook") {
    const s0 = gsRef.current; if (!s0) return;
    if (evRef.current.noWater) { showToast(en ? "No water today — can't cook." : `今天停水，做不了饭。`); return; }
    if (s0.groceries <= 0) { showToast(en ? "The fridge is empty. Buy groceries first." : "冰箱空了，先去夜市或市场买菜。"); return; }
    mutate((s) => { s.groceries -= 1; s.energy = Math.min(100, s.energy + 34); s.mood = Math.min(100, s.mood + 9); s.mealCount += 1; s.hunger = clamp100(s.hunger + 48); s.fun = clamp100(s.fun + 6); });
    showToast(en ? "You cooked a meal." : "用灶台做了一顿饭，不饿了。");
    return;
  }
  if (u === "wash") { washHome(); return; }
  if (u === "bed") { mutate((s) => { s.energy = Math.min(100, s.energy + 16); s.mood = Math.min(100, s.mood + 4); }); setHomePose("sleep"); showToast(en ? "You lay down for a bit." : "在床上躺了一会儿，精神回来一点。想睡整觉就点「睡一觉」。"); return; }
  mutate((s) => { s.mood = Math.min(100, s.mood + 6); s.social = clamp100(s.social + (homeGuest ? 8 : 0)); });
  setHomePose("sit");
  showToast(u === "watch" ? (en ? "You sat and watched for a while." : "坐下来看了一会儿。") : (en ? "You sat down." : "在沙发上坐了一会儿。"));
};

/* 北京时间过了零点：把错过的日子一天天过完（没上线的日子自动模拟上班、吃饭），周六照常交租 */
const advanceDays = (target: number) => {
const s0 = gsRef.current;
if (!s0 || s0.finished || target <= s0.day) return;
let rentMsg = "";
let broke = false;
let simDays = 0; let simPay = 0;
const next = mutate((s) => {
while (s.day < target) {
const d = s.day;
s.hunger = clamp100(s.hunger - 22); s.clean = clamp100(s.clean - 16); s.social = clamp100(s.social - 12); s.fun = clamp100(s.fun - 14); s.bladder = clamp100(s.bladder - 20);
if (s.lastActiveDay !== d) {
simDays += 1;
if (!/周六|周日/.test(weekday(d))) { const w = Math.round(basePay(s) * 0.6); s.money += w; s.earned += w; simPay += w; s.workCount += 1; }
s.money -= 40; s.mealCount += 2; s.hunger = clamp100(s.hunger + 40);
}
if (isSaturday(d)) {
{ const deal = rentDealRef.current;
if (deal.delayDays !== undefined && deal.delayDays > 0) {
rentDealRef.current = { ...deal, delayDays: deal.delayDays - 1 };
rentMsg += " 房东同意这周晚点交（之前谈好的）。";
} else {
let due = rentYouPay(s);
if (deal.dueMul !== undefined) due = Math.round(due * deal.dueMul);
const mate = s.roommate; const pol = s.rentPolicy ?? 1;
s.money -= due;
s.rentPaid += due;
rentMsg += ` 周六交租 -${fmt(due)}${mate ? `（和室友${mate}平摊）` : ""}${pol < 1 ? "（业委会减租 5%）" : ""}${deal.dueMul !== undefined ? "（之前谈好的折扣）" : ""}。`; } }
if (s.money < -500) broke = true;
}
if (s.invest > 0) {
if (Math.random() < 0.15) { const loss = Math.round(s.invest * 0.03); s.invest -= loss; rentMsg += ` 理财波动 -${fmt(loss)}。`; }
else { const gain = Math.max(1, Math.round(s.invest * 0.004)); s.invest += gain; }
}
if (s.shop) { const k = SHOP_KINDS.find((x) => x.id === s.shop!.kind) ?? SHOP_KINDS[0]!; const bad = Math.random() < 0.15; const p = bad ? -Math.round(k.base * 0.4) : Math.round(k.base * s.shop.lvl * (0.6 + Math.random() * 0.8)); s.shop = { ...s.shop, till: s.shop.till + p }; }
if (s.ownFlat) s.mood = Math.min(100, s.mood + 2);
s.day += 1;
}
if (s.hangover) { s.energy = Math.max(20, s.energy - 25); s.hangover = false; rentMsg += " 宿醉头疼，能量 -25。"; }
s.energy = Math.min(100, s.energy + 30);
if (s.mood <= 5) { s.mood = 25; rentMsg += " 心情见底，过了一夜缓过来一点。"; }
s.greeted = [];
});
if (!next) return;
if (simDays > 0) track("day_auto", { missed: simDays });
if (simDays > 0) rentMsg = `你没上线的 ${simDays} 天，日子照常过：模拟上班 +${fmt(simPay)}，吃饭 -${fmt(simDays * 40)}。` + rentMsg;
if (rentMsg) addLog(rentMsg.trim());
if (broke) {
finishSeason("debt");
return;
}
if (next.day > seasonLength(next.startKey ?? SEASON_START)) {
finishSeason("done");
return;
}
/* NPC simulation: overnight, the neighbours post and comment on a new wall —
   yesterday's player news (promotion, new home, Summit service) is what they
   talk about first. Moods drift with the new day. */
{
const gen = generateDailyPosts(
{ day: next.day, cityKey: next.cityKey, playerName: profileRef.current?.name ?? "我" },
next.npcNews ?? [],
next.npcMem ?? {},
);
mutate((s) => {
s.npcMem = gen.mems;
s.npcFeed = [...gen.posts, ...(s.npcFeed ?? [])].slice(0, 60);
s.npcNews = [];
});
/* 手游件：新一天的每日任务从今天的计数重新起算，昨天的领取记录清零 */
mutate((s) => {
s.dayBase = { day: s.day, work: s.workCount, meal: s.mealCount, scenic: (s.visitedScenic ?? []).length };
s.dayClaim = [];
});
gen.posts.slice(0, 2).forEach((p, i) => window.setTimeout(() => pushDanmakuRef.current(`${p.author}：${p.text}`), 600 + i * 900));
/* 街坊连续剧的钩子：谁今天有新的一章，早上就冒个弹幕提醒 */
{
const g2 = gsRef.current;
const ready = g2 ? STORIES.filter((st) => npcsForCity(g2.cityKey).some((n) => n.name === st.npc)).filter((st) => { const k = storyStatus(st, g2.story?.[st.npc], memOf(g2.npcMem ?? {}, st.npc).rel, g2.day).kind; return (k === "ready" && (g2.story?.[st.npc]?.ch ?? 0) > 0) || k === "ending"; }) : [];
ready.slice(0, 2).forEach((st, i) => window.setTimeout(() => pushDanmakuRef.current(en ? `📖 ${trText(st.npc)}'s story "${L(st.title)}" continues — go and talk to ${trText(st.npc)}` : `📖 ${st.npc}的故事「${st.title}」有后续了——去找${st.npc}聊聊`), 2600 + i * 1200));
}
}
showToast(`🌅 北京时间新的一天：第 ${next.day} 天 · ${weekday(next.day)}${rentMsg ? " " + rentMsg.trim() : ""}`);
const arcNow = pickArc(next);
if (arcNow) window.setTimeout(() => setArcCard({ id: arcNow }), 450);
else if (Math.random() < 0.55) {
const ev = pickEvent(next.day, next.cityKey, new Set(next.seenEvents));
if (ev) {
mutate((s) => { s.seenEvents = [...s.seenEvents, ev.title];});
window.setTimeout(() => setActiveEvent(ev), 450);
}
}
};

/* 真实时钟心跳：过了北京时间零点就推进日子；能量每 3 分钟自然恢复 1 点（早起的鸟 ×1.5）；冷却倒计时每秒刷新 */
const advanceRef = useRef(advanceDays); advanceRef.current = advanceDays;
const [, setClockTick] = useState(0);
const lastBeatKey = useRef(-1);
const primeSaid = useRef(-1);
const needNag = useRef("");
useEffect(() => {
if (phase !== "game") return;
const beat = () => {
const s = gsRef.current;
if (!s || s.finished) return;
const target = realGameDay(s.startKey ?? SEASON_START);
if (target > s.day) advanceRef.current(target);
const now = Date.now();
const step = (s.perks ?? []).includes("early") ? 120_000 : 180_000;
const last = s.regenAt ?? now;
const gained = Math.floor((now - last) / step);
if (gained > 0) {
mutate((x) => {
  x.energy = Math.min(100, x.energy + (x.energy < 100 ? gained : 0));
  x.hunger = clamp100(x.hunger - gained * 6);
  x.clean = clamp100(x.clean - gained * 3);
  x.social = clamp100(x.social - gained * 3);
  x.fun = clamp100(x.fun - gained * 4);
  x.bladder = clamp100(x.bladder - gained * 5);
  if (x.hunger < 18) x.mood = clamp(x.mood - gained, 0, 100);
  x.regenAt = last + gained * step;
});
const n = gsRef.current;
const nag = !n ? "" : n.hunger < 28 ? "h" : n.bladder < 28 ? "b" : n.clean < 28 ? "c" : n.fun < 28 ? "f" : n.social < 28 ? "s" : "";
if (nag && needNag.current !== nag) {
  needNag.current = nag;
  showToast(nag === "h" ? (en ? "You're hungry. Eat, or go home and cook." : "饿了。去吃饭，或者回家用灶台做饭。") : nag === "b" ? (en ? "Find a restroom — malls, restaurants and the office have one. Walk up to it." : "内急。商场、饭店、公司里有洗手间，走进去，走到那个点。") : nag === "c" ? (en ? "You need a wash. Home has a bathroom." : "该洗洗了。回家才能洗澡。") : nag === "f" ? (en ? "Go somewhere. A bar, the sea, or the Livehouse. Sitting still does not count." : "闷了。去酒吧、海边，或者 Livehouse。坐着不算玩。") : (en ? "It's been quiet. Go find someone." : "有点闷。去找个人说说话。"));
} else if (!nag) needNag.current = "";
}
/* 只在分钟变了或者正在冷却时才重绘，免得整个界面每秒刷新 */
if (isPrime() && primeSaid.current !== s.day) { primeSaid.current = s.day; pushDanmakuRef.current(en ? "🔥 8 pm prime time: most players are online now — gigs, parties and the Livehouse are busiest. Neighbours' gigs pay ×1.5 for an hour." : "🔥 晚 8 点黄金档：现在在线的人最多——零工、组局、Livehouse 最热闹，街坊零工一小时内工钱 ×1.5。"); }
const busy = !!s.busyUntil && now < s.busyUntil + 1000;
const key = busy ? Math.floor(now / 1000) : nowMin();
if (key !== lastBeatKey.current) { lastBeatKey.current = key; setClockTick((t) => t + 1); }
};
beat();
const t = window.setInterval(beat, 1000);
return () => window.clearInterval(t);
}, [phase]);

const finishSeason = (reason: "done" | "debt") => {
const s0 = gsRef.current;
if (!s0 || finishedSent.current) return;
finishedSent.current = true;
const r = computeResult(s0, reason);
setResult(r);
mutate((s) => { s.finished = true;});
const prof = profileRef.current;
if (prof) {
const storiesDone = Object.values(s0.story ?? {}).filter((p) => p.done).length;
const lp = runPoints({ reason, money: s0.money, goal: s0.goal, careerIdx: s0.careerIdx, bigCo: (s0.employer ?? "startup") !== "startup", stories: storiesDone, romance: Math.max(0, ...Object.values(s0.romance ?? {}).map(romanceStage)), buddies: s0.partyPlays ?? 0 });
setLegacyGain(lp);
track("run_finish", { reason, title: r.title.slice(0, 30), day: s0.day, pts: lp.pts });
updMeta((m) => { m.runs += 1; m.legacy = { ...m.legacy, pts: m.legacy.pts + lp.pts, total: m.legacy.total + lp.pts, history: [{ title: r.title, pts: lp.pts, day: dateKey() }, ...m.legacy.history].slice(0, 20) }; });
void api.finishSeason({
playerId: prof.playerId,
money: Math.round(s0.money),
careerIdx: s0.careerIdx,
apecCount: s0.apecCount,
resultTitle: r.title,
}).then(() => queryClient.invalidateQueries({ queryKey: ["world"]}));
}
setPhase("result");
};

const chooseEventChoice = (idx: number) => {
const ev = activeEvent;
const s0 = gsRef.current;
if (!ev ||!s0) return;
const choice = ev.choices[idx];
if (!choice) return;
const iden = idenOf(s0);
const fx = {
money: s0.money, energy: s0.energy, mood: s0.mood, earned: s0.earned,
xp: s0.xp, skill: s0.skill, network: s0.network,
pay: iden.pay, payMul: CITIES[s0.cityKey].payMul,
};
const text = locText(choice.apply(fx), s0.cityKey);
mutate((s) => {
s.money = fx.money; s.energy = fx.energy; s.mood = fx.mood; s.earned = fx.earned;
s.xp = fx.xp; s.skill = fx.skill; s.network = fx.network;
});
/* round-2 (d §5c): a report choice opens the composer with evidence prefilled. */
if (choice.report) {
  setReportDraft({
    kind: choice.report, city: s0.cityKey,
    targetId: choice.report === "landlord" ? `home:${s0.cityKey}` : (s0.employer ?? ""),
    targetName: choice.report === "landlord" ? "房东" : (s0.employer ?? ""),
    body: "",
    evidence: choice.report === "landlord" ? buildRentEvidence({ baseRent: s0.baseRent ?? s0.rent, rent: s0.rent, rentPaid: s0.rentPaid, noticeText: ev.desc }) : undefined,
  });
}
setActiveEvent(null);
showToast(text);
addLog(`${text}`);
};

  /* ---------- start / restart ---------- */
  const joinMut = useMutation({
    mutationFn: api.joinWorld,
    onSuccess: (data, vars) => {
      if (data.me) setMyPub(data.me);
      queryClient.setQueryData(["world", vars.cityKey], data);
    },
  });

  const startGame = (name: string, city: CityKey, idenId: string, originId?: string) => {
    const iden = IDENTITIES.find((i) => i.id === idenId) ?? IDENTITIES[0]!;
    const cityInfo = CITIES[city];
    let rent = Math.round((cityInfo.rentBase * iden.rentMul) / 10) * 10;
    if (city === "hz" && iden.id === "rich") rent = 1150;
    const prof: Profile = profile ?? { playerId: newPlayerId(), name };
    prof.name = name;
    const day1Wall = generateDailyPosts({ day: 1, cityKey: city, playerName: name }, [], {});
    const state: GameState = {
      cityKey: city, idenId: iden.id, day: 1,
      money: iden.money, energy: 88 + iden.energyBonus, mood: iden.mood,
      hunger: 82, clean: 86, social: 64, fun: 72, bladder: 88, hair: 0, accessory: 0, sanheDay: 0, life: defaultLifestyleState(), delivery: emptyDeliveryState(), kids: [], plots: [],
      rent, baseRent: rent,
      goal: iden.id === "rich" ? 30000 : iden.id === "flat" ? 5000 : cityInfo.goal,
      earned: 0, rentPaid: 0, workCount: 0, otCount: 0, mealCount: 0,
      maxMoney: iden.money, homeStyle: null, furniture: [], homeSpent: 0,
      xp: 0, skill: 0, careerIdx: 0, network: 0, fit: 0, invest: 0, apecCount: 0,
      apecTasks: [], apecCheckins: [],
      seenEvents: [], greeted: [], visitedScenic: [], album: [], tourIdx: 0, tourDone: false, metroRides: 0, outfit: "casual", ownedOutfits: ["casual", "pajamas"], groceries: 1,
      npcMem: day1Wall.mems, npcFeed: day1Wall.posts, npcNews: [],
      log: [{ day: 1, text: `来到${cityInfo.name}，住进${cityInfo.scene}。目标：30 天攒到 ${fmt(iden.id === "rich" ? 30000 : iden.id === "flat" ? 5000 : cityInfo.goal, city)}。` }],
      finished: false,
      signDay: 0, dayBase: { day: 1, work: 0, meal: 0, scenic: 0 }, dayClaim: [],
      employer: "startup", offers: [], interviews: [], referrals: [],
    };
    /* 深漂档案：本局带上的传承（最多 MAX_EQUIP 个） */
    const perks = metaRef.current.legacy.equipped.filter((id) => metaRef.current.legacy.owned.includes(id) && perkById(id)).slice(0, MAX_EQUIP);
    state.perks = perks;
    /* 真实时间：本局从今天的北京日期开始；11 月里开局就是第「今天几号」天，目标按剩下的天数折算 */
    state.startKey = seasonStartFor();
    setSeason(state.startKey);
    const sLen = seasonLength(state.startKey);
    state.day = Math.min(sLen, Math.max(1, realGameDay(state.startKey)));
    state.regenAt = Date.now();
    if (state.day > 1) { const left = sLen + 1 - state.day; state.goal = Math.max(1000, Math.round((state.goal * left) / 30 / 100) * 100); state.log = [{ day: state.day, text: `今天是北京时间 ${seasonMonth(state.startKey)} 月 ${state.day} 日，你从第 ${state.day} 天进城，目标按本月剩下的 ${left} 天折算成 ${fmt(state.goal)}。` }, ...state.log]; }
    if (perks.includes("cash")) { state.money += 800; state.maxMoney = state.money; }
    if (perks.includes("wardrobe")) state.ownedOutfits = [...new Set([...state.ownedOutfits, "formal", "raincoat"])];
    if (perks.includes("skill")) state.skill += 2;
    if (perks.includes("xp")) state.xp += 6;
    if (perks.includes("rent")) { state.rent = Math.round((state.rent * 0.9) / 10) * 10; state.baseRent = state.rent; }
    if (perks.includes("friends")) state.npcMem = Object.fromEntries(NPCS.map((n) => { const m0 = memOf(state.npcMem, n.name); return [n.name, { ...m0, rel: Math.max(15, m0.rel), talks: Math.max(1, m0.talks) }]; }));
    if (perks.length) state.log = [{ day: 1, text: `深漂档案传承：${perks.map((id) => perkById(id)!.name).join("、")}。` }, ...state.log];
    { const og = originById(originId); state.origin = og?.id; state.startTier = og?.tier ?? tierOfIden(iden.id);
      if (og) state.log = [{ day: state.day, text: `抽签投胎：${og.zh}。${og.line}从「${TIERS[city][og.tier]!.zh}」出发，30 天能爬到哪一层？` }, ...state.log]; }
    // Came in through a friend's invite link: welcome bonus + an intro
    // (内推) to the friend's company.
    if (invite && invite.fromId !== myPubRef.current) {
      if (invite.co && COMPANIES.some((c) => c.id === invite.co && c.id !== "startup")) state.referrals = [invite.co];
      state.log = [{ day: 1, text: `${invite.from}邀请你来${cityInfo.name}${state.referrals?.length ? `，还帮你内推了${companyById(invite.co ?? undefined).short}` : ""}。` }, ...state.log];
    }
    finishedSent.current = false;
    justStartedRef.current = true;
    profileRef.current = prof;
    setProfile(prof);
    setAnalyticsPlayer(prof.playerId);
    track("run_start", { city, iden: iden.id, perks: perks.length, day: state.day, origin: originId ?? "picked" });
    setCurrentLoc("home");
    setSelectedLoc("home");
    gsRef.current = state;
    setGs(state);
    saveLocal(prof, state);
    setResult(null);
    setPhase("game");
    const invitedBy = invite && invite.fromId !== myPubRef.current ? invite.fromId : undefined;
    joinMut.mutate({ playerId: prof.playerId, name, emoji: iden.emoji, color: iden.color, cityKey: city, device: deviceId() || undefined, ...(invitedBy ? { invitedBy } : {}) }, {
      onSuccess: () => {
        /* 见面礼由服务器发：每个账号、每台设备只发一次 */
        if (invitedBy) void api.claimReward({ playerId: prof.playerId, kind: "welcome", device: deviceId() || undefined }).then((r) => {
          if (r.ok) { mutate((x) => { x.money += r.money; }); floatReward(`+${fmt(r.money)} 见面礼`, "gold"); addLog(`收到邀请见面礼 ${fmt(r.money)}。`); }
          else if (r.error) showToast(r.error);
        }).catch(() => {});
        clearInviteParams();
      },
    });
  };

  const restart = () => {
    saveLocal(null, null);
    gsRef.current = null;
    setGs(null);
    setResult(null);
    finishedSent.current = false;
    setPhase("setup");
  };

  /* ---------- phone app actions ---------- */
  const promote = () => {
    const s0 = gsRef.current;
    if (!s0) return;
    const next = CAREERS[s0.careerIdx + 1];
    if (!next) return;
    if (s0.xp < next.needXp || s0.skill < next.needSkill) return;
    mutate((s) => { s.careerIdx += 1; s.npcNews = [...(s.npcNews ?? []), { kind: "career" as const, text: `升职成了「${next.name}」`, day: s.day }]; });
    setLevelFx({ name: next.name, nonce: Date.now() });
    window.setTimeout(() => setLevelFx(null), 2600);
    floatReward(`🎉 升职：${next.name}`, "gold");
    floatReward(`工资 ×${next.mul}`, "blue");
    burstDanmaku([`🎉 ${profileRef.current?.name ?? "你"}升职成「${next.name}」啦！`, "阿琳：恭喜升职！请客请客 📈", "老周：我就说这孩子有出息", "小美：升职加薪，冲冲冲 💪", "大芬姐：今晚来我摊上，送你一串", "陈伯：好事！街坊都沾光"]);
    showToast(`晋升！你现在是「${next.name}」，工资 ×${next.mul}。街坊们明天就会在动态墙上议论这件事。`);
    addLog(`晋升为「${next.name}」，工资倍率 ×${next.mul}。`);
    postFeed("career", `晋升为「${next.name}」，工资 ×${next.mul}`);
  };

  const acceptOffer = (offerIdx: number) => {
    const s0 = gsRef.current;
    if (!s0 || s0.energy < 18) return;
    const offer = OFFERS[offerIdx];
    if (!offer) return;
    const pay = Math.round(basePay(s0) * 0.55 * offer.mul);
    mutate((s) => {
      s.money += pay; s.earned += pay; s.energy -= 18; s.xp += 1;
    });
    showToast(`「${offer.name}」接单成功，+${fmt(pay)}，经验 +1。`);
    addLog(`招聘广场接下「${offer.name}」，+${fmt(pay)}。`);
    setPhoneOpen(false);
  };

  const taxiTo = (locId: string) => {
    const s0 = gsRef.current;
    if (!s0) return;
    const fromL = locById(currentLocRef.current); const toL = locById(locId);
    const fare = Math.round(taxiFare(Math.hypot(toL.x - fromL.x, toL.z - fromL.z)) * (evRef.current.taxiMul ?? 1));
    if (s0.money < fare) { showToast(`打车到${toL.short}要 ${Y}${fare}，钱不够。`); return; }
    mutate((s) => { s.money -= fare; });
    setPhoneOpen(false);
    if (walkTimer.current) window.clearTimeout(walkTimer.current);
    setRoadRide(null);
    setRoadRideArrived(false);
    setWalking(false);
    pendingSleep.current = false;
    setSelectedLoc(locId);
    setAsideTab("place");
    setCurrentLoc(locId);
    currentLocRef.current = locId;
    showToast(`打车到${locById(locId).short}，-${Y}${fare}（按距离计价）。`);
  };

  /* ---------- NPC simulation: chat, favours, gifts, the street wall ---------- */
  const dayCtx = (): { day: number; cityKey: CityKey; playerName: string } => {
    const s0 = gsRef.current;
    return { day: s0?.day ?? 1, cityKey: s0?.cityKey ?? "sz", playerName: profileRef.current?.name ?? "我" };
  };

  const openNpcChat = (npcName: string) => {
    const s0 = gsRef.current;
    const npc = NPCS.find((n) => n.name === npcName);
    if (!s0 || !npc) return;
    const mem = memOf(s0.npcMem ?? {}, npcName);
    setNpcChat(npcName);
    const greet = greetLine(npc, mem, dayCtx());
    setNpcLog([{ from: "npc", text: greet }]);
    playNpcVoice(npcName, greet, en ? "en-US" : "zh-CN");
  };

  const doNpcChat = (action: ChatAction) => {
    const s0 = gsRef.current;
    const npc = NPCS.find((n) => n.name === npcChat);
    if (!s0 || !npc || !npcChat) return;
    if (action === "help" && s0.energy < 6) { showToast("能量不够，帮人也得先顾好自己——先吃点东西或歇会儿。"); return; }
    if (action === "gift" && s0.money < 25) { showToast(`送个小礼物要 ${fmt(25)}，钱包不够。先攒点钱，或者帮他个忙也一样暖心。`); return; }
    const mem = memOf(s0.npcMem ?? {}, npcChat);
    const repeatedToday = mem.lastDay === s0.day;
    const outcome = chatReply(npc, mem, action, dayCtx(), repeatedToday);
    const topicOf: Record<ChatAction, string> = { greet: "", weather: "天气", work: "工作", apec: "峰会", joke: "开玩笑", help: "帮忙", gift: "送礼物" };
    mutate((s) => {
      const m = { ...memOf(s.npcMem ?? {}, npcChat) };
      m.talks += 1;
      m.rel = Math.max(-100, Math.min(100, m.rel + outcome.relDelta));
      if (outcome.favour) { m.helps += 1; s.energy -= 6; }
      if (outcome.giftGiven) { m.gifts += 1; s.money -= 25; }
      if (outcome.slight) m.slights += 1;
      if (outcome.note) m.note = outcome.note;
      if (topicOf[action]) m.lastTopic = topicOf[action];
      m.lastDay = s.day;
      s.npcMem = { ...(s.npcMem ?? {}), [npcChat]: m };
      // First real conversation of the day still warms the player up.
      if (!s.greeted.includes(npcChat)) {
        s.greeted = [...s.greeted, npcChat];
        s.mood += 3;
        if (Math.random() < 0.3) s.network += 1;
      }
    });
    const playerLines: Record<ChatAction, string> = {
      greet: "嗨，最近怎么样？",
      weather: "今天这天儿，你觉得怎么样？",
      work: "最近活儿忙不忙？",
      apec: "峰会这事儿，你怎么看？",
      joke: "跟你讲个笑话：为什么程序员分不清万圣节和圣诞节？因为 Oct 31 == Dec 25。",
      help: "看你忙的，需要搭把手吗？我来帮你。",
      gift: `这个送你（${fmt(25)} 的小礼物），不值钱，就图个乐呵，别嫌弃。`,
    };
    setNpcLog((log) => [...log, { from: "me", text: playerLines[action] }, { from: "npc", text: outcome.reply }]);
    playNpcVoice(npc.name, outcome.reply, en ? "en-US" : "zh-CN");
    if (outcome.favour) addLog(`帮了${npc.name}一个忙，他记下了这份人情。`);
    else if (outcome.slight) addLog(`和${npc.name}聊天，玩笑开过了头，他有点不高兴。`);
    else if (outcome.giftGiven) addLog(`送了${npc.name}一份小礼物，关系暖和了些。`);
  };

  /* ---------- 街坊连续剧 ---------- */
  const applyStoryFx = (s: GameState, npcName: string, fx: StoryFx) => {
    s.money += fx.money ?? 0; s.mood += fx.mood ?? 0; s.energy += fx.energy ?? 0;
    s.xp += fx.xp ?? 0; s.skill += fx.skill ?? 0; s.network = Math.max(0, s.network + (fx.network ?? 0));
    if (fx.money && fx.money > 0) s.earned += fx.money;
    if (fx.rel) { const m = { ...memOf(s.npcMem ?? {}, npcName) }; m.rel = Math.max(-100, Math.min(100, m.rel + fx.rel)); s.npcMem = { ...(s.npcMem ?? {}), [npcName]: m }; }
  };
  const fxText = (fx: StoryFx) => [
    fx.money ? `${fx.money > 0 ? "+" : "-"}${fmt(Math.abs(fx.money))}` : "", fx.mood ? `${en ? "Mood" : "心情"} ${fx.mood > 0 ? "+" : ""}${fx.mood}` : "",
    fx.energy ? `${en ? "Energy" : "能量"} ${fx.energy}` : "", fx.xp ? `${en ? "XP" : "经验"} +${fx.xp}` : "", fx.skill ? `${en ? "Skill" : "技能"} +${fx.skill}` : "",
    fx.network ? `${en ? "Network" : "人脉"} ${fx.network > 0 ? "+" : ""}${fx.network}` : "", fx.rel ? `${en ? "Bond" : "关系"} +${fx.rel}` : "",
  ].filter(Boolean).join(" · ");
  const openStory = () => {
    const s0 = gsRef.current; const name = npcChat; if (!s0 || !name) return;
    const story = storyOf(name); if (!story) return;
    const tb = timeBlock("story", s0); if (tb) { showToast(`⏰ ${tb}。`); return; }
    const st = storyStatus(story, s0.story?.[name], memOf(s0.npcMem ?? {}, name).rel, s0.day);
    if (st.kind === "ready") {
      setStoryOpen(name);
      setNpcLog((log) => [...log, { from: "npc", text: `📖 ${en ? `Chapter ${st.idx + 1}/${st.total}` : `第 ${st.idx + 1}/${st.total} 章`} · ${L(st.chapter.title)}\n${L(st.chapter.text)}` }]);
    } else if (st.kind === "ending") {
      const prog = s0.story?.[name] ?? { ch: 0, day: 0, flags: [] };
      const end = story.ending(prog.flags);
      mutate((s) => {
        applyStoryFx(s, name, end.fx);
        s.story = { ...(s.story ?? {}), [name]: { ...prog, done: end.title, day: s.day } };
        s.busyUntil = Date.now() + cooldownMs(actionMinutes("story")); s.busyWhat = "聊天"; s.lastActiveDay = s.day;
        s.npcNews = [...(s.npcNews ?? []), { kind: "home" as const, text: `见证了${name}的故事「${end.title}」`, day: s.day }];
      });
      setNpcLog((log) => [...log, { from: "npc", text: `🏁 ${en ? "Ending" : "结局"} · ${L(end.title)}\n${L(end.text)}` }]);
      const fxs = fxText(end.fx);
      showToast(en ? `🏁 ${L(story.title)} · ${L(end.title)}${fxs ? ` (${fxs})` : ""}. This story goes into your ending: +2 legacy points.` : `🏁 ${story.title} · ${end.title}${fxs ? `（${fxs}）` : ""}。这个故事会写进你的结局，档案点 +2。`);
      addLog(`📖 ${name}的故事「${story.title}」结局：${end.title}。`);
      track("story_end", { npc: name });
      floatReward(`📖 ${L(end.title)}`, "gold");
    }
  };
  const chooseStory = (idx: number) => {
    const s0 = gsRef.current; const name = storyOpen; if (!s0 || !name) return;
    const story = storyOf(name); if (!story) return;
    const prog = s0.story?.[name] ?? { ch: 0, day: 0, flags: [] };
    const ch = story.chapters[prog.ch]; const choice = ch?.choices[idx];
    if (!ch || !choice) return;
    if ((choice.fx.money ?? 0) < 0 && s0.money < -(choice.fx.money ?? 0)) { showToast(`这个选择要 ${fmt(-(choice.fx.money ?? 0))}，钱包不够。`); return; }
    if ((choice.fx.energy ?? 0) < 0 && s0.energy < -(choice.fx.energy ?? 0)) { showToast("能量不够了，先歇歇或吃点东西。"); return; }
    mutate((s) => {
      applyStoryFx(s, name, choice.fx);
      s.story = { ...(s.story ?? {}), [name]: { ch: prog.ch + 1, day: s.day, flags: choice.flag ? [...prog.flags, choice.flag] : prog.flags } };
      s.busyUntil = Date.now() + cooldownMs(actionMinutes("story")); s.busyWhat = "聊天"; s.lastActiveDay = s.day;
    });
    setStoryOpen(null);
    setNpcLog((log) => [...log, { from: "me", text: L(choice.label) }, { from: "npc", text: L(choice.reply) }]);
    const fxs = fxText(choice.fx);
    const last = prog.ch + 1 >= story.chapters.length;
    showToast(en
      ? `📖 ${L(story.title)} · chapter ${prog.ch + 1} done${fxs ? ` (${fxs})` : ""}. ${last ? `Come back to ${trText(name)} tomorrow for the ending.` : `More tomorrow — get a little closer to ${trText(name)} to unlock the next chapter.`}`
      : `📖 ${story.title} · 第 ${prog.ch + 1} 章完${fxs ? `（${fxs}）` : ""}。${last ? `明天再来找${name}，看看结局。` : `后续明天揭晓——和${name}关系再近一些就能看下一章。`}`);
    addLog(`📖 ${name}：${ch.title}——你选了「${choice.label}」。`);
    track("story_chapter", { npc: name, ch: prog.ch + 1 });
  };

  /* ---------- 独立玩法：活动、组局、约会 ---------- */
  const L2t = (x: [string, string]) => (en ? x[1] : x[0]);
  const NO_PARTY = new Set(["license", "rentcar", "antiscam", "farejump", "scalp", "daijia", "rideshare"]);
  const actBlock = (a: Activity, s: GameState, here: boolean, loc?: Loc): string | null => {
    if (!here) return en ? "Get there first" : "到了才能玩";
    if (s.busyUntil && Date.now() < s.busyUntil) return en ? `Busy (${s.busyWhat ?? ""}) — ${countdown(s.busyUntil - Date.now())} left` : `正在${s.busyWhat ?? "忙"}，还要 ${countdown(s.busyUntil - Date.now())}`;
    const now = nowMin();
    if (a.hours && !inWindow(now, a.hours)) return en ? `Only ${windowStr(a.hours)} (Beijing time)` : `北京时间 ${windowStr(a.hours)} 才能玩`;
    const vc = loc ? venueClosed(loc) : null;
    if (vc) return en ? "Closed right now" : vc;
    if (a.cost > 0 && s.money < a.cost) return en ? `Needs ¥${a.cost}` : `要 ¥${a.cost}，钱不够`;
    if (a.energy > 0 && s.energy < a.energy) return en ? "Not enough energy" : "能量不够了";
    if (a.needs === "license" && (s.license ?? 0) < 3) return en ? "Needs a driving licence" : "要先考到驾照";
    if (a.needs === "car" && !((s.license ?? 0) >= 3 && (s.carOwned || s.carDay === s.day))) return en ? "No car today — rent one at a station" : "今天没车：去车站租一天";
    if (a.needs === "notLicensed" && (s.license ?? 0) >= 3) return en ? "You already have a licence" : "已经有驾照了";
    if (a.id === "license" && s.licDay === s.day) return en ? "One test a day" : "一天只能考一科";
    if (a.id === "rentcar" && (s.carOwned || s.carDay === s.day)) return en ? "You already have a car today" : "今天已经有车了";
    return null;
  };
  const datePartners = (s: GameState) => npcsForCity(s.cityKey).filter((n) => memOf(s.npcMem ?? {}, n.name).rel >= 15 || (s.romance?.[n.name] ?? 0) > 0);
  const specFor = (a: Activity): GameSpec => (a.cat === "date" && a.game.type === "quiz" ? { ...a.game, questions: [...DATE_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 3) } : a.game);
  const startActivity = (a: Activity, opts: { partyId?: number; mate?: string; locId?: string } = {}) => {
    const s0 = gsRef.current; if (!s0 || play) return;
    const here = !walking && !carriage && currentLocRef.current === (opts.locId ?? selectedLoc);
    const why = actBlock(a, s0, here, locById(opts.locId ?? selectedLoc));
    if (why) { showToast(`⏰ ${why}${en ? "." : "。"}`); return; }
    if (a.needs === "date" && !opts.mate) {
      if (datePartners(s0).length === 0) { showToast(en ? "Nobody to ask yet — get to know a neighbour first (bond +15)." : "还没有能约的人：先和街坊混熟（关系到 +15）。"); return; }
      setDatePick(a); return;
    }
    setPlay({ act: a, spec: specFor(a), ...(opts.partyId ? { partyId: opts.partyId } : {}), ...(opts.mate ? { mate: opts.mate } : {}) });
  };
  const ACT_ANIM: Record<string, LifeKind> = { climb: "hike", trail: "hike", surf: "beach", dive: "beach", seawalk: "beach", "volunteer-clean": "beach", kite: "stroll", cycle: "stroll", photo: "stroll", run: "gym", hoops: "gym", ktv: "gathering", drink: "gathering", bar: "gathering", club: "gathering", bizktv: "gathering", livehouse: "gathering", mahjong: "gathering", jubensha: "gathering", skewers: "eat", dinner: "eat", teahouse: "eat", themedate: "coaster", claw: "shopping", catcafe: "shopping", movie: "shopping" };
  const finishActivity = (r: GameResult) => {
    const p = play; const s0 = gsRef.current; if (!p || !s0) return;
    setPlay(null);
    const a = p.act;
    const loc = locById(currentLocRef.current);
    const party = p.partyId ? parties.find((x) => x.id === p.partyId) : undefined;
    const mates = party ? party.members.filter((m) => m.id !== myPubRef.current).length : 0;
    const out = resolveActivity(a, r, { payMul: CITIES[s0.cityKey].payMul, mates, locId: loc.id, locName: en ? trText(loc.name) : loc.name });
    let stageMsg = "";
    mutate((s) => {
      s.money += out.money - a.cost; s.earned += out.money; s.energy -= out.energy; s.mood += out.mood;
      s.xp += out.xp; s.skill += out.skill; s.fit += out.fit; s.network += out.network;
      s.busyUntil = Date.now() + cooldownMs(out.minutes, (s.perks ?? []).includes("route")); s.busyWhat = a.name[0]; s.lastActiveDay = s.day;
      s.actCount = (s.actCount ?? 0) + 1;
      if (mates > 0) { s.partyPlays = (s.partyPlays ?? 0) + 1; s.social = clamp100(s.social + 20); }
      if (p.mate) s.social = clamp100(s.social + 14);
      if (out.drop?.food) s.groceries += 1;
      if (a.id === "license") {
        s.licDay = s.day;
        if (out.passedLicense) { s.license = Math.min(3, (s.license ?? 0) + 1); stageMsg = s.license >= 3 ? (en ? "🪪 Licence acquired! Rent a car at a station, then pick \"Drive\" when travelling." : "🪪 拿到驾照了！去车站租车，出行就能选「自驾」。") : (en ? `🪪 Test ${s.license}/3 passed — next one tomorrow.` : `🪪 科目 ${s.license}/3 通过，明天考下一科。`); }
      }
      if (a.id === "rentcar") s.carDay = s.day;
      if (p.mate) {
        const before = romanceStage(s.romance?.[p.mate] ?? 0);
        const pts = Math.max(0, (s.romance?.[p.mate] ?? 0) + out.romance);
        s.romance = { ...(s.romance ?? {}), [p.mate]: pts };
        const m = { ...memOf(s.npcMem ?? {}, p.mate) }; m.rel = Math.max(-100, Math.min(100, m.rel + out.rel)); m.lastDay = s.day; s.npcMem = { ...(s.npcMem ?? {}), [p.mate]: m };
        const after = romanceStage(pts);
        if (after > before) {
          const st = ROMANCE_STAGES[after]!;
          stageMsg = en ? `💕 You and ${trText(p.mate)}: ${st.name[1]}!` : `💕 你和${p.mate}：${st.name[0]}！`;
          if (after >= 3 && !s.cohabit) { s.cohabit = true; s.rent = Math.round(s.rent / 20) * 10; s.baseRent = Math.round(s.baseRent / 20) * 10; stageMsg += en ? " Living together halves your rent." : "搬到一起住，房租减半。"; }
          s.npcNews = [...(s.npcNews ?? []), { kind: "home" as const, text: after >= 3 ? `和${p.mate}住到了一起` : after >= 2 ? `和${p.mate}在一起了` : `和${p.mate}有点暧昧`, day: s.day }];
        }
      }
      if (out.risk) {
        const k = out.risk.kind;
        if (k === "police") { s.money -= out.risk.fine; s.mood -= 15; s.record = (s.record ?? 0) + 1; s.busyUntil = Date.now() + 20 * 60_000; s.busyWhat = "在派出所做笔录"; }
        else if (k === "injury") { s.energy -= 25; s.money -= out.risk.fine; s.mood -= 8; }
        else if (k === "hangover") s.hangover = true;
        else if (k === "scam") { s.money -= out.risk.fine; s.mood -= 12; }
      }
    });
    let firstFind = false;
    if (out.drop) { const key = out.drop.key; updMeta((m) => { firstFind = !m.collect[key]; m.collect = { ...m.collect, [key]: (m.collect[key] ?? 0) + 1 }; }); }
    const fx = [out.money ? `+${fmt(out.money)}` : "", a.cost ? `-${fmt(a.cost)}` : "", out.mood ? `${en ? "Mood" : "心情"} ${out.mood > 0 ? "+" : ""}${out.mood}` : "",
      out.xp ? `${en ? "XP" : "经验"} +${out.xp}` : "", out.skill ? `${en ? "Skill" : "技能"} +${out.skill}` : "", out.fit ? `${en ? "Fitness" : "体质"} +${out.fit}` : "", out.network ? `${en ? "Network" : "人脉"} +${out.network}` : ""].filter(Boolean).join(" · ");
    const dropTxt = out.drop ? (en ? ` 🎁 ${out.drop.emoji} ${out.drop.name[1]}${firstFind ? " — new in your collection!" : ""}` : ` 🎁 ${out.drop.emoji} ${out.drop.name[0]}${firstFind ? "（图鉴新增！）" : ""}`) : "";
    showToast(`${a.emoji} ${L2t(out.line)}${fx ? (en ? ` (${fx})` : `（${fx}）`) : ""}${dropTxt}`);
    addLog(`${a.emoji} ${a.name[0]}：${out.line[0]}${out.drop ? ` 收获${out.drop.name[0]}。` : ""}`);
    if (out.money) floatReward(`+${fmt(out.money)}`, "gold");
    if (out.mood >= 6) floatReward(`${en ? "Mood" : "心情"} +${out.mood}`, "green");
    if (out.drop) floatReward(`${out.drop.emoji} ${L2t(out.drop.name)}`, "blue");
    let delay = 3600;
    if (out.risk) { const rk = out.risk; window.setTimeout(() => showToast(`${{ police: "🚓", injury: "🩹", hangover: "🍺", scam: "💸" }[rk.kind]} ${L2t(rk.text)}${rk.fine ? ` -${fmt(rk.fine)}` : ""}${rk.kind === "police" ? (en ? " A record follows you: big companies' background checks may fail." : " 留下案底：大厂背调可能过不了。") : ""}`), delay); addLog(`⚠️ ${rk.text[0]}`); delay += 3600; }
    if (stageMsg) window.setTimeout(() => showToast(stageMsg), delay);
    if (out.drop && firstFind) { const hit = dropById(out.drop.key); if (hit && hit.item.rarity === 3) postFeed("life", `${a.name[0]}收获了稀有的${hit.item.name[0]}`); }
    track("activity", { id: a.id, tier: out.tier, party: mates > 0, drop: !!out.drop, risk: out.risk?.kind ?? "" });
    const anim = ACT_ANIM[a.id];
    if (a.id === "ktv" || a.id === "bizktv") setSinging(true);
    if (anim) playLifeAnim(anim);
    if (p.partyId && profileRef.current) {
      const pid = p.partyId;
      setPartyResult(pid);
      void api.submitPartyScore({ playerId: profileRef.current.playerId, partyId: pid, score: Math.round(out.score * 100) / 100 }).then(() => partiesQuery.refetch()).catch(() => {});
    }
  };
  const hostParty = (a: Activity) => {
    const s0 = gsRef.current; const prof = profileRef.current; if (!s0 || !prof) return;
    const loc = locById(selectedLoc);
    void api.createParty({ playerId: prof.playerId, cityKey: s0.cityKey, locId: loc.id, locName: loc.name, activityId: a.id, title: a.name[0] }).then((r) => {
      if (!r.ok) { if (r.error?.includes("绑定账号")) setAccountOpen(true); showToast(r.error ?? (en ? "Couldn't open the party." : "组局失败了。")); return; }
      showToast(en ? `🎉 Party open: ${a.name[1]} at ${trText(loc.name)}. Everyone in the city can see it — start when you're ready; neighbours fill empty seats.` : `🎉 组局成功：在${loc.name}${a.name[0]}。同城玩家都能看到；人到了就开始，没人来街坊会来凑数。`);
      void partiesQuery.refetch(); setPartyOpen(true); track("party_create", { act: a.id });
    }).catch(() => showToast(en ? "Network hiccup — try again." : "网络不太好，再试一次。"));
  };
  const joinPartyNow = (pt: (typeof parties)[number]) => {
    const prof = profileRef.current; if (!prof) return;
    void api.joinParty({ playerId: prof.playerId, partyId: pt.id }).then((r) => {
      if (!r.ok) { if (r.error?.includes("绑定账号")) setAccountOpen(true); showToast(r.error ?? ""); return; }
      track("party_join", { act: pt.activityId });
      void partiesQuery.refetch();
      if (currentLocRef.current !== pt.locId) { showToast(en ? `Joined! Heading to ${trText(pt.locName)}…` : `加入了！正在赶去${pt.locName}……`); setPartyOpen(false); setSelectedLoc(pt.locId); walkTo(pt.locId); }
      else showToast(en ? "Joined! Wait for the host to start." : "加入了！等发起人开始。");
    }).catch(() => {});
  };
  const leavePartyNow = (pt: (typeof parties)[number]) => { const prof = profileRef.current; if (!prof) return; void api.leaveParty({ playerId: prof.playerId, partyId: pt.id }).then(() => partiesQuery.refetch()); };
  const startPartyNow = (pt: (typeof parties)[number]) => {
    const prof = profileRef.current; if (!prof) return;
    void api.startParty({ playerId: prof.playerId, partyId: pt.id }).then((r) => {
      if (!r.ok) { showToast(r.error ?? ""); return; }
      void partiesQuery.refetch().then(() => { const a = activityById(pt.activityId); if (a) { setPartyOpen(false); startActivity(a, { partyId: pt.id, locId: pt.locId }); } });
    });
  };
  /* NPC companions for a party nobody joined: deterministic per party */
  const ghostMates = (pid: number) => { const pool = npcsForCity(gsRef.current?.cityKey ?? "sz").slice().sort((x, y) => ((hashStr(x.name + pid) % 97) - (hashStr(y.name + pid) % 97))); return pool.slice(0, 2).map((n, i) => ({ id: `npc-${n.name}`, name: n.name, emoji: n.emoji, score: ((hashStr(`${n.name}:${pid}:${i}`) % 70) + 25) / 100, buddy: 0 })); };

  /* ---------- 点人：名片、私信、邀请组局、拉黑举报 ---------- */
  const pickActor = (who: { npc: string } | { player: string }) => {
    if ("npc" in who) { const name = who.npc.split("·")[0]!; if (NPCS.some((n) => n.name === name)) openNpcChat(name); return; }
    setCardOf(who.player);
  };
  const openDm = (peer: string) => {
    setCardOf(null); setDmPeer(peer); setDmOpen(true);
    const prof = profileRef.current;
    if (prof) void api.markDmRead({ playerId: prof.playerId, peerId: peer }).then(() => inboxQuery.refetch());
  };
  const sendDmNow = (peer: string, body: string) => {
    const prof = profileRef.current; if (!prof || !body.trim()) return;
    void api.sendDm({ playerId: prof.playerId, toId: peer, body: body.trim() }).then((r) => {
      if (!r.ok) { if (r.error?.includes("绑定账号")) setAccountOpen(true); showToast(r.error ?? (en ? "Message not sent." : "没发出去。")); return; }
      setDmInput(""); void inboxQuery.refetch(); track("dm_send");
    }).catch(() => showToast(en ? "Network hiccup — try again." : "网络不太好，再试一次。"));
  };
  const inviteToParty = (peer: string) => {
    const mine = parties.find((pt) => pt.status === "open" && pt.hostId === myPubRef.current);
    if (!mine) { showToast(en ? "Open a party first: pick a place, then 👥 under \"Things to do here\"." : "先组个局：去一个地点，在「在这里能玩」里点 👥 组局。"); return; }
    sendDmNow(peer, `[[party:${mine.id}]]`);
    showToast(en ? "Invite sent." : "邀请已发出。");
  };
  const blockNow = (peer: string, block: boolean) => {
    const prof = profileRef.current; if (!prof) return;
    void api.blockPlayer({ playerId: prof.playerId, targetId: peer, block }).then(() => { showToast(block ? (en ? "Blocked: they can't message you any more." : "已拉黑：对方不能再给你发消息。") : (en ? "Unblocked." : "已取消拉黑。")); void cardQuery.refetch(); void inboxQuery.refetch(); if (block) { setDmOpen(false); setDmPeer(null); } });
  };
  const reportNow = (peer: string, reason: "harassment" | "scam" | "spam" | "inappropriate" | "minor" | "other") => {
    const prof = profileRef.current; if (!prof) return;
    void api.reportPlayer({ playerId: prof.playerId, targetId: peer, reason }).then(() => showToast(en ? "Report sent. Moderators will review the conversation. You can also block them." : "举报已提交，管理员会查看你们的聊天记录。你也可以直接拉黑。"));
  };

  const likeNpcPost = (postId: string) => {
    mutate((s) => {
      s.npcFeed = (s.npcFeed ?? []).map((p) => (p.id === postId && !p.liked ? { ...p, liked: true, likes: p.likes + 1 } : p));
      const post = (s.npcFeed ?? []).find((p) => p.id === postId);
      if (post) {
        const m = { ...memOf(s.npcMem ?? {}, post.author) };
        m.rel = Math.min(100, m.rel + 1);
        s.npcMem = { ...(s.npcMem ?? {}), [post.author]: m };
      }
    });
  };

  const commentNpcPost = (postId: string, text: string) => {
    const s0 = gsRef.current;
    if (!s0) return;
    const post = (s0.npcFeed ?? []).find((p) => p.id === postId);
    if (!post || post.playerComment) return;
    const mem = memOf(s0.npcMem ?? {}, post.author);
    const reply = authorReply(post, mem, text, s0.day);
    mutate((s) => {
      s.npcFeed = (s.npcFeed ?? []).map((p) => {
        if (p.id !== postId) return p;
        const comments = [...p.comments, { author: profileRef.current?.name ?? "我", text }];
        if (reply) comments.push({ author: p.author, text: `回复你：${reply}` });
        return { ...p, playerComment: text, comments };
      });
      const m = { ...memOf(s.npcMem ?? {}, post.author) };
      m.rel = Math.min(100, m.rel + 2);
      s.npcMem = { ...(s.npcMem ?? {}), [post.author]: m };
    });
  };

  const buyTemplate = (tplId: string) => {
    const s0 = gsRef.current;
    if (!s0) return;
    const t = TEMPLATES.find((x) => x.id === tplId);
    if (!t) return;
    const price = tplQuote(t);
    if (s0.money < price) return;
    mutate((s) => {
      s.money -= price;
      s.homeSpent += price;
      s.homeStyle = t.name;
      s.rent = Math.round((s.baseRent * t.rentMul) / 10) * 10;
      s.npcNews = [...(s.npcNews ?? []), { kind: "home" as const, text: `把家装成了「${t.name}」风格`, day: s.day }];
    });
    showToast(`家里换上了「${t.name}」风格，周租变 ${fmt(Math.round((s0.baseRent * t.rentMul) / 10) * 10)}，舒适度大涨。`);
    addLog(`按 ZhuyaHome「${t.name}」模板装修，-${fmt(price)}。`);
    postFeed("home", `把家装成了 ZhuyaHome「${t.name}」风格`);
  };

  const buyFurniture = (fid: string) => {
    const s0 = gsRef.current;
    if (!s0) return;
    const f = furnById(fid);
    if (!f || s0.furniture.includes(fid) || s0.money < f.price) return;
    mutate((s) => {
      s.money -= f.price;
      s.homeSpent += f.price;
      s.furniture = [...s.furniture, fid];
    });
    showToast(`买下「${f.name}」，舒适度 +${f.comfort}。`);
    addLog(`购入家具「${f.name}」，-${fmt(f.price)}。`);
  };

  const wearOutfit = (id: string) => {
    const o = outfitOf(id);
    mutate((x) => { x.outfit = id; });
    showToast(`换上了${o.emoji}「${o.name}」：${o.scene}。`);
    addLog(`换装：${o.name}。${o.scene}。`);
  };
  const buyOutfit = (id: string) => {
    const s0 = gsRef.current;
    if (!s0) return;
    const o = outfitOf(id);
    if (s0.ownedOutfits.includes(id)) { wearOutfit(id); return; }
    if (s0.money < o.price) { showToast(`「${o.name}」要 ${fmt(o.price)}，钱不够，还差 ${fmt(o.price - s0.money)}。`); return; }
    mutate((x) => { x.money -= o.price; x.ownedOutfits = [...x.ownedOutfits, id]; x.outfit = id; });
    showToast(`买下并穿上${o.emoji}「${o.name}」，-${fmt(o.price)}。${o.scene}。`);
    addLog(`购入服装「${o.name}」，-${fmt(o.price)}，已穿上。`);
  };

  const sendChatMut = useMutation({
    mutationFn: (body: string) => api.postChat({ playerId: profileRef.current?.playerId ?? "", body }),
    onSuccess: (r) => {
      if (!r.ok) { showToast(r.error ?? "没发出去，稍后再试。"); return; }
      setChatInput("");
      queryClient.invalidateQueries({ queryKey: ["world", cityKey] });
    },
  });

  /* ---------- venue scenes: dine / shop / stay ---------- */
  const sceneFlag = (k: string) => !!sceneFlags[k];
  const setSceneFlag = (k: string) => setSceneFlags((f) => ({ ...f, [k]: true }));
  const dineEat = (restName: string, dishIdx: number) => {
    const r = RESTAURANTS.find((x) => x.id === venueScene?.id); if (!r) return;
    const d = r.dishes[dishIdx]; if (!d) return;
    const s0 = gsRef.current; if (!s0 || s0.money < d.cost) { showToast("钱包不够这道菜，先看看菜单过过瘾。"); return; }
    mutate((s) => { s.money -= d.cost; s.energy += d.energy; s.mood += d.mood; s.mealCount += 1; s.hunger = clamp100(s.hunger + 42); });
    showToast(`🍽️ ${d.name}上桌了，-${fmt(d.cost)}，能量 +${d.energy}，心情 +${d.mood}。`);
    addLog(`在${restName}堂食「${d.name}」，-${fmt(d.cost)}。`);
playLifeAnim("eat");
  };
  const orderDelivery = (platIdx: number, foodIdx: number) => {
    const s0 = gsRef.current; if (!s0) return;
    const plat = DELIVERY_PLATFORMS[platIdx]; const f = FOODS[s0.cityKey][foodIdx];
    if (!plat || !f) return;
    const cost = Math.round(f.cost * plat.feeMul);
    if (s0.money < cost) { showToast("钱不够点这单外卖。"); return; }
    mutate((s) => { s.money -= cost; s.energy += f.energy; s.mood += f.mood; s.mealCount += 1; s.hunger = clamp100(s.hunger + 36); });
    showToast(`${plat.emoji} ${plat.name}：${f.name}送到了，-${fmt(cost)}，能量 +${f.energy}。骑手在楼下等你取餐。`);
    addLog(`用${plat.name}点了${f.name}外卖，-${fmt(cost)}。`);
  };
  const shopBuy = (venueName: string, itemIdx: number) => {
    const v = SHOP_VENUES.find((x) => x.id === venueScene?.id); if (!v) return;
    const it = v.items[itemIdx]; if (!it) return;
    const s0 = gsRef.current; if (!s0 || s0.money < it.cost) { showToast("钱不够，先逛逛过眼瘾。"); return; }
    mutate((s) => { s.money -= it.cost; s.mood += it.mood; });
    showToast(`🛍️ 在${venueName}买下「${it.name}」，-${fmt(it.cost)}，心情 +${it.mood}。`);
    addLog(`在${venueName}买了「${it.name}」，-${fmt(it.cost)}。`);
playLifeAnim("shopping");
  };
  const stayOvernight = (lodgingId: string) => {
    const l = LODGINGS.find((x) => x.id === lodgingId); const s0 = gsRef.current;
    if (!l || !s0) return;
    if (s0.money < l.price) { showToast(`住一晚要 ${Y}${l.price}，钱不够。`); return; }
    const hostelNet = lodgingId === "hostel" && Math.random() < 0.6;
    mutate((s) => { s.money -= l.price; s.mood += l.mood; if (hostelNet) s.network += 1; });
    setVenueScene(null);
    showToast(`🛏️ 在「${l.name}」住下了，-${Y}${l.price}。${hostelNet ? "客厅里聊得投机，人脉 +1。" : ""}好好睡一觉到明天。`);
    addLog(`在「${l.name}」过夜，-${Y}${l.price}，心情 +${l.mood}。`);
    window.setTimeout(() => playLifeAnim("sleep", () => doSleep()), 350);
  };
  const signRent = () => {
    const s0 = gsRef.current; if (!s0) return;
    const weekly = rentFlatWeekly(s0.cityKey);
    mutate((s) => { s.baseRent = weekly; s.rent = weekly; s.mood += 10; });
    setVenueScene(null);
    showToast(`🔑 签约成功！新家长租公寓，周租 ${fmt(weekly)}，从下周六按新价交租。`);
    addLog(`签约长租公寓，周租改为 ${fmt(weekly)}。`);
    postFeed("home", "签约了长租公寓，换了个住法");
  };

  /* ---------- per-location action table ---------- */
  interface ActDef {
    kind: string;
    arg?: number;
    title: string;
    emoji: string;
    desc: string;
    cost: string;
    disabled?: boolean;
  }

  /* A company HQ: work there if it is your employer, otherwise interview /
     take the offer. Other place actions (e.g. 平安's 理财) stay underneath. */
  const companyActions = (co0: Company, s: GameState): ActDef[] => {
    const co = effCompany(co0, todayEvent, s.referrals);
    const mates = (world?.online ?? []).filter((p) => p.id !== myId && p.employer === co.id && p.cityKey === s.cityKey).map((p) => p.name);
    const base = basePay(s);
    const fitSave = s.fit >= 3 ? 3 : 0;
    const career = CAREERS[s.careerIdx] ?? CAREERS[0]!;
    if (employerHere(s)?.id === co.id) {
      const cost = co.energy - fitSave;
      const otCost = co.energy + 14 - fitSave;
      return [
        { kind: "work", title: "正经上班", emoji: co.emoji, desc: `${co.short}的一天 · 职级「${career.name}」 · 工资 ×${+(career.mul * co.payMul).toFixed(2)} · 经验 +2${mates.length ? ` · 👥 同事在线：${mates.slice(0, 3).join("、")}（一起上班心情 +3）` : ""}${todayEvent.payMul ? " · 💰 今天发奖金 ×1.3" : ""}`, cost: `+${fmt(Math.round(base * co.payMul))} · 能量 -${cost}${co.mood ? ` · 心情 ${co.mood > 0 ? "+" : ""}${co.mood}` : ""}`, disabled: s.energy < cost },
        { kind: "overtime", title: "拼命加班", emoji: "🔥", desc: co.otMul > 1 ? "加班费比别家给得多，但人是真的累" : "老板画饼你吃饼，钱多但掉心情", cost: `+${fmt(Math.round(base * co.payMul * 1.75 * co.otMul))} · 能量 -${otCost} · 心情 -12`, disabled: s.energy < otCost },
        ...(co.canteen ? [{ kind: "canteen", title: "员工食堂吃饭", emoji: "🍱", desc: "刷工卡，几块钱吃到饱，大厂福利之一", cost: "-¥12 · 能量 +22 · 心情 +4", disabled: s.money < 12 }] : []),
      ];
    }
    const cur = companyById(s.employer);
    const tried = (s.interviews ?? []).includes(`${s.day}:${co.id}`);
    const gaps = companyGaps(co, s);
    const payNow = Math.round(base * cur.payMul);
    const payThere = Math.round(base * co.payMul);
    return [
      (s.offers ?? []).includes(co.id)
        ? { kind: "join-company", title: `接受 offer · 入职${co.short}`, emoji: "🤝", desc: `从「${cur.short}」跳槽过来。${co.culture}`, cost: `日薪 ${fmt(payThere)}（现在 ${fmt(payNow)}）· 上班能量 -${co.energy - fitSave}` }
        : { kind: "interview", title: tried ? `今天已经面过${co.short}了` : `投简历 · 面试${co.short}`, emoji: "📝", desc: `${co.culture}${todayEvent.openDay === co.id ? " 🏢 今天开放日，门槛降低！" : ""}${(s.referrals ?? []).includes(co.id) ? " 🤝 你有内推，门槛降低。" : ""}${gaps.length > 0 ? ` 门槛还差：${gaps.join("、")}。` : " 你的条件已经够了。"}${co.formal ? " 面试要穿正装。" : ""}`, cost: `能量 -12 · 日薪约 ${fmt(payThere)}（现在 ${fmt(payNow)}）· 每家每天一次`, disabled: tried || s.energy < 12 },
      { kind: "campus-tour", title: "在园区逛逛", emoji: "👀", desc: "看看大厂的楼、咖啡厅和来来往往的打工人", cost: "能量 -3 · 心情 +6 · 免费" },
    ];
  };
  const actionsFor = (loc: Loc, s: GameState): ActDef[] => {
    const co = companyAt(s.cityKey, loc.id);
    const acts = co ? [...companyActions(co, s), ...(loc.type === "work" ? [] : baseActionsFor(loc, s))] : baseActionsFor(loc, s);
    const ev = todayEvent;
    acts.unshift(...routineActs(loc, s));
    { const vs = venueFor(loc); if (vs) acts.push({ kind: "__venue3d", emoji: "🚪", title: en ? "Step inside · 3D" : "走进去 · 3D", desc: en ? vs.en : vs.zh, cost: en ? "free" : "免费" }); }
    if (loc.type === "social") acts.unshift({ kind: "__livehouse", emoji: "🎶", title: en ? "Into the Livehouse" : "进 Livehouse 听歌", desc: en ? "The whole city hears the same song at the same moment — independent musicians' originals" : "全城同步放同一首歌：独立音乐人的原创投稿，你也能投稿", cost: en ? "free" : "免费" });
    for (const m of momentsAt(s.cityKey, loc.id, loc.name)) acts.unshift({ kind: `__scenic-${m.id}`, emoji: m.emoji, title: en ? m.en : m.zh, desc: `${en ? m.hintEn : m.hint}${inBest(m, nowMin()) ? (en ? " · ✨ perfect time right now" : " · ✨ 现在正是最好的时候") : ""}`, cost: en ? `mood +${inBest(m, nowMin()) ? 20 : 12} · free` : `心情 +${inBest(m, nowMin()) ? 20 : 12} · 免费` });
    if (loc.type === "learn") acts.push({ kind: "__retrain", emoji: "🎓", title: en ? "Retrain / get certified" : "转行培训 / 考证", desc: en ? "Switch to another job: pay the course fee, have the skill it needs." : "换一份工作：交培训费，技能够就能转。外卖员也能考成护士。", cost: en ? "course fee" : "培训费" });
    const tn = nowMin();
    for (const r of CROSS_ROUTES) {
      if (r.from !== s.cityKey || r.fromLoc !== loc.id) continue;
      const open = isCrossOpen(r, tn);
      const toShort = getLocations(r.to).find((l) => l.id === r.toLoc)?.short ?? "";
      acts.push({ kind: `__cross-${r.id}`, title: `${r.emoji} ${crossName(r, en)}`, emoji: "🧭", desc: en ? `To ${CITY_EN[r.to]}: ${crossNote(r, true)}` : `去${CITIES[r.to].name}（到${toShort}）：${r.note}`, cost: r.shut ? crossHoursStr(r, en) : `${crossFareStr(r, en)} · ${r.min} ${en ? "min" : "分钟"} · ${open ? crossHoursStr(r, en) : `${en ? "Not running" : "已停"} · ${crossHoursStr(r, en)}`}`, disabled: !open });
    }
    return acts.map((a) => {
      if (ev.beachClosed && isBeachLoc(loc) && (a.kind === "fun" || a.kind === "checkin" || a.kind === "stroll")) return { ...a, disabled: true, desc: "🌀 台风预警，海边今天封闭，改天再来" };
      if (ev.mallMul && (a.kind === "mall-shop" || a.kind === "mall-cloth")) return { ...a, desc: `🛍️ 今日大促 6 折 · ${a.desc}` };
      if (ev.eatMul && a.kind === "eat") return { ...a, desc: `🍢 美食节 7 折、心情 +5 · ${a.desc}` };
      if (ev.funMood && a.kind === "fun") return { ...a, desc: `🎶 音乐会，心情额外 +8 · ${a.desc}` };
      return a;
    });
  };
  const baseActionsFor = (loc: Loc, s: GameState): ActDef[] => {
    const base = basePay(s);
    const city = CITIES[s.cityKey];
    const fitSave = s.fit >= 3 ? 3 : 0;
    switch (loc.type) {
      case "home":
        return [
          { kind: "__home3d", title: "走进屋里", emoji: "🚪", desc: "推门进去。摇杆走到床、沙发、灶台、洗手间，再点互动。", cost: "免费" },
          { kind: "__sleep", title: "睡一觉", emoji: "😴", desc: "每天第一次睡觉回满能量；日子跟着北京时间走，睡觉不会跳到明天", cost: "能量回满" },
          { kind: "wash", title: "起床洗漱", emoji: "🪥", desc: "刷牙、洗脸、整理自己，新的一天从卫生间开始", cost: "能量 +6 · 心情 +6 · 免费" },
          { kind: "cook", title: "自己做饭", emoji: "🍳", desc: `用冰箱里的食材做一顿（当前食材 ×${s.groceries}）：洗菜、切菜、下锅、上桌`, cost: "食材 -1 · 能量 +34 · 心情 +9", disabled: s.groceries <= 0 },
          { kind: "buy-groceries", title: "楼下买菜", emoji: "🥬", desc: "下楼到菜摊买一篮子菜，囤进冰箱慢慢做", cost: `-${Y}28 · 食材 +1`, disabled: s.money < 28 },
          { kind: "rest", title: "躺平摸鱼", emoji: "🛋️", desc: "刷手机、睡午觉，不花钱回血（穿睡衣恢复更多）", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "work":
        return [
          { kind: "work", title: "正经上班", emoji: "🏢", desc: `干一天活拿一天钱 · 职级「${(CAREERS[s.careerIdx] ?? CAREERS[0]!).name}」工资 ×${(CAREERS[s.careerIdx] ?? CAREERS[0]!).mul} · 经验 +2`, cost: `+${fmt(base)} · 能量 -${28 - fitSave}`, disabled: s.energy < 28 - fitSave },
          { kind: "overtime", title: "拼命加班", emoji: "🔥", desc: "老板画饼你吃饼，钱多但掉心情", cost: `+${fmt(Math.round(base * 1.75))} · 能量 -${42 - fitSave} · 心情 -12`, disabled: s.energy < 42 - fitSave },
        ];
      case "transit":
        return [
          { kind: "gig", title: loc.gigName ?? city.gigName, emoji: "🛵", desc: "在站点附近接单，灵活、来钱快一点点", cost: `+${fmt(Math.round(base * 0.55))} 起 · 能量 -18`, disabled: s.energy < 18 },
          ...(loc.id === "port" ? [{ kind: "ferry", title: "坐轮渡出海", emoji: "⛴️", desc: "蛇口出发，甲板看海、看大桥", cost: `-${Y}60 · 心情 +18 · 能量 -6` }] : []),
          ...(loc.id === "airport" || loc.id === "pingtan-airport" ? [{ kind: "flight", title: "坐飞机远行一天", emoji: "✈️", desc: "挑个便宜航线出门看看，晚上回来", cost: `-${Y}420 · 心情 +26 · 能量 -14`, disabled: s.money < 420 }] : []),
          { kind: "rest", title: "在站里歇会儿", emoji: "🧋", desc: "买杯水、坐一会儿，看人来人往", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "port":
        return [
          { kind: "gig", title: loc.gigName ?? city.gigName, emoji: "🛵", desc: "口岸附近接单，跨境客流不断", cost: `+${fmt(Math.round(base * 0.55))} 起 · 能量 -18`, disabled: s.energy < 18 },
          ...(s.cityKey === "hk" ? [
            { kind: "__gocity-sz", title: "看看所有回深圳的路", emoji: "🧭", desc: "罗湖、落马洲、香园围、皇岗巴士、高铁、蛇口船……按真实开放时间挑一条", cost: "免费过关 ~ HK$120 · 进度不变" },
            { kind: "rest", title: "在口岸歇会儿", emoji: "🧋", desc: "看人来人往过关，买杯水坐一会儿", cost: "能量 +14 · 心情 +8 · 免费" },
          ] : [
            { kind: "hk-trip", title: "过关去香港一日游", emoji: "🇭🇰", desc: "旺角、天星小轮、茶餐厅，过关当天来回", cost: `-${Y}180 · 心情 +22 · 能量 -16 · 人脉 +1`, disabled: s.money < 180 },
            { kind: "__gocity-hk", title: "看看所有去香港的路", emoji: "🧭", desc: "罗湖、福田、皇岗（24 小时）、深圳湾、莲塘、高铁、蛇口船——按真实开放时间挑一条，搬过去住一段", cost: "免费过关 ~ ¥220 · 进度不变" },
            { kind: "rest", title: "在口岸歇会儿", emoji: "🧋", desc: "看人来人往过关，买杯水坐一会儿", cost: "能量 +14 · 心情 +8 · 免费" },
          ]),
        ];
      case "scenic":
      case "mountain":
        return [
          { kind: "fun", title: loc.funName ?? city.funName, emoji: "✨", desc: loc.funDesc ?? city.funDesc, cost: `-${fmt(loc.funCost ?? city.funCost)} · 心情 +${loc.funMood ?? city.moodFun}` },
          { kind: "checkin", title: "拍照打卡", emoji: "📸", desc: "在地标前打卡，集风景册（见下方打卡进度）", cost: "心情 +12 · 免费" },
          { kind: "stroll", title: "慢慢散步", emoji: "🚶", desc: "不赶时间，沿着风景慢慢走一圈", cost: "能量 -4 · 心情 +12 · 免费" },
          ...(loc.type === "mountain" ? [{ kind: "hike", title: "登山徒步练体质", emoji: "🥾", desc: "爬一趟山，体质和心情一起涨", cost: "能量 -16 · 心情 +20 · 体质 +1", disabled: s.energy < 16 }] : []),
          { kind: "rest", title: "原地发呆", emoji: "🌤️", desc: "什么都不做，也是一种恢复", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "food":
        return [...FOODS[s.cityKey].map((f, i) => ({
          kind: "eat", arg: i, title: f.name, emoji: f.emoji, desc: f.desc,
          cost: `-${fmt(Math.round(f.cost * policyRef.current.eat))} · 能量 +${f.energy} · 心情 +${f.mood}`,
        }))];
      case "fun":
        return [
          { kind: "fun", title: loc.funName ?? city.funName, emoji: "✨", desc: loc.funDesc ?? city.funDesc, cost: `-${fmt(loc.funCost ?? city.funCost)} · 心情 +${loc.funMood ?? city.moodFun}` },
          ...(scenicOf(s.cityKey, loc.id) ? [{ kind: "checkin", title: "拍照打卡", emoji: "📸", desc: scenicOf(s.cityKey, loc.id)?.tip ?? "在地标前打卡留念", cost: "心情 +12 · 免费" }] : []),
          { kind: "rest", title: "原地发呆", emoji: "🌤️", desc: "什么都不做，也是一种恢复", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "learn":
        return [
          { kind: "learn-course", title: "夜校充电课", emoji: "🎓", desc: "职业技能课，升职的硬通货", cost: `-${Y}30 · 能量 -15 · 技能 +1 · 经验 +1`, disabled: s.energy < 15 },
          { kind: "learn-self", title: "自习备考", emoji: "📖", desc: "免费自习，慢慢攒技能", cost: "能量 -10 · 技能 +1 · 心情 +2 · 免费", disabled: s.energy < 10 },
        ];
      case "apec": {
        const mul = apecVenueMul(s.day, loc.id);
        const mulTxt = mul > 1 ? `，今天收入 ×${mul}` : "，峰会周（14–19 日）重点日收入 ×1.5";
        const task = apecTaskOfDay(s.day);
        const checked = (s.apecCheckins ?? []).includes(loc.id);
        const taskDone = task ? (s.apecTasks ?? []).includes(task.id) : false;
        return [
          { kind: "apec-checkin", title: checked ? "会场打卡 ✓ 已完成" : "📸 会场打卡", emoji: "📸", desc: checked ? "这个会场已经在你的 峰会打卡册里了" : `在${loc.short}地标前打卡，集齐三个会场（已打卡 ${(s.apecCheckins ?? []).length} / 3）`, cost: "心情 +6 · 免费", disabled: checked },
          ...(task && task.venueLocId === loc.id ? [{ kind: "apec-task", title: taskDone ? `今日任务 ✓ ${task.title}` : `${task.roleEmoji} 今日任务：${task.title}`, emoji: task.roleEmoji, desc: taskDone ? "今天的班已经上完了，明天还有新任务" : `${task.dateLabel} · ${task.event}——你当${task.role}。${checked ? task.desc : "先打卡，再上岗。" + task.desc}`, cost: taskDone ? "已完成" : `+${fmt(Math.round(base * task.payMul))} · 能量 -${task.energy} · 经验 +${task.xp} · 人脉 +${task.network}`, disabled: taskDone || !checked || s.energy < task.energy }] : []),
          { kind: "apec-staff", title: "会务服务兼职", emoji: "🎪", desc: `布展、引导、物料分发——以工作人员身份参与${mulTxt}`, cost: `+${fmt(Math.round(base * 0.9 * mul))} · 能量 -22 · 经验 +2`, disabled: s.energy < 22 },
          { kind: "apec-host", title: "外宾接待引导", emoji: "🌐", desc: s.skill < 1 ? "需要技能 ≥1（先去图书馆/夜校学一课）" : `陪代表团参观、答疑、引导，最锻炼人也最长脸${mulTxt}`, cost: `+${fmt(Math.round(base * 1.25 * mul))} · 能量 -20 · 经验 +3 · 人脉 +1`, disabled: s.energy < 20 || s.skill < 1 },
          { kind: "apec-visit", title: "参观主题展陈", emoji: "🎫", desc: "各方嘉宾带来的展陈挨个看，集章、看会徽背后的故事", cost: `-${Y}20 · 心情 +10 · 可能 +人脉` },
        ];
      }
      case "mall":
        return [
          { kind: "mall-shop", title: "逛街购物", emoji: "🛍️", desc: "日用品、小玩意儿，快乐很直接", cost: `-${Y}120 · 心情 +14` },
          { kind: "mall-cloth", title: "买身新衣服", emoji: "👔", desc: "人靠衣装，面试和社交都体面些", cost: `-${Y}300 · 心情 +20 · 人脉 +1` },
          { kind: "mall-promo", title: "商场促销兼职", emoji: "📣", desc: "站柜台发传单，活儿不重", cost: `+${fmt(Math.round(base * 0.5))} · 能量 -16 · 经验 +1`, disabled: s.energy < 16 },
        ];
      case "health":
        return [
          { kind: "health-check", title: "全面体检", emoji: "🩺", desc: "查个明白，顺便把作息调整过来", cost: `-${Y}150 · 能量 +8 · 心情 +6 · 体质 +1` },
          { kind: "health-cure", title: "看病调理", emoji: "💊", desc: "小毛病别拖，调理完神清气爽", cost: `-${Y}80 · 能量 +18 · 心情 +3` },
        ];
      case "gym":
        return [
          { kind: "gym", title: "认真练一次", emoji: "💪", desc: `练够 3 次体质变好，上班能量消耗 -3（当前已练 ${s.fit} 次）`, cost: `-${Y}30 · 能量 -10 · 心情 +10 · 体质 +1`, disabled: s.energy < 10 },
          { kind: "rest", title: "拉伸放松", emoji: "🧘", desc: "不花钱，活动活动筋骨", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "lodging":
        return [
          { kind: "rest", title: "在大堂坐坐", emoji: "🛋️", desc: "蹭个沙发和空调，看看住客来来往往", cost: "能量 +14 · 心情 +8 · 免费" },
          { kind: "gig", title: loc.gigName ?? "酒店帮工 / 行李员", emoji: "🧳", desc: "帮住客搬行李、做接待，旺季单多", cost: `+${fmt(Math.round(base * 0.55))} 起 · 能量 -18`, disabled: s.energy < 18 },
        ];
      case "service":
        if (loc.placeKind === "pharmacy") return [
          { kind: "buy-medicine", title: "买点常备药", emoji: "💊", desc: "感冒药、肠胃药、创可贴、防晒，药师会帮你挑；外籍人士可以把症状写在手机上给药师看", cost: "-¥35 · 能量 +10 · 心情 +2", disabled: s.money < 35 },
          { kind: "ask-help", title: "问问药师", emoji: "🧑‍⚕️", desc: "小毛病先问药师，要不要去医院、去哪家近，药师门儿清", cost: "心情 +3 · 免费" },
        ];
        if (loc.placeKind === "police") return [
          { kind: "ask-help", title: "问路 / 求助", emoji: "🚓", desc: "迷路、丢东西、遇到麻烦都可以进来；紧急情况直接打 110", cost: "心情 +3 · 免费" },
          { kind: "rest", title: "在门口歇会儿", emoji: "🪑", desc: "派出所门口最安心", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
        return [
          { kind: "tourist-map", title: "领一份中英文地图", emoji: "🗺️", desc: "地铁图、景点、医院和应急电话都印在上面，参会代表和游客都用得上", cost: "心情 +4 · 免费" },
          { kind: "volunteer", title: "当一会儿志愿者", emoji: "🎽", desc: isApecWeek(s.day) ? "峰会周人手紧：帮外宾指路、翻译、找地铁站" : "帮游客指路、答疑", cost: `能量 -10 · 人脉 +1 · 经验 +1${isApecWeek(s.day) ? " · 心情 +8" : ""}`, disabled: s.energy < 10 },
        ];
      case "bank":
        return [
          { kind: "bank-buy", title: `买理财 ${Y}1,000`, emoji: "📈", desc: `每晚约 +0.4% 收益，小概率波动亏损（当前理财 ${fmt(s.invest)}）`, cost: `-${Y}1,000 现金 · 转入理财`, disabled: s.money < 1000 },
          { kind: "bank-sell", title: "取出全部理财", emoji: "💰", desc: "连本带收益回到存款", cost: `+${fmt(s.invest)}`, disabled: s.invest <= 0 },
        ];
      case "social":
        return [
          { kind: "social-ktv", title: "约朋友唱 K", emoji: "🎤", desc: "吼两嗓子，烦恼减半，朋友加一", cost: `-${Y}88 · 心情 +18 · 人脉 +1` },
          { kind: "social-drink", title: "小酌一杯", emoji: "🍻", desc: "微醺刚好，聊聊最近的行情", cost: `-${Y}45 · 心情 +10 · 能量 +4` },
        ];
      case "market":
        return [
          { kind: "buy-groceries", title: "市集买菜", emoji: "🥬", desc: `婆婆珍的菜摊新鲜又便宜，电车叮叮从摊边碌过，买一篮子囤着（当前食材 ×${s.groceries}）`, cost: `-${Y}28 · 食材 +1`, disabled: s.money < 28 },
        ];
      /* ---- round-2 (b S4): per-subtype venue actions. The `market` case
         above now fires ONLY at the one true wet market (北角·春秧街街市）. ---- */
      case "electronics":
        return [
          { kind: "market-phone", title: "淘二手手机捡漏", emoji: "📱", desc: "眼力决定收益：捡漏转手能赚，踩坑就自用", cost: `-${Y}400 · 约一半概率转手 +${Y}650`, disabled: s.money < 400 },
          { kind: "market-fix", title: "装机 / 维修兼职", emoji: "🛠️", desc: "帮摊主装机修小电器，手艺活", cost: `+${fmt(Math.round(base * 0.6))} · 能量 -20 · 经验 +1`, disabled: s.energy < 20 },
          { kind: "mall-shop", title: "买配件", emoji: "🔌", desc: "数据线、钢化膜、充电头，现买现用", cost: `-${Y}120 · 心情 +14` },
          { kind: "gig", title: loc.gigName ?? "装机 / 验机兼职", emoji: "🛠️", desc: "柜台帮工、验机、装机", cost: `+${fmt(Math.round(base * 0.55))} 起 · 能量 -18`, disabled: s.energy < 18 },
          { kind: "rest", title: "在柜台边歇会儿", emoji: "🧋", desc: "坐一会儿，看人来人往讲价", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "oilpainting":
        return [
          { kind: "mall-shop", title: "买幅画装点出租屋", emoji: "🖼️", desc: "临摹名画、原创小品，挂回家心情都不一样", cost: `-${Y}120 · 心情 +14` },
          { kind: "gig", title: loc.gigName ?? "画作装裱 / 临摹兼职", emoji: "🎨", desc: "临摹、装裱、画廊帮工", cost: `+${fmt(Math.round(base * 0.55))} 起 · 能量 -18`, disabled: s.energy < 18 },
          { kind: "fun", title: loc.funName ?? "看画展", emoji: "✨", desc: loc.funDesc ?? "满墙油画慢慢看", cost: `-${fmt(loc.funCost ?? 0)} · 心情 +${loc.funMood ?? 20}` },
          { kind: "rest", title: "在画廊里坐坐", emoji: "🪑", desc: "画看多了，坐下来歇会儿", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "secondhand":
        return [
          { kind: "market-phone", title: "淘二手好物", emoji: "📱", desc: "旧手机、旧家具、黑胶唱片，眼力决定收益", cost: `-${Y}400 · 约一半概率转手 +${Y}650`, disabled: s.money < 400 },
          { kind: "market-fix", title: "修小电器兼职", emoji: "🛠️", desc: "帮摊主修小电器、装机", cost: `+${fmt(Math.round(base * 0.6))} · 能量 -20 · 经验 +1`, disabled: s.energy < 20 },
          { kind: "mall-shop", title: "淘旧家具 / 黑胶", emoji: "📻", desc: "旧沙发、旧唱片，贱买也能捡到宝", cost: `-${Y}120 · 心情 +14` },
          { kind: "gig", title: loc.gigName ?? "旧货整理 / 修小电器", emoji: "🧺", desc: "帮摊主整理旧货、修小电器", cost: `+${fmt(Math.round(base * 0.55))} 起 · 能量 -18`, disabled: s.energy < 18 },
          { kind: "__flea", title: "二手家具市集", emoji: "🪑", desc: "今天的二手家具 + 便宜货（服务器当日货单）", cost: "按件计价" },
          { kind: "rest", title: "在地摊边歇会儿", emoji: "🧋", desc: "坐一会儿，看看过路的人淘什么", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "seafood":
        return [
          { kind: "seafood-feast", title: "吃海鲜大餐", emoji: "🦐", desc: "现捞现称，隔壁大排档代加工", cost: `-${Y}80 · 能量 +20 · 心情 +15`, disabled: s.money < 80 },
          { kind: "gig", title: loc.gigName ?? "海鲜街帮工 / 摆摊", emoji: "🦞", desc: "海鲜档帮工、摆摊、代客加工", cost: `+${fmt(Math.round(base * 0.55))} 起 · 能量 -18`, disabled: s.energy < 18 },
          { kind: "fun", title: loc.funName ?? "海鲜街逛逛", emoji: "✨", desc: loc.funDesc ?? "水箱里的活鱼活虾慢慢看", cost: `-${fmt(loc.funCost ?? 0)} · 心情 +${loc.funMood ?? 20}` },
          { kind: "rest", title: "在码头边歇会儿", emoji: "🧋", desc: "看渔船进出，吹吹海风", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "oldtown":
        return [
          { kind: "snack-eat", title: "吃老街小吃", emoji: "🥮", desc: "老婆饼、肠粉、客家小吃，现做现吃", cost: `-${Y}25 · 能量 +10 · 心情 +8`, disabled: s.money < 25 },
          { kind: "gig", title: loc.gigName ?? "老城摆摊 / 帮工", emoji: "🏮", desc: "老城摆摊、老店帮工", cost: `+${fmt(Math.round(base * 0.55))} 起 · 能量 -18`, disabled: s.energy < 18 },
          { kind: "fun", title: loc.funName ?? "逛老街", emoji: "✨", desc: loc.funDesc ?? "骑楼、老字号、界碑慢慢看", cost: `-${fmt(loc.funCost ?? 0)} · 心情 +${loc.funMood ?? 20}` },
          { kind: "checkin", title: "拍照打卡", emoji: "📸", desc: "在老街地标前打卡", cost: "心情 +12 · 免费" },
          { kind: "rest", title: "在骑楼下歇会儿", emoji: "🪑", desc: "老街的阴凉处最舒服", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "womensstreet":
        return [
          { kind: "snack-eat", title: "吃街边小吃", emoji: "🍢", desc: "女人街边走边吃", cost: `-${Y}25 · 能量 +10 · 心情 +8`, disabled: s.money < 25 },
          { kind: "mall-shop", title: "淘衣服鞋袜", emoji: "👗", desc: "平价衣袜、金鱼、花，讲价是正经事", cost: `-${Y}120 · 心情 +14` },
          { kind: "gig", title: loc.gigName ?? "女人街帮工", emoji: "🛍️", desc: "档口帮工、搬货、看摊", cost: `+${fmt(Math.round(base * 0.55))} 起 · 能量 -18`, disabled: s.energy < 18 },
          { kind: "rest", title: "在档口边歇会儿", emoji: "🧋", desc: "人潮里坐一会儿", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "museum":
        return [
          { kind: "fun", title: loc.funName ?? "看展", emoji: "✨", desc: loc.funDesc ?? "展厅、展柜慢慢看", cost: `-${fmt(loc.funCost ?? 0)} · 心情 +${loc.funMood ?? 18}` },
          { kind: "checkin", title: "拍照打卡", emoji: "📸", desc: "在展厅前打卡", cost: "心情 +12 · 免费" },
          { kind: "rest", title: "在展厅长椅上歇会儿", emoji: "🪑", desc: "看累了就坐一会儿", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "library":
        return [
          { kind: "learn-self", title: "自修", emoji: "📖", desc: "免费自习，慢慢攒技能", cost: "能量 -10 · 技能 +1 · 心情 +2 · 免费", disabled: s.energy < 10 },
          { kind: "fun", title: "借本书", emoji: "📚", desc: "借一本带回家慢慢读", cost: "心情 +6 · 免费" },
          { kind: "rest", title: "在阅览桌边歇会儿", emoji: "🪑", desc: "翻书声里歇一会儿", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "factory":
        return [
          { kind: "work", title: "正经上班", emoji: "🏭", desc: `干一天活拿一天钱 · 职级「${(CAREERS[s.careerIdx] ?? CAREERS[0]!).name}」工资 ×${(CAREERS[s.careerIdx] ?? CAREERS[0]!).mul} · 经验 +2`, cost: `+${fmt(base)} · 能量 -${28 - fitSave}`, disabled: s.energy < 28 - fitSave },
          { kind: "overtime", title: "拼命加班", emoji: "🔥", desc: "订单急，加班费一点五倍，钱多但掉心情", cost: `+${fmt(Math.round(base * 1.75))} · 能量 -${42 - fitSave} · 心情 -12`, disabled: s.energy < 42 - fitSave },
        ];
      default:
        return [];
    }
  };

/* ---------- derived render data ---------- */
const myId = myPub;
const remotePlayers = (world?.online ?? [])
.filter((pl) => pl.cityKey === cityKey && pl.id !== myId)
.map((pl) => ({ id: pl.id, name: pl.name, emoji: pl.emoji, color: pl.color, locId: pl.locId, hair: hairFromLook(pl.look) ?? undefined, accessory: accessoryFromLook(pl.look) ?? undefined }));
const onlineHere = (world?.online ?? []).filter((pl) => pl.cityKey === cityKey);
const timeStr = (iso: string) => new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

const renderHomePanel = (s: GameState) => (
<div className="mt-4 border-t border-[var(--line)] pt-4">
{(() => { const tpl = tplByName(s.homeStyle); const wall = hexCss(tpl?.wall ?? 0xefe9dc); const floor = hexCss(tpl?.floor ?? 0xb8a888); const atHome = currentLoc === "home"; return (
<div className="mb-3">
<button type="button" onClick={() => { publishHome(); setHome3d(true); }} className="mb-2 w-full rounded-full bg-[var(--text)] py-2.5 text-sm font-black text-[var(--bg)]">🏠 {en ? "My home · 3D" : "我的家 · 3D"} <span className="font-bold opacity-75">· {(() => { const T = TIERS[s.cityKey][tierAt(s)]!; return en ? T.en : T.zh; })()}</span></button>
<div className="mb-2 flex flex-wrap gap-1.5"><button type="button" onClick={() => usePlacedFurn("bed-double")} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-black">{en ? "Lie down" : "躺一会儿"}</button><button type="button" onClick={() => usePlacedFurn("kitchen-cabinet")} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-black">{en ? "Cook" : "做饭"}</button><button type="button" onClick={washHome} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-black">{en ? "Wash" : "洗澡"}</button></div>
<div className="grid grid-cols-2 gap-2" role="img" aria-label={`户型图：${homeName(s)}，客厅、卧室、厨房、卫生间四间，已摆 ${s.furniture.length} 件家具，食材 ${s.groceries} 份`}>
{HOME_ROOMS.map((room, ri) => {
const ownedHere = s.furniture.flatMap((id) => { const f = furnById(id); return f && f.room === room.id ? [f] : []; });
const items = [...room.items.slice(0, 4), ...ownedHere.map((f) => ({ emoji: f.emoji, label: f.name }))].slice(0, 8);
return (
<div key={room.id} className="relative overflow-hidden rounded-[12px] border border-[var(--line)] p-2.5" style={{ background: `linear-gradient(165deg, ${wall} 58%, ${floor} 130%)` }}>
<p className="text-xs font-black text-black/75">{room.emoji} {room.name}{room.id === "kitchen" && s.groceries > 0 ? <span className="ml-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] text-white">食材 ×{s.groceries}</span> : null}{room.id === "bedroom" ? <span className="ml-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] text-white">穿着{outfitOf(s.outfit).name}</span> : null}</p>
<div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
{items.map((it) => (<span key={it.label} className="text-[11px] font-bold text-black/65"><span className="text-base">{it.emoji}</span> {it.label}</span>))}
</div>
{room.id === "kitchen" && s.groceries > 0 && <span aria-hidden="true" className="life-steam" style={{ right: 14, top: 22 }}>💨</span>}
<p className="mt-1.5 text-[11px] leading-snug text-black/55">{room.detail}</p>
{ri === 0 && <span className="pointer-events-none absolute -right-1 -top-1 text-[44px] opacity-15">🪟</span>}
</div>
); })}
</div>
<div className="mt-2 grid grid-cols-4 gap-1.5">
<button type="button" aria-label="在厨房做饭" disabled={!atHome || s.groceries <= 0} onClick={() => doAction("cook")} className="rounded-full bg-[var(--text)] px-2 py-2 text-[11px] font-black text-[var(--bg)] disabled:opacity-40">🍳 厨房做饭</button>
<button type="button" aria-label="在卫生间洗漱" disabled={!atHome} onClick={() => doAction("wash")} className="rounded-full bg-[var(--text)] px-2 py-2 text-[11px] font-black text-[var(--bg)] disabled:opacity-40">🪥 卫生间洗漱</button>
<button type="button" aria-label="在客厅躺平" disabled={!atHome} onClick={() => doAction("rest")} className="rounded-full bg-[var(--text)] px-2 py-2 text-[11px] font-black text-[var(--bg)] disabled:opacity-40">🛋️ 客厅躺平</button>
<button type="button" aria-label="回卧室睡觉" disabled={!atHome} onClick={() => playLifeAnim("sleep", () => doSleep())} className="rounded-full bg-[var(--accent)] px-2 py-2 text-[11px] font-black text-white disabled:opacity-40">🛏️ 卧室睡觉</button>
</div>
{!atHome && <p className="mt-1.5 text-[11px] text-[var(--dim)]">房间里的动作要先回到家才能做（现在不在家）。</p>}
<div className="mt-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-xs font-black tracking-wide text-[var(--dim)]">👕 卧室衣柜 · 按场合换装（现在穿：{outfitOf(s.outfit).emoji} {outfitOf(s.outfit).name}）{nowRainy ? " · 今天下雨，出门建议穿雨衣" : ""}</p>
<div className="mt-2 grid gap-1.5">
{OUTFITS.map((o) => {
const ownedO = s.ownedOutfits.includes(o.id);
const wearing = s.outfit === o.id;
return (
<div key={o.id} className="flex items-center gap-2.5 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
<span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg" style={{ background: hexCss(o.shirt) + "33" }}>{o.emoji}</span>
<span className="min-w-0 flex-1"><span className="text-[13px] font-bold">{o.name}</span><span className="block truncate text-[11px] text-[var(--dim)]">{o.desc} · {o.scene}</span></span>
<button type="button" aria-label={wearing ? `正穿着${o.name}` : ownedO ? `换上${o.name}` : `购买并穿上${o.name}`} disabled={wearing || (!ownedO && s.money < o.price)} onClick={() => buyOutfit(o.id)} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-1.5 text-[11px] font-black text-[var(--bg)] disabled:opacity-40">{wearing ? "穿着中" : ownedO ? "换上" : `${fmt(o.price)} 买下`}</button>
</div>
); })}
</div>
</div>
</div> ); })()}
<p className="text-sm font-bold">🏠 {homeName(s)} · 舒适度 {computeComfort(s)} · 周租 {fmt(rentYouPay(s))} · 已购家具 {s.furniture.length} 件</p>
<p className="mt-1 text-xs text-[var(--dim)]">舒适度越高，每天睡醒心情回得越多；家具和风格同款搭配还有额外加成。数据来自 ZhuyaHome 的风格模板、家具目录与材料价。</p>
{/* round-2 (d §5a) report landlord + (g S6) build-your-own-house + (e S5) sublet + (c) pets */}
{(() => { const rep = reportsQuery.data?.reputations.find((r) => r.targetId === `home:${s.cityKey}`); const warn = reputationWarning(rep, en); const mySublet = (subletQuery.data?.listings ?? []).find((l) => l.owner.playerId === profile?.playerId); const others = (subletQuery.data?.listings ?? []).filter((l) => l.owner.playerId !== profile?.playerId);
return (
<div className="mt-3">
{warn && <p className="mb-2 rounded-[12px] border border-[var(--accent)] p-2 text-xs font-bold leading-relaxed">{warn}</p>}
<div className="flex flex-wrap gap-2">
<button type="button" onClick={() => setReportDraft({ kind: "landlord", city: s.cityKey, targetId: `home:${s.cityKey}`, targetName: "房东", body: "", evidence: buildRentEvidence({ baseRent: s.baseRent ?? s.rent, rent: s.rent, rentPaid: s.rentPaid }) })} className="rounded-full border border-[var(--accent)] px-3 py-2 text-xs font-black text-[var(--accent)]">🚨 举报房东（乱涨租 / 扣押金）</button>
<button type="button" onClick={() => setBuildOpen(true)} className="rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">🏗️ 自己盖房子</button>
</div>
<div className="mt-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-black">🔑 转租 <span className="font-normal text-[var(--dim)]">· 把空房间转租出去，收点租金</span></p>
{mySublet ? <p className="mt-1 text-xs">你已挂出：一间房 · {fmt(mySublet.monthlyPrice)}/月 · 押金 {fmt(mySublet.deposit)} · {mySublet.status === "taken" ? `已租给 ${mySublet.tenant?.name ?? ""}` : "待租"}</p>
: <button type="button" onClick={async () => { if (!profile) return; const monthly = Math.round(rentYouPay(s) * 4); const r = postSubletListing(econ.sublets, { owner: { playerId: profile.playerId, name: profile.name }, homeLocId: "home", city: s.cityKey, space: "room", monthlyPrice: monthly, deposit: rentYouPay(s), terms: "包水电网，禁烟，可养猫，押一付一", minDays: 7, maxDays: 0, availableFromDay: s.day, createdDay: s.day }); if (!r.ok || !r.value) { showToast(r.error ?? ""); return; } setEcon((e) => ({ ...e, sublets: r.value!.book })); try { const sr = await api.postSublet({ playerId: profile.playerId, homeLocId: "home", city: s.cityKey, space: "room", monthlyPrice: monthly, deposit: rentYouPay(s), terms: "包水电网，禁烟，可养猫，押一付一", minDays: 7, maxDays: 0, availableFromDay: s.day, ownMonthlyRent: monthly }); if (sr.warning) showToast(sr.warning); } catch { /* local listing already posted */ } showToast(`已挂出转租：${fmt(monthly)}/月，等人来住。`); void subletQuery.refetch(); }} className="mt-2 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">把一间房挂出去（{fmt(Math.round(rentYouPay(s) * 4))}/月）</button>}
{others.slice(0, 3).map((l) => (
<div key={l.id} className="mt-2 flex items-center gap-2">
<p className="min-w-0 flex-1 text-xs">{l.owner.name}的{l.space === "room" ? "一间房" : l.space === "bed" ? "一个床位" : l.space === "sofa" ? "沙发位" : "整套"} · {fmt(l.monthlyPrice)}/月 · 押金 {fmt(l.deposit)}{l.suspicion > 0 ? " · ⚠️ 疑似二房东加价" : ""}</p>
<button type="button" onClick={async () => { if (!profile) return; if (s.money < l.deposit) { showToast("押金不够。"); return; } const local = acceptSubletLocal(econ.sublets, l.id, { playerId: profile.playerId, name: profile.name }, s.day); if (local.ok && local.value) { setEcon((e) => ({ ...e, sublets: local.value!.book })); mutate((x) => { x.money -= local.value!.depositDue; }); } try { const sr = await api.acceptSublet({ playerId: profile.playerId, listingId: l.id }); if (!sr.ok && !(local.ok)) { showToast(sr.error ?? ""); return; } } catch { if (!local.ok) { showToast("网络不太好"); return; } } showToast(`租下了 ${l.owner.name} 的房间，押金 ${fmt(l.deposit)} 已付。`); void subletQuery.refetch(); }} className="shrink-0 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-black">租这间</button>
</div>
))}
</div>
{pets.pets.length > 0 && (
<div className="mt-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-black">🐾 我的宠物</p>
{pets.pets.map((pet) => (
<div key={pet.id} className="mt-2">
<p className="text-sm font-bold">{pet.kind === "cat" ? "🐱" : "🐶"} {pet.name} <span className="font-normal text-[var(--dim)]">· {pet.breed} · 亲密度 {Math.round(pet.stats.affection)} · 饥饿 {Math.round(pet.stats.hunger)} · 心情 {Math.round(pet.stats.mood)}</span></p>
<div className="mt-1.5 flex flex-wrap gap-2">
{(["feed", "play", "pet", "wash"] as InteractionKind[]).map((k) => (
<button key={k} type="button" onClick={() => { const need = k === "feed" ? 12 : k === "wash" ? 30 : 0; if (need > 0 && s.money < need) { showToast("钱不够。"); return; } const r = interactWithPet(pets, pet.id, k); if (!r.ok) { showToast(r.error); return; } if (r.cost > 0) mutate((x) => { x.money -= r.cost; }); setPets({ ...pets, pets: [...pets.pets] }); syncPetsToServer(pets); showToast(`${pet.name}${r.note}`); }} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-black">{k === "feed" ? "🍗 喂食 ¥12" : k === "play" ? "🎾 玩耍" : k === "pet" ? "🤲 摸摸" : "🛁 洗澡 ¥30"}</button>
))}
</div>
</div>
))}
</div>
)}
</div>
); })()}
<p className="mt-3 text-xs font-black tracking-wide text-[var(--dim)]">换个装修风格（ZhuyaHome 模板）</p>
<div className="mt-2 grid gap-2">
{TEMPLATES.map((t) => {
const price = tplQuote(t);
const isCur = s.homeStyle === t.name;
return (
<div key={t.id} className="flex items-start gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<div className="text-2xl">{t.emoji}</div>
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{t.name} <span className="text-[var(--accent)]">{fmt(price)}</span></p>
<p className="text-xs leading-relaxed text-[var(--dim)]">{t.desc}</p>
<p className="mt-1 text-xs text-[var(--dim)]">墙面 {fmt(t.wallPrice)}/㎡ · 地板 {fmt(t.floorPrice)}/㎡ · 装完周租 {fmt(Math.round((s.baseRent * t.rentMul) / 10) * 10)} · 舒适度 {t.comfort}</p>
</div>
<button type="button" aria-label={`换成${t.name}风格`} disabled={isCur || s.money < price} onClick={() => buyTemplate(t.id)} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)] disabled:opacity-40">
{isCur ? "当前风格" : "就它了"}
</button>
</div>
);
})}
</div>
<p className="mt-3 text-xs font-black tracking-wide text-[var(--dim)]">买家具（ZhuyaHome 目录）</p>
<div className="mt-2 grid gap-2">
{FURNITURE.map((f) => {
const owned = s.furniture.includes(f.id);
const match = s.homeStyle != null && f.styles.includes(s.homeStyle);
return (
<div key={f.id} className="flex items-start gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<div className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-2xl" style={{ background: hexCss(f.color) + "33" }}>{f.emoji}</div>
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{f.name} <span className="text-[var(--accent)]">{fmt(f.price)}</span></p>
<p className="text-xs leading-relaxed text-[var(--dim)]">{f.desc}</p>
<p className="mt-1">
{f.styles.map((st) => (
<span key={st} className={`mr-1 inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold ${match && st === s.homeStyle ? "border-green-600 bg-green-100 text-green-900" : "border-[var(--line)] text-[var(--dim)]"}`}>{st}</span>
))}
<span className="text-[11px] text-[var(--dim)]">舒适 +{f.comfort}</span>
</p>
</div>
<button type="button" aria-label={`购买${f.name}`} disabled={owned || s.money < f.price} onClick={() => buyFurniture(f.id)} className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-2 text-xs font-black text-white disabled:opacity-40">
{owned ? "已拥有" : "买"}
</button>
</div>
);
})}
</div>
</div>
);

const renderPhoneApp = (s: GameState, appId: AppId | "trade") => {
const career = CAREERS[s.careerIdx] ?? CAREERS[0]!;
const next = CAREERS[s.careerIdx + 1] ?? null;
switch (appId) {
case "career":
return (
<div>
<p className="text-sm">当前职级：<b>「{career.name}」</b>，工资 ×{career.mul}</p>
<p className="mt-1 text-xs text-[var(--dim)]">经验 {s.xp} · 技能 {s.skill}（上班/兼职攒经验，图书馆/夜校攒技能）</p>
{next ? (
<div className="mt-3">
<p className="text-sm">下一级：<b>「{next.name}」</b>工资 ×{next.mul}，需要经验 {next.needXp} / 技能 {next.needSkill}</p>
<button type="button" onClick={promote} disabled={s.xp < next.needXp || s.skill < next.needSkill} className="mt-3 w-full rounded-full bg-[var(--accent)] py-3 text-sm font-black text-white disabled:opacity-40">
{s.xp >= next.needXp && s.skill >= next.needSkill ? `晋升为「${next.name}」` : "还没达到晋升条件"}
</button>
</div>
) : <p className="mt-3 text-sm">👑 已是最高职级，城市合伙人。</p>}
{(() => { const cur = employerHere(s); const base = basePay(s); return (
<div className="mt-4 border-t border-[var(--line)] pt-3">
<p className="text-sm">现在在：<b>{cur ? `${cur.emoji} ${cur.name}` : "🏭 仲恺公司"}</b> · 日薪 {fmt(Math.round(base * (cur?.payMul ?? 1)))}{companyById(s.employer).id !== (cur?.id ?? "") && companyById(s.employer).id !== "startup" ? `（${companyById(s.employer).short}的工牌在${CITIES[companyById(s.employer).city ?? "sz"].name}用）` : ""}</p>
<p className="mt-0.5 text-xs text-[var(--dim)]">想跳槽：去大厂总部「投简历 · 面试」，条件够就拿 offer，再点「接受 offer」入职。每家每天能面一次。</p>
<div className="mt-2 grid gap-2">
{COMPANIES.filter((c) => (c.city ?? "sz") === s.cityKey && c.id !== cur?.id && c.id !== "startup").map((c0) => { const c = effCompany(c0, todayEvent, s.referrals); const gaps = companyGaps(c, s); const offer = (s.offers ?? []).includes(c.id); const loc = locById(c.locIds[0]!); return (
<div key={c.id} className="flex items-center gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<div className="text-2xl">{c.emoji}</div>
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{c.name} <span className="text-[var(--accent)]">日薪约 {fmt(Math.round(base * c.payMul))}</span></p>
<p className="text-xs text-[var(--dim)]">{offer ? "✅ 已拿到 offer，去总部点「接受 offer」" : gaps.length === 0 ? `✅ 条件够了，可以去面试${c.formal ? "（要穿正装）" : ""}` : `还差：${gaps.join("、")}`} · 上班能量 -{c.energy}{c.mood ? ` · 心情 ${c.mood > 0 ? "+" : ""}${c.mood}` : ""}</p>
</div>
<button type="button" aria-label={`去${loc.name}`} onClick={() => { setPhoneOpen(false); walkTo(loc.id); }} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">去{c.short}</button>
</div>
); })}
</div>
{(() => { const cur2 = employerHere(s); if (!cur2) return null; const rep = reportsQuery.data?.reputations.find((r) => r.targetId === cur2.id); const warn = reputationWarning(rep, en); return (
<div className="mt-3">
{warn && <p className="mb-2 rounded-[12px] border border-[var(--accent)] p-2 text-xs font-bold leading-relaxed">{warn}</p>}
<button type="button" onClick={() => {
  setReportDraft({ kind: "employer", city: s.cityKey, targetId: cur2.id, targetName: cur2.name, body: "", evidence: buildWageEvidence({ companyId: cur2.id, companyName: cur2.name, workCount: s.workCount, otCount: s.otCount, otPayPerShift: Math.round(basePay(s) * 0.5) }) });
}} className="w-full rounded-full border border-[var(--accent)] py-2.5 text-sm font-black text-[var(--accent)]">🚨 举报这家公司（拖欠加班费 / 扣工资）</button>
<p className="mt-1 text-[11px] text-[var(--dim)]">举报会公示给全城玩家陪审：属实就曝光，诬告会扣你自己的信用。</p>
</div>
); })()}
</div>
); })()}
</div>
);
case "jobs":
return (
<div className="grid gap-2">
{OFFERS.map((o, i) => {
const pay = Math.round(basePay(s) * 0.55 * o.mul);
return (
<div key={o.name} className="flex items-center gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{o.name} <span className="text-[var(--accent)]">约 {fmt(pay)}</span></p>
<p className="text-xs text-[var(--dim)]">{o.note} · 能量 -18 · 经验 +1</p>
</div>
<button type="button" aria-label={`接单${o.name}`} disabled={s.energy < 18} onClick={() => acceptOffer(i)} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)] disabled:opacity-40">接单</button>
</div>
);
})}
{(() => { const d = s.delivery ?? emptyDeliveryState(); const p = d.courier; const summary = courierTodaySummary(p, s.day);
const poolGigs: CourierGig[] = (poolQuery.data?.open ?? []).map((o) => poolOrderToGig({
  id: Number(o.id), restaurantId: o.restaurantId, restaurantName: o.restaurantName,
  destId: o.destId ?? "home", destName: o.destName,
  distance: Math.max(1, Math.round(Math.hypot((locById(o.destId ?? "home")?.x ?? 0) - locById(currentLoc).x, (locById(o.destId ?? "home")?.z ?? 0) - locById(currentLoc).z) / 1000 * 10) / 10),
  riderFee: o.riderFee, customerName: o.customerName, deadlineAt: o.deadlineAt,
}));
return (
<div className="mt-3 border-t border-[var(--line)] pt-3">
<p className="text-sm font-black">🛵 跑腿接单 <span className="font-normal text-[var(--dim)]">· 评分 {p.rating.toFixed(1)} · 今天已跑 {summary.count} 单 · 赚 {fmt(summary.earned)} · 准时 {summary.onTimeRate}% · {summary.level.title}</span></p>
{courierBoard.length === 0 && <button type="button" onClick={refreshCourierBoard} className="mt-2 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">刷新接单板</button>}
{d.activeGigs.length > 0 && <div className="mt-2 grid gap-2">
{d.activeGigs.map((g) => (
<div key={g.id} className="rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-bold">{g.shopEmoji} {g.shopName} → {g.destName} · {fmt(g.pay)}{g.surge > 0 ? `（含高峰 +${g.surge}）` : ""}{g.rainBonus > 0 ? `（雨天 +${g.rainBonus}）` : ""}</p>
<p className="text-xs text-[var(--dim)]">{g.stage === "accepted" ? "已接单，去商家取餐" : "已取餐，送往顾客"} · 距离 {g.distance} 公里 · {g.stairs ? "老小区没电梯，要爬楼" : "有电梯"}{g.poolId !== undefined ? " · 真人顾客的单" : ""}</p>
<div className="mt-2 flex gap-2">
{g.stage === "accepted" && <button type="button" onClick={() => courierPickup(g)} className="rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">到店取餐</button>}
{g.stage === "pickedUp" && <button type="button" onClick={() => void courierDeliver(g)} className="rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">确认送达</button>}
<button type="button" onClick={() => courierCancel(g)} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black">取消</button>
</div>
</div>
))}
</div>}
{[...courierBoard.filter((g) => !d.activeGigs.some((a) => a.id === g.id)), ...poolGigs.filter((g) => !d.activeGigs.some((a) => a.id === g.id))].map((g) => (
<div key={g.id} className="mt-2 flex items-center gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{g.shopEmoji} {g.shopName} → {g.destName} <span className="text-[var(--accent)]">{fmt(g.pay)}</span></p>
<p className="text-xs text-[var(--dim)]">距离 {g.distance} 公里 · {g.stairs ? "要爬楼" : "有电梯"}{g.poolId !== undefined ? ` · 真人顾客 ${g.customerName ?? ""}的单` : ""} · {Math.max(0, Math.round((g.deadlineAt - Date.now()) / 60_000))} 分钟内送达</p>
</div>
<button type="button" onClick={() => courierAccept(g)} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">接单</button>
</div>
))}
</div>
); })()}
</div>
);
case "food": {
const d = s.delivery ?? emptyDeliveryState();
const menu = deliveryMenu(s.cityKey, d.myRatings);
const active = activeOrder(d);
const member = membershipActive(d.memberUntilDay, s.day);
const cartTotal = deliveryCart.reduce((sum, c) => { const it = menu.flatMap((r) => r.items).find((i) => i.key === c.key); return sum + (it ? it.cost * c.qty : 0); }, 0);
const cartCount = deliveryCart.reduce((n, c) => n + c.qty, 0);
const addToCart = (it: MenuItem) => setDeliveryCart((c) => {
  const firstRest = c.length ? menu.flatMap((r) => r.items).find((i) => i.key === c[0]!.key)?.restaurantId : undefined;
  if (firstRest && firstRest !== it.restaurantId) return [{ key: it.key, qty: 1 }];
  return [...c, { key: it.key, qty: 1 }];
});
return (
<div>
{active && (
<div className="mb-3 rounded-[12px] border border-[var(--accent)] bg-[var(--bg)] p-3">
<p className="text-sm font-black">🛵 {active.restaurantName} · {active.stage === "placed" ? "已下单，等商家接单" : active.stage === "accepted" ? "商家已接单" : active.stage === "preparing" ? "商家做餐中" : active.stage === "pickedUp" ? `${active.riderName}已取餐，正在送来` : active.stage === "arriving" ? `${active.riderName}快到了` : active.stage === "delivered" ? "已送达，快趁热吃" : "已吃完"}</p>
<p className="text-xs text-[var(--dim)]">{active.items.map((i) => `${i.emoji}${i.name}×${i.qty}`).join("、")} · {fmt(active.total)} · {active.riderEmoji} {active.riderName}</p>
{active.stage !== "eaten" && <p className="mt-0.5 text-xs font-bold text-[var(--accent)]">{fmtDeliveryCountdown(active, Date.now())}</p>}
<div className="mt-2 flex gap-2">
{active.stage === "delivered" && <button type="button" onClick={() => eatDeliveryOrder(active.id)} className="rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">🍽️ 开吃</button>}
{(active.stage === "placed" || active.stage === "accepted" || active.stage === "preparing") && <button type="button" onClick={() => cancelDeliveryOrder(active.id)} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black">取消订单</button>}
</div>
</div>
)}
<div className="mb-2 flex items-center justify-between gap-2">
<p className="text-sm font-black">🍜 点外卖</p>
<button type="button" onClick={buyDeliveryMembership} disabled={member} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[11px] font-black disabled:opacity-50">{member ? `月卡有效到第 ${d.memberUntilDay} 天` : `买月卡 ${fmt(MEMBERSHIP_PRICE)}（30 天免配送费+95 折）`}</button>
</div>
{menu.map((r) => (
<div key={r.id} className="mb-3">
<p className="text-sm font-bold">{r.emoji} {r.name} <span className="font-normal text-[var(--dim)]">· {r.cuisine} · ★{r.rating.toFixed(1)}（{r.ratingCount}）</span></p>
{r.items.map((it) => {
const qty = deliveryCart.find((c) => c.key === it.key)?.qty ?? 0;
return (
<div key={it.key} className="mt-1.5 flex items-center gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-2.5">
<div className="text-xl">{it.emoji}</div>
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{it.name} <span className="text-[var(--accent)]">{fmt(it.cost)}</span></p>
<p className="text-xs text-[var(--dim)]">能量 +{it.energy} · 心情 +{it.mood}</p>
</div>
{qty === 0
? <button type="button" aria-label={`加${it.name}`} onClick={() => addToCart(it)} className="rounded-full bg-[var(--text)] px-3 py-1.5 text-sm font-black text-[var(--bg)]">＋</button>
: <span className="flex items-center gap-1.5">
<button type="button" aria-label="减一件" onClick={() => setDeliveryCart((c) => c.map((x) => x.key === it.key ? { ...x, qty: x.qty - 1 } : x).filter((x) => x.qty > 0))} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-sm font-black">－</button>
<span className="text-sm font-black">{qty}</span>
<button type="button" aria-label="加一件" onClick={() => setDeliveryCart((c) => c.map((x) => x.key === it.key ? { ...x, qty: x.qty + 1 } : x))} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-sm font-black">＋</button>
</span>}
</div>
);
})}
</div>
))}
{cartCount > 0 && (
<div className="sticky bottom-0 mt-3 rounded-[12px] bg-[var(--text)] p-3 text-[var(--bg)]">
<p className="text-sm font-black">已选 {cartCount} 件 · 菜品合计 {fmt(cartTotal)}（配送费按单算）</p>
<button type="button" onClick={() => submitDeliveryOrder(deliveryCart)} className="mt-2 w-full rounded-full bg-[var(--accent)] py-2.5 text-sm font-black text-white">提交订单</button>
</div>
)}
{d.orders.length > 0 && (
<div className="mt-4">
<p className="text-xs font-black text-[var(--dim)]">最近订单</p>
{d.orders.slice(0, 5).map((o) => (
<p key={o.id} className="mt-1 text-xs">{o.restaurantName} · {fmt(o.total)} · {o.stage === "eaten" ? "已吃完" : o.stage === "delivered" ? "已送达" : "进行中"}{o.stage === "delivered" ? <button type="button" onClick={() => eatDeliveryOrder(o.id)} className="ml-2 font-black text-[var(--accent)]">开吃</button> : null}</p>
))}
</div>
)}
</div>
);
}
case "trade": {
const me: PlayerRef = { playerId: profile?.playerId ?? "", name: profile?.name ?? "我" };
const serverTasks = (tradeQuery.data?.tasks ?? []) as unknown as TradeTask[];
const localTasks = searchTradeTasks(econ.tradeTasks, { openOnly: true });
const shown = [...serverTasks, ...localTasks.filter((t) => !serverTasks.some((x) => x.id === t.id))];
const kindLabel = (k: TradeTaskKind) => ({ buy: "求购", sell: "出售", swap: "交换", service: "服务", other: "其他" } as Record<TradeTaskKind, string>)[k] ?? k;
const postTrade = async () => {
  if (!profile) return;
  const price = tradePrice.trim() ? Math.max(0, Math.round(Number(tradePrice))) : undefined;
  const r = postTradeTaskLocal(econ.tradeTasks, { poster: me, kind: tradeKind, title: tradeTitle, body: tradeBody, price, city: s.cityKey, createdDay: s.day });
  if (!r.ok || !r.value) { showToast(r.error ?? "发不出去。"); return; }
  setEcon((e) => ({ ...e, tradeTasks: r.value!.book }));
  setTradeTitle(""); setTradeBody(""); setTradePrice("");
  try { await api.postTradeTask({ playerId: profile.playerId, kind: tradeKind, title: tradeTitle, body: tradeBody, price, city: s.cityKey }); } catch { /* local copy already posted */ }
  void tradeQuery.refetch();
  showToast("交易贴发出去了，等人来接。");
};
const tradeAccept = async (t: TradeTask) => {
  if (!profile || t.poster.playerId === me.playerId) return;
  const local = acceptTradeTaskLocal(econ.tradeTasks, t.id, me);
  if (local.ok && local.value) setEcon((e) => ({ ...e, tradeTasks: local.value!.book }));
  try { const r = await api.acceptTradeTask({ playerId: profile.playerId, taskId: t.id }); if (!r.ok && !local.ok) showToast(r.error ?? ""); } catch { if (!local.ok) showToast("网络不太好"); }
  void tradeQuery.refetch();
};
const tradeEscrow = async (t: TradeTask) => {
  if (!profile || !t.price) return;
  const local = escrowTradeTaskLocal(econ.tradeTasks, t.id, me, t.price);
  if (local.ok && local.value) {
    setEcon((e) => ({ ...e, tradeTasks: local.value!.book }));
    mutate((x) => { x.money -= local.value!.escrowDue; });
  }
  try { await api.escrowTradeTask({ playerId: profile.playerId, taskId: t.id, amount: t.price }); } catch { /* local escrow already recorded */ }
  if (local.ok && local.value) showToast(`已托管 ${fmt(local.value.escrowDue)}：钱先由系统拿着，确认收货后才打给对方。`);
  else showToast(local.error ?? "");
  void tradeQuery.refetch();
};
const tradeComplete = async (t: TradeTask) => {
  if (!profile) return;
  const local = completeTradeTaskLocal(econ.tradeTasks, t.id, me, "");
  if (local.ok && local.value) {
    setEcon((e) => ({ ...e, tradeTasks: local.value!.book }));
    if (local.value.releaseTo?.playerId === me.playerId && local.value.releaseAmount > 0) mutate((x) => { x.money += local.value!.releaseAmount; x.earned += local.value!.releaseAmount; });
  }
  try { await api.completeTradeTask({ playerId: profile.playerId, taskId: t.id }); } catch { /* local copy already completed */ }
  if (local.ok && local.value) showToast(`交易完成：「${t.title}」${local.value.releaseAmount > 0 && local.value.releaseTo?.playerId === me.playerId ? `，托管的 ${fmt(local.value.releaseAmount)} 已打给你。` : "。"}`);
  else showToast(local.error ?? "");
  void tradeQuery.refetch();
};
const tradeCancel = async (t: TradeTask) => {
  if (!profile) return;
  const local = cancelTradeTaskLocal(econ.tradeTasks, t.id, me);
  if (local.ok && local.value) {
    setEcon((e) => ({ ...e, tradeTasks: local.value!.book }));
    if (local.value.refundTo?.playerId === me.playerId && local.value.refundAmount > 0) mutate((x) => { x.money += local.value!.refundAmount; });
  }
  try { await api.cancelTradeTask({ playerId: profile.playerId, taskId: t.id }); } catch { /* local copy already cancelled */ }
  if (local.ok && local.value) showToast(local.value.refundAmount > 0 ? `交易取消，托管的 ${fmt(local.value.refundAmount)} 已退回。` : "交易取消了。");
  else showToast(local.error ?? "");
  void tradeQuery.refetch();
};
const tradeDispute = async (t: TradeTask) => {
  if (!profile) return;
  const local = disputeTradeTaskLocal(econ.tradeTasks, t.id, me, "对方没按约定交货 / 收货");
  if (local.ok && local.value) setEcon((e) => ({ ...e, tradeTasks: local.value!.book }));
  try { await api.disputeTradeTask({ playerId: profile.playerId, taskId: t.id, reason: "对方没按约定交货 / 收货" }); } catch { /* local dispute already recorded */ }
  showToast(local.ok ? "已发起争议：托管的钱冻结了，等双方协商或管理员处理。" : (local.error ?? ""));
  void tradeQuery.refetch();
};
const buyOverseas = async (itemId: string) => {
  if (!profile) return;
  const r = placeOverseasOrderLocal(econ.overseas, me, itemId, 1, s.day);
  if (!r.ok || !r.value) { showToast(r.error ?? "下单失败。"); return; }
  if (s.money < r.value.chargeNow) { showToast("钱不够买这件海淘。"); return; }
  setEcon((e) => ({ ...e, overseas: r.value!.book }));
  mutate((x) => { x.money -= r.value!.chargeNow; });
  try { await api.placeOverseasOrder({ playerId: profile.playerId, itemId, qty: 1 }); } catch { /* local order already placed */ }
  for (const l of r.events) showToast(l);
  void overseasQuery.refetch();
};
const payDuty = async (orderId: string, serverSide: boolean) => {
  if (!profile) return;
  if (serverSide) {
    try {
      const r = await api.payOverseasDuty({ playerId: profile.playerId, orderId });
      if (!r.ok) { showToast(r.error ?? ""); return; }
      if (r.dutyPaid) mutate((x) => { x.money -= r.dutyPaid!; });
      showToast(`关税 ${fmt(r.dutyPaid ?? 0)} 已付，包裹放行了。`);
      void overseasQuery.refetch();
    } catch { showToast("网络不太好"); }
    return;
  }
  const r = payOverseasDutyLocal(econ.overseas, orderId);
  if (!r.ok || !r.value) { showToast(r.error ?? ""); return; }
  setEcon((e) => ({ ...e, overseas: r.value!.book }));
  mutate((x) => { x.money -= r.value!.dutyPaid; });
  for (const l of r.events) showToast(l);
};
return (
<div>
<div className="mb-3 flex gap-2">
<button type="button" onClick={() => setTradeTab("board")} className={`rounded-full px-3 py-2 text-xs font-black ${tradeTab === "board" ? "bg-[var(--text)] text-[var(--bg)]" : "border border-[var(--line)]"}`}>🛒 交易板</button>
<button type="button" onClick={() => setTradeTab("overseas")} className={`rounded-full px-3 py-2 text-xs font-black ${tradeTab === "overseas" ? "bg-[var(--text)] text-[var(--bg)]" : "border border-[var(--line)]"}`}>🌏 海淘</button>
</div>
{tradeTab === "board" ? (
<div>
<div className="mb-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-black">发个交易贴</p>
<p className="text-[11px] text-[var(--dim)]">想买想卖想换、找人帮忙，都可以挂出来。接单后可以托管钱，确认收货才放款；有争议先冻结，等协商。</p>
<div className="mt-2 flex gap-2">
<select value={tradeKind} onChange={(e) => setTradeKind(e.target.value as typeof tradeKind)} className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-2 py-2 text-xs font-black">
<option value="sell">出售</option><option value="buy">求购</option><option value="swap">交换</option><option value="service">服务</option><option value="other">其他</option>
</select>
<input value={tradeTitle} onChange={(e) => setTradeTitle(e.target.value)} placeholder="标题：比如「出闲置电饭煲，九成新」" className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs" />
<input value={tradePrice} onChange={(e) => setTradePrice(e.target.value)} placeholder="价格（留空面议）" inputMode="numeric" className="w-24 rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs" />
</div>
<textarea value={tradeBody} onChange={(e) => setTradeBody(e.target.value)} placeholder="详情：成色、位置、怎么交货……" rows={2} className="mt-2 w-full rounded-[12px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs" />
<button type="button" onClick={() => void postTrade()} disabled={!tradeTitle.trim()} className="mt-2 w-full rounded-full bg-[var(--accent)] py-2.5 text-sm font-black text-white disabled:opacity-40">发布交易贴</button>
</div>
{shown.length === 0 && <p className="text-xs text-[var(--dim)]">现在没人挂单，你发第一贴吧。下面这些是街坊常挂的例子：</p>}
{shown.length === 0 && TRADE_TASK_EXAMPLES.map((t, i) => (
<div key={i} className="mt-2 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-bold">📌 {t.title}</p><p className="text-xs text-[var(--dim)]">{t.body}</p>
</div>
))}
{shown.map((t) => {
const mine = t.poster.playerId === me.playerId;
const involved = mine || t.accepter?.playerId === me.playerId;
return (
<div key={t.id} className="mt-2 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-bold">{kindLabel(t.kind)} · {t.title} {t.price ? <span className="text-[var(--accent)]">{fmt(t.price)}{t.negotiable ? "（可议）" : ""}</span> : <span className="text-[var(--dim)]">面议</span>}</p>
<p className="text-xs text-[var(--dim)]">{t.body}</p>
<p className="mt-1 text-[11px] text-[var(--dim)]">{t.poster.name}{t.accepter ? ` → 已接：${t.accepter.name}` : ""} · {t.status === "open" ? "待接单" : t.status === "accepted" ? "进行中" : t.status === "disputed" ? "争议中（钱已冻结）" : t.status === "completed" ? "已完成" : "已取消"}{t.escrowHeld > 0 ? ` · 已托管 ${fmt(t.escrowHeld)}` : ""}</p>
<div className="mt-2 flex flex-wrap gap-2">
{t.status === "open" && !mine && <button type="button" onClick={() => void tradeAccept(t)} className="rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">接下这单</button>}
{t.status === "accepted" && involved && t.escrowHeld === 0 && t.price && <button type="button" onClick={() => void tradeEscrow(t)} className="rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">托管 {fmt(t.price)}</button>}
{t.status === "accepted" && involved && <button type="button" onClick={() => void tradeComplete(t)} className="rounded-full bg-[var(--accent)] px-3 py-2 text-xs font-black text-white">确认完成</button>}
{t.status === "accepted" && involved && <button type="button" onClick={() => void tradeDispute(t)} className="rounded-full border border-[var(--accent)] px-3 py-2 text-xs font-black text-[var(--accent)]">有争议</button>}
{(t.status === "open" || t.status === "accepted") && involved && <button type="button" onClick={() => void tradeCancel(t)} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black">取消</button>}
</div>
</div>
);
})}
</div>
) : (
<div>
<p className="text-sm font-black">🌏 海淘 <span className="font-normal text-[var(--dim)]">· 运费 ¥25 一单，到海关可能补关税</span></p>
{OVERSEAS_CATALOG.map((item) => (
<div key={item.id} className="mt-2 flex items-center gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<div className="text-2xl">{item.emoji}</div>
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{item.name} <span className="text-[var(--accent)]">{fmt(item.price)}</span></p>
<p className="text-xs text-[var(--dim)]">{item.origin} · 约 {item.shipDaysMin}–{item.shipDaysMax} 天 · 关税约 {Math.round(item.dutyRate * 100)}%</p>
</div>
<button type="button" onClick={() => void buyOverseas(item.id)} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">买 1 件</button>
</div>
))}
<p className="mt-4 text-xs font-black text-[var(--dim)]">我的海淘单</p>
{(overseasQuery.data?.orders ?? []).map((o) => (
<div key={o.id} className="mt-2 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-bold">{o.item.emoji} {o.item.name} ×{o.qty} · {o.status === "arrived" ? "已到货" : o.status === "customs" ? "在海关，等补关税" : o.status === "held" ? "海关抽查中" : o.status === "shipped" ? "在路上了" : "已下单"}</p>
<p className="text-xs text-[var(--dim)]">预计第 {o.etaDay} 天到 · 已付 {fmt(o.paidTotal)}{o.dutyDue > 0 ? ` · 关税 ${fmt(o.dutyDue)}（已付 ${fmt(o.dutyPaid)}）` : ""}</p>
{(o.status === "customs" || o.status === "held") && o.dutyDue - o.dutyPaid > 0 && <button type="button" onClick={() => void payDuty(o.id, true)} className="mt-2 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">补关税 {fmt(o.dutyDue - o.dutyPaid)}</button>}
</div>
))}
{econ.overseas.orders.filter((o) => !(overseasQuery.data?.orders ?? []).some((x) => x.id === o.id)).map((o) => (
<div key={o.id} className="mt-2 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-bold">{o.item.emoji} {o.item.name} ×{o.qty} · {o.status === "arrived" ? "已到货" : o.status === "customs" ? "在海关，等补关税" : o.status === "held" ? "海关抽查中" : o.status === "shipped" ? "在路上了" : "已下单"}</p>
<p className="text-xs text-[var(--dim)]">预计第 {o.etaDay} 天到 · 已付 {fmt(o.paidTotal)}{o.dutyDue > 0 ? ` · 关税 ${fmt(o.dutyDue)}（已付 ${fmt(o.dutyPaid)}）` : ""}</p>
{(o.status === "customs" || o.status === "held") && o.dutyDue - o.dutyPaid > 0 && <button type="button" onClick={() => void payDuty(o.id, false)} className="mt-2 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">补关税 {fmt(o.dutyDue - o.dutyPaid)}</button>}
</div>
))}
</div>
)}
</div>
);
}
case "taxi":
return (
<div className="grid max-h-[46vh] gap-2 overflow-y-auto pr-1">
{getLocations(s.cityKey).map((l) => (
<button key={l.id} type="button" onClick={() => taxiTo(l.id)} disabled={l.id === currentLoc} className="act-btn disabled:opacity-40">
<span className="text-sm font-bold">{l.emoji} {l.name}</span>
<span className="block text-xs text-[var(--dim)]">{l.id === currentLoc ? "你在这里" : `打车 ${Y}${taxiFare(Math.hypot(l.x - locById(currentLoc).x, l.z - locById(currentLoc).z))}（按距离），立刻到达`}</span>
</button>
))}
</div>
);
case "bank":
return (
<div>
<p className="text-sm">存款 <b>{fmt(s.money)}</b> · 理财 <b>{fmt(s.invest)}</b></p>
<p className="mt-1 text-xs text-[var(--dim)]">理财每晚约 +0.4%，小概率波动亏损约 3%。</p>
<div className="mt-3 grid grid-cols-2 gap-2">
<button type="button" disabled={s.money < 1000} onClick={() => { mutate((x) => { x.money -= 1000; x.invest += 1000; }); showToast(`买入理财 ${fmt(1000)}。`); }} className="rounded-full bg-[var(--text)] py-3 text-sm font-black text-[var(--bg)] disabled:opacity-40">买理财 {fmt(1000)}</button>
<button type="button" disabled={s.invest <= 0} onClick={() => { mutate((x) => { const a = x.invest; x.money += a; x.invest = 0; }); showToast("理财已全部取出。"); }} className="rounded-full border-2 border-[var(--text)] py-3 text-sm font-black disabled:opacity-40">全部取出</button>
</div>
</div>
);
case "social":
return (
<div>
<p className="text-xs font-black tracking-wide text-[var(--dim)]">同城真人（{onlineHere.length} 人在线）</p>
<div className="mt-2 flex flex-wrap gap-1.5">
{onlineHere.length === 0 && <span className="text-xs text-[var(--dim)]">暂时只有你一个人在线，去聊天频道喊一声。</span>}
{onlineHere.map((pl) => (
<span key={pl.id} className="chip">{pl.emoji} {pl.name}{pl.id === myId ? "（你）" : ""} · {locById(pl.locId).short}</span>
))}
</div>
<p className="mt-4 text-xs font-black tracking-wide text-[var(--dim)]">街坊邻居（每个人都有性格、心情和记性——你帮过谁、得罪过谁，他们都记得）</p>
<div className="mt-2 grid gap-2">
{npcsForCity(s.cityKey).map((n) => {
const mem = memOf(s.npcMem ?? {}, n.name);
const p = personaOf(n);
return (
<div key={n.name} className="flex items-start gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<div className="text-2xl">{n.emoji}</div>
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{n.name} <span className="font-normal text-[var(--dim)]">· {n.job}</span> <span className="chip ml-1">{moodEmoji(mem.mood)} {moodWord(mem.mood)}</span> <span className="chip">{relLabel(mem.rel)}{mem.rel !== 0 ? ` ${mem.rel > 0 ? "+" : ""}${mem.rel}` : ""}</span></p>
<p className="text-xs leading-relaxed text-[var(--dim)]">{n.line}</p>
<p className="text-[11px] text-[var(--dim)]">穿着：{n.outfit}</p>
<p className="text-[11px] text-[var(--dim)]">作息：{scheduleOf(n)}</p>
<p className="text-[11px] text-[var(--dim)]">性格：{p.warmth >= 0.65 ? "热心肠" : p.warmth <= 0.35 ? "慢热" : "随和"} · {p.humor >= 0.55 ? "开得起玩笑" : p.pride >= 0.6 ? "要面子，别乱开玩笑" : "不太爱开玩笑"} · {p.chattiness >= 0.6 ? "话多，爱发动态" : p.chattiness <= 0.35 ? "话少" : "话量适中"}</p>
{mem.note ? <p className="text-[11px] font-bold text-[var(--accent2)]">🧠 他记得：{mem.note}</p> : mem.talks > 0 ? <p className="text-[11px] text-[var(--dim)]">聊过 {mem.talks} 次，还没什么特别的事</p> : null}
{(() => { const st0 = storyOf(n.name); if (!st0) return null; const k = storyStatus(st0, s.story?.[n.name], mem.rel, s.day); return <p className={`text-[11px] font-bold ${k.kind === "ready" || k.kind === "ending" ? "text-[var(--accent)]" : "text-[var(--dim)]"}`}>{en ? `📖 "${L(st0.title)}" ${k.kind === "done" ? `· Ending: ${L(k.title)}` : k.kind === "ending" ? "· The ending is ready!" : k.kind === "ready" ? `· Chapter ${k.idx + 1} is ready!` : k.kind === "tomorrow" ? "· More tomorrow" : `· Bond +${k.need} unlocks the next chapter`}` : `📖「${st0.title}」${k.kind === "done" ? `· 结局：${k.title}` : k.kind === "ending" ? "· 结局可以看了！" : k.kind === "ready" ? `· 第 ${k.idx + 1} 章可以看了！` : k.kind === "tomorrow" ? "· 明天有后续" : `· 关系到 +${k.need} 解锁下一章`}`}</p>; })()}
</div>
<button type="button" aria-label={`找${n.name}聊天`} onClick={() => { setPhoneOpen(false); openNpcChat(n.name); }} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">
💬 聊天
</button>
</div>
); })}
</div>
<p className="mt-3 text-[11px] leading-relaxed text-[var(--dim)]">他们每天还会在右侧「🧑‍🤝‍🧑 街坊墙」发动态、互相评论——天气、峰会、你升职这种大事，他们都会聊。聊天、帮忙、送礼物都会被记住，第二天打招呼就不一样。</p>
{/* round-2 (c): community — strays, lost & found, snakes, fishing */}
<div className="mt-4 border-t border-[var(--line)] pt-3">
<p className="text-sm font-black">🐾 街坊互助 <span className="font-normal text-[var(--dim)]">· 流浪猫狗、寻物启事、蛇出没、钓点</span></p>
{(straysQuery.data?.strays ?? []).map((stray) => (
<div key={stray.id} className="mt-2 flex items-center gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<div className="text-2xl">{stray.kind === "cat" ? "🐱" : "🐶"}</div>
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{stray.appearance} <span className="font-normal text-[var(--dim)]">· {stray.pin.locName} · 信任 {stray.trust}</span></p>
<p className="text-xs text-[var(--dim)]">{stray.temper === "friendly" ? "很亲人" : stray.temper === "shy" ? "有点怕人" : "很警惕"} · 信任到 70 可以收养</p>
</div>
<button type="button" onClick={async () => { if (!profile) return; const local = feedStrayLocal(stray); try { const r = await api.feedStray({ playerId: profile.playerId, strayId: stray.id, gameDay: s.day }); showToast(r.note ?? local.note); } catch { showToast(local.note); } void straysQuery.refetch(); }} className="shrink-0 rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black">🍗 喂食</button>
{stray.trust >= 70 && !stray.adopted && <button type="button" onClick={async () => { if (!profile) return; const name = stray.kind === "cat" ? "橘子" : "阿黄"; const input = strayToAdoptInput(stray, name, s.day); if (!input) { showToast("还收养不了，再喂几天。"); return; } try { const r = await api.adoptStray({ playerId: profile.playerId, strayId: stray.id, petName: name, gameDay: s.day }); if (!r.ok) { showToast(r.error ?? ""); return; } } catch { /* server unreachable — keep the local adoption */ } const ar = adoptPet(pets, input); if (!ar.ok) { showToast(ar.error); return; } setPets({ ...pets, pets: [...pets.pets] }); syncPetsToServer(pets, stray.id); showToast(`🏠 ${name}跟你回家了！`); void straysQuery.refetch(); }} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">🏠 收养</button>}
</div>
))}
{(noticesQuery.data?.notices ?? []).slice(0, 5).map((n) => (
<p key={n.id} className="mt-2 text-xs"><span className="font-black">{n.kind === "lost-pet" || n.kind === "lost-item" ? "🔍 寻" : "📦 拾"} {n.title}</span> · {n.body} <span className="text-[var(--dim)]">（{n.pin.locName} · {n.authorName}）</span></p>
))}
<div className="mt-2 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-black">贴个寻物 / 招领</p>
<div className="mt-2 flex gap-2">
<select value={noticeKind} onChange={(e) => setNoticeKind(e.target.value as typeof noticeKind)} className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-2 py-2 text-xs font-black">
<option value="lost-pet">丢了宠物</option><option value="lost-item">丢了东西</option><option value="found-pet">捡到宠物</option><option value="found-item">捡到东西</option>
</select>
<input value={noticeTitle} onChange={(e) => setNoticeTitle(e.target.value)} placeholder="标题（30 字内）" className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs" />
</div>
<input value={noticeBody} onChange={(e) => setNoticeBody(e.target.value)} placeholder="特征描述（200 字内）" className="mt-2 w-full rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs" />
<button type="button" onClick={async () => { if (!profile) return; const loc = locById(currentLoc); const v = validateNotice({ kind: noticeKind, title: noticeTitle, body: noticeBody, cityKey: s.cityKey, pin: { locId: currentLoc, locName: loc.name } }); if (!v.ok) { showToast(v.error ?? ""); return; } const notice = buildNotice({ kind: noticeKind, title: noticeTitle, body: noticeBody, cityKey: s.cityKey, pin: { locId: currentLoc, locName: loc.name } }, { id: profile.playerId, name: profile.name }); try { const r = await api.postNotice({ playerId: profile.playerId, kind: notice.kind, cityKey: s.cityKey, title: notice.title, body: notice.body, locId: notice.pin.locId, locName: notice.pin.locName }); if (!r.ok) { showToast(r.error ?? ""); return; } } catch { showToast("网络不太好"); return; } setNoticeTitle(""); setNoticeBody(""); showToast("启事贴出去了，全城都能看到。"); void noticesQuery.refetch(); }} disabled={!noticeTitle.trim()} className="mt-2 w-full rounded-full bg-[var(--accent)] py-2.5 text-sm font-black text-white disabled:opacity-40">贴出去（以你现在的位置为准）</button>
</div>
{(snakesQuery.data?.warnings ?? []).slice(0, 3).map((w) => (
<p key={w.id} className="mt-2 text-xs">🐍 {w.speciesGuess || "蛇"} · {w.description} <span className="text-[var(--dim)]">（{w.pin.locName}）</span></p>
))}
<div className="mt-2 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-black">🐍 看到蛇了？报一下，提醒邻居</p>
<div className="mt-2 flex gap-2">
<input value={snakeSpecies} onChange={(e) => setSnakeSpecies(e.target.value)} placeholder="大概是什么蛇（可空）" className="w-32 rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs" />
<input value={snakeDesc} onChange={(e) => setSnakeDesc(e.target.value)} placeholder="大小、颜色、在哪儿" className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs" />
</div>
<button type="button" onClick={async () => { if (!profile) return; const loc = locById(currentLoc); const v = validateSnakeReport({ speciesGuess: snakeSpecies, description: snakeDesc, cityKey: s.cityKey, pin: { locId: currentLoc, locName: loc.name } }); if (!v.ok) { showToast(v.error ?? ""); return; } try { const r = await api.reportSnake({ playerId: profile.playerId, cityKey: s.cityKey, locId: currentLoc, locName: loc.name, x: loc.x, z: loc.z, speciesGuess: snakeSpecies, description: snakeDesc }); if (!r.ok) { showToast(r.error ?? ""); return; } } catch { showToast("网络不太好"); return; } setSnakeSpecies(""); setSnakeDesc(""); showToast("已上报，附近的人都会收到提醒。"); void snakesQuery.refetch(); }} disabled={!snakeDesc.trim() && !snakeSpecies.trim()} className="mt-2 w-full rounded-full bg-[var(--accent)] py-2.5 text-sm font-black text-white disabled:opacity-40">上报蛇出没（以你现在的位置为准）</button>
</div>
{(fishingQuery.data?.spots ?? []).slice(0, 3).map((f) => (
<p key={f.id} className="mt-2 text-xs">🎣 {f.catchDesc} <span className="text-[var(--dim)]">（{f.pin.locName} · {f.reporterName}）</span></p>
))}
<div className="mt-2 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-black">🎣 分享个钓点</p>
<input value={fishDesc} onChange={(e) => setFishDesc(e.target.value)} placeholder="钓到了什么？空军也可以写！" className="mt-2 w-full rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs" />
<button type="button" onClick={async () => { if (!profile) return; const loc = locById(currentLoc); const v = validateFishingSpot({ catchDesc: fishDesc, cityKey: s.cityKey, pin: { locId: currentLoc, locName: loc.name } }); if (!v.ok) { showToast(v.error ?? ""); return; } try { const r = await api.reportFishingSpot({ playerId: profile.playerId, cityKey: s.cityKey, locId: currentLoc, locName: loc.name, x: loc.x, z: loc.z, catchDesc: fishDesc }); if (!r.ok) { showToast(r.error ?? ""); return; } } catch { showToast("网络不太好"); return; } setFishDesc(""); showToast("钓点分享出去了。"); void fishingQuery.refetch(); }} disabled={!fishDesc.trim()} className="mt-2 w-full rounded-full bg-[var(--accent)] py-2.5 text-sm font-black text-white disabled:opacity-40">分享钓点（以你现在的位置为准）</button>
</div>
</div>
{/* round-2 (d): black landlord / company jury + exposure */}
<div className="mt-4 border-t border-[var(--line)] pt-3">
<p className="text-sm font-black">⚖️ 黑房东 / 黑公司公示 <span className="font-normal text-[var(--dim)]">· 全城玩家陪审，属实就曝光</span></p>
{(reportsQuery.data?.jury ?? []).map((r) => (
<div key={r.id} className="mt-2 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-bold">{r.kind === "landlord" ? "🏠 房东" : "🏭 公司"} {r.targetName} <span className="font-normal text-[var(--dim)]">· {r.reporter.name} 举报</span></p>
<p className="text-xs text-[var(--dim)]">{r.body}</p>
<p className="mt-1 text-[11px]">{jurySummary(r.votes, en)}</p>
{r.myVote ? <p className="text-[11px] font-bold">你已投：{r.myVote === "uphold" ? "属实" : "不属实"}</p> : (
<div className="mt-2 flex gap-2">
<button type="button" onClick={() => void voteBlack(r, "uphold")} className="rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">👍 属实</button>
<button type="button" onClick={() => void voteBlack(r, "reject")} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black">👎 不属实</button>
</div>
)}
</div>
))}
{(reportsQuery.data?.mine ?? []).filter((r) => r.status !== "open").map((r) => (
<div key={r.id} className="mt-2 rounded-[12px] border border-[var(--accent)] bg-[var(--bg)] p-3">
<p className="text-sm font-bold">我的举报：{r.targetName} · {r.status === "upheld" ? "✅ 陪审团判属实" : r.status === "rejected" ? "❌ 陪审团判不属实" : r.status}</p>
<p className="text-xs text-[var(--dim)]">{jurySummary(r.votes, en)}</p>
<button type="button" onClick={() => void claimBlack(r)} className="mt-2 rounded-full bg-[var(--accent)] px-3 py-2 text-xs font-black text-white">领取裁决结果</button>
</div>
))}
{(reportsQuery.data?.exposed ?? []).slice(0, 5).map((r) => (
<p key={r.id} className="mt-2 text-xs">⛔ 已曝光：{r.targetName}（{r.kind === "landlord" ? "黑房东" : "黑公司"}）· {jurySummary(r.votes, en)}</p>
))}
{(!reportsQuery.data || (reportsQuery.data.jury.length === 0 && reportsQuery.data.mine.length === 0 && reportsQuery.data.exposed.length === 0)) && <p className="mt-2 text-xs text-[var(--dim)]">现在没有待审的举报。房东乱涨租、公司拖欠加班费，都可以在住房面板 / 职业面板里举报。</p>}
</div>
{/* round-2 (g S7): police patrol — local-only this round (no server endpoint) */}
<div className="mt-4 border-t border-[var(--line)] pt-3">
<p className="text-sm font-black">👮 巡逻 <span className="font-normal text-[var(--dim)]">· 本轮只在本地生效</span></p>
{isWatched(myId) && <p className="mt-1 text-xs font-bold text-[var(--accent)]">👁️ 有人在看着你（巡逻中的玩家）</p>}
<button type="button" onClick={() => {
  if (!profile) return;
  if (patrolling) { stopPatrol(profile.playerId); setPatrolling(false); showToast("巡逻结束了。"); return; }
  if (!startPatrol(profile.playerId, s.cityKey)) { showToast("巡逻开不起来（你的游戏 ID 不合规）。"); return; }
  setPatrolling(true); showToast("👮 开始巡逻：在线玩家列表里可以盯人，盯上的人会看到 👁️。");
}} className={`mt-2 rounded-full px-3 py-2 text-xs font-black ${patrolling ? "border border-[var(--accent)] text-[var(--accent)]" : "bg-[var(--text)] text-[var(--bg)]"}`}>{patrolling ? "结束巡逻" : "开始巡逻"}</button>
{patrolling && onlineHere.filter((pl) => pl.id !== myId).map((pl) => (
<p key={pl.id} className="mt-2 text-xs">{pl.emoji} {pl.name} · {locById(pl.locId).short} {isGameAvatarId(pl.id) ? <button type="button" onClick={() => { const rec = observe(pl.id); if (rec) showToast(`正在盯着 ${pl.name}，他/她会看到 👁️。`); else showToast("盯不上这个人。"); }} className="ml-1 font-black text-[var(--accent)]">👁️ 盯着</button> : null}</p>
))}
</div>
</div>
);
case "cal": {
const days = Array.from({ length: seasonLen }, (_, i) => i + 1);
return (
<div>
<div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-[var(--dim)]">
{["一", "二", "三", "四", "五", "六", "日"].map((d) => <div key={d}>周{d}</div>)}
</div>
<div className="mt-1 grid grid-cols-7 gap-1">
{days.map((d) => (
<div key={d} className={`rounded-[8px] border px-0 py-1.5 text-center text-xs font-bold ${d === s.day ? "border-[var(--accent)] bg-[var(--accent)] text-white" : isApecWeek(d) && s.cityKey === "sz" ? "border-[var(--gold)] bg-[#fdf3d0] text-[#7a5b00]" : "border-[var(--line)]"}`}>
{d}
<div className="text-[9px] font-normal opacity-80">{isSaturday(d) ? "交租" : isApecWeek(d) && s.cityKey === "sz" ? "峰会" : weekday(d).replace("周", "")}</div>
</div>
))}
</div>
<p className="mt-2 text-xs text-[var(--dim)]">{isApecSeason() ? "本月就是 11 月：14 日湾区峰会周开启，16 日太子湾欢迎晚宴，17–18 日前海工商峰会，18–19 日香蜜湖峰会主会议。每周六睡前交租。" : `本赛季是 ${seasonMo} 月：月底全服结算。每周六睡前交租。`}</p>
</div>
);
}
case "weather":
return (
<div className="grid gap-1.5">
<div className="rounded-[12px] border-2 border-[var(--accent2)] bg-[var(--bg)] px-3 py-2.5">
<p className="flex items-center justify-between text-sm font-black"><span>🌍 {city.name} · 此刻真实天气</span><button type="button" aria-label="刷新真实天气" onClick={() => weatherQuery.refetch()} className="rounded-full bg-[var(--accent2)] px-2.5 py-1 text-[11px] font-black text-white">刷新</button></p>
{rwOk ? (
<>
<p className="mt-1 text-sm">{RW_EMOJI[realWeather!.kind]} <b>{realWeather!.description || RW_LABEL[realWeather!.kind]}</b>{realWeather!.temperature != null && <> · {Math.round(realWeather!.temperature)}{realWeather!.unit}</>}{realWeather!.feelsLike != null && <> · 体感 {Math.round(realWeather!.feelsLike)}°</>}{realWeather!.high != null && realWeather!.low != null && <> · 今日 {Math.round(realWeather!.low)}°~{Math.round(realWeather!.high)}°</>}</p>
<p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">{realWeather!.humidity != null ? `湿度 ${Math.round(realWeather!.humidity)}% · ` : ""}{realWeather!.wind ? `风：${realWeather!.wind} · ` : ""}{realWeather!.sunrise ? `日出 ${realWeather!.sunrise.match(/T(\d{2}:\d{2})/)?.[1] ?? realWeather!.sunrise} · ` : ""}{realWeather!.sunset ? `日落 ${realWeather!.sunset.match(/T(\d{2}:\d{2})/)?.[1] ?? realWeather!.sunset}` : ""}</p>
{realWeather!.summary && <p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">{realWeather!.summary}</p>}
{realWeather!.alerts.length > 0 && <p className="mt-1 text-xs font-bold text-[var(--accent)]">⚠️ {realWeather!.alerts.join("；")}</p>}
<p className="mt-1 text-[11px] text-[var(--dim)]">游戏里的天色按{city.name}当地真实时间走，云、雨、雾也跟着实况——下雨天记得穿雨衣。数据：{realWeather!.sourceName} · {new Date(realWeather!.fetchedAt).toLocaleString("zh-CN")} 更新{realWeather!.stale ? "（网络不通，这是上次的缓存）" : ""}</p>
{realWeather!.forecast.length > 0 && (
<div className="mt-2 grid gap-1">
{realWeather!.forecast.slice(0, 5).map((f, i) => (
<p key={i} className="flex justify-between rounded-[8px] bg-[var(--surface2)] px-2.5 py-1.5 text-xs"><span>{f.date ?? `+${i} 天`}</span><span className="font-bold">{f.summary ?? ""}{f.high != null && f.low != null ? ` · ${Math.round(f.low)}°~${Math.round(f.high)}°` : ""}{f.precipitationChance != null ? ` · 降水 ${Math.round(f.precipitationChance)}%` : ""}</span></p>
))}
</div>
)}
</>
) : (
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">真实天气暂时取不到（网络或服务问题）。游戏不会编一个假天气糊弄你——先按无雨晴天玩，网络恢复后点「刷新」。</p>
)}
</div>
<p className="mt-1 text-[11px] font-black tracking-wide text-[var(--dim)]">游戏内日历（{seasonMo} 月赛季的剧情天气，和上面的实况是两回事）</p>
{Array.from({ length: 7 }, (_, i) => s.day + i).filter((d) => d <= seasonLen).map((d) => (
<p key={d} className="flex justify-between rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm">
<span>{seasonMo} 月 {d} 日 · {weekday(d)}{d === s.day ? "（今天）" : ""}</span><b>{weatherOf(d, s.cityKey)}</b>
</p>
))}
</div>
);
case "ledger":
return (
<div className="grid gap-1.5 text-sm">
{[
["累计收入", fmt(s.earned)], ["已交房租", fmt(s.rentPaid)], ["装修 + 家具", fmt(s.homeSpent)],
["理财余额", fmt(s.invest)], ["上班次数", `${s.workCount} 次`], ["加班次数", `${s.otCount} 次`],
["干饭次数", `${s.mealCount} 次`], ["最高存款", fmt(s.maxMoney)], ["峰会服务", `${s.apecCount} 次`], [s.cityKey === "hz" ? "坐城轨/高铁" : s.cityKey === "hk" ? "坐港铁" : "坐地铁", `${s.metroRides ?? 0} 次`], ["风景打卡", `${(s.visitedScenic ?? []).length} / ${scenicTotal(s.cityKey)} 处`],
].map(([k, v]) => (
<p key={k} className="flex justify-between rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2"><span className="text-[var(--dim)]">{k}</span><b>{v}</b></p>
))}
</div>
);
case "map":
return (
<div className="grid max-h-[46vh] gap-2 overflow-y-auto pr-1">
{getLocations(s.cityKey).map((l) => (
<button key={l.id} type="button" onClick={() => { setPhoneOpen(false); walkTo(l.id); }} className="act-btn">
<span className="text-sm font-bold">{l.emoji} {l.name}</span>
<span className="block text-xs text-[var(--dim)]">{l.id === currentLoc ? "你在这里" : "走路过去"}</span>
</button>
))}
</div>
);
case "apec": {
const ph = apecPhase(s.day);
const venues = getLocations("sz").filter((l) => l.type === "apec");
return (
<div>
<p className="text-sm font-bold">🌐 {ph.label}</p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{ph.detail}</p>
<div className="mt-3 grid gap-2">
{venues.map((v) => (
<p key={v.id} className="flex items-center justify-between rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm">
<span>{v.emoji} {v.name}</span><b>{apecVenueMul(s.day, v.id) > 1 ? `今日 ×${apecVenueMul(s.day, v.id)}` : "平日价"}</b>
</p>
))}
</div>
<p className="mt-4 text-sm font-bold">🎉 峰会周活动 · {APEC_SLOGAN}</p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">每天一个任务：先坐地铁到会场打卡，再以志愿者 / 记者 / 司机身份上岗（闭门会议不对公众开放）。进度：任务 {(s.apecTasks ?? []).length} / {APEC_TASKS.length} · 打卡 {(s.apecCheckins ?? []).length} / 3{(s.apecTasks ?? []).length >= APEC_TASKS.length ? ` · ${APEC_CERT_NAME}已到手，结算时亮出来` : ""}</p>
<div className="mt-2 grid gap-2">
{APEC_TASKS.map((t) => {
const venue = venues.find((v) => v.id === t.venueLocId);
const done = (s.apecTasks ?? []).includes(t.id);
const checked = (s.apecCheckins ?? []).includes(t.venueLocId);
const status = done ? "✅ 已完成" : t.day === s.day ? (checked ? "🎽 已打卡，去会场上岗" : "📍 今天的班，先去打卡") : t.day < s.day ? "⌛ 已错过" : "🗓️ 还没到日子";
return (
<div key={t.id} className="rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2">
<p className="flex items-center justify-between gap-2 text-sm"><span className="font-bold">{t.dateLabel} · {t.title}</span><span className="shrink-0 text-xs font-black">{status}</span></p>
<p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">{t.event}｜{t.roleEmoji} {t.role}｜{venue ? `${venue.emoji} ${venue.name}` : ""}{checked ? "｜📸 已打卡" : ""}</p>
{s.cityKey === "sz" && t.day === s.day && !done && (
<button type="button" aria-label={`坐地铁前往${venue?.name ?? "会场"}做今日任务`} onClick={() => { setPhoneOpen(false); walkTo(t.venueLocId, "metro"); }} className="mt-1.5 rounded-full bg-[var(--accent2)] px-3 py-1.5 text-[11px] font-black text-white">🚇 坐地铁去{venue?.short ?? "会场"}</button>
)}
</div>
);
})}
</div>
<p className="mt-3 text-xs leading-relaxed text-[var(--dim)]">日程：湾区国际峰会周 11 月 14 日开启；欢迎晚宴 16 日晚在南山太子湾海景酒店；工商峰会 17–18 日在前海国际会议中心；峰会主会议 18–19 日在福田香蜜湖的深圳国际交流中心。各方嘉宾云集（虚构活动，不代表任何真实会议）。峰会周不对公众开放——游戏里你只能以志愿者、会务、接待、司机身份参与，这也是现实里普通人参与的方式。{s.cityKey === "hz" ? "惠州没有会场，但峰会周深圳游客多，温泉酒店和巽寮湾的兼职会更旺（×1.3）；想做活动任务，去深圳开一局。" : ""}</p>
</div>
);
}
case "metro": {
const lines = metroLinesForCity(s.cityKey);
const hereLines = linesForLoc(s.cityKey, currentLoc);
const dests = allMetroDestinations(s.cityKey, currentLoc);
return (
<div>
<p className="text-sm font-bold">{s.cityKey === "sz" ? "🚇 深圳地铁全线网" : s.cityKey === "hk" ? "🚇 香港港铁全线网 MTR" : "🚆 惠州城轨 + 城际高铁线网"} · 已坐 {s.metroRides ?? 0} 次</p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">全部线路都画在3D地图上了（彩色线+站点）。选「{s.cityKey === "hz" ? "城际" : s.cityKey === "hk" ? "港铁" : "地铁"}」出行或在下面点目的地，就会进站走进车厢真实乘车：看拥挤程度、听报站、站站停靠，还能看手机、让座。{s.cityKey === "hz" ? "惠州没有地铁，市内靠公交、打车、骑行，轨道只有莞惠城际和赣深/厦深/广汕高铁。注意：城际的惠州北站和高铁的惠州南站是两个站，中间靠接驳巴士相连——路线规划会自动把这段接驳算进去，城轨和高铁全网连通。" : s.cityKey === "hk" ? "香港只有港铁，没有「地铁」这个说法：十条重铁线加机场快线，八达通一拍入闸。西九龙站和九龙站是两个站，中间靠行人通道相连——路线规划会自动把这段接驳算进去。回深圳过关：东铁线到罗湖，或高铁从西九龙站直达深圳北。" : "注意：去惠州的高铁在深圳北站坐，半小时到惠州南站；惠州没有地铁，市内靠城际和公交。"}</p>
{hereLines.length > 0 ? <p className="mt-2 text-xs font-bold">你所在的 {locById(currentLoc).name} 经过：{hereLines.map((l) => l.short).join("、")}</p> : <p className="mt-2 text-xs text-[var(--dim)]">{s.cityKey === "hz" ? "你现在不在城轨站旁：用「城际」出行方式点任意地点，会先带你走到最近的车站上车，目的地没站也会在最近的站下车再走过去。" : s.cityKey === "hk" ? "你现在不在港铁站旁：用「港铁」出行方式点任意地点，会先带你走到最近的车站上车，目的地没站也会在最近的站下车再走过去。" : "你现在不在地铁站旁：用「地铁」出行方式点任意地点，会先带你走到最近的车站上车，目的地没站也会在最近的站下车再走过去。"}</p>}
{dests.length > 0 && (
<div className="mt-3">
<p className="text-xs font-black tracking-wide text-[var(--dim)]">从这里坐{s.cityKey === "hz" ? "城轨/高铁" : s.cityKey === "hk" ? "港铁" : "地铁/城轨"}能到（含换乘，一次坐到底）</p>
<div className="mt-2 grid max-h-[30vh] gap-2 overflow-y-auto pr-1">
{dests.map(({ locId, route }) => (
<button key={locId} type="button" onClick={() => { setPhoneOpen(false); startMetroRide(currentLoc, locId); }} className="act-btn">
<span className="text-sm font-bold">{locById(locId).emoji} {locById(locId).name} <span style={{ color: route.line.colorCss }}>● {route.summary}</span></span>
<span className="block text-xs text-[var(--dim)]">{route.stops} 站{route.isTransfer ? ` · 在 ${route.transferStations.join("、")} 换乘` : ""}{route.shuttleFrom.length > 0 ? " · 含站外接驳巴士" : ""} · 票价 {Y}{Math.round(route.fare * policyRef.current.metro)} · 点这里进车厢</span>
</button>
))}
</div>
</div>
)}
<div className="mt-3 grid gap-1.5">
{lines.map((l) => (
<p key={l.id} className="flex items-start gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs"><span className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: l.colorCss }} /><span><b>{l.name}</b><br /><span className="text-[var(--dim)]">{l.stations.map((st) => st.name).join(" → ")}</span></span></p>
))}
</div>
</div>
);
}
case "home":
return renderHomePanel(s);
default:
return null;
}
};

/* ================= SETUP ================= */
/* 用户协议 / 隐私政策弹窗：开始页和游戏里都用 */
const legalModal = () => (legalDoc && (() => { const doc = (legalDoc === "terms" ? TERMS : PRIVACY)[lang]; return (
<div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={doc.title}>
<div className="rise max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
<div className="flex items-center justify-between gap-2"><p className="text-lg font-black">{doc.title}</p><span className="flex gap-1">{(["zh", "en"] as const).map((l) => <button key={l} type="button" onClick={() => switchLang(l)} className={`rounded-full px-2.5 py-1 text-[11px] font-black ${lang === l ? "bg-[var(--text)] text-[var(--bg)]" : "border border-[var(--line)]"}`}>{l === "zh" ? "中文" : "EN"}</button>)}<button type="button" aria-label="关闭" onClick={() => setLegalDoc(null)} className="ml-1 rounded-full border border-[var(--line)] px-3 py-1 text-sm font-black">✕</button></span></div>
{doc.sections.map((sec) => (
<div key={sec.h} className="mt-3"><p className="text-sm font-black">{sec.h}</p>{sec.p.map((t, i) => <p key={i} className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{t}</p>)}</div>
))}
<button type="button" onClick={() => setLegalDoc(null)} className="mt-4 w-full rounded-full bg-[var(--text)] py-2.5 text-sm font-black text-[var(--bg)]">{lang === "en" ? "Close" : "知道了"}</button>
</div>
</div>
); })());

if (phase === "setup" || !gs) {
const szCount = world?.onlineSz ?? 0;
const hzCount = world?.onlineHz ?? 0;
const hkCount = world?.onlineHk ?? 0;
return (
<div className="min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--text)]">
<SafeAreaTopScrim backgroundColor="var(--bg)" />
<main className="mx-auto w-full max-w-2xl px-4 pb-10 pt-6 lg:max-w-5xl">
<p className="text-xs font-black tracking-[0.2em] text-[var(--accent)]">真人联机 · 同一座城</p>
<h1 className="font-display mt-2 text-4xl font-black leading-tight">在深圳、惠州和香港，<br />过完这个十一月</h1>
{(() => {
  const T = TIERS[setupCity];
  const hook = en
    ? (setupCity === "hk" ? "30 days. Can you get from a subdivided flat to the Mid-Levels?" : setupCity === "hz" ? "30 days. Can you get from an urban-village room to a sea-view flat?" : "30 days. Can you get from an urban-village room to a flat in Nanshan?")
    : (setupCity === "hk" ? "30 天，你能从劏房搬上半山吗？" : setupCity === "hz" ? "30 天，你能从城中村住进海景房吗？" : "30 天，你能从城中村搬进南山吗？");
  const card = shuffle ?? drawn;
  const ci = card ? IDENTITIES.find((i) => i.id === card.iden) : null;
  return (
  <section className="mt-4 rounded-[20px] border-2 border-[var(--border)] bg-[var(--surface)] p-4 shadow-[5px_5px_0_var(--border)]" aria-label={en ? "Draw your origin" : "抽签投胎"}>
    <p className="font-display text-2xl font-black leading-snug">{hook}</p>
    <p className="mt-1 text-sm text-[var(--dim)]">{en ? "You don't choose who you are — you draw it. Most people start at the bottom. Where you end up is up to you." : "出身靠抽签：骑手、保安、厨师……还是深二代？大多数人从最底层开始，结局看你自己。"}</p>
    {setupCity === "sz" && isApecSeason() && <p className="mt-2 rounded-[10px] bg-[#fdf6da] px-3 py-1.5 text-xs font-black text-[#5c4a00]">🌐 {en ? "Summit week special: some draws land on the limited “student volunteer” origin (14–19 Nov)." : "峰会周限定：有机会抽到「大学生志愿者」出身（11 月 14–19 日）。"}</p>}
    <div className="mt-3 flex flex-wrap gap-1.5">
      {(Object.keys(CITIES) as CityKey[]).map((k) => (
        <button key={k} type="button" onClick={() => setSetupCity(k)} aria-pressed={setupCity === k} className={`rounded-full border-2 px-3 py-1 text-xs font-black ${setupCity === k ? "border-[var(--border)] bg-[var(--text)] text-[var(--bg)]" : "border-[var(--line)]"}`}>{CITIES[k].emoji} {en ? trText(CITIES[k].name) : CITIES[k].name}</button>
      ))}
    </div>
    <div className="mt-3 flex items-end gap-1" aria-hidden>
      {T.map((t, i) => (
        <div key={i} className={`flex-1 rounded-t-[8px] px-1 pb-1 text-center text-[10px] font-black leading-tight ${card && card.tier === i ? "bg-[var(--accent)] text-white" : "bg-[var(--surface2)] text-[var(--dim)]"}`} style={{ paddingTop: 6 + i * 8 }}>{t.emoji}<br />{en ? t.en : t.zh}</div>
      ))}
    </div>
    {card && ci ? (
      <div className={`mt-3 flex items-start gap-3 rounded-[14px] border-2 p-3 ${shuffle ? "border-dashed border-[var(--line)] opacity-70" : "border-[var(--accent)]"}`} aria-live="polite">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-3xl" style={{ background: hexCss(ci.color) + "2b" }}>{ci.emoji}</span>
        <span className="min-w-0">
          <span className="block text-base font-black">{card.id === "o-apec" && !shuffle ? "🌐 " : ""}{en ? card.en : card.zh}</span>
          <span className="block text-xs leading-relaxed text-[var(--dim)]">{en ? card.lineEn : card.line}</span>
          {!shuffle && <span className="mt-0.5 block text-xs font-bold">{en ? `Start with ${fmt(ci.money)} · about ${fmt(ci.pay)} a day` : `开局 ${fmt(ci.money)} · 日薪约 ${fmt(ci.pay)}`}</span>}
        </span>
      </div>
    ) : (
      <p className="mt-3 rounded-[14px] border-2 border-dashed border-[var(--line)] p-4 text-center text-sm font-bold text-[var(--dim)]">{en ? "Who will you be? Tap to draw." : "你会投胎成谁？点下面抽一签。"}</p>
    )}
    <div className="mt-3 grid gap-2">
      {drawn && !shuffle ? (
        <>
          <button type="button" onClick={() => { const nm = setupName.trim() || randomNick(setupCity); setSetupName(nm); setAgreedStored(true); startGame(nm, setupCity, drawn.iden, drawn.id); }} className="w-full rounded-full bg-[var(--accent)] py-4 text-base font-black text-white shadow-[5px_5px_0_var(--border)]">{en ? "This is me — move in →" : "就这个命，进城 →"}</button>
          <button type="button" disabled={rerolls <= 0} onClick={drawFate} className="w-full rounded-full border-2 border-[var(--border)] py-2.5 text-sm font-black disabled:opacity-40">{rerolls > 0 ? (en ? `🎲 Not having it — draw again (${rerolls} left)` : `🎲 不服，再抽一次（还剩 ${rerolls} 次）`) : (en ? "No more redraws — fate has spoken" : "抽完了，认命吧")}</button>
        </>
      ) : (
        <button type="button" onClick={drawFate} disabled={!!shuffle} className="w-full rounded-full bg-[var(--accent)] py-4 text-base font-black text-white shadow-[5px_5px_0_var(--border)] disabled:opacity-70">{shuffle ? (en ? "Drawing…" : "抽签中…") : (en ? "🎲 Draw your origin — start in 10 seconds" : "🎲 抽签投胎 · 10 秒开局")}</button>
      )}
      <input value={setupName} onChange={(e) => setSetupName(e.target.value.slice(0, 12))} placeholder={en ? "Nickname (optional — we'll make one up)" : "昵称（可不填，自动起一个）"} aria-label={en ? "Nickname" : "昵称"} className="w-full rounded-full border-2 border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm font-bold outline-none" />
      <p className="text-center text-[11px] leading-relaxed text-[var(--dim)]">{en ? <>Starting means you agree to the <button type="button" onClick={() => setLegalDoc("terms")} className="font-black underline">Terms</button> and <button type="button" onClick={() => setLegalDoc("privacy")} className="font-black underline">Privacy Policy</button>.</> : <>开始即表示同意<button type="button" onClick={() => setLegalDoc("terms")} className="font-black underline">《用户协议》</button>和<button type="button" onClick={() => setLegalDoc("privacy")} className="font-black underline">《隐私政策》</button>。</>}</p>
    </div>
  </section>
  );
})()}
<p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
30 天生活模拟：选一座城、一个身份，在 3D 地图上打工、升职、吃饭、装修、攒钱。这次是<b className="text-[var(--text)]">真的联机</b>——其他打开游戏的人会以真身出现在你的地图上，你们共享一个城市频道、一份动态墙和一张排行榜。三座城随时互通：坐高铁去惠州，过关去香港（罗湖、福田、深圳湾，或高铁直达西九龙站）。11 月 14–19 日是深圳湾区峰会周，三个真实会场等你打工。
</p>
<div className="mt-3 flex flex-wrap gap-2">
<span className="chip"><span className="live-dot" /> 深圳在线 {szCount} 人</span>
<span className="chip"><span className="live-dot" /> 惠州在线 {hzCount} 人</span>
<span className="chip"><span className="live-dot" /> 香港在线 {hkCount} 人</span>
<span className="chip">🗺️ 三城 {getLocations("sz").length + getLocations("hz").length + getLocations("hk").length} 个地点 · 地铁/城际/港铁/高铁全线 · 大地图</span>
<span className="chip">🌐 峰会日程</span>
</div>

{isApecSeason() && (
<div className="mt-5 rounded-[16px] border-2 border-[var(--gold)] bg-[#fdf6da] p-4 text-[#5c4a00]">
<p className="font-display text-xl font-black">🌐 {APEC_SLOGAN}</p>
<p className="mt-1 text-xs leading-relaxed">公开上线活动：湾区国际峰会周 11 月 14–19 日在深圳举行，游戏同步开活动，每天一个任务，按日程走——14 日峰会周开幕（筹备会、工商论坛）→ 16 日晚太子湾欢迎晚宴 → 17–18 日前海工商峰会 → 18–19 日香蜜湖峰会主会议。你以志愿者、记者、司机的身份参与（峰会周的闭门会议不对公众开放，游戏里也进不去），坐真实地铁线路去三个会场打卡上岗，六天任务全做完，领《湾区峰会服务证书》。</p>
<p className="mt-1.5 text-[11px] font-bold">⏰ 游戏第 N 天 = 11 月 N 日：13 日前先进城认地图、认地铁，14 日准时开幕。选深圳开局就能参加活动。</p>
</div>
)}

<details className="mt-6 rounded-[16px] border-2 border-[var(--line)] bg-[var(--surface)] px-4 py-3">
<summary className="cursor-pointer text-sm font-black">{en ? "Or pick your own identity, city and perks (all options) ▾" : "或者自己挑身份、城市和传承（完整选项）▾"}</summary>
<label htmlFor="nickname" className="mt-4 block text-sm font-black">先给自己起个城市昵称（别人会看到）</label>
<input id="nickname" value={setupName} onChange={(e) => setSetupName(e.target.value.slice(0, 12))} placeholder="比如：阿深、湾区小陈" className="mt-2 w-full rounded-[12px] border-2 border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base font-bold outline-none" />

<p className="mt-6 text-sm font-black">选一座城</p>
<div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-3">
{(Object.keys(CITIES) as CityKey[]).map((k) => {
const c = CITIES[k];
const active = setupCity === k;
return (
<button key={k} type="button" aria-label={`选择${c.name}`} onClick={() => setSetupCity(k)} className={`rounded-[16px] border-2 p-4 text-left ${active ? "border-[var(--border)] bg-[var(--surface)] shadow-[5px_5px_0_var(--border)]" : "border-[var(--line)] bg-[var(--surface)]"}`}>
<p className="text-3xl">{c.emoji}</p>
<p className="mt-1 text-lg font-black">{c.name}</p>
<p className="text-xs leading-relaxed text-[var(--dim)]">{k === "sz" ? `${getLocations("sz").length} 个地点 · 峰会主场 · 周租贵、工资高` : k === "hk" ? `${getLocations("hk").length} 个地点 · 港铁 + 维港 · 港币标价、工资最高、租金最贵` : `${getLocations("hz").length} 个地点 · 海边慢生活 · 周租便宜、工资低`}</p>
<p className="mt-1 text-xs font-bold text-[var(--green)]">● {k === "sz" ? szCount : k === "hk" ? hkCount : hzCount} 人正在这座城里</p>
</button>
);
})}
</div>

<p className="mt-4 flex items-center gap-2 text-xs font-bold text-[var(--dim)]">🌐 Language / 语言 {langToggle()}</p>
{invite && <p className="mt-4 rounded-[14px] border-2 border-[var(--accent)] bg-[var(--surface)] px-4 py-3 text-sm font-bold">🎉 {invite.from}邀请你来深惠过日子：开局多 ¥100{invite.co && invite.co !== "startup" ? `，还有${companyById(invite.co).short}的内推（面试门槛降低）` : ""}。</p>}
<details className="mt-4 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
<summary className="cursor-pointer text-sm font-black">☁️ 在别的设备玩过？用云存档码继续</summary>
<div className="mt-2 flex gap-2">
<input value={restoreCode} onChange={(e) => setRestoreCode(e.target.value.slice(0, 14))} placeholder="ABCDE-FGH23" aria-label="云存档码" className="min-w-0 flex-1 rounded-full border-2 border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm font-bold tracking-widest outline-none" />
<button type="button" onClick={() => void restoreFromCloud()} className="shrink-0 rounded-full bg-[var(--text)] px-4 py-2 text-sm font-black text-[var(--bg)]">载入</button>
</div>
<p className="mt-1 text-xs text-[var(--dim)]">存档码在游戏里右侧「🎫 集章」页最上面。</p>
<button type="button" onClick={() => setAccountOpen(true)} className="mt-2 w-full rounded-full border-2 border-[var(--border)] px-4 py-2 text-sm font-black">👤 {en ? "Or log in to your account" : "或者登录账号继续"}</button>
{accountOpen && phase !== "game" && <AccountModal en={en} playerId={profile?.playerId ?? null} saveKey={LS_KEY} onClose={() => setAccountOpen(false)} toast={showToast} onChange={setLoggedIn} />}
</details>
<p className="mt-6 text-sm font-black">选一个身份</p>
<div className="mt-2 grid gap-2 lg:grid-cols-2">
{IDENTITIES.map((it) => {
const active = setupIden === it.id;
return (
<button key={it.id} type="button" aria-label={`选择身份${it.name}`} onClick={() => setSetupIden(it.id)} className={`flex items-start gap-3 rounded-[14px] border-2 p-3 text-left ${active ? "border-[var(--border)] bg-[var(--surface)] shadow-[4px_4px_0_var(--border)]" : "border-[var(--line)] bg-[var(--surface)]"}`}>
<span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-2xl" style={{ background: hexCss(it.color) + "2b" }}>{it.emoji}</span>
<span className="min-w-0">
<span className="text-sm font-black">{it.name} <span className="text-[var(--accent)]">{fmt(it.money)}</span></span>
<span className="block text-xs leading-relaxed text-[var(--dim)]">{it.desc}</span>
<span className="block text-xs text-[var(--dim)]">日薪约 {fmt(it.pay)} · 初始心情 {it.mood}</span>
</span>
</button>
);
})}
</div>

{(() => { const lg = meta.legacy; return (
<div className="mt-6 rounded-[16px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
<p className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-display text-lg font-black">{en ? "🗂️ Drifter's File" : "🗂️ 深漂档案"}</span><span className="text-xs font-black">{en ? `Legacy points ${lg.pts} · ${lg.total} earned · ${meta.runs} runs` : `档案点 ${lg.pts} · 累计 ${lg.total} · 已过 ${meta.runs} 局`}</span></p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{en ? `Every finished run earns legacy points (for your ending, career level, and the neighbours' stories you saw through). Spend them to unlock permanent perks; take up to ${MAX_EQUIP} into each run.${lg.total === 0 ? " Finish your first run to earn some." : ""}` : `每过完一局都会攒档案点（看结局、职级、陪街坊走完的故事）。用档案点永久解锁「传承」，每局开局最多带 ${MAX_EQUIP} 个。${lg.total === 0 ? "先过完第一局，档案点就来了。" : ""}`}</p>
<div className="mt-3 grid gap-2 sm:grid-cols-2">
{PERKS.map((pk) => { const owned = lg.owned.includes(pk.id); const on = lg.equipped.includes(pk.id); return (
<button key={pk.id} type="button" disabled={!owned && lg.pts < pk.cost} onClick={() => updMeta((m) => {
if (!m.legacy.owned.includes(pk.id)) { if (m.legacy.pts < pk.cost) return; m.legacy = { ...m.legacy, pts: m.legacy.pts - pk.cost, owned: [...m.legacy.owned, pk.id], equipped: m.legacy.equipped.length < MAX_EQUIP ? [...m.legacy.equipped, pk.id] : m.legacy.equipped }; return; }
m.legacy = { ...m.legacy, equipped: m.legacy.equipped.includes(pk.id) ? m.legacy.equipped.filter((x) => x !== pk.id) : m.legacy.equipped.length < MAX_EQUIP ? [...m.legacy.equipped, pk.id] : m.legacy.equipped };
})} className={`flex items-start gap-2 rounded-[12px] border-2 p-2.5 text-left disabled:opacity-45 ${on ? "border-[var(--accent)] bg-[var(--surface2)]" : "border-[var(--line)]"}`}>
<span className="text-xl">{pk.emoji}</span>
<span className="min-w-0 flex-1"><span className="block text-sm font-black">{L(pk.name)}</span><span className="block text-xs text-[var(--dim)]">{L(pk.desc)}</span></span>
<span className="shrink-0 text-[11px] font-black">{!owned ? (en ? `🔓 ${pk.cost} pts` : `🔓 ${pk.cost} 点`) : on ? (en ? "✅ Equipped" : "✅ 本局带上") : (en ? "Owned · tap to equip" : "已解锁 · 点击带上")}</span>
</button> ); })}
</div>
{lg.history.length > 0 && <p className="mt-2 text-[11px] text-[var(--dim)]">{en ? "Recent runs: " : "最近几局："}{lg.history.slice(0, 4).map((h) => `${en ? trText(h.title) : h.title} +${h.pts}`).join(" · ")}</p>}
</div> ); })()}

{OPERATOR_MISSING && <p className="mt-5 rounded-[12px] border-2 border-dashed border-[var(--accent)] px-3 py-2 text-[11px] font-bold text-[var(--accent)]">{lang === "en" ? "Pre-launch: the operator name and contact in the Terms and Privacy Policy are not filled in yet (set VITE_OPERATOR_NAME / VITE_OPERATOR_CONTACT when building)." : "上线前提醒：用户协议和隐私政策里的运营方名称、联系方式还没填（构建时设置 VITE_OPERATOR_NAME / VITE_OPERATOR_CONTACT）。"}</p>}
<label className="mt-5 flex items-start gap-2 text-xs leading-relaxed">
<input type="checkbox" checked={agreed} onChange={(e) => setAgreedStored(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" aria-label={lang === "en" ? "I agree to the Terms and Privacy Policy" : "同意用户协议和隐私政策"} />
<span>{lang === "en" ? <>I have read and agree to the <button type="button" onClick={() => setLegalDoc("terms")} className="font-black underline">Terms of Service</button> and <button type="button" onClick={() => setLegalDoc("privacy")} className="font-black underline">Privacy Policy</button>. Real company names only mark real places; jobs, pay and stories are fiction.</> : <>我已阅读并同意<button type="button" onClick={() => setLegalDoc("terms")} className="font-black underline">《用户协议》</button>和<button type="button" onClick={() => setLegalDoc("privacy")} className="font-black underline">《隐私政策》</button>。游戏里的真实企业名称只用来标示真实位置，工作、工资和剧情都是虚构的。</>}</span>
</label>
<button type="button" disabled={!setupName.trim() || !agreed} onClick={() => startGame(setupName.trim(), setupCity, setupIden)} className="mt-6 w-full rounded-full bg-[var(--accent)] py-4 text-base font-black text-white shadow-[5px_5px_0_var(--border)] disabled:opacity-40">
进城，开始过日子 →
</button>
</details>
<p className="mt-3 text-center text-xs leading-relaxed text-[var(--dim)]">规则：跟着北京时间过日子，每个自然月是一个赛季，第 N 天就是本月 N 号；做事有真实冷却，地铁、商场、景区按真实营业时间；没上线的日子会自动模拟上班吃饭；每周六睡前交租，存款跌破 -¥500 会被房东请出门；第 30 天结束结算并登上全城排行榜。</p>
</main>
{legalModal()}
</div>
);
}

/* ================= RESULT ================= */
if (phase === "result" && result) {
const s = gs;
const iden = idenOf(s);
const board = world?.leaderboard ?? [];
return (
<div className="min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--text)]">
<SafeAreaTopScrim backgroundColor="var(--bg)" />
<main className="mx-auto max-w-2xl px-4 pb-10 pt-6">
<div className="hard-card overflow-hidden">
<div className="p-5 text-white" style={{ background: s.cityKey === "sz" ? "#e63a1f" : s.cityKey === "hk" ? "#7c3aed" : "#0369a1" }}>
<p className="text-xs font-black tracking-[0.18em] opacity-90">{seasonMo} 月赛季结算 · {CITIES[s.cityKey].name}</p>
<h2 className="font-display mt-1 text-4xl font-black">{result.title}</h2>
<p className="mt-1 text-sm opacity-95">{iden.emoji} {iden.name} · 在{CITIES[s.cityKey].name}活了 {Math.min(s.day, seasonLen)} 天 · 最高存款 {fmt(s.maxMoney)}</p>
</div>
<div className="p-5">
<p className="text-sm leading-relaxed">{result.quote}</p>
{(() => { const T = TIERS[s.cityKey]; const t0 = s.startTier ?? tierOfIden(s.idenId); const t1 = tierAt(s); const og = originById(s.origin); return (
<div className="mt-4 rounded-[16px] border-2 border-[var(--border)] bg-[var(--surface2)] p-4">
<p className="text-xs font-black tracking-[0.15em] text-[var(--accent)]">{en ? "YOUR CLIMB" : "阶层变化"}</p>
<p className="font-display mt-1 text-2xl font-black">{T[t0]!.emoji} {en ? T[t0]!.en : T[t0]!.zh} → {T[t1]!.emoji} {en ? T[t1]!.en : T[t1]!.zh}</p>
<p className="mt-1 text-sm font-bold">{climbVerdict(t0, t1, en)}{og ? (en ? ` · drawn origin: ${og.en}` : ` · 抽到的出身：${og.zh}`) : ""}</p>
<div className="mt-2 flex items-end gap-1" aria-hidden>{T.map((t, i) => <div key={i} className={`flex-1 rounded-t-[6px] py-1 text-center text-[10px] font-black ${i === t1 ? "bg-[var(--accent)] text-white" : i === t0 ? "bg-[var(--text)] text-[var(--bg)]" : "bg-[var(--surface)] text-[var(--dim)]"}`} style={{ paddingTop: 4 + i * 7 }}>{t.emoji}</div>)}</div>
</div> ); })()}
<div className="mt-4 grid grid-cols-3 gap-2 text-center">
{[
["最终存款", fmt(s.money)], ["存活天数", `${Math.min(s.day, seasonLen)} 天`], ["上班", `${s.workCount} 次`],
["玩过的活动", `${s.actCount ?? 0} 次`], ["和真人组局", `${s.partyPlays ?? 0} 次`], ["感情", (() => { const top = Object.entries(s.romance ?? {}).sort((x, y) => y[1] - x[1])[0]; return top ? `${top[0]} · ${ROMANCE_STAGES[romanceStage(top[1])]!.name[0]}` : "单身"; })()],
["总收入", fmt(s.earned)], ["交租", fmt(s.rentPaid)], ["最终心情", `${Math.round(s.mood)}`],
["职级", (CAREERS[s.careerIdx] ?? CAREERS[0]!).name], ["技能", `${s.skill} 点`], ["人脉", `${s.network} 人`],
["我的家", homeName(s)], ["舒适度", `${computeComfort(s)}`], ["峰会服务", `${s.apecCount} 次`], [s.cityKey === "hz" ? "坐城轨/高铁" : s.cityKey === "hk" ? "坐港铁" : "坐地铁", `${s.metroRides ?? 0} 次`], ["风景打卡", `${(s.visitedScenic ?? []).length} / ${scenicTotal(s.cityKey)} 处`],
].map(([k, v]) => (
<div key={k} className="rounded-[12px] bg-[var(--surface2)] px-2 py-3">
<p className="text-[11px] font-bold text-[var(--dim)]">{k}</p>
<p className="mt-0.5 truncate text-sm font-black">{v}</p>
</div>
))}
</div>
{result.badges.length > 0 && (
<p className="mt-4 flex flex-wrap gap-1.5">
{result.badges.map((b) => <span key={b} className="chip">{b}</span>)}
</p>
)}
{Object.values(s.story ?? {}).some((p) => p.done) && (
<div className="mt-4 rounded-[12px] bg-[var(--surface2)] p-3">
<p className="text-xs font-black">{en ? "📖 Neighbours' stories you saw through these 30 days" : "📖 这 30 天你陪街坊走完的故事"}</p>
{STORIES.filter((st) => s.story?.[st.npc]?.done).map((st) => <p key={st.npc} className="mt-1 text-xs">{NPCS.find((n) => n.name === st.npc)?.emoji} {en ? `${trText(st.npc)} · "${L(st.title)}" → ` : `${st.npc}「${st.title}」→ `}<b>{L(s.story?.[st.npc]?.done ?? "")}</b></p>)}
</div>
)}
{legacyGain && (
<div className="mt-4 rounded-[12px] border-2 border-[var(--accent)] p-3">
<p className="text-sm font-black">{en ? `🗂️ Drifter's File +${legacyGain.pts} pts ` : `🗂️ 深漂档案 +${legacyGain.pts} 点 `}<span className="text-xs font-bold text-[var(--dim)]">{en ? `(${meta.legacy.pts} pts total)` : `（现在共 ${meta.legacy.pts} 点）`}</span></p>
<p className="mt-1 text-xs text-[var(--dim)]">{legacyGain.parts.join(" · ")}</p>
<p className="mt-1 text-xs">{en ? "Spend points on perks before your next run: start with cash or skill, get up an hour earlier, have the neighbours remember you…" : "下一局开局可以用档案点解锁传承：开局带钱、带技能、每天早起一小时、街坊记得你……"}</p>
</div>
)}
<p className="mt-3 text-xs text-[var(--dim)]">这个成绩已经发到全城动态和排行榜，其他玩家打开游戏就能看到。</p>
<p className="mt-2 text-center text-xs font-black text-[var(--dim)]">🌐 {APEC_SLOGAN}</p>
</div>
</div>

<div className="hard-card mt-5 p-5">
<h3 className="font-display text-xl font-black">🏆 全城排行榜</h3>
<div className="mt-3 grid gap-1.5">
{board.slice(0, 10).map((b, i) => (
<p key={b.id} className={`flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm ${b.id === myId ? "bg-[var(--surface2)] font-black" : ""}`}>
<span className="w-6 font-black">{i + 1}</span>
<span>{b.emoji}</span>
<span className="min-w-0 flex-1 truncate" style={lookOf(b) && LOOK_COLOR[lookOf(b)!] ? { color: LOOK_COLOR[lookOf(b)!], fontWeight: 900 } : undefined}>{b.name}{lookOf(b) && LOOK_TITLE[lookOf(b)!] ? <span className="ml-1 rounded-full bg-[var(--surface2)] px-1.5 text-[10px]">{LOOK_TITLE[lookOf(b)!]![en ? 1 : 0]}</span> : null}{b.id === myId ? "（你）" : ""}</span>
<span className="text-xs text-[var(--dim)]">{CITIES[b.cityKey as CityKey]?.name ?? b.cityKey}</span>
<span className="font-black">{fmt(b.money, b.cityKey as CityKey)}</span>
<span className="hidden text-xs text-[var(--dim)] sm:inline">{b.status === "finished" ? b.resultTitle ?? "已结算" : `第 ${b.gameDay} 天`}</span>
</p>
))}
{board.length === 0 && <p className="text-sm text-[var(--dim)]">排行榜暂时没数据。</p>}
</div>
</div>

<button type="button" onClick={restart} className="mt-6 w-full rounded-full bg-[var(--accent)] py-4 text-base font-black text-white shadow-[5px_5px_0_var(--border)]">
换个身份，再来一局 →
</button>
</main>
</div>
);
}

/* ================= GAME ================= */
const s = gs;
const iden = idenOf(s);
const city = CITIES[s.cityKey];
const career = CAREERS[s.careerIdx] ?? CAREERS[0]!;
const selLoc = locById(selectedLoc);
const arrived = currentLoc === selectedLoc && !walking;
const shopLabel = s.shop ? (SHOP_KINDS.find((k) => k.id === s.shop!.kind)?.zh ?? null) : null;
const boards = mapAds(s.cityKey, s.day, (billboardsQuery.data?.slots ?? []).flatMap((b) => (b.ad ? [{ slot: b.slot, text: b.ad.text, emoji: b.ad.emoji, owner: b.ad.owner }] : [])), shopLabel);
const spotsNow = billboardSpots(s.cityKey);
const adHere = boards.find((b) => spotsNow[b.slot]?.id === selLoc.id) ?? boards.find((b) => b.go === selLoc.id && b.kind) ?? null;
const said = sanheSay(s.cityKey, s.day);
const takeSanhe = () => {
  const s0 = gsRef.current; if (!s0) return;
  const line = sanheSay(s0.cityKey, s0.day);
  if ((s0.sanheDay ?? 0) === s0.day) { showToast(en ? `Already settled today. ${line.en}` : `今天这单结过了。${line.zh}`); return; }
  if (s0.energy < 22) { showToast(en ? "Too tired to stand a shift." : "站不动了，歇一歇再来。"); return; }
  const pay = sanhePay(s0.cityKey);
  mutate((x) => {
    x.money += pay; x.earned += pay; x.energy -= 22; x.xp += 1; x.sanheDay = x.day;
    x.hunger = clamp100(x.hunger - 14); x.clean = clamp100(x.clean - 8); x.fun = clamp100(x.fun - 6); x.bladder = clamp100(x.bladder - 8);
  });
  sfx("coin");
  showToast(en ? `${line.en} +${fmt(pay)}` : `${line.zh} 日结 +${fmt(pay)}。`);
};
const rentDueNow = rentYouPay(s);
const askRent = () => showToast(en ? `The listed room is ${fmt(listedRent(s.cityKey))} a week. You pay ${fmt(rentDueNow)}.` : `房东挂的单间，周租 ${fmt(listedRent(s.cityKey))}。你这周实际交 ${fmt(rentDueNow)}。`);
const askSale = () => showToast(en ? `${adHere?.owner ?? "The stall"}: ${adHere?.text ?? "today's price"}. Ask at the counter.` : `${adHere?.owner ?? "摊主"}：${adHere?.text ?? "今日特价"}。到柜台问。`);
const phaseApec = apecPhase(s.day);
const goalPct = clamp(Math.round((s.money / s.goal) * 100), 0, 100);
const tt = (zh: string, e: string) => (en ? e : zh);
const rentDue = rentDueNow;
const VENUE_PLACE: Partial<Record<LifeSet, string>> = { restaurant: "food", mall: "mall", office: "work", gym: "gym", market: "market", electronics: "electronics", oilpainting: "oilpainting", secondhand: "secondhand", seafood: "seafood", oldtown: "oldtown", womensstreet: "womensstreet", museum: "museum", library: "library", factory: "factory", disney: "fun", tram: "transit", temple: "scenic", miniature: "fun", farm: "farm", watershow: "fun", boardwalk: "scenic", fishingport: "port", bikehub: "scenic", club: "fun", classroom: "learn", clinic: "health", bedroom: "lodging" };
const MEET_IDS = new Set(["share", "coffee", "friend", "chat", "ask", "try", "classmate", "spot", "haggle", "fish", "paint", "frame", "dig", "boat", "snack", "clothes", "tour", "ride", "fortune", "buy", "eat", "milk"]);
const regularHere = (set: LifeSet) => {
  const kind = VENUE_PLACE[set];
  if (!kind) return undefined;
  const cast = npcsForCity(s.cityKey).filter((n) => npcAllowedAt(n, { id: venue3d?.id ?? "", type: kind as LocType }));
  return cast.length ? cast[s.day % cast.length] : undefined;
};
const runVenueTalk = (v: VenueTalk) => {
  if (!venue3d) return;
  const key = `${s.day}:${venue3d.set}:${v.id}`;
  const cost = -(v.money ?? 0);
  if (s.money < cost) { showToast(en ? "Not enough money for that." : "钱不够。"); return; }
  mutate((x) => {
    x.money += v.money ?? 0; x.energy = clamp(x.energy + (v.energy ?? 0), 0, 100);
    if (v.hunger) x.hunger = clamp100(x.hunger + v.hunger);
    if (v.id === "toilet") x.bladder = 100;
    if (v.id === "order" || v.id === "share") { x.hunger = clamp100(x.hunger + 28); x.fun = clamp100(x.fun + 8); }
    if (v.id === "milktea") { x.hunger = clamp100(x.hunger + 8); x.fun = clamp100(x.fun + 10); }
    if (["sing", "dance", "drink", "friend", "live", "try"].includes(v.id)) x.fun = clamp100(x.fun + 16);
    if (["bench", "stroll", "photo", "waves", "shade", "climb", "view", "wait", "castle", "ride", "parade", "show", "pray", "fortune", "tour", "milk", "crab", "boat", "rent"].includes(v.id)) x.fun = clamp100(x.fun + (v.id === "waves" || v.id === "climb" || v.id === "stroll" ? 18 : 12));
    if (v.id === "water") { x.hunger = clamp100(x.hunger + 8); x.fun = clamp100(x.fun + 4); }
    if (["share", "coffee", "friend", "chat", "ask", "try", "classmate", "spot", "paint", "frame", "dig", "snack", "clothes", "guide", "buy", "eat"].includes(v.id)) x.social = clamp100(x.social + 8);
    if (!(x.venueFx ?? []).includes(key)) { x.mood = clamp(x.mood + (v.mood ?? 0), 0, 100); x.network += v.network ?? 0; x.xp += v.xp ?? 0; x.venueFx = [...(x.venueFx ?? []).filter((k) => k.startsWith(`${x.day}:`)), key]; }
  });
  if (["share", "coffee", "friend", "chat", "ask", "try", "classmate", "spot", "paint", "frame", "dig", "snack", "clothes", "guide", "buy", "eat"].includes(v.id) && !(s.venueFx ?? []).includes(key)) {
    const who = regularHere(venue3d.set);
    if (who) {
      let stage = "";
      mutate((x) => {
        const m = { ...memOf(x.npcMem ?? {}, who.name) };
        m.rel = Math.max(-100, Math.min(100, m.rel + 4));
        m.lastDay = x.day;
        x.npcMem = { ...(x.npcMem ?? {}), [who.name]: m };
        if (m.rel >= 8 && x.spouse !== who.name) {
          const pts = (x.romance?.[who.name] ?? 0) + 6;
          x.romance = { ...(x.romance ?? {}), [who.name]: pts };
          stage = ROMANCE_STAGES[romanceStage(pts)]?.name[en ? 1 : 0] ?? "";
        }
      });
      showToast(en ? `You ran into ${who.name}${stage ? `. ${stage}` : "."}` : stage ? `碰上了${who.name}，现在是「${stage}」。` : `碰上了${who.name}，又熟了一点。`);
    }
  }
  if (v.money) sfx("coin"); else sfx("click");
  if (!soundIsOn) { setSoundIsOn(true); setSound(true); }
  if (v.open === "live") { setVenue3d(null); setVenueTalk(null); setLiveOpen(true); return; }
  setVenueTalk(v);
};
const feedKindEmoji: Record<string, string> = { join: "👋", career: "📈", apec: "🌐", home: "🏠", money: "💰", finish: "🏁", life: "✨" };

return (
<div className="min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--text)]">
<SafeAreaTopScrim backgroundColor="var(--bg)" />
<header className="sticky top-0 z-[45] border-b border-[var(--line)] bg-[var(--bg)]/90 pt-safe backdrop-blur-xl">
<div className="mx-auto flex w-full max-w-[2560px] items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 2xl:px-8">
{/* identity + day/time: tap for the status details (like a game's avatar corner) */}
<button type="button" onClick={() => { setBarsHidden(false); setFold((f) => (f === "hud" ? null : "hud")); }} aria-label={en ? "Your status" : "我的状态"} className="flex shrink-0 items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2 transition hover:bg-[var(--surface2)]">
<span className="grid h-9 w-9 place-items-center rounded-full text-xl" style={{ background: hexCss(iden.color) + "33", boxShadow: `inset 0 0 0 2px ${hexCss(iden.color)}` }}>{iden.emoji}</span>
<span className="flex flex-col items-start leading-tight"><span className="font-display text-[15px] font-black">{en ? `Day ${Math.min(s.day, seasonLen)}` : `第 ${Math.min(s.day, seasonLen)} 天`}</span><span className="text-[11px] font-bold text-[var(--dim)]">{clockStr(nowMin())} · {weekday(s.day)}</span></span>
</button>
{/* resources: money toward the goal, energy, mood */}
<div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
<span className="res-pill" title={en ? `Savings goal ${fmt(s.goal)} · ${goalPct}%` : `存钱目标 ${fmt(s.goal)} · ${goalPct}%`}><span aria-hidden="true">💰</span><span className="flex flex-col leading-none"><span className={`text-[13px] font-black ${s.money < 0 ? "text-[var(--accent)]" : ""}`}>{fmt(s.money)}</span><span className="mt-0.5 block h-1 w-full min-w-[40px] overflow-hidden rounded-full bg-[var(--surface2)]"><span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${goalPct}%` }} /></span></span></span>
<span className="res-pill compact-hide" title={en ? "Energy" : "能量"}><span aria-hidden="true">⚡</span><span className="text-[13px] font-black">{Math.round(s.energy)}</span></span>
<span className="res-pill compact-hide" title={en ? "Mood" : "心情"}><span aria-hidden="true">😊</span><span className="text-[13px] font-black">{Math.round(s.mood)}</span></span>
<span className="res-pill compact-only" title={en ? "Energy · mood" : "能量 · 心情"}><span className="text-[12px] font-black">⚡{Math.round(s.energy)}</span><span className="text-[12px] font-black">😊{Math.round(s.mood)}</span></span>
<button type="button" className="res-pill" onClick={() => setLifeOpen(true)} title={en ? "Hunger, restroom, wash, fun, people" : "饿了、内急、该洗了、想玩、想找人"}><span className="text-[12px] font-black">🍚{Math.round(s.hunger)}</span><span className="compact-hide text-[12px] font-black">🚿{Math.round(s.clean)}</span>{(s.bladder < 40 || s.fun < 40) && <span className="text-[12px] font-black">{s.bladder < 40 ? `🚻${Math.round(s.bladder)}` : ""}{s.fun < 40 ? ` 🎧${Math.round(s.fun)}` : ""}</span>}</button>
{s.busyUntil && Date.now() < s.busyUntil ? <span className="res-pill border-[var(--accent)] text-[var(--accent)]">⏳ <span className="compact-hide">{s.busyWhat ?? "忙"} </span>{countdown(s.busyUntil - Date.now())}</span> : null}
</div>
<div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
<span className="compact-hide flex items-center gap-1.5"><button type="button" aria-label={`刷新${city.name}真实天气`} title={rwOk ? `${city.name}此刻真实天气（${realWeather!.sourceName}，${new Date(realWeather!.fetchedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 更新）——游戏里的天色、云雨都跟着它走` : "真实天气暂时取不到"} onClick={() => weatherQuery.refetch()} data-wx="1" className="chip">
{weatherQuery.isLoading ? "🌡️ 实况加载中…" : rwOk ? `${RW_EMOJI[realWeather!.kind]} ${city.name}实况 ${realWeather!.description || RW_LABEL[realWeather!.kind]}${realWeather!.temperature != null ? ` ${Math.round(realWeather!.temperature)}°` : ""}${realWeather!.stale ? "（缓存）" : ""}` : "🌡️ 实况暂不可用"}
</button>
<button type="button" title={todayEvent.desc} aria-label={`今日城市事件：${todayEvent.name}`} onClick={() => showToast(`${todayEvent.emoji} 今日城市事件「${todayEvent.name}」：${todayEvent.desc}`)} className="chip">{todayEvent.emoji} {todayEvent.name}</button>
<span className="chip"><span className="live-dot" /> {(world?.onlineSz ?? 0) + (world?.onlineHz ?? 0) + (world?.onlineHk ?? 0)}{en ? " online" : " 人在线"}</span>
</span>
{(() => { const ch = committeeQuery.data?.chair; const short = ch && ch.pledge in PLEDGE_INFO ? PLEDGE_INFO[ch.pledge].short[en ? 1 : 0] : null; return <button type="button" className="chip" onClick={() => setCommitteeOpen(true)}>{ch && short ? `${ch.emoji} ${ch.name} · ${short}` : (en ? "No chair · full price" : "城主空缺 · 原价")}</button>; })()}
<button type="button" aria-label="打开每日任务" onClick={() => setDailyOpen(true)} className="icon-pill compact-hide"><span aria-hidden="true">📋</span><span className="icon-pill-label">{en ? "Tasks" : "任务"}</span></button>
<button type="button" aria-label="打开手机" onClick={() => { setPhoneApp(null); setPhoneOpen(true); sfx("notify"); }} className="icon-pill compact-hide"><span aria-hidden="true">📱</span><span className="icon-pill-label">{en ? "Phone" : "手机"}</span>{unreadDm > 0 && <span className="red-dot" />}</button>
<div className="relative">
<button type="button" aria-label={en ? "Menu" : "菜单"} aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)} className="icon-pill"><span aria-hidden="true">☰</span><span className="icon-pill-label">{en ? "Menu" : "菜单"}</span>{(updateSeen !== latestKey || bondInvites > 0 || unreadDm > 0) && <span className="red-dot" />}</button>
{menuOpen && (<>
<button type="button" aria-label="关闭菜单" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 cursor-default" />
<div className="menu-pop absolute right-0 top-[calc(100%+8px)] z-50 w-64 p-1.5" onClick={() => setMenuOpen(false)}>
<div className="flex items-center justify-between px-2.5 py-2"><span className="text-xs font-black text-[var(--dim)]">{en ? "Language" : "语言"}</span><span onClick={(e) => e.stopPropagation()}>{langToggle()}</span></div>
<button type="button" className="menu-item compact-only" onClick={() => { setPhoneApp(null); setPhoneOpen(true); sfx("notify"); }}>📱 {en ? "Phone" : "手机"}{unreadDm > 0 && <span className="red-dot static ml-auto" />}</button>
<button type="button" className="menu-item compact-only" onClick={() => setDailyOpen(true)}>📋 {en ? "Daily tasks" : "每日任务"}</button>
<button type="button" className="menu-item" onClick={() => void openShare()}>📤 {en ? "Share & invite" : "分享战绩、邀请朋友"}</button>
<button type="button" className="menu-item" onClick={() => setMusicOpen(true)}>🎵 {en ? "Background music" : "背景音乐"}</button>
<button type="button" className="menu-item" onClick={goHomeAndSleep}>😴 {en ? "Go home and sleep" : "回家睡觉"}</button>
{(Object.keys(CITIES) as CityKey[]).filter((k) => k !== s.cityKey).map((k) => <button key={k} type="button" className="menu-item" onClick={() => setCrossTo(k)}>{k === "hk" || s.cityKey === "hk" ? "🛃" : "🚄"} {en ? `To ${CITY_EN[k]} · ${crossRoutes(s.cityKey, k).length} routes` : `去${CITIES[k].name} · ${crossRoutes(s.cityKey, k).length} 条路线`}</button>)}
<div className="my-1 h-px bg-[var(--line)]" />
<button type="button" className="menu-item" onClick={() => { setUpdatesOpen(true); setUpdateSeen(latestKey); try { localStorage.setItem("shhr-update-seen", latestKey); } catch { /* storage unavailable */ } }}>🆕 {en ? "What's new" : "更新公告"}{updateSeen !== latestKey && <span className="red-dot static ml-auto" />}</button>
<button type="button" className="menu-item" onClick={() => setLifeOpen(true)}>🏠 {en ? "Living: eat, home, family, land" : "过日子：吃饭、家里、家人、地"}</button>
<button type="button" className="menu-item" onClick={() => setBondsOpen(true)}>🤝 {en ? "Bonds: roommates, partner" : "关系：室友、搭子、伴侣"}{bondInvites > 0 && <span className="red-dot static ml-auto" />}</button>
<button type="button" className="menu-item" onClick={() => setDmOpen(true)}>💬 {en ? "Messages" : "私信"}{unreadDm > 0 && <span className="red-dot static ml-auto" />}</button>
<button type="button" className="menu-item" onClick={() => setCommitteeOpen(true)}>🏛️ {en ? "Estate committee" : "业委会选举"}</button>
<button type="button" className="menu-item" onClick={() => setAdsOpen(true)}>📢 {en ? "Billboards" : "广告牌"}</button>
<button type="button" className="menu-item" onClick={() => { setMenuOpen(false); setPhoneApp("trade"); setPhoneOpen(true); }}>🛒 {en ? "Trade board & overseas shopping" : "交易板 · 海淘"}</button>
<button type="button" className="menu-item" onClick={() => setAccountOpen(true)}>👤 {en ? "Account" : "账号"}{!loggedIn && <span className="ml-auto text-[11px] text-[var(--accent)]">{en ? "Sign in" : "登录"}</span>}</button>
<button type="button" className="menu-item" onClick={() => setDanmakuOn((v) => !v)}>💬 {en ? `Floating comments: ${danmakuOn ? "on" : "off"}` : `弹幕：${danmakuOn ? "开" : "关"}`}</button>
<div className="compact-only my-1 h-px bg-[var(--line)]" />
<span className="compact-only px-2.5 py-1.5 text-xs font-bold text-[var(--dim)]">{todayEvent.emoji} {todayEvent.name} · {(world?.onlineSz ?? 0) + (world?.onlineHz ?? 0) + (world?.onlineHk ?? 0)}{en ? " online" : " 人在线"}</span>
</div>
</>)}
</div>
</div>
</div>
</header>

<main className="relative w-full">
{/* The map is the whole stage now — no fixed side panel squeezing it.
    The status / Summit / city bars float over the map's top-left corner as
    a translucent stack (folded bars become a vertical rail of buttons
    down the left edge), and place/feed/wall/chat/board live in a
    floating translucent panel that collapses vertically into a slim
    strip on the right edge — never fully hidden, always one tap away. */}
<section className="relative h-[calc(100dvh-61px)] min-h-[300px] w-full overflow-hidden">
<div className={`float-bars absolute left-3 top-[60px] z-20 w-[min(720px,calc(100vw-90px))]${scenicMoment ? " hidden" : ""}`}>
{/* ONE merged card (was three stacked bars: status / Summit / city intro).
    Row 1 = core stats; row 2 = slim Summit strip + three fold tabs that
    open a single detail panel at a time. The whole card folds into the
    left-edge rail. */}
{!barsHidden && (
<div className="hard-card px-3.5 py-2.5">
<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
{(() => { const t0 = s.startTier ?? tierOfIden(s.idenId); const t1 = tierAt(s); const T = TIERS[s.cityKey]; const top = T[3]!; return <span className="chip" title={en ? `Started in ${T[t0]!.en}; your savings now put you in ${T[t1]!.en}. Reach the goal to move up.` : `出身：${T[t0]!.zh}；按现在的存款，你在「${T[t1]!.zh}」。攒够目标就能往上爬。`}>🪜 {T[t0]!.emoji}→{T[t1]!.emoji} {en ? T[t1]!.en : T[t1]!.zh}{t1 < 3 ? (en ? ` · aim: ${top.en}` : ` · 目标${top.zh}`) : ""}</span>; })()}
{isSaturday(s.day) && <span className="chip text-[var(--accent)]">🏠 今天交租 {fmt(rentDue)}</span>}
{inWindow(nowMin(), [19 * 60, 21 * 60]) && <button type="button" onClick={() => setGigsOpen(true)} className="chip text-[var(--accent)]">🔥 {isPrime() ? (en ? "Prime time now · gigs ×1.5" : "黄金档进行中 · 零工 ×1.5") : (en ? `Prime time in ${20 * 60 - nowMin()} min` : `${20 * 60 - nowMin()} 分钟后黄金档`)}</button>}
<button type="button" aria-label="竖着收起状态卡，收成屏幕左侧的竖排按钮" title="竖着收起，收成屏幕左侧的竖排按钮，点一下就展开" onClick={() => setBarsHidden(true)} className="ml-auto shrink-0 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-black transition hover:border-[var(--border)]">◂ 收起</button>
</div>

<div className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-[var(--line)] pt-2 text-[11px] font-bold${hudMore ? "" : " compact-hide"}`}>
<span className="shrink-0 rounded-full border border-[var(--gold)] bg-[#fdf6da] px-2 py-0.5 font-black text-[#5c4a00]">🌐 峰会{s.cityKey === "sz" ? ` · ${s.day < 14 ? `还有 ${14 - s.day} 天` : s.day <= 19 ? "进行中" : "已结束"}` : " · 深圳 14–19 日"}</span>
{s.cityKey === "sz" ? (
<>
<span className="shrink-0">任务 {(s.apecTasks ?? []).length}/{APEC_TASKS.length} · 打卡 {(s.apecCheckins ?? []).length}/3</span>
{(() => {
const task = apecTaskOfDay(s.day) ?? (s.day < 14 ? APEC_TASKS[0]! : null);
if (!task) return null;
const done = (s.apecTasks ?? []).includes(task.id);
const venue = locById(task.venueLocId);
return (
<>
<span className="min-w-[60px] flex-1 basis-0 truncate" title={`${task.title} · ${venue.name}`}>{task.day === s.day ? "今日" : task.dateLabel}：{task.roleEmoji} {task.title} · {venue.short}</span>
{done ? <span className="shrink-0 font-black">✅</span> : currentLoc !== task.venueLocId ? <button type="button" aria-label={`坐地铁前往${venue.name}打卡`} onClick={() => walkTo(task.venueLocId, "metro")} className="shrink-0 rounded-full bg-[#5c4a00] px-2.5 py-0.5 font-black text-white">🚇 去打卡</button> : <span className="shrink-0 font-black">📍 在会场</span>}
</>
);
})()}
</>
) : <span className="min-w-[60px] flex-1 basis-0 truncate text-[var(--dim)]">惠州兼职旺季 ×1.3</span>}
<div className="ml-auto flex shrink-0 gap-1" role="tablist" title="展开：状态详情 / 峰会活动 / 城市速览" aria-label="展开详情">
{([["hud", "状态"], ["apec", "峰会"], ["intro", "速览"]] as const).map(([k, label]) => (
<button key={k} type="button" role="tab" aria-selected={fold === k} aria-expanded={fold === k} onClick={() => setFold((f) => (f === k ? null : k))} className={`rounded-full border px-2.5 py-1 text-[11px] font-black transition ${fold === k ? "border-[var(--border)] bg-[var(--surface2)]" : "border-[var(--line)] hover:border-[var(--border)]"}`}>{label} {fold === k ? "▴" : "▾"}</button>
))}
</div>
</div>
{s.energy < 25 && <p className="mt-2 text-xs font-bold text-[var(--accent)]">能量快见底了：去夜市吃点东西，或者回家睡觉。</p>}
{nowRainy && s.outfit !== "raincoat" && (
<p className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--accent2)]">🌧️ 今天下雨，出门容易淋湿——衣柜里有雨衣的话先换上。
<button type="button" aria-label="下雨天换上雨衣" onClick={() => buyOutfit("raincoat")} className="rounded-full bg-[var(--accent2)] px-3 py-1 text-[11px] font-black text-white">{s.ownedOutfits.includes("raincoat") ? "换上雨衣 🧥" : `${fmt(outfitOf("raincoat").price)} 买雨衣穿上`}</button></p>
)}
{fold === "hud" && (
<div className="mt-3 border-t border-[var(--line)] pt-3">
<div className="grid grid-cols-2 gap-3">
<div>
<p className="flex justify-between text-xs font-bold"><span>⚡ 能量</span><span>{Math.round(s.energy)}/100</span></p>
<div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface2)]"><div className="h-full bg-amber-500 transition-all" style={{ width: `${s.energy}%` }} /></div>
</div>
<div>
<p className="flex justify-between text-xs font-bold"><span>😊 心情</span><span>{Math.round(s.mood)}/100</span></p>
<div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface2)]"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${s.mood}%` }} /></div>
</div>
</div>
<p className="mt-3 flex flex-wrap gap-1.5">
<span className="chip">🏠 周租 {fmt(rentDue)}{(s.rentPolicy ?? 1) < 1 ? (en ? " · chair −5%" : " · 城主减租") : ""}{s.roommate ? (en ? " · split" : " · 合租") : ""}</span>
<span className="chip">{iden.emoji} {iden.name}</span>
<span className="chip">{career.name} ×{career.mul}</span>
<span className="chip">经验 {s.xp}</span>
<span className="chip">技能 {s.skill}</span>
<span className="chip">人脉 {s.network}</span>
<span className="chip">体质 {s.fit}</span>
<span className="chip">🌐 峰会服务 {s.apecCount} 次</span>
{s.cityKey === "sz" && <span className="chip">🎖️ 峰会任务 {(s.apecTasks ?? []).length}/{APEC_TASKS.length} · 打卡 {(s.apecCheckins ?? []).length}/3</span>}
<span className="chip">🏠 舒适度 {computeComfort(s)}</span>
<span className="chip">{s.cityKey === "hz" ? "🚆 已坐城轨/高铁" : s.cityKey === "hk" ? "🚇 已坐港铁" : "🚇 已坐地铁"} {s.metroRides ?? 0} 次</span>
<span className="chip">{outfitOf(s.outfit).emoji} 穿着{outfitOf(s.outfit).name}</span>
<span className="chip">🥬 食材 ×{s.groceries}</span>
<span className="chip">📸 打卡 {(s.visitedScenic ?? []).length} 处</span>
</p>
<div className="mt-3 flex flex-wrap gap-2">
<button type="button" aria-label="播放今日生活动画" onClick={() => playLifeAnim("day")} className="rounded-full bg-[var(--text)] px-4 py-2.5 text-xs font-black text-[var(--bg)]">🎬 今日生活动画：下高铁 · 坐{railWord(s.cityKey)} · 敲代码 · 做饭睡觉</button>
<span className="self-center text-[11px] text-[var(--dim)]">把一天的日子演一遍：起床洗漱、正装出门、通勤、上班、吃饭、买菜做饭、睡觉。</span>
</div>
</div>
)}
{fold === "apec" && (
<div className="mt-3 rounded-[12px] border border-[var(--gold)] bg-[#fdf6da] p-2.5 text-[#5c4a00]">
{s.cityKey === "sz" ? (
<>
<p className="text-xs leading-relaxed">{phaseApec.detail}</p>
<div className="mt-2">
<p className="text-xs font-black">🎉 湾区峰会周活动 · {APEC_SLOGAN}</p>
<p className="mt-0.5 text-[11px] font-bold">每日一任务（11 月 14–19 日）：任务进度 {(s.apecTasks ?? []).length} / {APEC_TASKS.length} · 会场打卡 {(s.apecCheckins ?? []).length} / 3{(s.apecTasks ?? []).length >= APEC_TASKS.length ? ` · ${APEC_CERT_NAME}已到手` : " · 六天全做完领服务证书"}</p>
{(() => {
const task = apecTaskOfDay(s.day) ?? (s.day < 14 ? APEC_TASKS[0]! : null);
if (!task) return <p className="mt-1.5 text-xs leading-relaxed">峰会周活动已经结束。{(s.apecTasks ?? []).length >= APEC_TASKS.length ? "你六天的任务全做完了，证书在结算页等你。" : "错过的班次不能补，但这座城你已经认得差不多了。"}</p>;
const venue = locById(task.venueLocId);
const isToday = task.day === s.day;
const done = (s.apecTasks ?? []).includes(task.id);
const checked = (s.apecCheckins ?? []).includes(task.venueLocId);
const atVenue = currentLoc === task.venueLocId && selectedLoc === task.venueLocId && !walking;
const plan = currentLoc !== task.venueLocId ? planRailTrip("sz", currentLoc, task.venueLocId) : null;
return (
<div className="mt-1.5 rounded-[12px] bg-white/60 p-2.5">
<p className="text-xs font-black">{isToday ? "今日任务" : `${task.dateLabel} 第一班（提前认路）`} · {task.dateLabel} {task.event}</p>
<p className="mt-0.5 text-xs leading-relaxed">{task.roleEmoji} 你当<b>{task.role}</b>：{task.title} —— 地点：{venue.emoji} {venue.name}。{done ? "✅ 已完成" : checked ? "📸 已打卡，到会场就能上岗" : "先坐地铁去会场打卡，再上岗"}</p>
{plan && <p className="mt-0.5 text-[11px] font-bold">🚇 怎么去：{plan.boardLoc !== currentLoc ? `先步行到${locById(plan.boardLoc).short}站 · ` : ""}{plan.route.summary} · {plan.route.stops} 站 · {Y}{Math.round(plan.route.fare * policyRef.current.metro)}{plan.alightLoc !== task.venueLocId ? ` · 到${locById(plan.alightLoc).short}站再步行过去` : ""}</p>}
{!plan && currentLoc !== task.venueLocId && <p className="mt-0.5 text-[11px] font-bold">🚇 怎么去：离得很近，步行就到。</p>}
<div className="mt-2 flex flex-wrap gap-2">
{!atVenue && !done && <button type="button" aria-label={`坐地铁前往${venue.name}打卡`} onClick={() => walkTo(task.venueLocId, "metro")} className="rounded-full bg-[#5c4a00] px-3.5 py-1.5 text-[11px] font-black text-white">🚇 坐地铁去{venue.short}打卡</button>}
{atVenue && !checked && <button type="button" aria-label={`在${venue.name}打卡`} onClick={() => doAction("apec-checkin")} className="rounded-full bg-[#5c4a00] px-3.5 py-1.5 text-[11px] font-black text-white">📸 会场打卡</button>}
{atVenue && checked && !done && isToday && <button type="button" aria-label={`开始今日任务${task.title}`} disabled={s.energy < task.energy} onClick={() => doAction("apec-task")} className="rounded-full bg-[#5c4a00] px-3.5 py-1.5 text-[11px] font-black text-white disabled:opacity-40">{task.roleEmoji} 上岗：{task.title}（+{fmt(Math.round(basePay(s) * task.payMul))}）</button>}
{atVenue && <button type="button" aria-label="在地点面板查看会场" onClick={() => { setAsideTab("place"); setAsideOpen(true); }} className="rounded-full border border-[#5c4a00] px-3.5 py-1.5 text-[11px] font-black">会场详情 →</button>}
</div>
</div>
);
})()}
</div>
</>
) : (
<>
<p className="text-xs font-black">🌐 湾区峰会周活动 · {APEC_SLOGAN}</p>
<p className="mt-1 text-xs leading-relaxed">{s.day < 14 ? `湾区国际峰会周 11 月 14 日在深圳开启：14 日开幕、16 日晚太子湾欢迎晚宴、17–18 日前海工商峰会、18–19 日香蜜湖峰会主会议，每天一个任务，玩家在深圳以志愿者、记者、司机身份去三个会场打卡上岗。` : "深圳湾区峰会周进行中（14–19 日）：每天一个任务，志愿者、记者、司机轮着当，三个会场坐地铁去打卡。"}惠州没有会场，这周温泉酒店、巽寮湾的兼职更旺（×1.3）——想上岗打卡，去深圳开一局就能参加。</p>
</>
)}
</div>
)}
{fold === "intro" && (
<div className="mt-3 border-t border-[var(--line)] pt-3">
<p className="text-[13px] font-black">🗺️ {CITY_INTRO[s.cityKey].title} · <span className="text-[var(--accent2)]">{CITY_INTRO[s.cityKey].en}</span></p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{CITY_INTRO[s.cityKey].facts}</p>
<p className="mt-1.5 rounded-[10px] bg-[var(--surface2)] px-2.5 py-1.5 text-[11px] font-bold leading-relaxed">🗺️ 地图说明：游戏地图是按真实地理方位排布的<b>示意微缩模型</b>——地点之间的方向、片区、海岸与山峦的相对位置都按真实地理，但距离和面积经过压缩，<b>不是等比例测绘地图</b>。靠它认方向、认城市没问题；真实距离请以导航为准。</p>
</div>
)}
</div>
)}
</div>


{/* Map — the hero, and now the whole stage: it fills the section
    edge-to-edge at all times. ⛶ 全屏 still offers the native
    full-viewport mode on top of that; Esc or the same button exits. */}
<div ref={mapShellRef} className={mapFullscreen ? "map-shell fixed inset-0 z-[46] flex flex-col bg-[var(--bg)] p-3 pt-safe" : "map-shell absolute inset-0 flex flex-col p-2.5"}>
<div className="map-search relative z-30 px-1.5 pb-2.5">
<div className="flex gap-2">
<input value={mapQuery} onChange={(e) => setMapQuery(e.target.value)} onFocus={() => setSearchFocus(true)} onBlur={() => window.setTimeout(() => setSearchFocus(false), 220)} placeholder={s.cityKey === "hz" ? "🔍 搜地点或城轨/高铁站：西湖、老街、惠州南…" : s.cityKey === "hk" ? "🔍 搜地点或港铁站：旺角、中环、山顶、迪士尼…" : "🔍 搜地点或地铁站：公园、商场、医院、博物馆、海滩…"} aria-label={`搜索地点或${railWord(s.cityKey)}站`} className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-sm outline-none focus:border-[var(--border)]" />
<button type="button" aria-label="打开景点分布图" onClick={() => setPlacesMapOpen(true)} data-tip={tt("景点分布图","Places map")} className={`tipbtn tip-b grid h-10 w-10 shrink-0 place-items-center rounded-full text-[17px] text-white shadow bg-[var(--green)]`}>🗺️</button>
<button type="button" aria-label={s.cityKey === "hz" ? "打开惠州城际高铁线网图" : s.cityKey === "hk" ? "打开香港港铁线网图" : "打开地铁线路图"} onClick={() => { setMetroMapDest(null); setMetroMapOpen(true); }} data-tip={tt("线路图","Line map")} className={`tipbtn tip-b grid h-10 w-10 shrink-0 place-items-center rounded-full text-[17px] text-white shadow bg-[var(--accent2)]`}>🚇</button>
<button type="button" aria-label={mapFullscreen ? "退出地图全屏" : "地图全屏"} aria-pressed={mapFullscreen} onClick={toggleMapFullscreen} data-tip={(mapFullscreen ? tt("退出全屏","Exit full screen") : tt("全屏看地图","Full screen"))} className="tipbtn tip-b tip-r grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#14202b] text-white shadow">
<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
{mapFullscreen
  ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
</svg>
</button>
</div>
{mapQuery.trim() === "" && searchFocus && searchHist.some((h) => h.city === s.cityKey) && (
<div className="absolute inset-x-1.5 top-full z-30 max-h-72 overflow-y-auto rounded-[14px] border-2 border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xl">
<p className="flex items-center justify-between px-2 py-1 text-[11px] font-black text-[var(--dim)]"><span>🕘 {en ? "Recent searches" : "最近搜索"}</span><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={clearSearchHist} className="rounded-full border border-[var(--line)] px-2 py-0.5">{en ? "Clear" : "清除"}</button></p>
{searchHist.filter((h) => h.city === s.cityKey).slice(0, 8).map((h) => (
<button key={h.locId} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setSearchFocus(false); if (h.station) { setMetroMapDest(h.name.replace(/站$/, "")); setMetroMapOpen(true); } else { setSelectedLoc(h.locId); setAsideTab("place"); autoOpenAside(); setMapFocus({ locId: h.locId, nonce: Date.now() }); } setPinLoc(h.locId); rememberSearch(h); }} className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-sm font-bold hover:bg-[var(--surface2)]">
<span>{h.station ? (s.cityKey === "hz" ? "🚆" : "🚇") : "📍"}</span><span className="min-w-0 flex-1 truncate">{en ? trText(h.name) : h.name}</span><span className="text-[11px] font-black text-[var(--accent2)]">{en ? "Show" : "定位"}</span>
{!h.station && <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setSearchFocus(false); setPinLoc(h.locId); rememberSearch(h); walkTo(h.locId); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setPinLoc(h.locId); walkTo(h.locId); } }} className="shrink-0 rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-black text-white">{en ? "Go" : "去这里"}</span>}
</button>
))}
</div>
)}
{mapQuery.trim() !== "" && (() => {
const q = mapQuery.trim();
/* 口岸 / 过关 / 码头…: list every way out of the city (ports, ferry piers, the
   cross-border rail station), not just places with the word in their name */
const crossQ = /口岸|过关|出境|入境|边境|跨境|码头|border|crossing|ferry/i.test(q);
const crossIds = new Set(CROSS_ROUTES.filter((r) => r.from === s.cityKey && r.fromLoc !== "*").map((r) => r.fromLoc));
/* English search ignores case, spaces and punctuation ("dameisha", "Mei Sha", "ocean-park"), and checks every English name we have */
const nq = q.toLowerCase().replace(/[\s·'’.,\-–()（）]/g, "");
const hit = (...names: (string | null | undefined)[]) => names.some((n) => !!n && (n.includes(q) || (nq.length >= 2 && n.toLowerCase().replace(/[\s·'’.,\-–()（）]/g, "").includes(nq))));
const locResults = [
...getLocations(s.cityKey).filter((l) => hit(l.name, l.short, LOC_EN[l.name], trText(l.name), trText(l.short)) || (crossQ && (l.type === "port" || crossIds.has(l.id)))).slice(0, crossQ ? 16 : 6),
...placesForCity(s.cityKey).filter((p) => hit(p.name, p.en, trText(p.name))).slice(0, 8).map((p) => locById(`pl:${p.id}`)),
...AREA_LABELS.filter((a) => a.c === s.cityKey && hit(a.n, a.e)).slice(0, 6).map((a) => locById(areaLocId(a.c, a.n))),
];
const stationResults = stationIndexOf(s.cityKey).filter((st) => hit(st.name, trText(st.name), trText(`${st.name}站`))).slice(0, 6);
return (
<div className="absolute inset-x-1.5 top-full z-30 max-h-72 overflow-y-auto rounded-[14px] border-2 border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xl">
{locResults.length === 0 && stationResults.length === 0 && <p className="px-2 py-1.5 text-xs text-[var(--dim)]">没找到「{q}」——地点名、{railWord(s.cityKey)}站名、英文名都能搜。</p>}
{locResults.map((l) => {
const plan = l.id !== currentLoc ? planRailTrip(s.cityKey, currentLoc, l.id) : null;
return (
<button key={l.id} type="button" aria-label={`定位到${l.name}`} onClick={() => { setSelectedLoc(l.id); setAsideTab("place"); autoOpenAside(); setMapFocus({ locId: l.id, nonce: Date.now() }); setMapQuery(""); setPinLoc(l.id); rememberSearch({ locId: l.id, name: l.name, city: s.cityKey }); }} className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left hover:bg-[var(--surface2)]">
<span className="text-lg">{l.emoji}</span>
<span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{en ? trText(l.name) : l.name}</span><span className="block truncate text-[11px] text-[var(--dim)]">{l.id === currentLoc ? "你现在在这里" : plan ? `怎么去：${plan.boardLoc !== currentLoc ? `先步行到${locById(plan.boardLoc).short}站 · ` : ""}${railWord(s.cityKey)} ${plan.route.summary} · ${plan.route.stops} 站 · ${Y}${Math.round(plan.route.fare * policyRef.current.metro)}${plan.alightLoc !== l.id ? ` · 到${locById(plan.alightLoc).short}站再步行过去` : ""}` : "怎么去：离得很近，步行就到（在下方选好出行方式，点地点名或地图上的建筑前往）"}</span></span>
<span className="shrink-0 text-[11px] font-black text-[var(--accent2)]">定位</span>
<span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setMapQuery(""); setPinLoc(l.id); rememberSearch({ locId: l.id, name: l.name, city: s.cityKey }); walkTo(l.id); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setMapQuery(""); setPinLoc(l.id); walkTo(l.id); } }} className="shrink-0 rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-black text-white">{en ? "Go" : "去这里"}</span>
</button>
);
})}
{stationResults.map((st) => (
<button key={st.name} type="button" aria-label={`在线网图上规划去${st.name}站`} onClick={() => { setMetroMapDest(st.name); setMetroMapOpen(true); setMapQuery(""); setPinLoc(stationLocId(st.name)); rememberSearch({ locId: stationLocId(st.name), name: `${st.name}站`, city: s.cityKey, station: true }); }} className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left hover:bg-[var(--surface2)]">
<span className="text-lg">{s.cityKey === "hz" ? "🚆" : "🚇"}</span>
<span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{en ? `${trText(st.name)} Station` : `${st.name}站`}</span><span className="block truncate text-[11px] text-[var(--dim)]">{st.lines.join(" · ")}</span></span>
<span className="shrink-0 text-[11px] font-black text-[var(--accent2)]">在线网图规划 →</span>
</button>
))}
</div>
);
})()}
</div>
<MapView extraControls={<><button type="button" onClick={toggleSound} aria-pressed={soundIsOn} aria-label={soundIsOn ? (en ? "Mute" : "静音") : (en ? "Sound on" : "打开声音")} data-tip={soundIsOn ? (en ? "Sound on · tap to mute" : "声音开着 · 点一下静音") : (en ? "Muted · tap for music" : "已静音 · 点一下开声音")} className={`tipbtn grid h-9 w-9 place-items-center rounded-full border text-base shadow ${soundIsOn ? "border-black/40 bg-[#fffdf8]/95" : "border-[var(--accent)] bg-[#14202b]/95"}`}>{soundIsOn ? "🔊" : "🔇"}</button><span className="relative"><button type="button" onClick={() => setMusicOpen((o) => !o)} aria-expanded={musicOpen} aria-label={en ? "Change music" : "换背景音乐"} data-tip={en ? "Change music" : "换背景音乐"} className="tipbtn grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 text-base shadow">🎵</button>
</span></>} lite={lite} pinLocId={pinLoc} onPinClear={() => setPinLoc(null)} scenic={scenicMoment ? (() => { const m = scenicMoment.m; const l = locById(currentLoc); /* look out past the spot (over the water for sea views), from a little above the rooftops */ const az = m.faceSea && !m.path ? seawardAz(s.cityKey, l.x, l.z, m.az) : m.az; const ox = -Math.sin(az) * m.dist * 0.75, oz = -Math.cos(az) * m.dist * 0.75; return { x: (m.path ? m.path[0]![0] : l.x) + ox, z: (m.path ? m.path[0]![1] : l.z) + oz, phase: m.phase, az, pol: m.path ? Math.min(m.pol, 1.08) : 0.9, dist: m.path ? m.dist : m.dist * 2.1, path: m.path, durMs: m.durMs, nonce: scenicMoment.nonce }; })() : null} mapMode={mapMode} onMapMode={setMapMode} fill paused={!!lifeAnim} train={carriage ? { pts: carriage.route.stations.map((st) => [st.x, st.z] as [number, number]), idx: carriage.stopIdx, stepMs: hopMs(carriage.route, carriage.stopIdx), color: (carriage.route.legs[carriage.legIdx]?.line ?? carriage.route.line).color, rail: carriage.route.legs.some((l) => ["szhz-rail", "guangshen", "hz-intercity", "ganshen-rail", "guangshan-rail", "hsr-hk"].includes(l.line.id)), hold: rideEntry !== null || carriage.awaitingTransfer || carriage.stopIdx >= carriage.route.stations.length - 1 } : null} cityKey={s.cityKey} selfLocId={walking || carriage ? (tripTo ?? selectedLoc) : currentLoc} selfEmoji={iden.emoji} selfColor={iden.color} selfName={profile?.name ?? "我"} remotePlayers={remotePlayers} billboards={boards} selfOutfitId={s.outfit} selfHair={s.hair} selfAccessory={ACCESSORIES[s.accessory ?? 0]?.id ?? "none"} travelModeId={tripMode ?? travelMode} selfEtaAt={tripEta ?? undefined} arrival={arrival} weatherKind={rwOk ? realWeather!.kind : "unknown"} npcMoodEmoji={Object.fromEntries(npcsForCity(s.cityKey).map((n) => [n.name, moodEmoji(memOf(s.npcMem ?? {}, n.name).mood)]))} apecDay={isApecWeek(s.day)} focusLocId={mapFocus?.locId} focusX={mapFocus?.x} focusZ={mapFocus?.z} focusNonce={mapFocus?.nonce} destLocId={selectedLoc} onSelect={walkTo} onPickActor={pickActor} navOverlay={(
<>
{/* 弹幕层：联机动态 / 聊天 / 街坊发言飘过地图上半区 */}
{danmakuOn && !scenicMoment && (
<div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[14] overflow-hidden">
{danmaku.map((d) => (
<span key={d.id} className="danmaku-item" style={{ top: `${d.top}%`, animationDuration: `${d.dur}s`, color: d.color }}>{d.text}</span>
))}
</div>
)}
{/* 奖励飘字层 */}
<div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[16%] z-[16] flex flex-col items-center gap-1">
{floaters.map((f) => (
<span key={f.id} className="floater" data-tone={f.tone}>{f.text}</span>
))}
</div>
{/* 左侧中段控制簇：出行导航 + 弹幕开关（不在顶部，不挡地图中心） */}
{!asideOpen && !scenicMoment && (
<div className={`feature-rail right-cluster absolute right-2.5 z-20 flex flex-col items-center gap-1.5 ${barsHidden ? "top-[64px]" : "top-[150px]"}`}>
{([["place", "📍", "地点", "Place"], ["feed", "🏘️", "动态", "Feed"], ["wall", "🧑‍🤝‍🧑", "街坊", "Locals"], ["chat", "💬", "聊天", "Chat"], ["board", "🏆", "排行", "Ranks"], ["guide", "📖", "图鉴", "Guide"]] as const).map(([k, icon, label, labelEn]) => (
<button key={k} type="button" aria-label={en ? labelEn : label} onClick={() => { setAsideTab(k); setAsideOpen(true); }} className="rail-btn"><span aria-hidden="true" className="text-[19px] leading-none">{icon}</span><span className="rail-label">{en ? labelEn : label}</span></button>
))}
</div>
)}
<div className={`left-cluster feature-rail absolute left-2.5 z-20 flex flex-col items-center gap-1.5 ${barsHidden ? "top-[64px]" : "top-[150px]"}${scenicMoment ? " hidden" : ""}`}>
{([
  { k: "hub", icon: "🧭", zh: "做什么", en: "To do", on: () => { setHubOpen(true); track("hub_open"); }, dot: false, hot: true },
  { k: "nav", icon: "🚶", zh: navOpen ? "收起" : "出行", en: navOpen ? "Close" : "Go", on: () => setNavOpen((o) => !o), dot: false, hot: navOpen },
  { k: "gigs", icon: "💼", zh: "零工", en: "Gigs", on: () => setGigsOpen(true), dot: gigActive > 0 || isPrime(), hot: false },
  { k: "party", icon: "🎉", zh: "组局", en: "Parties", on: () => setPartyOpen(true), dot: parties.some((pt) => pt.status === "open"), hot: false },
  { k: "stamps", icon: "🎫", zh: "集章", en: "Stamps", on: () => { setAsideTab("collect"); setAsideOpen(true); }, dot: false, hot: false },
  { k: "store", icon: "✨", zh: "商店", en: "Store", on: () => setStoreOpen(true), dot: false, hot: false },
] as const).map((it) => (
<button key={it.k} type="button" onClick={it.on} aria-label={en ? it.en : it.zh} className={`rail-btn${it.hot ? " rail-hot" : ""}`}><span aria-hidden="true" className="text-[19px] leading-none">{it.icon}</span><span className="rail-label">{en ? it.en : it.zh}</span>{it.dot && <span className="red-dot" />}</button>
))}
</div>
{navOpen && (
<div className="absolute left-3 top-[13%] z-20 flex max-h-[74%] w-[min(332px,calc(100%-24px))] flex-col rounded-[16px] border border-black/40 bg-[#0b1622]/95 p-3 text-white shadow-2xl">
<div className="mb-1 flex items-center justify-between gap-2">
<p className="text-xs font-black">🧭 出行导航</p>
<button type="button" aria-label={navPinned ? "取消固定出行导航" : "固定出行导航"} aria-pressed={navPinned} title={navPinned ? "已固定：选地点后不收起；再点取消" : "固定：选了地点出发后面板也不收起"} onClick={() => togglePin("nav")} className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-black ${navPinned ? "bg-white text-[#14202b]" : "border border-white/25 bg-white/10"}`}>📌 {navPinned ? "已固定" : "固定"}</button>
<button type="button" aria-label="收起出行导航" onClick={() => setNavOpen(false)} className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-black">收起 ✕</button>
</div>
<div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
<span className="rounded-full bg-white/10 px-2 py-1">📍 {city.name} · {getLocations(s.cityKey).length} 个地点（双城共 {getLocations("sz").length + getLocations("hz").length} 个，含口岸/山区/风景区）</span>
<span className="rounded-full bg-white/10 px-2 py-1">🟢 同城真人 {onlineHere.length} 人（含你）</span>
<span className="rounded-full bg-white/10 px-2 py-1">🧑‍🤝‍🧑 街坊 NPC {npcsForCity(s.cityKey).length} 位也在图上散步（名字后是今日心情）</span>
{walking && <span className="rounded-full bg-[var(--accent)] px-2 py-1">🚶 正在走过去…</span>}
</div>
<p className="mt-2.5 text-[11px] font-black tracking-wide text-white/70">出行方式 · 选好再点地点（或直接点地图上的建筑/标签前往）</p>
<div className="mt-1.5 flex flex-wrap gap-1.5">
{modesForCity(s.cityKey).map((m) => (
(() => { const h = modeHours(m.id, s.cityKey); const off = h && !inWindow(nowMin(), h); return <button key={m.id} type="button" aria-label={`出行方式${m.name}，速度${m.speedTag}`} title={off ? `现在停运 · 运营 ${windowStr(h!)}（北京时间），选了会自动改打车` : undefined} aria-pressed={travelMode === m.id} onClick={() => setTravelMode(m.id)} className={`rounded-full border px-2.5 py-1.5 text-xs font-bold ${travelMode === m.id ? "border-transparent bg-[var(--accent)] text-white" : "border-white/25 bg-white/10 text-white"}${off ? " opacity-50" : ""}`}>{m.emoji} {m.name} · {off ? (en ? `closed · from ${windowStr(h!).split(/[–-]/)[0]}` : `停运 · ${windowStr(h!).split(/[–-]/)[0]} 起`) : m.speedTag}</button>; })()
))}
</div>
<p className="mt-1.5 text-[11px] leading-relaxed text-white/70">{modesForCity(s.cityKey).find((m) => m.id === travelMode)?.desc} · 速度差别是真的：步行最慢，跑步快一半，骑行再快近一倍，电动车/公交再快，打车、自驾和{railWord(s.cityKey)}更快，高铁/城际最快——地图上人物的移动速度、实际到达时间都按这个来。公交/打车/自驾/{railWord(s.cityKey)}/高铁搭乘时都会弹车厢动画；自驾是坐进驾驶座自己开，跟车流一起等红灯、到了找车位。</p>
{selectedLoc !== currentLoc && (() => {
const fromL = locById(currentLoc); const toL = locById(selectedLoc);
const d = Math.hypot(toL.x - fromL.x, toL.z - fromL.z);
const railPlan = planRailTrip(s.cityKey, currentLoc, selectedLoc);
const rows = modesForCity(s.cityKey).map((m) => {
let eta: number | null = etaMinutes(m.id, d);
if (m.id === "metro") eta = railPlan ? Math.max(1, Math.round(railPlan.route.stops * 2 + 7)) : null;
if (m.id === "rail") eta = railPlan ? Math.max(1, Math.round(railPlan.route.stops * 1.1 + 12)) : null;
return { m, eta };
}).sort((a, b) => (a.eta ?? 9999) - (b.eta ?? 9999));
return (
<div className="mt-2 rounded-[10px] bg-white/10 px-2.5 py-2">
<p className="text-[11px] font-black text-white/85">⏱️ 去「{toL.short}」预计耗时对比（点方式直接切换）</p>
<div className="mt-1.5 flex flex-wrap gap-1.5">
{rows.map(({ m, eta }) => (
<button key={m.id} type="button" aria-label={`用${m.name}去${toL.name}，预计${eta === null ? "无路线" : `约${eta}分钟`}`} onClick={() => setTravelMode(m.id)} className={`rounded-full border px-2 py-1 text-[11px] font-bold ${travelMode === m.id ? "border-transparent bg-[var(--accent)] text-white" : "border-white/25 bg-white/5 text-white/90"}`}>{m.emoji} {m.name} {eta === null ? "· 需先到站" : `· 约${eta}分钟`}</button>
))}
</div>
<p className="mt-1.5 text-[10.5px] leading-relaxed text-white/60">含等车/进站安检等固定开销：飞机飞得快但值机要 50 分钟，短途反而最慢；{railWord(s.cityKey)}/高铁按实际规划的站数算。</p>
</div>
);
})()}
<p className="mt-1.5 rounded-[8px] bg-emerald-400/15 px-2 py-1.5 text-[11px] font-bold leading-relaxed text-emerald-200">🚲 骑行全图开通：本城 {getLocations(s.cityKey).length} 个地点——山顶、海滩、老街、景区——全都能骑到；余额不够付骑行费时免费骑，绝不拦路。</p>
<p className="mt-2.5 text-[11px] font-black tracking-wide text-white/70">去哪里 · 点了就出发，选中的地点详情在右侧「📍 地点」里</p>
<div className="mt-1.5 flex min-h-0 flex-wrap content-start gap-1.5 overflow-y-auto pr-0.5">
{getLocations(s.cityKey).map((l) => (
<button key={l.id} type="button" aria-label={`前往${l.name}`} onClick={() => { if (!navPinnedRef.current) setNavOpen(false); walkTo(l.id); }} className={`rounded-full border px-2.5 py-1.5 text-xs font-bold ${l.id === selectedLoc ? "border-transparent bg-white text-[#14202b]" : "border-white/25 bg-white/10 text-white"}`}>
{l.emoji} {l.short}{world?.online.some((pl) => pl.cityKey === s.cityKey && pl.locId === l.id && pl.id !== myId) ? " ·有人" : ""}
</button>
))}
</div>
</div>
)}
</>
)} />
</div>

</section>

{/* Aside: one unified regional panel — place details + log / world
    feed / NPC wall / chat / board. It never hides: collapsed it folds
    VERTICALLY into a slim strip on the right edge (tab icons + vertical
    「地区面板」 label), always visible, one tap to expand back; the map
    takes the whole width either way. */}
<>
{asideOpen && (
<>
{<button type="button" aria-label="点空白处把地区面板竖着收起成右侧竖条" onClick={() => setAsideOpen(false)} className="fixed inset-0 z-[35] cursor-default bg-black/15" />}
<div className="float-panel fixed bottom-3 right-3 top-[76px] z-40 flex w-[430px] max-w-[calc(100vw-24px)] flex-col overflow-y-auto overflow-x-hidden rounded-[18px] border-2 border-[var(--border)] p-4 shadow-2xl">
<div className="mb-2.5 flex items-center justify-between gap-2">
<p className="text-xs font-black tracking-wide text-[var(--dim)]">🗺️ 地区面板 · {selLoc.emoji} {selLoc.short}一带</p>
<button type="button" aria-label={asidePinned ? "取消固定收起" : "固定收起地区面板"} aria-pressed={asidePinned} title={asidePinned ? "已固定收起：面板不会自动弹出；再点取消" : "固定收起：以后选地点、搜索都不自动弹出面板，只有点右侧竖条才展开"} onClick={() => { if (!asidePinned) setAsideOpen(false); togglePin("aside"); }} className={`ml-auto shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-black ${asidePinned ? "bg-[var(--text)] text-[var(--bg)]" : "border border-[var(--line)] bg-[var(--surface)]"}`}>📌 {asidePinned ? "已固定收起" : "固定收起"}</button>
<button type="button" aria-label="竖着收起地区面板，收成屏幕右侧的竖条，点竖条随时展开" title="竖着收起成右侧竖条，一直留在屏幕边上，点一下就展开" onClick={() => setAsideOpen(false)} className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-black transition hover:border-[var(--border)]">竖收起 »</button>
</div>
<div className="grid grid-cols-6 gap-1 rounded-full bg-[var(--surface2)] p-1" role="tablist" aria-label="地点与联机面板">
{([["place", "📍 地点"], ["collect", "🎫 集章"], ["feed", "🏘️ 动态"], ["wall", "🧑‍🤝‍🧑 街坊墙"], ["chat", "💬 聊天"], ["board", "🏆 排行"], ["guide", "📖 图鉴"]] as const).map(([k, label]) => (
<button key={k} type="button" role="tab" aria-selected={asideTab === k} onClick={() => setAsideTab(k)} className={`min-w-0 rounded-full px-0.5 py-2 text-center text-[11px] font-black leading-tight min-[420px]:text-xs ${asideTab === k ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--dim)]"}`}>{label}</button>
))}
</div>

{asideTab === "place" && (
<div className="mt-3 max-h-[calc(100vh-190px)] min-w-0 overflow-y-auto overflow-x-hidden pr-1">
<div>
<div className="flex items-start gap-3">
<div className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] text-3xl" style={{ background: hexCss(selLoc.color) + "2b" }}>{selLoc.emoji}</div>
<div className="min-w-0 flex-1">
<h3 className="font-display break-words text-xl font-black">{selLoc.type === "home" ? homeName(s) : selLoc.name}</h3>
{(LOC_EN[selLoc.name] || LOC_GRADE[selLoc.name]) && selLoc.type !== "home" && (
<p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--dim)]">
{LOC_EN[selLoc.name] && <span className="font-semibold tracking-wide">{LOC_EN[selLoc.name]}</span>}
{LOC_GRADE[selLoc.name] && <span className="chip" style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>🏅 {LOC_GRADE[selLoc.name]}</span>}
</p>
)}
<p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">
{selLoc.type === "home" ? `你现在的家：周租 ${fmt(rentDue)}，舒适度 ${computeComfort(s)}，已买家具 ${s.furniture.length} 件。睡觉回能量，也能在这儿按 ZhuyaHome 的样子装修。` : selLoc.desc}
</p>
{adHere && (
<div className="mt-2">
<p className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#e63a1f] to-[#f59e0b] px-1.5 py-1 text-[11px] font-black text-white">
<span className="shrink-0 rounded-full bg-white px-1.5 py-px text-[10px] tracking-wide text-[#e63a1f]">{en ? "AD" : "广告"}</span>
<span className="min-w-0 flex-1">{adHere.emoji} {adHere.text}</span>
<span className="shrink-0 text-[10px] font-bold text-white/85">{adHere.owner}</span>
</p>
{adHere.kind === "sanhe" && <p className="mt-1 text-[11px] leading-relaxed text-[var(--dim)]">{en ? said.en : said.zh}</p>}
<div className="mt-1.5 flex flex-wrap gap-1.5">
{adHere.kind === "hire" && adHere.go && !arrived && <button type="button" onClick={() => walkTo(adHere.go!)} className="rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-black text-[var(--bg)]">{en ? "Go interview" : "去这家面试"}</button>}
{adHere.kind === "hire" && arrived && companyAt(s.cityKey, selLoc.id) && <button type="button" disabled={s.energy < 12} onClick={() => doAction("interview")} className="rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-black text-[var(--bg)] disabled:opacity-40">{en ? "Apply" : "投简历"}</button>}
{adHere.kind === "rent" && !arrived && <button type="button" onClick={() => walkTo("home")} className="rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-black text-[var(--bg)]">{en ? "See the room" : "去看这间"}</button>}
{adHere.kind === "rent" && arrived && <button type="button" onClick={askRent} className="rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-black text-[var(--bg)]">{en ? "Ask the rent" : "问问房租"}</button>}
{adHere.kind === "sale" && <button type="button" onClick={() => { if (!arrived && adHere.go) walkTo(adHere.go); else askSale(); }} className="rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-black text-[var(--bg)]">{arrived ? (en ? "Today's price" : "看看特价") : (en ? "Go to the stall" : "去摊位")}</button>}
{adHere.kind === "sanhe" && !arrived && adHere.go && <button type="button" onClick={() => walkTo(adHere.go!)} className="rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-black text-[var(--bg)]">{en ? "Go stand a shift" : "去站一天"}</button>}
{adHere.kind === "sanhe" && arrived && <button type="button" disabled={s.energy < 22 || (s.sanheDay ?? 0) === s.day} onClick={takeSanhe} className="rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-black text-[var(--bg)] disabled:opacity-40">{(s.sanheDay ?? 0) === s.day ? (en ? "Settled today" : "今天结过了") : (en ? `Stand a shift · ${fmt(sanhePay(s.cityKey))}` : `站一天 · 日结 ${fmt(sanhePay(s.cityKey))}`)}</button>}
</div>
</div>
)}
{(selLoc.er || selLoc.tel || selLoc.addr || selLoc.hours) && (
<p className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-bold">
{selLoc.er && <span className="chip" style={{ borderColor: "#dc2626", color: "#dc2626" }}>🚑 24 小时急诊 · Emergency</span>}
{selLoc.tel && <a href={`tel:${selLoc.tel.replace(/[^+\d]/g, "")}`} className="chip">📞 {selLoc.tel}</a>}
{selLoc.addr && <span className="chip">📍 {selLoc.addr}</span>}
{selLoc.hours && <span className="chip">🕐 {selLoc.hours}</span>}
</p>
)}
</div>
<span className={`shrink-0 text-xs font-black ${arrived ? "text-[var(--green)]" : "text-[var(--accent)]"}`}>{walking ? "🚶 赶路中…" : arrived ? "● 你在这里" : "未到达"}</span>
</div>
{arrived && (() => { const rainyNow = nowRainy; const want = rainyNow ? "raincoat" : selLoc.type === "work" ? "formal" : selLoc.type === "gym" ? "sport" : selLoc.type === "home" ? "pajamas" : null; if (!want || s.outfit === want) return null; const wo = outfitOf(want); return (
<p className="mt-2 flex flex-wrap items-center gap-2 rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-xs font-bold">👕 场合提示：这里更适合穿「{wo.name}」（{wo.scene}），你现在穿的是「{outfitOf(s.outfit).name}」。
<button type="button" aria-label={`按场合换上${wo.name}`} onClick={() => buyOutfit(want)} className="rounded-full bg-[var(--text)] px-3 py-1 text-[11px] font-black text-[var(--bg)]">{s.ownedOutfits.includes(want) ? `换上${wo.name}` : `${fmt(wo.price)} 买下穿上`}</button></p> ); })()}
{!arrived && !walking && (() => { const cur = locById(currentLoc); const d = Math.hypot(selLoc.x - cur.x, selLoc.z - cur.z); const tm = modesForCity(s.cityKey).find((m) => m.id === travelMode) ?? modeById(travelMode); return (
<button type="button" onClick={() => walkTo(selLoc.id)} className="mt-3 w-full rounded-full bg-[var(--text)] py-3 text-sm font-black text-[var(--bg)]">{en ? `${tm.emoji} Go by ${trText(tm.name)} → · about ${etaMinutes(travelMode, d)} min (${trText(tm.speedTag)})` : `${tm.emoji} ${tm.name}过去 → · 预计约 ${etaMinutes(travelMode, d)} 分钟（${tm.speedTag}）`}</button>
); })()}
{(() => { const g = guideForLocName(selLoc.name); if (!g) return null; return <ExperienceCard g={g} here={arrived} unlocked={(s.album ?? []).includes(g.key)} onCheckin={() => checkinGuide(g)} />; })()}
<p className="mt-3.5 flex items-baseline justify-between gap-2"><span className="text-xs font-black tracking-wide">📍 在这里能做 · 常用操作</span><span className="text-[11px] font-bold text-[var(--dim)]">{arrived ? "点一下就行动" : "到了才能做"}</span></p>
<div className="mt-2 grid gap-2">
{actionsFor(selLoc, s).map((a) => { const own = a.kind.startsWith("__routine-") && (a.kind !== "__routine-wait" || routineRole(s.idenId) === "driver") || a.kind.startsWith("__rider-") || a.kind.startsWith("__scenic-") || a.kind === "__livehouse" || a.kind === "__venue3d"; /* the rider's own steps don't depend on the shop's hours; a taxi passenger waves from anywhere, any hour */ const tb = timeBlock(a.kind, s) ?? (a.kind === "__sleep" || a.kind === "rest" || own ? null : venueClosed(selLoc)); return (
<button key={a.kind + (a.arg ?? 0)} type="button" disabled={!arrived || a.disabled || !!tb} onClick={() => { if (a.kind === "__sleep") playLifeAnim("sleep", () => doSleep()); else if (a.kind.startsWith("__gocity-")) setCrossTo(a.kind.slice("__gocity-".length) as CityKey); else if (a.kind.startsWith("__routine-")) doRoutine(a.kind.slice("__routine-".length)); else if (a.kind === "__rider-go") riderGo(); else if (a.kind === "__retrain") setRetrainOpen(true); else if (a.kind.startsWith("__scenic-")) startScenic(a.kind.slice("__scenic-".length)); else if (a.kind === "__livehouse") setLiveOpen(true); else if (a.kind === "__flea") { setFleaOpen(true); void fleaQuery.refetch(); } else if (a.kind === "__home3d") { publishHome(); setHomeGuest(null); setVisitHome(null); setHomePose("idle"); setHome3d(true); } else if (a.kind === "__venue3d") { const vs = venueFor(selLoc); if (vs) setVenueTalk(null), setVenue3d({ set: vs.set, name: en ? trText(selLoc.name) : selLoc.name, line: en ? vs.en : vs.zh, id: selLoc.id, emoji: selLoc.emoji, color: selLoc.color }); } else if (a.kind === "__rider-cancel") { const g0 = gsRef.current; if (g0) { const rd0 = routineToday(g0); mutate((x) => { x.routine = { ...rd0, order: null }; x.money -= 2; x.mood = clamp(x.mood - 3, 0, 100); }); showToast(en ? "Order cancelled (−¥2)." : "这单取消了，平台扣了 ¥2。"); } } else if (a.kind.startsWith("__cross-")) { const r = CROSS_ROUTES.find((x) => x.id === a.kind.slice("__cross-".length)); if (r) takeRoute(r); } else doAction(a.kind, a.arg ?? 0); }} className="act-btn">
<span className="flex items-center justify-between text-sm font-black"><span>{a.title}</span><span>{a.emoji}</span></span>
<span className="mt-0.5 block text-xs leading-relaxed text-[var(--dim)]">{a.desc}</span>
<span className="mt-1 block text-xs font-bold text-[var(--accent2)]">{a.cost}{a.kind !== "__sleep" && ` · ⏳ ${realMinLabel(actionMinutes(a.kind))}`}</span>
{tb && <span className="mt-0.5 block text-[11px] font-bold text-[var(--accent)]">⏰ {tb}</span>}
</button>
); })}
</div>
{/* round-2: Sanhe board / job center / small joys / police patrol */}
{arrived && (
<div className="mt-3 flex flex-wrap gap-2">
{adHere?.kind === "sanhe" && <button type="button" onClick={() => setSanheOpen(true)} className="rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">🏚️ 三和大神板 · 日结 / 床位 / 搭子</button>}
{isJobCenterPlace(selLoc) && <button type="button" onClick={() => setJobCenterOpen(true)} className="rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">💼 就业服务中心</button>}
{SMALL_JOYS.filter((j) => !j.at || j.at(selLoc)).map((j) => (
<button key={j.id} type="button" disabled={s.energy < (j.energy ?? 0)} onClick={() => { const r = doSmallJoy(s.life ?? defaultLifestyleState(), j.id, s.day, selLoc, nowMin()); applyLife(r); }} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black disabled:opacity-40">{j.emoji} {j.name[0]} · {j.energy ? `能量 -${j.energy}` : "免费"}</button>
))}
{patrolling && <button type="button" onClick={() => { const rec = observe(selLoc.id); showToast(rec ? "已把这个地点记进巡逻日志。" : "盯不上这个地点（ID 不合规或没在巡逻）。"); }} className="rounded-full border border-[var(--accent)] px-3 py-2 text-xs font-black text-[var(--accent)]">👁️ 巡逻记录这里</button>}
</div>
)}
{(() => { const acts = activitiesAt(selLoc); if (!acts.length) return null; const openHere = parties.filter((pt) => pt.locId === selLoc.id && pt.status === "open"); const cats = [...new Set(acts.map((a) => a.cat))] as ActCat[]; return (
<div className="mt-4">
<p className="flex items-baseline justify-between gap-2"><span className="text-xs font-black tracking-wide">{en ? `🎮 Things to do here · ${acts.length}` : `🎮 在这里能玩 · ${acts.length} 个`}</span><span className="text-[11px] font-bold text-[var(--dim)]">{en ? "Play solo, or open a party" : "自己玩，或者组局等人"}</span></p>
{openHere.map((pt) => { const a = activityById(pt.activityId); const mine = pt.members.some((m) => m.id === myId); return (
<p key={pt.id} className="mt-2 flex items-center gap-2 rounded-[12px] border-2 border-[var(--accent)] bg-[var(--surface2)] px-3 py-2 text-xs font-bold"><span className="min-w-0 flex-1">🎉 {en ? `Party here: ${a?.name[1] ?? ""} · ${pt.members.map((m) => m.name).join(", ")}` : `这里有个局：${a?.name[0] ?? ""} · ${pt.members.map((m) => m.name).join("、")}`}</span>
{mine ? <span className="shrink-0">{en ? "You're in" : "已加入"}</span> : <button type="button" onClick={() => joinPartyNow(pt)} className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-black text-white">{en ? "Join" : "加入"}</button>}</p> ); })}
{cats.map((c) => (
<div key={c} className="mt-2">
<p className="text-[11px] font-black text-[var(--dim)]">{L2t(CAT_LABEL[c])}</p>
<div className="mt-1 grid gap-2 sm:grid-cols-2">
{acts.filter((a) => a.cat === c).map((a) => { const why = actBlock(a, s, arrived, selLoc); const groupable = !NO_PARTY.has(a.id) && a.cat !== "date"; return (
<div key={a.id} className="rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-2.5">
<p className="text-sm font-black">{a.emoji} {L2t(a.name)}</p>
<p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">{L2t(a.desc)}</p>
<p className="mt-1 text-[11px] font-bold text-[var(--accent2)]">{[a.cost ? `¥${a.cost}` : (en ? "Free" : "免费"), a.energy > 0 ? `${en ? "Energy" : "能量"} -${a.energy}` : a.energy < 0 ? `${en ? "Energy" : "能量"} +${-a.energy}` : "", `⏳ ${en ? `${+(cooldownMs(a.min) / 60000).toFixed(1)} min` : realMinLabel(a.min)}`, a.money ? `${en ? "earn up to" : "最多赚"} ¥${Math.round(a.money * CITIES[s.cityKey].payMul)}` : "", a.risk ? (en ? "⚠️ risky" : "⚠️ 有风险") : ""].filter(Boolean).join(" · ")}</p>
{why && <p className="mt-0.5 text-[11px] font-bold text-[var(--accent)]">⏰ {why}</p>}
<div className="mt-1.5 flex gap-1.5">
<button type="button" disabled={!!why} onClick={() => startActivity(a)} className="flex-1 rounded-full bg-[var(--text)] py-1.5 text-xs font-black text-[var(--bg)] disabled:opacity-40">{a.needs === "date" ? (en ? "💕 Ask someone" : "💕 约人") : (en ? "▶ Play" : "▶ 自己玩")}</button>
{groupable && <button type="button" disabled={!!why} onClick={() => hostParty(a)} className="flex-1 rounded-full border-2 border-[var(--text)] py-1.5 text-xs font-black disabled:opacity-40">{en ? "👥 Open a party" : "👥 组局"}</button>}
</div>
</div> ); })}
</div>
</div>
))}
</div> ); })()}
{(() => {
const svc = nearbyServices(s.cityKey, selLoc.id).filter((r) => r.id !== selLoc.id);
if (svc.length === 0) return null;
const er = svc.find((r) => r.place.kind === "hospital");
return (
<Fold title="🆘 附近服务 · Emergency & Services" summary={`急救 120 · 报警 110${er ? ` · 最近医院：${er.place.name}` : ""}`} groupKey={`svc-${selLoc.id}`} defaultOpen={selLoc.type === "apec"}>
<div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
{([["120", "🚑", "急救", "Ambulance"], ["110", "🚓", "报警", "Police"], ["119", "🚒", "火警", "Fire"], ["12345", "☎️", "市民热线", "City hotline"]] as const).map(([n, e, zh, en]) => (
<a key={n} href={`tel:${n}`} className="rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-2 py-1.5 text-center"><span className="block text-sm font-black">{e} {n}</span><span className="block text-[10px] font-bold text-[var(--dim)]">{zh} · {en}</span></a>
))}
</div>
<div className="mt-2 grid gap-1.5">
{svc.map((r) => { const k = PLACE_KINDS[r.place.kind]; return (
<button key={r.id} type="button" disabled={walking} onClick={() => walkTo(r.id, r.dist < 1.6 ? "walk" : undefined)} className="act-btn disabled:opacity-40">
<span className="text-sm font-bold">{k.emoji} {r.place.name}{r.place.er ? " · 🚑 急诊" : ""}</span>
{r.place.en && <span className="block text-[11px] text-[var(--dim)]">{r.place.en}</span>}
<span className="block text-xs text-[var(--dim)]">{k.label} · 约 {Math.max(0.1, r.dist).toFixed(1)} 公里 · 近「{r.place.st.replace(/站$/, "")}」站{r.place.tel ? ` · 📞 ${r.place.tel}` : ""}{r.place.addr ? ` · ${r.place.addr}` : ""}</span>
</button>
); })}
</div>
<p className="mt-2 text-[11px] leading-relaxed text-[var(--dim)]">医院、药店、派出所的位置和电话来自 OpenStreetMap，可能有变动；身体不适或紧急情况请直接拨打 120 / 110。Locations from OpenStreetMap; in an emergency call 120 (ambulance) or 110 (police).</p>
</Fold>
);
})()}
{(() => {
const near = nearbyPlaces(s.cityKey, selLoc.id, 6);
if (near.length === 0) return null;
return (
<Fold title="🧭 附近可去" summary={near.slice(0, 3).map((r) => r.place.name).join("、")} groupKey={`near-${selLoc.id}`} defaultOpen={selLoc.type === "transit"}>
<div className="grid gap-2">
{near.map((r) => { const k = PLACE_KINDS[r.place.kind]; const km = r.dist; return (
<button key={r.id} type="button" disabled={walking} onClick={() => walkTo(r.id, km < 1.6 ? "walk" : undefined)} className="act-btn disabled:opacity-40">
<span className="text-sm font-bold">{k.emoji} {r.place.name}</span>
<span className="block text-xs text-[var(--dim)]">{k.label} · 离这里约 {km < 0.1 ? "0.1" : km.toFixed(1)} 公里 · {km < 1.6 ? `步行约 ${Math.max(1, Math.round(km * 1.3 / 0.075))} 分钟` : "用下方选好的出行方式过去"}</span>
</button>
); })}
</div>
</Fold>
);
})()}
{arrived && selLoc.type === "transit" || arrived && selLoc.type === "port" ? (
<Fold title={s.cityKey === "hz" ? "🚆 城际 · 高铁线路与出发" : s.cityKey === "hk" ? "🚇 港铁线路与出发" : "🚇 线路与坐车出发"} summary={`${linesForLoc(s.cityKey, selLoc.id).length} 条线经过 · 点开选目的地进车厢`} groupKey={`transit-${selLoc.id}`} defaultOpen>
<p className="text-sm font-bold">{s.cityKey === "hz" ? "🚆" : "🚇"} 这里经过的线路</p>
{linesForLoc(s.cityKey, selLoc.id).length === 0 && selLoc.id !== "metro" && selLoc.id !== "north" && selLoc.id !== "hzsouth" ? <p className="mt-1 text-xs text-[var(--dim)]">{s.cityKey === "hz" ? "本站以公路/接送为主；打开手机「城轨通」看城际/高铁线网，或走到城轨站、惠州南站坐车。" : s.cityKey === "hk" ? "本站以巴士/接送为主；打开手机「港铁通」看港铁线网，或走到就近的港铁站坐车。香港只有港铁，没有地铁。" : "本站以公路/接送为主；打开手机「地铁通」看全线网，或走到地铁站坐车。"}</p> : null}
<div className="mt-2 flex flex-wrap gap-1.5">{linesForLoc(s.cityKey, selLoc.id).map((l) => <span key={l.id} className="chip" style={{ borderColor: l.colorCss }}><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: l.colorCss }} />{l.name}</span>)}{s.cityKey === "sz" && selLoc.id === "metro" && <span className="text-xs text-[var(--dim)]">市中心换乘站：1/2/3/4/5/9/11号线在此交汇（见手机地铁通全线）</span>}{s.cityKey === "hz" && selLoc.id === "metro" && <span className="text-xs text-[var(--dim)]">莞惠城际停靠站：往西去东莞，往北到惠州北站（可换乘赣深高铁）；去深圳的高铁在惠州南站坐——两站之间有接驳巴士，路线规划会自动算上。</span>}{selLoc.id === "north" && <span className="text-xs text-[var(--dim)]">4/5/6号线 + 厦深高铁：坐高铁约半小时到惠州南站——点顶部「🚄 去惠州」就能切换到惠州过日子，钱和进度都带着走。</span>}{selLoc.id === "hzsouth" && <span className="text-xs text-[var(--dim)]">厦深高铁 + 广汕高铁大站：半小时回深圳北。回深圳过日子点顶部「🚄 去深圳」；去坐城际要先坐接驳巴士到惠州北站，坐车时路线会自动规划这段接驳。</span>}</div>
{allMetroDestinations(s.cityKey, selLoc.id).length > 0 && (
<div className="mt-3"><p className="text-xs font-black tracking-wide text-[var(--dim)]">坐{s.cityKey === "hz" ? "城轨/高铁" : "地铁/城轨"}出发（含换乘规划，点一下进车厢，一次坐到底）</p>
<div className="mt-2 grid gap-2">
{allMetroDestinations(s.cityKey, selLoc.id).slice(0, 12).map(({ locId, route }) => (
<button key={locId} type="button" onClick={() => startMetroRide(selLoc.id, locId)} className="act-btn">
<span className="text-sm font-bold">{locById(locId).emoji} {locById(locId).name}</span>
<span className="block text-xs text-[var(--dim)]"><span style={{ color: route.line.colorCss }}>● {route.summary}</span> · {route.stops} 站{route.isTransfer ? ` · ${route.transferStations.join("、")}换乘` : ""}{route.shuttleFrom.length > 0 ? " · 含站外接驳巴士" : ""} · 票价 {Y}{Math.round(route.fare * policyRef.current.metro)} · 进车厢乘车</span>
</button>
))}
</div></div>
)}
</Fold>
) : null}
{arrived && selLoc.type === "food" ? (
<Fold title="🍽️ 堂食 · 外卖" summary={`${RESTAURANTS.filter((r) => r.cities.includes(s.cityKey)).length} 家店可以走进去吃 · 外卖 ${DELIVERY_PLATFORMS.length} 个平台`} groupKey={`food-${selLoc.id}`}>
<p className="text-sm font-bold">🍽️ 走进饭店堂食（点一家走进去坐下吃）</p>
<div className="mt-2 grid gap-2">
{RESTAURANTS.filter((r) => r.cities.includes(s.cityKey)).map((r) => (
<button key={r.id} type="button" onClick={() => setVenueScene({ kind: "dine", id: r.id })} className="act-btn">
<span className="text-sm font-bold">{r.emoji} {r.name} <span className="text-[var(--accent)]">{r.tier}</span></span>
<span className="block text-xs text-[var(--dim)]">{r.cuisine} · {r.region} · {r.tables}</span>
</button>
))}
</div>
<p className="mt-3 text-xs font-black tracking-wide text-[var(--dim)]">不想出门？点外卖（选平台 × 菜品）</p>
{DELIVERY_PLATFORMS.map((plat, pi) => (
<div key={plat.id} className="mt-2 flex flex-wrap items-center gap-2">
<span className="chip">{plat.emoji} {plat.name}</span><span className="text-[11px] text-[var(--dim)]">{plat.note}</span>
{FOODS[s.cityKey].map((f, fi) => (
<button key={f.name} type="button" aria-label={`${plat.name}点${f.name}`} onClick={() => orderDelivery(pi, fi)} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold">{f.emoji} {f.name} {Y}{Math.round(f.cost * plat.feeMul)}</button>
))}
</div>
))}
</Fold>
) : null}
{arrived && (selLoc.type === "mall" || selLoc.type === "food") ? (
<Fold title="🛍️ 购物场景" summary={`${SHOP_VENUES.filter((v) => v.cities.includes(s.cityKey)).length} 家店 · 走进去逛、试、买`} groupKey={`shop-${selLoc.id}`}>
<p className="text-sm font-bold">🛍️ 购物场景（走进去逛）</p>
<div className="mt-2 grid gap-2">
{SHOP_VENUES.filter((v) => v.cities.includes(s.cityKey)).map((v) => (
<button key={v.id} type="button" onClick={() => setVenueScene({ kind: "shop", id: v.id })} className="act-btn">
<span className="text-sm font-bold">{v.emoji} {v.name}</span>
<span className="block text-xs text-[var(--dim)]">{v.kind} · 点开走进去逛、试、买</span>
</button>
))}
</div>
</Fold>
) : null}
{arrived && (selLoc.type === "lodging" || selLoc.type === "home") ? (
<Fold title="🛏️ 住宿场景" summary="酒店 / 青旅 / 民宿 / 租房 · 走进去看房间" groupKey={`stay-${selLoc.id}`}>
<p className="text-sm font-bold">🛏️ 住宿场景（酒店 / 青旅 / 民宿 / 租房，走进去看）</p>
<div className="mt-2 grid gap-2">
{LODGINGS.map((l) => (
<button key={l.id} type="button" onClick={() => setVenueScene({ kind: "stay", id: l.id })} className="act-btn">
<span className="text-sm font-bold">{l.emoji} {l.name} <span className="text-[var(--accent)]">{Y}{l.id === "rent-flat" ? rentFlatWeekly(s.cityKey) : l.price}/{l.priceUnit}</span></span>
<span className="block text-xs text-[var(--dim)]">{l.kind} · {l.perk}</span>
</button>
))}
</div>
</Fold>
) : null}
{arrived && scenicOf(s.cityKey, selLoc.id) ? (
<div className="mt-3 rounded-[12px] bg-[var(--surface2)] px-3 py-2.5">
<p className="text-sm font-bold">📸 风景打卡 · {scenicOf(s.cityKey, selLoc.id)?.name} <span className="chip">{scenicOf(s.cityKey, selLoc.id)?.tag}</span> {(s.visitedScenic ?? []).includes(`${s.cityKey}:${selLoc.id}`) ? <span className="chip">✅ 已打卡</span> : <span className="chip">未打卡</span>}</p>
<p className="mt-1 text-xs text-[var(--dim)]">{scenicOf(s.cityKey, selLoc.id)?.tip} · 本城已打卡 {(s.visitedScenic ?? []).filter((k) => k.startsWith(s.cityKey + ":")).length} / {scenicTotal(s.cityKey)} 处，用上方「拍照打卡」集齐风景册。</p>
</div>
) : null}
{selLoc.type === "home" && arrived && (<>
<Fold title={en ? "🎯 Life goals · flat, shop, apprentice" : "🎯 人生大事 · 买房 / 开店 / 带徒弟"} summary={[s.ownFlat ? (en ? "🔑 Homeowner" : "🔑 有房了") : "", s.shop ? `${SHOP_KINDS.find((k) => k.id === s.shop!.kind)?.emoji} Lv${s.shop.lvl}` : "", s.apprentice ? `🧑‍🎓 ${en ? trText(s.apprentice.name) : s.apprentice.name} ${s.apprentice.lvl}/5` : ""].filter(Boolean).join(" · ") || (en ? "Long-term goals once you've climbed the ladder" : "爬到顶以后的长线目标")} groupKey="goals-panel">
{(() => { const fp = flatPrice(s); const sp = shopPrice(s); const ap = s.apprentice; const teachToday = ap && ap.day === s.day; const npcs = npcsForCity(s.cityKey).filter((n) => !(s.apprentice?.name === n.name)); return (
<div className="grid gap-2">
<div className="rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-black">🔑 {en ? "Buy your own flat" : "买套自己的房"} {!s.ownFlat && <span className="text-[var(--accent)]">{en ? `deposit ${fmt(fp, s.cityKey)}` : `首付 ${fmt(fp, s.cityKey)}`}</span>}</p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{s.ownFlat ? (en ? `Yours since day ${s.flatDay}. The mortgage replaces rent; every morning in your own home: mood +2.` : `第 ${s.flatDay} 天拿到钥匙。月供代替房租，每天在自己家醒来心情 +2。`) : (en ? "Pay the deposit and the weekly rent becomes a mortgage of 80%. No more landlords." : "付了首付，周租变成八折的月供。从此不看房东脸色。")}</p>
{!s.ownFlat && <button type="button" disabled={s.money < fp} onClick={() => { mutate((x) => { x.money -= fp; x.ownFlat = true; x.flatDay = x.day; x.rent = Math.round((x.rent * 0.8) / 10) * 10; x.baseRent = Math.round((x.baseRent * 0.8) / 10) * 10; x.roommate = undefined; x.mood = clamp(x.mood + 20, 0, 100); }); publishHome(); addLog("🔑 买房了！在湾区有了自己的家。"); sfx("cheer"); showToast(en ? "🔑 You got the keys. This home is the one visitors walk into." : "🔑 拿到钥匙了。这套房子就是别人来串门时走进去的那一间。"); }} className="mt-2 w-full rounded-full bg-[var(--accent)] py-2 text-xs font-black text-white disabled:opacity-40">{s.money < fp ? (en ? `Still ${fmt(fp - s.money, s.cityKey)} short` : `还差 ${fmt(fp - s.money, s.cityKey)}`) : (en ? "Pay the deposit" : "付首付")}</button>}
</div>
<div className="rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-black">🏪 {en ? "Open a little shop" : "开一家小店"}</p>
{s.shop ? (() => { const k = SHOP_KINDS.find((x) => x.id === s.shop!.kind) ?? SHOP_KINDS[0]!; const up = shopUpgrade(s); return (<>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{k.emoji} {en ? `${k.en} · level ${s.shop.lvl} · open since day ${s.shop.day}. It takes money every day — even while you're offline. Some days lose money.` : `${k.zh} · ${s.shop.lvl} 级 · 第 ${s.shop.day} 天开张。每天都在营业（你不在线也是），偶尔会亏。`}</p>
<p className="mt-1 text-sm font-black">{en ? "In the till: " : "收银台里："}<span className={s.shop.till >= 0 ? "text-green-700" : "text-red-600"}>{fmt(s.shop.till, s.cityKey)}</span></p>
<div className="mt-2 grid grid-cols-2 gap-1.5">
<button type="button" disabled={s.shop.till === 0} onClick={() => { const t = s.shop!.till; const partner = s.shop!.partner; const share = partner && t > 0 ? Math.round(t * 0.2) : 0; mutate((x) => { x.money += t - share; if (t - share > 0) x.earned += t - share; x.shop = { ...x.shop!, till: 0 }; }); const mate = bonds.find((b) => b.status === "active" && b.peerName === partner); if (share > 0 && mate) sendGift(mate.peerId, mate.peerName, "share", share); sfx("coin"); showToast(t < 0 ? (en ? `Covered a loss of ${fmt(-t, s.cityKey)}.` : `补上了亏损 ${fmt(-t, s.cityKey)}。`) : share > 0 ? (en ? `Collected ${fmt(t - share, s.cityKey)}. ${fmt(share, s.cityKey)} is on its way to ${partner}'s wallet.` : `收了 ${fmt(t - share, s.cityKey)}。${fmt(share, s.cityKey)} 记给${partner}，对方下次上线进钱包。`) : (en ? `Collected ${fmt(t, s.cityKey)} from the shop.` : `从店里收了 ${fmt(t, s.cityKey)}。`)); }} className="rounded-full bg-[var(--text)] py-2 text-xs font-black text-[var(--bg)] disabled:opacity-40">{en ? "Empty the till" : "收钱"}</button>
<button type="button" disabled={s.money < up || s.shop.lvl >= 5} onClick={() => { mutate((x) => { x.money -= up; x.shop = { ...x.shop!, lvl: x.shop!.lvl + 1 }; }); sfx("arrive"); showToast(en ? "Shop upgraded — more customers every day." : "小店升级了，每天客人更多。"); }} className="rounded-full border border-[var(--line)] py-2 text-xs font-black disabled:opacity-40">{s.shop.lvl >= 5 ? (en ? "Max level" : "满级了") : (en ? `Upgrade · ${fmt(up, s.cityKey)}` : `升级 · ${fmt(up, s.cityKey)}`)}</button>
</div></>); })() : (<>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{en ? `Rent a shopfront for ${fmt(sp, s.cityKey)}. It earns every day, even when you're offline.` : `盘一间铺面 ${fmt(sp, s.cityKey)}，每天自己挣钱，你不在线也照样营业。`}</p>
<div className="mt-2 grid grid-cols-3 gap-1.5">{SHOP_KINDS.map((k) => <button key={k.id} type="button" disabled={s.money < sp} onClick={() => { mutate((x) => { x.money -= sp; x.shop = { kind: k.id, day: x.day, lvl: 1, till: 0 }; }); addLog(`🏪 开了一家${k.zh}。`); sfx("arrive"); showToast(en ? `${k.emoji} Your ${k.en} is open!` : `${k.emoji} 你的${k.zh}开张了！`); }} className="rounded-[10px] border border-[var(--line)] px-1 py-2 text-[11px] font-black disabled:opacity-40">{k.emoji} {en ? k.en : k.zh}</button>)}</div>
</>)}
</div>
<div className="rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-black">🧑‍🎓 {en ? "Take on an apprentice" : "带个徒弟"}</p>
{ap ? (<>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{en ? `${trText(ap.name)} is learning from you: ${ap.lvl}/5. Teach once a day; at 5 they graduate and remember you for life.` : `${ap.name}在跟你学：${ap.lvl}/5。每天教一次，到 5 就出师，一辈子记得你。`}</p>
<button type="button" disabled={!!teachToday || s.energy < 10} onClick={() => { const done = ap.lvl + 1 >= 5; mutate((x) => { x.energy -= 10; x.xp += 1; x.network += 1; if (done) { x.apprentice = undefined; x.mood = clamp(x.mood + 15, 0, 100); x.network += 3; x.money += 1000; x.earned += 1000; } else x.apprentice = { ...ap, lvl: ap.lvl + 1, day: x.day }; }); sfx(done ? "arrive" : "click"); if (done) addLog(`🧑‍🎓 徒弟${ap.name}出师了，包了个红包给你。`); showToast(done ? (en ? `🎓 ${trText(ap.name)} graduated! A thank-you red packet: +${fmt(1000, s.cityKey)}, contacts +3.` : `🎓 ${ap.name}出师了！包了个红包谢你：+${fmt(1000, s.cityKey)}，人脉 +3。`) : (en ? `Taught ${trText(ap.name)} a few tricks (energy −10, contacts +1).` : `教了${ap.name}几招（能量 −10，人脉 +1）。`)); }} className="mt-2 w-full rounded-full bg-[var(--text)] py-2 text-xs font-black text-[var(--bg)] disabled:opacity-40">{teachToday ? (en ? "Taught today — again tomorrow" : "今天教过了，明天再来") : (en ? "Teach today" : "今天教一课")}</button>
</>) : (<>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{s.skill >= 3 ? (en ? "You've learnt enough to pass it on. Pick a neighbour who's just arrived:" : "你的本事够教人了。挑一个刚来湾区的街坊：") : (en ? `Reach skill 3 to take an apprentice (now ${s.skill}).` : `技能到 3 才能带徒弟（现在 ${s.skill}）。`)}</p>
{s.skill >= 3 && <div className="mt-2 flex flex-wrap gap-1.5">{npcs.slice(0, 4).map((n) => <button key={n.name} type="button" onClick={() => { mutate((x) => { x.apprentice = { name: n.name, day: 0, lvl: 0 }; }); showToast(en ? `${trText(n.name)} is now your apprentice.` : `${n.name}成了你的徒弟。`); }} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-black">{n.emoji} {en ? trText(n.name) : n.name}</button>)}</div>}
</>)}
</div>
</div> ); })()}
</Fold>
<Fold title="🏠 我的家 · 户型 / 衣柜 / 装修 / 家具" summary={`${homeName(s)} · 舒适度 ${computeComfort(s)} · 家具 ${s.furniture.length} 件 · 食材 ×${s.groceries}`} groupKey="home-panel">
{renderHomePanel(s)}
</Fold>
</>)}
</div>
{(() => { const col = meta.collect; const peaks = Object.keys(col).filter((k) => k.startsWith("peak:")); const total = DROP_SETS.reduce((n, st) => n + st.items.length, 0); const got = DROP_SETS.reduce((n, st) => n + st.items.filter((x) => col[x.id]).length, 0); return (
<Fold title={en ? "📔 Collection book" : "📔 收藏图鉴"} summary={en ? `${got}/${total} found · ${peaks.length} summits · kept across runs` : `已收集 ${got}/${total} · 登顶 ${peaks.length} 座 · 跨局保留`} groupKey="collect">
<div className="grid gap-3">
{DROP_SETS.map((st) => (
<div key={st.id}>
<p className="text-xs font-black">{L2t(st.name)} <span className="text-[var(--dim)]">{st.items.filter((x) => col[x.id]).length}/{st.items.length}</span></p>
<div className="mt-1 flex flex-wrap gap-1.5">{st.items.map((x) => <span key={x.id} title={col[x.id] ? L2t(x.name) : "？"} className={`chip ${x.rarity === 3 && col[x.id] ? "border-[var(--gold)]" : ""}`}>{col[x.id] ? `${x.emoji} ${L2t(x.name)}${col[x.id]! > 1 ? ` ×${col[x.id]}` : ""}` : `❓${"★".repeat(x.rarity)}`}</span>)}</div>
</div>
))}
<div><p className="text-xs font-black">{en ? "🚩 Summits" : "🚩 登顶记录"} <span className="text-[var(--dim)]">{peaks.length}</span></p><p className="mt-1 text-xs text-[var(--dim)]">{peaks.length ? peaks.map((k) => { const l = resolveLoc(s.cityKey, k.slice(5)) ?? resolveLoc(s.cityKey === "sz" ? "hz" : "sz", k.slice(5)); return l ? (en ? trText(l.name) : l.name) : k.slice(5); }).join(" · ") : (en ? "Climb a mountain to plant your first flag." : "去爬座山，插下第一面旗。")}</p></div>
</div>
</Fold> ); })()}
<Fold title="📓 我的日子 · 生活日志" summary={s.log[0] ? `最近：第 ${s.log[0].day} 天 · ${s.log[0].text}` : "还没有记录"} groupKey="my-log">
<div className="grid max-h-[280px] gap-1.5 overflow-y-auto pr-0.5">
{s.log.slice(0, 10).map((entry, i) => (
<p key={i} className="rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-[13px] leading-relaxed">
<span className="mr-2 text-[11px] font-black text-[var(--dim)]">第 {entry.day} 天</span>{entry.text}
</p>
))}
</div>
</Fold>
</div>
)}

{asideTab === "feed" && (
<div className="mt-3 grid max-h-[520px] gap-1.5 overflow-y-auto pr-0.5">
{(world?.feed ?? []).length === 0 && <p className="text-sm text-[var(--dim)]">还没有动态。你进城的消息会出现在这里，其他玩家的晋升、峰会服务和结算也会。</p>}
{(() => { const merged = new Map<string, { id: number; playerName: string; kind: string; text: string; createdAt: string; n: number }>(); for (const f of world?.feed ?? []) { const k = `${f.playerName}|${f.kind}|${f.text}`; const cur = merged.get(k); if (cur) cur.n += 1; else merged.set(k, { ...f, n: 1 }); } return [...merged.values()]; })().map((f) => (
<div key={f.id} className="rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2">
<p className="break-words text-[13px] leading-relaxed"><span className="mr-1">{feedKindEmoji[f.kind] ?? "✨"}</span><b>{f.playerName}</b> {f.text}{f.n > 1 && <span className="chip ml-1.5 align-middle">同类 ×{f.n} · 已合并</span>}</p>
<p className="text-[11px] text-[var(--dim)]">{timeStr(f.createdAt)}{f.n > 1 ? "（最近一次）" : ""}</p>
</div>
))}
</div>
)}

{asideTab === "wall" && (
<div className="mt-3">
<p className="text-[11px] leading-relaxed text-[var(--dim)]">街坊们每天自己发动态、互相评论：聊天气、聊峰会、聊你升职和搬新家的事。你可以点赞、评论，他们会记住你、也可能回你。</p>
<div className="mt-2 grid max-h-[520px] gap-2 overflow-y-auto pr-0.5">
{(s.npcFeed ?? []).length === 0 && <p className="text-sm text-[var(--dim)]">街坊墙还空着，睡一觉到明天，他们就会热闹起来。</p>}
{(s.npcFeed ?? []).map((post) => {
const author = NPCS.find((n) => n.name === post.author);
const aMem = memOf(s.npcMem ?? {}, post.author);
const kindTag: Record<NpcPost["kind"], string> = { weather: "🌦️ 天气", apec: "🌐 峰会", player: "📣 关于你", life: "🏠 日常", work: "💼 工作", food: "🍜 吃食" };
return (
<div key={post.id} className="rounded-[12px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5">
<p className="flex flex-wrap items-center gap-1.5 text-[13px]"><span className="text-base">{author?.emoji ?? "🧑"}</span><b>{post.author}</b><span className="text-[11px] text-[var(--dim)]">{author?.job ?? ""} · 第 {post.day} 天</span><span className="chip ml-auto">{kindTag[post.kind]}</span></p>
<p className="mt-1 break-words text-[13px] leading-relaxed">{post.text}</p>
{post.comments.length > 0 && (
<div className="mt-1.5 grid gap-1 border-t border-dashed border-[var(--line)] pt-1.5">
{post.comments.map((c, ci) => (
<p key={ci} className="text-xs leading-relaxed"><b>{c.author}</b><span className="text-[var(--dim)]">：{c.text}</span></p>
))}
</div>
)}
<div className="mt-2 flex flex-wrap items-center gap-1.5">
<button type="button" aria-label={post.liked ? `已给${post.author}的动态点赞` : `给${post.author}的动态点赞`} disabled={post.liked} onClick={() => likeNpcPost(post.id)} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold disabled:opacity-60">{post.liked ? "❤️" : "🤍"} {post.likes}</button>
{!post.playerComment ? (
<>
<span className="text-[11px] text-[var(--dim)]">评论：</span>
{(["👍 同感", "😂 哈哈", "💪 加油"] as const).map((t) => (
<button key={t} type="button" aria-label={`评论${post.author}的动态：${t}`} onClick={() => commentNpcPost(post.id, t)} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold">{t}</button>
))}
</>
) : (
<span className="text-[11px] font-bold text-[var(--accent2)]">你评论了「{post.playerComment}」{aMem.rel >= 35 ? " · 老朋友的动态" : ""}</span>
)}
<button type="button" aria-label={`找${post.author}私聊`} onClick={() => openNpcChat(post.author)} className="ml-auto rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-black text-[var(--bg)]">💬 找他聊</button>
</div>
</div>
); })}
</div>
</div>
)}

{asideTab === "chat" && (
<div className="mt-3">
<p className="text-xs font-bold text-[var(--dim)]">{city.name}频道 · {onlineHere.length} 人在线：{onlineHere.map((pl) => pl.name).join("、") || "就你自己"}</p>
{(world?.online ?? []).filter((p) => p.id !== myId).length > 0 && (
<div className="mt-2 grid gap-1.5">
<p className="text-xs font-black tracking-wide">🎁 给在线的玩家送点东西（对方上线就收到，每天最多 10 份）</p>
{(world?.online ?? []).filter((p) => p.id !== myId).slice(0, 8).map((p) => (
<div key={p.id} className="rounded-[12px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2">
<p className="flex flex-wrap items-center gap-1.5 text-xs font-bold"><button type="button" onClick={() => setCardOf(p.id)} className="underline decoration-dotted">{p.emoji} {p.name}</button><button type="button" onClick={() => openDm(p.id)} className="chip">💬</button>{p.title && <span className="chip" style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>🏅 {p.title}</span>}<span className="text-[var(--dim)]">{`${CITIES[p.cityKey === "hz" ? "hz" : "sz"].name}${(companyById(p.employer).city ?? "sz") === p.cityKey ? ` · ${companyById(p.employer).short}` : ""}`} · 🎫 {p.stamps} 站章</span>{p.employer === s.employer && p.cityKey === s.cityKey && (companyById(s.employer).city ?? "sz") === s.cityKey && <span className="chip">👥 同事</span>}</p>
<div className="mt-1.5 flex flex-wrap gap-1">
{(Object.keys(GIFTS) as GiftKind[]).filter((k) => k !== "invite").filter((k) => k !== "referral" || ((s.employer ?? "startup") !== "startup" && p.employer !== s.employer)).map((k) => (
<button key={k} type="button" aria-label={`给${p.name}送${GIFTS[k].name}`} disabled={s.money < GIFTS[k].cost} onClick={() => sendGift(p.id, p.name, k)} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-black disabled:opacity-40">{GIFTS[k].emoji} {GIFTS[k].name}{GIFTS[k].cost ? ` ¥${GIFTS[k].cost}` : `（${companyById(s.employer).short}）`}</button>
))}
</div>
</div>
))}
</div>
)}
<div className="mt-2 grid max-h-[380px] gap-1.5 overflow-y-auto pr-0.5">
{(world?.chat ?? []).length === 0 && <p className="text-sm text-[var(--dim)]">频道里还很安静，发第一条消息吧。</p>}
{(world?.chat ?? []).map((m) => (
<div key={m.id} className={`max-w-[92%] rounded-[12px] px-3 py-2 text-[13px] leading-relaxed ${m.playerId === myId ? "justify-self-end bg-[var(--text)] text-[var(--bg)]" : "justify-self-start border border-[var(--line)] bg-[var(--bg)]"}`}>
<p className={`text-[11px] font-black ${m.playerId === myId ? "opacity-70" : "text-[var(--dim)]"}`}>{m.playerName} · {timeStr(m.createdAt)}</p>
<p className="break-words">{m.body}</p>
</div>
))}
</div>
<form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const body = chatInput.trim(); if (body) sendChatMut.mutate(body); }}>
<label htmlFor="chat-input" className="sr-only">发送到{city.name}频道</label>
<input id="chat-input" value={chatInput} onChange={(e) => setChatInput(e.target.value.slice(0, 120))} placeholder={`跟${city.name}的玩家说句话…`} className="min-w-0 flex-1 rounded-full border-2 border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none" />
<button type="submit" disabled={!chatInput.trim() || sendChatMut.isPending} className="shrink-0 rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-black text-white disabled:opacity-40">发送</button>
</form>
</div>
)}

{asideTab === "board" && (
<div className="mt-3 grid gap-1.5">
{(world?.leaderboard ?? []).length === 0 && <p className="text-sm text-[var(--dim)]">排行榜暂时没数据。</p>}
{(world?.leaderboard ?? []).map((b, i) => (
<p key={b.id} className={`flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm ${b.id === myId ? "bg-[var(--surface2)] font-black" : ""}`}>
<span className="w-6 font-black">{i + 1}</span>
<span>{b.emoji}</span>
<span className="min-w-0 flex-1 truncate" style={lookOf(b) && LOOK_COLOR[lookOf(b)!] ? { color: LOOK_COLOR[lookOf(b)!], fontWeight: 900 } : undefined}>{b.name}{lookOf(b) && LOOK_TITLE[lookOf(b)!] ? <span className="ml-1 rounded-full bg-[var(--surface2)] px-1.5 text-[10px]">{LOOK_TITLE[lookOf(b)!]![en ? 1 : 0]}</span> : null}{b.id === myId ? "（你）" : ""}</span>
<span className="text-xs text-[var(--dim)]">{CITIES[b.cityKey as CityKey]?.name ?? b.cityKey}</span>
<span className="font-black">{fmt(b.money, b.cityKey as CityKey)}</span>
<span className="hidden text-xs text-[var(--dim)] sm:inline">{b.status === "finished" ? b.resultTitle ?? "已结算" : `第 ${b.gameDay} 天 · ${(CAREERS[b.careerIdx] ?? CAREERS[0]!).name}`}</span>
</p>
))}
<p className="text-[11px] leading-relaxed text-[var(--dim)]">按当前存款排序，进行中的玩家也会实时上榜；过完 30 天的成绩会标上结局称号。</p>
<p className="mt-3 text-xs font-black tracking-wide">🏢 公司排行（最近 7 天在{city.name}上班的玩家，按存款合计）</p>
{(world?.companyBoard ?? []).length === 0 && <p className="text-xs text-[var(--dim)]">还没数据。</p>}
{(world?.companyBoard ?? []).map((c) => ({ ...c, co: employerHere({ employer: c.employer, cityKey: s.cityKey }) })).filter((c) => c.co).map((c, i) => { const co = c.co!; return (
<p key={c.employer} className={`flex items-center gap-2 rounded-[10px] px-3 py-1.5 text-sm ${c.employer === s.employer ? "bg-[var(--surface2)] font-black" : ""}`}><span className="w-6 font-black">{i + 1}</span><span>{co.emoji}</span><span className="min-w-0 flex-1 truncate">{co.name}{c.employer === s.employer ? "（你在这）" : ""}</span><span className="text-xs text-[var(--dim)]">{c.count} 人</span><span className="font-black">{fmt(c.money)}</span></p>
); })}
<p className="mt-3 text-xs font-black tracking-wide">🎫 集章排行（跨局累计）</p>
{(world?.stampBoard ?? []).length === 0 && <p className="text-xs text-[var(--dim)]">还没人盖章，去坐地铁吧。</p>}
{(world?.stampBoard ?? []).map((b, i) => (
<p key={b.id} className={`flex items-center gap-2 rounded-[10px] px-3 py-1.5 text-sm ${b.id === myId ? "bg-[var(--surface2)] font-black" : ""}`}><span className="w-6 font-black">{i + 1}</span><span>{b.emoji}</span><span className="min-w-0 flex-1 truncate">{b.name}{b.title ? ` · 🏅${b.title}` : ""}</span><span className="font-black">{b.stamps} 站</span></p>
))}
</div>
)}
{asideTab === "collect" && (() => {
const ck = s.cityKey;
const today = dateKey();
const lines = metroLinesForCity(ck).filter((l, i, arr) => arr.findIndex((x) => x.id === l.id) === i);
const stTotal = stationNamesOf(ck);
const stGot = stTotal.filter((n) => meta.stamps.includes(n)).length;
const kinds = Object.entries(PLACE_KINDS).map(([k, km]) => { const all = placesForCity(ck).filter((p) => p.kind === k); return { k, km, total: all.length, got: all.filter((p) => meta.atlas.includes(`${ck}:pl:${p.id}`)).length }; }).filter((x) => x.total > 0);
const ownLocs = getLocations(ck).filter((l) => l.id !== "home");
const ownGot = ownLocs.filter((l) => meta.atlas.includes(`${ck}:${l.id}`)).length;
const bar = (got: number, total: number, color = "var(--accent)") => <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[var(--surface2)]"><span className="block h-full rounded-full" style={{ width: `${total ? Math.round((got / total) * 100) : 0}%`, background: color }} /></span>;
return (
<div className="mt-3 max-h-[calc(100vh-190px)] min-w-0 overflow-y-auto overflow-x-hidden pr-1">
<div className="rounded-[14px] border-2 border-[var(--border)] bg-[var(--surface)] p-3">
<p className="flex flex-wrap items-center gap-2 text-sm font-black">🔥 连续上线 {meta.streak.count} 天 <span className="chip">最长 {meta.streak.best} 天</span> <span className="chip">已过完 {meta.runs} 局</span>{meta.title && <span className="chip" style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>🏅 {meta.title}</span>}</p>
<p className="mt-1 text-xs text-[var(--dim)]">站章、图鉴、成就跨局保留：这一局 30 天过完，下一局接着集。</p>
<p className="mt-2 flex flex-wrap items-center gap-2 rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-xs font-bold">☁️ 云存档码 <span className="font-mono text-sm tracking-widest">{prettyCode(cloudCode())}</span><button type="button" onClick={() => { void navigator.clipboard?.writeText(cloudCode()).then(() => showToast("存档码已复制。换手机、换电脑时在开始页输入它，就能接着玩。")); }} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-black">复制</button><span className="text-[var(--dim)]">{cloudAt ? `已同步 ${cloudAt}` : "自动同步中"} · 别给陌生人</span></p>
<p className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold">⚙️ 画质：<button type="button" aria-pressed={!lite} onClick={() => { setQuality(false); window.location.reload(); }} className={`rounded-full px-2.5 py-1 text-[11px] font-black ${!lite ? "bg-[var(--text)] text-[var(--bg)]" : "border border-[var(--line)]"}`}>高画质</button><button type="button" aria-pressed={lite} onClick={() => { setQuality(true); window.location.reload(); }} className={`rounded-full px-2.5 py-1 text-[11px] font-black ${lite ? "bg-[var(--text)] text-[var(--bg)]" : "border border-[var(--line)]"}`}>省电（手机）</button><span className="text-[var(--dim)]">切换会刷新页面</span></p>
<p className="mt-2 rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-xs font-bold">{todayEvent.emoji} 今日城市事件「{todayEvent.name}」：{todayEvent.desc}</p>
</div>
<p className="mt-4 text-xs font-black tracking-wide">🎯 本周目标（每周一重置）</p>
<div className="mt-2 grid gap-1.5">
{WEEKLY_GOALS.map((g) => { const got = meta.week.prog[g.id] ?? 0; const done = got >= g.target; const claimed = meta.week.claimed.includes(g.id); return (
<div key={g.id} className="flex items-center gap-2 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2">
<span className="text-lg">{g.emoji}</span>
<span className="min-w-0 flex-1 text-xs font-bold">{g.name} <span className="text-[var(--dim)]">{Math.min(got, g.target)}/{g.target}</span>{bar(Math.min(got, g.target), g.target, "var(--green)")}</span>
<button type="button" disabled={!done || claimed} onClick={() => { mutate((x) => { x.money += g.reward; }); updMeta((m) => { m.week.claimed = [...m.week.claimed, g.id]; }); floatReward(`+${fmt(g.reward)} 周目标`, "gold"); }} className="shrink-0 rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-black text-[var(--bg)] disabled:opacity-35">{claimed ? "已领" : `领 ¥${g.reward}`}</button>
</div>
); })}
</div>
<p className="mt-4 text-xs font-black tracking-wide">🎫 地铁集章 · {stGot}/{stTotal.length} 站（上下车、换乘、到站自动盖章）</p>
{bar(stGot, stTotal.length)}
<div className="mt-2 grid gap-1">
{lines.map((l) => { const names = [...new Set(l.stations.map((x) => x.name).filter((n) => !n.endsWith("方向")))]; const got = names.filter((n) => meta.stamps.includes(n)).length; const done = meta.linesDone.includes(l.id); return (
<details key={l.id} className="rounded-[10px] bg-[var(--bg)] px-2.5 py-1.5">
<summary className="flex cursor-pointer items-center gap-2 text-xs font-bold"><span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: l.colorCss }} /><span className="min-w-0 flex-1 truncate">{l.short}</span><span className="text-[var(--dim)]">{got}/{names.length}</span>{done && <span>🏁</span>}</summary>
<p className="mt-1 flex flex-wrap gap-1">{names.map((n) => <span key={n} className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${meta.stamps.includes(n) ? "text-white" : "border border-[var(--line)] text-[var(--dim)]"}`} style={meta.stamps.includes(n) ? { background: l.colorCss } : {}}>{n}</span>)}</p>
</details>
); })}
</div>
<p className="mt-4 text-xs font-black tracking-wide">📖 城市图鉴 · 去过就记下</p>
<div className="mt-2 grid grid-cols-2 gap-1.5">
<div className="rounded-[10px] bg-[var(--bg)] px-2.5 py-1.5 text-xs font-bold">🗺️ 游戏地点 <span className="text-[var(--dim)]">{ownGot}/{ownLocs.length}</span>{bar(ownGot, ownLocs.length, "var(--accent2)")}</div>
{kinds.map((x) => <div key={x.k} className="rounded-[10px] bg-[var(--bg)] px-2.5 py-1.5 text-xs font-bold">{x.km.emoji} {x.km.label} <span className="text-[var(--dim)]">{x.got}/{x.total}</span>{bar(x.got, x.total, "var(--accent2)")}</div>)}
</div>
<p className="mt-4 text-xs font-black tracking-wide">🏅 成就 · 点已解锁的戴上称号（别的玩家能看到）</p>
<div className="mt-2 grid gap-1.5">
{ACHIEVEMENTS.map((a) => { const got = meta.achievements.includes(a.id); const worn = meta.title === a.title; return (
<button key={a.id} type="button" disabled={!got} onClick={() => updMeta((m) => { m.title = worn ? null : a.title; })} className={`flex items-center gap-2 rounded-[12px] border px-3 py-2 text-left ${worn ? "border-[var(--gold)] bg-[var(--surface2)]" : "border-[var(--line)] bg-[var(--bg)]"} ${got ? "" : "opacity-45"}`}>
<span className="text-lg">{got ? a.emoji : "🔒"}</span>
<span className="min-w-0 flex-1"><span className="block text-xs font-black">{a.title}</span><span className="block text-[11px] text-[var(--dim)]">{a.desc}</span></span>
{got && <span className="shrink-0 text-[11px] font-black text-[var(--accent2)]">{worn ? "已佩戴 ✓" : "戴上"}</span>}
</button>
); })}
</div>
<p className="mt-3 text-[11px] text-[var(--dim)]">进度存在这台设备的浏览器里（开了云存档也会存一份到服务器）。今天：{today}</p>
<p className="mt-1 flex flex-wrap gap-3 text-[11px] font-bold text-[var(--dim)]"><button type="button" onClick={() => setLegalDoc("terms")} className="underline">用户协议 Terms</button><button type="button" onClick={() => setLegalDoc("privacy")} className="underline">隐私政策 Privacy</button><span>游戏中的公司与活动均为虚构</span></p>
</div>
);
})()}
{asideTab === "guide" && (
<div className="mt-3 max-h-[calc(100vh-190px)] min-w-0 overflow-y-auto overflow-x-hidden pr-1">
{(() => { const tour = tourForCity(s.cityKey); const active = s.tourKey === tour.id; const idx = active ? (s.tourIdx ?? 0) : 0; const done = active && !!s.tourDone; return (
<div className="rounded-[14px] border-2 border-[var(--border)] bg-[var(--surface)] p-3">
<p className="text-sm font-black">🧭 一日游路线 · {tour.name}</p>
<p className="mt-0.5 text-[11px] font-semibold italic text-[var(--dim)]">{tour.nameEn}</p>
<p className="mt-1 text-xs text-[var(--dim)]">{tour.line}</p>
<div className="mt-2 grid gap-1.5">
{tour.stops.map((name, i) => { const st = done || i < idx ? "done" : i === idx ? "next" : "todo"; const gl = guideForLocName(name); return (
<p key={name} className={`flex items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-xs font-bold ${st === "next" ? "bg-[var(--surface2)]" : ""}`}>
<span>{st === "done" ? "✅" : st === "next" ? "◎" : "○"}</span>
<span className="min-w-0 flex-1">{i + 1}. {name}{gl ? <span className="text-[var(--dim)]"> · {gl.nameEn}</span> : null}</span>
{st === "next" && <span className="shrink-0 text-[var(--accent)]">下一站 · 到站 +{fmt(tour.rewardPerStop)}</span>}
{st === "done" && <span className="shrink-0 text-[var(--green)]">已到达</span>}
</p> ); })}
</div>
{done ? (
<div className="mt-2 flex flex-wrap items-center justify-between gap-2">
<p className="text-xs font-black text-[var(--green)]">🏁 全程完成！完赛奖励 {fmt(tour.rewardFinish)} 已到账</p>
<button type="button" aria-label="再走一遍一日游路线" onClick={() => restartTour(tour)} className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] font-black">再走一遍</button>
</div>
) : <p className="mt-2 text-[11px] leading-relaxed text-[var(--dim)]">{`按顺序到达每一站自动打卡：每站 +${fmt(tour.rewardPerStop)}，走完全程再 +${fmt(tour.rewardFinish)}。在地图上点地点名、或坐车过去都算到达。`}</p>}
</div> ); })()}
<div className="mt-3 rounded-[14px] border-2 border-[var(--border)] bg-[var(--surface)] p-3">
<p className="text-sm font-black">🔍 看图认地方 <span className="text-[11px] font-bold text-[var(--dim)]">Photo Quiz · 认对 +{fmt(10)}</span></p>
{!quiz ? (
<button type="button" onClick={nextQuiz} className="mt-2 w-full rounded-full bg-[var(--text)] py-2.5 text-sm font-black text-[var(--bg)]">开始认图 →</button>
) : (() => { const target = GUIDE.find((g) => g.key === quiz.key); if (!target) return null; return (
<>
<img src={target.photos[0]} alt="看图认地方：猜猜这是哪里的实拍照片" className="mt-2 h-40 w-full rounded-[10px] object-cover" />
<p className="mt-2 text-xs font-bold">这张实拍是哪里？ <span className="text-[var(--dim)]">Where was this photo taken?</span></p>
<div className="mt-1.5 grid grid-cols-2 gap-1.5">
{quiz.opts.map((name) => { const isTarget = name === target.locName; const picked = quiz.picked === name; return (
<button key={name} type="button" disabled={!!quiz.picked} aria-label={`猜这是${name}`} onClick={() => answerQuiz(name)} className={`rounded-[10px] border px-2 py-2 text-xs font-black ${quiz.picked ? (isTarget ? "border-transparent bg-[var(--green)] text-white" : picked ? "border-transparent bg-[var(--accent)] text-white" : "border-[var(--line)] opacity-55") : "border-[var(--line)] bg-[var(--surface)]"}`}>{name}</button> ); })}
</div>
{quiz.picked && (
<div className="mt-2 flex items-start justify-between gap-2">
<p className="text-xs font-bold leading-relaxed">{quiz.picked === target.locName ? `🎉 对了！` : `这是${target.locName}。`}{target.fact}</p>
<button type="button" onClick={nextQuiz} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-1.5 text-[11px] font-black text-[var(--bg)]">下一题 →</button>
</div>
)}
</>
); })()}
</div>
<p className="mt-4 text-xs font-black tracking-wide">📖 认识{CITIES[s.cityKey].name}图鉴 · 已解锁 {(s.album ?? []).length}/{GUIDE.length} <span className="font-bold text-[var(--dim)]">— 到真地方打卡，把它的实拍和城市知识收进来</span></p>
<div className="mt-2 grid gap-2.5">
{GUIDE.map((g) => { const un = (s.album ?? []).includes(g.key); return (
<div key={g.key} className="overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--surface)]">
<div className="relative">
<img src={g.photos[0]} alt={un ? `${g.locName}实拍照片` : `${g.locName}图鉴条目（未解锁）`} className={`h-28 w-full object-cover ${un ? "" : "opacity-45 grayscale"}`} />
{!un && <span className="absolute inset-0 grid place-items-center px-3 text-center text-sm font-black text-white" style={{ textShadow: "0 2px 8px rgba(0,0,0,.85)" }}>🔒 到{g.locName}打卡解锁</span>}
<span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-black text-white">{CITIES[g.cityKey].name} · {g.locName}</span>
</div>
{un && (
<div className="p-2.5">
<p className="text-[11px] leading-relaxed">{g.fact}</p>
<p className="mt-1 text-[11px] italic leading-relaxed text-[var(--dim)]">{g.factEn}</p>
<p className="mt-1 text-[11px] leading-relaxed">🗣️ {g.npc}：{g.story}</p>
</div>
)}
</div> ); })}
</div>
</div>
)}
</div>
</>
)}
{/* 地区面板收起时不是消失、也不是藏进浮钮，而是竖着收成屏幕右侧
    一条窄窄的竖条：五个页签只留图标竖排 + 「地区面板」竖排字，一直
    留在屏幕边上一眼能看到；点任意图标就展开回对应页签。地图始终
    全屏，不被面板挤占。 */}

{/* 地点卡：选中的地方显示在底部中间，常用动作一步到位；「全部」再打开完整面板 */}
{!asideOpen && !scenicMoment && !placeCardOff && !musicOpen && !walking && !carriage && (() => { const vs = venueFor(selLoc); const sm = momentsAt(s.cityKey, selLoc.id, selLoc.name)[0]; return (
<div className="place-card absolute bottom-3 left-1/2 z-20 w-[min(380px,calc(100%-150px))] -translate-x-1/2">
<div className="flex items-center gap-2.5">
<span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-2xl" style={{ background: hexCss(selLoc.color) + "2b" }}>{selLoc.emoji}</span>
<span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-black">{en ? trText(selLoc.name) : selLoc.name}</span><span className="pc-sub block truncate text-[11px] font-bold text-[var(--dim)]">{arrived ? (en ? "📍 You're here" : "📍 你在这里") : (en ? "Tap Go to head there" : "点「去这里」出发")}</span></span>
<button type="button" aria-label={en ? "Hide" : "收起"} onClick={() => setPlaceCardOff(true)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black text-[var(--dim)] hover:bg-[var(--surface2)]">✕</button>
</div>
{adHere && (
<div className="mt-2">
<p className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#e63a1f] to-[#f59e0b] px-1.5 py-1 text-[11px] font-black text-white">
<span className="shrink-0 rounded-full bg-white px-1.5 py-px text-[10px] tracking-wide text-[#e63a1f]">{en ? "AD" : "广告"}</span>
<span className="min-w-0 flex-1 truncate">{adHere.emoji} {adHere.text}</span>
</p>
{adHere.kind === "sanhe" && <p className="mt-1 text-[11px] leading-snug text-[var(--dim)]">{en ? said.en : said.zh}</p>}
</div>
)}
<div className="mt-2 flex gap-1.5">
{!arrived && <button type="button" onClick={() => walkTo(selectedLoc)} className="pc-btn pc-primary">🚶 {en ? "Go here" : "去这里"}</button>}
{arrived && sm && <button type="button" onClick={() => startScenic(sm.id)} className="pc-btn">{sm.emoji} {en ? "View" : "观景"}</button>}
{arrived && selLoc.type === "home" && <button type="button" onClick={() => { publishHome(); setHomeGuest(null); setVisitHome(null); setHomePose("idle"); setHome3d(true); }} className="pc-btn">🚪 {en ? "Go inside" : "走进屋里"}</button>}
{arrived && vs && <button type="button" onClick={() => { setVenueTalk(null); setVenue3d({ set: vs.set, name: en ? trText(selLoc.name) : selLoc.name, line: en ? vs.en : vs.zh, id: selLoc.id, emoji: selLoc.emoji, color: selLoc.color }); }} className="pc-btn">🚪 {en ? "Step inside" : "走进去"}</button>}
{arrived && selLoc.type === "social" && <button type="button" onClick={() => setLiveOpen(true)} className="pc-btn">🎶 {en ? "Live" : "听歌"}</button>}
{adHere?.kind === "hire" && adHere.go && currentLoc !== adHere.go && <button type="button" onClick={() => walkTo(adHere.go!)} className="pc-btn">{en ? "Interview" : "去面试"}</button>}
{adHere?.kind === "hire" && arrived && companyAt(s.cityKey, selLoc.id) && <button type="button" disabled={s.energy < 12} onClick={() => doAction("interview")} className="pc-btn pc-primary">{en ? "Apply" : "投简历"}</button>}
{adHere?.kind === "sanhe" && arrived && <button type="button" disabled={s.energy < 22 || (s.sanheDay ?? 0) === s.day} onClick={takeSanhe} className="pc-btn pc-primary">{(s.sanheDay ?? 0) === s.day ? (en ? "Settled" : "结过了") : (en ? "Day shift" : "站一天")}</button>}
{adHere?.kind === "sanhe" && !arrived && adHere.go && <button type="button" onClick={() => walkTo(adHere.go!)} className="pc-btn">{en ? "Day shift" : "去站一天"}</button>}
{adHere?.kind === "rent" && <button type="button" onClick={() => { if (currentLoc === "home" && selLoc.id === "home") askRent(); else walkTo("home"); }} className="pc-btn">{currentLoc === "home" && selLoc.id === "home" ? (en ? "The rent" : "问问房租") : (en ? "The room" : "去看房")}</button>}
{adHere?.kind === "sale" && <button type="button" onClick={() => { if (arrived) askSale(); else if (adHere.go) walkTo(adHere.go); }} className="pc-btn">{arrived ? (en ? "Price" : "特价") : (en ? "Stall" : "去摊位")}</button>}
<button type="button" onClick={() => { setAsideTab("place"); setAsideOpen(true); }} className={`pc-btn${arrived ? " pc-primary" : ""}`}>{arrived ? (en ? "⌃ Things to do" : "⌃ 能做的事") : (en ? "⌃ Details" : "⌃ 详情")}</button>
</div>
</div> ); })()}
</>
</main>

{/* ===== VENUE SCENES: dine / shop / stay ===== */}
{venueScene && venueScene.kind === "dine" && (() => { const r = RESTAURANTS.find((x) => x.id === venueScene.id); if (!r) return null; const ck = `dine-${r.id}`; return (
<div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={r.name}>
<div className="rise max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-xl">
<div className="bg-[#7c2d12] p-4 text-white"><p className="text-xs font-black">{r.emoji} {r.cuisine} · {r.region} · 人均档位 {r.tier}</p><p className="font-display mt-1 text-2xl font-black">{r.name} · 店内</p><p className="mt-0.5 text-xs opacity-90">座位：{r.tables}</p></div>
<div className="p-4">
<p className="rounded-[12px] bg-[var(--surface2)] px-3 py-2.5 text-sm leading-relaxed">🏮 {r.scene}</p>
<p className="mt-3 text-xs font-black tracking-wide text-[var(--dim)]">坐下来点菜（堂食，点一道吃一道）</p>
<div className="mt-2 grid gap-2">
{r.dishes.map((d, i) => (
<button key={d.name} type="button" onClick={() => dineEat(r.name, i)} disabled={s.money < d.cost} className="act-btn disabled:opacity-40">
<span className="flex items-center justify-between text-sm font-black"><span>{d.name}</span><span className="text-[var(--accent)]">{fmt(d.cost)}</span></span>
<span className="mt-0.5 block text-xs text-[var(--dim)]">{d.desc} · 能量 +{d.energy} · 心情 +{d.mood}</span>
</button>
))}
</div>
<div className="mt-3 grid grid-cols-2 gap-2">
<button type="button" aria-label="和邻桌拼桌聊天" disabled={sceneFlag(ck + "-chat")} onClick={() => { setSceneFlag(ck + "-chat"); const got = Math.random() < 0.45; mutate((x) => { x.mood += 6; if (got) x.network += 1; }); showToast(got ? "拼桌聊得投机，加了微信，人脉 +1，心情 +6。" : "和邻桌聊了聊哪道菜好吃，心情 +6。"); }} className="act-btn disabled:opacity-40"><span className="text-sm font-black">💬 拼桌聊天</span><span className="block text-xs text-[var(--dim)]">{sceneFlag(ck + "-chat") ? "刚聊过一轮" : "心情 +6 · 可能 +人脉"}</span></button>
<button type="button" aria-label="看后厨和店里表演" disabled={sceneFlag(ck + "-show")} onClick={() => { setSceneFlag(ck + "-show"); mutate((x) => { x.mood += 4; }); showToast("看了一会儿明档师傅的手艺，心情 +4。"); }} className="act-btn disabled:opacity-40"><span className="text-sm font-black">👨‍🍳 看明档手艺</span><span className="block text-xs text-[var(--dim)]">{sceneFlag(ck + "-show") ? "看过了" : "师傅现场做菜，心情 +4"}</span></button>
</div>
<button type="button" onClick={() => setVenueScene(null)} className="mt-4 w-full rounded-full bg-[var(--text)] py-3 text-sm font-black text-[var(--bg)]">买单离开 →</button>
</div></div></div> ); })()}
{venueScene && venueScene.kind === "shop" && (() => { const v = SHOP_VENUES.find((x) => x.id === venueScene.id); if (!v) return null; const ck = `shop-${v.id}`; return (
<div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={v.name}>
<div className="rise max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-xl">
<div className="bg-[#831843] p-4 text-white"><p className="text-xs font-black">{v.emoji} {v.kind}</p><p className="font-display mt-1 text-2xl font-black">{v.name} · 店内</p></div>
<div className="p-4">
<p className="rounded-[12px] bg-[var(--surface2)] px-3 py-2.5 text-sm leading-relaxed">🛍️ {v.scene}</p>
<p className="mt-3 text-xs font-black tracking-wide text-[var(--dim)]">逛一逛，看到喜欢的就买</p>
<div className="mt-2 grid gap-2">
{v.items.map((it, i) => (
<button key={it.name} type="button" onClick={() => shopBuy(v.name, i)} disabled={s.money < it.cost} className="act-btn disabled:opacity-40">
<span className="flex items-center justify-between text-sm font-black"><span>{it.name}</span><span className="text-[var(--accent)]">{fmt(it.cost)}</span></span>
<span className="mt-0.5 block text-xs text-[var(--dim)]">{it.desc} · 心情 +{it.mood}</span>
</button>
))}
</div>
<button type="button" aria-label="只逛不买看看" disabled={sceneFlag(ck + "-look")} onClick={() => { setSceneFlag(ck + "-look"); mutate((x) => { x.mood += 5; }); showToast("逛了一大圈，试了几件没买，过眼瘾心情 +5。"); }} className="act-btn mt-3 disabled:opacity-40"><span className="text-sm font-black">👀 只逛不买</span><span className="block text-xs text-[var(--dim)]">{sceneFlag(ck + "-look") ? "逛过了" : "试穿试用，心情 +5 · 免费"}</span></button>
<button type="button" onClick={() => setVenueScene(null)} className="mt-4 w-full rounded-full bg-[var(--text)] py-3 text-sm font-black text-[var(--bg)]">离开 →</button>
</div></div></div> ); })()}
{venueScene && venueScene.kind === "stay" && (() => { const l = LODGINGS.find((x) => x.id === venueScene.id); if (!l) return null; return (
<div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={l.name}>
<div className="rise max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-xl">
<div className="bg-[#1e3a5f] p-4 text-white"><p className="text-xs font-black">{l.emoji} {l.kind} · {Y}{l.id === "rent-flat" ? rentFlatWeekly(s.cityKey) : l.price}/{l.priceUnit}</p><p className="font-display mt-1 text-2xl font-black">{l.name} · 房间里</p></div>
<div className="p-4">
<p className="rounded-[12px] bg-[var(--surface2)] px-3 py-2.5 text-sm leading-relaxed">🛏️ {l.scene}</p>
<p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">{l.perk}</p>
{l.id === "rent-flat" ? (
<button type="button" onClick={signRent} className="mt-4 w-full rounded-full bg-[var(--accent)] py-3.5 text-sm font-black text-white">🔑 就这间，签约（周租 {fmt(rentFlatWeekly(s.cityKey))}）</button>
) : (
<button type="button" onClick={() => stayOvernight(l.id)} disabled={s.money < l.price} className="mt-4 w-full rounded-full bg-[var(--accent)] py-3.5 text-sm font-black text-white disabled:opacity-40">🛏️ 住一晚过夜（-{Y}{l.price}，睡到明天）</button>
)}
<button type="button" onClick={() => setVenueScene(null)} className="mt-2 w-full rounded-full border-2 border-[var(--text)] py-3 text-sm font-black">再看看别家 →</button>
</div></div></div> ); })()}

{/* ===== BUS / TAXI RIDE SCENE: the same cinematic treatment as the
    metro carriage — board, ride watching the city slide past, alight.
    Steps advance on a timer; the trip's own walk timer closes it. ===== */}
{roadRide && (() => {
const rr = roadRide;
const isBus = rr.mode === "bus";
const isDrive = rr.mode === "drive";
const steps: { pose: LifePose; caption: string; sub: string }[] = isDrive ? [
{ pose: "walk", caption: "去停车场取车", sub: "下楼走到停车场，按一下车钥匙，车灯闪了两下" },
{ pose: "walk", caption: "上车，点火出发", sub: "拉开车门坐进驾驶座，系好安全带，点火、看一眼后视镜，慢慢汇入车流" },
{ pose: "drive", caption: "路口等红灯", sub: "前面路口红灯亮了——跟全城的车一起停下来等。绿灯一亮，脚下给油，车流重新流动起来" },
{ pose: "drive", caption: "跟着车流走", sub: "双手扶着方向盘，商圈、写字楼、行道树从挡风玻璃前一段段划过——这座城市的路，你越来越熟" },
{ pose: "walk", caption: "找车位，停好下车", sub: "绕了一小圈找到车位，倒车入库、拉手刹、锁车——到了" },
] : isBus ? [
{ pose: "idle", caption: "站台等车", sub: "站牌下看一眼电子屏：你要坐的车还有 3 站进站。路灯下几个人和你一起等" },
{ pose: "walk", caption: "公交进站，上车", sub: "车在站台稳稳停住，前门打开——你刷卡上车，往里走找座位" },
{ pose: "sit", caption: "坐稳了，看窗外", sub: "公交一站站往前开，街景、行道树和店铺在窗外一段段往后退" },
{ pose: "sit", caption: "快到了，准备下车", sub: "车载广播报站：下一站就是你的目的地——按一下下车铃，扶好站起来" },
{ pose: "walk", caption: "到站下车", sub: "后门下车，脚一落地，新地方到了" },
] : [
{ pose: "idle", caption: "路边叫车，等车来", sub: "打开打车 App 下单：「司机正在赶来，还有 2 分钟，车牌粤B·D7×××」。你站在路边盯着每一辆亮着灯的车" },
{ pose: "walk", caption: "车到了，上车", sub: "你叫的车停在面前，拉开车门坐进后排，系好安全带，跟司机确认目的地" },
{ pose: "sit", caption: "坐在车里看城市", sub: "车汇入车流，高架、商圈、写字楼在窗外划过——打车就是图个快和省心" },
{ pose: "sit", caption: "快到了", sub: "司机打了转向灯靠边：前面路口就是你的目的地" },
{ pose: "walk", caption: "下车，到了", sub: "推门下车，车灯一闪开走了，你站在目的地门口" },
];
const step = steps[Math.min(roadRideStep, steps.length - 1)]!;
const outfitR = outfitOf(s.outfit);
if (!rideBig) return (
<div className="fixed inset-x-0 bottom-3 z-[60] flex justify-center px-3" role="status" aria-label={en ? "Ride in progress" : "正在乘车"}>
<div className="flex w-full max-w-md items-center gap-3 rounded-[16px] border-2 border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-xl">
<span className="text-2xl">{isBus ? "🚌" : isDrive ? "🚗" : "🚕"}</span>
<span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{en ? `${isBus ? "Bus" : isDrive ? "Driving" : "Taxi"} to ${trText(rr.toName)}` : `${isBus ? "坐公交" : isDrive ? "开车" : "打车"}去${rr.toName}`}</span><span className="block truncate text-[11px] text-[var(--dim)]">{en ? "Watch it on the map" : `${step.caption} · 地图上看你在路上`}</span>
<span className="mt-1 block h-1 overflow-hidden rounded-full bg-[var(--surface2)]"><span className="block h-full bg-[var(--accent)] transition-all" style={{ width: `${Math.min(100, ((Date.now() - rr.startedAt) / rr.durMs) * 100)}%` }} /></span></span>
<button type="button" onClick={() => setRideBig(true)} className="shrink-0 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-black">{en ? "Inside view" : "车里看看"}</button>
</div>
</div>
);
return (
<div className="fixed bottom-3 right-3 z-[60] flex w-[min(400px,calc(100vw-24px))] justify-end" role="dialog" aria-label={isBus ? "公交车厢" : isDrive ? "自驾开车" : "出租车车厢"}>
<div className="rise w-full max-w-lg overflow-hidden rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-xl">
<div className="p-4 pb-3 text-white" style={{ background: isBus ? "#2563eb" : isDrive ? "#166534" : "#b45309" }}>
<p className="flex items-center justify-between text-xs font-black"><span>{isBus ? "🚌 公交车厢" : isDrive ? "🚗 自驾 · 驾驶座" : "🚕 出租车里"}</span><span>{rr.fare > 0 ? `${isDrive ? "油费+停车" : "车费"} ${Y}${rr.fare}` : "免费乘车"}</span></p>
<p className="font-display mt-1 text-2xl font-black">{rr.fromName} → {rr.toName}</p>
<p className="mt-0.5 text-xs opacity-90">{isBus ? "一站站往前开，窗外是真实的街景" : isDrive ? "自己开车：跟车流、等红灯、找车位，窗外是真实的街景" : "点对点直达，窗外风景划过"} · 预计约 {etaMinutes(rr.mode, Math.hypot(locById(selectedLoc).x - locById(currentLoc).x, locById(selectedLoc).z - locById(currentLoc).z))} 分钟</p>
</div>
<div className="mx-4 mt-3 overflow-hidden rounded-[16px] border-2 border-[var(--line)]">
<div className="relative h-52">
<LifeStage3D key={`road-${rr.mode}-${roadRideStep >= 4 ? "out" : roadRideStep === 0 ? "wait" : roadRideStep === 1 ? "in" : "ride"}`} setKind={roadRideStep === 0 ? "station" : rr.mode} pose={step.pose} shirt={outfitR.shirt} pants={outfitR.pants} night={nowMin() >= 19 * 60 || nowMin() < 6 * 60} emoji={iden.emoji} cur={Y} />
<div className="cine-grade" />
</div>
<p className="bg-[var(--surface2)] px-3 py-2 text-xs leading-relaxed"><b>{step.caption}</b> · {step.sub}</p>
</div>
<div className="flex items-center gap-2 px-4 py-3.5">
<div className="flex gap-1">{steps.map((_, i) => (<span key={i} className={`h-1.5 rounded-full transition-all ${i <= roadRideStep ? "w-5 bg-[var(--accent)]" : "w-2.5 bg-[var(--line)]"}`} />))}</div>
<span className="text-[11px] font-bold text-[var(--dim)]">{roadRideStep >= 4 ? "到站了，马上回到地图" : roadRideStep === 0 ? (rr.mode === "drive" ? "取车中…" : "等车中…") : roadRideArrived ? "车已到站，演完这一步就回到地图" : "行驶中…演完才收起，不会中途掐断"}</span>
<button type="button" aria-label="跳过搭乘动画，回到地图看行程" onClick={() => { setRoadRide(null); setRoadRideArrived(false); }} className="ml-auto rounded-full border-2 border-[var(--text)] px-4 py-2 text-xs font-black">看地图 ⏭</button>
</div>
</div>
</div>
);
})()}

{legalModal()}

{/* ===== 分享战绩 / 邀请朋友 ===== */}
{shareOpen && (
<div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label="分享战绩">
<div className="rise max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl">
<div className="flex items-center justify-between"><p className="text-lg font-black">📤 分享战绩 · 邀请朋友</p><button type="button" aria-label="关闭分享" onClick={() => setShareOpen(false)} className="rounded-full border border-[var(--line)] px-3 py-1 text-sm font-black">✕</button></div>
<div className="mt-3 overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--bg)]">
{shareImg ? <img src={shareImg.url} alt="我的湾区人生战绩卡" className="block w-full" /> : <p className="p-8 text-center text-sm text-[var(--dim)]">正在生成战绩卡…</p>}
</div>
<div className="mt-3 grid grid-cols-2 gap-2">
<button type="button" onClick={() => void shareNative()} className="rounded-full bg-[var(--accent)] py-3 text-sm font-black text-white">📲 分享给朋友</button>
{shareImg ? <a href={shareImg.url} download="湾区人生战绩.png" className="rounded-full bg-[var(--text)] py-3 text-center text-sm font-black text-[var(--bg)]">⬇️ 保存图片</a> : <span />}
</div>
<button type="button" onClick={() => void copyInvite()} className="mt-2 w-full rounded-full border-2 border-[var(--border)] py-2.5 text-sm font-black">🔗 复制邀请链接</button>
<p className="mt-3 text-xs font-black text-[var(--dim)]">{en ? "Ready-made posts (copy, then paste with the image):" : "现成文案（复制后配上面的图发出去）："}</p>
<div className="mt-1.5 grid grid-cols-3 gap-1.5">
{(["moments", "xhs", "douyin"] as const).map((k) => (
<button key={k} type="button" onClick={() => void copyPost(k)} className="rounded-full border-2 border-[var(--line)] py-2 text-xs font-black">{k === "moments" ? (en ? "WeChat Moments" : "朋友圈") : k === "xhs" ? (en ? "Xiaohongshu" : "小红书") : (en ? "Douyin" : "抖音")}</button>
))}
</div>
<p className="mt-2 break-all rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-[11px] text-[var(--dim)]">{profile && s && myPub ? inviteLink(myPub, profile.name, s.employer) : "（联网后生成）"}</p>
<p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">朋友用这个链接进来：开局多 ¥100{s && (s.employer ?? "startup") !== "startup" ? `，还自带${companyById(s.employer).short}的内推` : ""}；他玩满 3 天、和真人组过一次局后，你收到 ¥200 邀请奖励（同一台设备或同一个网络的账号不算，每周最多 10 份）。</p>
</div>
</div>
)}

{/* ===== METRO CARRIAGE SCENE ===== */}
{carriage && (() => {
const c = carriage;
const curLine = c.route.legs[c.legIdx]?.line ?? c.route.line;
const total = c.route.stations.length;
const arrivedC = c.stopIdx >= total - 1 && !c.awaitingTransfer;
const outfitC = outfitOf(s.outfit);
const isRailRide = c.route.legs.some((l) => ["szhz-rail", "guangshen", "hz-intercity", "ganshen-rail", "guangshan-rail"].includes(l.line.id));
const RAIL_ENTRY_SETS: LifeSet[] = ["station", "station", "platform", "platform"];
const stageSet: LifeSet = rideEntry !== null ? (isRailRide ? RAIL_ENTRY_SETS[rideEntry]! : ENTRY_STEPS[rideEntry]!.set) : c.awaitingTransfer || arrivedC ? "platform" : isRailRide ? "train" : (c.route.legs[c.legIdx]?.line ?? c.route.line).id.startsWith("bus-") ? "bus" : "metro";
const stagePose: LifePose = rideEntry !== null ? ENTRY_STEPS[rideEntry]!.pose : c.awaitingTransfer || arrivedC ? "walk" : c.seated ? "sit" : "idle";
const stageKey = rideEntry !== null ? `entry-${rideEntry}` : c.awaitingTransfer ? "transfer" : arrivedC ? "arrived" : c.seated ? "sit" : "stand";
const curStation = c.route.stations[c.stopIdx];
const nextStation = c.route.stations[c.stopIdx + 1];
if (!rideBig) return (
<div className="fixed inset-x-0 bottom-3 z-[60] flex justify-center px-3" role="status" aria-label={`${curLine.name}`}>
<div className="w-full max-w-md overflow-hidden rounded-[16px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-xl">
<p className="flex items-center justify-between px-3 py-1.5 text-xs font-black text-white" style={{ background: curLine.colorCss }}><span>{isRailRide ? "🚄" : "🚇"} {curLine.short}</span><span>{Math.min(c.stopIdx + 1, total)}/{total}</span></p>
<div className="flex items-center gap-2 px-3 py-2">
<span className="min-w-0 flex-1 text-sm font-bold">{rideEntry !== null ? (en ? "Entering the station…" : `进站中：${ENTRY_STEPS[rideEntry]!.caption}`) : c.awaitingTransfer ? (en ? `Change at ${curStation?.name ?? ""}` : `${curStation?.name ?? ""}站换乘`) : arrivedC ? (en ? `Arrived: ${curStation?.name ?? ""}` : `到站：${curStation?.name ?? ""}`) : (en ? `${curStation?.name ?? ""} → ${nextStation?.name ?? ""}` : `${curStation?.name ?? ""} → 下一站 ${nextStation?.name ?? ""}`)}
<span className="block text-[11px] font-normal text-[var(--dim)]">{en ? "The train is running on the map" : "列车正在地图上沿线路开"}</span></span>
{c.awaitingTransfer ? <button type="button" onClick={doTransfer} className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-black text-white">{en ? "Change" : "换乘上车"}</button>
 : arrivedC ? <button type="button" onClick={() => finishMetroRide()} className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-black text-white">{en ? "Get off" : "下车出站"}</button> : null}
<button type="button" onClick={() => setRideBig(true)} className="shrink-0 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-black">{en ? "Carriage" : "车厢里看看"}</button>
</div>
</div>
</div>
);
return (
<div className="fixed bottom-3 right-3 z-[60] flex w-[min(400px,calc(100vw-24px))] justify-end" role="dialog" aria-label={`${curLine.name}车厢`}>
<div className="rise max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-0 shadow-xl">
{/* carriage header: line strip */}
<div className="p-4 pb-3 text-white" style={{ background: curLine.colorCss }}>
<p className="flex items-center justify-between text-xs font-black"><span>{isRailRide ? "🚄" : "🚇"} {curLine.name}{c.route.isTransfer ? ` · 全程 ${c.route.summary}` : ""}</span><span>{c.crowdLabel}</span></p>
<p className="font-display mt-1 text-2xl font-black">{c.awaitingTransfer ? `换乘站 · ${curStation?.name}站` : arrivedC ? `已到达 · ${curStation?.name}站` : `下一站 · ${nextStation?.name ?? ""}`}</p>
<p className="mt-0.5 text-xs opacity-90">{locById(c.fromLoc).name} → {locById(c.toLoc).name} · 共 {c.route.stops} 站{c.route.isTransfer ? ` · 换乘 ${c.route.transferStations.length} 次（${c.route.transferStations.join("、")}）` : ""} · 票价 {Y}{Math.round(c.route.fare * policyRef.current.metro)} · {c.seated ? "💺 坐着" : "🧍 站着扶杆"}</p>
</div>
{/* route strip */}
<div ref={routeStripRef} className="relative flex items-center gap-0 overflow-x-auto px-4 pt-3 [scrollbar-width:none]">
{c.route.stations.map((st, i) => (
<span key={st.name + i} data-stop={i} className="flex shrink-0 items-center">
<span className={`grid h-7 w-7 place-items-center rounded-full border-2 text-[10px] font-black ${i < c.stopIdx ? "border-transparent text-white" : i === c.stopIdx ? "bg-[var(--surface)]" : "border-[var(--line)] text-[var(--dim)]"}`} style={i < c.stopIdx ? { background: curLine.colorCss } : i === c.stopIdx ? { borderColor: curLine.colorCss, color: curLine.colorCss } : {}}>{i + 1}</span>
<span className={`mx-1 text-[11px] font-bold ${i === c.stopIdx ? "" : "text-[var(--dim)]"}`}>{st.name}{c.route.transferStations.includes(st.name) && i > 0 && i < total - 1 ? (c.route.shuttleFrom.includes(st.name) ? "（接驳换乘）" : "（换乘）") : ""}</span>
{i < total - 1 && <span className="h-0.5 w-3 shrink-0" style={{ background: i < c.stopIdx ? curLine.colorCss : "var(--line)" }} />}
</span>
))}
</div>
{/* get off / change / get off early: right under the stations, no scrolling on a phone */}
<div className="px-4 pt-3">
{rideEntry !== null ? (
<button type="button" disabled className="w-full rounded-full bg-[var(--accent)] py-3.5 text-sm font-black text-white disabled:opacity-40">🚶 正在进站：安检 → 等车 → 上车，一步都不少</button>
) : c.awaitingTransfer ? (
<button type="button" onClick={doTransfer} className="w-full rounded-full bg-[var(--accent)] py-3.5 text-sm font-black text-white">{c.route.shuttleFrom.includes(curStation?.name ?? "") ? `🚌 在${curStation?.name}下车 · 坐接驳巴士到${nextStation?.name ?? "对面站"}换乘 ${(c.route.legs[c.legIdx + 1]?.line.short) ?? "下一条线"}` : `🔁 在${curStation?.name}换乘上车 → ${(c.route.legs[c.legIdx + 1]?.line.name) ?? "下一条线"}`}</button>
) : (
<>
<button type="button" disabled={!arrivedC} onClick={() => finishMetroRide()} className="w-full rounded-full bg-[var(--accent)] py-3.5 text-sm font-black text-white disabled:opacity-40">{arrivedC ? `🔔 到站了，下车出站 → ${locById(c.toLoc).name}（票 ${Y}${Math.round(c.route.fare * policyRef.current.metro)}）` : `行驶中… 还有 ${total - 1 - c.stopIdx} 站（自动报站中）`}</button>
{!arrivedC && c.stopIdx > 0 && curStation && (
<button type="button" onClick={() => finishMetroRide(c.stopIdx)} className="mt-2 w-full rounded-full border-2 border-[var(--border)] bg-[var(--surface)] py-2.5 text-sm font-black">🚪 就在「{curStation.name}」下车（票 {Y}{partialFare(c.route, c.stopIdx)}）</button>
)}
</>
)}
</div>
{/* the ride, acted out: concourse → security → platform → carriage */}
<div className="mx-4 mt-3 overflow-hidden rounded-[16px] border-2 border-[var(--line)]">
<div className="relative h-52">
<LifeStage3D key={`ride-${stageKey}`} setKind={stageSet} pose={stagePose} shirt={outfitC.shirt} pants={outfitC.pants} night={false} emoji={iden.emoji} />
<div className="cine-grade" />
</div>
{rideEntry !== null ? (
<div className="flex items-center gap-2 bg-[var(--surface2)] px-3 py-2">
<p className="min-w-0 flex-1 text-xs leading-relaxed"><b>{ENTRY_STEPS[rideEntry]!.caption}</b> · {ENTRY_STEPS[rideEntry]!.sub}</p>
<button type="button" aria-label="跳过进站流程" onClick={() => setRideEntry(null)} className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-black">跳过 →</button>
</div>
) : (
<p className="bg-[var(--surface2)] px-3 py-1.5 text-[11px] font-bold text-[var(--dim)]">{c.awaitingTransfer ? "🚶 换乘：下车穿过换乘通道，走到对面站台再上车" : arrivedC ? "🔔 到站了，屏蔽门和车门都开了——先下后上" : c.seated ? "💺 你坐下了，看手机刷一刷，窗外的城市在往后跑" : "🧍 你站着扶着吊环，窗外风景在滚动"}</p>
)}
</div>
{/* carriage interior */}
{rideEntry === null && (<div className="mx-4 mt-3 rounded-[16px] border-2 border-[var(--line)] bg-[var(--bg)] p-3">
<div className="flex items-center justify-between rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-xs font-bold"><span>🚪 车门 {arrivedC ? "已开 · 先下后上" : "关闭"}</span><span>🖐️ 吊环扶手 ×{c.crowdLevel >= 2 ? "全被扶满" : "还有空位"}</span><span>{c.heldRail ? "✅ 你扶稳了" : "⚠️ 还没扶杆"}</span></div>
<p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">{c.crowdDesc}</p>
<p className="mt-1 rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-xs leading-relaxed">📢 {carriageLog}</p>
</div>)}
{/* interactions */}
{rideEntry === null && (<div className="grid grid-cols-2 gap-2 p-4 pt-3">
<button type="button" aria-label="车厢里看手机" disabled={c.phoneUsed} onClick={() => { setCarriage({ ...c, phoneUsed: true }); setCarriageLog("📱 你打开手机刷了刷：峰会资讯、天气和同城动态都看了一眼，时间过得快了些，心情 +2（下车结算）。"); }} className="act-btn disabled:opacity-40"><span className="text-sm font-black">📱 看手机</span><span className="block text-xs text-[var(--dim)]">{c.phoneUsed ? "刚看过，信号在隧道里时断时续" : "刷资讯/动态，解闷，心情 +2"}</span></button>
<button type="button" aria-label="给需要的人让座" disabled={!c.seated || c.gaveSeat} onClick={() => { setCarriage({ ...c, gaveSeat: true, seated: false }); setCarriageLog("💺 你起身把座位让给了需要的人，对方连声道谢。站一会儿没关系，人脉 +1、心情 +4（下车结算）。"); }} className="act-btn disabled:opacity-40"><span className="text-sm font-black">💺 让座</span><span className="block text-xs text-[var(--dim)]">{!c.seated ? (c.gaveSeat ? "已经让过座了，你站着" : "现在没座位可让（你在站着）") : "让给老人/孕妇，人脉 +1"}</span></button>
<button type="button" aria-label="扶好扶杆站稳" disabled={c.heldRail} onClick={() => { setCarriage({ ...c, heldRail: true }); setCarriageLog(c.crowdLevel >= 2 ? "🖐️ 你抓紧了扶杆。刚好一个急刹，人潮晃了一下——还好你站稳了，没踩到人也没被踩。" : "🖐️ 你扶好吊环，站得很稳。"); }} className="act-btn disabled:opacity-40"><span className="text-sm font-black">🖐️ 扶杆站稳</span><span className="block text-xs text-[var(--dim)]">{c.heldRail ? "已经扶稳了" : "人多时不扶杆，急刹容易摔"}</span></button>
<button type="button" aria-label="听报站看路线" onClick={() => setCarriageLog(`🗺️ 路线图亮着灯：你在 ${curStation?.name}，还要坐 ${total - 1 - c.stopIdx} 站到 ${locById(c.toLoc).name}。${nextStation ? `下一站 ${nextStation.name}。` : ""}`)} className="act-btn"><span className="text-sm font-black">🗺️ 看路线图/听报站</span><span className="block text-xs text-[var(--dim)]">确认还有几站，别坐过站</span></button>
</div>)}
<div className="px-4 pb-4">
<p className="mt-2 text-center text-[11px] text-[var(--dim)]">{s.cityKey === "hz" ? "真实城轨/高铁乘车体验" : s.cityKey === "hk" ? "真实港铁乘车体验" : "真实深圳地铁体验"}：屏蔽门、先下后上、换乘站广播、早高峰挤车厢。车停稳时可以随时在本站下车，按实际坐的里程扣费。</p>
</div>
</div>
</div>
);
})()}

{placesMapOpen && (
<PlacesMapModal cityKey={s.cityKey} fromLocId={currentLoc} onClose={() => setPlacesMapOpen(false)}
onGo={(id) => { setPlacesMapOpen(false); walkTo(id); }}
onLocate={(x, z, name) => { setPlacesMapOpen(false); setMapFocus({ x, z, nonce: Date.now() }); showToast(`📍 已在地图上定位到「${name}」。`); }} />
)}

{metroMapOpen && (
<MetroMapModal cityKey={s.cityKey} fromLocId={currentLoc} initialDest={metroMapDest} onClose={() => setMetroMapOpen(false)}
onRide={(fromName, toName) => { setMetroMapOpen(false); rideStations(fromName, toName); }}
onLocate={(x, z, name) => { setMetroMapOpen(false); setMapFocus({ x, z, nonce: Date.now() }); showToast(`📍 已在地图上定位到「${name}」站。`); }} />
)}

{/* ===== LIFE ANIMATION SCENE ===== */}
{lifeAnim && (() => { const scene = LIFE_SCENES[lifeAnim.kind]; const rawStep = scene.steps[Math.min(lifeAnim.idx, scene.steps.length - 1)]!; /* Huizhou has no metro: in the day montage the 换乘地铁 beat is a 城轨 beat there */ const step = s.cityKey === "hz" && rawStep.caption === "换乘地铁" ? { ...rawStep, caption: "换乘城轨", prop: "🚆", bg: "🚆 👥 👥" } : rawStep; const rainyDay = nowRainy; return (
<div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 backdrop-blur-[3px] p-3 sm:items-center" role="dialog" aria-label={`生活动画：${scene.title}`}>
<div className="rise w-full max-w-lg overflow-hidden rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-2xl">
<div className="flex items-center gap-2 px-4 pt-3.5">
<span className="chip">📷 真实照片里的 3D 演绎 · Real photo × live 3D</span>
<p className="text-sm font-black">{scene.title}</p>
<span className="ml-auto text-[11px] font-bold text-[var(--dim)]">{lifeAnim.idx + 1} / {scene.steps.length}</span>
</div>
{(() => { const sp = lifeStageFor(lifeAnim.kind, lifeAnim.idx); const outfit = outfitOf(s.outfit); const stepNight = scene.tone === "night" && !step.dawn; return (
<div key={`stage-${lifeAnim.kind}-${lifeAnim.idx}`} className={`life-stage life-fade mx-4 mt-3 h-60 sm:h-72 ${stepNight ? "night" : scene.tone === "indoor" ? "indoor" : ""}`}>
{CUTSCENE_ROAM[lifeAnim.kind] ? (
  <LifeStage3D key={`roam-${lifeAnim.kind}-${lifeAnim.idx}`} setKind={CUTSCENE_ROAM[lifeAnim.kind]!} pose="idle" roam
    shirt={outfit.shirt} pants={outfit.pants} night={stepNight} emoji={iden.emoji} en={en}
    onSpot={() => { if (lifeAnim.idx + 1 >= scene.steps.length) finishLifeAnim(); else setLifeAnim({ kind: lifeAnim.kind, idx: lifeAnim.idx + 1 }); }} />
) : (
  <LifeStage3D key={`${lifeAnim.kind}-${lifeAnim.idx}`} setKind={sp.set} pose={sp.pose} shirt={outfit.shirt} pants={outfit.pants} night={stepNight} emoji={iden.emoji} />
)}
<div aria-hidden="true" className="cine-grade" />
{rainyDay && lifeAnim.kind === "day" && <div className="life-rain" aria-hidden="true" />}
</div> ); })()}
<PhotoCreditLine url={SCENE_PHOTOS[lifeStageFor(lifeAnim.kind, lifeAnim.idx).set]} />
<div key={`cap-${lifeAnim.idx}`} className="life-fade px-4 pb-2 pt-3">
<p className="font-display text-xl font-black">{step.caption}</p>
<p className="mt-0.5 text-sm leading-relaxed text-[var(--dim)]">{step.sub}</p>
</div>
<div className="flex items-center gap-2 px-4 pb-4">
<div className="flex gap-1">{scene.steps.map((_, i) => (<span key={i} className={`h-1.5 rounded-full transition-all ${i <= lifeAnim.idx ? "w-5 bg-[var(--accent)]" : "w-2.5 bg-[var(--line)]"}`} />))}</div>
<button type="button" aria-label="跳过生活动画" onClick={finishLifeAnim} className="ml-auto rounded-full border-2 border-[var(--text)] px-4 py-2 text-xs font-black">跳过 ⏭</button>
</div>
</div>
</div> ); })()}

{/* ===== 现在能干嘛 ===== */}
{hubOpen && (() => {
const ck = s.cityKey;
const here = locById(currentLoc);
const allLocs: Loc[] = [...getLocations(ck), ...placesForCity(ck).map((pl) => resolveLoc(ck, pl.id)).filter((x): x is Loc => !!x)];
const rows = (Object.keys(CAT_LABEL) as ActCat[]).flatMap((c) => ACTIVITIES_LIST.filter((a) => a.cat === c)).map((a) => {
  const cands = allLocs.filter((l) => { try { return a.at(l); } catch { return false; } }).map((l) => ({ l, d: Math.hypot(l.x - here.x, l.z - here.z), why: actBlock(a, s, true, l) })).sort((x, y) => (x.why ? 1 : 0) - (y.why ? 1 : 0) || x.d - y.d);
  return { a, best: cands[0], n: cands.length };
}).filter((r) => r.best && (hubCat === "all" || r.a.cat === hubCat) && (!hubOpenOnly || !r.best.why));
const todo: { t: string; go?: () => void }[] = [];
if (s.workDay !== s.day && employerHere(s)) todo.push({ t: en ? `💼 Haven't worked today — ${companyById(s.employer).short}` : `💼 今天还没上班：${companyById(s.employer).short}`, go: () => { const co = employerHere(s); if (co?.locIds[0]) { setHubOpen(false); walkTo(co.locIds[0]); } } });
if (s.sleptDay !== s.day && nowMin() >= 21 * 60) todo.push({ t: en ? "😴 Time for bed — go home and sleep" : "😴 不早了，回家睡觉", go: () => { setHubOpen(false); goHomeAndSleep(); } });
if (isSaturday(s.day)) todo.push({ t: en ? `🏠 Rent ${fmt(rentDue)} is due tonight` : `🏠 今晚交租 ${fmt(rentDue)}` });
for (const st of STORIES.filter((x) => npcsForCity(s.cityKey).some((n) => n.name === x.npc))) { const k = storyStatus(st, s.story?.[st.npc], memOf(s.npcMem ?? {}, st.npc).rel, s.day).kind; if (k === "ready" || k === "ending") todo.push({ t: en ? `📖 ${trText(st.npc)}'s story has a new chapter` : `📖 ${st.npc}的故事有新章节`, go: () => { setHubOpen(false); openNpcChat(st.npc); } }); }
const openParties = parties.filter((pt) => pt.status === "open" && !pt.members.some((m) => m.id === myId));
if (openParties.length) todo.push({ t: en ? `🎉 ${openParties.length} open part${openParties.length > 1 ? "ies" : "y"} in the city` : `🎉 城里有 ${openParties.length} 个局在等人`, go: () => { setHubOpen(false); setPartyOpen(true); } });
if (!loggedIn && s.day >= 2) todo.push({ t: en ? "👤 Link an account so you never lose progress (and unlock DMs and parties)" : "👤 绑定账号：进度不丢，还能私聊、组局", go: () => { setHubOpen(false); setAccountOpen(true); } });
if (unreadDm) todo.push({ t: en ? `💬 ${unreadDm} unread message${unreadDm > 1 ? "s" : ""}` : `💬 ${unreadDm} 条未读私信`, go: () => { setHubOpen(false); setDmOpen(true); } });
return (
<div className="fixed inset-0 z-[66] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={en ? "What can I do now" : "现在能干嘛"}>
<div className="rise flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)]">
<div className="border-b border-[var(--line)] p-4">
<p className="flex items-center justify-between gap-2"><span className="font-display text-xl font-black">🧭 {en ? "What can I do now?" : "现在能干嘛？"}</span><span className="flex items-center gap-2"><span className="text-xs font-bold text-[var(--dim)]">{en ? `Beijing time ${clockStr(nowMin())}` : `北京时间 ${clockStr(nowMin())}`}</span><button type="button" onClick={() => setHubOpen(false)} className="rounded-full border px-3 py-1 text-xs font-black">✕</button></span></p>
{todo.length > 0 && <div className="mt-2 grid gap-1.5 sm:grid-cols-2">{todo.map((x, i) => <button key={i} type="button" disabled={!x.go} onClick={x.go} className="rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-left text-xs font-black">{x.t}{x.go ? " →" : ""}</button>)}</div>}
<div className="mt-3 flex flex-wrap gap-1.5">
<button type="button" onClick={() => setHubCat("all")} className={`chip ${hubCat === "all" ? "bg-[var(--text)] text-[var(--bg)]" : ""}`}>{en ? "All" : "全部"}</button>
{(Object.keys(CAT_LABEL) as ActCat[]).map((c) => <button key={c} type="button" onClick={() => setHubCat(c)} className={`chip ${hubCat === c ? "bg-[var(--text)] text-[var(--bg)]" : ""}`}>{L2t(CAT_LABEL[c])}</button>)}
<label className="chip cursor-pointer"><input type="checkbox" checked={hubOpenOnly} onChange={(e) => setHubOpenOnly(e.target.checked)} className="mr-1" />{en ? "Open now only" : "只看现在能玩"}</label>
</div>
</div>
<div className="grid flex-1 gap-2 overflow-y-auto p-4 sm:grid-cols-2">
{rows.length === 0 && <p className="text-sm text-[var(--dim)]">{en ? "Nothing open in this category right now — untick \"Open now only\" to see when things open." : "这个分类现在没有能玩的——取消「只看现在能玩」，看看什么时候开门。"}</p>}
{rows.map(({ a, best, n }) => { const atHere = best!.l.id === currentLoc; return (
<div key={a.id} className="rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-2.5">
<p className="flex items-center justify-between gap-2 text-sm font-black"><span>{a.emoji} {L2t(a.name)}</span><span className="text-[10px] font-bold text-[var(--dim)]">{L2t(CAT_LABEL[a.cat])}</span></p>
<p className="mt-0.5 text-xs text-[var(--dim)]">{L2t(a.desc)}</p>
<p className="mt-1 text-[11px] font-bold">{atHere ? (en ? "📍 Right here" : "📍 就在这儿") : `📍 ${en ? trText(best!.l.name) : best!.l.name} · ${en ? "about" : "约"} ${etaMinutes(travelMode, best!.d)} ${en ? "min away" : "分钟路程"}`}{n > 1 ? (en ? ` · ${n} places` : ` · 共 ${n} 处`) : ""}</p>
{best!.why && <p className="text-[11px] font-bold text-[var(--accent)]">⏰ {best!.why}</p>}
<button type="button" onClick={() => { setHubOpen(false); if (atHere) { setSelectedLoc(best!.l.id); startActivity(a, { locId: best!.l.id }); } else { setSelectedLoc(best!.l.id); walkTo(best!.l.id); } }} className="mt-1.5 w-full rounded-full bg-[var(--text)] py-1.5 text-xs font-black text-[var(--bg)]">{atHere ? (en ? "▶ Play here" : "▶ 就在这儿玩") : (en ? "Go there →" : "去这里 →")}</button>
</div> ); })}
</div>
</div>
</div> ); })()}

{/* ===== 玩家名片 ===== */}
{cardOf && (() => { const c = cardQuery.data?.card; const ol = (world?.online ?? []).find((x) => x.id === cardOf); return (
<div className="fixed inset-0 z-[67] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={en ? "Player card" : "玩家名片"}>
<div className="rise w-full max-w-sm rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
<div className="flex items-start gap-3">
<span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--surface2)] text-3xl">{c?.emoji ?? ol?.emoji ?? "🙂"}</span>
<div className="min-w-0 flex-1">
<p className="font-display text-xl font-black">{c?.name ?? ol?.name ?? "…"}</p>
<p className="text-xs text-[var(--dim)]">{c ? `${c.online ? "🟢 " : "⚪ "}${en ? trText(CITIES[c.cityKey === "hz" ? "hz" : "sz"].name) : CITIES[c.cityKey === "hz" ? "hz" : "sz"].name} · ${en ? "Day" : "第"} ${c.gameDay}${en ? "" : " 天"} · ${(CAREERS[c.careerIdx] ?? CAREERS[0]!).name} · ${companyById(c.employer).short}` : (en ? "Loading…" : "加载中……")}</p>
{c && <p className="mt-1 flex flex-wrap gap-1">{c.title && <span className="chip" style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>🏅 {c.title}</span>}<span className="chip">🎫 {c.stamps}</span>{c.buddy > 0 && <span className="chip">🤝 {en ? `played together ×${c.buddy}` : `一起玩过 ${c.buddy} 次`}</span>}</p>}
</div>
<button type="button" onClick={() => setCardOf(null)} className="shrink-0 rounded-full border px-3 py-1 text-xs font-black">✕</button>
</div>
<div className="mt-3 grid grid-cols-2 gap-2">
<button type="button" disabled={c?.blocked} onClick={() => openDm(cardOf)} className="rounded-full bg-[var(--text)] py-2.5 text-sm font-black text-[var(--bg)] disabled:opacity-40">💬 {en ? "Message" : "私聊"}</button>
<button type="button" disabled={c?.blocked} onClick={() => inviteToParty(cardOf)} className="rounded-full bg-[var(--accent)] py-2.5 text-sm font-black text-white disabled:opacity-40">👥 {en ? "Invite to party" : "邀请组局"}</button>
<button type="button" disabled={s.money < GIFTS.tea.cost} onClick={() => sendGift(cardOf, c?.name ?? ol?.name ?? "", "tea")} className="rounded-full border-2 border-[var(--text)] py-2 text-xs font-black disabled:opacity-40">{GIFTS.tea.emoji} {en ? `Send a bubble tea ¥${GIFTS.tea.cost}` : `请杯${GIFTS.tea.name} ¥${GIFTS.tea.cost}`}</button>
<button type="button" onClick={() => blockNow(cardOf, !c?.blocked)} className="rounded-full border-2 border-[var(--line)] py-2 text-xs font-black">{c?.blocked ? (en ? "Unblock" : "取消拉黑") : (en ? "🚫 Block" : "🚫 拉黑")}</button>
</div>
{(() => { const mineWith = bonds.filter((b) => b.peerId === cardOf); return (
<div className="mt-2 grid grid-cols-3 gap-1.5">
{(Object.keys(BOND_INFO) as BondKind[]).map((k) => { const has = mineWith.find((b) => b.kind === k); return (
<button key={k} type="button" disabled={c?.blocked || !!has} onClick={() => void proposeBond(cardOf, k)} className="rounded-full border-2 border-[var(--line)] py-1.5 text-[11px] font-black disabled:opacity-50" title={en ? BOND_INFO[k].perk[1] : BOND_INFO[k].perk[0]}>{BOND_INFO[k].emoji} {has ? (has.status === "active" ? (en ? BOND_INFO[k].en : BOND_INFO[k].zh) : (en ? "Sent" : "已邀请")) : (en ? BOND_INFO[k].ask[1] : BOND_INFO[k].ask[0])}</button> ); })}
</div> ); })()}
<details className="mt-2 text-xs"><summary className="cursor-pointer font-black text-[var(--dim)]">⚠️ {en ? "Report" : "举报"}</summary>
<div className="mt-1.5 flex flex-wrap gap-1.5">{([["harassment", "骚扰", "Harassment"], ["scam", "诈骗", "Scam"], ["spam", "广告刷屏", "Spam"], ["inappropriate", "不当内容", "Inappropriate"], ["minor", "疑似未成年人安全问题", "Child safety"], ["other", "其他", "Other"]] as const).map(([k, zh, e]) => <button key={k} type="button" onClick={() => reportNow(cardOf, k)} className="chip">{en ? e : zh}</button>)}</div>
</details>
<p className="mt-2 text-[11px] text-[var(--dim)]">{en ? "Never share passwords, codes or payment details in chat. Anyone asking you to move to another app or send money is likely a scam." : "聊天里不要透露密码、验证码和付款信息；让你转到别的 App 或者转账的，大概率是诈骗。"}</p>
</div>
</div> ); })()}

{/* ===== 私信 ===== */}
{crossTo && (() => { const routes = crossRoutes(s.cityKey, crossTo); const tn = nowMin(); const here = currentLoc; const nameOf = (ck: CityKey, id: string) => id === "*" ? "你现在的位置" : getLocations(ck).find((l) => l.id === id)?.name ?? id; return (
<div className="fixed inset-0 z-[75] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={`去${CITIES[crossTo].name}的路线`} onClick={() => setCrossTo(null)}>
<div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--text)]" onClick={(e) => e.stopPropagation()}>
<div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-black">🧭 {en ? `To ${CITY_EN[crossTo]}: pick a route` : `去${CITIES[crossTo].name}：选一条路`}</h2><button type="button" onClick={() => setCrossTo(null)} aria-label="关闭" className="text-xl">✕</button></div>
<p className="mb-3 text-xs text-[var(--dim)]">{en ? `Real routes with real opening hours (Beijing time ${clockStr(tn)}). Each one arrives at its own port or station across the border; if you are not at the start, you will be taken there first. Your progress comes with you.` : `都是真实线路，按真实开放时间（北京时间 ${clockStr(tn)}）。从哪儿出发就到对面哪个口岸 / 车站；不在出发点会先带你过去。进度、家当原样带着走。`}</p>
<div className="grid gap-2">
{routes.map((r) => { const open = isCrossOpen(r, tn); const atStart = r.fromLoc === "*" || here === r.fromLoc; return (
<div key={r.id} className={`rounded-[14px] border p-3 ${open ? "border-[var(--line)]" : "border-dashed border-[var(--line)] opacity-60"}`}>
<p className="text-sm font-black">{r.emoji} {crossName(r, en)}</p>
<p className="mt-0.5 text-xs font-bold">{nameOf(r.from, r.fromLoc)} → {nameOf(r.to, r.toLoc)}</p>
<p className="mt-1 text-xs text-[var(--dim)]">{crossNote(r, en)}</p>
<div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold">
{!r.shut && <span className="chip">{crossFareStr(r, en)}</span>}{!r.shut && <span className="chip">⏱ {r.min} {en ? "min" : "分钟"}</span>}<span className={`chip ${open ? "" : "border-red-400 text-red-500"}`}>{r.shut ? `⛔ ${crossHoursStr(r, en)}` : open ? `🟢 ${en ? "Open" : "开放"} ${crossHoursStr(r, en)}` : `⛔ ${en ? "Not running" : "已停"} · ${crossHoursStr(r, en)}`}</span>{r.car && !r.shut && <span className="chip">🪪 {en ? "Needs a licence and a car" : "要驾照和车"}</span>}
<button type="button" disabled={!open} onClick={() => takeRoute(r)} className="ml-auto rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-xs font-black text-white disabled:opacity-40">{r.shut ? (en ? "Closed" : "不开放") : atStart ? (en ? "Go" : "出发") : en ? `Go to ${trText(nameOf(r.from, r.fromLoc))} first` : `先去${nameOf(r.from, r.fromLoc)}`}</button>
</div>
</div>); })}
</div>
</div>
</div>); })()}
{walking && !carriage && tripMode && (
<div className="fixed left-1/2 top-[54px] z-[62] flex max-w-[calc(100vw-24px)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-[16px] border-2 border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 shadow-xl" role="toolbar" aria-label={en ? "Trip controls" : "行程操作"}>
<button type="button" onClick={() => stopTrip()} className="rounded-full bg-[#dc2626] px-3 py-1 text-xs font-black text-white">🛑 {en ? "Stop here" : "就地下车"}</button>
<span className="text-[11px] font-bold text-[var(--dim)]">{en ? "or switch to" : "或改用"}</span>
{modesForCity(s.cityKey).filter((m) => ["walk", "run", "bike", "moto", "bus", "metro", "taxi", "drive"].includes(m.id) && m.id !== tripMode).map((m) => (
(() => { const h = modeHours(m.id, s.cityKey); const off = h && !inWindow(nowMin(), h); return <button key={m.id} type="button" disabled={!!off} title={off ? (en ? `Not running now · ${windowStr(h!)}` : `现在停运 · 运营 ${windowStr(h!)}`) : (en ? trText(m.name) : m.name)} aria-label={en ? `Switch to ${trText(m.name)}` : `改用${m.name}`} onClick={() => stopTrip(m.id)} className="rounded-full border border-[var(--line)] px-2 py-1 text-xs font-black disabled:opacity-40">{m.emoji} {en ? trText(m.name) : m.name}{off ? <span className="ml-1 text-[10px] font-bold text-[var(--accent)]">{en ? "closed" : "停运"}</span> : null}</button>; })()
))}
</div>
)}
{rideBig && (roadRide || carriage) && <button type="button" onClick={() => setRideBig(false)} className="fixed bottom-3 right-[min(412px,calc(100vw-12px))] z-[61] rounded-full border-2 border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-black shadow-xl">▾ {en ? "Fold" : "收起"}</button>}
{updatesOpen && phase === "game" && profile && <UpdatesModal en={en} playerId={profile.playerId} city={s.cityKey} news={news} onClose={() => setUpdatesOpen(false)} toast={showToast} />}
{bondsOpen && phase === "game" && profile && <BondsModal en={en} playerId={profile.playerId} bonds={bonds} onClose={() => setBondsOpen(false)} toast={showToast} refresh={() => void bondsQuery.refetch()} openCard={(pub) => { setBondsOpen(false); setCardOf(pub); }} />}
{committeeOpen && phase === "game" && profile && <CommitteeModal en={en} playerId={profile.playerId} city={s.cityKey} cityName={en ? trText(CITIES[s.cityKey].name) : CITIES[s.cityKey].name} st={committeeQuery.data} onClose={() => setCommitteeOpen(false)} toast={showToast} refresh={() => void committeeQuery.refetch()} openAccount={() => { setCommitteeOpen(false); setAccountOpen(true); }} />}
{adsOpen && phase === "game" && profile && <BillboardModal en={en} token={accountToken()} playerName={profile.name} city={s.cityKey} day={s.day} shop={shopLabel} spots={billboardSpots(s.cityKey).map((l) => (en ? trText(l.name) : l.name))} st={billboardsQuery.data} onClose={() => setAdsOpen(false)} toast={showToast} refresh={() => void billboardsQuery.refetch()} openAccount={() => { setAdsOpen(false); setAccountOpen(true); }} openStore={() => { setAdsOpen(false); setStoreOpen(true); }} />}
{adsOpen && phase === "game" && <p className="fixed bottom-3 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-bold text-white">🛒 想买卖二手、发交易贴？手机 →「交易」。</p>}
{/* round-2 (d §5e): report composer */}
{reportDraft && phase === "game" && (
<div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label="举报">
<div className="rise max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
<p className="flex items-center justify-between"><span className="font-display text-xl font-black">{reportDraft.kind === "landlord" ? "🚨 举报房东" : "🚨 举报公司"}</span><button type="button" onClick={() => setReportDraft(null)} className="rounded-full border px-3 py-1 text-xs font-black">✕</button></p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">举报对象：{reportDraft.targetName} · 举报会公示给全城玩家陪审 24 小时：属实就曝光 + 退钱，诬告会扣你自己的信用。</p>
{reportDraft.evidence?.kind === "rent" && <p className="mt-2 rounded-[12px] bg-[var(--surface2)] p-2 text-xs">📎 证据：基准租金 {fmt(reportDraft.evidence.baseRent)}/周 → 现在 {fmt(reportDraft.evidence.currentRent)}/周 · 已交 {fmt(reportDraft.evidence.rentPaid)}</p>}
{reportDraft.evidence?.kind === "wage" && <p className="mt-2 rounded-[12px] bg-[var(--surface2)] p-2 text-xs">📎 证据：上班 {reportDraft.evidence.workCount} 天 · 加班 {reportDraft.evidence.otCount} 次</p>}
<p className="mt-3 text-xs font-black">指控（点一个，自动写进正文）</p>
<div className="mt-1.5 flex flex-wrap gap-1.5">
{SUGGESTED_CHARGES[reportDraft.kind].map((c) => (
<button key={c.key} type="button" onClick={() => setReportDraft((d) => d ? { ...d, body: d.body ? d.body : c.hint } : d)} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-black">{c.label}</button>
))}
</div>
<textarea value={reportDraft.body} onChange={(e) => setReportDraft((d) => d ? { ...d, body: e.target.value } : d)} placeholder="写清楚发生了什么（10–600 字），陪审团就看这段话和证据。" rows={4} className="mt-2 w-full rounded-[12px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm" />
<button type="button" onClick={async () => { if (!profile) return; const d = reportDraft; const err = validateDraft(d); if (err) { showToast(err); return; } const gate = canFile(reportBook.state, d.kind, s.day); if (!gate.ok) { showToast(gate.reason); return; } try { const r = await reportApi.fileBlackReport({ playerId: profile.playerId, ...d }); if (!r.ok) { showToast(r.error ?? ""); return; } reportBook.noteFiled(d, s.day); showToast("举报发出去了，24 小时内全城陪审投票。"); setReportDraft(null); void reportsQuery.refetch(); } catch { showToast("网络不太好"); } }} disabled={reportDraft.body.trim().length < 10} className="mt-3 w-full rounded-full bg-[var(--accent)] py-3 text-sm font-black text-white disabled:opacity-40">提交举报（公示 24 小时）</button>
</div>
</div>
)}
{/* round-2 (f): job center */}
{jobCenterOpen && phase === "game" && (
<div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label="就业服务中心">
<div className="rise max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
<p className="flex items-center justify-between"><span className="font-display text-xl font-black">💼 就业服务中心</span><button type="button" onClick={() => setJobCenterOpen(false)} className="rounded-full border px-3 py-1 text-xs font-black">✕</button></p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">失业不是终点：这里有阶梯岗位、免费培训、模拟面试和真人辅导。{s.life ? flatStatusLine(s.life, lifeProfile(s))[0] : ""}</p>
<div className="mt-3 flex flex-wrap gap-2">
{JOB_CENTER_TABS.map((t) => <button key={t.id} type="button" onClick={() => setJobTab(t.id)} className={`rounded-full px-3 py-2 text-xs font-black ${jobTab === t.id ? "bg-[var(--text)] text-[var(--bg)]" : "border border-[var(--line)]"}`}>{t.label[0]}</button>)}
</div>
{jobTab === "jobs" && (
<div className="mt-3 grid gap-2">
{listingsFor(lifeProfile(s)).map(({ listing, available, missing, pay }) => {
  const applied = (s.life?.flat.applications ?? []).some((a) => a.listingId === listing.id && (a.status === "applied" || a.status === "trial"));
  const trial = s.life?.flat.trial?.listingId === listing.id;
  const daysWorked = s.life?.flat.trial?.daysWorked ?? 0;
  return (
  <div key={listing.id} className="rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
  <p className="text-sm font-bold">{listing.emoji} {listing.title[0]} <span className="text-[var(--accent)]">{fmt(pay)}/天</span></p>
  <p className="text-xs text-[var(--dim)]">{listing.desc[0]}</p>
  <p className="mt-1 text-[11px]">{listing.path[0]}</p>
  {!available && <p className="mt-1 text-[11px] font-bold text-[var(--accent)]">还差：{missing.map((m) => m[0]).join("、")}</p>}
  <div className="mt-2 flex flex-wrap gap-2">
  {!applied && <button type="button" disabled={!available} onClick={() => { const r = applyForJob(s.life ?? defaultLifestyleState(), listing.id, s.day); applyLife(r); if (r.ok && profile) void api.applyJob({ playerId: profile.playerId, listingId: listing.id, day: s.day }).catch(() => {}); }} className="rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)] disabled:opacity-40">投简历</button>}
  {applied && !trial && <button type="button" onClick={() => { const r = startTrial(s.life ?? defaultLifestyleState(), listing.id, s.day); applyLife(r); if (r.ok && profile) void api.startTrial({ playerId: profile.playerId, listingId: listing.id, day: s.day }).catch(() => {}); }} className="rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">去试工</button>}
  {trial && daysWorked < 3 && <button type="button" onClick={() => { const r = trialWorkDay(s.life ?? defaultLifestyleState(), 75, s.cityKey); applyLife(r); }} className="rounded-full bg-[var(--accent)] px-3 py-2 text-xs font-black text-white">认真干一天试工（第 {daysWorked + 1}/3 天）</button>}
  {trial && daysWorked >= 3 && <button type="button" onClick={() => { const r = resolveTrial(s.life ?? defaultLifestyleState()); applyLife(r); }} className="rounded-full bg-[var(--accent)] px-3 py-2 text-xs font-black text-white">结算试工（看录不录用）</button>}
  </div>
  </div>
  );
})}
{(jobBoardQuery.data?.playerGigs ?? []).map((g) => (
<p key={g.id} className="text-xs">🧑‍🤝‍🧑 玩家发的活：{g.title} · {fmt(g.pay)} · {g.employerName}</p>
))}
</div>
)}
{jobTab === "guide" && (
<div className="mt-3">
<p className="text-sm font-black">📚 免费培训 <span className="font-normal text-[var(--dim)]">· 每天补贴 ¥30，上完加技能</span></p>
{COURSES.map((c) => { const done = (s.life?.flat.courses ?? []).some((x) => x.id === c.id && x.done); const active = (s.life?.flat.courses ?? []).some((x) => x.id === c.id && !x.done); return (
<div key={c.id} className="mt-2 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-bold">{c.emoji} {c.name[0]} <span className="font-normal text-[var(--dim)]">· {c.days} 天 · 补贴 {fmt(c.allowanceDay)}/天 · 技能 +{c.skillGain}</span></p>
<p className="text-xs text-[var(--dim)]">{c.desc[0]}</p>
{done ? <p className="mt-1 text-xs font-bold text-[var(--accent)]">✅ 已结业</p> : active ? <p className="mt-1 text-xs font-bold">📖 正在上课（每天自动结算）</p> : <button type="button" onClick={() => { const r = enrollCourse(s.life ?? defaultLifestyleState(), c.id, s.day); applyLife(r); if (r.ok && profile) void api.enrollCourse({ playerId: profile.playerId, courseId: c.id, day: s.day }).catch(() => {}); }} className="mt-2 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">报名</button>}
</div>
); })}
{(() => { const route = suggestRoute(lifeProfile(s)); return (
<div className="mt-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-black">🧭 职业辅导 · {route.emoji} {route.title[0]}</p>
<p className="text-xs text-[var(--dim)]">{route.basedOn[0]}</p>
{route.steps.map((st, i) => <p key={i} className="mt-1 text-xs">第{i + 1}步：{st[0]}</p>)}
<button type="button" onClick={() => { const r = bookGuidance(s.life ?? defaultLifestyleState(), lifeProfile(s)); applyLife(r); if (r.ok && profile) void api.bookGuidance({ playerId: profile.playerId, routeId: route.id }).catch(() => {}); }} className="mt-2 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">约一次辅导（免费）</button>
</div>
); })()}
</div>
)}
{jobTab === "interview" && (
<div className="mt-3">
<p className="text-sm font-black">🎤 模拟面试 <span className="font-normal text-[var(--dim)]">· 练 3 道题，攒面试底气</span></p>
{INTERVIEW_QUESTIONS.slice(0, 3).map((q, i) => (
<div key={i} className="mt-2 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-bold">{q.q[0]}</p>
{q.opts.map((o, j) => (
<button key={j} type="button" onClick={() => { const picks = [0, 0, 0]; picks[i] = j; const r = mockInterview(s.life ?? defaultLifestyleState(), picks); applyLife(r); }} className="mt-1.5 block w-full rounded-full border border-[var(--line)] px-3 py-2 text-left text-xs font-bold">{o.t[0]}</button>
))}
</div>
))}
<p className="mt-2 text-xs text-[var(--dim)]">点一个答案就练一轮（每轮按 3 道题计分）。</p>
</div>
)}
{jobTab === "help" && (
<div className="mt-3">
<p className="text-sm font-black">🤝 {REAL_HELP.title[0]}</p>
<p className="text-xs text-[var(--dim)]">{REAL_HELP.updated[0]} · {REAL_HELP.disclaimer[0]}</p>
{REAL_HELP.sections.map((sec, i) => (
<div key={i} className="mt-2 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-bold">{sec.title[0]}</p>
{sec.lines.map((ln, j) => <p key={j} className="mt-0.5 text-xs text-[var(--dim)]">{ln[0]}</p>)}
{sec.tel && <p className="mt-1 text-xs font-bold">📞 {sec.tel}{sec.telNote ? ` · ${sec.telNote[0]}` : ""}</p>}
</div>
))}
</div>
)}
</div>
</div>
)}
{/* round-2 (f): Sanhe board */}
{sanheOpen && phase === "game" && (
<div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label="三和大神板">
<div className="rise max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
<p className="flex items-center justify-between"><span className="font-display text-xl font-black">🏚️ 三和大神板</span><button type="button" onClick={() => setSanheOpen(false)} className="rounded-full border px-3 py-1 text-xs font-black">✕</button></p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">做一天玩三天，日结现金不拖明天。这里的日子也能过得体面：先活下来，再慢慢找机会。</p>
<p className="mt-3 text-xs font-black">🛠️ 今日日结</p>
<div className="mt-2 grid gap-2">
{SANHE_SHIFTS.map((sh) => (
<div key={sh.id} className="flex items-center gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{sh.emoji} {sh.name[0]} <span className="text-[var(--accent)]">{fmt(Math.round(sanhePay(s.cityKey) * sh.payMul))}</span></p>
<p className="text-xs text-[var(--dim)]">{sh.desc[0]} · 能量 -{sh.energy}</p>
</div>
<button type="button" disabled={s.energy < sh.energy || (s.life?.sanhe.shiftDay ?? 0) === s.day} onClick={() => { const r = takeSanheShift(s.life ?? defaultLifestyleState(), sh.id, s.day, s.cityKey, s.energy); applyLife(r); if (r.ok && profile && r.delta.money) void api.sanheShiftLog({ playerId: profile.playerId, shiftId: sh.id, pay: r.delta.money, day: s.day }).catch(() => {}); }} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)] disabled:opacity-40">{(s.life?.sanhe.shiftDay ?? 0) === s.day ? "今天结过了" : "接活"}</button>
</div>
))}
</div>
<p className="mt-3 text-xs font-black">🛏️ 今晚住哪儿</p>
<div className="mt-2 grid gap-2">
{SANHE_SLEEP.map((sl) => (
<div key={sl.id} className="flex items-center gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{sl.emoji} {sl.name[0]} <span className="text-[var(--accent)]">{sl.cost === 0 ? "免费" : fmt(sl.cost)}</span></p>
<p className="text-xs text-[var(--dim)]">{sl.desc[0]}</p>
</div>
<button type="button" disabled={s.money < sl.cost} onClick={() => applyLife(sanheSleep(s.life ?? defaultLifestyleState(), sl.id, s.money))} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)] disabled:opacity-40">住这儿</button>
</div>
))}
</div>
<p className="mt-3 text-xs font-black">🍜 吃点啥</p>
<div className="mt-2 flex flex-wrap gap-2">
{SANHE_EATS.map((e) => (
<button key={e.id} type="button" disabled={s.money < e.cost} onClick={() => applyLife(sanheEat(s.life ?? defaultLifestyleState(), e.id, s.money))} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black disabled:opacity-40">{e.emoji} {e.name[0]} · {fmt(e.cost)}</button>
))}
</div>
<p className="mt-3 text-xs font-black">🧑‍🤝‍🧑 搭子</p>
<div className="mt-2 grid gap-2">
{SANHE_MATES.map((m) => (
<div key={m.id} className="rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-sm font-bold">{m.emoji} {m.name[0]} <span className="font-normal text-[var(--dim)]">· {m.role[0]}</span></p>
<button type="button" onClick={() => applyLife(chatMate(s.life ?? defaultLifestyleState(), m.id))} className="mt-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-black">聊聊</button>
</div>
))}
</div>
<p className="mt-3 text-xs font-black">💬 跟房东谈谈房租</p>
<div className="mt-2 flex flex-wrap gap-2">
{RENT_TALKS.map((t) => (
<button key={t.id} type="button" onClick={() => applyLife(negotiateRent(s.life ?? defaultLifestyleState(), t.id))} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black">{t.emoji} {t.name[0]}</button>
))}
</div>
<p className="mt-3 text-xs font-black">🧺 旧物换钱 / 小摊</p>
<div className="mt-2 flex flex-wrap gap-2">
{SECONDHAND_FLOOR.map((it) => (
<button key={it.id} type="button" onClick={() => applyLife(sellSecondHand(s.life ?? defaultLifestyleState(), it.id))} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black">{it.emoji} 卖{it.name[0]} · +{fmt(it.value)}</button>
))}
<button type="button" onClick={() => applyLife(subletBunk(s.life ?? defaultLifestyleState()))} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black">🛏️ 转租床位一周 · +¥150</button>
{STALL_KINDS.map((k) => (
<button key={k[0]} type="button" onClick={() => applyLife(openStall(s.life ?? defaultLifestyleState(), k[0], s.day))} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black">摆{k[0]}摊</button>
))}
</div>
</div>
</div>
)}
{/* round-2 (e S4): flea market */}
{fleaOpen && phase === "game" && (
<div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label="二手家具市集">
<div className="rise max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
<p className="flex items-center justify-between"><span className="font-display text-xl font-black">🧺 二手家具市集</span><button type="button" onClick={() => setFleaOpen(false)} className="rounded-full border px-3 py-1 text-xs font-black">✕</button></p>
<p className="mt-1 text-xs text-[var(--dim)]">每天换一批货：旧家具能直接摆进家里，贱买的东西修修能再卖。价格按当天行情走。</p>
<p className="mt-3 text-xs font-black">🪑 今日二手家具（服务器库存）</p>
{(fleaQuery.data?.usedFurniture ?? []).map((piece) => (
<div key={piece.id} className="mt-2 flex items-center gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<div className="text-2xl">{piece.emoji}</div>
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{piece.name} <span className="text-[var(--accent)]">{fmt(piece.price)}</span></p>
<p className="text-xs text-[var(--dim)]">成色 {piece.condition}% · 原价 {fmt(piece.newPrice)} · {piece.note}</p>
</div>
<button type="button" disabled={s.money < piece.price || (econ.usedFurniture.owned ?? []).some((o) => o.id === piece.id)} onClick={async () => { if (!profile) return; const local = buyUsedFurnitureLocal(econ.usedFurniture, piece as unknown as Parameters<typeof buyUsedFurnitureLocal>[1]); if (!local.ok || !local.value) { showToast(local.error ?? ""); return; } try { const r = await api.buyUsedFurniture({ playerId: profile.playerId, pieceId: piece.id }); if (!r.ok) { showToast(r.error ?? ""); return; } } catch { showToast("网络不太好"); return; } setEcon((e) => ({ ...e, usedFurniture: local.value!.book })); mutate((x) => { x.money -= piece.price; if (!x.furniture.includes(local.value!.furnitureIdToAdd)) x.furniture = [...x.furniture, local.value!.furnitureIdToAdd]; }); showToast(`淘到了：${piece.emoji} ${piece.name}，已摆进家里。`); void fleaQuery.refetch(); }} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)] disabled:opacity-40">买下</button>
</div>
))}
{(econ.usedFurniture.owned ?? []).map((o) => (
<div key={o.id} className="mt-2 flex items-center gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<div className="text-2xl">{o.emoji}</div>
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{o.name} <span className="font-normal text-[var(--dim)]">· 成色 {o.condition}% · 买入价 {fmt(o.price)}</span></p>
<p className="text-xs text-[var(--dim)]">家里已摆 · 想卖掉换钱点下面</p>
</div>
<button type="button" onClick={() => { const r = resellUsedFurnitureLocal(econ.usedFurniture, o.id, o.price, o.condition); if (!r.ok || !r.value) { showToast(r.error ?? ""); return; } setEcon((e) => ({ ...e, usedFurniture: r.value!.book })); mutate((x) => { x.money += r.value!.received; x.earned += r.value!.received; x.furniture = x.furniture.filter((f) => f !== r.value!.furnitureIdToRemove); }); showToast(`卖掉了 ${o.name}，+${fmt(r.value.received)}。`); }} className="shrink-0 rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black">卖掉</button>
</div>
))}
<p className="mt-3 text-xs font-black">📱 今日贱买（修修能加价卖）</p>
{(fleaQuery.data?.cheap ?? []).map((good) => (
<div key={good.id} className="mt-2 flex items-center gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<div className="text-2xl">{good.emoji}</div>
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{good.name} <span className="text-[var(--accent)]">{fmt(good.buyPrice)}</span></p>
<p className="text-xs text-[var(--dim)]">{good.note} · 修好能卖 {fmt(good.askPrice)}</p>
</div>
<button type="button" disabled={s.money < good.buyPrice} onClick={async () => { if (!profile) return; const local = buyCheapGoodLocal(econ.cheapFlip, { name: good.name, emoji: good.emoji, kind: good.kind as never, state: good.state as never, condition: good.condition, buyPrice: good.buyPrice, askPrice: good.askPrice, note: good.note }, s.day); if (!local.ok || !local.value) { showToast(local.error ?? ""); return; } try { const r = await api.buyCheapGood({ playerId: profile.playerId, goodId: good.id }); if (!r.ok) { showToast(r.error ?? ""); return; } } catch { showToast("网络不太好"); return; } setEcon((e) => ({ ...e, cheapFlip: local.value!.book })); mutate((x) => { x.money -= good.buyPrice; }); showToast(`贱买到手：${good.emoji} ${good.name}，修修再卖。`); void fleaQuery.refetch(); }} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)] disabled:opacity-40">贱买</button>
</div>
))}
{(econ.cheapFlip.stock ?? []).map((g) => (
<p key={g.id} className="mt-2 text-xs">{g.emoji} {g.name} · 买入 {fmt(g.buyPrice)} · 标价 {fmt(g.askPrice)}{g.state === "plain" ? " · 已修好，可以卖了" : " · 还没修好"}</p>
))}
</div>
</div>
)}
{/* round-2 (g S6): build your own house */}
{buildOpen && phase === "game" && (
<div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label="自己盖房子">
<div className="rise max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
<p className="flex items-center justify-between"><span className="font-display text-xl font-black">🏗️ 自己盖房子</span><button type="button" onClick={() => { saveHouseLayout(houseLayout); setBuildOpen(false); }} className="rounded-full border px-3 py-1 text-xs font-black">✕</button></p>
<p className="mt-1 text-xs text-[var(--dim)]">在 12×8 的地块上盖自己的房子：加房间、摆家具，发布后就能在地图上看到、走进去。今天能发布的家具只有 3 种（双人床、布沙发、橱柜），其余先摆着看。</p>
<div className="relative mt-3 h-[260px] overflow-hidden rounded-[16px] border border-[var(--line)]">
<LifeStage3D key={`build-${houseLayout.rooms.length}-${houseLayout.items.length}`} setKind="bedroom" pose="idle" houseLayout={houseLayout} shirt={outfitOf(s.outfit).shirt} pants={outfitOf(s.outfit).pants} night={false} emoji={iden.emoji} en={en} />
</div>
<p className="mt-3 text-xs font-black">加房间</p>
<div className="mt-1.5 flex flex-wrap gap-1.5">
{HOUSE_ROOM_KINDS.map((rk) => (
<button key={rk.id} type="button" onClick={() => { const n = houseLayout.rooms.length; setHouseLayout((l) => addHouseRoom(l, { kind: rk.id, x: (n % 3) * 4 - 4, z: Math.floor(n / 3) * 4 - 2, w: rk.minW, d: rk.minD })); }} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-black">＋ {rk.zh}</button>
))}
</div>
{houseLayout.rooms.map((r) => (
<p key={r.id} className="mt-1.5 text-xs">{HOUSE_ROOM_KINDS.find((k) => k.id === r.kind)?.zh ?? r.kind} · {r.w}×{r.d} 米 <button type="button" onClick={() => setHouseLayout((l) => removeHousePiece(l, r.id))} className="ml-1 font-black text-[var(--accent)]">删除</button></p>
))}
<p className="mt-3 text-xs font-black">摆家具（点一下摆进屋）</p>
<div className="mt-1.5 flex flex-wrap gap-1.5">
{HOUSE_FURN_CATALOG.filter((f) => f.inCatalog).map((f) => (
<button key={f.id} type="button" onClick={() => { const n = houseLayout.items.length; setHouseLayout((l) => placeHouseFurniture(l, f.id, (n % 4) * 2 - 3, Math.floor(n / 4) * 2 - 2)); }} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-black">＋ {f.zh}</button>
))}
</div>
{houseLayout.items.map((it) => (
<p key={it.id} className="mt-1.5 text-xs">{HOUSE_FURN_CATALOG.find((f) => f.id === it.furnId)?.zh ?? it.furnId} <button type="button" onClick={() => setHouseLayout((l) => removeHousePiece(l, it.id))} className="ml-1 font-black text-[var(--accent)]">删除</button></p>
))}
{validateHouseLayout(houseLayout).map((p) => <p key={p} className="mt-1 text-xs font-bold text-[var(--accent)]">⚠️ {p}</p>)}
<div className="mt-3 flex gap-2">
<button type="button" onClick={() => { saveHouseLayout(houseLayout); showToast("设计图存好了。"); }} className="flex-1 rounded-full border border-[var(--line)] py-2.5 text-sm font-black">存设计图</button>
<button type="button" onClick={() => { const problems = validateHouseLayout(houseLayout); if (problems.length) { showToast(problems[0] ?? ""); return; } const { placed, dropped } = houseLayoutToPlacedFurn(houseLayout); mutate((x) => { for (const p of placed) if (!x.furniture.includes(p.id)) x.furniture = [...x.furniture, p.id]; }); saveHouseLayout(houseLayout); publishHome(); setBuildOpen(false); setHome3d(true); showToast(dropped.length ? `房子发布了！${placed.length} 件家具摆进了家，${dropped.length} 件今天还发布不了（${dropped[0]?.reason ?? ""}）。` : `房子发布了！${placed.length} 件家具摆进了家，可以走进去看看。`); }} className="flex-1 rounded-full bg-[var(--accent)] py-2.5 text-sm font-black text-white">发布房子</button>
</div>
</div>
</div>
)}
{/* round-2 (f): someone comes to check on you */}
{checkinOpen && phase === "game" && s.life && (
<div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label="有人来敲门">
<div className="rise w-full max-w-md rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
<p className="font-display text-xl font-black">🚪 有人来敲门</p>
<p className="mt-1 text-sm leading-relaxed">失业第 {flatDays(s.life, s.day)} 天了，街坊来看看你。不是来催你的，就是问问你最近怎么样、需不需要搭把手。</p>
<div className="mt-3 flex gap-2">
<button type="button" onClick={() => { applyLife(doCheckin(s.life!, true, s.day)); setCheckinOpen(false); }} className="flex-1 rounded-full bg-[var(--text)] py-2.5 text-sm font-black text-[var(--bg)]">进来坐坐，聊聊</button>
<button type="button" onClick={() => { applyLife(doCheckin(s.life!, false, s.day)); setCheckinOpen(false); }} className="flex-1 rounded-full border border-[var(--line)] py-2.5 text-sm font-black">谢谢，我还行</button>
</div>
</div>
</div>
)}
{gigsOpen && phase === "game" && profile && <GigsModal prime={isPrime()} npcGigs={npcGigsToday(s).map((g) => ({ id: g.id, who: `${g.whoEmoji} ${en ? trText(g.who) : g.who}`, emoji: g.emoji, title: en ? g.en : g.zh, pay: fmt(Math.round(g.pay * (isPrime() ? 1.5 : 1)), s.cityKey), cost: en ? `energy −${g.energy}` : `能量 −${g.energy}`, done: (s.npcGigs ?? []).includes(`${s.day}:${g.id}`) }))} onNpcGig={(id) => { const g = npcGigsToday(s).find((x) => x.id === id); if (!g) return; if (s.energy < g.energy) { showToast(en ? "Too tired for that one." : "太累了，干不动。"); return; } const pay = Math.round(g.pay * (isPrime() ? 1.5 : 1)); mutate((x) => { x.money += pay; x.earned += pay; x.energy -= g.energy; x.mood = clamp(x.mood + 3, 0, 100); x.network += 1; x.npcGigs = [...(x.npcGigs ?? []).filter((k) => k.startsWith(`${x.day}:`)), `${x.day}:${g.id}`]; const m = x.npcMem?.[g.who]; if (m) x.npcMem = { ...x.npcMem, [g.who]: { ...m, rel: (m.rel ?? 0) + 3 } }; }); sfx("coin"); showToast(en ? `Helped ${trText(g.who)}: +${fmt(pay, s.cityKey)}, contacts +1, and they like you more.` : `帮了${g.who}一把：+${fmt(pay, s.cityKey)}，人脉 +1，关系更近了。`); }} en={en} playerId={profile.playerId} city={s.cityKey} money={s.money} st={gigsQuery.data} onClose={() => setGigsOpen(false)} toast={showToast} refresh={() => void gigsQuery.refetch()} onHeld={(n) => mutate((x) => { x.money -= n; })} onDeliver={() => { const g = gsRef.current; if (!g || g.energy < 8) { showToast(en ? "Too tired to deliver — rest first." : "太累了，先休息一下再交付。"); return false; } mutate((x) => { x.energy -= 8; }); return true; }} openAccount={() => { setGigsOpen(false); setAccountOpen(true); }} />}
{scenicMoment && phase === "game" && (() => { const m = scenicMoment.m; const ln = m.lines[Math.min(scenicLine, m.lines.length - 1)]!; return (
<div className="pointer-events-none fixed inset-0 z-[70]" role="dialog" aria-label={en ? m.en : m.zh}>
<div className="absolute inset-x-0 top-0 h-[9vh] bg-black/85" />
<div className="absolute inset-x-0 bottom-0 h-[16vh] bg-black/85" />
<div className="absolute inset-x-0 bottom-[3vh] flex flex-col items-center px-5 text-center text-white">
<p className="text-[11px] font-black tracking-[0.25em] text-white/70">{m.emoji} {en ? m.en : m.zh}{inBest(m, nowMin()) ? (en ? " · perfect time" : " · 最佳时刻") : ""}</p>
<p key={scenicLine} className="rise mt-1.5 max-w-xl font-display text-lg font-black leading-snug sm:text-xl">{en ? ln[1] : ln[0]}</p>
</div>
<button type="button" onClick={finishScenic} className="pointer-events-auto absolute right-3 top-[calc(9vh+10px)] rounded-full bg-black/55 px-3 py-1.5 text-xs font-black text-white">✕ {en ? "End" : "结束"}</button>
</div> ); })()}
{liveOpen && phase === "game" && <LivehouseModal en={en} token={accountToken()} venue={en ? trText(locById(currentLoc).short) : locById(currentLoc).short} soundIsOn={soundIsOn} enableSound={() => { setSoundIsOn(true); setSound(true); }} onClose={() => setLiveOpen(false)} toast={showToast} openAccount={() => { setLiveOpen(false); setAccountOpen(true); }} openStore={() => { setLiveOpen(false); setStoreOpen(true); }} />}
{musicOpen && <><button type="button" aria-label="关闭" onClick={() => setMusicOpen(false)} className="fixed inset-0 z-[58] cursor-default" /><div className="menu-pop fixed bottom-20 right-3 z-[59] max-h-[min(70vh,32rem)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto p-1.5">
<p className="px-2.5 py-1.5 text-[11px] font-black text-[var(--dim)]">🎵 {en ? "Background music" : "背景音乐"}</p>
{MUSIC_PICKS.map((m) => <button key={m.id} type="button" onClick={() => { setMusicPick(m.id); setMusicSel(m.id); if (!soundIsOn) { setSoundIsOn(true); setSound(true); } setMusicOpen(false); showToast(en ? `🎵 Music: ${m.en}` : `🎵 背景音乐：${m.zh}`); }} className={`menu-item ${musicSel === m.id ? "bg-[var(--surface2)]" : ""}`}>{m.emoji} {en ? m.en : m.zh}{musicSel === m.id && <span className="ml-auto">✓</span>}</button>)}
{(() => { const c = nowPlayingCredit(); if (!c) return null; return <p className="px-2.5 py-1 text-[10px] leading-snug text-[var(--dim)]">{en ? "Now playing: " : "正在播放："}{en ? c.en : c.zh}</p>; })()}
<details className="border-t border-[var(--line)] px-2.5 py-1.5">
<summary className="cursor-pointer text-[10px] font-black text-[var(--dim)]">{en ? "Track credits" : "曲目署名"}</summary>
<ul className="mt-1 max-h-36 space-y-1 overflow-y-auto text-[10px] leading-snug text-[var(--dim)]">
{MUSIC_CREDITS.map((c) => { const m = MUSIC_PICKS.find((p) => p.id === c.id); return <li key={c.id}><span className="font-black text-[var(--text)]">{m?.emoji} {en ? m?.en : m?.zh}</span><br />{en ? c.en : c.zh}</li>; })}
{EXTRA_CREDITS.map((c) => <li key={c.id}>{en ? c.en : c.zh}</li>)}
<li>{en ? "Sound effects: Mixkit — free for games, no credit required. Do not redistribute the raw files." : "音效：Mixkit，可免费放进游戏，不必署名。不要把原始文件单独再发出去。"}</li>
</ul>
</details>
<button type="button" onClick={() => { setMusicOpen(false); setLiveOpen(true); }} className="menu-item">🎧 {en ? "Musicians' originals (Livehouse)" : "听音乐人的原创（Livehouse）"}</button>
{/* round-2 (g S9): NPC voice mode + karaoke language */}
<p className="px-2.5 pb-1 pt-2 text-[11px] font-black text-[var(--dim)]">🗣️ {en ? "NPC voices — everyone talks in a different tone" : "NPC 说话声调 · 每个人都不一样"}</p>
{VOICE_MODES.map((v) => <button key={v.id} type="button" onClick={() => { setVoiceMode(v.id); showToast(en ? `Voice: ${v.en}` : `说话声：${v.zh}`); }} className={`menu-item ${voiceMode() === v.id ? "bg-[var(--surface2)]" : ""}`}>{en ? v.en : v.zh}{voiceMode() === v.id && <span className="ml-auto">✓</span>}</button>)}
<p className="px-2.5 pb-1 pt-2 text-[11px] font-black text-[var(--dim)]">🎤 {en ? "Karaoke lyrics" : "K 歌歌词语言"}</p>
<div className="flex gap-1 px-2.5 pb-2">
<button type="button" onClick={() => { setKaraokeLang("cn"); showToast("K 歌歌词：中文"); }} className="flex-1 rounded-full border border-[var(--line)] py-1.5 text-xs font-black">中文歌词</button>
<button type="button" onClick={() => { setKaraokeLang("en"); showToast("Karaoke lyrics: English"); }} className="flex-1 rounded-full border border-[var(--line)] py-1.5 text-xs font-black">English</button>
</div>
</div></>}
{venue3d && phase === "game" && (
<div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-label={venue3d.name}>
<div className="rise max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)]">
<div className="relative h-[52vh] min-h-[300px]">
<LifeStage3D key={`venue-${venue3d.id ?? venue3d.set}-${venueTalk?.id ?? ""}-${s.accessory}`} sign={{ text: venue3d.name, emoji: venue3d.emoji, color: venue3d.color }} seed={[...(venue3d.id ?? venue3d.name)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 100003, 7)} wall={venue3d.color !== undefined ? mixHex(venue3d.color, 0xf6efe2, 0.82) : undefined} setKind={venue3d.set} pose={venueTalk?.pose ?? "idle"} faceId={profile?.playerId ?? `player-${iden.emoji}`} partnerFaceId={regularHere(venue3d.set)?.name ?? venueTalk?.who} talkText={venueTalk ? (en ? venueTalk.sayEn : venueTalk.say) : undefined} talkVoiceId={regularHere(venue3d.set)?.name ?? venueTalk?.who} partner={(() => { const host = regularHere(venue3d.set); const meeting = !!(venueTalk && host && MEET_IDS.has(venueTalk.id)); if (meeting && host) return { shirt: host.shirt, pants: host.pants, accessory: host.accessory }; if (venueTalk?.partner) return { shirt: venueTalk.partner[0], pants: venueTalk.partner[1] }; if (host && !venueTalk) return { shirt: host.shirt, pants: host.pants, accessory: host.accessory }; return undefined; })()} shirt={outfitOf(s.outfit).shirt} pants={outfitOf(s.outfit).pants} accessory={ACCESSORIES[s.accessory ?? 0]?.id} night={nowMin() >= 18 * 60 || nowMin() < 6 * 60} emoji={iden.emoji} en={en} roam={!venueTalk} onSpot={(id) => { const v = (VENUE_TALK[venue3d.set] ?? []).find((t) => t.id === id); if (v) runVenueTalk(v); }} />
<div className="cine-grade" />
{(() => { const host = regularHere(venue3d.set); const meeting = !!(venueTalk && host && MEET_IDS.has(venueTalk.id)); return <>
{!venueTalk && host && <p className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-black text-white">{host.emoji} {en ? `${host.name} is here` : `${host.name}在这儿`}</p>}
{venueTalk && <div key={venueTalk.id} className="rise pointer-events-none absolute inset-x-3 top-3 mr-10 rounded-[14px] bg-white/92 px-3 py-2 text-[13px] font-bold leading-snug text-black shadow-lg"><span className="text-[11px] font-black text-[#b45309]">{meeting && host ? `${host.emoji} ${host.name}` : (en ? venueTalk.whoEn : venueTalk.who)}</span><br />{en ? venueTalk.sayEn : venueTalk.say}<button type="button" onClick={() => setVenueTalk(null)} className="pointer-events-auto mt-1.5 block text-[11px] font-black text-[#b45309]">{en ? "Keep walking →" : "接着逛 →"}</button></div>}
</>; })()}
<button type="button" onClick={() => { setVenue3d(null); setVenueTalk(null); }} className="absolute right-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-black text-white">✕</button>
</div>
<div className="p-4"><p className="font-display text-xl font-black">{venue3d.name}</p><p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{venue3d.line}</p>
<p className="mt-1 text-[11px] font-bold text-[var(--accent)]">{en ? "Left stick to walk — push it all the way to jog. Drag the picture to look around. Walk up to a gold ring, then tap Interact." : "左手摇杆走路，推满会小跑。按住画面拖动转镜头。走近金色光柱，点右边的「互动」。"}</p>
<div className="mt-3 grid gap-1.5">{(VENUE_TALK[venue3d.set] ?? []).map((v) => { const key = `${s.day}:${venue3d.set}:${v.id}`; const done = (s.venueFx ?? []).includes(key); const cost = -(v.money ?? 0); const fx = [cost > 0 ? fmt(-cost, s.cityKey) : "", v.energy ? `${en ? "energy" : "能量"} ${v.energy > 0 ? "+" : ""}${v.energy}` : "", !done && v.mood ? `${en ? "mood" : "心情"} +${v.mood}` : "", !done && v.network ? `${en ? "contacts" : "人脉"} +${v.network}` : "", !done && v.xp ? `${en ? "XP" : "经验"} +${v.xp}` : "", v.id === "toilet" ? (en ? "feel better" : "内急好了") : ""].filter(Boolean).join(" · "); return (
<button key={v.id} type="button" disabled={s.money < cost} onClick={() => runVenueTalk(v)} className={`flex items-center gap-2 rounded-[12px] border px-3 py-2 text-left ${venueTalk?.id === v.id ? "border-[var(--accent)]" : "border-[var(--line)]"} bg-[var(--bg)] disabled:opacity-40`}>
<span className="text-xl">{v.emoji}</span><span className="min-w-0 flex-1"><span className="block text-[13px] font-black">{en ? v.en : v.zh}{(() => { const host = regularHere(venue3d.set); return host && MEET_IDS.has(v.id) ? ` · ${host.name}` : ""; })()}</span><span className="block text-[11px] text-[var(--dim)]">{v.open === "live" ? (en ? "Free · open the Livehouse and listen together" : "免费 · 打开 Livehouse 一起听") : fx || (en ? "done today" : "今天聊过了")}</span></span></button> ); })}</div>
</div>
</div>
</div>
)}
{lifeOpen && phase === "game" && (
<div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={en ? "Living" : "过日子"}>
<div className="rise max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
<p className="flex items-center justify-between"><span className="font-display text-xl font-black">{en ? "A life that pulls you back" : "过日子"}</span><button type="button" onClick={() => setLifeOpen(false)} className="rounded-full border px-3 py-1 text-xs font-black">✕</button></p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{(() => { const rows: [number, string][] = [[s.hunger, en ? "Hungry. Eat, or cook at home." : "饿了。去吃饭，或者回家做饭。"], [s.bladder, en ? "Find a restroom in a mall, a restaurant, or the office." : "内急。商场、饭店、公司里有洗手间，走进去。"], [s.clean, en ? "Go home and wash." : "该洗了。回家洗澡。"], [s.fun, en ? "Go out. A bar, the sea, or the Livehouse." : "闷了。去酒吧、海边，或者 Livehouse。坐着不算。"], [s.social, en ? "Go find someone." : "去找个人说说话。"]]; const worst = rows.reduce((a, b) => (a[0] <= b[0] ? a : b)); return worst[0] < 45 ? worst[1] : (en ? "You're fine. Fun still drops if you stay in." : "都还行。想玩也会自己往下掉，得出门。"); })()}</p>
<div className="mt-3 grid grid-cols-5 gap-1">{([["🍚", en ? "Full" : "饱", s.hunger], ["🚻", en ? "Ok" : "急", s.bladder], ["🚿", en ? "Clean" : "净", s.clean], ["🎧", en ? "Fun" : "玩", s.fun], ["💬", en ? "People" : "人", s.social]] as [string, string, number][]).map(([ic, lb, v]) => <div key={lb} className="rounded-[12px] border border-[var(--line)] p-1.5"><p className="text-[10px] font-black">{ic} {lb}</p><p className={`text-lg font-black ${v < 30 ? "text-[var(--accent)]" : ""}`}>{Math.round(v)}</p></div>)}</div>
<div className="mt-2 grid grid-cols-3 gap-1.5">
<button type="button" onClick={eatBowl} className="rounded-full bg-[var(--text)] py-2 text-[11px] font-black text-[var(--bg)]">{en ? "Noodles ¥25" : "吃碗面 ¥25"}</button>
<button type="button" onClick={washHome} className="rounded-full border border-[var(--line)] py-2 text-[11px] font-black">{en ? "Wash at home" : "回家洗澡"}</button>
<button type="button" onClick={seeSomeone} className="rounded-full border border-[var(--line)] py-2 text-[11px] font-black">{en ? "Talk" : "找人说话"}</button>
</div>
<div className="mt-3 rounded-[12px] border border-[var(--line)] p-3">
<p className="text-xs font-black text-[var(--dim)]">{en ? "Hair — so people can tell you apart" : "发型 · 别人一眼能认出你"}</p>
<div className="mt-2 flex flex-wrap gap-1.5">{HAIRS.map((h, i) => <button key={h.zh} type="button" onClick={() => { mutate((x) => { x.hair = i; }); showToast(en ? h.en : `换成了${h.zh}。`); }} className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${s.hair === i ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--line)]"}`}>{en ? h.en : h.zh}</button>)}</div>
<div className="mt-2 flex flex-wrap gap-1.5">{ACCESSORIES.map((a, i) => <button key={a.id} type="button" onClick={() => { mutate((x) => { x.accessory = i; }); showToast(en ? a.en : `戴上了${a.zh}。`); }} className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${s.accessory === i ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--line)]"}`}>{en ? a.en : a.zh}</button>)}</div>
</div>
<div className="mt-3 rounded-[12px] border border-[var(--line)] p-3">
<p className="text-xs font-black text-[var(--dim)]">{en ? "Family" : "家人"}{s.spouse ? ` · ${s.spouse}` : ""}</p>
{s.kids.length > 0 && <p className="mt-1 text-[11px] text-[var(--dim)]">{s.kids.map((k) => `${k.name} · ${en ? `day ${Math.max(1, s.day - k.day + 1)}` : `第 ${Math.max(1, s.day - k.day + 1)} 天`}`).join("  ")}</p>}
<div className="mt-2 flex flex-wrap gap-1.5">
{npcsForCity(s.cityKey).slice(0, 5).filter((n) => n.name !== s.spouse).map((n) => { const pts = s.romance?.[n.name] ?? 0; const st = ROMANCE_STAGES[romanceStage(pts)]!.name[en ? 1 : 0]; return <button key={n.name} type="button" onClick={() => askOut(n.name)} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-black">{n.emoji} {en ? `Date ${n.name}` : `约${n.name}`} · {st}</button>; })}
{Object.entries(s.romance ?? {}).filter(([, pts]) => romanceStage(pts) >= 2 && !s.spouse).map(([name]) => <button key={`m-${name}`} type="button" onClick={() => { mutate((x) => { x.spouse = name; x.cohabit = true; }); showToast(en ? `You and ${name} are together.` : `你和${name}领了证，一起住。房租按同居算。`); }} className="rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-black text-[var(--bg)]">{en ? `Marry ${name}` : `和${name}领证`}</button>)}
{bonds.filter((b) => b.kind === "partner" && b.status === "active" && b.peerName !== s.spouse).map((b) => <button key={b.peerName} type="button" onClick={() => { mutate((x) => { x.spouse = b.peerName; x.cohabit = true; }); showToast(en ? `You and ${b.peerName} registered.` : `你和${b.peerName}领了证。`); }} className="rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-black text-[var(--bg)]">{en ? `Marry ${b.peerName}` : `和${b.peerName}领证`}</button>)}
{s.spouse && s.kids.length < 3 && <button type="button" onClick={() => { const last = s.kids[s.kids.length - 1]?.day ?? 0; if (s.kids.length > 0 && s.day - last < 3) { showToast(en ? "Give it a few more days." : "再过几天。"); return; } const name = KID_NAMES[s.kids.length] ?? "宝宝"; mutate((x) => { x.kids = [...x.kids, { name, day: x.day }]; x.mood = Math.min(100, x.mood + 12); }); showToast(en ? `${name} is here.` : `${name}出生了。`); }} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-black">{en ? "A child" : "要个孩子"}</button>}
</div>
<p className="mt-2 text-[11px] font-black text-[var(--dim)]">{en ? "Drop in" : "串门"}</p>
<div className="mt-1 flex flex-wrap gap-1.5">
{[...new Set([...(s.spouse ? [s.spouse] : []), ...npcsForCity(s.cityKey).filter((n) => (s.npcMem?.[n.name]?.rel ?? 0) >= 8 || (s.romance?.[n.name] ?? 0) >= 15).map((n) => n.name), ...bonds.filter((b) => b.status === "active").map((b) => b.peerName)])].filter((name) => !s.kids.some((k) => k.name === name)).slice(0, 6).map((name) => <button key={`v-${name}`} type="button" onClick={() => openVisit(name)} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-black">{en ? `${name}'s home` : `去${name}家`}</button>)}
</div>
{!s.spouse && <p className="mt-1 text-[11px] text-[var(--dim)]">{en ? "A date is ¥60. Reach “Partners”, then you can register." : "约会 ¥60。到「恋人」就能领证，再过几天可以要孩子。"}</p>}
</div>
<div className="mt-3 rounded-[12px] border border-[var(--line)] p-3">
<p className="text-xs font-black text-[var(--dim)]">{en ? "Send money to someone online" : "转给在线的人 · 红包 ¥88，对方下次上线到账"}</p>
<div className="mt-2 flex flex-wrap gap-1.5">{onlineHere.filter((pl) => pl.id !== myId).slice(0, 6).map((pl) => <button key={pl.id} type="button" onClick={() => sendGift(pl.id, pl.name, "hongbao")} className="rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-black text-[var(--bg)]">🧧 {pl.name}</button>)}{onlineHere.filter((pl) => pl.id !== myId).length === 0 && <span className="text-[11px] text-[var(--dim)]">{en ? "Nobody else is online in this city right now." : "这座城现在没有别的在线玩家。"}</span>}</div>
</div>
<div className="mt-3 rounded-[12px] border border-[var(--line)] p-3">
<p className="text-xs font-black text-[var(--dim)]">{en ? "Land in this city · about +1.8% a day" : "这块城里的地 · 拿着每天大约涨 1.8%"}</p>
<div className="mt-2 flex flex-col gap-1.5">{s.plots.map((p, i) => { const w = plotWorth(p.paid, p.day, s.day); return <div key={`${p.city}-${i}`} className="flex items-center gap-2 text-[11px] font-black"><span className="flex-1">{CITIES[p.city].name} · {fmt(w, p.city)}</span><button type="button" onClick={() => { const got = Math.round(w * 0.92); mutate((x) => { x.money += got; x.plots = x.plots.filter((_, j) => j !== i); }); showToast(en ? `Sold. You keep ${fmt(got, p.city)} after the fee.` : `卖掉了，扣过手费到手 ${fmt(got, p.city)}。`); }} className="rounded-full border px-2 py-1">{en ? "Sell" : "卖掉"}</button></div>; })}</div>
<button type="button" disabled={s.plots.length >= 3 || s.money < (PLOT_PRICE[s.cityKey] ?? 18000)} onClick={() => { const price = PLOT_PRICE[s.cityKey] ?? 18000; mutate((x) => { x.money -= price; x.plots = [...x.plots, { city: x.cityKey, paid: price, day: x.day }]; }); showToast(en ? `You bought a plot for ${fmt(price, s.cityKey)}.` : `买下一块地，${fmt(price, s.cityKey)}。拿得越久越值钱。`); }} className="mt-2 w-full rounded-full bg-[var(--text)] py-2 text-[11px] font-black text-[var(--bg)] disabled:opacity-40">{en ? `Buy here · ${fmt(PLOT_PRICE[s.cityKey] ?? 18000, s.cityKey)}` : `买在${CITIES[s.cityKey].name} · ${fmt(PLOT_PRICE[s.cityKey] ?? 18000, s.cityKey)}`}</button>
</div>
<div className="mt-3 flex flex-wrap gap-1.5">
<button type="button" disabled={!!s.carOwned || (s.license ?? 0) < 3 || s.money < CAR_PRICE} onClick={() => { mutate((x) => { x.money -= CAR_PRICE; x.carOwned = true; }); showToast(en ? "The car is yours. Choose Drive when you travel." : "车是你的了。出行时选「自驾」。"); }} className="rounded-full border border-[var(--line)] px-3 py-2 text-[11px] font-black disabled:opacity-40">{s.carOwned ? (en ? "You have a car" : "已经有车") : (en ? `Buy a car · ${fmt(CAR_PRICE)}` : `买车 · ${fmt(CAR_PRICE)}`)}</button>
{s.shop && bonds.filter((b) => (b.kind === "sworn" || b.kind === "partner") && b.status === "active").map((b) => <button key={b.peerName} type="button" onClick={() => { mutate((x) => { if (x.shop) x.shop = { ...x.shop, partner: b.peerName }; }); showToast(en ? `${b.peerName} takes 20% when you empty the till.` : `${b.peerName}入伙了。收钱时两成分给对方。`); }} className="rounded-full border border-[var(--line)] px-3 py-2 text-[11px] font-black">{s.shop?.partner === b.peerName ? "✓ " : ""}{en ? `Partner ${b.peerName}` : `和${b.peerName}合伙`}</button>)}
{s.shop && npcsForCity(s.cityKey).filter((n) => (s.npcMem?.[n.name]?.rel ?? 0) >= 12).slice(0, 3).map((n) => <button key={`sp-${n.name}`} type="button" onClick={() => { mutate((x) => { if (x.shop) x.shop = { ...x.shop, partner: n.name }; }); showToast(en ? `${n.name} takes 20% when you empty the till.` : `${n.name}入伙了。收钱时两成分给对方。`); }} className="rounded-full border border-[var(--line)] px-3 py-2 text-[11px] font-black">{s.shop?.partner === n.name ? "✓ " : ""}{en ? `Partner ${n.name}` : `和${n.name}合伙`}</button>)}
{!s.shop && <span className="self-center text-[11px] text-[var(--dim)]">{en ? "Open a shop, then you can take a partner. They take 20% of the till." : "小店开张之后可以请人合伙，收钱时两成给他们。"}</span>}
</div>
<button type="button" className="mt-3 block text-left text-xs font-black" onClick={() => { setLifeOpen(false); setCommitteeOpen(true); }}>🏛️ {committeeQuery.data?.chair ? (en ? `This week's chair: ${committeeQuery.data.chair.emoji} ${committeeQuery.data.chair.name}. The whole city runs on their pledge.` : `本周城主 ${committeeQuery.data.chair.emoji} ${committeeQuery.data.chair.name}。全城这一周按这个人的承诺过。`) : (en ? "No chair yet this week — go vote." : "本周还没选出城主。去投票，选出来全城都看得到。")}</button>
</div>
</div>
)}
{home3d && phase === "game" && (() => { const t = tierAt(s); const T = TIERS[s.cityKey]; const tn = nowMin(); return (
<div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-label={en ? "My home" : "我的家"}>
<div className="rise max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)]">
<div className="relative h-[40vh] min-h-[220px]">
{(() => { const who = homeGuest ?? s.spouse ?? null; const guest = who ? npcsForCity(s.cityKey).find((n) => n.name === who) : undefined; const pf = homeGuest ? (visitHome?.layout ?? []) : placedFurn(s); const tier = homeGuest && visitHome ? visitHome.tier : t; const wall = homeGuest ? (visitHome?.style ? tplByName(visitHome.style)?.wall : undefined) : tplByName(s.homeStyle)?.wall; const kids = homeGuest ? [] : s.kids.map((_, i) => ({ shirt: [0xf9a8d4, 0x93c5fd, 0xfde68a][i] ?? 0xf9a8d4, pants: 0x374151 })); return <LifeStage3D key={`flat-${tier}-${homePose}-${who ?? ""}-${kids.length}-${s.accessory}-${pf.map((x) => x.id + x.slot).join(",")}`} setKind="flat" tier={tier} furn={pf} wall={wall} pose={homePose} roam={homePose === "idle"} en={en} accessory={ACCESSORIES[s.accessory ?? 0]?.id} shirt={outfitOf(s.outfit).shirt} pants={outfitOf(s.outfit).pants} night={tn >= 18 * 60 || tn < 6 * 60} emoji={iden.emoji} onFurn={usePlacedFurn} onSpot={(id) => { if (id === "bed") usePlacedFurn("bed-double"); else if (id === "sit") usePlacedFurn("sofa-fabric"); else if (id === "cook") usePlacedFurn("kitchen-cabinet"); else if (id === "wash") washHome(); }} household={kids} partner={who ? { shirt: guest?.shirt ?? 0x60a5fa, pants: guest?.pants ?? 0x1f2937, accessory: guest?.accessory } : undefined} />; })()}
<div className="cine-grade" />
<button type="button" onClick={() => { setHome3d(false); setHomeGuest(null); setVisitHome(null); setHomePose("idle"); }} className="absolute right-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-black text-white">✕</button>
<p className="pointer-events-none absolute bottom-3 right-3 max-w-[14rem] rounded-full bg-black/55 px-3 py-1 text-[11px] font-black text-white">{en ? "Walk up to a gold ring, then Interact. Tap the furniture too." : "走近金色光柱再互动。点家具也行。"}</p>
{(homeGuest ?? s.spouse) ? <p className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-black text-white">{en ? `${homeGuest ?? s.spouse} is sitting with you${s.kids.length && !homeGuest ? ` · ${s.kids.length} at home` : ""}` : `${homeGuest ?? s.spouse}坐在旁边${s.kids.length && !homeGuest ? ` · 孩子${s.kids.length}个在家` : ""}`}</p> : null}
</div>
<div className="p-4">
<p className="font-display text-xl font-black">{homeGuest ? (en ? `${homeGuest}'s home` : `${homeGuest}的家`) : `${T[t]!.emoji} ${en ? T[t]!.en : T[t]!.zh}`}</p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{homeGuest ? (visitHome ? (en ? "This is their layout. Walk in — they are already sitting." : "这是对方家里的摆法。人已经坐着，你走进去。") : (en ? "They have not published a layout yet. The room is empty." : "对方还没把摆法发出来，屋里是空的。")) : t < 3 ? (en ? `Reach the month's goal to move up to ${T[t + 1]!.en} — your home changes with you.` : `攒够本月目标就能搬进「${T[t + 1]!.zh}」——爬上去，家就跟着变。`) : (en ? "Top of the ladder. Don't slip." : "到顶了，别掉下来。")}</p>
<p className="mt-1 text-[11px] font-bold text-[var(--accent)]">{en ? "Left stick to walk. Push it all the way to jog. Drag the picture to look around." : "左手摇杆走路，推满会小跑。按住画面拖动转镜头。"}</p>
<div className="mt-2 flex flex-wrap gap-1.5"><button type="button" onClick={() => usePlacedFurn("bed-double")} className="rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-black text-[var(--bg)]">{en ? "Lie down" : "躺一会儿"}</button><button type="button" onClick={() => usePlacedFurn("sofa-fabric")} className="rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-black text-[var(--bg)]">{en ? "Sit" : "坐下"}</button><button type="button" onClick={() => usePlacedFurn("kitchen-cabinet")} className="rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-black text-[var(--bg)]">{en ? "Cook" : "做饭"}</button><button type="button" onClick={washHome} className="rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-black text-[var(--bg)]">{en ? "Wash" : "洗澡"}</button>{homePose !== "idle" && <button type="button" onClick={() => setHomePose("idle")} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-black">{en ? "Stand up" : "站起来"}</button>}</div>
<div className="mt-2 flex items-end gap-1" aria-hidden>{T.map((x, i) => <div key={i} className={`flex-1 rounded-t-[6px] py-1 text-center text-[10px] font-black ${i === t ? "bg-[var(--accent)] text-white" : "bg-[var(--surface2)] text-[var(--dim)]"}`} style={{ paddingTop: 4 + i * 7 }}>{x.emoji}</div>)}</div>
{(() => { const pf = placedFurn(s); const owned = s.furniture.flatMap((id) => { const f = furnById(id); return f ? [f] : []; }); const occ = (i: number) => pf.find((x) => x.slot === i)?.id; const put = (id: string, slot: number) => { mutate((x) => { const fp = { ...(x.furnPos ?? {}) }; for (const it of placedFurn(x)) if (fp[it.id] === undefined) fp[it.id] = it.slot; const other = Object.keys(fp).find((k) => k !== id && fp[k] === slot); if (other && slot >= 0) fp[other] = fp[id] ?? -1; fp[id] = slot; x.furnPos = fp; }); publishHome(); sfx("click"); }; if (homeGuest) return null; return (
<div className="mt-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-xs font-black text-[var(--dim)]">🛋️ {en ? "Arrange your furniture" : "摆家具"}{owned.length ? (en ? " · tap a piece, then a spot" : " · 先点家具，再点位置") : ""}</p>
{owned.length === 0 ? <p className="mt-1 text-xs text-[var(--dim)]">{en ? "No furniture yet — buy some in “My home” (ZhuyaHome catalogue), then come back and place it." : "还没有家具。去「我的家」里买（ZhuyaHome 目录），回来就能摆。"}</p> : (<>
<div className="mt-2 flex flex-wrap gap-1.5">{owned.map((f) => { const on = pf.some((x) => x.id === f.id); return <button key={f.id} type="button" onClick={() => setFurnSel(furnSel === f.id ? null : f.id)} className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${furnSel === f.id ? "border-[var(--accent)] bg-[var(--accent)] text-white" : on ? "border-[var(--line)] bg-[var(--surface)]" : "border-dashed border-[var(--line)] text-[var(--dim)]"}`}>{f.emoji} {en ? trText(f.name) : f.name}</button>; })}</div>
{furnSel && <div className="mt-2 grid grid-cols-4 gap-1.5">{FURN_SLOTS.map((sl, i) => { const o = occ(i); const of = o ? furnById(o) : null; return <button key={i} type="button" onClick={() => put(furnSel, i)} className={`rounded-[10px] border px-1.5 py-1.5 text-[10px] font-black ${o === furnSel ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--line)]"}`}>{en ? sl.en : sl.zh}{of && o !== furnSel ? <span className="block font-bold text-[var(--dim)]">{of.emoji}</span> : null}</button>; })}<button type="button" onClick={() => put(furnSel, -1)} className="rounded-[10px] border border-dashed border-[var(--line)] px-1.5 py-1.5 text-[10px] font-black text-[var(--dim)]">{en ? "Put away" : "收起来"}</button></div>}
</>)}
{pf.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{pf.map((it) => { const f = furnById(it.id); const u = furnUse(it.id); return f && u ? <button key={it.id} type="button" onClick={() => usePlacedFurn(it.id)} className="rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-black text-[var(--bg)]">{en ? `Use ${trText(f.name)}` : `用${f.name}`}</button> : null; })}</div>}
<div className="mt-2 flex flex-wrap gap-1.5">{[...(s.spouse ? [s.spouse] : []), ...Object.keys(s.romance ?? {}).filter((n) => (s.romance?.[n] ?? 0) >= 15 && n !== s.spouse)].slice(0, 4).map((n) => <button key={n} type="button" onClick={() => { setHomeGuest(n); setHomePose("idle"); showToast(en ? `${n} is sitting inside. Walk over.` : `${n}已经坐在屋里。你走进去。`); }} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-black">{homeGuest === n ? "✓ " : ""}{en ? `Invite ${n}` : `请${n}来`}</button>)}{homeGuest && <button type="button" onClick={() => { setHomeGuest(null); setHomePose("idle"); }} className="rounded-full border border-dashed px-2.5 py-1 text-[11px] font-black text-[var(--dim)]">{en ? "See them out" : "送客"}</button>}</div>
</div> ); })()}
</div>
</div>
</div> ); })()}
{retrainOpen && phase === "game" && (
<div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={en ? "Retrain" : "转行培训"}>
<div className="rise max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
<p className="flex items-center justify-between"><span className="font-display text-xl font-black">🎓 {en ? "Retrain / get certified" : "转行培训 / 考证"}</span><button type="button" onClick={() => setRetrainOpen(false)} className="rounded-full border px-3 py-1 text-xs font-black">✕</button></p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{en ? `Now: ${idenOf(s).emoji} ${trText(idenOf(s).name)} · skill ${s.skill}. Your money, origin and ladder rung stay; your career level starts over. One switch every three days.` : `现在：${idenOf(s).emoji} ${idenOf(s).name} · 技能 ${s.skill}。存款、出身和阶层梯子都保留，职级从头开始；三天只能转一次。`}</p>
<div className="mt-3 grid gap-2">
{IDENTITIES.filter((i) => i.id !== s.idenId && i.id !== "rich").sort((a, b) => b.pay - a.pay).map((i) => { const block = retrainBlock(i.id, s); const fee = retrainFee(i.id, s); return (
<button key={i.id} type="button" disabled={!!block} onClick={() => switchJob(i.id)} className="flex items-start gap-3 rounded-[14px] border-2 border-[var(--line)] p-2.5 text-left disabled:opacity-50">
<span className="text-2xl">{i.emoji}</span>
<span className="min-w-0 flex-1"><span className="block text-sm font-black">{en ? trText(i.name) : i.name} <span className="text-[var(--accent)]">{en ? `≈ ${fmt(Math.round(i.pay * CITIES[s.cityKey].payMul))}/day` : `日薪约 ${fmt(Math.round(i.pay * CITIES[s.cityKey].payMul))}`}</span></span><span className="block text-xs text-[var(--dim)]">{block ?? (en ? `Course fee ${fmt(fee)}` : `培训费 ${fmt(fee)}`)}</span></span>
</button> ); })}
</div>
</div>
</div>
)}
{storeOpen && phase === "game" && <StoreModal en={en} onClose={() => setStoreOpen(false)} toast={showToast} openAccount={() => setAccountOpen(true)} />}
{accountOpen && phase === "game" && <AccountModal en={en} playerId={profile?.playerId ?? null} saveKey={LS_KEY} onClose={() => setAccountOpen(false)} toast={showToast} onChange={(v) => { setLoggedIn(v); track(v ? "account_login" : "account_logout"); }} />}
{dmOpen && (() => { const th = threads.find((t) => t.peerId === dmPeer); const peerName = th?.peerName ?? (world?.online ?? []).find((x) => x.id === dmPeer)?.name ?? ""; return (
<div className="fixed inset-0 z-[66] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={en ? "Private messages" : "私信"}>
<div className="rise flex h-[80vh] w-full max-w-2xl overflow-hidden rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)]">
<div className={`${dmPeer ? "hidden sm:block" : "block"} w-full overflow-y-auto border-r border-[var(--line)] sm:w-56`}>
<p className="flex items-center justify-between p-3 font-black">💬 {en ? "Messages" : "私信"}<button type="button" onClick={() => { setDmOpen(false); setDmPeer(null); }} className="rounded-full border px-2.5 py-0.5 text-xs">✕</button></p>
{threads.length === 0 && <p className="px-3 text-xs text-[var(--dim)]">{en ? "No messages yet. Tap a player's name on the map to say hi." : "还没有私信。点地图上玩家的名字，打个招呼吧。"}</p>}
{threads.map((t) => (
<button key={t.peerId} type="button" onClick={() => openDm(t.peerId)} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${t.peerId === dmPeer ? "bg-[var(--surface2)]" : ""}`}>
<span className="text-xl">{t.peerEmoji}</span><span className="min-w-0 flex-1"><span className="block truncate font-black">{t.online ? "🟢 " : ""}{t.peerName}</span><span className="block truncate text-[11px] text-[var(--dim)]">{(t.messages[t.messages.length - 1]?.body ?? "").replace(/^\[\[party:\d+\]\]$/, en ? "🎉 Party invite" : "🎉 组局邀请").replace(/^\[\[bond:(\w+)\]\]$/, (_m, k: string) => { const b = BOND_INFO[k as BondKind]; return b ? `${b.emoji} ${en ? b.ask[1] : b.ask[0]}` : ""; })}</span></span>{t.unread > 0 && <span className="rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-black text-white">{t.unread}</span>}
</button>
))}
</div>
{dmPeer && (
<div className="flex min-w-0 flex-1 flex-col">
<p className="flex items-center gap-2 border-b border-[var(--line)] p-3 text-sm font-black"><button type="button" onClick={() => setDmPeer(null)} className="compact-only">←</button><button type="button" onClick={() => setCardOf(dmPeer)} className="min-w-0 flex-1 truncate text-left underline decoration-dotted">{peerName}</button><button type="button" onClick={() => { setDmOpen(false); setDmPeer(null); }} className="rounded-full border px-2.5 py-0.5 text-xs">✕</button></p>
<div className="flex-1 overflow-y-auto p-3">
{(th?.messages ?? []).map((m) => { const inv = /^\[\[party:(\d+)\]\]$/.exec(m.body); const pt = inv ? parties.find((x) => x.id === Number(inv[1])) : undefined; const act = pt ? activityById(pt.activityId) : null; return (
<div key={m.id} className={`mb-1.5 max-w-[85%] rounded-[12px] px-3 py-2 text-[13px] ${m.mine ? "ml-auto bg-[var(--text)] text-[var(--bg)]" : "border border-[var(--line)] bg-[var(--bg)]"}`}>
{/^\[\[bond:(\w+)\]\]$/.test(m.body) ? (() => { const k = /^\[\[bond:(\w+)\]\]$/.exec(m.body)![1] as BondKind; const b = BOND_INFO[k]; return b ? <span>{b.emoji} {m.mine ? (en ? `You sent: ${b.ask[1]}` : `你发出了：${b.ask[0]}`) : (en ? `${b.ask[1]} — ${b.perk[1]}` : `${b.ask[0]}——${b.perk[0]}`)}{!m.mine && <button type="button" onClick={() => { setDmOpen(false); setBondsOpen(true); }} className="ml-2 rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[11px] font-black text-white">{en ? "Reply" : "去回复"}</button>}</span> : null; })() : inv ? (pt && act ? <span>🎉 {en ? `Party invite: ${act.name[1]} at ${trText(pt.locName)}` : `组局邀请：${pt.locName} · ${act.name[0]}`}{!m.mine && pt.status === "open" && !pt.members.some((x) => x.id === myId) && <button type="button" onClick={() => { setDmOpen(false); joinPartyNow(pt); }} className="ml-2 rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[11px] font-black text-white">{en ? "Join" : "加入"}</button>}</span> : <span className="opacity-70">{en ? "🎉 Party invite (this party has ended)" : "🎉 组局邀请（这个局已经结束了）"}</span>) : <span className="whitespace-pre-wrap break-words">{m.body}</span>}
</div> ); })}
</div>
<form className="flex gap-2 border-t border-[var(--line)] p-2" onSubmit={(e) => { e.preventDefault(); sendDmNow(dmPeer, dmInput); }}>
<input value={dmInput} onChange={(e) => setDmInput(e.target.value.slice(0, 300))} placeholder={en ? "Say something…" : "说点什么……"} aria-label={en ? "Message" : "消息"} className="min-w-0 flex-1 rounded-full border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm" />
<button type="submit" disabled={!dmInput.trim()} className="shrink-0 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-black text-white disabled:opacity-40">{en ? "Send" : "发送"}</button>
</form>
</div>
)}
</div>
</div> ); })()}

{/* ===== 小游戏 ===== */}
{play && <MiniGame spec={play.spec} title={`${play.act.emoji} ${L2t(play.act.name)}${play.mate ? (en ? ` with ${trText(play.mate)}` : ` · 和${play.mate}`) : ""}`} en={en} onDone={finishActivity} onQuit={() => setPlay(null)} />}

{/* ===== 约会：选人 ===== */}
{datePick && (
<div className="fixed inset-0 z-[66] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={en ? "Who to ask" : "约谁"}>
<div className="rise max-h-[85vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
<p className="flex items-center justify-between"><span className="font-display text-xl font-black">{datePick.emoji} {en ? `Who will you ask? · ${datePick.name[1]}` : `约谁一起？· ${datePick.name[0]}`}</span><button type="button" onClick={() => setDatePick(null)} className="rounded-full border px-3 py-1 text-xs font-black">✕</button></p>
<p className="mt-1 text-xs text-[var(--dim)]">{en ? "Neighbours you're close to (bond +15). Good dates build romance: Dating → It's complicated → Partners → Living together (rent halved)." : "关系到 +15 的街坊都能约。约会顺利会积累感情：约会对象 → 暧昧 → 恋人 → 同居（房租减半）。"}</p>
<div className="mt-3 grid gap-2">
{datePartners(s).map((n) => { const pts = s.romance?.[n.name] ?? 0; const st = ROMANCE_STAGES[romanceStage(pts)]!; return (
<button key={n.name} type="button" onClick={() => { const a = datePick; setDatePick(null); startActivity(a, { mate: n.name }); }} className="act-btn flex items-center gap-3 text-left">
<span className="text-2xl">{n.emoji}</span>
<span className="min-w-0 flex-1"><span className="block text-sm font-black">{en ? trText(n.name) : n.name} <span className="font-normal text-[var(--dim)]">· {en ? trText(n.job) : n.job}</span></span><span className="block text-[11px] text-[var(--dim)]">{en ? `Bond +${memOf(s.npcMem ?? {}, n.name).rel} · ${st.name[1]} (${pts})` : `关系 +${memOf(s.npcMem ?? {}, n.name).rel} · ${st.name[0]}（${pts}）`}</span></span>
</button> ); })}
</div>
</div>
</div>
)}

{/* ===== 组局广场 ===== */}
{partyOpen && (
<div className="fixed inset-0 z-[66] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={en ? "Parties" : "组局广场"}>
<div className="rise max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
<p className="flex items-center justify-between gap-2"><span className="font-display text-xl font-black">{en ? `🎉 Parties · ${trText(CITIES[s.cityKey].name)}` : `🎉 组局广场 · ${CITIES[s.cityKey].name}`}</span><button type="button" onClick={() => setPartyOpen(false)} className="rounded-full border px-3 py-1 text-xs font-black">✕</button></p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{en ? "Open a party from any place's \"Things to do here\" with 👥. Everyone in the city sees it and can join. Playing together lifts everyone's rewards, adds network, and counts up your \"buddy\" streak with each player. Nobody came? Start anyway — neighbours fill the seats." : "在任意地点的「在这里能玩」点 👥 组局，同城玩家都能看到、加入。一起玩每人奖励都有加成、人脉 +1，还会累计和每个人的「搭子」次数。没人来？照样开始，街坊会来凑数。"}</p>
<div className="mt-3 grid gap-2">
{parties.length === 0 && <p className="rounded-[12px] bg-[var(--surface2)] p-3 text-center text-sm text-[var(--dim)]">{en ? "No parties right now. Be the first to open one!" : "现在还没有局。去开第一个吧！"}</p>}
{parties.map((pt) => { const a = activityById(pt.activityId); const mine = pt.members.some((m) => m.id === myId); const host = pt.hostId === myId; const meM = pt.members.find((m) => m.id === myId); const there = currentLoc === pt.locId; return (
<div key={pt.id} className={`rounded-[14px] border-2 p-3 ${mine ? "border-[var(--accent)]" : "border-[var(--line)]"}`}>
<p className="flex items-center justify-between gap-2 text-sm font-black"><span>{a?.emoji} {a ? L2t(a.name) : pt.activityId} · {en ? trText(pt.locName) : pt.locName}</span><span className="shrink-0 text-[11px] text-[var(--dim)]">{pt.status === "open" ? (en ? "Waiting" : "等人中") : pt.status === "playing" ? (en ? "Playing" : "进行中") : (en ? "Finished" : "已结束")}</span></p>
<div className="mt-1.5 flex flex-wrap gap-1.5">{pt.members.map((m) => <span key={m.id} className="chip">{m.emoji} {m.name}{m.id === myId ? (en ? " (you)" : "（你）") : ""}{m.buddy > 0 ? ` · 🤝×${m.buddy}` : ""}{m.score !== null ? ` · ${Math.round(m.score * 100)}` : ""}</span>)}</div>
<div className="mt-2 flex flex-wrap gap-1.5">
{!mine && pt.status === "open" && <button type="button" onClick={() => joinPartyNow(pt)} className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-black text-white">{en ? "Join" : "加入"}</button>}
{mine && !there && pt.status !== "done" && <button type="button" onClick={() => { setPartyOpen(false); setSelectedLoc(pt.locId); walkTo(pt.locId); }} className="rounded-full bg-[var(--text)] px-4 py-1.5 text-xs font-black text-[var(--bg)]">{en ? "Go there" : "赶过去"}</button>}
{host && pt.status === "open" && <button type="button" disabled={!there} onClick={() => startPartyNow(pt)} className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-black text-white disabled:opacity-40">{pt.members.length > 1 ? (en ? "Start" : "开始") : (en ? "Start (neighbours fill in)" : "开始（街坊凑数）")}</button>}
{mine && pt.status === "playing" && meM?.score === null && a && <button type="button" disabled={!there} onClick={() => { setPartyOpen(false); startActivity(a, { partyId: pt.id, locId: pt.locId }); }} className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-black text-white disabled:opacity-40">{en ? "▶ Play now" : "▶ 开玩"}</button>}
{mine && pt.status === "open" && <button type="button" onClick={() => leavePartyNow(pt)} className="rounded-full border px-4 py-1.5 text-xs font-black">{host ? (en ? "Cancel" : "解散") : (en ? "Leave" : "退出")}</button>}
{mine && pt.status !== "open" && meM?.score !== null && <button type="button" onClick={() => { setPartyOpen(false); setPartyResult(pt.id); }} className="rounded-full border px-4 py-1.5 text-xs font-black">{en ? "Results" : "看结果"}</button>}
</div>
</div> ); })}
</div>
</div>
</div>
)}

{/* 局开始了：提醒还没玩的成员 */}
{!play && (() => { const pt = parties.find((x) => x.status === "playing" && x.members.some((m) => m.id === myId && m.score === null)); const a = pt ? activityById(pt.activityId) : null; if (!pt || !a) return null; const there = currentLoc === pt.locId; return (
<div className="fixed left-1/2 top-3 z-[60] flex w-[92%] max-w-md -translate-x-1/2 items-center gap-2 rounded-[14px] border-2 border-[var(--accent)] bg-[var(--surface)] px-3 py-2 text-sm font-black shadow-lg">
<span className="min-w-0 flex-1">🎉 {en ? `The party started: ${a.name[1]} at ${trText(pt.locName)}` : `局开始了：${pt.locName} · ${a.name[0]}`}</span>
{there ? <button type="button" onClick={() => startActivity(a, { partyId: pt.id, locId: pt.locId })} className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1 text-xs text-white">{en ? "Play" : "开玩"}</button>
: <button type="button" onClick={() => { setSelectedLoc(pt.locId); walkTo(pt.locId); }} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-1 text-xs text-[var(--bg)]">{en ? "Go" : "赶过去"}</button>}
</div> ); })()}

{/* ===== 组局结果 ===== */}
{partyResult !== null && !play && (() => { const pt = parties.find((x) => x.id === partyResult); if (!pt) return null; const a = activityById(pt.activityId); const real = pt.members; const rows = [...real, ...(real.length === 1 ? ghostMates(pt.id) : [])].sort((x, y) => (y.score ?? -1) - (x.score ?? -1)); const waiting = real.some((m) => m.score === null) && pt.status !== "done"; return (
<div className="fixed inset-0 z-[66] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={en ? "Party results" : "组局结果"}>
<div className="rise w-full max-w-md rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
<p className="font-display text-xl font-black">🏆 {a ? L2t(a.name) : ""} · {en ? trText(pt.locName) : pt.locName}</p>
{waiting && <p className="mt-1 text-xs font-bold text-[var(--dim)]">{en ? "Waiting for the others to finish…" : "等其他人玩完……"}</p>}
<div className="mt-3 grid gap-1.5">{rows.map((m, i) => (
<p key={m.id} className={`flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm ${m.id === myId ? "bg-[var(--surface2)] font-black" : ""}`}><span className="w-6 font-black">{m.score === null ? "…" : i + 1}</span><span>{m.emoji}</span><span className="min-w-0 flex-1 truncate">{m.id.startsWith("npc-") ? (en ? `${trText(m.name)} (neighbour)` : `${m.name}（街坊凑数）`) : m.name}{m.id === myId ? (en ? " (you)" : "（你）") : ""}</span>{m.buddy > 0 && <span className="text-[11px] text-[var(--dim)]">🤝×{m.buddy + (pt.status === "done" ? 1 : 0)}</span>}<span className="font-black">{m.score === null ? "—" : Math.round(m.score * 100)}</span></p>
))}</div>
<p className="mt-2 text-[11px] text-[var(--dim)]">{real.length > 1 ? (en ? "Playing with real players gave everyone a reward boost and +1 network. Your buddy count with each of them went up." : "和真人一起玩：每人奖励加成、人脉 +1，和每个人的「搭子」次数 +1。") : (en ? "Nobody else came this time — the neighbours filled in. Open a party earlier next time, or invite friends with your invite link." : "这次没有真人来，街坊来凑了数。下次早点组局，或者用邀请链接拉朋友来。")}</p>
<button type="button" onClick={() => setPartyResult(null)} className="mt-3 w-full rounded-full bg-[var(--text)] py-2.5 text-sm font-black text-[var(--bg)]">{en ? "Done" : "好的"}</button>
</div>
</div> ); })()}

{/* ===== NPC CHAT ===== */}
{npcChat && (() => { const npc = NPCS.find((n) => n.name === npcChat); if (!npc) return null; const mem = memOf(s.npcMem ?? {}, npcChat); const p = personaOf(npc); return (
<div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={`和${npc.name}聊天`}>
<div className="rise flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-xl">
<div className="flex items-start gap-3 p-4 pb-3 text-white" style={{ background: hexCss(npc.color) }}>
<span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/25 text-3xl">{npc.emoji}</span>
<div className="min-w-0 flex-1">
<p className="font-display text-xl font-black">{npc.name} · {npc.job}</p>
<p className="text-xs opacity-90">{npc.outfit}</p>
<div className="mt-1.5 flex flex-wrap gap-1.5">
<span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold">{moodEmoji(mem.mood)} {moodWord(mem.mood)}</span>
<span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold">关系：{relLabel(mem.rel)}（{mem.rel > 0 ? "+" : ""}{mem.rel}）</span>
<span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold">聊过 {mem.talks} 次</span>
{mem.helps > 0 && <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold">你帮过他 {mem.helps} 次</span>}
{mem.slights > 0 && <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold">得罪过 {mem.slights} 次</span>}
</div>
</div>
<button type="button" aria-label="结束聊天" onClick={() => { setNpcChat(null); setStoryOpen(null); }} className="shrink-0 rounded-full bg-black/25 px-3 py-1.5 text-sm font-black">✕</button>
</div>
<div className="px-4 pt-2.5">
<p className="text-[11px] leading-relaxed text-[var(--dim)]">🕐 作息：{scheduleOf(npc)} · 性格：{p.warmth >= 0.65 ? "热心肠" : p.warmth <= 0.35 ? "慢热" : "随和"}、{p.humor >= 0.55 ? "开得起玩笑" : p.pride >= 0.6 ? "要面子" : "不爱开玩笑"}、{p.chattiness >= 0.6 ? "话多" : p.chattiness <= 0.35 ? "话少" : "话量适中"}</p>
{mem.note ? <p className="mt-1 rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-xs font-bold">🧠 他记得：{mem.note}</p> : <p className="mt-1 rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-xs text-[var(--dim)]">你们还没发生过什么特别的事——帮个忙、送个小礼物，他都会记着。</p>}
</div>
<div className="mt-2 grid min-h-[120px] flex-1 gap-1.5 overflow-y-auto px-4 py-1">
{npcLog.map((m, i) => (
<div key={i} className={`max-w-[88%] rounded-[12px] px-3 py-2 text-[13px] leading-relaxed ${m.from === "me" ? "justify-self-end bg-[var(--text)] text-[var(--bg)]" : "justify-self-start border border-[var(--line)] bg-[var(--bg)]"}`}>
{m.from === "npc" && <p className="text-[11px] font-black text-[var(--dim)]">{npc.name}</p>}
<p className="whitespace-pre-line">{m.text}</p>
</div>
))}
</div>
{(() => { const story = storyOf(npc.name); if (!story) return null; const st = storyStatus(story, s.story?.[npc.name], mem.rel, s.day); const ch = storyOpen === npc.name ? story.chapters[s.story?.[npc.name]?.ch ?? 0] : null; return (
<div className="mx-3 mt-2 rounded-[12px] border-2 border-[var(--gold)] bg-[var(--surface2)] p-2.5">
<p className="flex items-center justify-between gap-2 text-xs font-black"><span>{en ? `📖 ${trText(npc.name)}'s story · "${L(story.title)}"` : `📖 ${npc.name}的故事 ·「${story.title}」`}</span><span className="text-[var(--dim)]">{st.kind === "done" ? (en ? "Finished" : "已完结") : `${Math.min(st.kind === "ending" ? st.total : st.idx + 1, st.total)}/${st.total}`}</span></p>
{ch ? (
<div className="mt-2 grid gap-1.5">{ch.choices.map((c, i) => (
<button key={i} type="button" onClick={() => chooseStory(i)} className="act-btn text-left"><span className="text-[13px] font-black">{L(c.label)}</span>{fxText(c.fx) && <span className="block text-[11px] text-[var(--dim)]">{fxText(c.fx)}</span>}</button>
))}</div>
) : st.kind === "ready" ? <button type="button" onClick={openStory} className="mt-2 w-full rounded-full bg-[var(--text)] py-2 text-xs font-black text-[var(--bg)]">{en ? `▶ Read chapter ${st.idx + 1}: "${L(st.chapter.title)}" · ⏱ 30 min` : `▶ 看第 ${st.idx + 1} 章「${st.chapter.title}」 · ⏱ 30 分钟`}</button>
: st.kind === "ending" ? <button type="button" onClick={openStory} className="mt-2 w-full rounded-full bg-[var(--accent)] py-2 text-xs font-black text-white">🏁 看结局 · ⏱ 30 分钟</button>
: st.kind === "locked" ? <p className="mt-1 text-[11px] text-[var(--dim)]">{en ? `🔒 Bond +${st.need} unlocks the next chapter (now ${mem.rel > 0 ? "+" : ""}${mem.rel}) — helping out, small gifts and daily hellos all bring you closer.` : `🔒 关系到 +${st.need} 解锁下一章（现在 ${mem.rel > 0 ? "+" : ""}${mem.rel}）——帮个忙、送小礼物、天天打招呼都能拉近关系。`}</p>
: st.kind === "tomorrow" ? <p className="mt-1 text-[11px] text-[var(--dim)]">{en ? `🌙 That's today's chapter. Come back to ${trText(npc.name)} tomorrow for more.` : `🌙 今天的故事看完了，明天再来找${npc.name}看后续。`}</p>
: <p className="mt-1 text-[11px] font-bold">{en ? `🏁 Ending: ${L(st.title)}` : `🏁 结局：${st.title}`}</p>}
</div> ); })()}
<div className="grid grid-cols-2 gap-1.5 p-3 pt-2 sm:grid-cols-3">
{([
["greet", "👋 打招呼", "聊聊近况"],
["weather", "🌦️ 聊天气", "今天的天儿"],
["work", "💼 聊工作", "他这行的事"],
...(s.cityKey === "sz" || npc.name === "Lisa" ? [["apec", "🌐 聊峰会", "大会那些事"] as const] : []),
["joke", "😂 开个玩笑", p.pride >= 0.6 && p.humor < 0.45 ? "⚠️ 他要面子，可能翻脸" : "逗他一乐"],
["help", "🤝 帮个忙", "能量 -6 · 人情 +12"],
["gift", "🎁 送小礼物", `${Y}25 · 关系 +8`],
] as [ChatAction, string, string][]).map(([act, label, sub]) => (
<button key={act} type="button" aria-label={`和${npc.name}${label}`} disabled={(act === "help" && s.energy < 6) || (act === "gift" && s.money < 25)} onClick={() => doNpcChat(act)} className="act-btn disabled:opacity-40">
<span className="text-[13px] font-black">{label}</span>
<span className="block text-[11px] text-[var(--dim)]">{sub}</span>
</button>
))}
</div>
<p className="px-4 pb-3 text-center text-[11px] text-[var(--dim)]">他说的每句话都按他的性格和对你的记忆来——帮过他、得罪过他，下次打招呼都不一样。</p>
</div>
</div> ); })()}

{/* toast */}
{toast && <div className="rise fixed bottom-6 left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 rounded-[14px] border-2 border-[var(--border)] bg-[var(--text)] px-4 py-3 text-center text-sm font-bold text-[var(--bg)] shadow-lg">{toast}</div>}

{/* 升职特效 */}
{levelFx && (
<div key={levelFx.nonce} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] grid place-items-center">
<div className="level-fx text-center">
<p className="text-6xl">🎉</p>
<p className="font-display mt-2 text-4xl font-black text-[var(--text)]" style={{ textShadow: "0 2px 0 var(--gold), 0 6px 24px rgba(0,0,0,.25)" }}>升职啦！</p>
<p className="mt-1 text-lg font-black text-[var(--accent)]">「{levelFx.name}」</p>
<p className="mt-1 text-sm font-bold text-[var(--dim)]">街坊弹幕正在为你刷屏…</p>
</div>
</div>
)}

{/* 每日任务弹窗：签到 + 今日任务，每天进游戏 / 睡醒弹一次 */}
{dailyOpen && (() => {
const signed = (s.signDay ?? 0) === s.day;
const base = s.dayBase?.day === s.day ? s.dayBase : { day: s.day, work: s.workCount, meal: s.mealCount, scenic: (s.visitedScenic ?? []).length };
const missions: { id: string; icon: string; name: string; reward: number; done: boolean; hint: string }[] = [
{ id: "work", icon: "💼", name: "上班打卡一次", reward: 20, done: s.workCount > base.work, hint: employerHere(s) ? `去${employerHere(s)!.short}点「上班」` : "去公司点「上班」" },
{ id: "meal", icon: "🍜", name: "好好吃一顿饭", reward: 15, done: s.mealCount > base.meal, hint: "夜市 / 饭店 / 自己做饭都算" },
{ id: "scenic", icon: "📸", name: "风景打卡一处", reward: 25, done: (s.visitedScenic ?? []).length > base.scenic, hint: "去任意景区点「拍照打卡」" },
{ id: "chat", icon: "💬", name: "和一位街坊聊聊", reward: 15, done: (s.greeted ?? []).length > 0, hint: "在手机「街坊社交」里找人聊天" },
];
const apecTask = s.cityKey === "sz" ? apecTaskOfDay(s.day) : null;
const apecDone = apecTask ? (s.apecTasks ?? []).includes(apecTask.id) : false;
return (
<div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/55 p-3 sm:items-center" role="dialog" aria-label="每日任务">
<div className="rise max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-xl">
<div className="flex items-start justify-between bg-[var(--text)] p-4 text-[var(--bg)]">
<div>
<p className="text-xs font-black opacity-80">📋 每日任务 · 第 {Math.min(s.day, seasonLen)} 天 · {weekday(s.day)}</p>
<p className="font-display mt-0.5 text-2xl font-black">{city.name}的一天，从签到开始</p>
<p className="mt-0.5 text-xs opacity-85">{nowWeatherText} · {phaseApec.label}</p>
</div>
<button type="button" aria-label="关闭每日任务" onClick={() => setDailyOpen(false)} className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-black">✕</button>
</div>
<div className="p-4">
{(() => { const today = dateKey(); const r = streakReward(meta.streak.count); const got = meta.streak.claimed === today; return (
<div className="mb-2 rounded-[14px] border-2 border-[var(--border)] bg-[var(--surface2)] p-3">
<p className="text-sm font-black">🔥 连续上线第 {meta.streak.count} 天 <span className="text-xs font-bold text-[var(--dim)]">（真实日历，断一天从 1 重来，第 7 天起奖励最高）</span></p>
<div className="mt-1.5 flex gap-1">{[1, 2, 3, 4, 5, 6, 7].map((d) => <span key={d} className={`grid h-7 flex-1 place-items-center rounded-[8px] text-[10px] font-black ${d <= Math.min(7, meta.streak.count) ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--dim)]"}`}>{d === 7 ? "🎁" : `D${d}`}</span>)}</div>
<button type="button" disabled={got} onClick={() => { const prof = profileRef.current; if (!prof) return; void api.claimReward({ playerId: prof.playerId, kind: "streak", device: deviceId() || undefined }).then((sr) => { updMeta((m) => { m.streak.claimed = today; }); if (!sr.ok) { showToast(sr.error ?? "领取失败"); return; } mutate((x) => { x.money += sr.money; x.energy += sr.energy; }); updMeta((m) => { m.streak.count = Math.max(m.streak.count, sr.n); m.streak.best = Math.max(m.streak.best, sr.n); }); floatReward(`+${fmt(sr.money)} 连登`, "gold"); }).catch(() => showToast("网络不太好，稍后再试。")); }} className="mt-2 w-full rounded-full bg-[var(--accent)] py-2 text-xs font-black text-white disabled:opacity-40">{got ? "✅ 今天的连续上线奖励已领" : `领取连续上线奖励 · ${fmt(r.money)}${r.energy ? ` + 能量 ${r.energy}` : ""}`}</button>
<p className="mt-2 text-xs font-bold">{todayEvent.emoji} 今日城市事件「{todayEvent.name}」：<span className="font-normal">{todayEvent.desc}</span></p>
</div>
); })()}
<button type="button" disabled={signed} aria-label={signed ? "今日已签到" : "每日签到领奖励"} onClick={() => { const prof = profileRef.current; if (!prof) return; void api.claimReward({ playerId: prof.playerId, kind: "signin", device: deviceId() || undefined }).then((r) => { if (!r.ok) { if (r.error === "今天已经领过了") mutate((x) => { x.signDay = s.day; }); showToast(r.error ?? "签到失败"); return; } mutate((x) => { x.signDay = s.day; x.money += r.money; x.energy += r.energy; }); floatReward(`+${fmt(r.money)} 签到`, "gold"); floatReward(`能量 +${r.energy}`, "green"); burstDanmaku(["🧧 今天的签到红包到账啦", "陈伯：早啊，又是新的一天", "小美：签到打卡，元气满满 ☀️"]); showToast(`签到成功：+${fmt(r.money)}，能量 +${r.energy}。今天的任务在下面，顺手就做了。`); }).catch(() => showToast("网络不太好，签到没成功，稍后再试。")); }} className="w-full rounded-[14px] bg-[var(--accent)] py-3.5 text-sm font-black text-white disabled:bg-[var(--surface2)] disabled:text-[var(--dim)]">
{signed ? "✅ 今日已签到（明天再来）" : `🧧 每日签到 · 领 ${fmt(30)} + 能量 10`}
</button>
<p className="mt-4 text-xs font-black tracking-wide text-[var(--dim)]">今日任务 · 完成点领取，奖励立刻飘字到账</p>
<div className="mt-2 grid gap-2">
{missions.map((m) => {
const claimed = (s.dayClaim ?? []).includes(`${s.day}:${m.id}`);
return (
<div key={m.id} className="flex items-center gap-2.5 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5">
<span className="text-xl">{m.icon}</span>
<span className="min-w-0 flex-1"><span className="block text-sm font-black">{m.name}</span><span className="block text-[11px] text-[var(--dim)]">{claimed ? "奖励已领" : m.done ? "已完成，去领奖" : m.hint}</span></span>
{claimed ? <span className="chip">✅ 已领</span> : m.done ? (
<button type="button" aria-label={`领取任务奖励：${m.name}`} onClick={() => { mutate((x) => { x.money += m.reward; x.dayClaim = [...(x.dayClaim ?? []), `${s.day}:${m.id}`]; }); floatReward(`+${fmt(m.reward)} 每日任务`, "gold"); pushDanmakuRef.current(`📋 每日任务完成：${m.name} +${fmt(m.reward)}`); }} className="shrink-0 rounded-full bg-[var(--gold)] px-3 py-1.5 text-[11px] font-black text-[#4a3500]">领 {fmt(m.reward)}</button>
) : <span className="chip">+{fmt(m.reward)}</span>}
</div>
);
})}
</div>
{apecTask && (
<div className="mt-3 rounded-[12px] border-2 border-[var(--gold)] bg-[#fdf6da] px-3 py-2.5 text-[#5c4a00]">
<p className="text-sm font-black">🌐 今日 峰会任务 · {apecTask.dateLabel} {apecTask.event}</p>
<p className="mt-0.5 text-xs leading-relaxed">{apecTask.roleEmoji} 你当{apecTask.role}：{apecTask.title} —— 去{locById(apecTask.venueLocId).name}打卡上岗。{apecDone ? "✅ 今天已完成" : ""}</p>
{!apecDone && <button type="button" aria-label="坐地铁去做今日峰会任务" onClick={() => { setDailyOpen(false); walkTo(apecTask.venueLocId, "metro"); }} className="mt-2 rounded-full bg-[#5c4a00] px-3.5 py-1.5 text-[11px] font-black text-white">🚇 坐地铁去会场</button>}
</div>
)}
<button type="button" onClick={() => setDailyOpen(false)} className="mt-4 w-full rounded-full bg-[var(--text)] py-3 text-sm font-black text-[var(--bg)]">开始今天的生活 →</button>
</div>
</div>
</div>
);
})()}

{/* event modal */}
{arcCard && phase === "game" && (() => { const arc = arcById(arcCard.id); if (!arc) return null; const prog = s.arcs?.[arc.id] ?? { st: 0, day: 0, flags: [] }; const ending = prog.st >= arc.stages.length; const stg = ending ? null : arc.stages[prog.st]!(prog.flags); const end = ending ? arc.ending(prog.flags) : null; const close = () => setArcCard(null); return (
<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-[2px] p-3 sm:items-center" role="dialog" aria-label={en ? arc.en : arc.zh}>
<div className="rise w-full max-w-md rounded-[20px] border-2 border-[var(--border)] bg-[var(--surface)] p-5">
<span className="inline-block rounded-full bg-[var(--accent)] px-2.5 py-1 text-xs font-black text-white">{arc.emoji} {en ? `Life story · ${arc.en}` : `人生连续剧 · ${arc.zh}`} · {ending && !arcCard.reply ? (en ? "Ending" : "结局") : (() => { const n = arcCard.reply ? prog.st : prog.st + 1; return en ? `Part ${n}/${arc.stages.length}` : `第 ${n}/${arc.stages.length} 幕`; })()}</span>
{arcCard.reply ? (<>
<p className="mt-3 text-sm leading-relaxed">{arcCard.reply}</p>
<button type="button" onClick={close} className="mt-4 w-full rounded-full bg-[var(--text)] py-2.5 text-sm font-black text-[var(--bg)]">{prog.done ? (en ? "Close" : "好") : (en ? "To be continued tomorrow…" : "明天接着演……")}</button>
</>) : ending && end ? (<>
<h3 className="font-display mt-3 text-2xl font-black leading-snug">{en ? end.en : end.zh}</h3>
<p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">{en ? end.textEn : end.textZh}</p>
<p className="mt-2 text-xs font-black text-[var(--accent)]">{arcFxText(end.fx, en, s.cityKey)}</p>
<button type="button" onClick={() => { mutate((x) => { applyArcFx(x, end.fx); x.arcs = { ...(x.arcs ?? {}), [arc.id]: { ...prog, done: end.zh, day: x.day } }; }); addLog(`🎬 人生连续剧「${arc.zh}」结局：${end.zh}。`); sfx("cheer"); close(); }} className="mt-4 w-full rounded-full bg-[var(--accent)] py-2.5 text-sm font-black text-white">{en ? "The end" : "剧终"}</button>
</>) : stg && (<>
<h3 className="font-display mt-3 text-2xl font-black leading-snug">{en ? stg.en : stg.zh}</h3>
<p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">{en ? stg.textEn : stg.textZh}</p>
{stg.choices.map((c, i) => { const short = (c.fx.money ?? 0) < 0 && s.money < -(c.fx.money ?? 0); return (
<button key={i} type="button" disabled={short} onClick={() => { mutate((x) => { applyArcFx(x, c.fx); x.arcs = { ...(x.arcs ?? {}), [arc.id]: { st: prog.st + 1, day: x.day, flags: c.flag ? [...prog.flags, c.flag] : prog.flags } }; }); sfx("click"); setArcCard({ id: arc.id, reply: (en ? c.replyEn : c.replyZh) + (arcFxText(c.fx, en, s.cityKey) ? `（${arcFxText(c.fx, en, s.cityKey)}）` : "") }); }} className="act-btn mt-2.5 disabled:opacity-40">
<span className="text-sm font-black">{en ? c.en : c.zh}</span>{arcFxText(c.fx, en, s.cityKey) && <span className="block text-xs text-[var(--dim)]">{arcFxText(c.fx, en, s.cityKey)}{short ? (en ? " · not enough money" : " · 钱不够") : ""}</span>}
</button> ); })}
</>)}
</div>
</div> ); })()}
{activeEvent && (
<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-[2px] p-3 sm:items-center" role="dialog" aria-label={locText(activeEvent.title)}>
<div className="rise w-full max-w-md rounded-[20px] border-2 border-[var(--border)] bg-[var(--surface)] p-5">
<span className="inline-block rounded-full bg-[var(--gold)] px-2.5 py-1 text-xs font-black text-[#3d2f00]">{locText(activeEvent.tag)}</span>
<h3 className="font-display mt-3 text-2xl font-black leading-snug">{locText(activeEvent.title)}</h3>
<p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">{locText(activeEvent.desc)}</p>
{activeEvent.choices.map((c, i) => (
<button key={c.t} type="button" onClick={() => chooseEventChoice(i)} className="act-btn mt-2.5">
<span className="text-sm font-black">{locText(c.t)}</span>
<span className="block text-xs text-[var(--dim)]">{locText(c.s)}</span>
</button>
))}
</div>
</div>
)}

{/* phone modal */}
{phoneOpen && (
<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center" role="dialog" aria-label="手机">
<div ref={phoneSheetRef} className={`rise w-full max-w-md overflow-y-auto rounded-[24px] border-2 border-[var(--border)] bg-[var(--surface)] p-5 ${phoneFull ? "max-h-[96vh] h-[96vh] max-w-2xl" : "max-h-[86vh]"}`}>
<div className="flex items-center gap-2">
{phoneApp && <button type="button" aria-label="返回手机桌面" onClick={() => setPhoneApp(null)} className="rounded-full bg-[var(--surface2)] px-3 py-1.5 text-sm font-black">←</button>}
<h3 className="font-display text-xl font-black">{phoneApp ? (phoneApp === "metro" && s.cityKey === "hz" ? "城轨通" : phoneApp === "metro" && s.cityKey === "hk" ? "港铁通" : PHONE_APPS.find((a) => a.id === phoneApp)?.n ?? "手机") : "📱 我的手机"}</h3>
<button type="button" aria-label={phoneFull ? "退出全屏" : "手机全屏"} title={phoneFull ? "退出全屏" : "手机全屏"} onClick={() => { void togglePhoneFullscreen(phoneSheetRef.current).then((full) => setPhoneFull(full)); }} className="ml-auto rounded-full bg-[var(--surface2)] px-3 py-1.5 text-sm font-black">⛶</button>
<button type="button" aria-label="关闭手机" onClick={() => setPhoneOpen(false)} className="rounded-full bg-[var(--surface2)] px-3 py-1.5 text-sm font-black">✕</button>
</div>
<div className="mt-4">
{!phoneApp ? (
<div className="grid grid-cols-4 gap-3">
{PHONE_APPS.map((a) => (
<button key={a.id} type="button" aria-label={`打开${a.id === "metro" && s.cityKey === "hz" ? "城轨通" : a.id === "metro" && s.cityKey === "hk" ? "港铁通" : a.n}`} onClick={() => setPhoneApp(a.id)} className="grid place-items-center gap-1 rounded-[14px] bg-[var(--surface2)] px-1 py-3">
<span className="text-2xl">{a.id === "metro" && s.cityKey === "hz" ? "🚆" : a.e}</span>
<span className="text-[11px] font-bold">{a.id === "metro" && s.cityKey === "hz" ? "城轨通" : a.id === "metro" && s.cityKey === "hk" ? "港铁通" : a.n}</span>
</button>
))}
</div>
) : renderPhoneApp(s, phoneApp)}
</div>
</div>
</div>
)}
</div>
);
}
