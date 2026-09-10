# Pirate Booty — Greybox Start Plan

**Source GDD:** `docs/Pirate-Booty-GDD.md` (v1.1)
**New project:** `pirate-booty/` at the sdk7 workspace root
**First slice:** walkable primitive waterfront (boxes + cylinders) + a wallet-gated **GM panel**. No GLBs. No player-facing match rules yet — but **server already owns gameplay entities**.

---

## 1. GDD review (what we keep, what we lock, what we defer)

The GDD is already a shippable party-game spec. We do **not** rewrite it. We lock layout, ownership, and a GM console so we can load, view, and reset lanes without rewriting the scene.

### Keep as-is

- Hub → pick Dock N → 45–90s match → back to hub.
- Barrel Run is must-ship. Loot Storm / Last Seat get spaces now, rules later.
- One **Dock Run** kiosk + lane picker. Friends say “Dock 2”.
- Collapse unit = **whole row**, one slab collider, one kill volume under the lane.
- Mobile players: joystick + large Interact. No `IA_ACTION_3–6`. High VirtualCamera only on the lane they are viewing or playing. Admin flycam is the exception and is GM-only.

### Lock for greybox

| Tunable | Lock | Why |
|---------|------|-----|
| World size | **15 × 15 parcels (240 × 240 m)** | Room for 160 m docks + hub/pub/ship. Shrink later if needed. |
| Lane length | **10 parcels = 160 m** | Real race distance. Along **+X** (west → east). |
| Lane stack | **S → N** | Four piers in a north-south row. Lane 0 south, Lane 3 north. |
| Race axis | **Horizontal (+X)** | Each dock is a long east-west plank. |
| Row depth | **2 m** | 80 rows per **loaded** lane. One box per row. |
| Lane width | **16 m** (GDD) | One parcel wide on Z. |
| Lane gap | **1 parcel = 16 m** | Water between docks. |
| Dock height | **Y = 4 m** | Fall reads as death. Water at Y ≈ 0.1. |
| Barrel | **cylinder Ø 2.2 m, length 2.0 m** | Rolls along +X later. |
| Default load | **Lane 0 only** | 80 rows, not 320. GM can load one / all. |
| Auth SDK | Install **now** | Server creates and syncs gameplay. GM commands are server-validated. |
| GM access | Preview **or** wallet in `ADMINS` | Panel hidden from normal players. |
| Disconnect rule | Defer | Pick “end if < 2” when MatchSession lands. |

### Ownership

The auth server owns **gameplay**. Clients do not spawn rows, the barrel, obstacles, or volumes, and they do not decide when a row falls. The GM panel only **asks**; the server does the work.

| Layer | Who creates | Synced? |
|-------|-------------|---------|
| Static architecture (water, hub, pub, ship, inactive lane **shells**) | Both sides, same `buildStaticWorld()` | No. Deterministic, never moves. |
| Loaded-lane rows, barrel, obstacles, kill/finish | **`isServer()` only** | Yes. `syncEntity` on `Transform` (+ collider / tween later). |
| Row collapse / barrel motion | **Server tick** writes Transform (and disables collider) | Clients render the synced pose. |
| Load / unload / restart / reset coins | Server on `gm*` messages | After admin check. |
| View camera (Dock / Hub) | Client | Lane or hub VirtualCamera. No gameplay write. |
| Admin flycam | Client (admin / preview only) | Free VirtualCamera + `InputModifier` locks the avatar. WASD / space / shift / E F / 1 2 drive the cam. |

```ts
export function main() {
  buildStaticWorld()
  if (isServer()) {
    initGmHandlers()
    spawnLaneGameplay(0) // default: Dock 1 only
  } else {
    setupGmPanel() // hidden unless admin / preview
  }
}
```

Static architecture stays dual-built so the hub exists during the ~15 s production cold start. Gameplay meshes appear when the server is up.

### Other lanes stay empty until the GM loads them

80 rows × 4 = 320 row boxes. Default is **do not pay that**.

