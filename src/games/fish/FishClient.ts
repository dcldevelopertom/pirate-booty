import { InputAction, engine, inputSystem } from '@dcl/sdk/ecs'
import { movePlayerTo } from '~system/RestrictedActions'
import { FISH, HUB_SPAWN } from '../../config'
import { room } from '../../net/messages'
import { lockAllInputs, lockFishPlay, unlockToGameplay } from '../../ui/inputLocks'
import { setHubGlbsVisible } from '../../world/HubHide'
import { playFishCatch, playFishSnap, playSplashSound, setReelSound, startDockAmbience, startReelLoop, stopHubAmbience, stopReelLoop } from '../../world/Audio'
import { punchFishCam, tickFishCam, viewFish, viewFishCatch, viewFishHole, viewHub } from '../../world/cameras'
import {
  clearFishSlotMark,
  fishStandPose,
  getFishLineDepth,
  hideFishLine,
  hookFishSlots,
  isFishHoleTaken,
  setFishPegsVisible,
  setFishSlotPointers,
  setTakenFishHoles,
  applyFishSchool,
  applyFishPath,
  takeSchoolFish,
  clearFishSchoolVisuals,
  celebrateCatchAt,
  landHooked,
  markFishSlot,
  releaseHooked,
  setFishLineDepth,
  showFishLine,
  syncRemoteFishLines,
  applyRemoteFishLine,
  tickRemoteFishLines,
  clearRemoteFishLines,
  tickFishSchool,
  hookFishById,
  applyFightPose
} from './FishArena'
import { isClientBusy, setClientBusy } from '../shared/ClientBusy'

export type FishStage = 'idle' | 'picking' | 'fishing' | 'fight' | 'catch'

let stage: FishStage = 'idle'
let slot = -1
let hits = 0
let toast = ''
let toastT = 0
let tension = 0.5
let fightLeft = 0
let hookHeld = false
let jumpHeld = false
let reelUp = false
let reelDown = false
let catchT = 0
let pierMove = 0
let wasSweet = true
let lastCatch: { name: string; image: string; coins: number } | null = null
let snagLock = 0
let localPirateName = 'Pirate'
let claiming = false
let claimedSlot = -1
let lineSend = 0
let lastLineKey = ''

export function setLocalPirateName(name: string): void {
  const t = name.trim()
  if (t) localPirateName = t.slice(0, 20)
}

export function isFishBusy(): boolean {
  return stage !== 'idle'
}

export function fishHud() {
  return { stage, slot, depth: getFishLineDepth(), hits, toast, tension, fightLeft, catch: lastCatch }
}

export function setFishHookHeld(on: boolean): void {
  hookHeld = on
  if (on) tryFishHook()
}

export function setFishReelHeld(dir: 'up' | 'down', on: boolean): void {
  if (dir === 'up') reelUp = on
  else reelDown = on
}

export function tryFishHook(): void {
  if (stage === 'fight') return
  if (stage !== 'fishing') return
  if (snagLock > 0) return
  punchFishCam(0.32)
  room.send('fishHook', {})
}

export function tryJoinFishing(): void {
  if (stage !== 'idle') return
  if (isClientBusy('fish')) return
  setClientBusy('fish', true)
  stage = 'picking'
  slot = -1
  claiming = false
  clearFishSlotMark()
  setFishPegsVisible(true)
  setFishSlotPointers(true)
  setHubGlbsVisible(false)
  stopHubAmbience()
  lockAllInputs()
  viewFish()
  room.send('fishAskHoles', {})
}

export function pickFishSlot(index: number): void {
  if (stage !== 'picking' || claiming) return
  if (isFishHoleTaken(index)) {
    toast = 'TAKEN'
    toastT = 0.8
    return
  }
  slot = index
  markFishSlot(index)
}

export function confirmFishHole(): void {
  if (stage !== 'picking' || slot < 0 || claiming) return
  if (isFishHoleTaken(slot)) {
    toast = 'TAKEN'
    toastT = 0.8
    return
  }
  claiming = true
  claimedSlot = slot
  applyRemoteFishLine(
    { slot, depth: 10, hooked: false, kind: '', along: 0, fishDepth: 0, out: 0 },
    slot
  )
  setFishSlotPointers(false)
  lockAllInputs()
  room.send('fishClaim', { slot })
  goFishHole(slot)
}

