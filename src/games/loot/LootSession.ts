import { engine } from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'
import { getPlayer } from '@dcl/sdk/players'
import { LOOT, MATCH, WATER_Y } from '../../config'
import { isFakeAddress } from '../../net/audience'
import { room } from '../../net/messages'
import { getLeaderboard, getPlayerStats, grantMatchReward } from '../../net/storage'
import { minStartCount } from '../shared/MatchSession'
import { isOccupied, occupy, release } from '../shared/Occupancy'
import { lootStart } from '../../world/LootArena'

type Seat = { address: string; name: string; slot: number; held: number; stashed: number }
type Coin = { id: number; x: number; z: number; taken: boolean; life: number }

type LiveShark = { id: number; remain: number; bit: boolean }

type LootGame = {
  id: number
  phase: 'filling' | 'loading' | 'countdown' | 'playing' | 'ended'
  seats: Seat[]
  coins: Coin[]
  lobbyRemain: number
  playRemain: number
  count: number
  sharkSpawnWait: number
  sharkId: number
  sharks: LiveShark[]
}

let game: LootGame | null = null
let nextId = 1
let nextCoinId = 1

export function initLootSession(): void {
  if (!isServer()) return
  room.onMessage('playerJoinLoot', (_data, context) => {
    const address = context?.from
    if (!address) return
    if (isOccupied(address, 'loot')) {
      room.send('joinDenied', { reason: 'already in a game', game: 'loot' }, { to: [address] })
      return
    }
    const joined = joinLoot(address)
    if (!joined) {
      room.send('joinDenied', { reason: 'booty loot full', game: 'loot' }, { to: [address] })
    }
  })
  room.onMessage('playerLeaveLoot', (_data, context) => {
    if (context?.from) leaveLoot(context.from)
  })
  room.onMessage('lootGrab', (data, context) => {
    if (context?.from) grabCoin(context.from, data.id)
  })
  room.onMessage('lootBank', (_data, context) => {
    if (context?.from) bankHeld(context.from)
  })
  room.onMessage('lootSharkBite', (data, context) => {
    if (context?.from) sharkBite(context.from, data)
  })
  engine.addSystem((dt) => {
    const step = Math.min(dt > 1 ? dt / 1000 : dt, 0.25)
    tickLoot(step)
  }, 2, 'loot-session')
}

export function isInLoot(address: string): boolean {
  return !!seatOf(address)
}

function joinLoot(address: string): boolean {
  if (isFakeAddress(address)) return false
  if (seatOf(address)) return true
  if (!occupy(address, 'loot')) return false
  if (!game || game.phase === 'ended') game = makeGame()
  if (game.phase !== 'filling' || game.seats.length >= MATCH.maxPlayers) {
    release(address, 'loot')
    return false
  }
  const slot = game.seats.length
  game.seats.push({ address, name: dclName(address), slot, held: 0, stashed: 0 })
  startLobbyIfReady()
  publishLobby()
  publishRoster()
  return true
}

function leaveLoot(address: string): void {
  if (!game || game.phase !== 'filling') return
  const key = address.toLowerCase()
  const before = game.seats.length
  game.seats = game.seats.filter((s) => s.address.toLowerCase() !== key)
  if (game.seats.length === before) return
  release(address, 'loot')
  room.send('lootLeft', {}, { to: [address] })
  if (game.seats.length === 0) {
    game.phase = 'ended'
    game = null
    room.send('lootRoster', { addresses: [] })
    return
  }
  for (let i = 0; i < game.seats.length; i++) game.seats[i].slot = i
  if (game.seats.length < minStartCount()) game.lobbyRemain = 0
  publishLobby()
  publishRoster()
}

function startLobbyIfReady(): void {
  if (!game || game.phase !== 'filling') return
  if (game.seats.length < minStartCount()) {
    game.lobbyRemain = 0
    return
  }
  if (game.lobbyRemain <= 0) game.lobbyRemain = MATCH.lobbySeconds
}