- Config reserves **4 lane slots** (origins, labels, 16 m gaps).
- **Unloaded lanes:** one deck-shell box + rails + `DOCK N` label. Walkable. No rows, barrel, obstacles, volumes.
- **Loaded lanes:** server spawns 80 row boxes, parked barrel, 3 placeholder gap-obstacles, start/finish, kill + finish.
- Default load: Lane 0. GM can load a specific dock, load all four, or unload.
- Lane 0’s shell has **no deck box** (rails + label only) so it never double-floors the server rows. Same rule for any lane once it is loaded: hide/disable that shell’s deck collider.

### What this first slice is *not*

- No player `joinLane` / MatchSession / live scoring.
- No collapse animation, no barrel motion.
- No player-facing splash / lane picker / HUD (GM panel only).
- No GLBs, textures, or audio.

The **GM panel is in this slice**. Load/view must work. Restart/reset/coins can be real server stubs (clear entities + Storage keys) even before a match exists.

---

## 2. Project shape

Single scene at `pirate-booty/`. Auth-server runs the same `src/` with `isServer()`.

```
pirate-booty/
  docs/
    Pirate-Booty-GDD.md
  images/
    scene-thumbnail.png
  src/
    index.ts
    config.ts                      # ADMINS[], lane meters, enum id ranges
    world/
      palette.ts
      primitives.ts
      layout.ts                    # S→N slots, +X race
      Water.ts
      HubPier.ts
      DockLanes.ts                 # shells on both sides
      Pub.ts
      ShipDeck.ts
      Props.ts
      cameras.ts                   # per-lane + hub + admin flycam entities
    games/
      barrel/
        LanePool.ts                # allocate / free gameplay for lane N or all
        Rows.ts
        Boulder.ts
        Obstacles.ts
      shared/
      seats/
      loot/
    net/
      messages.ts                  # registerMessages: gm* + later joinLane
      storage.ts                   # coins / crowns helpers (server)
      admins.ts                    # isAdmin(address), preview always true
    ui/
      GmPanel.tsx                  # React-ECS admin console
      AdminFlyCam.ts               # lock avatar; WASD / space / shift / E F / 1 2
    hub/
  package.json
  scene.json
  tsconfig.json
  .gitignore
  README.md
```

```bash
npm install @dcl/sdk@auth-server
npm install @dcl/js-runtime@auth-server
```

`scene.json`: `authoritativeMultiplayer: true`, `logsPermissions` = same admin wallets, 15×15 parcels, hub spawn.

`syncEntity` **only** inside `isServer()`. Stable ids, e.g. `ROW_BASE[lane] + rowIndex`, `BARREL_BASE + lane`.

---

## 3. World layout — stacked S→N, race east

Lanes sit **in a row from south to north**. Each lane is a **horizontal** 160 m dock. You run **west → east** (+X).

```
                         N (+Z = 240)

                    [SHIP DECK]
                    x 48–128, z 176–224

  L3  z 128–144   [================ 160 m ================]
      z 112–128    16 m water
  L2  z  96–112   [================ 160 m ================]
      z  80–96     16 m water
  L1  z  64–80    [================ 160 m ================]
      z  48–64     16 m water
  L0  z  32–48    [================ 160 m ================]
                   x 40 ──────── start          finish ──────── 200

  [HUB PIER]                         [THE PUB]
  x 8–40, z 32–144                   x 8–48, z 0–28
  (west of all four starts;          (south of hub)
   look east down the docks)

                         S (z = 0)
```

```
laneZ(i) = 32 + i * (16 + 16)   // L0=32, L1=64, L2=96, L3=128
laneX = 40 .. 200               // 160 m
```

| Zone | Origin (m) | Size (m) | Y |
|------|------------|----------|---|
| Water | (120, 0.08, 120) | 240 × 0.16 × 240 | visual void |
| Lane slots 0–3 | x 40–200, z as above | 160 × 16 each | deck Y=4 |
| Hub pier | x 8–40, z 32–144 | 32 × 112 | deck Y=4 |
| Pub | x 8–48, z 0–28 | 40 × 28 | floor Y=4 |
| Ship | x 48–128, z 176–224 | 80 × 48 | deck Y=5 |
| Spawn ring | hub ~ (24, 4.1, 88) | 4 pads | |
| Kiosk | hub, facing east | 1.4 × 2.2 × 0.4 | player-facing later |
| Scoreboard | hub east rail | 4 × 2.4 × 0.2 | |

