// pets.ts — 宠物系统 (round-2, area c)
//
// 设计来源: Comnyang 的桌面宠物猫 ($7k+ / 100 天) 的教训 —— 宠物是情感依恋
// 和留存, 不是装饰. 所以这只宠物会跟人、会想人、会在家门口等你, 而不是一个
// 摆在角落的模型.
//
// 范围 (本文件只做数据 + 逻辑, 不做 3D):
//   - 领养 / 购买 / 收养流浪动物 (收养入口见 community.ts 的流浪动物系统)
//   - 给宠物起名、喂食、玩耍、抚摸、训练; 心情 / 饥饿 / 亲密度 / 精力 / 清洁度
//   - 宠物跟随玩家走地图; 玩家在家时宠物坐在家里 (配合 publishHome/getHome)
//   - 每天回家时的迎接事件 (小互动, 涨亲密度)
//   - 本地持久化 + 服务器同步形状 (服务器端点见 ROUND2-LOG-c.md, area S 实现)
//
// 集成点 (App.tsx / MapView.tsx 由集成 agent 接线, 片段见本文件底部注释):
//   - App.tsx: 领养入口 (收容所 / 宠物店 / 流浪动物), 宠物面板, 每日结算 tick
//   - MapView.tsx: 宠物跟随渲染 + 在家坐姿渲染 (3D 模型钩子见 PET_MODEL_HOOK)

export type CityKey = "sz" | "hz" | "hk";

export type PetKind = "cat" | "dog";
export type PetSource = "shelter" | "stray" | "shop" | "gift";

/** 0–100 的数值, 统一夹取. */
export type Stat100 = number;

export interface PetStats {
  /** 心情: 玩耍 / 抚摸 / 喂食涨, 饥饿或长期不理会跌. */
  mood: Stat100;
  /** 饱腹: 100 = 刚吃饱, 每天掉; 低于 25 会饿, 心情和亲密度跟着掉. */
  hunger: Stat100;
  /** 亲密度: 每天互动慢慢涨, 决定称呼 / 迎接 / 跟随距离; 长期冷落会掉. */
  affection: Stat100;
  /** 精力: 玩耍消耗, 睡觉 / 休息恢复; 精力低时拒绝玩耍. */
  energy: Stat100;
  /** 清洁度: 慢慢变脏, 洗澡 / 美容恢复 (和现有的宠物美容师职业呼应). */
  cleanliness: Stat100;
}

export interface PetTrick {
  id: string;
  /** 显示名, 如 "握手" / "坐下" / "装死". */
  name: string;
  learnedDay: number;
}

export interface Pet {
  id: string;
  kind: PetKind;
  /** 品种/花色描述, 如 "橘猫" / "柴犬" / "田园猫", 玩家也可自由填. */
  breed: string;
  name: string;
  /** 3D 模型配色 (十六进制, 如 0xe8a34c), 供 MapView 的模型钩子使用. */
  color: number;
  source: PetSource;
  /** 领养时的游戏天数 (gameDay). */
  adoptedDay: number;
  /** 领养地点 locId (如 "shelter" / 流浪动物出现的地点). */
  adoptedAt: string;
  stats: PetStats;
  tricks: PetTrick[];
  /** 玩家给宠物的性格标签, 自由文本, 开放式 (如 "胆小" / "话痨" / "吃货"). */
  personality: string;
  /** 今天已经互动过几次 (喂食/玩耍/抚摸各计), 每天重置, 防刷亲密度. */
  interactionsToday: number;
  /** 上一次结算的游戏天数, 用于跨天衰减. */
  lastTickDay: number;
  /** 玩家今天是否已经收到过回家迎接 (每天一次). */
  greetedToday: boolean;
}

export interface PetsState {
  /** 一名玩家最多养 MAX_PETS 只; 空数组 = 还没养宠物. */
  pets: Pet[];
  /** 当前跟随玩家的那只 (null = 都在家 / 都没跟出来). */
  activePetId: string | null;
}

export const MAX_PETS = 3;
export const MAX_INTERACTIONS_PER_DAY = 6;
export const PET_STORAGE_KEY = "shenhui.pets.v1";

