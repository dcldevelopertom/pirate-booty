import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { closeLootResults, leaveLootLobby, lootHud } from '../games/loot/LootClient'
import { gameLobbyUi, gameResultsUi } from './GamePanel'
import { isSplashVisible } from './Splash'
import { gameTitle } from './GameTitle'

export function lootHudUi() {
  if (isSplashVisible()) return null
  return null
}

export function lootOverlayUi() {
  if (isSplashVisible()) return null
  const h = lootHud()
  if (h.stage === 'lobby') return lobbyPanel(h)
  if (h.stage === 'loading') return overlay('BOOTY LOOT', 'Get to your chest')
  if (h.stage === 'countdown') return overlay(String(h.count), 'GRAB THE GOLD')
  if (h.stage === 'playing') return playHud(h)
  if (h.stage === 'results') return resultsPanel(h)
  return null
}

function lobbyPanel(h: ReturnType<typeof lootHud>) {
  const wait =
    h.lobbyTimer > 0 ? `Starting in ${h.lobbyTimer}` : h.lobbyCount < h.lobbyMin ? `Need ${h.lobbyMin} to start` : 'Waiting…'
  return gameLobbyUi({
    title: 'BOOTY LOOT',
    image: 'images/play-loot.jpg',
    countLine: `${h.lobbyCount} / ${h.lobbyMax}`,
    wait,
    onLeave: () => leaveLootLobby()
  })
}

function playHud(h: ReturnType<typeof lootHud>) {
  const ranked = h.scores.slice().sort((a, b) => b.stashed - a.stashed)
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
            width: 320,
            height: 150,
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 4
          }}
        >
          {gameTitle('images/hud-title-loot.png', 300, 92)}
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
        uiBackground={{ color: Color4.create(0.07, 0.05, 0.03, 0.88) }}
      >
        <Label
          value={`Chest ${h.stashed}`}
          fontSize={18}
          color={Color4.create(0.5, 0.9, 0.55, 1)}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: 28, margin: { bottom: 6 } }}
        />
        {ranked.map((r, i) => (
          <Label
            key={`${r.name}-${i}`}
            value={`${i + 1}. ${r.name}   ${r.stashed}`}
            fontSize={14}
            color={Color4.create(0.92, 0.86, 0.74, 1)}
            uiTransform={{ width: '100%', height: 24 }}
          />
        ))}
      </UiEntity>
    </UiEntity>
  )
}

function resultsPanel(h: ReturnType<typeof lootHud>) {
  const won = h.youPlace === 1 && h.youCoins > 0
  const solo = h.results.length < 2
  return gameResultsUi({
    title: won ? 'YOU WON' : 'BOOTY LOOT',
    image: 'images/play-loot.jpg',
    placeLine: `${placeTitle(h.youPlace)}   +${h.youCoins} coins`,
    note: solo ? '*Single player mode does not bank coins' : undefined,
    bankLine: `Bank ${h.youTotal}   Wins ${h.youWins}`,
    rows: h.results.map((r) => ({ value: `${r.place}. ${r.name}  +${r.coins}` })),
    onBack: () => closeLootResults()
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
  return 'HAUL'
}
