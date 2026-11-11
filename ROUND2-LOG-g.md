# ROUND-2 LOG — area (g): faces, controls, cutscenes, voices, sounds2, house, police, phone, venue sets

Date: 2026-11-11. Branch: `feature/round-2` (local only, never pushed, main untouched).
Agent: area (g). Baseline: 32348ca, GREEN (standalone typecheck 0 errors, vite build ✓ per coordinator).

## Files changed (only these)

| File | What |
|---|---|
| `client/src/LifeStage.tsx` | Faces on every figure; 18 new venue sets + buildplot; ROAM_SPOTS for cutscenes + new sets; dynamic joystick base; velocity smoothing + glide; keyboard attach; WASD hints; dialogue-voice effect; new props (`faceId`, `partnerFaceId`, `houseLayout`, `talkText`, `talkVoiceId`) |
| `client/src/sound.ts` | sounds2 wired (see §5); karaoke CN; scene beds; ferry horn; mahjong placeholder (null, not faked) |
| `client/src/round2/controls.ts` | NEW — WASD/arrows + Shift-run + E/Space, shared stick ref, keyboard-used signal |
| `client/src/round2/sounds.ts` | NEW — per-NPC voices (blips primary, speechSynthesis optional) |
| `client/src/round2/house.ts` | NEW — build-your-own-house layout model, validation, persistence, publish conversion |
| `client/src/round2/police.ts` | NEW — patrol / observe / report, avatar-only validation, visible-to-watched |
| `client/src/round2/phone.ts` | NEW — phone fullscreen via Fullscreen API (+ expanded-sheet fallback) |

NOT touched: `App.tsx`, `MapView.tsx`, `data.ts`, `metro-sz.ts`, `server/`, anything else.
All App.tsx work is snippets below (§9). `npm run build` was NOT run (per task; integration agent does it).

## Verification

- `cd ~/workspace/shenhui-life-sim/standalone && npx tsc --noEmit -p tsconfig.json` → **0 errors** (two errors found and fixed during the run: a duplicate `bedroom` ROAM_SPOTS key — the original desk spot now merged with sleep/wake — and a spread-order error in `house.ts loadHouseLayout`).
- No browser verification done by this agent (no live-browser access in this subagent); the integration agent should browser-verify: close-up faces in a venue, WASD walking, a walkable sleep cutscene, a new venue set (oilpainting), phone fullscreen.
- Note: `~/MEMORY.md` was edited by another agent mid-task (code-pull note + Dafen line restored); irrelevant to this work, no action taken. Other round-2 agents' files (`round2/pets.ts`, `community.ts`, `delivery.ts`, `economy.ts`, `report.ts`) were already present; not touched.

## Per-item status (priority order)

### 1. FACES — DONE
- `makeFigure` now builds real face geometry on EVERY figure: eye whites + pupils (size/spacing/shape vary), eyebrows (angle/thickness vary), nose hint, mouth (smile / flat / open / smirk, size varies), face width, skin tone, hair colour — all derived deterministically from a seed via `faceSpecFor()` (FNV hash). Same person → same face every session; two people don't share one.
- Features are children of the head mesh, so they turn with the head in poses (idle glance, talk, etc.). Front is +z (fringe side).
- Player: `faceId` prop (snippet S4 passes the player id; fallback `player-<emoji>`). Partner: `partnerFaceId` prop. Background NPCs (`extraFigure`): seed from position + shirt, so a venue never shows two identical faces. Kids: `kid-<i>`.
- The emoji `faceSprite` above the head is kept (identity marker); faces are additional geometry underneath it.
- Caveat: faces are low-poly geometry by design (matches the existing builder style); they read at close-up/venue distance, not as portrait detail.

