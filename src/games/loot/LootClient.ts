import {
  AvatarAnchorPointType,
  AvatarAttach,
  Billboard,
  Entity,
  Material,
  MaterialTransparencyMode,
  MeshRenderer,
  PlayerIdentityData,
  TextAlignMode,
  TextShape,
  Transform,
  TriggerArea,
  Tween,
  engine,
  triggerAreaEventsSystem
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import { HUB_SPAWN, LOOT, MATCH, WATER_Y } from '../../config'
import { room } from '../../net/messages'
import { lockAllInputs, unlockToGameplay } from '../../ui/inputLocks'
import { isClientBusy, setClientBusy } from '../shared/ClientBusy'
import { startDockAmbience, stopHubAmbience } from '../../world/Audio'
import { viewHub, viewLoot } from '../../world/cameras'
import { setHubGlbsVisible } from '../../world/HubHide'
import { setLootHideExcludes } from '../../world/LootHide'
import { hideLootGlbsAfterMatch, lootChestPos, lootStart, showLootGlbsForMatch } from '../../world/LootArena'
import { playWaterSplash } from '../../world/WaterSplash'
import { clearLootShark, setupLootShark } from './LootShark'
import { PALETTE } from '../../world/palette'

export type LootStage = 'idle' | 'lobby' | 'loading' | 'countdown' | 'playing' | 'results'

type CoinVis = { id: number; entity: Entity }

type ResultRow = { name: string; place: number; state: string; coins: number }

let stage: LootStage = 'idle'
let slot = 0
let mySlot = 0
let lobbyGame = 0
let lobbyCount = 0
let lobbyMax = MATCH.maxPlayers
let lobbyMin = 1
let lobbyTimer = 0
let count = MATCH.countdown
let remain = LOOT.seconds
let held = 0
let stashed = 0
let scores: Array<{ name: string; held: number; stashed: number }> = []
let results: ResultRow[] = []
let youPlace = 0
let youCoins = 0
let youTotal = 0
let youWins = 0
const coins: CoinVis[] = []
const chests: Entity[] = []
let lootImmune = 0
let lootBouncing = false
const carries = new Map<string, Entity>()
const pops: Array<{ entity: Entity; age: number; x: number; z: number; y0: number }> = []
const PLUS_LIFE = 1.15

export function isLootBusy(): boolean {
  return stage !== 'idle'
}

export function isLootPlaying(): boolean {
  return stage === 'playing'
}

export function isLootInRound(): boolean {
  return stage === 'loading' || stage === 'countdown' || stage === 'playing' || stage === 'results'
}

export function lootStage(): LootStage {
  return stage
}

export function lootHud() {
  return {
    stage,
    slot,
    lobbyGame,
    lobbyCount,
    lobbyMax,
    lobbyMin,
    lobbyTimer,
    count,
    remain,
    held,
    stashed,
    scores,
    results,
    youPlace,
    youCoins,
    youTotal,
    youWins
  }
}

export function tryJoinBootyLoot(): void {
  if (stage !== 'idle' && stage !== 'lobby') return
  if (isClientBusy('loot')) return
  setClientBusy('loot', true)
  stopHubAmbience()
  room.send('playerJoinLoot', {})
}

export function leaveLootLobby(): void {
  room.send('playerLeaveLoot', {})
}

export function closeLootResults(): void {
  stage = 'idle'
  void goHub()
}

export function setupLootClient(): void {
  hookChests()
  setupLootShark()
  room.onMessage('lootLobbyUpdate', (data) => {
    if (stage === 'loading' || stage === 'countdown' || stage === 'playing' || stage === 'results') return
    stage = 'lobby'
    lobbyGame = data.gameId
    slot = data.slot
    mySlot = Math.max(0, data.slot - 1)
    lobbyCount = data.count
    lobbyMax = data.max
    lobbyMin = data.min
    lobbyTimer = data.lobbyCount
  })
  room.onMessage('lootLeft', () => {
    stage = 'idle'
    setClientBusy('loot', false)
    startDockAmbience()
    hideLootGlbsAfterMatch()
    setLootHideExcludes([])
    clearCoins()
    hideAllCarries()
    clearPops()
  })
  room.onMessage('joinDenied', (data) => {
    if (data.game && data.game !== 'loot') return
    if (stage !== 'idle' && stage !== 'lobby') return
    stage = 'idle'
    setClientBusy('loot', false)
    startDockAmbience()
  })
  room.onMessage('lootPrep', (data) => {
    mySlot = data.slot
    slot = data.slot + 1
    stage = 'loading'
    count = MATCH.countdown
    lockAllInputs()
    showLootGlbsForMatch(mySlot)
    setHubGlbsVisible(false)
    viewLoot()
    void placeOnIsland(data)
  })
  room.onMessage('lootCountdown', (data) => {
    if (stage === 'idle' || stage === 'lobby') return
    if (data.count <= 0) {
      stage = 'playing'
      unlockToGameplay()
      return
    }
    stage = 'countdown'
    count = data.count
  })
  room.onMessage('lootRoster', (data) => {
    setLootHideExcludes(data.addresses)
  })
  room.onMessage('lootGo', (data) => {
    if (stage !== 'loading' && stage !== 'countdown' && stage !== 'playing') return
    remain = data.remain
    held = 0
    stashed = 0
    spawnCoins(data.coins)
    hideAllCarries()
    stage = 'playing'
    unlockToGameplay()
  })
  room.onMessage('lootTaken', (data) => {
    if (!isLootInRound()) return
    hideCoin(data.id)
    setCarry(data.address, data.held)
  })
  room.onMessage('lootCarry', (data) => {
    if (!isLootInRound()) return
    setCarry(data.address, data.held)
  })
  room.onMessage('lootBanked', (data) => {
    if (!isLootInRound()) return
    setCarry(data.address, 0)
    spawnPlusOne(data.slot, data.amount)
  })
  room.onMessage('lootGone', (data) => {
    if (!isLootInRound()) return
    hideCoin(data.id)
  })
  room.onMessage('lootSpawn', (data) => {
    if (stage !== 'playing') return
    spawnOneCoin(data)
  })
  room.onMessage('lootScore', (data) => {
    held = data.held
    stashed = data.stashed
    remain = data.remain
    const me = myAddr()
    if (me) setCarry(me, data.held)
  })
  room.onMessage('lootTick', (data) => {
    remain = data.remain
    scores = data.rows
  })
  room.onMessage('matchResults', (data) => {
    if (data.laneId !== -1) return
    if (stage === 'idle' || stage === 'lobby') return
    if (stage !== 'playing' && stage !== 'countdown' && stage !== 'loading') return
    results = data.rows
    youPlace = data.youPlace
    youCoins = data.youCoins
    youTotal = data.youTotal
    youWins = data.youWins
    stage = 'results'
    clearCoins()
    hideAllCarries()
    clearPops()
    clearLootShark()
    lockAllInputs()
  })
  engine.addSystem((dt) => {
    setClientBusy('loot', stage !== 'idle')
    const step = Math.min(dt > 1 ? dt / 1000 : dt, 0.05)
    tickPops(step)
    if (lootImmune > 0) lootImmune -= dt
    if (stage !== 'playing' && stage !== 'countdown') return
    if (lootImmune > 0 || lootBouncing) return
    const t = Transform.getOrNull(engine.PlayerEntity)
    if (!t || t.position.y > WATER_Y - 0.35) return
    void bounceToLootSpawn()
  }, 8, 'loot-fall')
}

function hookChests(): void {
  for (let i = 0; i < MATCH.maxPlayers; i++) {
    const e = engine.addEntity()
    const p = lootChestPos(i)
    Transform.create(e, {
      position: Vector3.create(p.x, p.y + 0.6, p.z),
      scale: Vector3.create(2.2, 2, 2.2)
    })
    TriggerArea.setBox(e)
    const mine = i
    const bank = () => {
      if (stage !== 'playing' || mine !== mySlot) return
      if (held <= 0) return
      room.send('lootBank', {})
    }
    triggerAreaEventsSystem.onTriggerEnter(e, bank)
    triggerAreaEventsSystem.onTriggerStay(e, bank)
    chests.push(e)
  }
}

function spawnCoins(list: Array<{ id: number; x: number; z: number }>): void {
  clearCoins()
  for (const spec of list) spawnOneCoin(spec)
}

function spawnOneCoin(spec: { id: number; x: number; z: number }): void {
  hideCoin(spec.id)
  const e = engine.addEntity()
  Transform.create(e, {
    position: Vector3.create(spec.x, LOOT.y + 0.4, spec.z),
    scale: Vector3.create(0.7, 0.7, 0.7)
  })
  const hit = engine.addEntity()
  Transform.create(hit, {
    parent: e,
    scale: Vector3.create(2.2, 3, 2.2)
  })
  TriggerArea.setBox(hit)
  spinCoinVisual(e, 0.55, 140)
  const id = spec.id
  triggerAreaEventsSystem.onTriggerEnter(hit, () => {
    if (stage !== 'playing') return
    room.send('lootGrab', { id })
  })
  coins.push({ id, entity: e })
}

function spinCoinVisual(parent: Entity, size: number, rpm: number): void {
  const spinner = engine.addEntity()
  Transform.create(spinner, { parent })
  Tween.setRotateContinuous(spinner, Quaternion.fromEulerDegrees(0, -90, 0), rpm)
  const vis = engine.addEntity()
  Transform.create(vis, {
    parent: spinner,
    rotation: Quaternion.fromEulerDegrees(90, 0, 0),
    scale: Vector3.create(size, 0.1, size)
  })
  MeshRenderer.setCylinder(vis)
  Material.setPbrMaterial(vis, {
    albedoColor: PALETTE.GOLD,
    emissiveColor: Color3.create(0.9, 0.7, 0.15),
    emissiveIntensity: 0.85,
    metallic: 0.7,
    roughness: 0.25,
    transparencyMode: MaterialTransparencyMode.MTM_OPAQUE
  })
}

function myAddr(): string {
  return (PlayerIdentityData.getOrNull(engine.PlayerEntity)?.address ?? '').toLowerCase()
}

function setCarry(address: string, amount: number): void {
  const key = address.toLowerCase()
  if (amount < 1) {
    hideCarry(key)
    return
  }
  const existing = carries.get(key)
  if (existing && Transform.has(existing)) return
  hideCarry(key)
  const root = engine.addEntity()
  Transform.create(root)
  const local = key === myAddr()
  AvatarAttach.create(
    root,
    local
      ? { anchorPointId: AvatarAnchorPointType.AAPT_RIGHT_HAND }
      : { avatarId: address, anchorPointId: AvatarAnchorPointType.AAPT_RIGHT_HAND }
  )
  const hold = engine.addEntity()
  Transform.create(hold, {
    parent: root,
    position: Vector3.create(0.04, 0.06, 0.08)
  })
  spinCoinVisual(hold, 0.32, 180)
  carries.set(key, root)
}

function hideCarry(key: string): void {
  const e = carries.get(key)
  if (!e) return
  if (Transform.has(e)) engine.removeEntityWithChildren(e)
  carries.delete(key)
}

function hideAllCarries(): void {
  for (const key of [...carries.keys()]) hideCarry(key)
}

function spawnPlusOne(slot: number, amount: number): void {
  const p = lootChestPos(slot)
  const e = engine.addEntity()
  Transform.create(e, { position: Vector3.create(p.x, p.y + 1.15, p.z) })
  Billboard.create(e)
  TextShape.create(e, {
    text: `+${Math.max(1, amount)}`,
    fontSize: 2.4,
    textColor: Color4.create(1, 0.86, 0.2, 1),
    textAlign: TextAlignMode.TAM_MIDDLE_CENTER
  })
  pops.push({ entity: e, age: 0, x: p.x, z: p.z, y0: p.y + 1.15 })
}

function tickPops(dt: number): void {
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]
    p.age += dt
    const u = Math.min(1, p.age / PLUS_LIFE)
    if (!Transform.has(p.entity)) {
      pops.splice(i, 1)
      continue
    }
    Transform.getMutable(p.entity).position = Vector3.create(p.x, p.y0 + u * 1.55, p.z)
    if (TextShape.has(p.entity)) {
      TextShape.getMutable(p.entity).textColor = Color4.create(1, 0.86, 0.2, 1 - u)
    }
    if (u < 1) continue
    engine.removeEntity(p.entity)
    pops.splice(i, 1)
  }
}

