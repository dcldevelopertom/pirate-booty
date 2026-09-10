# Pirate Booty — Game Design Document

**Version:** 1.1  
**Platform:** Decentraland World · SDK 7 · Auth Server (`@dcl/sdk@auth-server`)  
**Target:** Decentraland Mobile · Friendzone Mobile Buildathon  
**Genre:** Multiplayer party minigames  
**Max players per match:** 4  

---

## 1. Vision

A compact pirate waterfront where players hang at a **Hub Pier**, then join short party rounds with friends.

| Game | Location | One-line loop |
|------|----------|----------------|
| **Barrel Run** | 4 elevated dock lanes | Straight race; rolling barrel collapses floor rows; fall = out; finish = win |
| **Last Seat** | The Pub | Musical chairs; one fewer seat when the pulse stops |
| **Loot Storm** | Ship deck | 45s coin scramble; most coins wins |

**Core loop:** Hub → pick dock / room → 45–90s match → back to hub → coins & crowns update → again.

**Tone:** Easy to play, high rematch, social first. No escape puzzles, no precision parkour.

---

## 2. World Layout — Pirate Booty

```
                 [SHIP DECK]
                 Loot Storm
                      |
   [DOCK LANES] — [HUB PIER] — [THE PUB]
   Barrel Run x4   board/crown   Last Seat
                   hangout
```

| Zone | Role |
|------|------|
| **Hub Pier** | Spawn, splash dismiss, scoreboard, Lobby Champ crown, single **Dock Run** kiosk, entrances to Pub & Ship |
| **Dock Lanes 0–3** | Four parallel straight elevated docks (real play spaces) |
| **The Pub** | Indoor/covered musical chairs |
| **Ship Deck** | Docked ship stage for Loot Storm |

**Art language:** wood, rope, lanterns, dusk gold, water as death void under docks. One material atlas where possible.

**Travel:** Short walks or soft teleport into match start pads. Whole waterfront readable as one place.

---

## 3. Barrel Run (Game 1) — Detailed

### 3.1 Space

- **4 physical lanes** (Lane 0–3), always present in the scene
- Each lane: **16m wide**, long straight flat dock, no curves, no elevation changes
- Ground reads as **voxel / plank rows**
- Elevated over water; fall = out

### 3.2 Core rules

1. Players spawn on that lane’s **start line**
2. Countdown → **barrel** starts behind the pack and moves forward (server-synced)
3. As barrel advances, **entire floor rows collapse** (collider off + fall anim)
4. Player enters **kill volume** under the track → **out** (spectate until round ends)
5. Cross **finish volume** while alive → placement / score
6. Round ends → results → teleport to hub

**Sign copy:** *Run. Don’t get crushed. First to the end wins.*

### 3.3 Row collapse (performance-critical)

| Rule | Implementation |
|------|----------------|
| Collapse unit | **Whole row** (full 16m width × 2–4m depth), not per-cube physics |
| Collision | Each row has **mesh collider(s)** or one slab collider while solid |
| On collapse | Disable row collider → animate row mesh falling → players lose floor |
| Out detect | **One large trigger volume** under the entire lane; enter = out |
| Visual | Row *looks* like many voxels; collision can be one box per row |

### 3.4 Procedural obstacles (per lane / per session)

Obstacles are **blockers with wide gaps** (path choice, not precision jumps).

**Server-authoritative seed** when a session starts on a lane:

```ts
session.seed = randomUint32()
// Deterministic layout from seed — all clients in session compute the same gaps
obstacleLayout = generateObstacles(session.seed, laneConfig)
```

**Generation rules:**

| Parameter | Value |
|-----------|--------|
| Obstacle count | 3–5 blocker segments along the lane |
| Gap style | Left gap / right gap / center gap (wide enough for thumbstick) |
| No | Tight mazes, jumps, elevation, moving obstacles v1 |
| Sync | Server stores `seed` on session; clients build matching obstacle colliders/meshes for that lane only |

Optional: re-roll seed each match so Dock 2 is never the same layout twice.

### 3.5 Multi-lane matchmaking