export function leaveFishing(): void {
  pierMove++
  claiming = false
  claimedSlot = -1
  lastLineKey = ''
  room.send('fishLeave', {})
  setClientBusy('fish', false)
  stage = 'idle'
  slot = -1
  hits = 0
  toast = ''
  hookHeld = false
  reelUp = false
  reelDown = false
  catchT = 0
  lastCatch = null
  snagLock = 0
  releaseHooked()
  clearFishSlotMark()
  setFishPegsVisible(false)
  setFishSlotPointers(false)
  stopReelLoop()
  hideFishLine()
  clearRemoteFishLines()
  clearFishSchoolVisuals()
  viewHub()
  setHubGlbsVisible(true)
  startDockAmbience()
  returnToHub()
}

export function setupFishClient(): void {
  hookFishSlots(pickFishSlot)
  room.onMessage('fishHoles', (data) => {
    setTakenFishHoles(data.rows)
    if (stage !== 'idle') syncRemoteFishLines(data.rows, skipHole())
    if (stage === 'picking' && !claiming) setFishSlotPointers(true)
  })
  room.onMessage('fishLineState', (data) => {
    if (stage === 'idle') return
    applyRemoteFishLine(data, skipHole())
  })
  room.onMessage('fishSchool', (data) => {
    if (stage === 'idle') return
    applyFishSchool(data.fish)
  })
  room.onMessage('fishPath', (data) => {
    if (stage === 'idle') return
    applyFishPath(data)
  })
  room.onMessage('fishHooked', (data) => {
    if (stage === 'idle') return
    takeSchoolFish(data.id)
  })
  room.onMessage('joinDenied', (data) => {
    if (data.game && data.game !== 'fish') return
    if (stage !== 'picking') return
    leaveFishing()
  })
  room.onMessage('fishOn', (data) => {
    if (stage !== 'fishing') return
    hookFishById(data.id)
    stage = 'fight'
    reelUp = false
    reelDown = false
    sendFishLine(true)
    setReelSound(true)
    tension = 0.5
    fightLeft = FISH.fightSeconds
    wasSweet = true
    toast = 'ON!'
    toastT = 0.8
  })
  room.onMessage('fishMiss', () => {
    if (stage !== 'fishing') return
    toast = 'MISS'
    toastT = 0.7
    snagLock = FISH.snagLock
  })
  room.onMessage('fishFightState', (data) => {
    if (stage !== 'fight') return
    tension = data.tension
    fightLeft = data.fightLeft
    applyFightPose(data.along, data.fishDepth, data.out)
  })
  room.onMessage('fishSnap', () => {
    if (stage !== 'fight') return
    releaseHooked()
    setFishLineDepth(getFishLineDepth())
    stage = 'fishing'
    hookHeld = false
    reelUp = false
    reelDown = false
    setReelSound(false)
    sendFishLine(true)
    playFishSnap()
    snagLock = FISH.snagLock
    toast = 'GOT AWAY'
    toastT = 1.2
  })
  room.onMessage('fishLanded', (data) => {
    if (stage !== 'fight' && stage !== 'fishing') return
    hits += data.coins
    hookHeld = false
    reelUp = false
    reelDown = false
    setReelSound(false)
    sendFishLine(true)
    playFishCatch()
    lastCatch = {
      name: data.fish,
      image: data.image,
      coins: data.coins
    }
    toast = `+${data.coins}`
    toastT = FISH.catchSeconds
    catchT = FISH.catchSeconds
    const pose = fishStandPose(slot)
    celebrateCatchAt(pose.x, pose.y, pose.z)
    viewFishCatch(pose.x, pose.y, pose.z)
    stage = 'catch'
  })
  room.onMessage('fishClaimed', (data) => {
    claiming = false
    claimedSlot = data.slot
    slot = data.slot
    applyRemoteFishLine(
      { slot: data.slot, depth: 10, hooked: false, kind: '', along: 0, fishDepth: 0, out: 0 },
      data.slot
    )
  })
  room.onMessage('fishHoleDenied', () => {
    claiming = false
    claimedSlot = -1
    toast = 'TAKEN'
    toastT = 0.9
    if (stage === 'fishing' || stage === 'fight' || stage === 'catch') {
      pierMove++
      stage = 'picking'
      stopReelLoop()
      hideFishLine()
      viewFish()
    }
    if (stage === 'picking') {
      setFishSlotPointers(true)
      lockAllInputs()
    }
  })
  engine.addSystem((dt) => {
    setClientBusy('fish', stage !== 'idle')
    const step = Math.min(dt > 1 ? dt / 1000 : dt, 0.05)
    tickFishSchool(step)
    if (stage !== 'idle') tickRemoteFishLines(step)
    if (stage === 'picking') {
      lockAllInputs()
      if (toastT > 0) toastT -= step
      if (toastT <= 0) toast = ''
    }
    if (stage === 'catch') {
      lockFishPlay()
      if (toastT > 0) toastT -= step
      catchT -= step
      if (catchT > 0) return
      landHooked()
      const pose = fishStandPose(slot)
      showFishLine(slot, 10)
      viewFishHole(pose.x, pose.z)
      playSplashSound(pose.x, pose.z)
      startReelLoop()
      stage = 'fishing'
      return
    }
    if (stage !== 'fishing' && stage !== 'fight') return
    lineSend += step
    const wait = stage === 'fight' ? 0.1 : 0.12
    tickFishCam(step)
    lockFishPlay()
    const jump = inputSystem.isPressed(InputAction.IA_JUMP)
    if (jump && !jumpHeld) tryFishHook()
    jumpHeld = jump
    if (toastT > 0) toastT -= step
    if (toastT <= 0) toast = ''
    if (snagLock > 0) snagLock -= step
    if (stage === 'fishing') {
      const dir =
        (reelUp || inputSystem.isPressed(InputAction.IA_FORWARD) ? -1 : 0) +
        (reelDown || inputSystem.isPressed(InputAction.IA_BACKWARD) ? 1 : 0)
      if (dir !== 0) {
        setFishLineDepth(getFishLineDepth() + dir * FISH.lineSpeed * step)
        if (lineSend >= 0.08) {
          lineSend = 0
          sendFishLine()
        }
      } else if (lineSend >= wait) {
        lineSend = 0
        sendFishLine()
      }
      setReelSound(dir !== 0)
      return
    }
    if (lineSend >= wait) {
      lineSend = 0
      room.send('fishFight', { hold: hookHeld || jump })
    }
    tickFight(jump)
  }, 6, 'fish-client')
}

