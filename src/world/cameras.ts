import { Entity, MainCamera, Transform, VirtualCamera, engine } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { CANNON_CAM, DECK_Y, FISH, FISH_CAM, FISH_VIEW, FLYCAM, HUB, HUB_CAM, LANE, LANE_CAM, LOOT_CAM, PLAYER_CAM, TUTORIAL_CAM } from '../config'
import { hubCenter, laneZ } from './layout'

export let adminFlyCam: Entity
export let playerCamRoot: Entity
export let playerFollowCam: Entity
export let boardCam: Entity
export let lootCam: Entity
export let cannonCam: Entity
export let fishCam: Entity
export let fishViewCam: Entity
export let fishCatchCam: Entity
export let tutorialCam: Entity
/** hub = fixed pier shot. player = follow the local avatar. lane = admin row follow. board = leaderboard close-up. loot = fixed island shot. cannon = corsair gun deck. fish = overhead fishing holes. fishview = underwater slice. fishcatch = above-water celebrate. tutorial = Cap'n by the board. */
export type CamFollow = 'hub' | 'player' | 'lane' | 'board' | 'loot' | 'cannon' | 'fish' | 'fishview' | 'fishcatch' | 'tutorial'

let camFollow: CamFollow = 'hub'
let dockFollowLane: number | null = null
let cannonSlotX = CANNON_CAM.x
let cannonShake = 0
let shakeX = 0
let shakeY = 0
let shakeZ = 0
let fishViewX = FISH.x0 + FISH_VIEW.dx
let fishViewY = FISH_VIEW.y
let fishViewZ = FISH.z0 + FISH_VIEW.dz
let fishShake = 0

export function buildCameras(): void {
  adminFlyCam = engine.addEntity()
  Transform.create(adminFlyCam, {
    position: Vector3.create(FLYCAM.start.x, FLYCAM.start.y, FLYCAM.start.z),
    rotation: Quaternion.fromEulerDegrees(FLYCAM.start.pitch, FLYCAM.start.yaw, 0)
  })
  VirtualCamera.create(adminFlyCam, {
    defaultTransition: { transitionMode: VirtualCamera.Transition.Time(0.4) }
  })

  playerCamRoot = engine.addEntity()
  Transform.create(playerCamRoot, { position: Vector3.create(HUB_CAM.x, HUB_CAM.y, HUB_CAM.z) })

  playerFollowCam = engine.addEntity()
  Transform.create(playerFollowCam, {
    position: Vector3.create(HUB_CAM.x, HUB_CAM.y, HUB_CAM.z),
    rotation: Quaternion.fromEulerDegrees(HUB_CAM.pitch, HUB_CAM.yaw, 0)
  })
  VirtualCamera.create(playerFollowCam, {
    defaultTransition: { transitionMode: VirtualCamera.Transition.Time(0.5) }
  })

  lootCam = engine.addEntity()
  Transform.create(lootCam, {
    position: Vector3.create(LOOT_CAM.x, LOOT_CAM.y, LOOT_CAM.z),
    rotation: Quaternion.fromEulerDegrees(LOOT_CAM.pitch, LOOT_CAM.yaw, 0)
  })
  VirtualCamera.create(lootCam, {
    defaultTransition: { transitionMode: VirtualCamera.Transition.Time(0.5) }
  })

  cannonCam = engine.addEntity()
  Transform.create(cannonCam, {
    position: Vector3.create(CANNON_CAM.x, CANNON_CAM.y, CANNON_CAM.z),
    rotation: Quaternion.fromEulerDegrees(CANNON_CAM.pitch, CANNON_CAM.yaw, 0)
  })
  VirtualCamera.create(cannonCam, {
    defaultTransition: { transitionMode: VirtualCamera.Transition.Time(0.5) }
  })

  fishCam = engine.addEntity()
  Transform.create(fishCam, {
    position: Vector3.create(FISH_CAM.x, FISH_CAM.y, FISH_CAM.z),
    rotation: Quaternion.fromEulerDegrees(FISH_CAM.pitch, FISH_CAM.yaw, 0)
  })
  VirtualCamera.create(fishCam, {
    defaultTransition: { transitionMode: VirtualCamera.Transition.Time(0.5) }
  })

  fishViewCam = engine.addEntity()
  Transform.create(fishViewCam, {
    position: Vector3.create(FISH.x0 + FISH_VIEW.dx, FISH_VIEW.y, FISH.z0 + FISH_VIEW.dz),
    rotation: Quaternion.fromEulerDegrees(FISH_VIEW.pitch, FISH_VIEW.yaw, 0)
  })
  VirtualCamera.create(fishViewCam, {
    defaultTransition: { transitionMode: VirtualCamera.Transition.Time(1.1) }
  })

  fishCatchCam = engine.addEntity()
  Transform.create(fishCatchCam, {
    position: Vector3.create(FISH.x0, FISH.y + 2, FISH.z0 - 4.6),
    rotation: Quaternion.fromEulerDegrees(12, 0, 0)
  })
  VirtualCamera.create(fishCatchCam, {
    defaultTransition: { transitionMode: VirtualCamera.Transition.Time(1.1) }
  })

  const c = hubCenter()
  tutorialCam = engine.addEntity()
  Transform.create(tutorialCam, {
    position: Vector3.create(c.x + TUTORIAL_CAM.dx, HUB.y + TUTORIAL_CAM.dy, c.z + TUTORIAL_CAM.dz),
    rotation: Quaternion.fromEulerDegrees(TUTORIAL_CAM.pitch, TUTORIAL_CAM.yaw, 0)
  })
  VirtualCamera.create(tutorialCam, {
    defaultTransition: { transitionMode: VirtualCamera.Transition.Time(0.7) }
  })
  viewHub()
}

