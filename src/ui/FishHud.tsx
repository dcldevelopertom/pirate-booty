import { Color4 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { confirmFishHole, fishHud, leaveFishing, setFishHookHeld, setFishReelHeld } from '../games/fish/FishClient'
import { outlinedWideLabel } from './PlayPrompt'
import { isSplashVisible } from './Splash'
import { gameTitle } from './GameTitle'

let holeSlide = 0

export function tickFishHud(dt: number): void {
  const h = fishHud()
  const want = h.stage === 'picking' && h.slot >= 0 ? 1 : 0
  const k = Math.min(1, dt * 8)
  holeSlide += (want - holeSlide) * k
  if (holeSlide < 0.01) holeSlide = want ? holeSlide : 0
  if (holeSlide > 0.99) holeSlide = want ? 1 : holeSlide
}

export function fishHudUi() {
  return null
}

export function fishOverlayUi() {
  if (isSplashVisible()) return null
  const h = fishHud()
  if (h.stage === 'idle') return null
  const fishing = h.stage === 'fishing' || h.stage === 'fight'
  const catching = h.stage === 'catch'
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        pointerFilter: 'none'
      }}
    >
      <UiEntity
        uiTransform={{
          width: 56,
          height: 56,
          positionType: 'absolute',
          position: { top: 12, right: 52 },
          pointerFilter: 'block'
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: 'images/btn-exit.png' }
        }}
        onMouseDown={() => leaveFishing()}
      />
      <UiEntity
        uiTransform={{
          width: '100%',
          height: 140,
          positionType: 'absolute',
          position: { top: 12, left: 0 },
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column'
        }}
      >
        {gameTitle('images/hud-title-fish.png', 280, 88)}
        <Label
          value={
            h.stage === 'picking' && h.slot < 0 ? 'Pick a hole' : ''
          }
          fontSize={28}
          color={Color4.White()}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: 36 }}
        />
        {!catching && h.toast ? (
          <Label
            value={h.toast}
            fontSize={32}
            color={Color4.create(0.96, 0.82, 0.35, 1)}
            textAlign="middle-center"
            uiTransform={{ width: '100%', height: 40 }}
          />
        ) : null}
      </UiEntity>
      {catching ? catchCard(h.catch) : null}
      {holePrompt(h.slot)}
      {fishing
        ? tensionBar(h.stage === 'fight' ? h.tension : -1, h.stage === 'fight' ? h.fightLeft : -1, h.depth)
        : null}
      {h.stage === 'fishing' ? reelDirButtons() : null}
      {fishing && !catching ? (
        <UiEntity
          uiTransform={{
            width: 216,
            height: 216,
            positionType: 'absolute',
            position: { bottom: 28, right: 118 },
            pointerFilter: 'block'
          }}
          uiBackground={{
            textureMode: 'stretch',
            texture: { src: h.stage === 'fight' ? 'images/hud-reel.png' : 'images/hud-hook.png' }
          }}
          onMouseDown={() => setFishHookHeld(true)}
          onMouseUp={() => setFishHookHeld(false)}
        />
      ) : null}

    </UiEntity>
  )
}

function reelDirButtons() {
  return (
    <UiEntity
      uiTransform={{
        width: 96,
        height: 216,
        positionType: 'absolute',
        position: { bottom: isMobile() ? 36 : 28, left: '20%' },
        flexDirection: 'column',
        justifyContent: 'space-between',
        pointerFilter: 'none'
      }}
    >
      <UiEntity
        uiTransform={{ width: 96, height: 96, pointerFilter: 'block' }}
        uiBackground={{
          color: Color4.create(1, 1, 1, 1),
          textureMode: 'stretch',
          texture: { src: 'images/hud-reel-up.png' }
        }}
        onMouseDown={() => setFishReelHeld('up', true)}
        onMouseUp={() => setFishReelHeld('up', false)}
      />
      <UiEntity
        uiTransform={{ width: 96, height: 96, pointerFilter: 'block' }}
        uiBackground={{
          color: Color4.create(1, 1, 1, 1),
          textureMode: 'stretch',
          texture: { src: 'images/hud-reel-down.png' }
        }}
        onMouseDown={() => setFishReelHeld('down', true)}
        onMouseUp={() => setFishReelHeld('down', false)}
      />
    </UiEntity>
  )
}

