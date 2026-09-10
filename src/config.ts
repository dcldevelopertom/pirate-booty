export const PARCEL = 16
export const WORLD_PARCELS = 30
export const WORLD_SIZE = PARCEL * WORLD_PARCELS

/** Southwest corner of the dock block, in parcels. Ground plane is XZ — height stays DECK_Y. */
export const DECK_PARCEL = { x: 9, z: 10 }
export const DECK_ORIGIN = {
  x: DECK_PARCEL.x * PARCEL,
  z: DECK_PARCEL.z * PARCEL - 10
}

export const DECK_Y = 34
export const WATER_Y = 32
export const GROUND_Y = 0

/** Wallets that see the GM panel and can send gm* messages in production. Preview is always admin. */
export const ADMINS: string[] = ['0xb1fc0f25cfd8663984f3456de6551e25d0d714c0']

export const LANE = {
  count: 4,
  width: 10,
  length: 15 * PARCEL,
  gap: 2 * PARCEL,
  x0: DECK_ORIGIN.x + PARCEL,
  z0: DECK_ORIGIN.z,
  rowDepth: 2,
  rowCount: (15 * PARCEL) / 2,
  cellsPerRow: 10,
  finishPad: PARCEL,
  rowHeight: 2,
  rowModel: 'assets/models/dock-row.glb',
  defaultLoaded: -1,
  /** World meters the box collider sits below original deck center. */
  colliderDrop: 3,
  /** Extra meters to raise walk boxes so they meet the GLB deck surface. */
  colliderLift: 0.5,
  /** World meters the GLB sits below the collider center. */
  sliverDrop: 0.7,
  /** Extra meters on each Z side of the under-deck kill trigger. */
  killZPad: 20
}

export const HUB = {
  sx: 20,
  sz: 20,
  x0: DECK_ORIGIN.x - 20,
  /** Centered on the single dock's Z. */
  z0: DECK_ORIGIN.z + LANE.width / 2 - 10,
  y: DECK_Y - 1.7,
  model: 'assets/models/hub.glb'
}

/** Center spawn on the 20x20 hub. Keep in sync with scene.json spawnPoints. */
export const HUB_SPAWN = {
  xMin: HUB.x0 + 6,
  xMax: HUB.x0 + HUB.sx - 6,
  y: HUB.y + 12,
  zMin: HUB.z0 + 6,
  zMax: HUB.z0 + HUB.sz - 6,
  lookX: HUB.x0 + HUB.sx + 40,
  lookY: HUB.y + 2,
  lookZ: HUB.z0 + HUB.sz / 2
}

export const SPLASH_SECONDS = 5
export const SPLASH_IMAGE = 'images/splash.jpg'

/** Cap'n by the leaderboard. Offset from hub center. */
export const CAPN = { dx: 5.4, dy: 0.5, dz: -3.2, yaw: -90 }

/** Tutorial VC — in front of the Cap'n (he faces west), looking east at him + the board. */
export const TUTORIAL_CAM = {
  dx: 1.6,
  dy: 2.2,
  dz: -2.5,
  pitch: 6,
  yaw: 90
}

export const MATCH = {
  loadSeconds: 2,
  countdown: 5,
  maxPlayers: 4,
  /** Hub lobby wait after min players, before teleport. */
  lobbySeconds: 10
}

export const DROWN = {
  waitSeconds: 5,
  triggerSize: 50,
  triggerHeight: 30
}

/** Server pose checks. Movement is still client-simulated — this is a net, not a lock. */
export const ANTI = {
  maxMps: 14,
  poseMinDt: 0.08,
  laneSlack: 2,
  maxStrikes: 3,
  /** Fastest legal finish: start pad to finish line at maxMps. */
  finishSlack: 0.85
}

export const PUB = {
  x0: HUB.x0,
  z0: HUB.z0 - 2 * PARCEL,
  sx: 40,
  sz: 28,
  wallH: 5
}

export const SHIP = {
  x0: DECK_ORIGIN.x + 8,
  z0: DECK_ORIGIN.z + LANE.width + 2 * PARCEL,
  sx: 80,
  sz: 48,
  deckY: 15
}

/** 2x2 island on the west scene edge. Starts/chests on the west, run east. */
export const LOOT = {
  size: 2 * PARCEL - 5,
  x0: 5 * PARCEL,
  z0: HUB.z0 + HUB.sz - 13 + PARCEL,
  y: WATER_Y,
  seconds: 60,
  coinCount: 12,
  coinLifeMin: 8,
  coinLifeMax: 16,
  startZ: 2.2,
  chestZ: 5.6,
  model: 'assets/models/gold-treasure.glb',
  wreck: 'assets/models/wrecked-ship.glb',
  shark: 'assets/models/shark.glb',
  sharkEvery: 3,
  sharkMps: 2.4,
  sharkWest: 16,
  sharkBiteRange: 3.6,
  sharkHold: 2.4,
  sharkPack: 3
}

