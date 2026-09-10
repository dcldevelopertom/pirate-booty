import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { tryJoinCannon } from '../games/cannon/CannonClient'
import { tryJoinFishing } from '../games/fish/FishClient'
import { tryJoinBootyLoot } from '../games/loot/LootClient'
import { cannonPanelImageSize } from './GamePanel'
import { tryJoinDeckDodge } from './MatchHud'
import { isSplashVisible } from './Splash'

export type PlayGame = 'dodge' | 'loot' | 'cannon' | 'fish'

const COPY: Record<PlayGame, { title: string; image: string; body: string }> = {
  dodge: {
    title: 'Deck Dodge',
    image: 'images/play-dodge.jpg',
    body: 'Run down the dock. Jump the gaps (Space) and sidestep barrels and crates. Planks fall behind you — stay ahead or ye drown. First to the end places highest. Coins only bank if more than one pirate is playing.'
  },
  loot: {
    title: 'Booty Loot',
    image: 'images/play-loot.jpg',
    body: 'One minute. Grab one coin at a time and run it to YOUR chest — only stashed gold counts. Sharks steal what you are holding. Stay out of the water. Coins only bank if more than one pirate is playing.'
  },
  cannon: {
    title: 'Cannon Fodder',
    image: 'images/play-cannon.jpg',
    body: 'Ninety seconds on the corsair. WASD aims the gun, Space fires — wait for the cooldown. First hit sinks the ship so nobody else can claim it. Farther, faster hulls pay more. Coins only bank if more than one pirate is playing.'
  },
  fish: {
    title: 'Fishing',
    image: 'images/play-fish.jpg',
    body: 'Pick a hole, then hold Up and Down to raise and lower the line — depth is on the reel. Tap Hook when a fish is close. When one is on, pulse the reel to keep the marker in the sweet zone — clamping it snaps the line. Coins bank even if ye fish alone.'
  }
}

let open: PlayGame | null = null

export function openGameInfo(game: PlayGame): void {
  open = game
}

export function closeGameInfo(): void {
  open = null
}

export function isGameInfoOpen(): boolean {
  return open !== null
}

function joinFromInfo(game: PlayGame): void {
  if (game === 'dodge') tryJoinDeckDodge()
  else if (game === 'loot') tryJoinBootyLoot()
  else if (game === 'cannon') tryJoinCannon()
  else tryJoinFishing()
  closeGameInfo()
}

export function gameInfoUi() {
  if (!open || isSplashVisible()) return null
  const copy = COPY[open]
  const game = open
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
        pointerFilter: 'block'
      }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.72) }}
    >
      <UiEntity
        uiTransform={{
          width: 920,
          height: 530,
          flexDirection: 'row',
          justifyContent: 'center',
          padding: { top: 74, bottom: 114, left: 98, right: 98 },
          alignItems: 'center'
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: 'images/panel-info.png' }
        }}
      >
        <UiEntity
          uiTransform={{
            width: game === 'cannon' ? cannonPanelImageSize().width : 320,
            height: game === 'cannon' ? cannonPanelImageSize().height : 196,
            margin: { right: 22 }
          }}
          uiBackground={{
            textureMode: 'stretch',
            texture: { src: copy.image }
          }}
        />
        <UiEntity
          uiTransform={{
            width: 380,
            height: 310,
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <Label
            value={copy.title}
            fontSize={32}
            color={Color4.create(0.96, 0.82, 0.35, 1)}
            textAlign="middle-center"
            uiTransform={{ width: '100%', height: 42, margin: { bottom: 8 } }}
          />
          <Label
            value={copy.body}
            fontSize={18}
            color={Color4.create(0.92, 0.86, 0.74, 1)}
            textAlign="top-center"
            textWrap="wrap"
            uiTransform={{ width: '100%', height: 156, margin: { bottom: 12 } }}
          />
          <UiEntity
            uiTransform={{
              width: '100%',
              height: 56,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <UiEntity
              uiTransform={{
                width: 168,
                height: 52,
                margin: { right: 12 },
                justifyContent: 'center',
                alignItems: 'center',
                pointerFilter: 'block'
              }}
              uiBackground={{
                textureMode: 'stretch',
                texture: { src: 'images/btn-play.png' }
              }}
              onMouseDown={() => joinFromInfo(game)}
            >
              <Label
                value="Play"
                fontSize={22}
                color={Color4.create(0.12, 0.07, 0.03, 1)}
                textAlign="middle-center"
                uiTransform={{ width: '100%', height: '100%', pointerFilter: 'none' }}
              />
            </UiEntity>
            <UiEntity
              uiTransform={{
                width: 168,
                height: 52,
                justifyContent: 'center',
                alignItems: 'center',
                pointerFilter: 'block'
              }}
              uiBackground={{
                textureMode: 'stretch',
                texture: { src: 'images/btn-back.png' }
              }}
              onMouseDown={() => closeGameInfo()}
            >
              <Label
                value="Go back"
                fontSize={20}
                color={Color4.create(0.96, 0.82, 0.35, 1)}
                textAlign="middle-center"
                uiTransform={{ width: '100%', height: '100%', pointerFilter: 'none' }}
              />
            </UiEntity>
          </UiEntity>
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}
