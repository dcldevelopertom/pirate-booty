import { PlayerIdentityData, Transform, engine } from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { movePlayerTo } from '~system/RestrictedActions'
import { HUB_SPAWN, LANE, MATCH, RACE } from '../config'
import { getFakeRoster } from '../games/shared/FakePlayers'
import { laneFinishWait, laneSpawn, laneZ } from '../world/layout'
import { room } from '../net/messages'
import { LaneState, getLanePhase } from '../net/schemas'
import { viewHub, viewPlayer } from '../world/cameras'
import { isSplashVisible } from './Splash'
import { lockAllInputs, unlockToDock, unlockToGameplay } from './inputLocks'
import { setPoseLane } from '../games/barrel/PoseReport'
import { setPlayingLane, unbindLane } from '../games/shared/GameView'
import { ignoreDrownCam, resetDrownCam } from '../world/PlayerFollowCam'
import { isLootBusy } from '../games/loot/LootClient'
import { isCannonBusy } from '../games/cannon/CannonClient'
import { isFishBusy } from '../games/fish/FishClient'
import { setHubGlbsVisible } from '../world/HubHide'
import { gameTitle } from './GameTitle'
import { gameLobbyUi, gameResultsUi } from './GamePanel'
import { isClientBusy, setClientBusy } from '../games/shared/ClientBusy'
import { isSoundOn, startDockAmbience, stopHubAmbience, toggleSound } from '../world/Audio'

type Stage = 'idle' | 'lobby' | 'loading' | 'countdown' | 'playing' | 'finished' | 'results' | 'dying' | 'out'

type ResultRow = { name: string; place: number; state: string; coins: number }

let stage: Stage = 'idle'
let lane = 0
let count = MATCH.countdown
let lobbyGame = 0
let lobbySlot = 0
let lobbyCount = 0
let lobbyMax = MATCH.maxPlayers
let lobbyMin = 1
let lobbyTimer = 0
let finishPlace = 0
let finishCoins = 0
let results: ResultRow[] = []
let youPlace = 0
let youCoins = 0
let youTotal = 0
let youWins = 0
let myCoins = 0
let myWins = 0
let pendingResults = false
let livePlace = 1


export function isMatchLocked(): boolean {
  return stage === 'loading' || stage === 'countdown'
}

/** Kill volume only during the live run — not spawn, finish, or results. */
export function isKillArmed(): boolean {
  return stage === 'playing'
}

export function isMatchFinished(): boolean {
  return stage === 'finished' || stage === 'results'
}

export function isDockOut(): boolean {
  return stage === 'out'
}

export function isMatchIdle(): boolean {
  return stage === 'idle'
}

export function tryJoinDeckDodge(): void {
  if (stage !== 'idle' && stage !== 'lobby') return
  if (isClientBusy('dodge') || isLootBusy() || isCannonBusy() || isFishBusy()) return
  setClientBusy('dodge', true)
  stopHubAmbience()
  room.send('playerJoinMatch', { laneId: -1 })
}

export function onDockDeath(): void {
  stage = 'dying'
  setPoseLane(null)
  setPlayingLane(null)
}

export function onDockDeathDone(): void {
  stage = 'idle'
}

export function markDockDying(): void {
  if (stage !== 'playing') return
  stage = 'dying'
  setPoseLane(null)
}

/** After the YOU DIED beat: park on the finish pad and wait for the rest of the field. */
export async function beginDockOut(): Promise<void> {
  if (stage !== 'playing' && stage !== 'dying') return
  setPoseLane(null)
  lockAllInputs()
  ignoreDrownCam(true)
  viewPlayer(lane)
  const pose = laneFinishWait(lane, Math.max(0, lobbySlot - 1))
  await placeOnDeck(pose)
  viewPlayer(lane)
  lockAllInputs()
  if (pendingResults) {
    pendingResults = false
    stage = 'results'
    return
  }
  stage = 'out'
}