**Lane local space:** parent at `(40, 4, laneZ(i))`. **+X is race direction.** Start at local x=2, finish at local x=158. Kill volume under that lane only (160 × 6 × 16).

Each lane also gets a **high VirtualCamera** entity (built on both sides, not synced): above mid-dock, looking down the +X run. Hub has a default “clear camera” (unset MainCamera). A separate **admin flycam** entity starts above the hub, looking east; it is only bound when the GM enables it.

---

## 4. Primitive kit

Unchanged in spirit: boxes = architecture + rows; cylinders = barrel, seats, posts, coins. Palette and helpers stay as previously locked.

**Server-only (per loaded lane):** 80 row boxes (2 × 0.35 × 16), barrel cylinder, 3 gap-obstacles, start/finish stripes, kill + finish triggers.

**Both sides:** water, hub, pub, ship, unloaded shells, labels, stools, mast, coins, lanterns, kiosk.

Helpers: `box`, `cylinder`, `triggerBox`, `label`. PBR albedo only. No textures.

---

## 5. GM panel

Dev / admin console. Not the player HUD. Large tap targets so it also works on a phone if an admin opens it.

### Who sees it

- Local preview: always (every preview window).
- Production: only if `PlayerIdentityData.address` is in `config.ADMINS` (same list as `scene.json` `logsPermissions`).
- Everyone else: no button, no panel, no `gm*` effect if they spoof a message.

### Where it lives

- Small **GM** button, bottom-left, safe-area padded.
- Opens a left dock (~320 px) with sections below.
- Panel itself is pointer / touch only. Admin flycam is the only place we bind `IA_ACTION_3–6` (keys 1 / 2), and only while that cam is on.

### Controls (this slice)

**Lanes**

| Control | Client sends | Server does |
|---------|--------------|-------------|
| Load Dock 1–4 (toggle) | `gmLoadLane { laneId, on }` | `LanePool.allocate(lane)` or `free(lane)` |
| Load all | `gmLoadAll` | allocate 0–3 |
| Unload all | `gmUnloadAll` | free 0–3 (hub/shells stay) |
| Status line | reads synced `LaneState` | `{ loaded: bool[4], phase[4] }` |

Default after boot: Dock 1 loaded, 2–4 unloaded. Toggles stay in sync via `LaneState` (one small server component, not 80 row payloads).

**View**

| Control | Who | Effect |
|---------|-----|--------|
| View Dock 1–4 | Client | `MainCamera` → that lane’s VirtualCamera. Exits flycam if it was on. |
| View Hub | Client | clear virtual camera (3rd person). Exits flycam. |
| **Admin Cam** (toggle) | Client, admin only | Bind flycam, lock avatar inputs, fly with the keys below. |
| Follow match | later | lane camera, only if that lane is live |

View does **not** require the lane to be loaded (you can look at an empty shell). If it is loaded, you see that dock’s rows/barrel.

### Admin flycam

One world-space `VirtualCamera` (`adminFlyCam`), not parented to a lane. Default pose: above the hub looking **east** down the docks (`~ (24, 28, 88)`, pitch ~25°).

**On enable**

1. `InputModifier` on `engine.PlayerEntity` with `disableAll: true` — avatar stops walking / jumping / camera-orbiting.
2. `MainCamera.virtualCameraEntity = adminFlyCam`.
3. Start a client system that reads held keys and writes the flycam `Transform`.

**On disable** (toggle off, or any View Dock / View Hub)

1. Remove `InputModifier` (or set all disables false).
2. Restore the previous view (hub 3rd person or last lane camera).
3. Stop the fly system.

**Keys (held = continuous)**