export const BARREL = {
  radius: 1.1,
  height: 1.0,
  startX: 0.5,
  rollSpeed: 420
}

export const RACE = {
  /** How fast the barrel walks the lane (~27 s at 7.92 over 240 m). */
  barrelMps: 7.92,
  fallMps: 8.1,
  finishLocalX: 15 * PARCEL - 4,
  /** Seconds after GO before the first sliver drops. */
  startHold: 1
}

export const OBSTACLE = {
  countMin: 40,
  countMax: 64,
  clearStart: 8,
  clearFinish: 8,
  minGapCells: 1,
  barrel: 'assets/models/obstacle-barrel.glb',
  crate: 'assets/models/obstacle-crate.glb'
}

export const FLYCAM = {
  moveMps: 16,
  verticalMps: 10,
  pitchDegPs: 50,
  yawDegPs: 70,
  pitchMin: -80,
  pitchMax: 80,
  start: {
    x: 125.37,
    y: 38.8,
    z: 143.59,
    pitch: 31.75,
    yaw: 38.29
  }
}

export const LANE_CAM = {
  height: 10,
  south: 8,
  follow: 6
}

export const PLAYER_CAM = {
  height: 10,
  south: 8,
  follow: 8
}

/** Fixed hub shot. Same world pose as fly cam. */
export const HUB_CAM = {
  x: 125.37,
  y: 38.8,
  z: 143.59,
  pitch: 31.75,
  yaw: 38.29
}

/** Fixed Booty Loot shot. Fly-cam pose over the west island. */
export const LOOT_CAM = {
  x: 103.53,
  y: 46.45,
  z: 180.44,
  pitch: 62.3,
  yaw: -89.46
}

/** Fishing pier — angled toward the hub, in front of FISH_VIEW. x0/z0 are the pier center. */
export const FISH = {
  slots: 30,
  slotGap: 2,
  yaw: 0,
  x0: 134,
  z0: 122,
  y: DECK_Y + LANE.rowHeight / 2 - LANE.colliderDrop + LANE.colliderLift,
  fightSeconds: 10,
  fishCount: 44,
  lineMin: 0.7,
  lineMax: WATER_Y - GROUND_Y - 0.8,
  lineSpeed: 7,
  depthMin: 1.5,
  depthMax: WATER_Y - GROUND_Y - 0.8,
  catchSeconds: 5,
  snagRange: 2.4,
  snagLock: 0.8
}

/** Overhead pick-cam — top-down over the pier so all 30 holes read. */
export const FISH_CAM = {
  x: 134,
  y: 59,
  z: 122,
  pitch: 82,
  yaw: 0
}

/** Underwater fishing cam. dx/dz are from the selected hole. */
export const FISH_VIEW = {
  y: 31.18,
  pitch: 13.2,
  yaw: 0.07,
  dx: 1.41,
  dz: -28.78
}

/** Cannon Fodder — shoot sailing ships from the parked corsair. */
export const CANNON_CAM = {
  x: 139.56,
  y: 39.07,
  z: 171.56,
  pitch: 31.75,
  yaw: 2.03,
  slotSpread: 3.4
}

export const CANNON = {
  seconds: 90,
  barrel: 'assets/models/cannon-barrel.glb',
  harness: 'assets/models/cannon-harness.glb',
  cooldown: 1,
  muzzle: 32,
  gravity: 18,
  shipEvery: 0.7,
  shipMax: 12,
  /** How many hulls are already in view when GO fires. */
  shipOpen: 2,
  shipSpeedMin: 0.8,
  shipSpeedMax: 3.5,
  hitRadius: 2.8,
  /** Local corsair hull (bottom half of the mesh). */
  hitBox: { x: 1.0, y: 0.39, z: 0.56 },
  hitBoxY: -0.195,
  ballRadius: 0.38,
  pitchMin: -2,
  pitchMax: 52,
  yawMin: -32,
  yawMax: 32,
  pitchStart: 22,
  hullBottom: 0.39063,
  model: 'assets/models/corsair-pride.glb'
}

/** Stable syncEntity ids. Server only. Barrel/volume ids increment so free+allocate never collides. */
let nextPlaySync = 3000

export function takePlaySync(): number {
  nextPlaySync += 1
  return nextPlaySync
}

export const SYNC_ID = {
  LANE_STATE: 1,
  GAME_BOARD: 2,
  row: (lane: number, i: number) => 10000 + lane * 300 + i,
  barrel: (lane: number) => 2000 + lane,
  obstacle: (lane: number, i: number) => 40000 + lane * 50 + i,
  kill: (lane: number) => 2200 + lane,
  finish: (lane: number) => 2210 + lane,
  startStripe: (lane: number) => 2220 + lane,
  finishStripe: (lane: number) => 2230 + lane
}
