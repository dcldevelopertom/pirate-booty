import { engine } from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'
import { LANE, MATCH } from '../../config'
import { isFakeAddress, sendOpts } from '../../net/audience'
import { room } from '../../net/messages'
import { getLeaderboard, getMobileOnly, getPlayerStats, markTutorialSeen, shouldOfferTutorial } from '../../net/storage'
import { laneSpawn } from '../../world/layout'
import {
  gameOnLane,
  getSeats,
  joinPlayer,
  leavePlayer,
  tickLobbies,
  setDropMembersHandler,
  setEndHandler,
  setGamePhase,
  setPrepHandler
} from '../shared/MatchSession'
import { allocate, getLanePack, setFreeHandler } from './LanePool'
import { generateObstacleLayout, setLaneLayout } from './Obstacles'
import { dropMembers, rebuildLane, startRace, stopRace } from './Race'
import { isOccupied } from '../shared/Occupancy'

type Prep = {
  lane: number
  stage: 'load' | 'count'
  t: number
  count: number
}

const preps: Array<Prep | null> = [null, null, null, null]

export function initMatchFlow(): void {
  if (!isServer()) return

  setPrepHandler(beginPrep)
  setEndHandler((lane) => {
    preps[lane] = null
    stopRace(lane)
  })
  setDropMembersHandler((lane, addresses) => {
    dropMembers(lane, addresses)
  })
  setFreeHandler((lane) => {
    preps[lane] = null
    stopRace(lane, false)
  })

  room.onMessage('playerJoinMatch', (data, context) => {
    const address = context?.from
    if (!address) return
    if (isOccupied(address, 'dodge')) {
      room.send('joinDenied', { reason: 'already in a game', game: 'dodge' }, { to: [address] })
      return
    }
    const preferred = data.laneId >= 0 && data.laneId < LANE.count ? data.laneId : undefined
    const game = joinPlayer(address, preferred)
    if (!game) {
      room.send('joinDenied', { reason: 'no free docks', game: 'dodge' }, { to: [address] })
      return
    }
    const slot = getSeats(game.lane).findIndex((s) => s.address.toLowerCase() === address.toLowerCase()) + 1
    room.send(
      'matchQueued',
      { gameId: game.id, laneId: game.lane, slot, max: MATCH.maxPlayers, phase: game.phase },
      { to: [address] }
    )
  })

  room.onMessage('playerLeaveMatch', (_data, context) => {
    if (!context?.from) return
    leavePlayer(context.from)
  })

  room.onMessage('playerAskStats', async (_data, context) => {
    if (!context?.from) return
    const address = context.from
    try {
      const offer = await shouldOfferTutorial(address)
      room.send('tutorialOffer', offer, { to: [address] })
    } catch (e) {
      console.log('[SERVER] tutorial offer failed', e)
      room.send('tutorialOffer', { show: true, force: false }, { to: [address] })
    }
    try {
      room.send('mobileOnlyState', { on: await getMobileOnly() }, { to: [address] })
    } catch (e) {
      console.log('[SERVER] mobileOnly failed', e)
      room.send('mobileOnlyState', { on: false }, { to: [address] })
    }
    try {
      const stats = await getPlayerStats(address)
      room.send('myStats', stats, { to: [address] })
      const board = await getLeaderboard()
      room.send(
        'leaderboard',
        { rows: board.map((r) => ({ address: r.address, name: r.name, coins: r.coins, wins: r.wins })) },
        { to: [address] }
      )
    } catch (e) {
      console.log('[SERVER] stats failed', e)
    }
  })

  room.onMessage('tutorialDone', async (_data, context) => {
    if (!context?.from) return
    try {
      await markTutorialSeen(context.from)
    } catch (e) {
      console.log('[SERVER] tutorial save failed', e)
    }
  })

  engine.addSystem((dt) => {
    const step = dt > 1 ? dt / 1000 : dt
    tickLobbies(Math.min(step, 0.25))
  }, 2, 'match-lobby')
  engine.addSystem(tickPreps, 2, 'match-prep')
}

export function beginPrep(lane: number): void {
  if (lane < 0 || lane >= LANE.count) return
  if (preps[lane]) return
  stopRace(lane, false)
  if (!getLanePack(lane)) allocate(lane)
  rebuildLane(lane)
  const seed = (Math.floor(Math.random() * 0x7fffffff) >>> 0) || 1
  const obstacles = generateObstacleLayout(seed)
  setLaneLayout(lane, seed, obstacles)
  setGamePhase(lane, 'loading')
  preps[lane] = { lane, stage: 'load', t: 0, count: MATCH.countdown }

  const seats = getSeats(lane)
  for (let i = 0; i < seats.length; i++) {
    const seat = seats[i]
    if (seat.fake || isFakeAddress(seat.address)) continue
    const spawn = laneSpawn(lane, i)
    room.send('matchPrep', { laneId: lane, ...spawn }, { to: [seat.address] })
  }
  const opts = sendOpts(lane)
  if (opts) room.send('matchLayout', { laneId: lane, seed, obstacles }, opts)
  console.log('[SERVER] match prep dock', lane + 1, 'seed', seed, 'seats', getSeats(lane).length)
}

function tickPreps(dt: number): void {
  const step = dt > 1 ? dt / 1000 : dt
  for (let lane = 0; lane < LANE.count; lane++) {
    const prep = preps[lane]
    if (!prep) continue
    prep.t += Math.min(step, 0.25)

    if (prep.stage === 'load') {
      if (prep.t < MATCH.loadSeconds) continue
      prep.stage = 'count'
      prep.t = 0
      setGamePhase(lane, 'countdown')
      const opts = sendOpts(lane)
      if (opts) room.send('matchCountdown', { laneId: lane, count: prep.count }, opts)
      continue
    }

    if (prep.t < 1) continue
    prep.t = 0
    prep.count -= 1
    const opts = sendOpts(lane)
    if (opts) room.send('matchCountdown', { laneId: lane, count: prep.count }, opts)
    if (prep.count > 0) continue

    preps[lane] = null
    if (!gameOnLane(lane)) continue
    if (!getLanePack(lane)) allocate(lane)
    if (!getLanePack(lane)) continue
    setGamePhase(lane, 'racing')
    startRace(lane, false, false)
  }
}
