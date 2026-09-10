import { engine } from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'
import { getPlayer } from '@dcl/sdk/players'
import { CANNON, MATCH, WATER_Y } from '../../config'
import { isFakeAddress } from '../../net/audience'
import { room } from '../../net/messages'
import { getLeaderboard, getPlayerStats, grantMatchReward } from '../../net/storage'
import { minStartCount } from '../shared/MatchSession'
import { isOccupied, occupy, release } from '../shared/Occupancy'
import { cannonMuzzle, cannonSlotPose, cannonStandPose } from './CannonArena'

type Seat = { address: string; name: string; slot: number; hits: number; cool: number }
type Ship = {
  id: number
  x: number
  y: number
  z: number
  dir: number
  speed: number
  scale: number
  coins: number
  live: boolean
}
type Ball = {
  id: number
  address: string
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
}

type CannonGame = {
  id: number
  phase: 'filling' | 'loading' | 'countdown' | 'playing' | 'ended'
  seats: Seat[]
  ships: Ship[]
  balls: Ball[]
  lobbyRemain: number
  playRemain: number
  count: number
  shipWait: number
  nextShip: number
  nextBall: number
}

let game: CannonGame | null = null
let nextId = 1

export function initCannonSession(): void {
  if (!isServer()) return
  room.onMessage('playerJoinCannon', (_data, context) => {
    const address = context?.from
    if (!address) return
    if (isOccupied(address, 'cannon')) {
      room.send('joinDenied', { reason: 'already in a game', game: 'cannon' }, { to: [address] })
      return
    }
    const joined = joinCannon(address)
    if (!joined) room.send('joinDenied', { reason: 'cannon fodder full', game: 'cannon' }, { to: [address] })
  })
  room.onMessage('playerLeaveCannon', (_data, context) => {
    if (context?.from) leaveCannon(context.from)
  })
  room.onMessage('cannonFire', (data, context) => {
    if (context?.from) fire(context.from, data)
  })
  engine.addSystem((dt) => {
    const step = Math.min(dt > 1 ? dt / 1000 : dt, 0.25)
    tickCannon(step)
  }, 2, 'cannon-session')
}

export function isInCannon(address: string): boolean {
  return !!seatOf(address)
}

function joinCannon(address: string): boolean {
  if (isFakeAddress(address)) return false
  if (seatOf(address)) return true
  if (!occupy(address, 'cannon')) return false
  if (!game || game.phase === 'ended') game = makeGame()
  if (game.phase !== 'filling' || game.seats.length >= MATCH.maxPlayers) {
    release(address, 'cannon')
    return false
  }
  const slot = game.seats.length
  game.seats.push({ address, name: dclName(address), slot, hits: 0, cool: 0 })
  startLobbyIfReady()
  publishLobby()
  return true
}

function leaveCannon(address: string): void {
  if (!game || game.phase !== 'filling') return
  const key = address.toLowerCase()
  const before = game.seats.length
  game.seats = game.seats.filter((s) => s.address.toLowerCase() !== key)
  if (game.seats.length === before) return
  release(address, 'cannon')
  room.send('cannonLeft', {}, { to: [address] })
  if (game.seats.length === 0) {
    game.phase = 'ended'
    game = null
    return
  }
  for (let i = 0; i < game.seats.length; i++) game.seats[i].slot = i
  if (game.seats.length < minStartCount()) game.lobbyRemain = 0
  publishLobby()
}

function startLobbyIfReady(): void {
  if (!game || game.phase !== 'filling') return
  if (game.seats.length < minStartCount()) {
    game.lobbyRemain = 0
    return
  }
  if (game.lobbyRemain <= 0) game.lobbyRemain = MATCH.lobbySeconds
}

function tickCannon(dt: number): void {
  if (!game || game.phase === 'ended') return
  if (game.phase === 'filling') {
    if (game.lobbyRemain <= 0) return
    const before = Math.ceil(game.lobbyRemain)
    game.lobbyRemain -= dt
    if (game.lobbyRemain < 0) game.lobbyRemain = 0
    const after = Math.ceil(game.lobbyRemain)
    if (after !== before) publishLobby()
    if (game.lobbyRemain > 0) return
    beginPrep()
    return
  }
  if (game.phase === 'loading') {
    game.playRemain -= dt
    if (game.playRemain > 0) return
    game.phase = 'countdown'
    game.count = MATCH.countdown
    game.playRemain = 1
    sendToSeats('cannonCountdown', { count: game.count })
    return
  }
  if (game.phase === 'countdown') {
    game.playRemain -= dt
    if (game.playRemain > 0) return
    game.count -= 1
    game.playRemain = 1
    sendToSeats('cannonCountdown', { count: game.count })
    if (game.count > 0) return
    beginPlay()
    return
  }
  if (game.phase !== 'playing') return
  for (const seat of game.seats) if (seat.cool > 0) seat.cool -= dt
  tickShips(dt)
  tickBalls(dt)
  const before = Math.ceil(game.playRemain)
  game.playRemain -= dt
  if (game.playRemain < 0) game.playRemain = 0
  const after = Math.ceil(game.playRemain)
  if (after !== before) publishTick()
  if (game.playRemain > 0) return
  void endCannon()
}