/** 3D 形象规格 (round-3, MapView.tsx 的 makePetGroup 与本表共用同一份:
    猫狗靠耳朵 / 尾巴 / 体型区分 —— 猫尖耳 + 上翘细尾 + 小一圈,
    狗垂耳 + 平伸粗尾 + 吻部 + 大一圈; 颜色用每只宠物自己的 pet.color). */
export const PET_MODEL: Record<PetKind, { height: number; ear: "pointed" | "floppy"; tail: "up-curved" | "level"; emoji: string }> = {
  cat: { height: 0.55, ear: "pointed", tail: "up-curved", emoji: "🐱" },
  dog: { height: 0.7, ear: "floppy", tail: "level", emoji: "🐶" },
};

/** 领养/购买费用 (¥). 流浪收养免费, 收容所象征性收费, 宠物店最贵. */
export const PET_COSTS: Record<PetSource, { min: number; max: number }> = {
  stray: { min: 0, max: 0 },
  shelter: { min: 50, max: 200 },
  shop: { min: 800, max: 5000 },
  gift: { min: 0, max: 0 },
};

/** 每日自然衰减 (游戏天). */
export const DAILY_DECAY = {
  hunger: 35,
  mood: 6,
  energy: -20, // 负数 = 每天恢复 20 (睡觉)
  cleanliness: 12,
  affectionNeglect: 3, // 一整天零互动时亲密度掉多少
} as const;

/** 每次互动的效果. */
export const INTERACTION_EFFECTS = {
  feed: { hunger: +45, mood: +6, affection: +2, cost: 12 },
  play: { mood: +12, affection: +4, energy: -18, hunger: -8 },
  pet: { mood: +8, affection: +3 },
  wash: { cleanliness: +60, mood: -4, affection: +1, cost: 30 },
  train: { affection: +3, energy: -12, mood: +2 },
} as const;

export const clamp100 = (n: number): Stat100 => Math.max(0, Math.min(100, Math.round(n)));

const uid = (): string =>
  `pet_${Date.now().toString(36)}_${Math.floor(Math.random() * 0xffff).toString(16)}`;

export const emptyPetsState = (): PetsState => ({ pets: [], activePetId: null });

/** 亲密度档位: 决定迎接文案、跟随距离和称呼. */
export type BondLevel = "stranger" | "friendly" | "close" | "family";
export const bondLevel = (affection: number): BondLevel =>
  affection >= 80 ? "family" : affection >= 55 ? "close" : affection >= 25 ? "friendly" : "stranger";

export const BOND_LABEL: Record<BondLevel, string> = {
  stranger: "还不太熟",
  friendly: "好朋友",
  close: "亲密无间",
  family: "家人一样",
};

/** 宠物状态一句话 (面板用). */
export function petStatusLine(pet: Pet): string {
  const s = pet.stats;
  if (s.hunger < 25) return `${pet.name}饿得直叫, 快喂点吃的吧.`;
  if (s.energy < 20) return `${pet.name}困得直打哈欠, 让它歇会儿.`;
  if (s.cleanliness < 25) return `${pet.name}身上有点脏了, 该洗个澡了.`;
  if (s.mood < 30) return `${pet.name}闷闷不乐, 陪它玩一会儿吧.`;
  if (s.affection >= 80) return `${pet.name}黏着你, 眼睛亮亮的.`;
  return `${pet.name}今天过得不错.`;
}

// ---------------------------------------------------------------------------
// 领养 / 送别
// ---------------------------------------------------------------------------

export interface AdoptInput {
  kind: PetKind;
  breed: string;
  name: string;
  color: number;
  source: PetSource;
  adoptedAt: string;
  gameDay: number;
  personality?: string;
  /** 流浪收养时传 community.ts 的流浪动物 id, 用于服务器端标记已收养. */
  strayId?: string;
}

export type AdoptResult =
  | { ok: true; pet: Pet; cost: number }
  | { ok: false; error: string };

