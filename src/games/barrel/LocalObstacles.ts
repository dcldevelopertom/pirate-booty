import { ColliderLayer, EasingFunction, Entity, GltfContainer, MeshCollider, Transform, Tween, engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { LANE, OBSTACLE, RACE, WATER_Y } from '../../config'
import { room } from '../../net/messages'
import { laneZ } from '../../world/layout'
import { isBoundLane } from '../shared/viewing'
import { ObstacleSpec } from './Obstacles'
import { obstacleSitY } from './Rows'

type LocalPiece = {
  entity: Entity
  x0: number
  x1: number
}

const locals: LocalPiece[] = []
const cached: ObstacleSpec[][] = [[], [], [], []]
let boundLane = -1

export function registerLocalObstacles(): void {
  room.onMessage('rowSunk', (data) => {
    if (data.laneId !== boundLane) return
    sinkLocalOnRow(data.index)
  })
  room.onMessage('laneCleared', (data) => {
    cached[data.laneId] = []
    if (data.laneId === boundLane) clearLocal()
  })
  room.onMessage('finishDrop', (data) => {
    if (data.laneId !== boundLane) return
    sinkAllLocal()
  })
}

export function applyLayout(lane: number, specs: ObstacleSpec[]): void {
  cached[lane] = specs.slice()
  if (!isBoundLane(lane) && boundLane !== lane) return
  spawnLane(lane, specs)
}

export function spawnBoundObstacles(lane: number): void {
  spawnLane(lane, cached[lane] ?? [])
}

function spawnLane(lane: number, specs: ObstacleSpec[]): void {
  clearLocal()
  boundLane = lane
  for (const spec of specs) {
    locals.push({
      entity: spawnBarrelStack(lane, spec),
      x0: spec.x,
      x1: spec.x + spec.sx
    })
  }
}

function spawnBarrelStack(lane: number, spec: ObstacleSpec): Entity {
  const root = engine.addEntity()
  Transform.create(root, {
    position: Vector3.create(
      LANE.x0 + spec.x + spec.sx / 2,
      obstacleSitY(spec.sy),
      laneZ(lane) + spec.z + spec.sz / 2
    ),
    scale: Vector3.create(spec.sx, spec.sy, spec.sz)
  })
  MeshCollider.setBox(root)

  for (let iy = 0; iy < spec.sy; iy++) {
    for (let ix = 0; ix < spec.sx; ix++) {
      for (let iz = 0; iz < spec.sz; iz++) {
        const visual = engine.addEntity()
        Transform.create(visual, {
          parent: root,
          position: Vector3.create(
            (ix + 0.5) / spec.sx - 0.5,
            (iy + 0.5) / spec.sy - 0.5,
            (iz + 0.5) / spec.sz - 0.5
          ),
          scale: Vector3.create(1 / spec.sx, 1 / spec.sy, 1 / spec.sz)
        })
        GltfContainer.create(visual, {
          src: spec.skin === 1 ? OBSTACLE.crate : OBSTACLE.barrel,
          visibleMeshesCollisionMask: ColliderLayer.CL_NONE,
          invisibleMeshesCollisionMask: ColliderLayer.CL_NONE
        })
      }
    }
  }
  return root
}

export function clearLocal(): void {
  for (const p of locals) {
    if (Transform.has(p.entity)) engine.removeEntityWithChildren(p.entity)
  }
  locals.length = 0
  boundLane = -1
}

function sinkAllLocal(): void {
  const ms = Math.max(80, ((obstacleSitY(1) - WATER_Y) / RACE.fallMps) * 1000)
  for (const p of locals) {
    if (!Transform.has(p.entity)) continue
    const t = Transform.get(p.entity)
    const from = Vector3.create(t.position.x, t.position.y, t.position.z)
    const to = Vector3.create(from.x, WATER_Y, from.z)
    Tween.setMove(p.entity, from, to, ms, EasingFunction.EF_LINEAR)
  }
}

function sinkLocalOnRow(rowIndex: number): void {
  const x0 = rowIndex * LANE.rowDepth
  const x1 = x0 + LANE.rowDepth
  const keep: LocalPiece[] = []
  for (const p of locals) {
    if (p.x0 < x1 && p.x1 > x0) {
      if (Transform.has(p.entity)) engine.removeEntityWithChildren(p.entity)
    } else {
      keep.push(p)
    }
  }
  locals.length = 0
  for (const p of keep) locals.push(p)
}