function beginPrep(): void {
  if (!game) return
  game.phase = 'loading'
  game.playRemain = MATCH.loadSeconds
  for (const seat of game.seats) {
    const spawn = cannonStandPose(seat.slot)
    room.send('cannonPrep', { slot: seat.slot, ...spawn }, { to: [seat.address] })
  }
}

function beginPlay(): void {
  if (!game) return
  game.phase = 'playing'
  game.playRemain = CANNON.seconds
  game.ships = []
  game.balls = []
  for (let i = 0; i < CANNON.shipOpen; i++) spawnShip(true)
  game.shipWait = CANNON.shipEvery + 0.6
  sendToSeats('cannonGo', { remain: CANNON.seconds })
  publishTick()
}

function fire(address: string, data: { pitch: number; yaw: number }): void {
  if (!game || game.phase !== 'playing') return
  const seat = seatOf(address)
  if (!seat || seat.cool > 0) return
  const pitch = clamp(data.pitch, CANNON.pitchMin, CANNON.pitchMax)
  const yaw = clamp(data.yaw, CANNON.yawMin, CANNON.yawMax)
  seat.cool = CANNON.cooldown
  const m = cannonMuzzle(seat.slot, pitch, yaw)
  game.nextBall += 1
  const ball: Ball = { id: game.nextBall, address, ...m }
  game.balls.push(ball)
  sendToSeats('cannonShot', ball)
}

function tickShips(dt: number): void {
  if (!game) return
  game.shipWait -= dt
  const live = game.ships.filter((s) => s.live).length
  if (game.shipWait <= 0 && live < CANNON.shipMax) {
    spawnShip()
    game.shipWait = CANNON.shipEvery + Math.random() * 0.4
  }
  const home = cannonSlotPose(1).x
  for (const ship of game.ships) {
    if (!ship.live) continue
    ship.x += ship.dir * ship.speed * dt
    if (Math.abs(ship.x - home) > 72) {
      ship.live = false
      sendToSeats('cannonGone', { id: ship.id })
    }
  }
}

function spawnShip(inView = false): void {
  if (!game) return
  const home = cannonSlotPose(1)
  const dir = Math.random() < 0.5 ? 1 : -1
  const roll = Math.random()
  const dist = roll < 0.7 ? 16 + Math.random() * 20 : 36 + Math.random() * 16
  const z = home.z + dist
  const scale = 3.6 + Math.random() * 4.4
  const y = WATER_Y + CANNON.hullBottom * scale - 0.7 + Math.random() * 0.5
  const speed = CANNON.shipSpeedMin + Math.random() * (CANNON.shipSpeedMax - CANNON.shipSpeedMin)
  const x = inView ? home.x + (Math.random() - 0.5) * 52 : home.x - dir * (22 + Math.random() * 10)
  const coins = shipCoins(z - home.z, speed)
  game.nextShip += 1
  const ship: Ship = { id: game.nextShip, x, y, z, dir, speed, scale, coins, live: true }
  game.ships.push(ship)
  sendToSeats('cannonShip', { id: ship.id, x, y, z, dir, speed, scale })
}

function shipCoins(dist: number, speed: number): number {
  const distPts = dist < 24 ? 1 : dist < 34 ? 2 : dist < 44 ? 3 : 4
  const spdPts = speed > 2.4 ? 1 : 0
  return distPts + spdPts
}

function tickBalls(dt: number): void {
  if (!game) return
  for (let i = game.balls.length - 1; i >= 0; i--) {
    const b = game.balls[i]
    b.vy -= CANNON.gravity * dt
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.z += b.vz * dt
    if (b.y <= WATER_Y) {
      sendToSeats('cannonSplash', { x: b.x, y: WATER_Y, z: b.z })
      game.balls.splice(i, 1)
      continue
    }
    const hit = game.ships.find((s) => s.live && hitsHull(b, s))
    if (!hit) continue
    hit.live = false
    const seat = seatOf(b.address)
    if (seat) seat.hits += hit.coins
    sendToSeats('cannonSunk', {
      id: hit.id,
      address: b.address,
      hits: seat?.hits ?? 0,
      coins: hit.coins,
      x: hit.x,
      y: hit.y,
      z: hit.z
    })
    game.balls.splice(i, 1)
    publishTick()
  }
}

function hitsHull(
  b: { x: number; y: number; z: number },
  s: { x: number; y: number; z: number; scale: number }
): boolean {
  const r = CANNON.ballRadius
  const hx = (CANNON.hitBox.x * s.scale) / 2 + r
  const hy = (CANNON.hitBox.y * s.scale) / 2 + r
  const hz = (CANNON.hitBox.z * s.scale) / 2 + r
  const cy = s.y + CANNON.hitBoxY * s.scale
  return Math.abs(b.x - s.x) <= hx && Math.abs(b.y - cy) <= hy && Math.abs(b.z - s.z) <= hz
}