function catchCard(info: { name: string; image: string; coins: number } | null) {
  if (!info) return null
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
        pointerFilter: 'none'
      }}
    >
      <UiEntity
        uiTransform={{
          width: 765,
          height: 442,
          flexDirection: 'row',
          justifyContent: 'center',
          padding: { top: 62, bottom: 96, left: 82, right: 82 },
          alignItems: 'center',
          margin: { top: '10%' }
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: 'images/panel-info.png' }
        }}
      >
        <UiEntity
          uiTransform={{ width: 273, height: 167, margin: { right: 16 } }}
          uiBackground={{
            textureMode: 'stretch',
            texture: { src: info.image }
          }}
        />
        <UiEntity
          uiTransform={{
            width: 300,
            height: 220,
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <Label
            value={info.name}
            fontSize={28}
            color={Color4.create(0.96, 0.82, 0.35, 1)}
            textAlign="middle-center"
            uiTransform={{ width: '100%', height: 40, margin: { bottom: 12 } }}
          />
          <Label
            value={`+${info.coins} coin${info.coins === 1 ? '' : 's'}`}
            fontSize={24}
            color={Color4.create(0.92, 0.86, 0.74, 1)}
            textAlign="middle-center"
            uiTransform={{ width: '100%', height: 40 }}
          />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

function holePrompt(slot: number) {
  if (holeSlide < 0.02 || slot < 0) return null
  const bottom = -160 + holeSlide * 196
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: 160,
        positionType: 'absolute',
        position: { bottom, left: 0 },
        justifyContent: 'center',
        alignItems: 'center',
        pointerFilter: 'none'
      }}
    >
      <UiEntity
        uiTransform={{
          width: 560,
          height: 144,
          justifyContent: 'center',
          alignItems: 'center',
          pointerFilter: 'block'
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: 'images/btn-play-wide.png' }
        }}
        onMouseDown={() => confirmFishHole()}
      >
        {outlinedWideLabel(`Fish hole ${slot + 1}`)}
      </UiEntity>
    </UiEntity>
  )
}

function tensionBar(tension: number, fightLeft: number, depth: number) {
  const live = tension >= 0
  const barW = 64
  const barH = 240
  const pad = 40
  const markH = 18
  const markW = 40
  const travel = barH - pad * 2 - markH
  const markBottom = pad + Math.round(Math.max(0, Math.min(1, live ? tension : 0.5)) * travel)
  return (
    <UiEntity
      uiTransform={{
        width: 80,
        height: 320,
        positionType: 'absolute',
        position: { bottom: 156, right: '30%' },
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center'
      }}
    >
      {fightLeft >= 0 ? (
        <Label
          value={`${fightLeft.toFixed(1)}s`}
          fontSize={22}
          color={Color4.White()}
          textAlign="middle-center"
          uiTransform={{ width: 80, height: 28, margin: { bottom: 2 } }}
        />
      ) : null}
      <Label
        value={`${depth.toFixed(1)}m`}
        fontSize={22}
        color={Color4.create(0.96, 0.82, 0.35, 1)}
        textAlign="middle-center"
        uiTransform={{ width: 80, height: 28, margin: { bottom: 4 } }}
      />
      <UiEntity
        uiTransform={{
          width: barW,
          height: barH
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: 'images/hud-reel-bar.png' }
        }}
      >
        {live ? (
          <UiEntity
            uiTransform={{
              width: markW,
              height: markH,
              positionType: 'absolute',
              position: { bottom: markBottom, left: Math.round((barW - markW) / 2) }
            }}
            uiBackground={{
              textureMode: 'stretch',
              texture: { src: 'images/hud-reel-mark.png' }
            }}
          />
        ) : null}
      </UiEntity>
    </UiEntity>
  )
}
