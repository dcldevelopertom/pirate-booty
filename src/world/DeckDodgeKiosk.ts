import {
  ColliderLayer,
  Entity,
  GltfContainer,
  InputAction,
  MeshCollider,
  Transform,
  engine,
  pointerEventsSystem
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { HUB } from '../config'
import { isFlyCamOn } from '../ui/AdminFlyCam'
import { openGameInfo } from '../ui/GameInfo'
import { isSplashVisible } from '../ui/Splash'
import { isTutorialOpen } from '../ui/Tutorial'
import { isBoardCamOn, isFishCamOn } from './cameras'
import { registerHubGlb } from './HubHide'

const SCALE = 1.75
let dodgeSign: Entity | null = null

export function setupDeckDodgeKiosk(): void {
  if (dodgeSign) hookSignClick(dodgeSign, 'Deck Dodge', 'dodge')
}

export function buildDeckDodgeKiosk(): void {
  const scale = SCALE
  const pos = Vector3.create(HUB.x0 + 15.8, HUB.y + 0.5 + 0.5 * scale, HUB.z0 + 5.4)
  const rot = Quaternion.fromEulerDegrees(0, -75, 0)
  dodgeSign = engine.addEntity()
  Transform.create(dodgeSign, {
    position: pos,
    rotation: rot,
    scale: Vector3.create(scale, scale, scale)
  })
  GltfContainer.create(dodgeSign, {
    src: 'assets/models/deck-dodge.glb',
    visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS | ColliderLayer.CL_POINTER,
    invisibleMeshesCollisionMask: ColliderLayer.CL_POINTER
  })
  MeshCollider.setBox(dodgeSign, ColliderLayer.CL_POINTER)
  registerHubGlb(dodgeSign)
}

export function hookSignClick(face: Entity, hover: string, game: 'dodge' | 'loot' | 'cannon' | 'fish'): void {
  pointerEventsSystem.onPointerDown(
    {
      entity: face,
      opts: {
        button: InputAction.IA_POINTER,
        hoverText: hover,
        maxDistance: 28,
        maxPlayerDistance: 28,
        showFeedback: true,
        showHighlight: true
      }
    },
    () => {
      if (isSplashVisible() || isTutorialOpen() || isFlyCamOn() || isBoardCamOn() || isFishCamOn()) return
      openGameInfo(game)
    }
  )
}
