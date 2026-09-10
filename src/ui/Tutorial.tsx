import { engine } from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { room } from '../net/messages'
import { getCamFollow, viewHub, viewTutorial } from '../world/cameras'
import { lockAllInputs, lockTutorial, unlockToGameplay } from './inputLocks'
import { armLeaderboardPointer } from '../world/Leaderboard'
import { isSplashVisible, setSplashEndHandler } from './Splash'

const STEPS = [
  "Ahoy, ye salty dog! Welcome to Pirate Booty. I'm the Cap'n, an' that board behind me keeps score o' the richest scallywags on these waters.",
  "Three multiplayer games be waitin': Deck Dodge, Booty Loot, an' Cannon Fodder. Those only bank coins when more than one pirate is playin'. Cozy fishin' off the south dock pays even if ye fish alone. Climb the board. Don't drown."
]

let open = false
let step = 0
let pending = false
let force = false
let seenAlready = false
let offerReady = false

export function isTutorialOpen(): boolean {
  return open
}

export function isTutorialForce(): boolean {
  return force
}

export function isTutorialPending(): boolean {
  return pending || open || !offerReady
}

export function setupTutorial(): void {
  setSplashEndHandler(tryBeginTutorial)
  room.onMessage('tutorialOffer', (data) => {
    offerReady = true
    force = data.force
    if (!data.show) {
      seenAlready = true
      pending = false
      tryBeginTutorial()
      return
    }
    pending = true
    tryBeginTutorial()
  })
  engine.addSystem(() => {
    if (open) {
      lockTutorial()
      if (getCamFollow() !== 'tutorial') viewTutorial()
      return
    }
    if (!offerReady && !isSplashVisible()) lockAllInputs()
  }, 50, 'tutorial-hold')
}

export function tryBeginTutorial(): void {
  if (isSplashVisible()) return
  if (!offerReady) {
    lockAllInputs()
    return
  }
  if (!pending) {
    unlockToGameplay()
    if (seenAlready) armLeaderboardPointer()
    return
  }
  pending = false
  step = 0
  open = true
  lockTutorial()
  viewTutorial()
}

function finishTutorial(): void {
  if (!open) return
  open = false
  step = 0
  room.send('tutorialDone', {})
  viewHub()
  unlockToGameplay()
  armLeaderboardPointer()
}

export function tutorialUi() {
  if (!open || isSplashVisible()) return null
  const last = step >= STEPS.length - 1
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        pointerFilter: 'block'
      }}
    >
      <UiEntity
        uiTransform={{
          width: '100%',
          height: 430,
          positionType: 'absolute',
          position: { bottom: 0, left: 0 },
          justifyContent: 'center',
          alignItems: 'center',
          pointerFilter: 'none'
        }}
      >
      <UiEntity
        uiTransform={{
          width: 792,
          height: 390,
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: { top: 70, bottom: 78, left: 52, right: 52 }
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: 'images/panel-npc.png' }
        }}
      >
        <Label
          value={STEPS[step]}
          fontSize={20}
          color={Color4.create(0.96, 0.9, 0.78, 1)}
          textAlign="top-center"
          textWrap="wrap"
          uiTransform={{ width: '90%', height: 120, margin: { top: 26, bottom: 12 } }}
        />
        <UiEntity
          uiTransform={{
            width: '100%',
            height: 80,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <UiEntity
            uiTransform={{
              width: 252,
              height: 72,
              margin: { right: 18 },
              justifyContent: 'center',
              alignItems: 'center',
              pointerFilter: 'block'
            }}
            uiBackground={{
              textureMode: 'stretch',
              texture: { src: 'images/btn-play.png' }
            }}
            onMouseDown={() => {
              if (last) finishTutorial()
              else step += 1
            }}
          >
            <Label
              value={last ? 'Aye' : 'Next'}
              fontSize={27}
              color={Color4.create(0.12, 0.07, 0.03, 1)}
              textAlign="middle-center"
              uiTransform={{ width: '100%', height: '100%', pointerFilter: 'none' }}
            />
          </UiEntity>
          <UiEntity
            uiTransform={{
              width: 252,
              height: 72,
              justifyContent: 'center',
              alignItems: 'center',
              pointerFilter: 'block'
            }}
            uiBackground={{
              textureMode: 'stretch',
              texture: { src: 'images/btn-back.png' }
            }}
            onMouseDown={() => finishTutorial()}
          >
            <Label
              value="Skip"
              fontSize={24}
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