export function adoptPet(state: PetsState, input: AdoptInput): AdoptResult {
  if (state.pets.length >= MAX_PETS) return { ok: false, error: `最多只能养 ${MAX_PETS} 只宠物` };
  const name = input.name.trim().slice(0, 12);
  if (!name) return { ok: false, error: "先给它起个名字吧" };
  if (state.pets.some((p) => p.name === name)) return { ok: false, error: "已经有只宠物叫这个名字了" };
  const cost = input.source === "shop"
    ? PET_COSTS.shop.min + Math.floor(Math.random() * (PET_COSTS.shop.max - PET_COSTS.shop.min))
    : input.source === "shelter"
      ? PET_COSTS.shelter.min + Math.floor(Math.random() * (PET_COSTS.shelter.max - PET_COSTS.shelter.min))
      : 0;
  const pet: Pet = {
    id: uid(),
    kind: input.kind,
    breed: input.breed.trim().slice(0, 16) || (input.kind === "cat" ? "田园猫" : "田园犬"),
    name,
    color: input.color,
    source: input.source,
    adoptedDay: input.gameDay,
    adoptedAt: input.adoptedAt,
    stats: { mood: 70, hunger: 80, affection: input.source === "stray" ? 20 : 10, energy: 90, cleanliness: 80 },
    tricks: [],
    personality: (input.personality ?? "").trim().slice(0, 20),
    interactionsToday: 0,
    lastTickDay: input.gameDay,
    greetedToday: false,
  };
  state.pets.push(pet);
  if (!state.activePetId) state.activePetId = pet.id;
  return { ok: true, pet, cost };
}

/** 送别宠物 (玩家主动 / 极少数剧情). 不做死亡惩罚: 开放游戏, 不拿宠物当惩罚道具. */
export function releasePet(state: PetsState, petId: string): boolean {
  const i = state.pets.findIndex((p) => p.id === petId);
  if (i < 0) return false;
  state.pets.splice(i, 1);
  if (state.activePetId === petId) state.activePetId = state.pets[0]?.id ?? null;
  return true;
}

/** 切换跟随的那只 (null = 都留在家里). */
export function setActivePet(state: PetsState, petId: string | null): boolean {
  if (petId !== null && !state.pets.some((p) => p.id === petId)) return false;
  state.activePetId = petId;
  return true;
}

export const getActivePet = (state: PetsState): Pet | null =>
  state.pets.find((p) => p.id === state.activePetId) ?? null;

// ---------------------------------------------------------------------------
// 每日互动
// ---------------------------------------------------------------------------

export type InteractionKind = "feed" | "play" | "pet" | "wash" | "train";
export type InteractResult =
  | { ok: true; pet: Pet; cost: number; note: string }
  | { ok: false; error: string };

const INTERACT_NOTES: Record<InteractionKind, string[]> = {
  feed: ["狼吞虎咽地吃完了, 舔了舔嘴.", "吃得很香, 尾巴摇个不停.", "吃完蹭了蹭你的手."],
  play: ["玩得满屋子跑, 开心得不行.", "追着玩具跑了好几圈.", "玩累了, 趴在你脚边喘气."],
  pet: ["眯起眼睛, 发出舒服的声音.", "主动把头凑过来.", "翻了个身, 露出肚皮."],
  wash: ["洗完香喷喷的, 甩了你一身水.", "洗澡时有点不情愿, 洗完倒是精神了."],
  train: ["居然学会了! 真聪明.", "练了几次, 有点进步."],
};

function pickNote(kind: InteractionKind): string {
  const notes = INTERACT_NOTES[kind];
  return notes[Math.floor(Math.random() * notes.length)] ?? "";
}

/**
 * 一次互动. 每天前 MAX_INTERACTIONS_PER_DAY 次才涨亲密度 (防刷),
 * 超过后仍可互动 (心情/饱腹照常变化), 只是亲密度不再涨.
 * 返回 cost: 本次花费 (¥, 喂食/洗澡), 由 App.tsx 从玩家金钱扣.
 */
