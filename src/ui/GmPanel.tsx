import { engine } from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Button, Label, UiEntity } from '@dcl/sdk/react-ecs'
import { copyToClipboard } from '~system/RestrictedActions'
import { leaveGameView, spectateLane } from '../games/shared/GameView'
import { LANE } from '../config'
import { room } from '../net/messages'
import { GameInfo, LaneState, getLanePhase, isLaneLoaded, readGames, readHubBots, readNeedMoreThanOne } from '../net/schemas'
import { isDeckHideMeshVisible, setDeckHideMeshVisible } from '../world/DeckHide'
import { isLootGlbsForced, toggleLootGlbsForced } from '../world/LootArena'
import { setShellDeckVisible } from '../world/DockLanes'
import { flyCamCopyText, getFlyCamPose, isFlyCamOn, setFlyCam } from './AdminFlyCam'
import { gmAdminUi, openBoard, openPlayers, setupGmAdmin } from './GmAdmin'
import { isSplashVisible } from './Splash'
import { isDesktopBlocked, isMobileOnly } from './MobileGate'
import { isTutorialForce } from './Tutorial'
import { bumpFishCount, getFishCount } from '../games/fish/FishArena'
import { bumpObstacleDifficulty, getObstacleRange } from '../games/barrel/Obstacles'

type GmTab = 'general' | 'fishing' | 'deck' | 'cannon' | 'booty'

let open = false
let tab: GmTab = 'general'
let storageLine = ''
let confirmResetAll = false
let localAddress = ''
let selectedLane = 0
let selectedGameId = 0
let botPick = 4
let statusOpen = false
let flyCopiedUntil = 0
let tutorialForceLocal: boolean | null = null
let mobileOnlyLocal: boolean | null = null

export function setLocalAddress(address: string): void {
  localAddress = address
}

export function setupGmPanel(): void {
  setupGmAdmin()
  engine.addSystem(syncShellsFromState)
  room.onMessage('gmStorageResult', (data) => {
    storageLine = `${data.ok ? 'ok' : 'fail'}: ${data.detail}`
  })
  room.onMessage('raceLog', (data) => {
    console.log(data.text)
    storageLine = data.text
  })
  room.onMessage('joinDenied', (data) => {
    storageLine = `join: ${data.reason}`
  })
}

export function gmUi() {
  return uiRoot()
}

function canShowGm(): boolean {
  return true
}

function currentLaneState() {
  for (const [, state] of engine.getEntitiesWith(LaneState)) {
    return state
  }
  return null
}

function syncShellsFromState(): void {
  const state = currentLaneState()
  if (!state) return
  for (let i = 0; i < LANE.count; i++) {
    setShellDeckVisible(i, !isLaneLoaded(state, i))
  }
}

function uiRoot() {
  if (!canShowGm() || (isSplashVisible() && !isDesktopBlocked())) return <UiEntity uiTransform={{ width: 0, height: 0 }} />

  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        pointerFilter: 'none'
      }}
    >
      <Button
        value={open ? 'GM ▾' : 'GM'}
        variant="primary"
        uiTransform={{
          width: 72,
          height: 36,
          positionType: 'absolute',
          position: { top: 16, right: 336 }
        }}
        onMouseDown={() => {
          open = !open
        }}
      />

      {open ? panel() : null}
      {open && statusOpen ? statusPanel() : null}
      {open ? gmAdminUi() : null}
      {isFlyCamOn() ? flyCamReadout() : null}
    </UiEntity>
  )
}

