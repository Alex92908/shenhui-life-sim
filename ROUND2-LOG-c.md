# ROUND-2 LOG — area (c): pets / ambient life / community gameplay

Agent: area (c) · Date: 2026-11-11 · Branch: feature/round-2 (local only, never pushed)
Working copy: ~/workspace/shenhui-life-sim (no .git in this copy — `git status` reports
"not a git repository"; nothing was committed or pushed from here).

## Files created (only these two — no other file touched)

- `client/src/round2/pets.ts` (~470 lines) — pet system, data + logic only
- `client/src/round2/community.ts` (~560 lines) — community gameplay, data + logic only

## What was built

### 1. Pet system (`pets.ts`) — DONE

Design (per the Comnyang lesson): a pet is emotional attachment and retention,
not decoration. So the pet follows the player, waits at home, and greets them —
it is not a static prop.

- Adopt: cat/dog, from shelter (¥50–200), pet shop (¥800–5000), stray adoption
  (free, via community.ts trust), or gift. Name it, pick breed/colour/personality.
  Max 3 pets; one active follower at a time (switchable).
- Stats (all 0–100): mood / hunger / affection / energy / cleanliness.
  Daily decay + recovery; hunger < 25 drags mood and affection down.
- Interactions: feed (¥12), play, pet (stroke), wash (¥30), train. First 6
  interactions/day raise affection (anti-grind cap); after that, mood/hunger
  still change but affection doesn't. Train teaches named tricks (affection ≥ 25
  required to start teaching).
- Homecoming greeting: first return home each day triggers a greeting line whose
  warmth scales with bond level (stranger → friendly → close → family), +affection.
  No death/punishment mechanics — deliberately: the lying-flat dignity principle
  applies here too; a neglected pet gets sad, it doesn't die or punish the player.
- Follow logic (pure functions for MapView): `stepPetFollow()` — lag-follow with
  per-bond ideal distance (family 0.9 → stranger 2.2 units), teleport back if
  > 12 units away, pose follow/sit/play by mood. `petHomePose()` — sits inside
  the front door facing out, waiting. 3D model NOT implemented here (see hook below).
- Persistence: localStorage key `shenhui.pets.v1` (serialize/deserialize with
  validation); server sync shape `PetSyncPayload` (pets + activePetId +
  optional adoptedStrayId for the stray-adoption race).

### 2. Community gameplay (`community.ts`) — DONE, all four systems

All four are open-ended systems (free text, player-chosen locations), not
scripted paths. Shared rules: text length caps, locId + optional x/z pins,
server-side re-validation, expiry filtered on read (no cron needed).

- **Stray cats/dogs**: `StrayAnimal` (kind/appearance/temper friendly|shy|wary,
  trust 0–100, fedByCount). Feed once/day/player: +8/10/15 trust by temper,
  ¥5 food cost (client-side). Trust ≥ 70 → adoptable via `strayToAdoptInput()`
  into pets.ts. Trust ≥ 40 → animal starts approaching the player on the map.
  Trust decays 5/day unfed. Server spawns 3–6 per city from park/village/beach
  loc pools; adopted ones are replaced elsewhere after a few days.
- **Lost & found**: `LostFoundNotice` (lost-pet / lost-item / found-pet /
  found-item), title ≤ 30, body ≤ 200 free text, photo URL optional, 7-day TTL
  (author can extend lost-pet once), replies, claim by author only.
  Max 5 posts/player/day.
- **Snake sightings**: `SnakeReport` (species guess free text — "don't know" is
  a valid answer — description, photo optional), 3-day TTL, other players
  confirm ("I saw it too"); ≥ 2 confirmations = verified, shown bolder on map,
  and re-sighting extends expiry by 1 day. Max 3 reports/player/hour.
- **Fishing spots**: `FishingSpotReport` (catch description free text — "blanked
  but great view" counts — bait, notes, photo optional). Spots never expire but
  go stale after 30 days without confirmation (sorted last); confirming
  re-activates. Duplicate spots within ~100 m are refused server-side with a
  pointer to the existing spot. Max 5/player/day.
- `toMapMarkers()` aggregates all four into map markers for MapView
  (emoji + label, snake warnings visually distinct, stale fishing spots included
  but deprioritised).

## Typecheck

- `cd standalone && npx tsc --noEmit -p tsconfig.json`:
  - First run: 1 error, my own (`community.ts` unused `gameDay` param) — fixed.
  - Final run: **0 errors in `round2/pets.ts` and `round2/community.ts`**.
  - Final confirmation run (grep for `round2/(pets|community)`): **empty — 0 errors
    in my files**. Total repo-wide error count at that moment: 11, all in other
    agents' in-progress files (count grew from 8 → 11 between runs as other
    agents kept editing; none in pets.ts/community.ts).
- `npm run build` was NOT run (per task: integration agent owns the build).

