import { PlayerIdentityData, Transform, engine } from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'
import { BARREL, DECK_Y, LANE, RACE, WATER_Y } from '../../config'
import { sendOpts } from '../../net/audience'
import { room } from '../../net/messages'
import { isFakeAddress } from '../../net/audience'
import { coinsForPlace, getLeaderboard, getPlayerStats, grantMatchReward } from '../../net/storage'
import { getLiveMembers, getSeats, markGameEnded, setSnapshotReader, writeRaceStatus } from '../shared/MatchSession'
import { laneZ } from '../../world/layout'
import { writeBarrelPose } from './Boulder'
import { allocate, getLanePack, setPhase } from './LanePool'
import { resetFinishPad } from '../../world/DockLanes'
import { clearObstacles, generateObstacleLayout, getLaneLayout, setLaneLayout, sinkObstaclesOnRow, sinkRemainingObstacles } from './Obstacles'
import { bumpLaneGen, rowFallToWater } from './Rows'

type Member = {
  address: string
  alive: boolean
  finished: boolean
}

type RaceRun = {
  preview: boolean
  barrelX: number
  barrelFall: number
  hold: number
  nextCollapse: number
  fallY: number[]
  sunk: boolean[]
  members: Member[]
  finishOrder: string[]
  elapsed: number
  tick: number
  finishDrop: boolean
}

const runs: Array<RaceRun | null> = [null, null, null, null]

export function registerRaceTick(): void {
  if (!isServer()) return
  setSnapshotReader((lane) => {
    const layout = getLaneLayout(lane)
    const run = runs[lane]
    let sunk = 0
    if (run) for (const flag of run.sunk) if (flag) sunk++
    return {
      seed: layout?.seed ?? 0,
      dropped: run?.nextCollapse ?? 0,
      sunk,
      obstacles: layout?.pieces ?? []
    }
  })
  engine.addSystem(tickRaces, 1, 'barrel-race')
  room.onMessage('laneFall', (data, context) => {
    if (!context) return
    notePlayerFall(data.laneId, context.from)
  })
}

export function notePlayerFall(lane: number, address: string): void {
  const run = runs[lane]
  if (!run) {
    raceLog(`FALL dock ${lane + 1} ${address.slice(0, 8)}… (no live race)`)
    return
  }
  const member = run.members.find((m) => m.address.toLowerCase() === address.toLowerCase())
  if (member && member.alive) {
    markMemberOut(lane, address, 'kill trigger')
    return
  }
  raceLog(`FALL dock ${lane + 1} ${address.slice(0, 8)}… preview/spectator t=${run.elapsed.toFixed(2)}s`)
}

export function rebuildLane(lane: number): void {
  if (!getLanePack(lane)) allocate(lane)
  resetGeometry(lane)
  resetFinishPad(lane)
}

export function getRaceRun(lane: number): RaceRun | null {
  return runs[lane]
}

export function dropMembers(lane: number, addresses: string[]): void {
  const run = runs[lane]
  if (!run) return
  const drop = new Set(addresses.map((a) => a.toLowerCase()))
  run.members = run.members.filter((m) => !drop.has(m.address.toLowerCase()))
}

export function markMemberOut(lane: number, address: string, reason: string): void {
  const run = runs[lane]
  if (!run) return
  const member = run.members.find((m) => m.address.toLowerCase() === address.toLowerCase())
  if (!member || !member.alive) return
  member.alive = false
  raceLog(`OUT dock ${lane + 1} ${address.slice(0, 8)}… ${reason} t=${run.elapsed.toFixed(2)}s`)
}

export function markMemberFinish(lane: number, address: string, reason: string): void {
  const run = runs[lane]
  if (!run) return
  const member = run.members.find((m) => m.address.toLowerCase() === address.toLowerCase())
  if (!member || !member.alive || member.finished) return
  member.finished = true
  run.finishOrder.push(address)
  const place = run.finishOrder.length
  const coins = racePays(run) ? coinsForPlace(place) : 0
  if (!isFakeAddress(address)) {
    room.send('playerFinished', { laneId: lane, place, coins }, { to: [address] })
  }
  raceLog(`FINISH dock ${lane + 1} ${address.slice(0, 8)}… ${reason} place=${place} t=${run.elapsed.toFixed(2)}s`)
}

