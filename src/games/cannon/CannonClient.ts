import { InputAction, PlayerIdentityData, engine, inputSystem } from '@dcl/sdk/ecs'
import { movePlayerTo } from '~system/RestrictedActions'
import { CANNON, CANNON_CAM, HUB_SPAWN, MATCH } from '../../config'
import { playSplashAt } from '../../world/WaterSplash'
import { room } from '../../net/messages'
import { lockAllInputs, lockCannonPlay, unlockToGameplay } from '../../ui/inputLocks'
import { isClientBusy, setClientBusy } from '../shared/ClientBusy'
import { playCannonFire, startDockAmbience, stopHubAmbience } from '../../world/Audio'
import { getCannonShake, punchCannonCam, tickCannonCam, viewCannon, viewHub } from '../../world/cameras'
import { setHubGlbsVisible } from '../../world/HubHide'
import {
  aimCannon,
  buildCannonDeck,
  cannonMuzzle,
  cannonSlotPose,
  clearCannonArena,
  removeCannonShip,
  sinkCannonShip,
  applyCannonShake,
  spawnCannonShip,
  spawnCannonShot,
  tickCannonVisuals
} from './CannonArena'

export type CannonStage = 'idle' | 'lobby' | 'loading' | 'countdown' | 'playing' | 'results'

type ResultRow = { name: string; place: number; state: string; coins: number }

let stage: CannonStage = 'idle'
let slot = 0
let mySlot = 0
let lobbyGame = 0
let lobbyCount = 0
let lobbyMax = MATCH.maxPlayers
let lobbyMin = 1
let lobbyTimer = 0
let count = MATCH.countdown
let remain = CANNON.seconds
let hits = 0
let pitch = CANNON.pitchStart
let yaw = CANNON_CAM.yaw
let cool = 0
let scores: Array<{ name: string; hits: number }> = []
let results: ResultRow[] = []
let youPlace = 0
let youCoins = 0
let youTotal = 0
let youWins = 0
let deckBuilt = false
let jumpHeld = false

export function isCannonBusy(): boolean {
  return stage !== 'idle'
}

export function isCannonInRound(): boolean {
  return stage === 'loading' || stage === 'countdown' || stage === 'playing' || stage === 'results'
}

export function cannonHud() {
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
    hits,
    pitch,
    yaw,
    cool,
    scores,
    results,
    youPlace,
    youCoins,
    youTotal,
    youWins
  }
}

export function tryJoinCannon(): void {
  if (stage !== 'idle' && stage !== 'lobby') return
  if (isClientBusy('cannon')) return
  setClientBusy('cannon', true)
  stopHubAmbience()
  room.send('playerJoinCannon', {})
}

export function leaveCannonLobby(): void {
  room.send('playerLeaveCannon', {})
}

export function closeCannonResults(): void {
  stage = 'idle'
  void goHub()
}

export function nudgeCannon(dp: number, dy: number): void {
  if (stage !== 'playing' && stage !== 'countdown' && stage !== 'loading') return
  pitch = clamp(pitch + dp, CANNON.pitchMin, CANNON.pitchMax)
  yaw = clamp(yaw + dy, CANNON.yawMin, CANNON.yawMax)
  aimCannon(mySlot, pitch, yaw)
}

export function fireCannon(): void {
  if (stage !== 'playing' || cool > 0) return
  cool = CANNON.cooldown
  punchCannonCam()
  playCannonFire()
  spawnCannonShot({ id: -Date.now(), ...cannonMuzzle(mySlot, pitch, yaw) })
  room.send('cannonFire', { pitch, yaw })
}