export function setupMatchHud(): void {
  room.send('playerAskStats', {})
  room.onMessage('lobbyUpdate', (data) => {
    if (stage === 'loading' || stage === 'countdown' || stage === 'playing' || stage === 'finished' || stage === 'results' || stage === 'out' || stage === 'dying')
      return
    lane = data.laneId
    stage = 'lobby'
    lobbyGame = data.gameId
    lobbySlot = data.slot
    lobbyCount = data.count
    lobbyMax = data.max
    lobbyMin = data.min
    lobbyTimer = data.lobbyCount
  })
  room.onMessage('matchQueued', (data) => {
    if (stage === 'loading' || stage === 'countdown' || stage === 'playing' || stage === 'out' || stage === 'finished' || stage === 'results' || stage === 'dying') return
    lane = data.laneId
    stage = 'lobby'
    lobbyGame = data.gameId
    lobbySlot = data.slot
    lobbyMax = data.max
    if (lobbyCount < 1) lobbyCount = 1
  })
  room.onMessage('lobbyLeft', () => {
    stage = 'idle'
    setClientBusy('dodge', false)
    startDockAmbience()
  })
  room.onMessage('joinDenied', (data) => {
    if (data.game && data.game !== 'dodge') return
    if (stage !== 'idle' && stage !== 'lobby') return
    stage = 'idle'
    setClientBusy('dodge', false)
    startDockAmbience()
    console.log('[CLIENT] join denied', data.reason)
  })
  room.onMessage('matchPrep', (data) => {
    lane = data.laneId
    void startOnDeck(data.laneId, data)
  })
  room.onMessage('matchCountdown', (data) => {
    if (data.laneId !== lane && stage !== 'loading' && stage !== 'countdown' && stage !== 'lobby') return
    lane = data.laneId
    if (stage === 'idle' || stage === 'lobby') void startOnDeck(data.laneId, laneSpawn(data.laneId))
    if (data.count <= 0) {
      goNow()
      return
    }
    stage = 'countdown'
    count = data.count
  })
  room.onMessage('playerFinished', (data) => {
    if (data.laneId !== lane) return
    finishPlace = data.place
    finishCoins = data.coins
    stage = 'finished'
    lockAllInputs()
  })
  room.onMessage('matchResults', (data) => {
    if (data.laneId < 0) return
    results = data.rows
    youPlace = data.youPlace
    youCoins = data.youCoins
    youTotal = data.youTotal
    youWins = data.youWins
    myCoins = data.youTotal
    myWins = data.youWins
    if (stage === 'idle') return
    if (stage === 'dying') {
      pendingResults = true
      return
    }
    stage = 'results'
    lockAllInputs()
  })
  room.onMessage('myStats', (data) => {
    myCoins = data.coins
    myWins = data.wins
  })

}

function beginLocalPrep(laneId: number): void {
  lane = laneId
  stage = 'loading'
  count = MATCH.countdown
  setPlayingLane(laneId)
  setPoseLane(laneId)
  resetDrownCam()
}

async function startOnDeck(
  laneId: number,
  spawn: { x: number; y: number; z: number; lookX: number; lookY: number; lookZ: number }
): Promise<void> {
  if (stage === 'loading' || stage === 'countdown' || stage === 'playing' || stage === 'finished' || stage === 'results' || stage === 'out' || stage === 'dying') {
    if (stage === 'loading' || stage === 'countdown') await placeOnDeck(spawn)
    return
  }
  beginLocalPrep(laneId)
  setHubGlbsVisible(false)
  await placeOnDeck(spawn)
  lockAllInputs()
  viewPlayer(laneId)
}

function goNow(): void {
  if (stage === 'playing' || stage === 'finished' || stage === 'results' || stage === 'out' || stage === 'dying') return
  stage = 'playing'
  unlockToDock()
}