| Key | DCL action | Motion |
|-----|------------|--------|
| W A S D | `IA_FORWARD` / `LEFT` / `BACKWARD` / `RIGHT` | Move on the camera’s local XZ (W forward along look, not world +Z) |
| Space | `IA_JUMP` | Up (world +Y) |
| Shift | `IA_WALK` | Down (world −Y) |
| E / F | `IA_PRIMARY` / `IA_SECONDARY` | Tilt pitch (− / +) |
| 1 / 2 | `IA_ACTION_3` / `IA_ACTION_4` | Yaw rotate (left / right) |

Speeds in `config.ts` (tunable): move 16 m/s, vertical 10 m/s, pitch 50 deg/s, yaw 70 deg/s. Clamp pitch to about ±80° so we never flip.

`inputSystem.isPressed` still fires while `InputModifier.disableAll` is on — the modifier blocks the **avatar**, not the input bus. If preview ever swallows keys, fall back to only locking walk/jump and keep the same map.

Flycam is **client-local**. Other players still see the admin’s avatar frozen on the hub. No `syncEntity` on the cam. No `gm*` message required.

Player-facing gameplay still never binds 1–4 / `IA_ACTION_3–6`. This binding lives only inside `AdminFlyCam.ts` while the toggle is on.

**Session**

| Control | Client sends | Server does |
|---------|--------------|-------------|
| Restart lane N | `gmRestart { laneId }` | free + allocate that lane (fresh rows/barrel). Later: also reset match phase. |
| Restart all loaded | `gmRestartAll` | restart each loaded lane |
| Reset games | `gmResetGames` | unload all, clear in-memory sessions, reload default (lane 0) |

**Economy** (Storage; safe even before rewards exist)

| Control | Client sends | Server does |
|---------|--------------|-------------|
| Reset my coins | `gmResetCoins { scope: 'self' }` | `Storage.player.set(sender, 'coins', '0')` (+ crowns if present) |
| Reset player… | `gmResetCoins { scope: 'address', address }` | same for that wallet |
| Reset all coins | `gmResetCoins { scope: 'all' }` | wipe known player coin keys **or** set a `economyEpoch` the read path honors. Prefer epoch so we do not scan every wallet. Confirm button in UI. |

Show last Storage write ok/fail in the panel (`gmStorageResult` S→C).

### Messages (`net/messages.ts`)

```ts
gmLoadLane:    { laneId: Int, on: Boolean }
gmLoadAll:     {}
gmUnloadAll:   {}
gmRestart:     { laneId: Int }
gmRestartAll:  {}
gmResetGames:  {}
gmResetCoins:  { scope: String, address: Optional(String) } // 'self' | 'address' | 'all'
gmViewLane:    { laneId: Int }  // optional; view can stay client-only
gmStorageResult: { ok: Boolean, detail: String }
```

Server handler:

```
if (!isAdmin(context.from) && !isPreview) return
```

Never trust the client to spawn or delete rows.

### Synced admin state

Small component, one entity:

```ts
LaneState { loaded0..3: Boolean, phase0..3: String }
```

Server-only writes (`AUTH_SERVER_PEER_ID`). Panel radio/toggles bind to this so two GM windows stay consistent.

### Why this is in the first slice

Without it we cannot test “load all four” vs “one lane,” we cannot look down Dock 3 from the hub, and we cannot reset a broken greybox without reloading the preview. It is the development control surface for everything that follows.

---

## 6. Implementation steps

### Step 1 — Create `pirate-booty/`

- Directory at workspace root. Copy GDD → `docs/`.
- Scaffold from `blank-scene`.
- `scene.json`: **Pirate Booty**, 15×15, hub spawn, `logsPermissions` + `ADMINS` placeholder wallet.
- Install `@dcl/sdk@auth-server` + `@dcl/js-runtime@auth-server`.
- Stub GDD folders.

### Step 2 — Config, primitives, layout

- Meters as locked. `RACE_AXIS = 'x'`. `laneZ(i)`.
- `ADMINS: string[]`. Preview ⇒ treat as admin.

### Step 3 — Static world (both sides)

