import { Entity, Transform, engine } from '@dcl/sdk/ecs'
import { isServer, syncEntity } from '@dcl/sdk/network'
import { AUTH_SERVER_PEER_ID } from '@dcl/sdk/network/message-bus-sync'
import { LANE, SYNC_ID } from '../../config'
import { LaneState } from '../../net/schemas'
import { laneOrigin } from '../../world/layout'
import { spawnBarrel } from './Boulder'
import { clearObstacles, spawnVolumes } from './Obstacles'
import { bumpLaneGen } from './Rows'
import { sendOpts } from '../../net/audience'
import { room } from '../../net/messages'

type LanePack = {
  root: Entity
  rows: Entity[]
  barrel: Entity
  obstacles: Entity[]
  extras: Entity[]
}

const packs: Array<LanePack | null> = [null, null, null, null]
let stateEntity: Entity
let onFreed: (lane: number) => void = () => {}

export function setFreeHandler(fn: (lane: number) => void): void {
  onFreed = fn
}

export function initLanePool(): void {
  if (!isServer()) return

  stateEntity = engine.addEntity()
  LaneState.create(stateEntity, {
    loaded0: false,
    loaded1: false,
    loaded2: false,
    loaded3: false,
    phase0: 'empty',
    phase1: 'empty',
    phase2: 'empty',
    phase3: 'empty'
  })
  LaneState.validateBeforeChange((value) => value.senderAddress === AUTH_SERVER_PEER_ID)
  syncEntity(stateEntity, [LaneState.componentId], SYNC_ID.LANE_STATE)
}

export function allocate(lane: number): void {
  if (!isServer()) return
  if (lane < 0 || lane >= LANE.count) return
  if (packs[lane]) return

  const root = engine.addEntity()
  Transform.create(root, { position: laneOrigin(lane) })

  const barrel = spawnBarrel(root, lane)
  const volumes = spawnVolumes(root, lane)

  packs[lane] = {
    root,
    rows: [],
    barrel,
    obstacles: [],
    extras: [volumes.finish, ...volumes.stripes]
  }
  setPhase(lane, 'idle')
  const opts = sendOpts(lane)
  const cleared = { laneId: lane, gen: bumpLaneGen(lane) }
  if (opts) room.send('laneCleared', cleared, opts)
  console.log('[SERVER] allocated lane', lane)
}

export function free(lane: number): void {
  if (!isServer()) return
  const pack = packs[lane]
  if (!pack) return

  clearObstacles(lane)
  for (const e of pack.rows) engine.removeEntity(e)
  for (const e of pack.obstacles) engine.removeEntity(e)
  for (const e of pack.extras) engine.removeEntity(e)
  engine.removeEntity(pack.barrel)
  engine.removeEntity(pack.root)
  packs[lane] = null
  setPhase(lane, 'empty')
  console.log('[SERVER] freed lane', lane)
  onFreed(lane)
}

export function restart(lane: number): void {
  free(lane)
  allocate(lane)
}

export function loadAll(): void {
  for (let i = 0; i < LANE.count; i++) allocate(i)
}

export function unloadAll(): void {
  for (let i = 0; i < LANE.count; i++) free(i)
}

export function restartAllLoaded(): void {
  for (let i = 0; i < LANE.count; i++) {
    if (packs[i]) restart(i)
  }
}

export function resetGames(): void {
  unloadAll()
  if (LANE.defaultLoaded >= 0) allocate(LANE.defaultLoaded)
}

export function getLanePack(lane: number): LanePack | null {
  return packs[lane]
}

export function isLaneAllocated(lane: number): boolean {
  return packs[lane] !== null
}

export function setPhase(lane: number, phase: string): void {
  const s = LaneState.getMutable(stateEntity)
  const loaded = phase !== 'empty'
  if (lane === 0) {
    s.loaded0 = loaded
    s.phase0 = phase
  } else if (lane === 1) {
    s.loaded1 = loaded
    s.phase1 = phase
  } else if (lane === 2) {
    s.loaded2 = loaded
    s.phase2 = phase
  } else {
    s.loaded3 = loaded
    s.phase3 = phase
  }
}
