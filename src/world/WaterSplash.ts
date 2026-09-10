import {
  Billboard,
  Entity,
  Material,
  MaterialTransparencyMode,
  MeshRenderer,
  TextureWrapMode,
  Transform,
  VisibilityComponent,
  engine
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { WATER_Y } from '../config'
import { playSplashSound } from './Audio'

const CROWN = 'assets/textures/splash2.png'
const RING = 'assets/textures/splash-horizontal.png'

type Sheet = {
  entity: Entity
  countU: number
  countV: number
  frame: number
  start: number
  end: number
  fps: number
  elapsed: number
  delay: number
  active: boolean
  temp?: boolean
}

let crown: Entity | null = null
let ring: Entity | null = null
let sheets: Sheet[] = []

export function buildWaterSplash(): void {
  crown = makePlane(CROWN, true)
  ring = makePlane(RING, false)
}

export function playWaterSplash(x: number, z: number): void {
  playSplashSound(x, z)
  if (!crown || !ring) buildWaterSplash()
  if (!crown || !ring) return

  const ct = Transform.getMutable(crown)
  ct.position = Vector3.create(x, WATER_Y + 0.4, z)
  ct.scale = Vector3.create(4, 3, 1)
  playSheet(crown, 3, 3, 0, 8, 24, 0)

  const rt = Transform.getMutable(ring)
  rt.position = Vector3.create(x, WATER_Y, z)
  rt.rotation = Quaternion.fromEulerDegrees(90, Math.random() * 360, 0)
  rt.scale = Vector3.create(4.5, 4.5, 1)
  playSheet(ring, 3, 3, 0, 8, 16, 0.15)
}

let lastSplashX = 0
let lastSplashZ = 0
let lastSplashAt = 0

/** One-shot splash that can play at many places at once (cannon misses). */
export function playSplashAt(x: number, z: number): void {
  const now = Date.now()
  const dx = x - lastSplashX
  const dz = z - lastSplashZ
  if (now - lastSplashAt < 180 && dx * dx + dz * dz < 8) return
  lastSplashX = x
  lastSplashZ = z
  lastSplashAt = now
  const crownE = makePlane(CROWN, true)
  Transform.getMutable(crownE).position = Vector3.create(x, WATER_Y + 0.5, z)
  Transform.getMutable(crownE).scale = Vector3.create(5.5, 4.2, 1)
  playSheet(crownE, 3, 3, 0, 8, 24, 0, true)

  const ringE = makePlane(RING, false)
  Transform.getMutable(ringE).position = Vector3.create(x, WATER_Y + 0.05, z)
  Transform.getMutable(ringE).rotation = Quaternion.fromEulerDegrees(90, Math.random() * 360, 0)
  Transform.getMutable(ringE).scale = Vector3.create(6, 6, 1)
  playSheet(ringE, 3, 3, 0, 8, 16, 0.12, true)
}

export function registerWaterSplash(): void {
  engine.addSystem((dt) => {
    for (const s of sheets) {
      if (!s.active) continue
      if (s.delay > 0) {
        s.delay -= dt
        continue
      }
      if (VisibilityComponent.has(s.entity)) VisibilityComponent.getMutable(s.entity).visible = true
      s.elapsed += dt
      if (s.elapsed < 1 / s.fps) continue
      s.elapsed = 0
      s.frame += 1
      if (s.frame > s.end) {
        s.active = false
        if (s.temp) {
          if (Transform.has(s.entity)) engine.removeEntity(s.entity)
          continue
        }
        if (VisibilityComponent.has(s.entity)) VisibilityComponent.getMutable(s.entity).visible = false
        continue
      }
      applyFrame(s)
    }
    sheets = sheets.filter((s) => s.active || !s.temp)
  }, 5, 'water-splash')
}

function playSheet(
  entity: Entity,
  countU: number,
  countV: number,
  start: number,
  end: number,
  fps: number,
  delay: number,
  temp = false
): void {
  let s = sheets.find((x) => x.entity === entity)
  if (!s) {
    s = { entity, countU, countV, frame: start, start, end, fps, elapsed: 0, delay, active: true, temp }
    sheets.push(s)
  }
  s.countU = countU
  s.countV = countV
  s.start = start
  s.end = end
  s.fps = fps
  s.delay = delay
  s.elapsed = 0
  s.frame = start
  s.active = true
  applyFrame(s)
  if (VisibilityComponent.has(entity)) VisibilityComponent.getMutable(entity).visible = delay <= 0
}

function applyFrame(s: Sheet): void {
  const u = s.frame % s.countU
  const v = Math.floor(s.frame / s.countU)
  const su = 1 / s.countU
  const sv = 1 / s.countV
  MeshRenderer.setPlane(s.entity, [
    u * su,
    1 - (v + 1) * sv,
    u * su,
    1 - v * sv,
    (u + 1) * su,
    1 - v * sv,
    (u + 1) * su,
    1 - (v + 1) * sv
  ])
}

function makePlane(src: string, billboard: boolean): Entity {
  const e = engine.addEntity()
  Transform.create(e, { position: Vector3.create(0, -20, 0) })
  MeshRenderer.setPlane(e)
  if (billboard) Billboard.create(e, { billboardMode: 2 })
  Material.setPbrMaterial(e, {
    texture: Material.Texture.Common({ src, wrapMode: TextureWrapMode.TWM_CLAMP }),
    emissiveTexture: Material.Texture.Common({ src, wrapMode: TextureWrapMode.TWM_CLAMP }),
    albedoColor: Color4.create(1, 1, 1, 1),
    emissiveColor: Color3.create(1, 1, 1),
    emissiveIntensity: 1,
    roughness: 1,
    metallic: 0,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
    castShadows: false
  })
  VisibilityComponent.create(e, { visible: false })
  return e
}
