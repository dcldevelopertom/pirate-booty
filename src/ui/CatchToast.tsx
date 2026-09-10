import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { isCannonBusy } from '../games/cannon/CannonClient'
import { isLootBusy } from '../games/loot/LootClient'
import { room } from '../net/messages'
import { isMatchIdle } from './MatchHud'
import { isSplashVisible } from './Splash'

type Toast = { name: string; fish: string; image: string }

let toast: Toast | null = null
let slide = 0
let life = 0

export function setupCatchToast(): void {
  room.onMessage('fishCatchToast', (data) => {
    if (!canShowCatchToast()) return
    toast = { name: data.name, fish: data.fish, image: data.image }
    life = 3.4
    slide = 0
  })
}

export function tickCatchToast(dt: number): void {
  if (!toast) return
  if (!canShowCatchToast()) {
    toast = null
    slide = 0
    return
  }
  life -= dt
  const want = life > 0.4 ? 1 : 0
  slide += (want - slide) * Math.min(1, dt * 7)
  if (life <= 0 && slide < 0.02) {
    toast = null
    slide = 0
  }
}

function canShowCatchToast(): boolean {
  if (isSplashVisible()) return false
  if (isLootBusy() || isCannonBusy()) return false
  if (!isMatchIdle()) return false
  return true
}

export function catchToastUi() {
  if (!toast || slide < 0.02) return null
  if (!canShowCatchToast()) return null
  const left = -170 + slide * 228
  return (
    <UiEntity
      uiTransform={{
        width: 160,
        height: 140,
        positionType: 'absolute',
        position: { top: '28%', left },
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        pointerFilter: 'none'
      }}
    >
      <Label
        value={toast.name}
        fontSize={18}
        color={Color4.Black()}
        textAlign="middle-center"
        uiTransform={{ width: 160, height: 28, margin: { bottom: 4 } }}
      />
      <UiEntity
        uiTransform={{ width: 140, height: 88 }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: toast.image }
        }}
      />
    </UiEntity>
  )
}