export function startRace(lane: number, preview: boolean, rebuild = true): void {
  if (!isServer()) return
  if (lane < 0 || lane >= LANE.count) return
  if (!getLanePack(lane)) allocate(lane)
  if (rebuild) resetGeometry(lane)
  const existing = !rebuild ? getLaneLayout(lane) : null
  const seed = existing ? existing.seed : (Math.floor(Math.random() * 0x7fffffff) >>> 0) || 1
  const pieces = existing ? existing.pieces : generateObstacleLayout(seed)
  setLaneLayout(lane, seed, pieces)
  clearObstacles(lane)
  const pack = getLanePack(lane)
  if (pack) pack.obstacles = []
  const layoutOpts = sendOpts(lane)
  if (layoutOpts) room.send('matchLayout', { laneId: lane, seed, obstacles: pieces }, layoutOpts)
  const members = preview ? [] : getLiveMembers(lane)
  runs[lane] = {
    preview,
    barrelX: 0,
    barrelFall: 0,
    hold: preview ? 0 : RACE.startHold,
    nextCollapse: 0,
    fallY: zeroFalls(),
    sunk: zeroFlags(),
    members,
    finishOrder: [],
    elapsed: 0,
    tick: 0,
    finishDrop: false
  }
  setPhase(lane, preview ? 'preview' : 'racing')
  raceLog(
    `START dock ${lane + 1} ${preview ? 'PREVIEW' : 'MATCH'} seed=${seed} obstacles=${pieces.length} members=${members.length} barrelX=${BARREL.startX.toFixed(2)} rows=${LANE.rowCount}`
  )
}



export function stopRace(lane: number, rebuild = true): void {
  if (!isServer()) return
  if (!runs[lane] && !getLanePack(lane)) return
  const run = runs[lane]
  runs[lane] = null
  if (rebuild && getLanePack(lane)) {
    resetGeometry(lane)
    setPhase(lane, 'idle')
  }
  raceLog(`STOP dock ${lane + 1} at t=${(run?.elapsed ?? 0).toFixed(2)}s barrelX=${(run?.barrelX ?? 0).toFixed(1)}`)
}

export function startPreviewAll(): void {
  for (let i = 0; i < LANE.count; i++) {
    if (getLanePack(i)) startRace(i, true)
  }
}

export function stopAllRaces(): void {
  for (let i = 0; i < LANE.count; i++) stopRace(i)
}

export function clearRun(lane: number): void {
  runs[lane] = null
}

function zeroFalls(): number[] {
  const out: number[] = []
  for (let i = 0; i < LANE.rowCount; i++) out.push(0)
  return out
}

function zeroFlags(): boolean[] {
  const out: boolean[] = []
  for (let i = 0; i < LANE.rowCount; i++) out.push(false)
  return out
}

function resetGeometry(lane: number): void {
  const pack = getLanePack(lane)
  if (!pack) return
  const gen = bumpLaneGen(lane)
  const opts = sendOpts(lane)
  if (opts) room.send('laneCleared', { laneId: lane, gen }, opts)
  writeBarrelPose(pack.barrel, lane, BARREL.startX, 0)
}

function tickSeconds(dt: number): number {
  const sec = dt > 1 ? dt / 1000 : dt
  if (sec < 0) return 0
  return Math.min(sec, 1 / 20)
}

