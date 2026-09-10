import { Entity, Material, MeshCollider, MeshRenderer, Transform, TriggerArea, engine } from '@dcl/sdk/ecs'
import { syncEntity } from '@dcl/sdk/network'
import { Vector3 } from '@dcl/sdk/math'
import { LANE, OBSTACLE, takePlaySync } from '../../config'
import { PALETTE } from '../../world/palette'
import { laneZ } from '../../world/layout'
import { paint } from '../../world/primitives'
import { obstacleSitY } from './Rows'

export type ObstacleSpec = { x: number; z: number; sx: number; sy: number; sz: number; skin: number }

const SKIN_BARREL = 0
const SKIN_CRATE = 1

const SHAPES = [
  { sx: 1, sy: 1, sz: 1 },
  { sx: 2, sy: 1, sz: 1 },
  { sx: 1, sy: 2, sz: 1 },
  { sx: 1, sy: 1, sz: 3 },
  { sx: 1, sy: 1, sz: 4 },
  { sx: 2, sy: 1, sz: 2 }
] as const

type Piece = {
  entity: Entity
  x0: number
  x1: number
}

const layouts: Array<{ seed: number; pieces: ObstacleSpec[] } | null> = [null, null, null, null]
let countBias = 0

export function bumpObstacleDifficulty(delta: number): { min: number; max: number } {
  countBias = Math.max(-32, Math.min(80, countBias + delta))
  return getObstacleRange()
}

export function getObstacleRange(): { min: number; max: number } {
  const min = Math.max(4, OBSTACLE.countMin + countBias)
  const max = Math.max(min, OBSTACLE.countMax + countBias)
  return { min, max }
}

export function setLaneLayout(lane: number, seed: number, pieces: ObstacleSpec[]): void {
  layouts[lane] = { seed, pieces: pieces.slice() }
}

export function getLaneLayout(lane: number): { seed: number; pieces: ObstacleSpec[] } | null {
  return layouts[lane]
}

const piecesByLane: Piece[][] = [[], [], [], []]

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateObstacleLayout(seed: number): ObstacleSpec[] {
  const rand = mulberry32(seed)
  const w = LANE.width
  const len = LANE.length
  const occ: boolean[][] = []
  for (let x = 0; x < len; x++) {
    occ[x] = []
    for (let z = 0; z < w; z++) occ[x][z] = false
  }

  const range = getObstacleRange()
  const count = range.min + Math.floor(rand() * (range.max - range.min + 1))
  const out: ObstacleSpec[] = []
  const maxX = len - OBSTACLE.clearFinish

  for (let n = 0; n < count; n++) {
    let placed = false
    for (let attempt = 0; attempt < 120 && !placed; attempt++) {
      const shape = SHAPES[Math.floor(rand() * SHAPES.length)]
      const x = OBSTACLE.clearStart + Math.floor(rand() * Math.max(1, maxX - OBSTACLE.clearStart - shape.sx + 1))
      const z = Math.floor(rand() * (w - shape.sz + 1))
      if (!fits(occ, x, z, shape.sx, shape.sz)) continue
      if (!keepsGap(occ, x, z, shape.sx, shape.sz)) continue
      stamp(occ, x, z, shape.sx, shape.sz)
      out.push({ x, z, sx: shape.sx, sy: shape.sy, sz: shape.sz, skin: pickSkin(shape, rand) })
      placed = true
    }
  }
  return out
}

function pickSkin(shape: { sx: number; sy: number; sz: number }, rand: () => number): number {
  if (shape.sx >= 2 && shape.sy === 1) return SKIN_CRATE
  if (shape.sy === 2) return rand() < 0.5 ? SKIN_CRATE : SKIN_BARREL
  if (shape.sx === 1 && shape.sy === 1 && shape.sz === 1) return rand() < 0.5 ? SKIN_CRATE : SKIN_BARREL
  return rand() < 0.4 ? SKIN_CRATE : SKIN_BARREL
}

export function clearObstacles(lane: number): void {
  for (const p of piecesByLane[lane]) {
    if (Transform.has(p.entity)) engine.removeEntity(p.entity)
  }
  piecesByLane[lane] = []
}