Water, hub, pub, ship, 4 shells + labels, hub props, **4 lane cameras + hub camera**. No `syncEntity`.

### Step 4 — Server lane pool + default load

- `LanePool.allocate(n)` / `free(n)` spawn or remove that lane’s 80 rows, barrel, obstacles, volumes and `syncEntity` them.
- Boot: `allocate(0)` only.
- `LaneState` entity synced.

### Step 5 — Messages + GM panel

- `registerMessages` in `net/messages.ts`.
- Server: admin-gated handlers for load / all / unload / restart / reset / coins.
- Client: `GmPanel.tsx` — lane toggles, view buttons, **Admin Cam** toggle, restart/reset, coin reset.
- View buttons switch lane/hub VirtualCamera locally.
- `AdminFlyCam.ts`: enable → lock avatar + fly keys; disable → unlock + restore last view.

### Step 6 — Walk + GM pass

- `npm start`, two preview windows if possible.
- Spawn hub, look east down four horizontal docks.
- Confirm only Dock 1 has rows.
- GM: View Dock 3 (empty shell). Load Dock 3. Confirm rows appear. Unload.
- Admin Cam on: avatar frozen, WASD flies, space/shift up-down, E/F tilt, 1/2 yaw. Fly the 160 m dock and the 16 m gaps. Toggle off → walk again.
- Load all. Fly the stack. Unload all. Reset games → Dock 1 only again.
- Reset my coins → Storage write ok (value `0`).

### Step 7 — Stop

No barrel motion or collapse yet. Next:

1. Server tick: barrel +X, collapse rows, kill/finish.
2. Player join + lane picker (still one session per loaded dock).
3. Coins/crowns on real results (GM reset already exists).
4. Loot Storm → Last Seat, each with GM restart hooks.

---

## 7. Entity budget

| Group | Count (approx) |
|-------|----------------|
| Water + foam | 2 |
| Shells + rails + labels ×4 | ~20 |
| One loaded lane (rows + barrel + obstacles) | **~90** |
| All four loaded (GM stress) | **~360** gameplay |
| Hub / pub / ship / cameras | ~55 |
| Pilings + lanterns | ~40 |
| **Default total** | **~210** |
| **GM load-all total** | **~480** |

Load-all is a GM stress switch, not the player default.

---

## 8. Key decisions

1. **15 × 15 World now.** Shrink after we see the empty water.
2. **Four docks in a S→N stack, each racing west → east.**
3. **160 m lanes, 2 m rows, 16 m gaps.**
4. **Auth server owns gameplay entities and all motion.** Clients render synced transforms. GM is an intent channel, not a spawner.
5. **Static architecture is dual-built, not synced.**
6. **Default: only Lane 0 is loaded.** GM can load one, several, or all.
7. **GM panel in slice 1.** Load / view / restart / reset coins. Hidden from non-admins.
8. **View is client camera only.** Does not load a lane by itself.
9. **Admin flycam locks the avatar** (`InputModifier.disableAll`) and flies with WASD, space/shift, E/F tilt, 1/2 yaw. Client-local. Keys 1/2 are GM-only.
10. **Coin reset uses Storage (or an economy epoch).** Confirm on “reset all.”
11. **Boxes = architecture + rows. Cylinders = barrel, seats, posts, coins.**
12. **Single scene + auth-server.** No Colyseus sidecar.

---

## 9. Success for this slice

- `pirate-booty/` previews on a 15×15 World with the local auth-server.
- Four docks sit in a south-to-north row and run horizontal (west → east).
- Hub is west of the starts; pub south; ship north.
- Default: only Dock 1 has server-synced rows and a barrel.
- GM panel visible in preview: load Dock N, load all, unload, view any dock camera, **Admin Cam fly**, restart, reset games, reset coins.
- Admin Cam freezes the avatar and flies with WASD / space / shift / E F / 1 2; turning it off restores walk.
- Non-admin clients (later) cannot open it and cannot make `gm*` stick.
- No GLB, no player HUD, no collapse/race logic yet.