export function getCamFollow(): CamFollow {
  return camFollow
}

export function getDockFollowLane(): number | null {
  return camFollow === 'lane' ? dockFollowLane : null
}

function setBoom(height: number, south: number): void {
  const t = Transform.getMutable(playerFollowCam)
  t.parent = playerCamRoot
  t.position.x = 0
  t.position.y = height
  t.position.z = -south
  t.rotation = Quaternion.fromEulerDegrees((Math.atan2(height, south) * 180) / Math.PI, 0, 0)
}

export function viewLane(lane: number): void {
  camFollow = 'lane'
  dockFollowLane = lane
  const t = Transform.getMutable(playerCamRoot)
  t.parent = undefined
  t.position.x = LANE.x0 + 0.5
  t.position.y = DECK_Y
  t.position.z = laneZ(lane) + LANE.width / 2
  t.rotation = Quaternion.Identity()
  setBoom(LANE_CAM.height, LANE_CAM.south)
  viewPlayerFollowCam()
}

/** Player match cam — world boom whose parent lerps to the avatar. Does not inherit look yaw. */
export function viewPlayer(lane: number): void {
  camFollow = 'player'
  dockFollowLane = lane
  const t = Transform.getMutable(playerCamRoot)
  t.parent = undefined
  t.rotation = Quaternion.Identity()
  const player = Transform.getOrNull(engine.PlayerEntity)
  if (player) {
    t.position.x = player.position.x
    t.position.y = player.position.y
    t.position.z = player.position.z
  } else {
    t.position.x = LANE.x0 + 0.5
    t.position.y = DECK_Y
    t.position.z = laneZ(lane) + LANE.width / 2
  }
  setBoom(PLAYER_CAM.height, PLAYER_CAM.south)
  viewPlayerFollowCam()
}

/** Freeze the boom in world space (water / drown). */
export function detachPlayerCam(): void {
  const t = Transform.getMutable(playerCamRoot)
  t.parent = undefined
  t.rotation = Quaternion.Identity()
}