### 2. CONTROLS — DONE (in LifeStage; joystick lives here, not App.tsx)
- Verified: the joystick is `MoveStick` in `LifeStage.tsx:72`, NOT in App.tsx — so this was implementable in my own file. App.tsx has no movement keys at all (its only keydown handler is Esc-for-fullscreen).
- NEW `round2/controls.ts`: `attachKeyboardRoam()` — WASD + arrow keys (diagonals normalized), Shift = run (stick magnitude 1.0, above the roam loop's 0.9 sprint line; walk = 0.75), E / Space = interact (fires the near-spot callback, repeat-guarded), ignores keys while typing in inputs, clears keys on window blur. Keyboard and joystick write the SAME `stickRef`, so the roam loop needed no changes.
- Wired in LifeStage's roam effect: E/Space triggers `onSpot(lastNear)`; first movement key sets `kbUsed`.
- Joystick improvements (in `MoveStick`): DYNAMIC base — the stick circle now appears where the thumb touches inside the bottom-left 55%×45% zone, clamped so it stays in view; release snaps it back to the default corner. Smoother acceleration — velocity is lerped toward the stick target (`1 - exp(-10·dt)`) in the roam frame loop, with a short glide on release. Push-to-run kept (mag > 0.9 sprint).
- Desktop: when a keyboard is used, the joystick HIDES and a WASD hint pill shows (`⌨️ WASD / 方向键 移动 · Shift 跑 · E 互动 · 拖动看四周`, EN variant via `KEYBOARD_HINTS`). The hint also shows on pointer:fine devices before the first key so players know keys exist. Mouse drag to rotate already existed (pointer handlers in the roam effect) — unchanged.

### 3. JOYSTICK CUTSCENES — DONE (LifeStage side; App snippet S5)
- ROAM_SPOTS added for `bedroom` (sleep / wake — merged with the existing front-desk spot), `kitchen` (cook / eat / wash), `bathroom` (wash / shower). Existing spots already cover `flat`, `office`, `gym`, `park`, `mall`, `market`, `restaurant`, etc.
- Mechanism: a cutscene step renders `LifeStage3D` with `pose="idle" roam` on the set for that beat (bedroom/kitchen/bathroom/market/gym/park/mall) instead of a posed actor; the player walks with the same joystick/keyboard, and `onSpot` advances the step (snippet S5). The 2.3s auto-advance timer still runs — the snippet recommends pausing it for walkable kinds so walking isn't time-boxed, with onSpot + 跳过 as the advance paths.
- `home` has no set dressing (bare floor) — snippet maps the `day` scene's home beat to `flat` instead.

### 4. VOICES — DONE
- NEW `round2/sounds.ts`: `voiceProfileFor(id)` — deterministic per-NPC profile (baseHz 120–320, blip rate, waveform, wobble, blip length, speech pitch/rate) from an FNV hash of the NPC id/name.
- PRIMARY: `playNpcVoice()` → Animal Crossing-style vocal blips (own lazy AudioContext, per-character/word rhythm, pitch walk) — works offline, no assets. `stopNpcVoice()` cuts it.
- OPTIONAL: `playSpeech()` — Web Speech API with the same profile's pitch/rate, `speechSupported()` guard, falls back to blips. Mode persisted (`shhr-voice`: `blips` default | `speech` | `off`); `VOICE_MODES` list provided for a settings row (snippet S9).
- Wired into LifeStage: a `useEffect` on `talkText`/`talkVoiceId` props blips the dialogue line in the speaker's voice. Venue dialogue is therefore automatic once snippet S4 passes the props. NPC chat needs the one-line call in snippet S9 (its reply path was not in my files).
- Recording real voice lines: NOT done, per task (not feasible) — synthesized/varied tones only.

### 5. SOUNDS2 WIRING — DONE
- All 14 sounds2 mp3s (verified present under `client/public/music/shenhui-sounds2/`) are now referenced from `sound.ts` via a new `sounds2Url()` helper (note: they live NESTED under `music/shenhui-sounds2/`, not flat in `music/`).
- Scene-matched mapping:
  - `market-wet.mp3` → market ambience (replaces the old file, which was actually a supermarket).
  - `rain-real.mp3` → storm ambience (replaces synth wind).
  - `metro-ding.mp3` → `sfx("chime")` (the old code even commented "包里没有这声" — now it exists); `sfx("chime")` is already called at App.tsx:1515/1519.
  - `fail.mp3` → `sfx("fail")`.
  - Scene beds via new `SceneSfxId` + `setSceneSfx()` / `setWorld({ sceneSfx })`: cooking→cooking, gym→gym, keyboard-office→office, cafe→cafe, hospital→clinic, airport→airport, sleep→sleep. Snippet S10 shows the one-line derivation at the existing `setWorld` call (App.tsx:2009).
  - `ferry-horn.mp3` → new exported `playFerryHorn()` one-shot (CC-BY 3.0, Daniel Simon).
  - `karaoke-cn-1/2.mp3` → new `setKaraokeLang("en" | "cn")` / `karaokeLangNow()`; the karaoke player now rotates the Mandarin pack when selected; `nowPlayingCredit()` returns the Adeline Yeo CC-BY 4.0 credit for CN. Credits added to `EXTRA_CREDITS` (karaoke-cn ×2, metro-ding, ferry-horn).
- MAHJONG: **still missing, placeholder only** — exported `export const MAHJONG_SFX_FILE: string | null = null` with a TODO comment (set to `"sfx/scenes/mahjong.mp3"` when the file lands at `client/public/music/shenhui-sounds2/sfx/scenes/mahjong.mp3`). `sfx("mahjong")` is a new `Sfx` member that falls back to a soft synth double-knock until then. **The file was NOT faked.**

### 6. HOUSE BUILDING — DONE (module + 3D set; App snippet S6)
- NEW `round2/house.ts`: pure layout model on a 12×8 m plot — rooms (living/bedroom/kitchen/bathroom/studio/balcony), wall segments, furniture items; `validateHouseLayout()` (overlap / out-of-plot / furniture-outside-room / caps); `save/loadHouseLayout()` (localStorage `shhr-house-layout`); `houseLayoutToPlacedFurn()` converts a built layout to the existing `{ id, slot }` shape so it publishes through the SAME `publishHome`/`getHome` path visitors already use — **no new server endpoint needed**.
- Catalog honesty: only `bed-double`, `sofa-fabric`, `kitchen-cabinet` are verified in the game's furniture catalog (App.tsx:6072) and publish today; `table/wardrobe/desk/tv/plant` are build-only and are reported in `dropped` (with reason) instead of silently publishing a wrong item. `HOUSE_FURN_SLOTS` duplicates LifeStage `FURN_SLOTS` coordinates (comment-flagged; must stay in sync).
- LifeStage: new `LifeSet "buildplot"` renders the layout on an empty plot (grid, plot border, room floors + low walls, wall segments, furniture boxes) with roam (`ROAM_SPOTS.buildplot`: look around). Props: `houseLayout`.
- Entry point + editor UI are App-side (snippet S6).

### 7. POLICE / SURVEILLANCE — DONE (module; App snippet S7)
- NEW `round2/police.ts`: `startPatrol/stopPatrol`, `observe/stopObserving`, `getWatchers/isWatched`, `buildPoliceReport`, `toBlackReportArgs`.
- Rules enforced in code: `isGameAvatarId()` rejects anything that isn't a lowercase game slug (no spaces, no `@`, no dots, no 7+ digit runs) — **no real personal data can enter**; watching yourself is rejected; observations end when the patrol ends.
- **The watched player can see it**: every observation is registered in a watchers map readable via `getWatchers(targetId)`; `WATCH_INDICATOR` (👁️ "有人在留意你") is the badge the App snippet renders on the watched player's screen. Watching alone has NO consequences — a report only matters after area (d)'s jury upholds it.
- Hook to area (d): `toBlackReportArgs()` shapes a police report about an NPC landlord/employer into `report.ts` `FileBlackReportArgs` for `ReportTransport.fileBlackReport` (area S). Player-vs-player reports do NOT go there — they go through the existing server `reportPlayer` action (see snippet S7). `report.ts` was already present when I started; I read its transport shape, I did not modify it.

### 8. PHONE FULLSCREEN — DONE (module + snippet; phone UI lives in App.tsx)
- Verified: the phone UI is App.tsx:6395 (`phoneOpen`, `phoneApp`, fixed sheet `max-h-[86vh] max-w-md`). I did NOT edit it.
- NEW `round2/phone.ts`: `requestPhoneFullscreen(el)` / `exitPhoneFullscreen()` / `togglePhoneFullscreen(el)` / `isPhoneFullscreen()` using the Fullscreen API (webkit fallback), returning false when the API refuses (iframe/gesture rules) so the caller can fall back to CSS.
- Snippet S8: add `phoneFull` state + a ⛶ expand button in the phone header + full-bleed Tailwind classes when on (sheet becomes `inset-0 p-0`, panel `h-full w-full max-w-none rounded-none`). No new CSS file needed. Esc already exits browser fullscreen natively.

### 9. VENUE SETS — DONE (LifeStage side; App snippets S1–S3)
- 17 new `LifeSet` members + full 3D dressing branches (each: back wall + sign board + 2–4 signature prop groups + 1–2 NPC figures with distinct face seeds):
  - Markets (audit table 1): `oilpainting` （满墙油画、画架、作画的画家、画廊、装裱店）, `secondhand` （旧手机、旧家具、黑胶、地摊）, `seafood` （海鲜档、水箱活鱼活虾、代加工大排档）, `oldtown` （骑楼、客家小吃档、老婆饼/肠粉）, `womensstreet` （服装鞋袜档、金鱼档、花档）.
  - Type-fix sets (audit table 2): `museum` （展厅、展柜、改革开放史展）, `library` （书架、阅览桌）, `factory` （厂房、产线、三班倒）.
  - Fun/scenic (audit table 3): `disney` （城堡、游乐设施、花车）, `tram` （叮叮电车、轨道、站牌）, `temple` （香炉、求签处）, `miniature` （埃菲尔铁塔、金字塔、微缩地标）, `farm` （奶牛、玉米地、挤奶）, `watershow` （喷泉水秀、舞台、滨海商场）, `boardwalk` （木栈道、栏杆、看海 — NOT a beach), plus `fishingport` （码头、渔船、渔网、鱼市 — 巽寮湾渔港/大澳） and `bikehub` （租车、18 公里绿道 — 红花湖骑行站/将军澳）.
  - `wetmarket` is NOT a new set: the existing `market` set IS the wet market (correct for 北角春秧街街市 only) — see mapping below.