export function interactWithPet(state: PetsState, petId: string, kind: InteractionKind): InteractResult {
  const pet = state.pets.find((p) => p.id === petId);
  if (!pet) return { ok: false, error: "找不到这只宠物" };
  const s = pet.stats;
  if (kind === "play" && s.energy < 15) return { ok: false, error: `${pet.name}太累了, 玩不动了, 让它歇会儿` };
  if (kind === "train" && s.energy < 15) return { ok: false, error: `${pet.name}太累了, 先休息再训练` };
  if (kind === "feed" && s.hunger >= 95) return { ok: false, error: `${pet.name}已经吃饱了, 吃不下了` };

  const counted = pet.interactionsToday < MAX_INTERACTIONS_PER_DAY;
  const aff = (n: number) => (counted ? n : 0);
  let cost = 0;
  switch (kind) {
    case "feed":
      s.hunger = clamp100(s.hunger + INTERACTION_EFFECTS.feed.hunger);
      s.mood = clamp100(s.mood + INTERACTION_EFFECTS.feed.mood);
      s.affection = clamp100(s.affection + aff(INTERACTION_EFFECTS.feed.affection));
      cost = INTERACTION_EFFECTS.feed.cost;
      break;
    case "play":
      s.mood = clamp100(s.mood + INTERACTION_EFFECTS.play.mood);
      s.affection = clamp100(s.affection + aff(INTERACTION_EFFECTS.play.affection));
      s.energy = clamp100(s.energy + INTERACTION_EFFECTS.play.energy);
      s.hunger = clamp100(s.hunger + INTERACTION_EFFECTS.play.hunger);
      break;
    case "pet":
      s.mood = clamp100(s.mood + INTERACTION_EFFECTS.pet.mood);
      s.affection = clamp100(s.affection + aff(INTERACTION_EFFECTS.pet.affection));
      break;
    case "wash":
      s.cleanliness = clamp100(s.cleanliness + INTERACTION_EFFECTS.wash.cleanliness);
      s.mood = clamp100(s.mood + INTERACTION_EFFECTS.wash.mood);
      s.affection = clamp100(s.affection + aff(INTERACTION_EFFECTS.wash.affection));
      cost = INTERACTION_EFFECTS.wash.cost;
      break;
    case "train":
      s.affection = clamp100(s.affection + aff(INTERACTION_EFFECTS.train.affection));
      s.energy = clamp100(s.energy + INTERACTION_EFFECTS.train.energy);
      s.mood = clamp100(s.mood + INTERACTION_EFFECTS.train.mood);
      break;
  }
  pet.interactionsToday += 1;
  return { ok: true, pet, cost, note: pickNote(kind) };
}

/** 教一个小把戏 (学会后在互动文案里出现; 不设失败惩罚, 练几次总会学会). */
export function trainTrick(state: PetsState, petId: string, trickName: string, gameDay: number): InteractResult {
  const pet = state.pets.find((p) => p.id === petId);
  if (!pet) return { ok: false, error: "找不到这只宠物" };
  const name = trickName.trim().slice(0, 8);
  if (!name) return { ok: false, error: "想教它什么?" };
  if (pet.tricks.some((t) => t.name === name)) return { ok: false, error: `${pet.name}已经会${name}了` };
  if (pet.stats.affection < 25) return { ok: false, error: "它还不太信任你, 多陪陪它再教吧" };
  const r = interactWithPet(state, petId, "train");
  if (!r.ok) return r;
  pet.tricks.push({ id: uid(), name, learnedDay: gameDay });
  return { ok: true, pet, cost: r.cost, note: `${pet.name}学会了「${name}」!` };
}

/** 改名 (免费, 随时). */
export function renamePet(state: PetsState, petId: string, name: string): boolean {
  const pet = state.pets.find((p) => p.id === petId);
  const n = name.trim().slice(0, 12);
  if (!pet || !n) return false;
  pet.name = n;
  return true;
}

// ---------------------------------------------------------------------------
// 每日结算 + 回家迎接
// ---------------------------------------------------------------------------

/**
 * 每天调用一次 (App.tsx 每日结算时, 对每只宠物).
 * 衰减饥饿/心情/清洁度, 恢复精力; 一整天零互动则亲密度微跌; 饥饿过低时
 * 心情和亲密度额外跌. 返回当天事件文案 (供日志 / feed 用).
 */