function flyCamReadout() {
  const pose = getFlyCamPose()
  const n = (v: number) => (Math.round(v * 100) / 100).toFixed(2)
  const copied = Date.now() < flyCopiedUntil
  return (
    <UiEntity
      uiTransform={{
        width: 280,
        height: 148,
        positionType: 'absolute',
        position: { bottom: 24, left: 16 },
        flexDirection: 'column',
        padding: 10
      }}
      uiBackground={{ color: Color4.create(0.07, 0.05, 0.03, 0.92) }}
    >
      <Label
        value="FLY CAM"
        fontSize={12}
        color={Color4.create(0.96, 0.9, 0.78, 1)}
        uiTransform={{ width: '100%', height: 18 }}
      />
      <Label
        value={`pos  ${n(pose.x)}  ${n(pose.y)}  ${n(pose.z)}`}
        fontSize={13}
        color={Color4.White()}
        uiTransform={{ width: '100%', height: 20 }}
      />
      <Label
        value={`rot  pitch ${n(pose.pitch)}  yaw ${n(pose.yaw)}`}
        fontSize={13}
        color={Color4.White()}
        uiTransform={{ width: '100%', height: 20 }}
      />
      <Button
        value={copied ? 'Copied' : 'Copy pose'}
        variant="primary"
        uiTransform={{ width: '100%', height: 36, margin: { top: 10 } }}
        onMouseDown={() => {
          const text = flyCamCopyText()
          void copyToClipboard({ text }).then(
            () => {
              flyCopiedUntil = Date.now() + 1500
              storageLine = text
            },
            (e) => {
              storageLine = `copy failed: ${e}`
            }
          )
        }}
      />
    </UiEntity>
  )
}

function panel() {
  const games = readGames()
  if (games.length > 0 && !games.some((g) => g.id === selectedGameId)) {
    const newest = games.reduce((a, b) => (a.id > b.id ? a : b))
    selectedGameId = newest.id
    selectedLane = newest.lane
  }
  const state = currentLaneState()
  return (
    <UiEntity
      uiTransform={{
        width: 340,
        height: 500,
        positionType: 'absolute',
        position: { top: '10%', right: '4%' },
        flexDirection: 'column',
        padding: 10
      }}
      uiBackground={{ color: Color4.create(0.07, 0.05, 0.03, 0.92) }}
    >
      <Label value="PIRATE BOOTY — GM" fontSize={14} color={Color4.create(0.96, 0.9, 0.78, 1)} uiTransform={{ height: 22, width: '100%' }} />
      {tabBar()}
      <UiEntity
        uiTransform={{
          width: '100%',
          height: 392,
          flexDirection: 'column',
          overflow: 'scroll',
          margin: { top: 4 }
        }}
      >
        {tab === 'general' ? generalTab() : null}
        {tab === 'fishing' ? fishingTab() : null}
        {tab === 'deck' ? deckTab(games, state) : null}
        {tab === 'cannon' ? cannonTab() : null}
        {tab === 'booty' ? bootyTab() : null}
      </UiEntity>
      <Label
        value={storageLine || ' '}
        fontSize={10}
        color={Color4.create(0.8, 0.85, 0.6, 1)}
        uiTransform={{ height: 16, width: '100%', margin: { top: 4 } }}
      />
    </UiEntity>
  )
}

function tabBar() {
  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', margin: { top: 4 } }}>
      {rowTabs([
        { id: 'general', label: 'General' },
        { id: 'fishing', label: 'Fishing' },
        { id: 'deck', label: 'Deck' }
      ])}
      {rowTabs([
        { id: 'cannon', label: 'Cannon' },
        { id: 'booty', label: 'Booty' }
      ])}
    </UiEntity>
  )
}

function rowTabs(items: Array<{ id: GmTab; label: string }>) {
  return (
    <UiEntity uiTransform={{ width: '100%', height: 30, flexDirection: 'row', margin: { top: 3 } }}>
      {items.map((item) => (
        <Button
          value={item.label}
          variant={tab === item.id ? 'primary' : 'secondary'}
          uiTransform={{ width: `${100 / items.length}%`, height: 28, margin: { right: 4 } }}
          onMouseDown={() => {
            tab = item.id
          }}
        />
      ))}
    </UiEntity>
  )
}

