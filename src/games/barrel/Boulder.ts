import { ColliderLayer, Entity, GltfContainer, MeshCollider, Transform, Tween, engine } from '@dcl/sdk/ecs'
import { syncEntity } from '@dcl/sdk/network'
import { isMobile } from '@dcl/sdk/platform'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { BARREL, DECK_Y, LANE, OBSTACLE, takePlaySync } from '../../config'
import { laneZ } from '../../world/layout'
import { BarrelMark } from '../../net/schemas'
import { isBoundLane } from '../shared/viewing'

export function barrelWorldPosition(lane: number, localX: number): Vector3 {
  return Vector3.create(LANE.x0 + localX, DECK_Y + BARREL.height / 2 + 0.2 - 1, laneZ(lane) + LANE.width / 2)
}

export function spawnBarrel(_parent: Entity, lane: number): Entity {
  const e = engine.addEntity()
  Transform.create(e, { position: barrelWorldPosition(lane, BARREL.startX) })
  BarrelMark.create(e, { lane })
  syncEntity(e, [Transform.componentId, BarrelMark.componentId], takePlaySync())
  return e
}

export function writeBarrelPose(barrel: Entity, lane: number, localX: number, _rollDeg: number, fallY = 0): void {
  const t = Transform.getMutable(barrel)
  const p = barrelWorldPosition(lane, localX)
  t.position.x = p.x
  t.position.y = p.y - fallY
  t.position.z = p.z
  t.rotation = Quaternion.Identity()
}

const dressed = new Map<Entity, Entity>()
let rollOnMobile = false

function barrelRollDirection(): Quaternion {
  return isMobile()
    ? Quaternion.fromEulerDegrees(-90, 0, 0)
    : Quaternion.fromEulerDegrees(0, 0, -90)
}

export function registerBarrelVisuals(): void {
  engine.addSystem(() => {
    const mobile = isMobile()
    if (mobile !== rollOnMobile) {
      rollOnMobile = mobile
      for (const [root, vis] of dressed) {
        if (Transform.has(vis)) engine.removeEntityWithChildren(vis)
        dressed.delete(root)
      }
    }
    for (const [root, mark] of engine.getEntitiesWith(BarrelMark, Transform)) {
      const want = isBoundLane(mark.lane)
      const vis = dressed.get(root)
      if (want && !vis) dressed.set(root, attachBarrelLine(root, mark.lane))
      if (!want && vis) {
        if (Transform.has(vis)) engine.removeEntityWithChildren(vis)
        dressed.delete(root)
      }
      if (want) stripHitIfPastFinish(root)
    }
  }, -45, 'barrel-visuals')
}

function stripHitIfPastFinish(root: Entity): void {
  const t = Transform.getOrNull(root)
  if (!t) return
  if (t.position.x - LANE.x0 < LANE.length) return
  const vis = dressed.get(root)
  if (!vis || !Transform.has(vis)) return
  for (const [e, , tr] of engine.getEntitiesWith(MeshCollider, Transform)) {
    if (e !== vis && tr.parent !== vis) continue
    MeshCollider.deleteFrom(e)
  }
}

export function undressOtherBarrels(_keepLane: number): void {
  for (const [root, vis] of dressed) {
    const mark = BarrelMark.getOrNull(root)
    if (mark && isBoundLane(mark.lane)) continue
    if (Transform.has(vis)) engine.removeEntityWithChildren(vis)
    dressed.delete(root)
  }
}

function attachBarrelLine(root: Entity, _lane: number): Entity {
  const vis = engine.addEntity()
  Transform.create(vis, { parent: root })
  const count = Math.max(1, Math.round(LANE.width / 2))
  const spacing = LANE.width / count
  const hit = engine.addEntity()
  Transform.create(hit, {
    parent: vis,
    scale: Vector3.create(2.4, 2.4, LANE.width)
  })
  MeshCollider.setBox(hit)

  const mid = (count - 1) / 2
  for (let i = 0; i < count; i++) {
    const spinner = engine.addEntity()
    Transform.create(spinner, {
      parent: vis,
      position: Vector3.create(0, 0, (i - mid) * spacing),
      scale: Vector3.create(2, 2, 2)
    })
    Tween.setRotateContinuous(spinner, barrelRollDirection(), BARREL.rollSpeed)

    const mesh = engine.addEntity()
    Transform.create(mesh, {
      parent: spinner,
      rotation: Quaternion.fromEulerDegrees(0, 90, 90)
    })
    GltfContainer.create(mesh, {
      src: OBSTACLE.barrel,
      visibleMeshesCollisionMask: ColliderLayer.CL_NONE,
      invisibleMeshesCollisionMask: ColliderLayer.CL_NONE
    })
  }
  return vis
}