export function tickPetDay(pet: Pet, gameDay: number): string[] {
  const events: string[] = [];
  const days = Math.max(0, gameDay - pet.lastTickDay);
  if (days === 0) return events;
  const hadInteraction = pet.interactionsToday > 0;
  pet.lastTickDay = gameDay;
  pet.interactionsToday = 0;
  pet.greetedToday = false;
  const s = pet.stats;
  s.hunger = clamp100(s.hunger - DAILY_DECAY.hunger * days);
  s.mood = clamp100(s.mood - DAILY_DECAY.mood * days);
  s.cleanliness = clamp100(s.cleanliness - DAILY_DECAY.cleanliness * days);
  s.energy = clamp100(s.energy - DAILY_DECAY.energy * days); // 恢复
  if (!hadInteraction) {
    s.affection = clamp100(s.affection - DAILY_DECAY.affectionNeglect * days);
    if (s.affection < 25) events.push(`${pet.name}好几天没见到你了, 有点想你.`);
  }
  if (s.hunger < 25) {
    s.mood = clamp100(s.mood - 10 * days);
    s.affection = clamp100(s.affection - DAILY_DECAY.affectionNeglect * days);
    events.push(`${pet.name}饿了一整天, 有点委屈.`);
  }
  if (s.hunger <= 0) events.push(`${pet.name}饿坏了, 自己翻出了点剩饭.`);
  if (s.cleanliness < 20) events.push(`${pet.name}身上脏兮兮的, 该洗澡了.`);
  return events;
}

/**
 * 玩家回到家时调用 (每天第一次). 亲密度越高迎接越热情, 并涨一点亲密度.
 * 返回迎接文案 (null = 今天已经迎接过, 或没有宠物在家).
 */
export function homecomingGreeting(state: PetsState): { pet: Pet; text: string } | null {
  const pet = getActivePet(state) ?? state.pets[0];
  if (!pet || pet.greetedToday) return null;
  pet.greetedToday = true;
  const level = bondLevel(pet.stats.affection);
  const texts: Record<BondLevel, string[]> = {
    stranger: [`${pet.name}看了你一眼, 远远地坐着.`, `${pet.name}躲在角落, 悄悄观察你.`],
    friendly: [`${pet.name}跑到门口迎接你, 尾巴摇个不停.`, `${pet.name}蹭了蹭你的腿.`, `${pet.name}叼来了它的玩具.`],
    close: [`${pet.name}一听到开门声就冲过来, 围着你转圈.`, `${pet.name}扑到你怀里, 舍不得下来.`],
    family: [`${pet.name}在门口等了你一整天, 一见你就扑了上来.`, `${pet.name}趴在你的拖鞋上睡着了, 听到你回来立刻醒了.`],
  };
  const list = texts[level];
  const text = list[Math.floor(Math.random() * list.length)] ?? "";
  pet.stats.affection = clamp100(pet.stats.affection + (level === "stranger" ? 1 : 2));
  pet.stats.mood = clamp100(pet.stats.mood + 4);
  return { pet, text };
}

// ---------------------------------------------------------------------------
// 跟随逻辑 (MapView 用, 纯函数, 与渲染解耦)
// ---------------------------------------------------------------------------

export interface Vec2 {
  x: number;
  z: number;
}

/** 宠物在地图上的实时位置 (MapView 每帧维护, 不进存档). */
export interface PetRuntime {
  pos: Vec2;
  /** 朝向 (弧度). */
  heading: number;
  /** 当前动作: 跟随 / 坐 / 睡 / 玩. */
  pose: "follow" | "sit" | "sleep" | "play";
}

export const PET_FOLLOW = {
  /** 理想跟随距离 (世界单位): 亲密度越高跟得越近. */
  distanceByBond: { stranger: 2.2, friendly: 1.6, close: 1.2, family: 0.9 } as Record<BondLevel, number>,
  /** 超过这个距离直接瞬移到玩家身后 (玩家传送 / 跑太远时). */
  teleportDistance: 12,
  /** 宠物移动速度 (单位/秒), 比玩家步行略快, 保证能跟上. */
  speed: 4.2,
} as const;

/**
 * 每帧调用: 根据玩家位置算出宠物下一帧位置.
 * - 离玩家太远 (> teleportDistance): 瞬移到玩家身后.
 * - 在理想距离外: 朝玩家方向移动 (带一点横向偏移, 避免踩在玩家脚下).
 * - 在理想距离内: 原地待命 (pose 由调用方按心情决定: 心情高为 play, 否则 sit).
 * 返回新的 PetRuntime; 调用方用它更新 3D 模型位置.
 */
