import { Transform, TriggerArea, engine, triggerAreaEventsSystem } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import { DROWN, GROUND_Y, HUB, HUB_SPAWN, WATER_Y, WORLD_SIZE } from '../config'
import { lockAllInputs, unlockToGameplay } from '../ui/inputLocks'
import { detachPlayerCam, viewHub } from './cameras'
import { isSplashVisible } from '../ui/Splash'
import { beginDockOut, isDockOut, isKillArmed, isMatchFinished, isMatchLocked, markDockDying, onDockDeath, onDockDeathDone } from '../ui/MatchHud'
import { isLootInRound } from '../games/loot/LootClient'
import { isCannonInRound } from '../games/cannon/CannonClient'
import { isFishBusy } from '../games/fish/FishClient'
import { setHubGlbsVisible } from './HubHide'
import { getPlayingLane, setPlayingLane, unbindLane } from '../games/shared/GameView'
import { freezeDrownCam, resetDrownCam } from './PlayerFollowCam'
import { playWaterSplash } from './WaterSplash'
import { room } from '../net/messages'

let recovering = false
let visible = false
let remain = 0
let uiDelay = 0
let immune = 0
let recoverTo: 'hub' | 'dock' = 'hub'

export function isDrownUiVisible(): boolean {
  return visible
}

export function drownRemain(): number {
  return remain
}

/** Top of the scene water volume — below hub and dock walk so standing never fires. */
function drownTopY(): number {
  return WATER_Y - 2.5
}

function drownHeight(): number {
  return Math.max(drownTopY() - GROUND_Y, 8)
}

function inWorldWater(pos: { x: number; y: number; z: number }): boolean {
  return (
    pos.y >= GROUND_Y &&
    pos.y <= drownTopY() &&
    pos.x >= 0 &&
    pos.x <= WORLD_SIZE &&
    pos.z >= 0 &&
    pos.z <= WORLD_SIZE
  )
}

function inHubSafe(pos: { x: number; y: number; z: number }): boolean {
  const pad = 3
  return (
    pos.x >= HUB.x0 - pad &&
    pos.x <= HUB.x0 + HUB.sx + pad &&
    pos.z >= HUB.z0 - pad &&
    pos.z <= HUB.z0 + HUB.sz + pad &&
    pos.y > WATER_Y - 1
  )
}

function canDrown(): boolean {
  if (recovering || immune > 0 || isSplashVisible() || isMatchLocked() || isMatchFinished() || isDockOut() || isLootInRound() || isCannonInRound() || isFishBusy()) return false
  const t = Transform.getOrNull(engine.PlayerEntity)
  if (!t) return false
  if (inHubSafe(t.position)) return false
  if (isKillArmed()) return inWorldWater(t.position) || t.position.y < WATER_Y
  return inWorldWater(t.position)
}

export function buildDrownTrigger(): void {
  const h = drownHeight()
  const e = engine.addEntity()
  Transform.create(e, {
    position: Vector3.create(WORLD_SIZE / 2, GROUND_Y + h / 2, WORLD_SIZE / 2),
    scale: Vector3.create(WORLD_SIZE, h, WORLD_SIZE)
  })
  TriggerArea.setBox(e)
  triggerAreaEventsSystem.onTriggerEnter(e, () => onWaterEnter())
}

function onWaterEnter(): void {
  if (!canDrown()) return
  if (isKillArmed()) {
    const lane = getPlayingLane()
    if (lane !== null && lane >= 0) {
      console.log(`[RACE] FALL ENTER dock ${lane + 1}`)
      room.send('laneFall', { laneId: lane })
    }
    void startDrownRecover('dock')
    return
  }
  void startDrownRecover('hub')
}

export function registerDrownWatch(): void {
  room.onMessage('matchOver', (data) => {
    if (data.died && isKillArmed() && getPlayingLane() === data.laneId) {
      void startDrownRecover('dock')
    }
  })
  engine.addSystem((dt) => {
    if (immune > 0) immune -= dt
    if (!recovering) {
      if (canDrown()) onWaterEnter()
      return
    }
    if (uiDelay > 0) {
      uiDelay -= dt
      if (uiDelay <= 0) visible = true
      return
    }
    remain -= dt
    if (remain > 0) return
    void finishDrownRecover()
  }, 8, 'drown-watch')
}

export function startDrownRecover(to: 'hub' | 'dock' = 'hub'): Promise<void> {
  if (recovering || immune > 0 || isSplashVisible() || isMatchLocked() || isMatchFinished() || isDockOut()) return Promise.resolve()
  recoverTo = to
  recovering = true
  visible = to === 'dock'
  uiDelay = to === 'dock' ? 0 : 2
  remain = DROWN.waitSeconds
  const player = Transform.getOrNull(engine.PlayerEntity)
  if (player) playWaterSplash(player.position.x, player.position.z)
  if (to === 'dock') {
    markDockDying()
  } else {
    onDockDeath()
    setPlayingLane(null)
    unbindLane()
  }
  lockAllInputs()
  freezeDrownCam()
  detachPlayerCam()
  return Promise.resolve()
}

async function finishDrownRecover(): Promise<void> {
  visible = false
  remain = 0
  uiDelay = 0
  if (recoverTo === 'dock') {
    await beginDockOut()
    immune = 2.5
    recovering = false
    return
  }
  recovering = false
  immune = 2.5
  const x = HUB_SPAWN.xMin + Math.random() * (HUB_SPAWN.xMax - HUB_SPAWN.xMin)
  const z = HUB_SPAWN.zMin + Math.random() * (HUB_SPAWN.zMax - HUB_SPAWN.zMin)
  try {
    await movePlayerTo({
      newRelativePosition: { x, y: HUB_SPAWN.y, z },
      cameraTarget: { x: HUB_SPAWN.lookX, y: HUB_SPAWN.lookY, z: HUB_SPAWN.lookZ }
    })
  } catch (e) {
    console.log('[CLIENT] drown respawn failed', e)
  }
  resetDrownCam()
  viewHub()
  setHubGlbsVisible(true)
  onDockDeathDone()
  unlockToGameplay()
}