function clearPops(): void {
  for (const p of pops) {
    if (Transform.has(p.entity)) engine.removeEntity(p.entity)
  }
  pops.length = 0
}

function hideCoin(id: number): void {
  const i = coins.findIndex((c) => c.id === id)
  if (i < 0) return
  const vis = coins[i]
  if (Transform.has(vis.entity)) engine.removeEntityWithChildren(vis.entity)
  coins.splice(i, 1)
}

function clearCoins(): void {
  for (const c of coins) {
    if (Transform.has(c.entity)) engine.removeEntityWithChildren(c.entity)
  }
  coins.length = 0
}

async function bounceToLootSpawn(): Promise<void> {
  if (lootBouncing) return
  lootBouncing = true
  lootImmune = 2
  const player = Transform.getOrNull(engine.PlayerEntity)
  if (player) playWaterSplash(player.position.x, player.position.z)
  await placeOnIsland(lootStart(mySlot))
  lootBouncing = false
}

async function placeOnIsland(data: {
  x: number
  y: number
  z: number
  lookX: number
  lookY: number
  lookZ: number
}): Promise<void> {
  try {
    await movePlayerTo({
      newRelativePosition: { x: data.x, y: data.y, z: data.z },
      cameraTarget: { x: data.lookX, y: data.lookY, z: data.lookZ }
    })
  } catch (e) {
    console.log('[LOOT] spawn failed', e)
  }
}

async function goHub(): Promise<void> {
  const x = HUB_SPAWN.xMin + Math.random() * (HUB_SPAWN.xMax - HUB_SPAWN.xMin)
  const z = HUB_SPAWN.zMin + Math.random() * (HUB_SPAWN.zMax - HUB_SPAWN.zMin)
  try {
    await movePlayerTo({
      newRelativePosition: { x, y: HUB_SPAWN.y, z },
      cameraTarget: { x: HUB_SPAWN.lookX, y: HUB_SPAWN.lookY, z: HUB_SPAWN.lookZ }
    })
  } catch (e) {
    console.log('[LOOT] hub return failed', e)
  }
  viewHub()
  setHubGlbsVisible(true)
  startDockAmbience()
  unlockToGameplay()
  clearCoins()
  hideAllCarries()
  clearPops()
  hideLootGlbsAfterMatch()
  clearLootShark()
  setLootHideExcludes([])
}
