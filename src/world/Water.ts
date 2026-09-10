import {
  ColliderLayer,
  engine,
  Material,
  MaterialTransparencyMode,
  MeshCollider,
  MeshRenderer,
  TextureWrapMode,
  Transform,
  Tween
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector2, Vector3 } from '@dcl/sdk/math'
import { GROUND_Y, WATER_Y, WORLD_SIZE } from '../config'
import { PALETTE } from './palette'

/** Live Genesis Plaza 0,0 rooftop-pool water (`nq` in their bin). */
const PLAZA_WATER_NORMAL = 'assets/textures/poolBake_normal.png'
const PLAZA_TILE_METERS = 16

export function buildWater(): void {
  const half = WORLD_SIZE / 2
  const floor = engine.addEntity()
  Transform.create(floor, {
    position: Vector3.create(half, GROUND_Y, half),
    rotation: Quaternion.fromEulerDegrees(90, 0, 0),
    scale: Vector3.create(WORLD_SIZE, WORLD_SIZE, 1)
  })
  MeshRenderer.setPlane(floor)
  MeshCollider.setPlane(floor, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(floor, {
    albedoColor: PALETTE.SAND,
    emissiveColor: Color3.create(0.22, 0.16, 0.08),
    emissiveIntensity: 0.18,
    roughness: 0.92,
    metallic: 0
  })

  const tiles = WORLD_SIZE / PLAZA_TILE_METERS
  const water = engine.addEntity()
  Transform.create(water, {
    position: Vector3.create(half, WATER_Y + 0.5, half),
    rotation: Quaternion.fromEulerDegrees(90, 0, 0),
    scale: Vector3.create(WORLD_SIZE + 10, WORLD_SIZE, 1)
  })
  MeshRenderer.setPlane(water)
  Material.setPbrMaterial(water, {
    castShadows: false,
    roughness: 0.22,
    metallic: 0.08,
    albedoColor: Color4.create(0.12, 0.48, 0.78, 0.88),
    emissiveColor: Color3.create(0.04, 0.22, 0.38),
    emissiveIntensity: 0.28,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
    texture: Material.Texture.Common({
      src: PLAZA_WATER_NORMAL,
      wrapMode: TextureWrapMode.TWM_REPEAT,
      tiling: Vector2.create(tiles, tiles)
    })
  })
  Tween.setTextureMoveContinuous(water, Vector2.create(1, 1), 0.03)
}