export function matchHudUi() {
  if (isSplashVisible()) return null
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute', pointerFilter: 'none' }}>
      {stage !== 'idle' && stage !== 'lobby' && stage !== 'dying' ? (
        <UiEntity
          uiTransform={{
            width: '100%',
            height: 140,
            positionType: 'absolute',
            position: { top: 16, left: 0 },
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column'
          }}
        >
          {gameTitle('images/hud-title-dodge.png', 300, 92)}
          {stage === 'playing' ? (
            <Label
              value={placeWord(livePlace)}
              fontSize={36}
              color={Color4.White()}
              textAlign="middle-center"
              uiTransform={{ width: '100%', height: 40 }}
            />
          ) : null}
        </UiEntity>
      ) : null}
      <UiEntity
        uiTransform={{
          width: 320,
          height: 48,
          positionType: 'absolute',
          position: { top: 12, right: isFishBusy() ? 124 : 16 },
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center'
        }}
      >
        {statChip('images/hud-coin.png', myCoins)}
        {statChip('images/hud-crown.png', myWins)}
        {soundToggle()}
      </UiEntity>
    </UiEntity>
  )
}

export function matchOverlayUi() {
  if (isSplashVisible()) return null
  if (stage === 'lobby') return lobbyPanel()
  if (stage === 'loading') return overlay('LOADING DOCK', '')
  if (stage === 'countdown') return overlay(String(count), 'GET READY')
  if (stage === 'out') return outWaitBanner()
  if (stage === 'finished') return overlay(placeTitle(finishPlace), `+${finishCoins} coins`)
  if (stage === 'results') return resultsPanel()
  return null
}

export function tickMatchHud(_dt: number): void {
  setClientBusy('dodge', stage !== 'idle')
  if (stage === 'out') {
    lockAllInputs()
    return
  }
  if (stage === 'dying' || stage === 'finished' || stage === 'results') return
  if (stage === 'playing') {
    livePlace = rankOnDock()
    let phase = ''
    for (const [, state] of engine.getEntitiesWith(LaneState)) {
      phase = getLanePhase(state, lane)
      break
    }
    if (phase === 'ended' || phase === 'idle' || phase === 'empty') {
      // wait for matchResults
    }
  }
}

function rankOnDock(): number {
  const me = Transform.getOrNull(engine.PlayerEntity)
  if (!me) return livePlace
  const mx = me.position.x
  const z0 = laneZ(lane)
  let ahead = 0
  for (const [ent] of engine.getEntitiesWith(PlayerIdentityData, Transform)) {
    if (ent === engine.PlayerEntity) continue
    const t = Transform.get(ent)
    if (!onDock(t.position.x, t.position.z, z0)) continue
    if (t.position.x >= LANE.x0 + RACE.finishLocalX - 0.5) continue
    if (t.position.x > mx + 0.4) ahead++
  }
  for (const f of getFakeRoster()) {
    if (f.lane !== lane) continue
    if (f.x >= LANE.x0 + RACE.finishLocalX - 0.5) continue
    if (f.x > mx + 0.4) ahead++
  }
  return ahead + 1
}

function onDock(x: number, z: number, z0: number): boolean {
  return (
    x >= LANE.x0 - 4 &&
    x <= LANE.x0 + LANE.length + LANE.finishPad + 4 &&
    z >= z0 - 2 &&
    z <= z0 + LANE.width + 2
  )
}

function statChip(icon: string, value: number) {
  return (
    <UiEntity
      uiTransform={{
        width: 118,
        height: 44,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        margin: { left: 8, right: 8 }
      }}
    >
      <UiEntity
        uiTransform={{ width: 36, height: 36, margin: { right: 8 } }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: icon }
        }}
      />
      <Label
        value={String(value)}
        fontSize={28}
        color={Color4.create(0.08, 0.06, 0.04, 1)}
        uiTransform={{ width: 64, height: 40 }}
      />
    </UiEntity>
  )
}

function soundToggle() {
  return (
    <UiEntity
      uiTransform={{
        width: 40,
        height: 40,
        margin: { left: 4 },
        pointerFilter: 'block'
      }}
      uiBackground={{
        textureMode: 'stretch',
        texture: { src: isSoundOn() ? 'images/hud-sound.png' : 'images/hud-sound-off.png' }
      }}
      onMouseDown={() => toggleSound()}
    />
  )
}

function lobbyPanel() {
  const wait =
    lobbyTimer > 0 ? `Starting in ${lobbyTimer}` : lobbyCount < lobbyMin ? `Need ${lobbyMin} to start` : 'Waiting…'
  return gameLobbyUi({
    title: 'DECK DODGE',
    image: 'images/play-dodge.jpg',
    countLine: `${lobbyCount} / ${lobbyMax}`,
    wait,
    onLeave: () => room.send('playerLeaveMatch', {})
  })
}