## Integration snippets (for the integration agent — App.tsx / MapView.tsx)

### Pet 3D model hook (MapView.tsx; area a's character-builder patterns reusable)

- One low-poly cat and one low-poly dog: body (rounded box/capsule) + head
  (sphere) + ears (cat: triangles; dog: floppy) + curved tail (wags while
  following) + four short legs. Colour from `pet.color`; cat ~0.55 high,
  dog ~0.7 high (player ~1.7). Poses: follow = leg swing + tail wag;
  sit = upright, tail curled at side; sleep = lying down; play = small hops.
- Reuse the LifeStage.tsx character-builder approach (primitive-geometry
  assembly, no new .glb needed) or an existing animal model under
  `client/public/models/` if one fits.
- Per-frame: `petRuntimeRef.current = stepPetFollow(activePet, petRuntimeRef.current,
  playerPos, playerHeading, dt)`, then set the pet mesh position/rotation.
  When the player is home (locId === "home" or indoors), use
  `petHomePose(homeDoorPos, doorHeading)` and pose "sit" at the door.
  No pets (`pets.pets.length === 0`) → render no pet mesh.

### App.tsx — pet state + daily tick + homecoming

```ts
import { adoptPet, interactWithPet, homecomingGreeting, tickPetDay,
         PET_STORAGE_KEY, serializePets, deserializePets, type PetsState }
  from "./round2/pets";
const [pets, setPets] = useState<PetsState>(() =>
  deserializePets(localStorage.getItem(PET_STORAGE_KEY)));
useEffect(() => { localStorage.setItem(PET_STORAGE_KEY, serializePets(pets)); }, [pets]);
// Adopt: void api.syncPets({ playerId, pets: pets.pets, activePetId, adoptedStrayId })
// Daily settlement: pets.pets.forEach((p) => tickPetDay(p, gameDay))
// On arriving home: const greet = homecomingGreeting(pets); if (greet) toast(greet.text)
// Panel buttons: feed/play/pet/wash → interactWithPet(pets, pet.id, kind)
//   (check player money >= returned cost before applying; train → trainTrick(pets, pet.id, trickName, gameDay))
```

### App.tsx — community queries (alongside getGigs/getParties)

```ts
import { buildNotice, buildSnakeReport, buildFishingSpotReport,
         feedStrayLocal, strayToAdoptInput, toMapMarkers, validateNotice,
         validateSnakeReport, validateFishingSpot, type StrayAnimal,
         type LostFoundNotice, type SnakeReport, type FishingSpotReport }
  from "./round2/community";
const straysQuery = useQuery({ queryKey: ["strays", cityKey],
  queryFn: () => api.getStrays({ cityKey, playerId }), enabled: phase === "game" });
const noticesQuery = useQuery({ queryKey: ["notices", cityKey],
  queryFn: () => api.getNotices({ cityKey, playerId }), refetchInterval: 120_000 });
const snakesQuery = useQuery({ queryKey: ["snakes", cityKey],
  queryFn: () => api.getSnakeWarnings({ cityKey, playerId }), refetchInterval: 120_000 });
const fishingQuery = useQuery({ queryKey: ["fishing", cityKey],
  queryFn: () => api.getFishingSpots({ cityKey, playerId }), refetchInterval: 300_000 });
```

### App.tsx — feed stray / adopt / post (submit handlers)

```ts
// Feed: const feed = feedStrayLocal(stray); // optimistic note
//   void api.feedStray({ playerId, strayId: stray.id, gameDay }).then((r) => {
//     if (!r.ok) toast(r.error); else straysQuery.refetch(); // server trust wins
//   });
// Adopt (trust >= 70): const input = strayToAdoptInput(stray, petName, gameDay);
//   if (input) { const r = adoptPet(pets, input); /* then api.syncPets with adoptedStrayId */ }
// Post: if (!validateNotice(form).ok) return toast(...); void api.postNotice({ playerId, ...form });
// Snake: validateSnakeReport → api.reportSnake; fishing: validateFishingSpot → api.reportFishingSpot
// Photos: use the existing image upload if one exists; otherwise photoUrl: null (text-only is fine).
```

### MapView.tsx — community markers (near the player/NPC marker layer)

```ts
const markers = toMapMarkers({ strays, notices, snakes, fishingSpots, cityKey });
// One emoji sprite + text label per marker; click → onMarkerClick(marker) opens detail panel.
// Snake markers get a red outline / "!" style, distinct from normal markers.
// Stray with trust >= 40 shows a small "它好像想靠近你" hint beside the marker.
```

## Server endpoint spec (for area S — implement in server/src/actions.ts + schema.ts)