async function endCannon(): Promise<void> {
  if (!game || game.phase === 'ended') return
  const done = game
  done.phase = 'ended'
  game = null
  for (const seat of done.seats) release(seat.address, 'cannon')
  const paid = done.seats.filter((s) => !isFakeAddress(s.address)).length >= 2
  const ranked = done.seats.slice().sort((a, b) => b.hits - a.hits)
  const rows: Array<{ name: string; place: number; state: string; coins: number; address: string; win: boolean }> = []
  for (let i = 0; i < ranked.length; i++) {
    const seat = ranked[i]
    const place = i + 1
    const coins = paid ? seat.hits : 0
    const win = paid && place === 1 && seat.hits > 0
    if (coins > 0 || win) {
      try {
        await grantMatchReward(seat.address, seat.name, coins, win)
      } catch (e) {
        console.log('[SERVER] cannon reward failed', seat.address, e)
      }
    }
    rows.push({ name: seat.name, place, state: 'finished', coins, address: seat.address, win })
  }
  let board: Array<{ address: string; name: string; coins: number; wins: number }> = []
  try {
    board = (await getLeaderboard()).map((r) => ({ address: r.address, name: r.name, coins: r.coins, wins: r.wins }))
  } catch (e) {
    console.log('[SERVER] cannon board failed', e)
  }
  for (const row of rows) {
    let youTotal = row.coins
    let youWins = row.win ? 1 : 0
    try {
      const stats = await getPlayerStats(row.address)
      youTotal = stats.coins
      youWins = stats.wins
    } catch {
      // preview
    }
    room.send(
      'matchResults',
      {
        laneId: -2,
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

function publishLobby(): void {
  if (!game) return
  const lobbyCount = game.lobbyRemain > 0 ? Math.ceil(game.lobbyRemain) : 0
  for (const seat of game.seats) {
    room.send(
      'cannonLobbyUpdate',
      {
        gameId: game.id,
        slot: seat.slot + 1,
        count: game.seats.length,
        max: MATCH.maxPlayers,
        min: minStartCount(),
        lobbyCount,
        phase: lobbyCount > 0 ? 'lobby' : 'filling'
      },
      { to: [seat.address] }
    )
  }
}

function publishTick(): void {
  if (!game) return
  for (const seat of game.seats) seat.name = dclName(seat.address)
  sendToSeats('cannonTick', {
    remain: Math.ceil(game.playRemain),
    rows: game.seats.map((s) => ({ name: s.name, hits: s.hits }))
  })
}

function sendToSeats(
  name:
    | 'cannonCountdown'
    | 'cannonGo'
    | 'cannonTick'
    | 'cannonShot'
    | 'cannonShip'
    | 'cannonSunk'
    | 'cannonGone'
    | 'cannonSplash',
  payload: object
): void {
  if (!game) return
  const to = game.seats.map((s) => s.address)
  if (to.length === 0) return
  if (name === 'cannonCountdown') room.send('cannonCountdown', payload as { count: number }, { to })
  else if (name === 'cannonGo') room.send('cannonGo', payload as { remain: number }, { to })
  else if (name === 'cannonTick') {
    room.send('cannonTick', payload as { remain: number; rows: Array<{ name: string; hits: number }> }, { to })
  } else if (name === 'cannonShot') {
    room.send(
      'cannonShot',
      payload as { id: number; address: string; x: number; y: number; z: number; vx: number; vy: number; vz: number },
      { to }
    )
  } else if (name === 'cannonShip') {
    room.send(
      'cannonShip',
      payload as { id: number; x: number; y: number; z: number; dir: number; speed: number; scale: number },
      { to }
    )
  } else if (name === 'cannonSunk') {
    room.send(
      'cannonSunk',
      payload as { id: number; address: string; hits: number; coins: number; x: number; y: number; z: number },
      { to }
    )
  } else if (name === 'cannonSplash') {
    room.send('cannonSplash', payload as { x: number; y: number; z: number }, { to })
  } else {
    room.send('cannonGone', payload as { id: number }, { to })
  }
}

function seatOf(address: string): Seat | undefined {
  const key = address.toLowerCase()
  return game?.seats.find((s) => s.address.toLowerCase() === key)
}

function makeGame(): CannonGame {
  return {
    id: nextId++,
    phase: 'filling',
    seats: [],
    ships: [],
    balls: [],
    lobbyRemain: 0,
    playRemain: 0,
    count: MATCH.countdown,
    shipWait: 0.4,
    nextShip: 0,
    nextBall: 0
  }
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n))
}

function dclName(address: string): string {
  const player = getPlayer({ userId: address })
  const name = player?.name?.trim()
  if (name) return name
  if (address.length <= 15) return address
  return `${address.slice(0, 14)}…`
}