- ROAM_SPOTS added for every new set (2–3 spots each); spot ids double as `VENUE_TALK` ids in App (snippet S3). Floor kinds and the `indoor` background list updated; idle actor placement faces the back wall for the indoor sets.
- ELECTRONICS REACHABILITY — verified: the electronics set already exists (LifeStage ~1387, one-metre counters,验机台） and `VENUE_SETS.electronics` (App.tsx:119) routes `type === "electronics"` to it, so it becomes reachable as soon as area (b) changes 华强北's type from `"market"` to `"electronics"` (or the snippet S1 venueSet routing lands). One remaining App-side break: `VENUE_PLACE.electronics` is `"market"` (App.tsx:4604), so venue actions would still be the wet-market set — fixed in snippet S2.
- VenueSet name mapping (mine vs area (b)): **no `venueSet` field exists in `data.ts` yet** (checked 2026-11-11 — area (b) hasn't landed it). My canonical names are the ones above, taken straight from the audit tables. If area (b) names them differently, snippet S1 is written venueSet-first with a type/id fallback, so the coordinator only needs to rename keys in `VENUE_SET_BY_KEY`. Mapping to audit tables: electronics→(exists), oilpainting→大芬油画村， secondhand→桥东二手市集， seafood→霞涌海鲜街/西贡海鲜街， oldtown→淡水老城/元朗大马路/大鹏所城/中英街， womensstreet→旺角女人街， wetmarket→北角春秧街街市（= existing `market`), museum→深圳/惠州博物馆 (+海上世界文化艺术中心）, library→香港中央图书馆， factory→中海油大亚湾/亿纬锂能， disney→香港迪士尼， tram→湾仔电车路， temple→黄大仙祠/昂坪天坛大佛， miniature→世界之窗/锦绣中华， farm→光明农场/海上田园/青青世界， watershow→欢乐海岸， boardwalk→盐田海滨栈道/尖沙咀海滨/将军澳海滨， fishingport→巽寮湾渔港/大澳渔村， bikehub→红花湖骑行站/将军澳单车径. Still routed by existing sets (no new set needed): `lodging`→bedroom （温泉酒店/檀悦豪生）, `mountain`→hike （罗浮山/高榜山）, `port`→concourse/fishingport （渔港 prefer fishingport), beaches→beach (4 misclassified: 大亚湾黄金海岸/屯门黄金海岸/三角洲岛/杨梅坑 — they need the beach regex or a venueSet; snippet S1 handles via venueSet).
- NOT done here (belongs to area (b) / integration): the `data.ts` type changes (table 2), the `hq` duplicate id, 德赛西威 mojibake, NPC `preferTypes` fixes (table 6), the `special` animation table (table 4), `venueActions` per subtype (table 5). My sets only fix the walk-in interior layer; actions/animations/NPCs need the App-side snippets + area (b) data changes.

## 9. Integration snippets for App.tsx (integration agent only)

### S1 — venue routing: venueSet first, then type (insert in `venueFor`, App.tsx:130-144; add `VENUE_SET_BY_KEY` next to `VENUE_SETS` at :115)

```tsx
/** round-2 (g): venueSet → 3D set. Area (b) puts `venueSet` on the place in
    data.ts; until then the type/id fallback below keeps old places working.
    Names are the audit-table names (see ROUND2-LOG-g.md §9). */
const VENUE_SET_BY_KEY: Partial<Record<string, { set: LifeSet; zh: string; en: string }>> = {
  electronics: { set: "electronics", zh: "一米柜台：手机、平板、配件，当场验机再付钱", en: "One-metre counters: phones, tablets and parts — check it before you pay" },
  oilpainting: { set: "oilpainting", zh: "满墙油画：画架、画家、画廊、装裱店", en: "Walls of oil paintings: easels, painters, a gallery, a framing shop" },
  secondhand: { set: "secondhand", zh: "二手市集：旧手机、旧家具、黑胶、地摊", en: "Second-hand market: old phones, old furniture, vinyl, ground stalls" },
  seafood: { set: "seafood", zh: "海鲜街：海鲜档、水箱、活鱼活虾、代加工大排档", en: "Seafood street: stalls, tanks of live fish and shrimp, dai pai dong cooking" },
  oldtown: { set: "oldtown", zh: "老街：骑楼、客家小吃、老字号", en: "Old street: qilou arcades, Hakka snacks, old shops" },
  womensstreet: { set: "womensstreet", zh: "女人街：服装鞋袜、金鱼、花档", en: "Ladies' Market: clothes, goldfish, flowers" },
  wetmarket: { set: "market", zh: "菜市场里转转：鱼档、菜档、讨价还价", en: "Walk the wet market: fish stalls, greens, haggling" },
  museum: { set: "museum", zh: "展厅、展柜：改革开放史展", en: "Galleries and cases: the reform-era exhibition" },
  library: { set: "library", zh: "书架、阅览桌：借书自修", en: "Shelves and reading tables: borrow a book, study a while" },
  factory: { set: "factory", zh: "厂房、产线：三班倒的产业园", en: "Factory sheds and a production line" },
  disney: { set: "disney", zh: "城堡、游乐设施、花车", en: "The castle, rides and the parade" },
  tram: { set: "tram", zh: "叮叮电车：轨道、电车、站牌", en: "The ding-ding tram: tracks, tram, stop" },
  temple: { set: "temple", zh: "香炉、求签处", en: "Incense burner and fortune sticks" },
  miniature: { set: "miniature", zh: "微缩世界：埃菲尔铁塔、金字塔", en: "Miniature world: Eiffel Tower, pyramids" },
  farm: { set: "farm", zh: "农场：奶牛、玉米地、挤奶", en: "The farm: cows, corn, milking" },
  watershow: { set: "watershow", zh: "滨海水秀、商场", en: "The waterfront water show and mall" },
  boardwalk: { set: "boardwalk", zh: "海滨栈道：木栈道、栏杆、看海", en: "The boardwalk: planks, rails, the sea" },
  fishingport: { set: "fishingport", zh: "渔港：码头、渔船、渔网、鱼市", en: "The fishing port: pier, boats, nets, the catch" },
  bikehub: { set: "bikehub", zh: "骑行站：租车、18 公里绿道", en: "Bike hub: rentals and the 18 km greenway" },
};
function venueFor(loc: { type: string; id: string; name: string; venueSet?: string }): { set: LifeSet; zh: string; en: string } | null {
  const byKey = loc.venueSet ? VENUE_SET_BY_KEY[loc.venueSet] : undefined;
  if (byKey) return byKey;
  const fixed = VENUE_SETS[loc.type];
  if (fixed) return fixed;
  // ... rest of existing venueFor unchanged (transit/port → concourse,
  // mountain → hike, scenic/fun → beach-or-park) ...
}
```
Also add `venueSet?: string` to the place/`Loc` type if area (b) hasn't (it hasn't, as of this writing).

### S2 — fix the electronics action mapping + hosts for new sets (App.tsx:4604)

```tsx
// BEFORE (bug from audit table 5): electronics: "market" — the wet-market
// actions (buy veg, fishmonger) would show inside Huaqiangbei.
const VENUE_PLACE: Partial<Record<LifeSet, string>> = {
  restaurant: "food", mall: "mall", office: "work", gym: "gym",
  market: "market", electronics: "electronics", club: "fun",
  classroom: "learn", clinic: "health", bedroom: "lodging",
  oilpainting: "oilpainting", secondhand: "secondhand", seafood: "seafood",
  oldtown: "oldtown", womensstreet: "womensstreet", museum: "museum",
  library: "library", factory: "factory", disney: "fun", tram: "transit",
  temple: "scenic", miniature: "fun", farm: "farm", watershow: "fun",
  boardwalk: "scenic", fishingport: "port", bikehub: "scenic",
};
```
Note: `regularHere(set)` filters NPCs by `preferTypes` containing that kind — new kinds (`oilpainting`, `seafood`, …) match nobody until area (b)/NPC pass adds NPCs with those preferTypes (e.g. a painter for Dafen, 阿海 for seafood — he already has `market` in preferTypes; give him `seafood` too). Until then `regularHere` returns undefined and the venue shows no host — the 3D NPCs I built still appear (they're baked into the sets).

### S3 — VENUE_TALK entries for the new sets (insert inside `VENUE_TALK`, App.tsx:47, before its closing `};`)

Spot ids MUST match `ROAM_SPOTS` in LifeStage (they do — same ids below). Full entries for the markets (audit table 1); the scenic sets follow the same shape — one entry per spot id.

```tsx
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
```
Pattern for the remaining sets (one entry per ROAM_SPOTS id, same fields): disney: castle / ride / parade; tram: ride / photo; temple: pray / fortune; miniature: tour / photo; farm: milk / pick / crab; watershow: show / mall; boardwalk: stroll / view; fishingport: buy / boat; bikehub: rent / ride; buildplot: view (App-side only — no VENUE_TALK needed unless the build preview is entered as a venue).

### S4 — venue LifeStage3D props: faces + voices (App.tsx:6001, the `<LifeStage3D key={...venue-...} ... />` call)

Add these props to that call (everything else unchanged):

```tsx
faceId={prof.playerId ?? s.playerId ?? "player"}
partnerFaceId={(() => { const host = regularHere(venue3d.set); const meeting = !!(venueTalk && host && MEET_IDS.has(venueTalk.id)); return meeting && host ? host.name : venueTalk?.who; })()}
talkText={venueTalk ? (en ? venueTalk.sayEn : venueTalk.say) : undefined}
talkVoiceId={venueTalk ? (regularHere(venue3d.set)?.name ?? venueTalk.who) : undefined}
```
Notes: `prof.playerId` — use whatever the existing player-id field is called in that scope (I saw `prof.playerId` used at App.tsx:2941 in `publishHome`); if the scope has no `prof`, use the same id source as the DM/party code. `host.name` exists (`regularHere` returns an NPC with `.name` — used at :6004). The `talkText` effect in LifeStage plays the blips automatically; no `runVenueTalk` change needed for venue dialogue.

### S5 — walkable daily-life cutscenes (App.tsx ~5844 life overlay + ~1381 timer effect)

```tsx
/** round-2 (g): daily-life beats you walk instead of watch. Set = the
    LifeStage set for that beat; ROAM_SPOTS already exist for each. */
const CUTSCENE_ROAM: Partial<Record<LifeKind, LifeSet>> = {
  sleep: "bedroom", cook: "kitchen", eat: "market", wash: "bathroom",
  groceries: "market", gym: "gym", stroll: "park", shopping: "mall",
};
```
1. In the life overlay (the `<LifeStage3D key={`${lifeAnim.kind}-${lifeAnim.idx}`} ... />` at ~5846), replace with:
```tsx
{CUTSCENE_ROAM[lifeAnim.kind] ? (
  <LifeStage3D key={`roam-${lifeAnim.kind}-${lifeAnim.idx}`} setKind={CUTSCENE_ROAM[lifeAnim.kind]!} pose="idle" roam
    shirt={outfit.shirt} pants={outfit.pants} night={stepNight} emoji={iden.emoji} en={en}
    onSpot={() => { if (lifeAnim.idx + 1 >= scene.steps.length) finishLifeAnim(); else setLifeAnim({ kind: lifeAnim.kind, idx: lifeAnim.idx + 1 }); }} />
) : (
  <LifeStage3D key={`${lifeAnim.kind}-${lifeAnim.idx}`} setKind={sp.set} pose={sp.pose} shirt={outfit.shirt} pants={outfit.pants} night={stepNight} emoji={iden.emoji} />
)}
```
2. Recommended: pause the 2.3s auto-advance timer for walkable kinds, so the player isn't rushed off the beat — add at the top of the timer `useEffect` (~1381):
```tsx
if (CUTSCENE_ROAM[lifeAnim.kind]) return; // walkable beat: onSpot / 跳过 advances
```
3. `day` kind's home beat (`lifeStageFor` "day" idx 1 → `{ set: "home", pose: "idle" }`) has no set dressing — either leave it posed, or change that entry to `{ set: "flat", pose: "idle" }` and add `day` to CUTSCENE_ROAM via a per-step map (the flat set already has ROAM_SPOTS + roam support in the home overlay).

### S6 — house building entry point (App.tsx home panel, near the `__home3d` action ~5093 / "我的家 · 3D" button ~3944)

```tsx
import { emptyHouseLayout, loadHouseLayout, saveHouseLayout, validateHouseLayout, houseLayoutToPlacedFurn, HOUSE_FURN_CATALOG, HOUSE_ROOM_KINDS, type HouseLayout } from "./round2/house";

// state (near the other home state):
const [buildOpen, setBuildOpen] = useState(false);
const [houseLayout, setHouseLayout] = useState<HouseLayout>(() => loadHouseLayout() ?? emptyHouseLayout());

// entry button, next to "我的家 · 3D":
<button type="button" onClick={() => setBuildOpen(true)} className="mb-2 w-full rounded-full border-2 border-[var(--text)] py-2.5 text-sm font-black">🏗️ {en ? "Build my own house" : "自己盖房子"}</button>

// build panel (new overlay, same pattern as the other dialogs):
//  - 2D plot grid (12×8): tap a cell to place the selected room / wall /
//    furniture from a palette built from HOUSE_ROOM_KINDS + HOUSE_FURN_CATALOG
//  - validateHouseLayout(layout) for the error line; saveHouseLayout(layout) on change
//  - 3D preview inside the panel:
//      <LifeStage3D setKind="buildplot" pose="idle" roam houseLayout={houseLayout}
//        shirt={outfitOf(s.outfit).shirt} pants={outfitOf(s.outfit).pants}
//        night={false} emoji={iden.emoji} en={en} />
//  - "发布" button: const { placed, dropped } = houseLayoutToPlacedFurn(houseLayout);
//      mutate((x) => { x.furnPos = Object.fromEntries(placed.map((p) => [p.id, p.slot])); });
//      publishHome(); — then the built house is what visitors walk into.
//      If dropped.length, toast which pieces don't publish yet (not-in-catalog / no-free-slot).
```
No new server endpoint: publish uses the existing `publishHome` / `getHome` flow.

### S7 — police / surveillance (new UI; logic in `round2/police.ts`)

```tsx
import { startPatrol, stopPatrol, observe, stopObserving, getWatchers, isWatched, buildPoliceReport, toBlackReportArgs, WATCH_INDICATOR, isGameAvatarId } from "./round2/police";
import { asReportTransport } from "./round2/report"; // area (d) — already exists

// state (near the other mode state):
const [patrolling, setPatrolling] = useState(false);
// my own avatar id for observe(): the same id used for DMs/parties (myId in App).

// start/stop, e.g. a "巡逻" action in the place panel:
onClick={() => { if (patrolling) { stopPatrol(myId); setPatrolling(false); } else if (startPatrol(myId, s.cityKey)) setPatrolling(true); }}

// observe a nearby avatar (player list / NPC in view):
const rec = observe(targetAvatarId, "在市场门口转了三圈"); // null when rejected — show "只能观察游戏里的玩家/NPC"

// the watched player sees it — render wherever the player badge / HUD is:
{isWatched(myId) && (
  <div className="...">👁️ {WATCH_INDICATOR.zh}：{getWatchers(myId).map((w) => w.officerId).join("、")} — {WATCH_INDICATOR.detailZh}</div>
)}

// file a report (confirm screen first; filing alone does nothing):
const payload = buildPoliceReport(myId, targetId, "npc-landlord" /* or "npc-employer" | "player" */, s.cityKey, body);
if (payload) {
  if (payload.targetKind === "player") {
    void api.reportPlayer({ playerId: myId, targetId, reason: payload.body }); // existing server action
  } else {
    const args = toBlackReportArgs(payload, myId, targetName);
    if (args) void asReportTransport(api).fileBlackReport(args); // area (d) jury flow, area S endpoint
  }
}
```
Rules reminder: never pass a real name/phone/email as an id — `isGameAvatarId()` rejects those; the UI should only offer game avatar ids (player list / NPC ids).

### S8 — phone fullscreen (App.tsx:6395 phone dialog; `phoneOpen` state at :844)

```tsx
import { togglePhoneFullscreen, isPhoneFullscreen } from "./round2/phone";

// state, next to phoneOpen:
const [phoneFull, setPhoneFull] = useState(false);
const phoneSheetRef = useRef<HTMLDivElement | null>(null);

// expand button, in the phone header next to the ✕ close button (App.tsx ~6401):
<button type="button" aria-label={phoneFull ? "退出全屏" : "全屏"} onClick={async () => {
  const ok = await togglePhoneFullscreen(phoneSheetRef.current);
  setPhoneFull(ok ? isPhoneFullscreen() : !phoneFull); // API refused → CSS fallback
}} className="rounded-full bg-[var(--surface2)] px-3 py-1.5 text-sm font-black">⛶</button>

// sheet classes — replace the two class strings in the phone dialog:
//   outer: {phoneFull ? "fixed inset-0 z-50 flex bg-black/55" : "fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center"}
//   panel: <div ref={phoneSheetRef} className={phoneFull ? "rise h-full w-full overflow-y-auto bg-[var(--surface)] p-5" : "rise max-h-[86vh] w-full max-w-md overflow-y-auto rounded-[24px] border-2 border-[var(--border)] bg-[var(--surface)] p-5"}>
//   close button: also setPhoneFull(false) when closing the phone.
```
Esc exits browser fullscreen natively; no handler change needed.

### S9 — voices: settings row + NPC chat (venue talk is automatic via S4)

```tsx
import { voiceMode, setVoiceMode, VOICE_MODES, playNpcVoice } from "./round2/sounds";

// settings row (near the music/sound toggles):
<div>{VOICE_MODES.map((m) => (
  <button key={m.id} type="button" onClick={() => setVoiceMode(m.id)}
    className={voiceMode() === m.id ? "chip bg-[var(--text)] text-[var(--bg)]" : "chip"}>
    {en ? m.en : m.zh}</button>
))}</div>

// NPC chat: where an NPC reply line is produced/rendered (openNpcChat reply
// path), call once per line — the voice is derived from the NPC's name:
playNpcVoice(npcName, replyLine, en ? "en-US" : "zh-CN");
```

### S10 — sounds2 scene beds + karaoke language + ferry + mahjong (App.tsx)

```tsx
import { setKaraokeLang, playFerryHorn, type SceneSfxId } from "./sound";

// 1. Scene bed — in the music effect at App.tsx ~2009, before the setWorld call:
const sceneSfx: SceneSfxId | undefined =
  lifeAnim?.kind === "cook" ? "cooking"
  : lifeAnim?.kind === "gym" ? "gym"
  : lifeAnim?.kind === "sleep" ? "sleep"
  : venue3d?.set === "restaurant" ? "cooking"
  : venue3d?.set === "gym" ? "gym"
  : venue3d?.set === "clinic" ? "hospital"
  : undefined;
setWorld({ scene: sc, minute: tn, day: clock.d, month: clock.mo, place, travel, storm, karaoke: singing, sceneSfx });
// (add lifeAnim to that effect's dependency array so the bed switches with the beat.)

// 2. Karaoke room language toggle (near the karaoke UI):
<button type="button" onClick={() => setKaraokeLang("cn")}>国语 K 歌</button>
<button type="button" onClick={() => setKaraokeLang("en")}>English</button>

// 3. Ferry horn — where a ferry/boat departure is triggered:
playFerryHorn();

// 4. Mahjong — in the mahjong activity's tile-play path (activities.ts:246 / ACT_ANIM mahjong → gathering):
sfx("mahjong"); // synth knock until MAHJONG_SFX_FILE is set (see §5)
```

## Server endpoint needs (for area S)

- **None new for house building** — reuses existing `publishHome` / `getHome`.
- **None new for police** — player reports reuse existing `reportPlayer`; NPC landlord/employer reports reuse area (d)'s `fileBlackReport` (area S to land it per `report.ts`' `ReportTransport`).
- **None new for voices / sounds2 / controls / phone / venue sets** — all client-side.
- If area S wants a server-side record of patrols, that's a new ask — not required by this area; the watchers map is intentionally in-memory and visible, not persisted.

## Open questions / risks for the coordinator

1. `venueSet` doesn't exist in `data.ts` yet — snippet S1 works without it (type fallback), but the per-place interiors only become correct once area (b) adds the field or the type changes. The 4 misclassified beaches need a venueSet (or a wider beach regex) — type alone can't fix them.
2. `VENUE_TALK` entries for the 9 scenic sets (disney/tram/temple/miniature/farm/watershow/boardwalk/fishingport/bikehub) are given as a pattern, not full copy — the integration agent (or a copy pass) should write them from the ROAM_SPOTS ids, or the spots will show the interact button with no talk entry and `onSpot` will no-op.
3. The `runVenueTalk` fun/mood effects use hardcoded id lists (e.g. `["bench","stroll","photo","waves","shade","climb","view","wait"]` for fun) — new spot ids (buy/paint/frame/milk/pray…) get no fun/mood effect unless those lists are extended. Low priority, but the spots will feel dead without it.
4. Keyboard `Space`/`E` interact fires `onSpot(lastNear)` — in the home overlay (`flat` roam) `onSpot` maps to furniture use, which is also fine.
5. `faceSpecFor` skin palette changes a few existing NPCs' skin tones (previously all `0xf2c79b`); hair colour now varies too. Deliberate — distinct faces were the ask.
