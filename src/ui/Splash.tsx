import { engine } from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { movePlayerTo } from '~system/RestrictedActions'
import { HUB_SPAWN, SPLASH_IMAGE, SPLASH_SECONDS } from '../config'
import { startDockAmbience } from '../world/Audio'
import { viewHub } from '../world/cameras'
import { lockAllInputs } from './inputLocks'
import { isDesktopBlocked, isMobileGateReady, markGateReady } from './MobileGate'

let onSplashEnd: () => void = () => {}

export function setSplashEndHandler(fn: () => void): void {
  onSplashEnd = fn
}

let visible = true
let remaining = SPLASH_SECONDS
let placed = false

export function isSplashVisible(): boolean {
  return visible
}

export function startSplash(): void {
  visible = true
  remaining = SPLASH_SECONDS
  placed = false
  lockAllInputs()
  engine.addSystem(splashTick)
}

export function splashUi() {
  if (!visible) return null
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute'
      }}
      uiBackground={{
        color: Color4.Black()
      }}
    >
      <UiEntity
        uiTransform={{
          width: '100%',
          height: '100%'
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: SPLASH_IMAGE }
        }}
      />
      {isDesktopBlocked() ? (
        <UiEntity
          uiTransform={{
            width: '100%',
            height: 160,
            positionType: 'absolute',
            position: { bottom: 48, left: 0 },
            justifyContent: 'center',
            alignItems: 'center',
            padding: { left: 24, right: 24 }
          }}
          uiBackground={{ color: Color4.create(0.07, 0.05, 0.03, 0.9) }}
        >
          <Label
            value="Pirate Booty is mobile-only right now. Open this scene on a phone — desktop is locked."
            fontSize={22}
            color={Color4.create(0.96, 0.9, 0.78, 1)}
            textAlign="middle-center"
            textWrap="wrap"
            uiTransform={{ width: 720, height: 120 }}
          />
        </UiEntity>
      ) : null}
    </UiEntity>
  )
}

function splashTick(dt: number): void {
  if (!visible) return
  remaining -= dt
  if (!isMobileGateReady()) {
    if (remaining < -4) markGateReady()
    else return
  }
  if (isDesktopBlocked()) {
    lockAllInputs()
    return
  }
  if (remaining > 0) return

  visible = false
  if (!placed) {
    placed = true
    void placeOnHub().then(() => onSplashEnd())
    return
  }
  onSplashEnd()
}

async function placeOnHub(): Promise<void> {
  const x = HUB_SPAWN.xMin + Math.random() * (HUB_SPAWN.xMax - HUB_SPAWN.xMin)
  const z = HUB_SPAWN.zMin + Math.random() * (HUB_SPAWN.zMax - HUB_SPAWN.zMin)
  try {
    await movePlayerTo({
      newRelativePosition: { x, y: HUB_SPAWN.y, z },
      cameraTarget: { x: HUB_SPAWN.lookX, y: HUB_SPAWN.lookY, z: HUB_SPAWN.lookZ }
    })
  } catch (e) {
    console.log('[CLIENT] movePlayerTo hub failed', e)
  }
  viewHub()
  startDockAmbience()
}