function generalTab() {
  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      <Label value="BOTS" fontSize={12} color={Color4.White()} uiTransform={{ height: 20, margin: { top: 6 }, width: '100%' }} />
      <Label
        value={`On hub right now: ${readHubBots()}`}
        fontSize={11}
        color={Color4.create(0.75, 0.7, 0.55, 1)}
        uiTransform={{ height: 16, width: '100%' }}
      />
      {rowButtons(
        [1, 2, 3, 4].map((n) => ({
          label: botPick === n ? `▸${n}` : String(n),
          onClick: () => {
            botPick = n
          }
        }))
      )}
      {rowButtons([
        {
          label: `Put ${botPick} on hub`,
          onClick: () => room.send('gmSpawnFakes', { count: botPick, startNow: false })
        },
        { label: 'Clear bots', onClick: () => room.send('gmClearFakes', {}) }
      ])}
      {rowButtons([
        {
          label: readNeedMoreThanOne() ? 'Need 2+ ON' : 'Need 2+ OFF',
          onClick: () => room.send('gmSetNeedMoreThanOne', { on: !readNeedMoreThanOne() })
        }
      ])}
      {rowButtons([
        { label: 'Players', onClick: () => openPlayers() },
        { label: 'Leaderboards', onClick: () => openBoard() }
      ])}
      {rowButtons([
        {
          label: isFlyCamOn() ? 'Fly cam ON' : 'Fly cam',
          onClick: () => setFlyCam(!isFlyCamOn())
        },
        {
          label: 'Hub cam',
          onClick: () => {
            setFlyCam(false)
            leaveGameView()
          }
        }
      ])}
      {rowButtons([
        {
          label: (mobileOnlyLocal ?? isMobileOnly()) ? 'Mobile-only ON' : 'Mobile-only OFF',
          onClick: () => {
            const next = !(mobileOnlyLocal ?? isMobileOnly())
            mobileOnlyLocal = next
            room.send('gmSetMobileOnly', { on: next })
          }
        }
      ])}
      {rowButtons([
        {
          label: (tutorialForceLocal ?? isTutorialForce()) ? 'Tutorial ALWAYS' : 'Tutorial first-time',
          onClick: () => {
            const next = !(tutorialForceLocal ?? isTutorialForce())
            tutorialForceLocal = next
            room.send('gmSetTutorialForce', { on: next })
          }
        }
      ])}
      {rowButtons([
        { label: 'Reset my coins', onClick: () => room.send('gmResetCoins', { scope: 'self' }) },
        {
          label: confirmResetAll ? 'Confirm ALL' : 'Reset ALL coins',
          onClick: () => {
            if (!confirmResetAll) {
              confirmResetAll = true
              return
            }
            confirmResetAll = false
            room.send('gmResetCoins', { scope: 'all' })
          }
        }
      ])}
    </UiEntity>
  )
}

function fishingTab() {
  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      <Label value="SCHOOL" fontSize={12} color={Color4.White()} uiTransform={{ height: 20, margin: { top: 6 }, width: '100%' }} />
      {rowButtons([
        { label: `Fish ${getFishCount()}  −5%`, onClick: () => bumpFishCount(-0.05) },
        { label: `Fish ${getFishCount()}  +5%`, onClick: () => bumpFishCount(0.05) }
      ])}
      <Label value="CATCH TOAST" fontSize={12} color={Color4.White()} uiTransform={{ height: 20, margin: { top: 10 }, width: '100%' }} />
      <Label
        value="Blast a random pirate and fish to every client so you can debug the slide-in."
        fontSize={10}
        color={Color4.create(0.75, 0.7, 0.55, 1)}
        uiTransform={{ height: 32, width: '100%' }}
      />
      {rowButtons([
        { label: 'Fake catch', onClick: () => room.send('gmFakeCatch', {}) }
      ])}
    </UiEntity>
  )
}

