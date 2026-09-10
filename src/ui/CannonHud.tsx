import { Color4 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { CANNON } from '../config'
import { closeCannonResults, fireCannon, leaveCannonLobby, cannonHud } from '../games/cannon/CannonClient'
import { cannonPanelImageSize, gameLobbyUi, gameResultsUi } from './GamePanel'
import { isSplashVisible } from './Splash'
import { gameTitle } from './GameTitle'

export function cannonHudUi() {
  if (isSplashVisible()) return null
  return null
}

export function cannonOverlayUi() {
  if (isSplashVisible()) return null
  const h = cannonHud()
  if (h.stage === 'lobby') return lobbyPanel(h)
  if (h.stage === 'loading') return overlay('CANNON FODDER', 'Man the guns')
  if (h.stage === 'countdown') return overlay(String(h.count), 'SINK THE FLEET')
  if (h.stage === 'playing') return playHud(h)
  if (h.stage === 'results') return resultsPanel(h)
  return null
}

function lobbyPanel(h: ReturnType<typeof cannonHud>) {
  const wait =
    h.lobbyTimer > 0 ? `Starting in ${h.lobbyTimer}` : h.lobbyCount < h.lobbyMin ? `Need ${h.lobbyMin} to start` : 'Waiting…'
  const img = cannonPanelImageSize()
  return gameLobbyUi({
    title: 'CANNON FODDER',
    image: 'images/play-cannon.jpg',
    imageWidth: img.width,
    imageHeight: img.height,
    countLine: `${h.lobbyCount} / ${h.lobbyMax}`,
    wait,
    onLeave: () => leaveCannonLobby()
  })
}

function playHud(h: ReturnType<typeof cannonHud>) {
  const ranked = h.scores.slice().sort((a, b) => b.hits - a.hits)
  const ready = h.cool <= 0
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
          width: '100%',
          height: 156,
          positionType: 'absolute',
          position: { top: 10, left: 0 },
          justifyContent: 'center',
          alignItems: 'flex-start'
        }}
      >
        <UiEntity
          uiTransform={{
            width: 340,
            height: 150,
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 4
          }}
        >
          {gameTitle('images/hud-title-cannon.png', 320, 92)}
          <Label
            value={`${h.remain}s`}
            fontSize={36}
            color={Color4.White()}
            textAlign="middle-center"
            uiTransform={{ width: '100%', height: 48 }}
          />
        </UiEntity>
      </UiEntity>
      <UiEntity
        uiTransform={{
          width: 240,
          height: 80 + ranked.length * 28,
          positionType: 'absolute',
          position: { top: 150, right: 16 },
          flexDirection: 'column',
          padding: 10
        }}
      >
        <Label
          value={`Coins ${h.hits}`}
          fontSize={18}
          color={Color4.create(0.5, 0.9, 0.55, 1)}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: 28, margin: { bottom: 6 } }}
        />
        {ranked.map((r, i) => (
          <Label
            key={`${r.name}-${i}`}
            value={`${i + 1}. ${r.name}   ${r.hits}`}
            fontSize={14}
            color={Color4.create(0.92, 0.86, 0.74, 1)}
            uiTransform={{ width: '100%', height: 24 }}
          />
        ))}
      </UiEntity>
      <UiEntity
        uiTransform={{
          width: '100%',
          height: 16,
          positionType: 'absolute',
          position: { bottom: isMobile() ? 148 : 24, left: 0 },
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <UiEntity
          uiTransform={{ width: 180, height: 12 }}
          uiBackground={{ color: Color4.create(0.08, 0.06, 0.04, 0.9) }}
        >
          <UiEntity
            uiTransform={{
              width: `${Math.round((ready ? 1 : 1 - h.cool / CANNON.cooldown) * 100)}%`,
              height: 12
            }}
            uiBackground={{
              color: ready ? Color4.create(0.96, 0.82, 0.35, 1) : Color4.create(0.75, 0.22, 0.16, 1)
            }}
          />
        </UiEntity>
      </UiEntity>
      {isMobile() ? (
        <UiEntity
          uiTransform={{
            width: 108,
            height: 108,
            positionType: 'absolute',
            position: { bottom: 28, right: 118 },
            pointerFilter: 'block'
          }}
          uiBackground={{
            textureMode: 'stretch',
            texture: { src: 'images/hud-fire.png' }
          }}
          onMouseDown={() => fireCannon()}
        >
          {ready ? null : (
            <Label
              value={h.cool.toFixed(1)}
              fontSize={22}
              color={Color4.create(1, 0.92, 0.7, 1)}
              textAlign="middle-center"
              uiTransform={{ width: '100%', height: '100%' }}
            />
          )}
        </UiEntity>
      ) : null}
    </UiEntity>
  )
}

function resultsPanel(h: ReturnType<typeof cannonHud>) {
  const won = h.youPlace === 1 && h.youCoins > 0
  const solo = h.results.length < 2
  const img = cannonPanelImageSize()
  return gameResultsUi({
    title: won ? 'YOU WON' : 'CANNON FODDER',
    image: 'images/play-cannon.jpg',
    imageWidth: img.width,
    imageHeight: img.height,
    placeLine: `${placeTitle(h.youPlace)}   +${h.youCoins} coins`,
    note: solo ? '*Single player mode does not bank coins' : undefined,
    bankLine: `Bank ${h.youTotal}   Wins ${h.youWins}`,
    rows: h.results.map((r) => ({ value: `${r.place}. ${r.name}  +${r.coins}` })),
    onBack: () => closeCannonResults()
  })
}

function overlay(title: string, sub: string) {
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column'
      }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.72) }}
    >
      <Label
        value={title}
        fontSize={64}
        color={Color4.White()}
        textAlign="middle-center"
        uiTransform={{ width: '100%', height: 80 }}
      />
      <Label
        value={sub}
        fontSize={22}
        color={Color4.create(0.96, 0.9, 0.78, 1)}
        textAlign="middle-center"
        uiTransform={{ width: '100%', height: 36 }}
      />
    </UiEntity>
  )
}

function placeTitle(place: number): string {
  if (place === 1) return '1ST'
  if (place === 2) return '2ND'
  if (place === 3) return '3RD'
  if (place > 0) return `${place}TH`
  return 'SALVO'
}