function resultsPanel() {
  const solo = results.length < 2
  return gameResultsUi({
    title: youWon() ? 'YOU WON' : youOut() ? 'YOU DIED' : 'DECK DODGE',
    image: 'images/play-dodge.jpg',
    placeLine: `${placeTitle(youPlace)}   +${youCoins} coins`,
    note: solo ? '*Single player mode does not bank coins' : undefined,
    bankLine: `Bank ${youTotal}   Wins ${youWins}`,
    rows: results.map((r) => ({
      value: `${r.place}. ${r.name}  ${r.state}  +${r.coins}`,
      color:
        r.state === 'finished' ? Color4.create(0.5, 0.9, 0.55, 1) : Color4.create(0.85, 0.55, 0.5, 1)
    })),
    onBack: () => {
      void goHub()
    }
  })
}

function outWaitBanner() {
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: 90,
        positionType: 'absolute',
        position: { top: 88, left: 0 },
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        pointerFilter: 'none'
      }}
    >
      <Label
        value="OUT"
        fontSize={36}
        color={Color4.create(0.95, 0.55, 0.4, 1)}
        textAlign="middle-center"
        uiTransform={{ width: '100%', height: 44 }}
      />
      <Label
        value="Waiting for others"
        fontSize={16}
        color={Color4.create(0.96, 0.9, 0.78, 1)}
        textAlign="middle-center"
        uiTransform={{ width: '100%', height: 28 }}
      />
    </UiEntity>
  )
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
        fontSize={72}
        color={Color4.White()}
        textAlign="middle-center"
        uiTransform={{ width: '100%', height: 90 }}
      />
      {sub ? (
        <Label
          value={sub}
          fontSize={22}
          color={Color4.create(0.96, 0.9, 0.78, 1)}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: 36 }}
        />
      ) : null}
    </UiEntity>
  )
}

function youRow(): ResultRow | undefined {
  return results.find((r) => r.place === youPlace)
}

function youWon(): boolean {
  return youPlace === 1 && youCoins > 0 && youRow()?.state === 'finished'
}

function youOut(): boolean {
  return youRow()?.state === 'out'
}

function placeWord(place: number): string {
  if (place === 1) return '1ST'
  if (place === 2) return '2ND'
  if (place === 3) return '3RD'
  if (place > 0) return `${place}TH`
  return ''
}

function placeTitle(place: number): string {
  if (youOut()) return 'OUT'
  const word = placeWord(place)
  return word || 'FINISH'
}

async function goHub(): Promise<void> {
  const x = HUB_SPAWN.xMin + Math.random() * (HUB_SPAWN.xMax - HUB_SPAWN.xMin)
  const z = HUB_SPAWN.zMin + Math.random() * (HUB_SPAWN.zMax - HUB_SPAWN.zMin)
  try {
    await movePlayerTo({
      newRelativePosition: { x, y: HUB_SPAWN.y, z },
      cameraTarget: { x: HUB_SPAWN.lookX, y: HUB_SPAWN.lookY, z: HUB_SPAWN.lookZ }
    })
  } catch (e) {
    console.log('[CLIENT] hub return failed', e)
  }
  setPoseLane(null)
  setPlayingLane(null)
  unbindLane()
  resetDrownCam()
  viewHub()
  setHubGlbsVisible(true)
  startDockAmbience()
  unlockToGameplay()
  stage = 'idle'
  pendingResults = false
  room.send('playerAskStats', {})
}

async function placeOnDeck(data: {
  x: number
  y: number
  z: number
  lookX: number
  lookY: number
  lookZ: number
}): Promise<void> {
  for (let i = 0; i < 3; i++) {
    try {
      await movePlayerTo({
        newRelativePosition: { x: data.x, y: data.y, z: data.z },
        cameraTarget: { x: data.lookX, y: data.lookY, z: data.lookZ }
      })
      return
    } catch (e) {
      console.log('[CLIENT] movePlayerTo deck failed', i, e)
    }
  }
}
