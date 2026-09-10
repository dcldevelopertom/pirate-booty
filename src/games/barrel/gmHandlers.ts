import { isServer } from '@dcl/sdk/network'
import { broadcastLeaderboard, room } from '../../net/messages'
import {
  deletePlayer,
  getBoardSnap,
  getPlayerSnap,
  listBoardSnaps,
  listPlayerSnaps,
  listPlayers,
  getLeaderboard,
  getPlayerStats,
  resetAllEconomies,
  resetLeaderboard,
  resetPlayerEconomy,
  snapshotBoard,
  snapshotPlayers,
  setTutorialForce,
  setMobileOnly
} from '../../net/storage'
import {
  assignFakesToGame,
  clearFakes,
  minStartCount,
  openGameWithBots,
  resetSessions,
  setNeedMoreThanOne,
  spawnFakes,
  unwatchAll,
  watchLane
} from '../shared/MatchSession'
import { beginPrep } from './MatchFlow'
import { allocate, free, loadAll, resetGames, restart, restartAllLoaded, unloadAll } from './LanePool'
import { startPreviewAll, startRace, stopAllRaces, stopRace } from './Race'
import { bumpObstacleDifficulty } from './Obstacles'

export function initGmHandlers(): void {
  if (!isServer()) return

  room.onMessage('gmLoadLane', (data, context) => {
    if (!allow(context)) return
    if (data.on) allocate(data.laneId)
    else free(data.laneId)
  })

  room.onMessage('gmLoadAll', (_data, context) => {
    if (!allow(context)) return
    loadAll()
  })

  room.onMessage('gmUnloadAll', (_data, context) => {
    if (!allow(context)) return
    unloadAll()
  })

  room.onMessage('gmRestart', (data, context) => {
    if (!allow(context)) return
    stopRace(data.laneId)
    restart(data.laneId)
  })

  room.onMessage('gmRestartAll', (_data, context) => {
    if (!allow(context)) return
    stopAllRaces()
    restartAllLoaded()
  })

  room.onMessage('gmResetGames', (_data, context) => {
    if (!allow(context)) return
    stopAllRaces()
    resetSessions()
    resetGames()
  })

  room.onMessage('gmStartLane', (data, context) => {
    if (!allow(context)) return
    beginPrep(data.laneId)
  })

  room.onMessage('gmStartPreview', (data, context) => {
    if (!allow(context)) return
    startRace(data.laneId, true)
  })

  room.onMessage('gmStartPreviewAll', (_data, context) => {
    if (!allow(context)) return
    startPreviewAll()
  })

  room.onMessage('gmStopLane', (data, context) => {
    if (!allow(context)) return
    stopRace(data.laneId)
  })

  room.onMessage('gmStopAll', (_data, context) => {
    if (!allow(context)) return
    stopAllRaces()
  })

  room.onMessage('gmSpawnFakes', (data, context) => {
    if (!allow(context) || !context) return
    const made = spawnFakes(data.count)
    reply(context.from, true, `spawned ${made} bots on hub`)
  })

  room.onMessage('gmAssignFakes', (data, context) => {
    if (!allow(context) || !context) return
    const moved = assignFakesToGame(data.gameId, data.count)
    reply(context.from, true, `sent ${moved} hub bots to G${data.gameId}`)
  })

  room.onMessage('gmNewGame', (data, context) => {
    if (!allow(context) || !context) return
    const { game, moved, started } = openGameWithBots(data.count, context.from)
    if (!game) {
      reply(context.from, false, 'no free docks')
      return
    }
    const detail = started
      ? `G${game.id} started with ${moved} bots`
      : `G${game.id} filling ${game.seats.length} — need ${minStartCount()} to start`
    reply(context.from, true, detail)
  })

  room.onMessage('gmClearFakes', (_data, context) => {
    if (!allow(context) || !context) return
    clearFakes()
    reply(context.from, true, 'cleared bots')
  })

  room.onMessage('gmWatchGame', (data, context) => {
    if (!allow(context) || !context) return
    watchLane(context.from, data.laneId)
  })

  room.onMessage('gmUnwatch', (_data, context) => {
    if (!allow(context) || !context) return
    unwatchAll(context.from)
  })

  room.onMessage('gmSetNeedMoreThanOne', (data, context) => {
    if (!allow(context) || !context) return
    setNeedMoreThanOne(data.on)
    reply(context.from, true, data.on ? 'games need >1 player' : 'solo games allowed')
  })

  room.onMessage('gmSetTutorialForce', async (data, context) => {
    if (!allow(context) || !context) return
    const ok = await setTutorialForce(data.on)
    reply(context.from, ok, data.on ? 'tutorial always ON' : 'tutorial first-time only')
  })

  room.onMessage('gmBumpObstacles', (data, context) => {
    if (!allow(context) || !context) return
    const range = bumpObstacleDifficulty(data.delta)
    reply(context.from, true, `obstacles ${range.min}-${range.max}`)
  })

  room.onMessage('gmSetMobileOnly', async (data, context) => {
    if (!allow(context) || !context) return
    const ok = await setMobileOnly(data.on)
    room.send('mobileOnlyState', { on: data.on })
    reply(context.from, ok, data.on ? 'mobile-only ON' : 'mobile-only OFF')
  })

  room.onMessage('gmResetCoins', async (data, context) => {
    if (!allow(context) || !context) return
    const from = context.from
    try {
      if (data.scope === 'self') {
        const ok = await resetPlayerEconomy(from)
        await pushStats(from)
        await pushBoard()
        reply(from, ok, ok ? 'reset your coins/crowns' : 'storage write failed')
        return
      }
      if (data.scope === 'address' && data.address) {
        const ok = await resetPlayerEconomy(data.address)
        await pushStats(data.address)
        await pushBoard()
        reply(from, ok, ok ? `reset ${data.address}` : 'storage write failed')
        return
      }
      if (data.scope === 'all') {
        const n = await resetAllEconomies()
        await resetPlayerEconomy(from)
        await pushBoard()
        await pushStats(from)
        const players = await listPlayers()
        for (const row of players) await pushStats(row.address)
        reply(from, true, `cleared coins/crowns for ${n} players`)
        return
      }
      reply(from, false, `unknown scope ${data.scope}`)
    } catch (e) {
      reply(from, false, String(e))
    }
  })

  room.onMessage('gmListPlayers', async (_data, context) => {
    if (!allow(context) || !context) return
    await sendPlayerList(context.from)
  })

  room.onMessage('gmResetPlayer', async (data, context) => {
    if (!allow(context) || !context) return
    const ok = await resetPlayerEconomy(data.address)
    reply(context.from, ok, ok ? `reset ${short(data.address)}` : 'reset failed')
    await sendPlayerList(context.from)
    await sendBoardList(context.from)
    broadcastLeaderboard(await getLeaderboard())
  })

  room.onMessage('gmDeletePlayer', async (data, context) => {
    if (!allow(context) || !context) return
    const ok = await deletePlayer(data.address)
    reply(context.from, ok, ok ? `deleted ${short(data.address)}` : 'delete failed')
    await sendPlayerList(context.from)
    await sendBoardList(context.from)
    broadcastLeaderboard(await getLeaderboard())
  })

  room.onMessage('gmListBoard', async (_data, context) => {
    if (!allow(context) || !context) return
    await sendBoardList(context.from)
  })

  room.onMessage('gmResetBoard', async (_data, context) => {
    if (!allow(context) || !context) return
    const ok = await resetLeaderboard()
    reply(context.from, ok, ok ? 'leaderboard cleared (snapshot saved)' : 'clear failed')
    await sendBoardList(context.from)
    broadcastLeaderboard([])
  })

  room.onMessage('gmSnapPlayers', async (_data, context) => {
    if (!allow(context) || !context) return
    const at = await snapshotPlayers()
    reply(context.from, true, `player snapshot ${at}`)
    await sendPlayerList(context.from)
  })

  room.onMessage('gmSnapBoard', async (_data, context) => {
    if (!allow(context) || !context) return
    const at = await snapshotBoard()
    reply(context.from, true, `board snapshot ${at}`)
    await sendBoardList(context.from)
  })

  room.onMessage('gmViewSnap', async (data, context) => {
    if (!allow(context) || !context) return
    const rows = data.kind === 'board' ? await getBoardSnap(data.at) : await getPlayerSnap(data.at)
    room.send('gmSnapData', { kind: data.kind, at: data.at, rows }, { to: [context.from] })
  })
}

async function pushBoard(): Promise<void> {
  broadcastLeaderboard(await getLeaderboard())
}

async function pushStats(address: string): Promise<void> {
  try {
    const stats = await getPlayerStats(address)
    room.send('myStats', { coins: stats.coins, wins: stats.wins }, { to: [address] })
  } catch (e) {
    room.send('myStats', { coins: 0, wins: 0 }, { to: [address] })
    console.log('[SERVER] push stats failed', address, e)
  }
}

async function sendPlayerList(to: string): Promise<void> {
  const rows = await listPlayers()
  const snaps = await listPlayerSnaps()
  room.send('gmPlayerList', { rows, snaps }, { to: [to] })
}

async function sendBoardList(to: string): Promise<void> {
  const rows = await getLeaderboard()
  const snaps = await listBoardSnaps()
  room.send('gmBoardList', { rows, snaps }, { to: [to] })
}

function short(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function allow(context: { from: string } | undefined): boolean {
  return !!context
}

function reply(to: string, ok: boolean, detail: string): void {
  room.send('gmStorageResult', { ok, detail }, { to: [to] })
}