export function snapHubCam(): void {
  const cam = Transform.getMutable(playerFollowCam)
  cam.parent = undefined
  cam.position.x = HUB_CAM.x
  cam.position.y = HUB_CAM.y
  cam.position.z = HUB_CAM.z
  cam.rotation = Quaternion.fromEulerDegrees(HUB_CAM.pitch, HUB_CAM.yaw, 0)
}

export function viewHub(): void {
  camFollow = 'hub'
  dockFollowLane = null
  snapHubCam()
  viewPlayerFollowCam()
}

export function viewLoot(): void {
  camFollow = 'loot'
  dockFollowLane = null
  MainCamera.createOrReplace(engine.CameraEntity, {
    virtualCameraEntity: lootCam
  })
}

export function isLootCamOn(): boolean {
  return camFollow === 'loot'
}

export function viewCannon(slotX?: number): void {
  camFollow = 'cannon'
  dockFollowLane = null
  if (slotX !== undefined) cannonSlotX = slotX
  cannonShake = 0
  shakeX = 0
  shakeY = 0
  shakeZ = 0
  placeCannonCam(0, 0, 0)
  MainCamera.createOrReplace(engine.CameraEntity, {
    virtualCameraEntity: cannonCam
  })
}

export function punchCannonCam(): void {
  cannonShake = 0.35
}

export function getCannonShake(): { x: number; y: number; z: number } {
  return { x: shakeX, y: shakeY, z: shakeZ }
}

export function tickCannonCam(dt: number): void {
  if (camFollow !== 'cannon') return
  if (cannonShake > 0) cannonShake = Math.max(0, cannonShake - dt)
  const k = cannonShake / 0.35
  const mag = 0.38 * k * k
  shakeX = (Math.random() - 0.5) * mag * 2.4
  shakeY = (Math.random() - 0.25) * mag * 1.6
  shakeZ = (Math.random() - 0.5) * mag
  placeCannonCam(shakeX, shakeY, shakeZ)
}

function placeCannonCam(dx: number, dy: number, dz: number): void {
  const t = Transform.getMutable(cannonCam)
  t.position = Vector3.create(cannonSlotX + dx, CANNON_CAM.y + dy, CANNON_CAM.z + dz)
  t.rotation = Quaternion.fromEulerDegrees(CANNON_CAM.pitch, CANNON_CAM.yaw, 0)
}

export function isCannonCamOn(): boolean {
  return camFollow === 'cannon'
}

export function viewFish(): void {
  camFollow = 'fish'
  dockFollowLane = null
  MainCamera.createOrReplace(engine.CameraEntity, {
    virtualCameraEntity: fishCam
  })
}

export function viewFishHole(x: number, z: number): void {
  camFollow = 'fishview'
  dockFollowLane = null
  fishShake = 0
  fishViewX = x + FISH_VIEW.dx
  fishViewY = FISH_VIEW.y
  fishViewZ = z + FISH_VIEW.dz
  placeFishViewCam(0, 0, 0)
  MainCamera.createOrReplace(engine.CameraEntity, {
    virtualCameraEntity: fishViewCam
  })
}

export function punchFishCam(seconds = 0.28): void {
  fishShake = Math.max(fishShake, seconds)
}

export function tickFishCam(dt: number): void {
  if (camFollow !== 'fishview') return
  if (fishShake > 0) fishShake = Math.max(0, fishShake - dt)
  const k = fishShake / 0.28
  const mag = 0.34 * k * k
  placeFishViewCam(
    (Math.random() - 0.5) * mag * 2.2,
    (Math.random() - 0.25) * mag * 1.5,
    (Math.random() - 0.5) * mag
  )
}

function placeFishViewCam(dx: number, dy: number, dz: number): void {
  const t = Transform.getMutable(fishViewCam)
  t.position = Vector3.create(fishViewX + dx, fishViewY + dy, fishViewZ + dz)
  t.rotation = Quaternion.fromEulerDegrees(FISH_VIEW.pitch, FISH_VIEW.yaw, 0)
}

