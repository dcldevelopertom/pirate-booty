import { Vector3 } from '@dcl/sdk/math'
import { DECK_Y, HUB, HUB_SPAWN, LANE, MATCH, PUB, SHIP } from '../config'

export function laneZ(i: number): number {
  if (i <= 0) return LANE.z0
  const north = SHIP.z0 + SHIP.sz + LANE.gap
  return north + (i - 1) * (LANE.width + LANE.gap)
}

/** Southwest corner of the lane deck, at deck height. +X is race direction. */
export function laneOrigin(i: number): Vector3 {
  return Vector3.create(LANE.x0, DECK_Y, laneZ(i))
}

export function laneCenter(i: number): Vector3 {
  return Vector3.create(LANE.x0 + LANE.length / 2, DECK_Y, laneZ(i) + LANE.width / 2)
}

/** On-deck spawn past the first collapsing rows, spread by seat. */
export function laneSpawn(
  i: number,
  slot = 0
): { x: number; y: number; z: number; lookX: number; lookY: number; lookZ: number } {
  const y = DECK_Y + LANE.rowHeight - LANE.colliderDrop + LANE.colliderLift + 0.6
  const spread = (slot - (MATCH.maxPlayers - 1) / 2) * 1.6
  const z = laneZ(i) + LANE.width / 2 + spread
  return {
    x: LANE.x0 + 10,
    y,
    z,
    lookX: LANE.x0 + 40,
    lookY: y,
    lookZ: z
  }
}

/** On the finish pad, facing down-lane. Dead players wait here. */
export function laneFinishWait(
  i: number,
  slot = 0
): { x: number; y: number; z: number; lookX: number; lookY: number; lookZ: number } {
  const y = DECK_Y + LANE.rowHeight - LANE.colliderDrop + LANE.colliderLift + 0.6
  const spread = (slot - (MATCH.maxPlayers - 1) / 2) * 1.6
  const z = laneZ(i) + LANE.width / 2 + spread
  const x = LANE.x0 + LANE.length + 3
  return {
    x,
    y,
    z,
    lookX: x + 16,
    lookY: y,
    lookZ: z
  }
}

export function hubCenter(): Vector3 {
  return Vector3.create(HUB.x0 + HUB.sx / 2, HUB.y, HUB.z0 + HUB.sz / 2)
}

/** Spread bots on the hub deck, facing the docks. */
export function hubBotPose(index: number): { x: number; y: number; z: number } {
  const cols = 4
  const col = index % cols
  const row = Math.floor(index / cols)
  const x = HUB_SPAWN.xMin + 1.5 + col * 1.5
  const z = HUB_SPAWN.zMin + 1.5 + row * 1.5
  return {
    x: Math.min(x, HUB_SPAWN.xMax - 1),
    y: HUB_SPAWN.y,
    z: Math.min(z, HUB_SPAWN.zMax - 1)
  }
}

export function pubCenter(): Vector3 {
  return Vector3.create(PUB.x0 + PUB.sx / 2, DECK_Y, PUB.z0 + PUB.sz / 2)
}

export function shipCenter(): Vector3 {
  return Vector3.create(SHIP.x0 + SHIP.sx / 2, SHIP.deckY, SHIP.z0 + SHIP.sz / 2)
}