**Hub:** single **Dock Run** kiosk (not four mock docks).

**UI — lane picker** (so friends can meet):

| Dock | Example status |
|------|----------------|
| Dock 1 | Open · 0/4 |
| Dock 2 | Filling · 2/4 |
| Dock 3 | Live · in progress |
| Dock 4 | Open · 1/4 |

- Player selects **Dock N** → `joinQueue({ game: 'barrel', laneId: N })`
- Server rejects if full or mid-race (“Wait / Spectate”)
- Friends coordinate: *“Dock 2”*

**Optional later:** Quick Join = fullest open dock. Not required for v1.

### 3.6 Per-lane camera & sync

| System | Behavior |
|--------|----------|
| **VirtualCamera** | Each lane has a high-angle (isometric-style) camera entity. On match start, client sets `MainCamera` to **that lane’s** camera only |
| **Barrel + rows** | Simulated and `syncEntity`’d **per session / lane** |
| **On match end** | Clear virtual camera → default 3rd person; teleport to hub |

Players in other lanes may still be *visible* as avatars in the World; game state (barrel, collapses, scoring) is isolated per session.

### 3.7 Capacity

- 4 lanes × 4 players = **16** concurrent Barrel runners max
- Match starts at **2–4** players (configurable timeout if ≥2)

---

## 4. Last Seat (Game 2)

- Location: **The Pub**
- 2–4 players
- Seats = barrels / stools (claim volumes)
- Pulse / music plays → when it stops, **one fewer seat than living players**
- Fail to claim a seat → out
- Last remaining (or last elimination standing rules TBD) scores
- Mute-friendly: big visual pulse, no voice required

**v1:** one pub stage; queue if busy.

---

## 5. Loot Storm (Game 3)

- Location: **Ship deck** (docked set, not a sail-able vehicle)
- 2–4 players
- **45s** timer; coins / bottles spawn on deck
- Collect via walk-in or Interact
- Cap concurrent pickups (~12–15 live entities); recycle
- Most coins at timer end wins
- Mid-match counts live on **server session memory**; flush to Storage at results only

**v1:** one ship stage; queue if busy.

---

## 6. Economy — Coins & Crowns

**Authority:** Auth Server only. Clients never trust local balances.

| Storage | Key | Scope | Purpose |
|---------|-----|--------|---------|
| Player | `coins` | Per wallet | Spendable / lifetime balance |
| Player | `crowns` | Per wallet | Match wins |
| Player | `stats` | Per wallet | Optional `{ barrel, seats, loot }` wins |
| World | `leaderboard` | Shared | Top crowns / coins for hub board |

**Write policy:**

- Checkpoint at **match end** and safe disconnect
- Do **not** `Storage.set` on every Loot Storm pickup (session RAM → one flush)
- Max **40 in-flight** host calls — batch carefully

```ts
if (isServer() && matchOver) {
  const prev = parseInt(Storage.player.get(address, 'coins') ?? '0', 10)
  Storage.player.set(address, 'coins', String(prev + reward))
}
```

**Rewards (tunable):**

| Placement | Coins (example) |
|-----------|-----------------|
| 1st | 25 |
| 2nd | 15 |
| 3rd | 10 |
| 4th / participated | 5 |

---

## 7. Auth Server & Networking

### Install

```bash
npm install @dcl/sdk@auth-server
npm install @dcl/js-runtime@auth-server
```

### scene.json

```json
{
  "authoritativeMultiplayer": true,
  "serverLogWallets": ["0xYOUR_WALLET"]
}
```

### Rules

- `isServer()` guards match logic, scoring, Storage, procedural seed
- **Only server** calls `syncEntity`
- Clients send **intents** via `registerMessages`
- Server validates (membership, phase, lane capacity, proximity where needed)

### Example messages

| Message | Direction | Payload (sketch) |
|---------|-----------|------------------|
| `joinLane` | C→S | `{ game, laneId }` |
| `leaveQueue` | C→S | `{ game, laneId }` |
| `sessionState` | S→C | `{ sessionId, laneId, phase, players }` |
| `barrelTick` / entity sync | S→C | via `syncEntity` on lane entities |
| `matchResults` | S→C | `{ placements, coinDelta, crowns }` |