/** Above water, south of the hole, looking at the player and the catch. */
export function viewFishCatch(x: number, y: number, z: number): void {
  camFollow = 'fishcatch'
  dockFollowLane = null
  const t = Transform.getMutable(fishCatchCam)
  t.position = Vector3.create(x, y + 1.25, z - 4.6)
  t.rotation = Quaternion.fromEulerDegrees(12, 0, 0)
  MainCamera.createOrReplace(engine.CameraEntity, {
    virtualCameraEntity: fishCatchCam
  })
}

export function isFishCamOn(): boolean {
  return camFollow === 'fish' || camFollow === 'fishview' || camFollow === 'fishcatch'
}

export function attachBoardCam(boardPos: Vector3, yaw: number): void {
  const rot = Quaternion.fromEulerDegrees(0, yaw, 0)
  const offset = Vector3.rotate(Vector3.create(0, 0.4, 6.5), rot)
  boardCam = engine.addEntity()
  Transform.create(boardCam, {
    position: Vector3.create(boardPos.x + offset.x, boardPos.y + offset.y, boardPos.z + offset.z),
    rotation: Quaternion.fromEulerDegrees(6, yaw + 180, 0)
  })
  VirtualCamera.create(boardCam, {
    defaultTransition: { transitionMode: VirtualCamera.Transition.Time(0.5) }
  })
  console.log('[BOARD] boardCam spawned', {
    boardCam,
    pos: Transform.get(boardCam).position,
    yaw
  })
}

export function viewBoard(): void {
  camFollow = 'board'
  dockFollowLane = null
  if (boardCam === undefined || boardCam === null) {
    console.log('[BOARD] boardCam missing, abort')
    return
  }
  const t = Transform.getOrNull(boardCam)
  console.log('[BOARD] MainCamera -> boardCam', {
    boardCam,
    pos: t?.position,
    hasVc: VirtualCamera.has(boardCam)
  })
  MainCamera.createOrReplace(engine.CameraEntity, {
    virtualCameraEntity: boardCam
  })
}

export function isBoardCamOn(): boolean {
  return camFollow === 'board'
}

export function viewTutorial(): void {
  camFollow = 'tutorial'
  dockFollowLane = null
  const c = hubCenter()
  const t = Transform.getMutable(tutorialCam)
  t.position = Vector3.create(c.x + TUTORIAL_CAM.dx, HUB.y + TUTORIAL_CAM.dy, c.z + TUTORIAL_CAM.dz)
  t.rotation = Quaternion.fromEulerDegrees(TUTORIAL_CAM.pitch, TUTORIAL_CAM.yaw, 0)
  MainCamera.createOrReplace(engine.CameraEntity, {
    virtualCameraEntity: tutorialCam
  })
}

export function isTutorialCamOn(): boolean {
  return camFollow === 'tutorial'
}

export function restoreFollowCam(): void {
  if (camFollow === 'lane' && dockFollowLane !== null) viewLane(dockFollowLane)
  else if (camFollow === 'player' && dockFollowLane !== null) viewPlayer(dockFollowLane)
  else if (camFollow === 'board') viewBoard()
  else if (camFollow === 'tutorial') viewTutorial()
  else if (camFollow === 'loot') viewLoot()
  else if (camFollow === 'cannon') viewCannon()
  else if (camFollow === 'fish') viewFish()
  else if (camFollow === 'fishview' || camFollow === 'fishcatch') viewFish()
  else viewHub()
}

export function viewPlayerFollowCam(): void {
  MainCamera.createOrReplace(engine.CameraEntity, {
    virtualCameraEntity: playerFollowCam
  })
}

export function viewAdminFlyCam(): void {
  MainCamera.createOrReplace(engine.CameraEntity, {
    virtualCameraEntity: adminFlyCam
  })
}