function skipHole(): number {
  if (claimedSlot >= 0) return claimedSlot
  if (claiming || stage === 'fishing' || stage === 'fight' || stage === 'catch') return slot
  return -1
}

function sendFishLine(force = false): void {
  const depth = Math.round(getFishLineDepth() * 10) / 10
  const key = String(depth)
  if (!force && key === lastLineKey) return
  lastLineKey = key
  room.send('fishLine', { depth })
}

function tickFight(jump: boolean): void {
  const hold = hookHeld || jump
  setReelSound(hold)
  const sweet = tension >= 0.26 && tension <= 0.7
  if (sweet) {
    wasSweet = true
    return
  }
  if (wasSweet) punchFishCam(0.3)
  wasSweet = false
  punchFishCam(0.12)
}

async function placeOnPier(index: number): Promise<number> {
  const id = ++pierMove
  const pose = fishStandPose(index)
  try {
    await movePlayerTo({
      newRelativePosition: { x: pose.x, y: pose.y, z: pose.z },
      cameraTarget: { x: pose.lookX, y: pose.lookY, z: pose.lookZ }
    })
  } catch (e) {
    console.log('[FISH] stand failed', e)
  }
  return id
}

async function returnToHub(): Promise<void> {
  const id = pierMove
  const x = HUB_SPAWN.xMin + Math.random() * (HUB_SPAWN.xMax - HUB_SPAWN.xMin)
  const z = HUB_SPAWN.zMin + Math.random() * (HUB_SPAWN.zMax - HUB_SPAWN.zMin)
  try {
    await movePlayerTo({
      newRelativePosition: { x, y: HUB_SPAWN.y, z },
      cameraTarget: { x: HUB_SPAWN.lookX, y: HUB_SPAWN.lookY, z: HUB_SPAWN.lookZ }
    })
  } catch (e) {
    console.log('[FISH] hub return failed', e)
  }
  if (id !== pierMove || stage !== 'idle') return
  unlockToGameplay()
}

function goFishHole(index: number): void {
  slot = index
  claimedSlot = index
  stage = 'fishing'
  showFishLine(index, 10)
  const pose = fishStandPose(index)
  viewFishHole(pose.x, pose.z)
  startReelLoop()
  lockFishPlay()
  sendFishLine(true)
  void placeOnPier(index)
}
