import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { isFishBusy } from '../games/fish/FishClient'
import { isGameInfoOpen, openGameInfo } from './GameInfo'
import { isSplashVisible } from './Splash'
import { isTutorialOpen } from './Tutorial'

export type PlayGame = 'dodge' | 'loot' | 'cannon' | 'fish'

let playGame: PlayGame | null = null
let slide = 0

export function showPlayPrompt(game: PlayGame): void {
  playGame = game
}

export function hidePlayPrompt(game: PlayGame): void {
  if (playGame === game) playGame = null
}

export function tickPlayPrompt(dt: number): void {
  const want = playGame ? 1 : 0
  const k = Math.min(1, dt * 8)
  slide += (want - slide) * k
  if (slide < 0.01) slide = playGame ? slide : 0
  if (slide > 0.99) slide = playGame ? 1 : slide
}

export function playPromptUi() {
  if (isSplashVisible() || isGameInfoOpen() || isTutorialOpen() || isFishBusy() || slide < 0.02) return null
  const bottom = -160 + slide * 196
  const label =
    playGame === 'loot'
      ? 'Play Booty Loot'
      : playGame === 'cannon'
        ? 'Play Cannon Fodder'
        : playGame === 'fish'
          ? 'Play Fishing'
          : 'Play Deck Dodge'
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
        onMouseDown={() => {
          if (playGame) openGameInfo(playGame)
        }}
      >
        {outlinedWideLabel(label)}
      </UiEntity>
    </UiEntity>
  )
}

const STROKE: Array<[number, number]> = [
  [-3, 0],
  [3, 0],
  [0, -3],
  [0, 3],
  [-3, -3],
  [3, -3],
  [-3, 3],
  [3, 3]
]

export function outlinedWideLabel(text: string, size = 38) {
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        pointerFilter: 'none'
      }}
    >
      {STROKE.map(([x, y], i) => (
        <Label
          key={`s${i}`}
          value={text}
          fontSize={size}
          color={Color4.White()}
          textAlign="middle-center"
          uiTransform={{
            width: '100%',
            height: '100%',
            positionType: 'absolute',
            position: { left: x, top: y },
            pointerFilter: 'none'
          }}
        />
      ))}
      <Label
        value={text}
        fontSize={size}
        color={Color4.create(0.08, 0.04, 0.02, 1)}
        textAlign="middle-center"
        uiTransform={{
          width: '100%',
          height: '100%',
          positionType: 'absolute',
          pointerFilter: 'none'
        }}
      />
    </UiEntity>
  )
}