function tickLoot(dt: number): void {
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
    sendLoot('lootCountdown', { count: game.count })
    return
  }
  if (game.phase === 'countdown') {
    game.playRemain -= dt
    if (game.playRemain > 0) return
    game.count -= 1
    game.playRemain = 1
    sendLoot('lootCountdown', { count: game.count })
    if (game.count > 0) return
    beginPlay()
    return
  }
  if (game.phase !== 'playing') return
  tickShark(dt)
  tickCoinLives(dt)
  const before = Math.ceil(game.playRemain)
  game.playRemain -= dt
  if (game.playRemain < 0) game.playRemain = 0
  const after = Math.ceil(game.playRemain)
  if (after !== before) publishTick()
  if (game.playRemain > 0) return
  void endLoot()
}

function beginPrep(): void {
  if (!game) return
  game.phase = 'loading'
  game.playRemain = MATCH.loadSeconds
  for (const seat of game.seats) {
    const spawn = lootStart(seat.slot)
    room.send('lootPrep', { slot: seat.slot, ...spawn }, { to: [seat.address] })
  }
  publishRoster()
}

function beginPlay(): void {
  if (!game) return
  game.phase = 'playing'
  game.playRemain = LOOT.seconds
  game.coins = scatterCoins()
  game.sharkSpawnWait = 1.2
  game.sharkId = 0
  game.sharks = []
  sendLoot('lootGo', {
    remain: LOOT.seconds,
    coins: game.coins.map((c) => ({ id: c.id, x: c.x, z: c.z }))
  })
  publishTick()
}

function grabCoin(address: string, id: number): void {
  if (!game || game.phase !== 'playing') return
  const seat = seatOf(address)
  if (!seat) return
  const coin = game.coins.find((c) => c.id === id)
  if (!coin || coin.taken) return
  if (seat.held >= 1) return
  coin.taken = true
  seat.held = 1
  sendLoot('lootTaken', { id, address, held: seat.held })
  room.send('lootScore', { held: seat.held, stashed: seat.stashed, remain: Math.ceil(game.playRemain) }, { to: [address] })
  publishTick()
}

function bankHeld(address: string): void {
  if (!game || game.phase !== 'playing') return
  const seat = seatOf(address)
  if (!seat || seat.held <= 0) return
  const amount = seat.held
  seat.stashed += amount
  seat.held = 0
  room.send('lootScore', { held: seat.held, stashed: seat.stashed, remain: Math.ceil(game.playRemain) }, { to: [address] })
  sendLoot('lootCarry', { address, held: 0 })
  sendLoot('lootBanked', { address, slot: seat.slot, amount })
  publishTick()
}