export function stepPetFollow(
  pet: Pet,
  runtime: PetRuntime,
  playerPos: Vec2,
  playerHeading: number,
  dtSeconds: number,
): PetRuntime {
  const bond = bondLevel(pet.stats.affection);
  const ideal = PET_FOLLOW.distanceByBond[bond];
  const dx = playerPos.x - runtime.pos.x;
  const dz = playerPos.z - runtime.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist > PET_FOLLOW.teleportDistance) {
    const bx = playerPos.x - Math.sin(playerHeading) * ideal;
    const bz = playerPos.z - Math.cos(playerHeading) * ideal;
    return { pos: { x: bx, z: bz }, heading: playerHeading, pose: "follow" };
  }
  if (dist > ideal + 0.3) {
    const step = Math.min(PET_FOLLOW.speed * dtSeconds, dist - ideal);
    const nx = runtime.pos.x + (dx / dist) * step;
    const nz = runtime.pos.z + (dz / dist) * step;
    return { pos: { x: nx, z: nz }, heading: Math.atan2(dx, dz), pose: "follow" };
  }
  const pose: PetRuntime["pose"] = pet.stats.mood >= 70 ? "play" : "sit";
  return { ...runtime, pose };
}

/**
 * 玩家在家时宠物的坐姿位置: 家门口内侧一点, 面朝门口 (等主人回来).
 * homeDoor: 家的入口世界坐标 (LifeStage 室内坐标系换算后传入, 或地图上的家 loc 坐标).
 * 返回 { pos, heading } 供 MapView / LifeStage 放置宠物模型.
 */
export function petHomePose(homeDoor: Vec2, doorHeading: number): { pos: Vec2; heading: number } {
  return {
    pos: { x: homeDoor.x + Math.sin(doorHeading) * 0.8, z: homeDoor.z + Math.cos(doorHeading) * 0.8 },
    heading: doorHeading + Math.PI, // 面朝门口
  };
}

// ---------------------------------------------------------------------------
// 持久化 + 服务器同步形状
// ---------------------------------------------------------------------------

export function serializePets(state: PetsState): string {
  return JSON.stringify(state);
}

export function deserializePets(raw: string | null): PetsState {
  if (!raw) return emptyPetsState();
  try {
    const parsed = JSON.parse(raw) as Partial<PetsState>;
    if (!Array.isArray(parsed.pets)) return emptyPetsState();
    const pets = parsed.pets.filter(
      (p): p is Pet =>
        !!p && typeof p.id === "string" && (p.kind === "cat" || p.kind === "dog") && typeof p.name === "string",
    );
    return {
      pets,
      activePetId: typeof parsed.activePetId === "string" && pets.some((p) => p.id === parsed.activePetId)
        ? parsed.activePetId
        : (pets[0]?.id ?? null),
    };
  } catch {
    return emptyPetsState();
  }
}

/**
 * 服务器同步形状 (area S: 存在 players 表的 pet_json 字段或新建 pets 表;
 * 客户端在领养/互动/每日结算后调用 api.syncPets, 下线前最后一次).
 * 宠物是个人资产, 不需要其他玩家实时看到; 同步只为换设备不丢 + 排行榜彩蛋
 * (如 "最黏人的猫" 榜单素材). 流浪收养要走服务器, 防止同一只流浪动物被多人领走.
 */
export interface PetSyncPayload {
  playerId: string;
  pets: Pet[];
  activePetId: string | null;
  /** 流浪收养时附带: 服务器据此把该流浪动物标记为已收养. */
  adoptedStrayId?: string;
}