function tickRaces(dt: number): void {
  const step = tickSeconds(dt)
  for (let lane = 0; lane < LANE.count; lane++) {
    const run = runs[lane]
    if (!run) continue
    const pack = getLanePack(lane)
    if (!pack) {
      runs[lane] = null
      continue
    }

    run.tick++
    run.elapsed += step
    if (run.tick <= 5 || run.tick % 15 === 0) {
      writeRaceStatus(lane, {
        elapsed: run.elapsed,
        barrelX: run.barrelX,
        dropped: run.nextCollapse,
        members: run.members
      })
    }
    if (run.tick <= 5 || run.tick % 30 === 0) {
      raceLog(
        `STATUS dock ${lane + 1} tick=${run.tick} rawDt=${dt.toFixed(4)} step=${step.toFixed(4)} t=${run.elapsed.toFixed(2)}s barrelX=${run.barrelX.toFixed(2)} dropped=${run.nextCollapse}/${LANE.rowCount}`
      )
    }

    if (run.hold > 0) {
      run.hold -= step
      writeBarrelPose(pack.barrel, lane, BARREL.startX, 0, 0)
    } else {
      if (run.barrelX < RACE.finishLocalX) {
        run.barrelX += RACE.barrelMps * step
        if (run.barrelX > RACE.finishLocalX) run.barrelX = RACE.finishLocalX
      }
      if (run.barrelX >= RACE.finishLocalX) {
        run.barrelFall += RACE.fallMps * step
        if (!run.finishDrop) beginFinishDrop(lane, run)
      }
      writeBarrelPose(pack.barrel, lane, Math.max(BARREL.startX, run.barrelX), 0, run.barrelFall)
    }

    const shouldBeDropped = Math.min(LANE.rowCount, Math.floor(Math.max(0, run.barrelX) / LANE.rowDepth))
    while (run.nextCollapse < shouldBeDropped) {
      const rowIndex = run.nextCollapse
      run.nextCollapse++
      const dropOpts = sendOpts(lane)
      if (dropOpts) room.send('rowDrop', { laneId: lane, index: rowIndex }, dropOpts)
    }

    for (let i = 0; i < run.nextCollapse; i++) {
      if (run.sunk[i]) continue
      run.fallY[i] += RACE.fallMps * step
      const sinkAt = rowFallToWater()
      if (run.fallY[i] < sinkAt) continue
      run.fallY[i] = sinkAt
      sinkObstaclesOnRow(lane, i)
      run.sunk[i] = true
      const sunkOpts = sendOpts(lane)
      if (sunkOpts) room.send('rowSunk', { laneId: lane, index: i }, sunkOpts)
    }

    const outroDone = run.finishDrop && run.barrelFall >= 8
    if (!run.preview && run.members.length > 0) {
      updateMembers(lane, run)
      const racing = run.members.some((m) => m.alive && !m.finished)
      if (!racing) {
        const finished = run.members.some((m) => m.finished)
        if (!finished || outroDone) {
          endRace(lane, finished ? 'all-done' : 'all-out')
          continue
        }
      }
    }

    const lastSunk = run.nextCollapse >= LANE.rowCount && run.sunk[LANE.rowCount - 1]
    if (lastSunk && outroDone) endRace(lane, 'last-row')
  }
}

function beginFinishDrop(lane: number, run: RaceRun): void {
  run.finishDrop = true
  sinkRemainingObstacles(lane)
  const opts = sendOpts(lane)
  if (opts) room.send('finishDrop', { laneId: lane }, opts)
}

function updateMembers(lane: number, run: RaceRun): void {
  for (const [entity, identity] of engine.getEntitiesWith(PlayerIdentityData)) {
    const member = run.members.find((m) => m.address.toLowerCase() === identity.address.toLowerCase())
    if (!member || !member.alive || member.finished) continue
    const t = Transform.getOrNull(entity)
    if (!t) continue
    const localX = t.position.x - LANE.x0
    const localZ = t.position.z - laneZ(lane)
    const onLane =
      localX >= -1 && localX <= LANE.length + LANE.finishPad + 1 && localZ >= -1 && localZ <= LANE.width + 1
    if (onLane && t.position.y < WATER_Y - 1) {
      markMemberOut(lane, identity.address, 'below deck')
      continue
    }
    if (onLane && localX >= RACE.finishLocalX && t.position.y > DECK_Y - 0.5) {
      const minFinish = ((RACE.finishLocalX - BARREL.startX) / 14) * 0.85
      if (run.elapsed < minFinish) continue
      markMemberFinish(lane, identity.address, 'line')
    }
  }
}