Conventions: every endpoint first checks the player exists and is not banned
(`banned` → `{ ok: false, error: BANNED_MSG }`); text limits mirror
`TEXT_LIMITS` in community.ts and are re-validated server-side; content
moderation reuses the existing reportPlayer + admin system (no new one).
Shared write rate-limit: ≤ 10 writes/player/minute across these endpoints,
over → "操作太快了, 歇会儿再来".

| # | Endpoint | Args | Returns / behaviour |
|---|----------|------|---------------------|
| 1 | `getStrays` | `{ cityKey, playerId }` | `{ strays: StrayAnimal[] }` — this city only, not adopted. Server spawns/keeps 3–6 per city from park/village/beach loc pools; adopted ones replaced elsewhere after a few days. Table `strays`: id, kind, appearance, temper, city, loc_id, loc_name, x, z, trust, last_fed_day, first_seen_day, adopted, fed_by_count, created_at. |
| 2 | `feedStray` | `{ playerId, strayId, gameDay }` | `{ ok, trust?, note?, error? }` — once/day/player/stray (table `stray_feeds`, unique stray_id+player_id+day). trust += temper gain (friendly 15 / shy 10 / wary 8), cap 100. fed_by_count dedup-counted. Money (¥5) stays client-side. |
| 3 | `adoptStray` | `{ playerId, strayId, petName, gameDay }` | `{ ok, error? }` — requires trust ≥ 70 and not adopted. Concurrency guard: update `where adopted = 0`; 0 rows affected → "已经被收养了". |
| 4 | `syncPets` | `{ playerId, pets, activePetId, adoptedStrayId? }` | `{ ok }` — store as `players.pet_json` (TEXT/JSON) or a new `pets` table. Personal asset; sync is for device-switch + leaderboard flavour. `adoptedStrayId` runs the same marking logic as `adoptStray`. Shape: `PetSyncPayload` in pets.ts. |
| 5 | `postNotice` | `{ playerId, kind, cityKey, title, body, locId, locName, x?, z?, photoUrl? }` | `{ ok, noticeId?, error? }` — max 5/player/day; TTL 7 days (`expires_at`). Table `notices` (+ `notices_replies` or replies JSON): status open/claimed/expired. |
| 6 | `getNotices` | `{ cityKey, playerId }` | `{ notices: LostFoundNotice[] }` — this city, open, unexpired (filter in the query, no cron); newest first, max 50. |
| 7 | `replyNotice` | `{ playerId, noticeId, text }` | `{ ok, reply?, error? }` — notice must be open; text ≤ 200 chars. |
| 8 | `claimNotice` | `{ playerId, noticeId }` | `{ ok, error? }` — author only (or admin). |
| 9 | `reportSnake` | `{ playerId, cityKey, locId, locName, x?, z?, speciesGuess, description, photoUrl? }` | `{ ok, reportId?, error? }` — max 3/player/hour; TTL 3 days. Table `snake_reports` (+ confirmations). Reporter shown by name only. |
| 10 | `getSnakeWarnings` | `{ cityKey, playerId }` | `{ warnings: SnakeReport[] }` — this city, unexpired, most-confirmed first. |
| 11 | `confirmSnake` | `{ playerId, reportId }` | `{ ok, confirmations?, error? }` — once per player per report (unique key in `snake_confirms`); confirmations +1 and `expires_at` +1 day. |
| 12 | `reportFishingSpot` | `{ playerId, cityKey, locId, locName, x?, z?, catchDesc, bait?, notes?, photoUrl? }` | `{ ok, spotId?, error? }` — if a spot exists within ~100 m, return it as `existingSpotId` and refuse the duplicate ("这里已有钓点, 去确认它吧"); max 5/player/day. Table `fishing_spots` (+ confirmations, last_confirmed_at). |
| 13 | `getFishingSpots` | `{ cityKey, playerId }` | `{ spots: FishingSpotReport[] }` — this city, all incl. stale (client sorts); max 100. |
| 14 | `confirmFishingSpot` | `{ playerId, spotId }` | `{ ok, confirmations?, error? }` — once per player per spot; confirmations +1, `last_confirmed_at = now` (re-activates stale spots). |

## Blocked / not done

- **3D pet model**: intentionally not built here — hook + spec documented above
  for the integration / area (a) agent. Needs a low-poly cat/dog following the
  character-builder pattern; no .glb required.
- **Live birds / insects / swimming fish rendering**: owned by area (a)
  (MapView.tsx) — out of scope for this module by design; nothing in pets.ts
  or community.ts depends on it.
- **Photo upload**: community.ts accepts a `photoUrl`; if the game has no image
  upload path yet, notices/reports work text-only (photo optional by design).
  No upload endpoint spec'd — flag for area S / integration if lee wants photos.
- **Server endpoints**: spec'd above, not implemented (area S owns server/).
- **No changes were needed in App.tsx / MapView.tsx / data.ts / LifeStage.tsx /
  server/** — all integration is via the snippets above.
