import { EasingFunction, Entity, MeshCollider, Transform, Tween, engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { DECK_Y, LANE, RACE, WATER_Y } from '../../config'
import { RowMark } from '../../net/schemas'
import { laneZ } from '../../world/layout'

export function rowRestY(): number {
  return DECK_Y + LANE.rowHeight / 2 - LANE.colliderDrop + LANE.colliderLift
}

/** Sit crates on the lowered sliver top, not the original deck height. */
export function obstacleSitY(sy: number): number {
  return rowRestY() + LANE.rowHeight / 2 - LANE.sliverDrop + sy / 2
}

/** Fall distance until the sliver's bottom sits on the water line. */
export function rowFallToWater(): number {
  const toWater = rowRestY() - LANE.rowHeight / 2 - WATER_Y
  // Colliders already sit on the waterline — still drop a full sliver so they animate.
  return Math.max(toWater, LANE.rowHeight)
}

export function rowWorldPosition(lane: number, index: number, fallY: number): Vector3 {
  return Vector3.create(LANE.x0 + index * LANE.rowDepth + LANE.rowDepth / 2, rowRestY() - fallY, laneZ(lane) + LANE.width / 2)
}

const laneGen = [0, 0, 0, 0]

export function bumpLaneGen(lane: number): number {
  laneGen[lane] += 1
  return laneGen[lane]
}

export function currentLaneGen(lane: number): number {
  return laneGen[lane]
}

/** Client-only row. Server never syncs these — it only sends drop/sunk. */
export function spawnLocalRow(lane: number, index: number, gen: number): Entity {
  const e = engine.addEntity()
  Transform.create(e, {
    position: rowWorldPosition(lane, index, 0),
    scale: Vector3.create(LANE.rowDepth, LANE.rowHeight, LANE.width)
  })
  MeshCollider.setBox(e)
  RowMark.create(e, { lane, index, gen })
  return e
}

export function startRowFall(row: Entity, lane: number, index: number): void {
  if (!Transform.has(row)) return
  const from = rowWorldPosition(lane, index, 0)
  const to = rowWorldPosition(lane, index, rowFallToWater())
  const ms = Math.max(80, (rowFallToWater() / RACE.fallMps) * 1000)
  Tween.setMove(row, from, to, ms, EasingFunction.EF_LINEAR)
}