---

## 8. Modular code structure

```
src/
  index.ts
  config.ts
  hub/
    Hub.ts
    Spawn.ts
    DockKiosk.ts          // single sign → lane picker UI
  games/
    shared/
      MatchSession.ts     // create/join/leave, max 4, phase machine
      Score.ts
      MobileUI.ts
    barrel/
      BarrelRun.ts
      LanePool.ts         // 4 lanes, allocate/free
      Rows.ts             // colliders, collapse
      Boulder.ts          // barrel motion
      Obstacles.ts        // procedural layout from seed
    seats/
      LastSeat.ts
    loot/
      LootStorm.ts
  net/
    messages.ts
    storage.ts
  ui/
    Splash.ts
    LanePickerUI.ts
    Hud.ts
```

**Minigame interface (shared):**

```ts
interface Minigame {
  id: 'barrel' | 'seats' | 'loot'
  maxPlayers: 4
  onSessionStart(session: Session): void
  onTick(session: Session, dt: number): void
  onPlayerOut(session: Session, address: string): void
  onSessionEnd(session: Session): Results
}
```

Hub routes only; games do not own hub UI.

---

## 9. Player lifecycle

### Splash
- Shown on first entry (billboard or full UI)
- Title, three game icons, short controls hint
- Dismiss → hub

### Spawn
- `movePlayerTo` **hub center** on join and after every match
- Circle of spawn pads to reduce stacking

### Disconnect mid-match
- Remove from session
- If players < 2: end match early or finish with remaining (pick one rule and keep it)
- Persist any earned rewards for finished placements only

---

## 10. Mobile optimization

| Area | Rule |
|------|------|
| Input | Joystick + large Interact; avoid IA_ACTION_3–6 |
| UI | Safe-area aware; lane picker big taps; prefer world signs |
| Barrel camera | High VirtualCamera **per active lane only** |
| Entities | Row collapse groups; orb cap; shared meshes across 4 lanes |
| Audio | Start / out / win / coin stingers + light ambient |
| Test | Official Decentraland Mobile app, mid-range Android |

---

## 11. Empty World & spectate

- Hub always looks alive (lanterns, signs, practice tip)
- Optional: solo practice on empty lane (no coins)
- Eliminated players spectate their lane until results
- Hub railing can overlook dock lanes

---

## 12. Scope & cut order

**Must ship**

- Hub + splash + spawn
- Auth server + MatchSession
- Barrel Run × 4 lanes + procedural obstacles + lane picker UI
- Coins / crowns Storage + hub board
- Mobile pass

**Should ship**

- Loot Storm
- Last Seat

**Cut if late**

1. Last Seat  
2. Second polish pass on Loot  
3. Reduce to 2 lanes if entity budget hurts (prefer keep 4 with simpler art)

---

## 13. Build order

| Days | Focus |
|------|--------|
| 1–2 | Auth scaffold, hub spawn, splash, folder modularity |
| 3–7 | Barrel Run **one lane** end-to-end (rows, barrel, kill volume, finish) |
| 8–9 | Lane pool ×4, procedural obstacles from seed, lane picker UI |
| 10–11 | Coins/crowns Storage, hub leaderboard |
| 12–14 | Loot Storm |
| 15–16 | Last Seat |
| 17–19 | Juice, audio, empty-world, mobile UI |
| 20–21 | Bug bash, ship |

---

## 14. Success criteria (Friendzone)

- Understandable in **10 seconds**
- Friends can meet on **Dock 2** deliberately
- A match is fun in **under 90 seconds**
- “One more” is one kiosk interact away
- Stable on **Decentraland Mobile**
- Coins/crowns survive refresh (Auth Storage)

---

## 15. Open tunables

- Exact lane length (suggest ~40–64m)
- Barrel speed curve
- Min players to start (2 vs wait for 4)
- Countdown duration
- Coin reward table
- Obstacle count range (3–5)

---

*End of GDD v1.1 — Pirate Booty*