function deckTab(games: GameInfo[], state: ReturnType<typeof currentLaneState>) {
  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      <Label value="GAMES" fontSize={12} color={Color4.White()} uiTransform={{ height: 20, margin: { top: 6 }, width: '100%' }} />
      {rowButtons([
        {
          label: `Start game with ${botPick} bots`,
          onClick: () => {
            selectedGameId = -1
            statusOpen = true
            room.send('gmNewGame', { count: botPick })
          }
        }
      ])}
      {gameList(games)}
      <Label
        value="Add = bots into that game. Status = live results. Cam = that dock camera."
        fontSize={10}
        color={Color4.create(0.75, 0.7, 0.55, 1)}
        uiTransform={{ height: 28, width: '100%', margin: { top: 6 } }}
      />
      {rowButtons([
        {
          label: dockLabel(selectedLane, state),
          onClick: () => {
            const loaded = state ? isLaneLoaded(state, selectedLane) : false
            room.send('gmLoadLane', { laneId: selectedLane, on: !loaded })
          }
        },
        { label: 'Unload dock', onClick: () => room.send('gmLoadLane', { laneId: selectedLane, on: false }) }
      ])}
      {rowButtons([
        { label: 'Go', onClick: () => room.send('gmStartLane', { laneId: selectedLane }) },
        { label: 'Preview', onClick: () => room.send('gmStartPreview', { laneId: selectedLane }) },
        { label: 'Stop', onClick: () => room.send('gmStopLane', { laneId: selectedLane }) }
      ])}
      {rowButtons([
        { label: 'Restart', onClick: () => room.send('gmRestart', { laneId: selectedLane }) },
        { label: 'Reset games', onClick: () => room.send('gmResetGames', {}) }
      ])}
      {rowButtons([
        {
          label: isDeckHideMeshVisible() ? 'Hide mesh ON' : 'Hide mesh',
          onClick: () => setDeckHideMeshVisible(!isDeckHideMeshVisible())
        }
      ])}
      {rowButtons([
        {
          label: `Obst ${getObstacleRange().min}-${getObstacleRange().max}  −1`,
          onClick: () => {
            bumpObstacleDifficulty(-1)
            room.send('gmBumpObstacles', { delta: -1 })
          }
        },
        {
          label: `Obst ${getObstacleRange().min}-${getObstacleRange().max}  +1`,
          onClick: () => {
            bumpObstacleDifficulty(1)
            room.send('gmBumpObstacles', { delta: 1 })
          }
        }
      ])}
    </UiEntity>
  )
}

function cannonTab() {
  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      <Label value="CANNON FODDER" fontSize={12} color={Color4.White()} uiTransform={{ height: 20, margin: { top: 6 }, width: '100%' }} />
      <Label
        value="No extra cannon tools yet. Hub cam drops you out of a game view."
        fontSize={10}
        color={Color4.create(0.75, 0.7, 0.55, 1)}
        uiTransform={{ height: 32, width: '100%' }}
      />
      {rowButtons([
        {
          label: 'Hub cam',
          onClick: () => {
            setFlyCam(false)
            leaveGameView()
          }
        }
      ])}
    </UiEntity>
  )
}

function bootyTab() {
  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      <Label value="BOOTY LOOT" fontSize={12} color={Color4.White()} uiTransform={{ height: 20, margin: { top: 6 }, width: '100%' }} />
      {rowButtons([
        {
          label: isLootGlbsForced() ? 'Loot GLBs ON' : 'Loot GLBs',
          onClick: () => toggleLootGlbsForced()
        }
      ])}
    </UiEntity>
  )
}

function gameList(games: GameInfo[]) {
  if (games.length === 0) {
    return (
      <Label
        value="No games yet. Hit Start game with N bots."
        fontSize={11}
        color={Color4.create(0.75, 0.7, 0.55, 1)}
        uiTransform={{ height: 22, width: '100%', margin: { top: 4 } }}
      />
    )
  }
  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', margin: { top: 4 } }}>
      {games.map((g) => (
        <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', margin: { top: 6 } }}>
          <Button
            value={`${g.id === selectedGameId ? '▸ ' : ''}${g.label}`}
            variant={g.id === selectedGameId ? 'primary' : 'secondary'}
            uiTransform={{ width: '100%', height: 28 }}
            onMouseDown={() => {
              selectedGameId = g.id
              selectedLane = g.lane
              statusOpen = true
            }}
          />
          {rowButtons([
            {
              label: `Add ${botPick}`,
              onClick: () => {
                selectedGameId = g.id
                selectedLane = g.lane
                room.send('gmAssignFakes', { gameId: g.id, count: botPick })
                statusOpen = true
              }
            },
            {
              label: 'Status',
              onClick: () => {
                selectedGameId = g.id
                selectedLane = g.lane
                statusOpen = true
              }
            },
            {
              label: 'Camera',
              onClick: () => {
                selectedGameId = g.id
                selectedLane = g.lane
                statusOpen = true
                setFlyCam(false)
                spectateLane(g.lane)
              }
            }
          ])}
        </UiEntity>
      ))}
    </UiEntity>
  )
}

