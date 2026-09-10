import { EasingFunction, Entity, MeshCollider, Transform, Tween, engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { LANE, RACE } from '../config'
import { attachDeckSliver } from '../games/barrel/RowVisuals'
import { rowFallToWater } from '../games/barrel/Rows'
import { laneOrigin } from './layout'

const finishPads: Entity[][] = [[], [], [], []]
const padDropped = [false, false, false, false]

/** Deck shells for unloaded lanes. Lane 0 is the live Deck Dodge dock. */
export const shellDecks: Array<Entity | null> = [null, null, null, null]
export const laneRoots: Entity[] = []

export function buildDockLanes(): void {
  for (let i = 0; i < LANE.count; i++) {
    const root = engine.addEntity()
    Transform.create(root, { position: laneOrigin(i) })
    laneRoots[i] = root
    padDropped[i] = false
    if (i === 0) spawnFinishPad(root, i, LANE.width / 2)
  }
}

function spawnSliverRow(root: Entity, localX: number, midZ: number): Entity {
  const pad = engine.addEntity()
  Transform.create(pad, {
    parent: root,
    position: Vector3.create(localX, LANE.rowHeight / 2 - LANE.colliderDrop + LANE.colliderLift, midZ),
    scale: Vector3.create(LANE.rowDepth, LANE.rowHeight, LANE.width)
  })
  MeshCollider.setBox(pad)
  attachDeckSliver(pad)
  return pad
}

function spawnFinishPad(root: Entity, lane: number, midZ: number): void {
  finishPads[lane] = []
  const pieces = Math.round(LANE.finishPad / LANE.rowDepth)
  for (let i = 0; i < pieces; i++) {
    finishPads[lane].push(spawnSliverRow(root, LANE.length + i * LANE.rowDepth + LANE.rowDepth / 2, midZ))
  }
}

export function dropFinishPad(lane: number): void {
  if (lane < 0 || lane >= LANE.count || padDropped[lane]) return
  padDropped[lane] = true
  const ms = Math.max(80, (rowFallToWater() / RACE.fallMps) * 1000)
  for (const pad of finishPads[lane]) {
    if (!Transform.has(pad)) continue
    const t = Transform.get(pad)
    const from = Vector3.create(t.position.x, t.position.y, t.position.z)
    const to = Vector3.create(from.x, from.y - rowFallToWater(), from.z)
    Tween.setMove(pad, from, to, ms, EasingFunction.EF_LINEAR)
  }
}

export function resetFinishPad(lane: number): void {
  padDropped[lane] = false
  const restY = LANE.rowHeight / 2 - LANE.colliderDrop + LANE.colliderLift
  for (const pad of finishPads[lane] ?? []) {
    if (!Transform.has(pad)) continue
    if (Tween.has(pad)) Tween.deleteFrom(pad)
    Transform.getMutable(pad).position.y = restY
  }
}

export function setShellDeckVisible(lane: number, visible: boolean): void {
  const deck = shellDecks[lane]
  if (!deck) return
  const t = Transform.getMutable(deck)
  t.scale = visible
    ? Vector3.create(LANE.length, 0.35, LANE.width)
    : Vector3.Zero()
}
