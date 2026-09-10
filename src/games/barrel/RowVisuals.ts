import { ColliderLayer, Entity, GltfContainer, Transform, engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { LANE } from '../../config'
import { room } from '../../net/messages'
import { isBoundLane } from '../shared/viewing'
import { spawnLocalRow, startRowFall } from './Rows'

const localRows: Array<Array<Entity | null>> = [[], [], [], []]

export function registerRowVisuals(): void {
  room.onMessage('laneCleared', (data) => {
    if (!isBoundLane(data.laneId)) return
    rebuildLocalLane(data.laneId, data.gen)
  })
  room.onMessage('rowDrop', (data) => {
    if (!isBoundLane(data.laneId)) return
    const row = localRows[data.laneId]?.[data.index]
    if (row && Transform.has(row)) startRowFall(row, data.laneId, data.index)
  })
  room.onMessage('rowSunk', (data) => {
    if (!isBoundLane(data.laneId)) return
    const row = localRows[data.laneId]?.[data.index]
    if (!row) return
    if (Transform.has(row)) engine.removeEntityWithChildren(row)
    localRows[data.laneId][data.index] = null
  })
}

export function rebuildLocalLane(lane: number, gen: number): void {
  wipeLane(lane)
  const rows: Array<Entity | null> = []
  for (let i = 0; i < LANE.rowCount; i++) {
    const row = spawnLocalRow(lane, i, gen)
    attachDeckSliver(row)
    rows.push(row)
  }
  localRows[lane] = rows
}

export function wipeLane(lane: number): void {
  for (const row of localRows[lane] ?? []) {
    if (row && Transform.has(row)) engine.removeEntityWithChildren(row)
  }
  localRows[lane] = []
}

export function wipeAllLanes(): void {
  for (let i = 0; i < LANE.count; i++) wipeLane(i)
}

export function applyFallen(lane: number, dropped: number, sunk: number): void {
  const rows = localRows[lane]
  if (!rows || rows.length === 0) return
  for (let i = 0; i < sunk && i < rows.length; i++) {
    const row = rows[i]
    if (row && Transform.has(row)) engine.removeEntityWithChildren(row)
    rows[i] = null
  }
  for (let i = sunk; i < dropped && i < rows.length; i++) {
    const row = rows[i]
    if (row && Transform.has(row)) startRowFall(row, lane, i)
  }
}

export function attachDeckSliver(parent: Entity): Entity {
  const visual = engine.addEntity()
  const parentScale = Transform.get(parent).scale
  Transform.create(visual, {
    parent,
    position: Vector3.create(0, -LANE.sliverDrop / parentScale.y, 0),
    scale: Vector3.create(1 / parentScale.x, 1 / parentScale.y, 1 / parentScale.z)
  })
  GltfContainer.create(visual, {
    src: LANE.rowModel,
    visibleMeshesCollisionMask: ColliderLayer.CL_NONE,
    invisibleMeshesCollisionMask: ColliderLayer.CL_NONE
  })
  return visual
}