// ---------------------------------------------------------------------------
// 集成片段 (给集成 agent, 不要直接改 App.tsx/MapView.tsx)
// ---------------------------------------------------------------------------
//
// PET_MODEL_HOOK — 3D 模型 (round-3 已实现: MapView.tsx 的 makePetGroup,
//   与 LifeStage.tsx 的 makeFigure 同一路子 —— 基础几何体拼装, 不需要新 .glb):
//   - 猫/狗各一个低多边形模型: 身体 (椭球) + 头 (球) + 耳朵
//     (猫三角尖耳 / 狗垂耳) + 尾巴 (猫上翘细尾 / 狗平伸粗尾, 跟随动画时摆动)
//     + 四条短腿 (走路时摆动) + 两只黑眼睛 + 狗吻部 / 猫粉鼻子.
//     规格见本文件 PET_MODEL, 颜色用 pet.color; 猫 0.55 高 / 狗 0.7 高
//     (世界单位, 相对玩家 ~1.7), 狗整体再放大 1.28 倍.
//   - 动作: follow = 腿摆动 + 尾巴摇 + 轻微起伏; sit = 身体直立 (胸抬起,
//     尾巴盘在身侧慢摇); sleep = 趴下; play = 原地小跳 + 尾巴快摇.
//   - 位置每帧由 stepPetFollow() 驱动 (MapView 帧循环里调); 玩家在家
//     (locId === "home" 或室内) 时, 家里的坐姿见本文件底部的家宠物片段,
//     由 LifeStage.tsx 渲染 (不要在 MapView 里再画一只).
//
// APP SNIPPET 1 — 领养入口 (App.tsx, 宠物面板/收容所按钮旁):
//   import { adoptPet, interactWithPet, homecomingGreeting, tickPetDay,
//            PET_STORAGE_KEY, serializePets, deserializePets, type PetsState }
//     from "./round2/pets";
//   const [pets, setPets] = useState<PetsState>(() =>
//     deserializePets(localStorage.getItem(PET_STORAGE_KEY)));
//   useEffect(() => { localStorage.setItem(PET_STORAGE_KEY, serializePets(pets)); }, [pets]);
//   // 领养后: void api.syncPets({ playerId, pets: pets.pets, activePetId, adoptedStrayId })
//   // 每日结算: pets.pets.forEach((p) => tickPetDay(p, gameDay))
//   // 回家时: const greet = homecomingGreeting(pets); 若有则显示文案 toast
//
// APP SNIPPET 2 — 宠物面板按钮 (放在玩家主页/家界面):
//   喂食: interactWithPet(pets, pet.id, "feed")   // 扣 cost ¥, 需检查玩家金钱 >= cost
//   玩耍: interactWithPet(pets, pet.id, "play")
//   抚摸: interactWithPet(pets, pet.id, "pet")
//   洗澡: interactWithPet(pets, pet.id, "wash")   // 扣 cost ¥
//   训练: trainTrick(pets, pet.id, trickName, gameDay)
//
// MAPVIEW SNIPPET — 跟随渲染 (round-3 已实现, MapView.tsx):
//   MapView 新增 props: activePet (App 传 getActivePet(pets)).
//   帧循环里: petRuntimeRef.current = stepPetFollow(activePet,
//   petRuntimeRef.current, playerPos, playerHeading, dt), 再把 makePetGroup
//   建的模型 position/rotation 对应设置; 换宠物 (id/kind/color 变了) 时
//   重建模型; 没有宠物 (pets.pets.length === 0) 或玩家在坐火车时不渲染.
//   玩家在家时: 家里的宠物由 LifeStage.tsx 渲染 (见本文件底部家宠物片段),
//   MapView 不画.
//
// 家宠物片段 (给集成 agent, LifeStage.tsx 里应用, 不要直接改本文件):
//   见 ~/workspace/shenhui-life-sim/ROUND3-LOG-C.md “家里宠物集成 snippet”:
//   LifeStage3D 的 Props 加 homePet?: Pet | null, 在 setKind === "flat" 的
//   场景里 (LifeStage.tsx:1247 的 flat 分支, 门在 (-4.4, 1.13, -3.56),
//   沙发在 (-1.3, 0.3, -2.35)), 于 actor 建好后 (2588 行附近) 用
//   makePetGroup 同款几何体 (或复用 MapView 的 makePetGroup, 抽成共享
//   builder 前先在 LifeStage 里照抄一份) 在门口内侧 (-3.6, 0, -2.7)
//   放一只坐姿宠物, 面朝门口 (rotation.y = π), pose 由 petHomePose() 的
//   位置 + 坐姿决定; App 在 flat 处传 homePet={getActivePet(pets)}.
//