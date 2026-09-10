import {
  Entity,
  Material,
  MaterialTransparencyMode,
  MeshCollider,
  MeshRenderer,
  TextShape,
  Transform,
  TriggerArea,
  engine
} from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

export type ColliderMode = 'solid' | 'none'

export function box(
  parent: Entity | undefined,
  position: Vector3,
  scale: Vector3,
  color: Color4,
  collider: ColliderMode = 'solid'
): Entity {
  const e = engine.addEntity()
  Transform.create(e, {
    parent,
    position,
    scale
  })
  MeshRenderer.setBox(e)
  if (collider === 'solid') MeshCollider.setBox(e)
  paint(e, color)
  return e
}

export function cylinder(
  parent: Entity | undefined,
  position: Vector3,
  scale: Vector3,
  color: Color4,
  collider: ColliderMode = 'solid'
): Entity {
  const e = engine.addEntity()
  Transform.create(e, {
    parent,
    position,
    scale
  })
  MeshRenderer.setCylinder(e)
  if (collider === 'solid') MeshCollider.setCylinder(e)
  paint(e, color)
  return e
}

export function triggerBox(parent: Entity | undefined, position: Vector3, scale: Vector3, color?: Color4): Entity {
  const e = engine.addEntity()
  Transform.create(e, {
    parent,
    position,
    scale
  })
  TriggerArea.setBox(e)
  if (color) {
    MeshRenderer.setBox(e)
    paint(e, color)
  }
  return e
}

export function label(
  parent: Entity | undefined,
  position: Vector3,
  text: string,
  fontSize = 3,
  color: Color4 = Color4.White(),
  euler: Vector3 = Vector3.Zero()
): Entity {
  const e = engine.addEntity()
  Transform.create(e, {
    parent,
    position,
    rotation: Quaternion.fromEulerDegrees(euler.x, euler.y, euler.z)
  })
  TextShape.create(e, {
    text,
    fontSize,
    textColor: color
  })
  return e
}

export function paint(entity: Entity, color: Color4, metallic = 0, roughness = 0.85): void {
  Material.setPbrMaterial(entity, {
    albedoColor: color,
    metallic,
    roughness,
    transparencyMode: color.a < 0.99 ? MaterialTransparencyMode.MTM_ALPHA_BLEND : MaterialTransparencyMode.MTM_OPAQUE
  })
}