export function setupCannonClient(): void {
  room.onMessage('cannonLobbyUpdate', (data) => {
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
  room.onMessage('cannonLeft', () => {
    stage = 'idle'
    setClientBusy('cannon', false)
    setHubGlbsVisible(true)
    startDockAmbience()
  })
  room.onMessage('joinDenied', (data) => {
    if (data.game && data.game !== 'cannon') return
    if (stage !== 'idle' && stage !== 'lobby') return
    stage = 'idle'
    setClientBusy('cannon', false)
    startDockAmbience()
  })
  room.onMessage('cannonPrep', (data) => {
    mySlot = data.slot
    slot = data.slot + 1
    stage = 'loading'
    count = MATCH.countdown
    hits = 0
    pitch = CANNON.pitchStart
    yaw = CANNON_CAM.yaw
    cool = 0
    jumpHeld = false
    lockCannonPlay()
    setHubGlbsVisible(false, 'cannon')
    ensureDeck()
    aimCannon(mySlot, pitch, yaw)
    viewCannon(cannonSlotPose(mySlot).x)
    void placeOnShip(data)
  })
  room.onMessage('cannonCountdown', (data) => {
    if (stage === 'idle' || stage === 'lobby') return
    if (data.count <= 0) {
      stage = 'playing'
      lockCannonPlay()
      return
    }
    stage = 'countdown'
    count = data.count
    lockCannonPlay()
  })
  room.onMessage('cannonGo', (data) => {
    if (stage === 'idle' || stage === 'lobby') return
    remain = data.remain
    stage = 'playing'
    lockCannonPlay()
  })
  room.onMessage('cannonTick', (data) => {
    remain = data.remain
    scores = data.rows
  })
  room.onMessage('cannonShot', (data) => {
    if (!isCannonInRound()) return
    const me = PlayerIdentityData.getOrNull(engine.PlayerEntity)?.address ?? ''
    if (me && me.toLowerCase() === data.address.toLowerCase()) return
    spawnCannonShot(data)
  })
  room.onMessage('cannonSplash', (data) => {
    if (!isCannonInRound()) return
    playSplashAt(data.x, data.z)
  })
  room.onMessage('cannonShip', (data) => {
    if (!isCannonInRound()) return
    spawnCannonShip(data)
  })
  room.onMessage('cannonSunk', (data) => {
    if (!isCannonInRound()) return
    sinkCannonShip(data.id, data.coins)
    const me = PlayerIdentityData.getOrNull(engine.PlayerEntity)?.address ?? ''
    if (me && me.toLowerCase() === data.address.toLowerCase()) hits = data.hits
  })
  room.onMessage('cannonGone', (data) => {
    if (!isCannonInRound()) return
    removeCannonShip(data.id)
  })
  room.onMessage('matchResults', (data) => {
    if (stage === 'idle' || stage === 'lobby') return
    if (data.laneId !== -2) return
    results = data.rows
    youPlace = data.youPlace
    youCoins = data.youCoins
    youTotal = data.youTotal
    youWins = data.youWins
    stage = 'results'
    lockAllInputs()
  })
  engine.addSystem((dt) => {
    setClientBusy('cannon', stage !== 'idle')
    const step = Math.min(dt > 1 ? dt / 1000 : dt, 0.05)
    if (cool > 0) cool -= step
    if (isCannonInRound()) {
      tickCannonCam(step)
      const sh = getCannonShake()
      applyCannonShake(sh.x, sh.y, sh.z)
      tickCannonVisuals(step)
    }
    if (stage !== 'playing' && stage !== 'countdown') return
    lockCannonPlay()
    const turn = 52 * step
    if (inputSystem.isPressed(InputAction.IA_LEFT)) nudgeCannon(0, -turn)
    if (inputSystem.isPressed(InputAction.IA_RIGHT)) nudgeCannon(0, turn)
    if (inputSystem.isPressed(InputAction.IA_FORWARD)) nudgeCannon(turn, 0)
    if (inputSystem.isPressed(InputAction.IA_BACKWARD)) nudgeCannon(-turn, 0)
    if (stage !== 'playing') return
    const jump = inputSystem.isPressed(InputAction.IA_JUMP)
    if (jump && !jumpHeld) fireCannon()
    jumpHeld = jump
  }, 6, 'cannon-client')
}

function ensureDeck(): void {
  if (deckBuilt) return
  buildCannonDeck()
  deckBuilt = true
}

async function placeOnShip(data: {
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
    console.log('[CANNON] spawn failed', e)
  }
  lockCannonPlay()
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
    console.log('[CANNON] hub return failed', e)
  }
  viewHub()
  setHubGlbsVisible(true)
  startDockAmbience()
  unlockToGameplay()
  clearCannonArena()
  deckBuilt = false
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n))
}