function selectedGame(): GameInfo | undefined {
  const games = readGames()
  return games.find((g) => g.id === selectedGameId) ?? games[0]
}

function statusPanel() {
  const g = selectedGame()
  return (
    <UiEntity
      uiTransform={{
        width: 320,
        height: 420,
        positionType: 'absolute',
        position: { top: '12%', left: '5%' },
        flexDirection: 'column',
        padding: 10
      }}
      uiBackground={{ color: Color4.create(0.07, 0.05, 0.03, 0.92) }}
    >
      <Label value="GAME STATUS" fontSize={14} color={Color4.create(0.96, 0.9, 0.78, 1)} uiTransform={{ height: 24, width: '100%' }} />
      {g ? (
        statusBody(g)
      ) : (
        <Label
          value="No game selected."
          fontSize={12}
          color={Color4.create(0.75, 0.7, 0.55, 1)}
          uiTransform={{ height: 24, width: '100%' }}
        />
      )}
      {rowButtons([
        {
          label: 'Close status',
          onClick: () => {
            statusOpen = false
          }
        }
      ])}
    </UiEntity>
  )
}

function statusBody(g: GameInfo) {
  const seats = g.seats ?? []
  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      <Label value={g.label} fontSize={13} color={Color4.White()} uiTransform={{ height: 22, width: '100%' }} />
      <Label
        value={`t=${(g.elapsed ?? 0).toFixed(1)}s   barrel ${(g.barrelX ?? 0).toFixed(0)}   rows ${g.dropped ?? 0}/${LANE.rowCount}`}
        fontSize={12}
        color={Color4.create(0.8, 0.85, 0.6, 1)}
        uiTransform={{ height: 20, width: '100%' }}
      />
      <Label
        value={g.result || (g.phase === 'ended' ? 'ended' : g.phase)}
        fontSize={12}
        color={Color4.create(0.96, 0.9, 0.78, 1)}
        uiTransform={{ height: 20, width: '100%', margin: { top: 4 } }}
      />
      <Label value="PLAYERS" fontSize={12} color={Color4.White()} uiTransform={{ height: 20, margin: { top: 8 }, width: '100%' }} />
      {seats.length === 0 ? (
        <Label value="none" fontSize={12} color={Color4.create(0.75, 0.7, 0.55, 1)} uiTransform={{ height: 18, width: '100%' }} />
      ) : (
        seats.map((s) => (
          <Label
            value={`${s.fake ? 'bot' : 'plyr'}  ${s.name}  ${s.state}`}
            fontSize={12}
            color={s.state === 'finished' ? Color4.create(0.4, 0.9, 0.5, 1) : s.state === 'out' ? Color4.create(0.9, 0.4, 0.4, 1) : Color4.White()}
            uiTransform={{ height: 18, width: '100%' }}
          />
        ))
      )}
    </UiEntity>
  )
}

function dockLabel(i: number, state: ReturnType<typeof currentLaneState>): string {
  if (!state) return `Load dock ${i + 1}`
  if (!isLaneLoaded(state, i)) return `Load dock ${i + 1}`
  const phase = getLanePhase(state, i)
  if (phase === 'racing') return `Dock ${i + 1} ▶`
  if (phase === 'preview') return `Dock ${i + 1} ▷`
  if (phase === 'ended') return `Dock ${i + 1} ■`
  return `Dock ${i + 1} ●`
}

function rowButtons(items: Array<{ label: string; onClick: () => void }>) {
  return (
    <UiEntity uiTransform={{ width: '100%', height: 34, flexDirection: 'row', margin: { top: 4 } }}>
      {items.map((item) => (
        <Button
          value={item.label}
          variant="secondary"
          uiTransform={{ width: `${100 / items.length}%`, height: 32, margin: { right: 4 } }}
          onMouseDown={item.onClick}
        />
      ))}
    </UiEntity>
  )
}