async function endLoot(): Promise<void> {
  if (!game || game.phase === 'ended') return
  const done = game
  done.phase = 'ended'
  game = null
  for (const seat of done.seats) release(seat.address, 'loot')
  room.send('lootRoster', { addresses: [] })
  const paid = done.seats.filter((s) => !isFakeAddress(s.address)).length >= 2
  const ranked = done.seats.slice().sort((a, b) => b.stashed - a.stashed || b.held - a.held)
  const rows: Array<{ name: string; place: number; state: string; coins: number; address: string; win: boolean }> = []
  for (let i = 0; i < ranked.length; i++) {
    const seat = ranked[i]
    const place = i + 1
    const coins = paid ? seat.stashed : 0
    const win = paid && place === 1 && seat.stashed > 0
    if (coins > 0 || win) {
      try {
        await grantMatchReward(seat.address, seat.name, coins, win)
      } catch (e) {
        console.log('[SERVER] loot reward failed', seat.address, e)
      }
    }
    rows.push({
      name: seat.name,
      place,
      state: 'finished',
      coins,
      address: seat.address,
      win
    })
  }
  let board: Array<{ address: string; name: string; coins: number; wins: number }> = []
  try {
    board = (await getLeaderboard()).map((r) => ({ address: r.address, name: r.name, coins: r.coins, wins: r.wins }))
  } catch (e) {
    console.log('[SERVER] loot board failed', e)
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
        laneId: -1,
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

function tickCoinLives(dt: number): void {
  if (!game) return
  const expired: Coin[] = []
  for (const coin of game.coins) {
    if (coin.taken) continue
    coin.life -= dt
    if (coin.life > 0) continue
    coin.taken = true
    expired.push(coin)
  }
  for (const coin of expired) {
    sendLoot('lootGone', { id: coin.id })
    const next = placeCoin()
    if (!next) continue
    game.coins.push(next)
    sendLoot('lootSpawn', { id: next.id, x: next.x, z: next.z })
  }
}

function scatterCoins(): Coin[] {
  const coins: Coin[] = []
  let tries = 0
  while (coins.length < LOOT.coinCount && tries < 800) {
    tries++
    const next = placeCoin(coins)
    if (next) coins.push(next)
  }
  return coins
}

function placeCoin(existing?: Coin[]): Coin | null {
  const live = (existing ?? game?.coins ?? []).filter((c) => !c.taken)
  const pad = 3
  const west = LOOT.chestZ + 4
  const x0 = LOOT.x0 + west
  const x1 = LOOT.x0 + LOOT.size - pad
  const z0 = LOOT.z0 + pad
  const z1 = LOOT.z0 + LOOT.size - pad
  const minD2 = 2.6 * 2.6
  for (let n = 0; n < 40; n++) {
    const x = x0 + Math.random() * (x1 - x0)
    const z = z0 + Math.random() * (z1 - z0)
    if (live.some((c) => (c.x - x) * (c.x - x) + (c.z - z) * (c.z - z) < minD2)) continue
    return { id: nextCoinId++, x, z, taken: false, life: coinLife() }
  }
  return null
}

function coinLife(): number {
  return LOOT.coinLifeMin + Math.random() * (LOOT.coinLifeMax - LOOT.coinLifeMin)
}

function publishRoster(): void {
  const addresses = (game?.seats ?? []).map((s) => s.address)
  room.send('lootRoster', { addresses })
}

function publishLobby(): void {
  if (!game) return
  const lobbyCount = game.lobbyRemain > 0 ? Math.ceil(game.lobbyRemain) : 0
  for (const seat of game.seats) {
    room.send(
      'lootLobbyUpdate',
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
  sendLoot('lootTick', {
    remain: Math.ceil(game.playRemain),
    rows: game.seats.map((s) => ({ name: s.name, held: s.held, stashed: s.stashed }))
  })
}

function sendLoot(
  name:
    | 'lootCountdown'
    | 'lootGo'
    | 'lootTaken'
    | 'lootTick'
    | 'lootGone'
    | 'lootSpawn'
    | 'lootShark'
    | 'lootSharkHit'
    | 'lootCarry'
    | 'lootBanked',
  payload: object
): void {
  if (!game) return
  const to = game.seats.map((s) => s.address)
  if (to.length === 0) return
  if (name === 'lootCountdown') room.send('lootCountdown', payload as { count: number }, { to })
  else if (name === 'lootGo') {
    room.send(
      'lootGo',
      payload as { remain: number; coins: Array<{ id: number; x: number; z: number }> },
      { to }
    )
  } else if (name === 'lootTaken') {
    room.send('lootTaken', payload as { id: number; address: string; held: number }, { to })
  } else if (name === 'lootGone') {
    room.send('lootGone', payload as { id: number }, { to })
  } else if (name === 'lootSpawn') {
    room.send('lootSpawn', payload as { id: number; x: number; z: number }, { to })
  } else if (name === 'lootShark') {
    room.send(
      'lootShark',
      payload as { id: number; y: number; ms: number; points: Array<{ x: number; z: number }> },
      { to }
    )
  } else if (name === 'lootSharkHit') {
    room.send(
      'lootSharkHit',
      payload as { id: number; address: string; x: number; z: number; held: number },
      { to }
    )
  } else if (name === 'lootCarry') {
    room.send('lootCarry', payload as { address: string; held: number }, { to })
  } else if (name === 'lootBanked') {
    room.send('lootBanked', payload as { address: string; slot: number; amount: number }, { to })
  } else {
    room.send(
      'lootTick',
      payload as { remain: number; rows: Array<{ name: string; held: number; stashed: number }> },
      { to }
    )
  }
}

function seatOf(address: string): Seat | undefined {
  const key = address.toLowerCase()
  return game?.seats.find((s) => s.address.toLowerCase() === key)
}

function makeGame(): LootGame {
  return {
    id: nextId++,
    phase: 'filling',
    seats: [],
    coins: [],
    lobbyRemain: 0,
    playRemain: 0,
    count: MATCH.countdown,
    sharkSpawnWait: 8,
    sharkId: 0,
    sharks: []
  }
}

function tickShark(dt: number): void {
  if (!game) return
  for (const shark of game.sharks) shark.remain -= dt
  game.sharks = game.sharks.filter((s) => s.remain > 0)
  game.sharkSpawnWait -= dt
  if (game.sharks.length >= LOOT.sharkPack || game.sharkSpawnWait > 0) return
  spawnShark()
  game.sharkSpawnWait = game.sharks.length >= LOOT.sharkPack ? LOOT.sharkEvery : 2.2
}

function spawnShark(): void {
  if (!game) return
  game.sharkId += 1
  const points = buildSharkPath(game.sharkId)
  let len = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dz = points[i].z - points[i - 1].z
    len += Math.sqrt(dx * dx + dz * dz)
  }
  const ms = Math.max(4000, Math.floor((len / LOOT.sharkMps) * 1000))
  game.sharks.push({ id: game.sharkId, remain: (ms + 400) / 1000, bit: false })
  sendLoot('lootShark', { id: game.sharkId, y: WATER_Y, ms, points })
}

function buildSharkPath(id: number): Array<{ x: number; z: number }> {
  const west = LOOT.x0 + LOOT.sharkWest
  const east = LOOT.x0 + LOOT.size
  const south = LOOT.z0
  const north = LOOT.z0 + LOOT.size
  const out = 7
  const rx = () => west + 1.5 + Math.random() * Math.max(2, east - west - 3)
  const rz = () => south + 2 + Math.random() * Math.max(2, north - south - 4)
  const clampX = (x: number) => Math.min(east - 0.8, Math.max(west + 0.8, x))
  const clampZ = (z: number) => Math.min(north - 0.8, Math.max(south + 0.8, z))
  const start = (id + Math.floor(Math.random() * 2)) % 3
  if (start === 0) {
    const x = rx()
    return [
      { x, z: south - out },
      { x: clampX(x + (Math.random() - 0.5) * 6), z: clampZ(south + (north - south) * 0.35) },
      { x: clampX(rx()), z: clampZ(south + (north - south) * 0.7) },
      Math.random() < 0.45 ? { x: east + out, z: rz() } : { x: rx(), z: north + out }
    ]
  }
  if (start === 1) {
    const x = rx()
    return [
      { x, z: north + out },
      { x: clampX(x + (Math.random() - 0.5) * 6), z: clampZ(north - (north - south) * 0.35) },
      { x: clampX(rx()), z: clampZ(north - (north - south) * 0.7) },
      Math.random() < 0.45 ? { x: east + out, z: rz() } : { x: rx(), z: south - out }
    ]
  }
  const z = rz()
  return [
    { x: east + out, z },
    { x: clampX(west + 2 + Math.random() * 4), z: clampZ(z + (Math.random() - 0.5) * 8) },
    { x: clampX(rx()), z: clampZ(z + (Math.random() < 0.5 ? 7 : -7)) },
    { x: east + out, z: rz() }
  ]
}

function sharkBite(address: string, data: { id: number; x: number; z: number }): void {
  if (!game || game.phase !== 'playing') return
  const shark = game.sharks.find((s) => s.id === data.id)
  if (!shark || shark.bit) return
  const seat = seatOf(address)
  if (!seat) return
  shark.bit = true
  shark.remain = Math.min(shark.remain, 2)
  if (seat.held > 0) {
    seat.held = 0
    room.send(
      'lootScore',
      { held: 0, stashed: seat.stashed, remain: Math.ceil(game.playRemain) },
      { to: [address] }
    )
    sendLoot('lootCarry', { address, held: 0 })
    publishTick()
  }
  sendLoot('lootSharkHit', { id: data.id, address, x: data.x, z: data.z, held: seat.held })
}

function dclName(address: string): string {
  const player = getPlayer({ userId: address })
  const name = player?.name?.trim()
  if (name) return name
  if (address.length <= 15) return address
  return `${address.slice(0, 14)}…`
}