function endRace(lane: number, reason: string): void {
  const run = runs[lane]
  const seats = getSeats(lane)
  runs[lane] = null
  if (getLanePack(lane)) setPhase(lane, 'ended')
  markGameEnded(lane)
  for (const m of run?.members ?? []) {
    if (isFakeAddress(m.address)) continue
    room.send('matchOver', { laneId: lane, died: !m.finished }, { to: [m.address] })
  }
  writeRaceStatus(lane, {
    elapsed: run?.elapsed ?? 0,
    barrelX: run?.barrelX ?? 0,
    dropped: run?.nextCollapse ?? 0,
    result: `END ${reason}  t=${(run?.elapsed ?? 0).toFixed(1)}s`,
    members: run?.members ?? []
  })
  const results =
    !run || run.members.length === 0
      ? 'preview (0 players) — no placements'
      : run.members
          .map((m) => `${m.address.slice(0, 8)}… ${m.finished ? 'finished' : m.alive ? 'alive' : 'out'}`)
          .join(' | ')
  raceLog(
    `END dock ${lane + 1} reason=${reason} t=${(run?.elapsed ?? 0).toFixed(2)}s barrelX=${(run?.barrelX ?? 0).toFixed(1)} dropped=${run?.nextCollapse ?? 0}/${LANE.rowCount} results: ${results}`
  )
  if (run) void settleRace(lane, run, seats)
}

async function settleRace(
  lane: number,
  run: RaceRun,
  seats: Array<{ address: string; name: string; fake: boolean }>
): Promise<void> {
  const nameOf = (address: string): string =>
    seats.find((s) => s.address.toLowerCase() === address.toLowerCase())?.name ?? address.slice(0, 8)
  const ordered: string[] = run.finishOrder.slice()
  for (const m of run.members) {
    if (!ordered.some((a) => a.toLowerCase() === m.address.toLowerCase())) ordered.push(m.address)
  }
  const paid = racePays(run)
  const rows: Array<{ name: string; place: number; state: string; coins: number; address: string; win: boolean }> = []
  for (let i = 0; i < ordered.length; i++) {
    const address = ordered[i]
    const member = run.members.find((m) => m.address.toLowerCase() === address.toLowerCase())
    const place = i + 1
    const finished = !!member?.finished
    const coins = paid && finished ? coinsForPlace(place) : 0
    const win = paid && finished && place === 1
    const name = nameOf(address)
    if (!isFakeAddress(address) && (coins > 0 || win)) {
      try {
        await grantMatchReward(address, name, coins, win)
      } catch (e) {
        console.log('[SERVER] reward failed', address, e)
      }
    }
    rows.push({
      name,
      place,
      state: finished ? 'finished' : 'out',
      coins,
      address,
      win
    })
  }
  let board: Array<{ address: string; name: string; coins: number; wins: number }> = []
  try {
    board = (await getLeaderboard()).map((r) => ({
      address: r.address,
      name: r.name,
      coins: r.coins,
      wins: r.wins
    }))
  } catch (e) {
    console.log('[SERVER] leaderboard read failed', e)
  }
  for (const row of rows) {
    if (isFakeAddress(row.address)) continue
    let youTotal = row.coins
    let youWins = row.win ? 1 : 0
    try {
      const stats = await getPlayerStats(row.address)
      youTotal = stats.coins
      youWins = stats.wins
    } catch {
      // preview storage may be empty
    }
    room.send(
      'matchResults',
      {
        laneId: lane,
        youPlace: row.place,
        youCoins: row.coins,
        youTotal,
        youWins,
        rows: rows.map((r) => ({ name: r.name, place: r.place, state: r.state, coins: r.coins }))
      },
      { to: [row.address] }
    )
    room.send('myStats', { coins: youTotal, wins: youWins }, { to: [row.address] })
  }
  room.send('leaderboard', { rows: board })
}

function racePays(run: RaceRun): boolean {
  let reals = 0
  for (const m of run.members) {
    if (!isFakeAddress(m.address)) reals++
  }
  return reals >= 2
}

function raceLog(text: string): void {
  const line = `[RACE] ${text}`
  console.log('[SERVER]', line)
  room.send('raceLog', { text: line })
}