export function buildObstacles(lane: number, seed: number): Entity[] {
  clearObstacles(lane)
  const layout = generateObstacleLayout(seed)
  const entities: Entity[] = []
  for (let i = 0; i < layout.length; i++) {
    const spec = layout[i]
    const e = spawnPiece(lane, spec, i)
    piecesByLane[lane].push({ entity: e, x0: spec.x, x1: spec.x + spec.sx })
    entities.push(e)
  }
  return entities
}

export function sinkRemainingObstacles(lane: number): void {
  for (const p of piecesByLane[lane]) {
    if (Transform.has(p.entity)) engine.removeEntity(p.entity)
  }
  piecesByLane[lane] = []
}

export function sinkObstaclesOnRow(lane: number, rowIndex: number): void {
  const x0 = rowIndex * LANE.rowDepth
  const x1 = x0 + LANE.rowDepth
  const keep: Piece[] = []
  for (const p of piecesByLane[lane]) {
    if (p.x0 < x1 && p.x1 > x0) {
      if (Transform.has(p.entity)) engine.removeEntity(p.entity)
    } else {
      keep.push(p)
    }
  }
  piecesByLane[lane] = keep
}

let nextObstacleSyncId = 500000

function spawnPiece(
  lane: number,
  spec: { x: number; z: number; sx: number; sy: number; sz: number },
  index: number
): Entity {
  const e = engine.addEntity()
  Transform.create(e, {
    position: Vector3.create(
      LANE.x0 + spec.x + spec.sx / 2,
      obstacleSitY(spec.sy),
      laneZ(lane) + spec.z + spec.sz / 2
    ),
    scale: Vector3.create(spec.sx, spec.sy, spec.sz)
  })
  MeshRenderer.setBox(e)
  MeshCollider.setBox(e)
  paint(e, PALETTE.WOOD_DARK)
  syncEntity(
    e,
    [Transform.componentId, MeshRenderer.componentId, MeshCollider.componentId, Material.componentId],
    nextObstacleSyncId++
  )
  return e
}

function fits(occ: boolean[][], x: number, z: number, sx: number, sz: number): boolean {
  if (x < 0 || z < 0 || x + sx > LANE.length || z + sz > LANE.width) return false
  for (let i = 0; i < sx; i++) {
    for (let j = 0; j < sz; j++) {
      if (occ[x + i][z + j]) return false
    }
  }
  return true
}

function keepsGap(occ: boolean[][], x: number, z: number, sx: number, sz: number): boolean {
  for (let i = 0; i < sx; i++) {
    let free = 0
    for (let j = 0; j < LANE.width; j++) {
      const blocked = occ[x + i][j] || (j >= z && j < z + sz)
      if (!blocked) free++
    }
    if (free < OBSTACLE.minGapCells) return false
  }
  return true
}

function stamp(occ: boolean[][], x: number, z: number, sx: number, sz: number): void {
  for (let i = 0; i < sx; i++) {
    for (let j = 0; j < sz; j++) occ[x + i][z + j] = true
  }
}

export function spawnVolumes(parent: Entity, lane: number): { finish: Entity; stripes: Entity[] } {
  const midZ = LANE.width / 2
  const finish = engine.addEntity()
  Transform.create(finish, {
    parent,
    position: Vector3.create(LANE.length - 2, 1.5, midZ),
    scale: Vector3.create(2, 3, LANE.width)
  })
  TriggerArea.setBox(finish)
  syncEntity(finish, [Transform.componentId], takePlaySync())

  const startStripe = stripe(parent, 1, lane, takePlaySync(), PALETTE.CREAM)

  return { finish, stripes: [startStripe] }
}

function stripe(parent: Entity, x: number, _lane: number, id: number, color: typeof PALETTE.CREAM): Entity {
  const e = engine.addEntity()
  Transform.create(e, {
    parent,
    position: Vector3.create(x, 0.2, LANE.width / 2),
    scale: Vector3.create(1, 0.05, LANE.width)
  })
  MeshRenderer.setBox(e)
  paint(e, color)
  syncEntity(e, [Transform.componentId, MeshRenderer.componentId, Material.componentId], id)
  return e
}
