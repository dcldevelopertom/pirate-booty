import { engine } from '@dcl/sdk/ecs'
import { isServer, syncEntity } from '@dcl/sdk/network'
import { AUTH_SERVER_PEER_ID } from '@dcl/sdk/network/message-bus-sync'
import { LANE, MATCH, SYNC_ID } from '../../config'
import { addLaneWatcher, isFakeAddress, laneTargets, removeLaneWatcher, setLaneMembers } from '../../net/audience'
import { room } from '../../net/messages'
import { GameBoard, GameInfo } from '../../net/schemas'
import { ensureSceneStorage } from '../../net/storage'
import { hubBotPose, laneSpawn } from '../../world/layout'
import { occupy, release, releaseAll } from './Occupancy'
import { allocate, free, getLanePack, isLaneAllocated, setPhase as setLanePhase } from '../barrel/LanePool'
import { ObstacleSpec } from '../barrel/Obstacles'

type SnapBits = {
  seed: number
  dropped: number
  sunk: number
  obstacles: ObstacleSpec[]
}

let readSnap: (lane: number) => SnapBits = () => ({ seed: 0, dropped: 0, sunk: 0, obstacles: [] })

export function setSnapshotReader(fn: (lane: number) => SnapBits): void {
  readSnap = fn
}

export type Seat = {
  address: string
  fake: boolean
  name: string
}

export type Game = {
  id: number
  lane: number
  phase: 'filling' | 'loading' | 'countdown' | 'racing' | 'ended'
  seats: Seat[]
  elapsed: number
  barrelX: number
  dropped: number
  result: string
  seatStates: Array<{ address: string; state: string }>
  lobbyRemain: number
}

type FakeBot = {
  id: string
  name: string
  address: string
  lane: number
  x: number
  y: number
  z: number
  slot: number
}

const games: Game[] = []
const fakes: FakeBot[] = []
let nextGameId = 1
let nextFakeId = 1
let needMoreThanOne = false
let boardEntity: ReturnType<typeof engine.addEntity>
let startPrep: (lane: number) => void = () => {}
let endEmpty: (lane: number) => void = () => {}
let dropRunMembers: (lane: number, addresses: string[]) => void = () => {}

export function setPrepHandler(fn: (lane: number) => void): void {
  startPrep = fn
}

export function setEndHandler(fn: (lane: number) => void): void {
  endEmpty = fn
}

export function setDropMembersHandler(fn: (lane: number, addresses: string[]) => void): void {
  dropRunMembers = fn
}

export function initMatchSession(): void {
  if (!isServer()) return
  boardEntity = engine.addEntity()
  GameBoard.create(boardEntity, { json: '[]', needMoreThanOne: false, hubBots: 0 })
  GameBoard.validateBeforeChange((value) => value.senderAddress === AUTH_SERVER_PEER_ID)
  syncEntity(boardEntity, [GameBoard.componentId], SYNC_ID.GAME_BOARD)
  publishBoard()
  void ensureSceneStorage()
}

export function getGames(): Game[] {
  return games
}

export function gameOnLane(lane: number): Game | undefined {
  return games.find((g) => g.lane === lane && g.phase !== 'ended')
}

export function getSeats(lane: number): Seat[] {
  return gameOnLane(lane)?.seats.slice() ?? []
}

export function getLiveMembers(lane: number): Array<{ address: string; alive: boolean; finished: boolean }> {
  return getSeats(lane)
    .filter((s) => !s.fake && !isFakeAddress(s.address))
    .map((s) => ({ address: s.address, alive: true, finished: false }))
}

export function joinPlayer(address: string, preferredLane?: number): Game | null {
  if (!address) return null
  const fake = isFakeAddress(address)
  const name = fake ? fakeName(address) : shortName(address)
  if (seatedLive(address)) return gameFor(address) ?? null
  if (!fake && !occupy(address, 'dodge')) return null

  let game = pickFilling(preferredLane)
  if (!game) {
    const lane = pickLane()
    if (lane < 0) {
      if (!fake) release(address, 'dodge')
      return null
    }
    game = createGame(lane)
  }
  sit(game, { address, fake, name })
  syncAudience(game)
  if (!getLanePack(game.lane)) allocate(game.lane)
  if (fake) placeFake(address, game)
  publishBoard()
  publishFakes()
  startLobbyIfReady(game)
  return game
}

export function spawnFakes(count: number, _startNow = false): number {
  const want = Math.max(0, Math.min(MATCH.maxPlayers, Math.floor(count)))
  let made = 0
  for (let i = 0; i < want; i++) {
    if (fakes.length >= 16) break
    const id = nextFakeId++
    const address = `fake-${id}`
    const bot: FakeBot = {
      id: address,
      name: `Bot ${id}`,
      address,
      lane: -1,
      x: 0,
      y: 0,
      z: 0,
      slot: 0
    }
    fakes.push(bot)
    placeHubFake(bot)
    made++
  }
  layoutHubBots()
  publishBoard()
  publishFakes()
  return made
}

export function assignFakesToGame(gameId: number, count: number): number {
  const game = games.find((g) => g.id === gameId)
  if (!game || game.phase === 'ended') return 0
  const want = Math.max(0, Math.min(MATCH.maxPlayers, Math.floor(count)))
  const roomLeft = Math.max(0, MATCH.maxPlayers - game.seats.length)
  const take = Math.min(want, roomLeft)
  let moved = 0
  for (const bot of hubBots()) {
    if (moved >= take) break
    sit(game, { address: bot.address, fake: true, name: bot.name })
    placeFake(bot.address, game)
    moved++
  }
  if (moved === 0) return 0
  syncAudience(game)
  if (!getLanePack(game.lane)) allocate(game.lane)
  layoutHubBots()
  publishBoard()
  publishFakes()
  startLobbyIfReady(game)
  return moved
}

export function createEmptyGame(): Game | null {
  const lane = pickLane()
  if (lane < 0) return null
  const game = createGame(lane)
  publishBoard()
  return game
}

/** Spawn hub bots if needed, open a dock, seat the host, drop bots in, start if the min is met. */
export function openGameWithBots(
  count: number,
  host?: string
): { game: Game | null; moved: number; started: boolean } {
  const game = createEmptyGame()
  if (!game) return { game: null, moved: 0, started: false }
  if (host) seatHost(game, host)
  const want = Math.max(0, Math.min(MATCH.maxPlayers, Math.floor(count)))
  const missing = want - hubBots().length
  if (missing > 0) spawnFakes(missing)
  const moved = want > 0 ? assignFakesToGame(game.id, want) : 0
  if (moved === 0) startLobbyIfReady(game)
  return { game, moved, started: game.phase !== 'filling' }
}

export function startLobbyIfReady(game: Game): void {
  if (game.phase !== 'filling') return
  const reals = game.seats.filter((s) => !s.fake)
  if (game.seats.length < minStartCount()) {
    game.lobbyRemain = 0
    publishLobby(game)
    publishBoard()
    return
  }
  if (reals.length === 0) {
    startPrep(game.lane)
    return
  }
  if (game.lobbyRemain <= 0) game.lobbyRemain = MATCH.lobbySeconds
  publishLobby(game)
  publishBoard()
}

export function tickLobbies(dt: number): void {
  for (const game of games) {
    if (game.phase !== 'filling' || game.lobbyRemain <= 0) continue
    const before = Math.ceil(game.lobbyRemain)
    game.lobbyRemain -= dt
    if (game.lobbyRemain < 0) game.lobbyRemain = 0
    const after = Math.ceil(game.lobbyRemain)
    if (after !== before) publishLobby(game)
    if (game.lobbyRemain > 0) continue
    game.lobbyRemain = 0
    startPrep(game.lane)
  }
}

export function leavePlayer(address: string): boolean {
  const game = gameFor(address)
  if (!game || game.phase !== 'filling') return false
  const key = address.toLowerCase()
  game.seats = game.seats.filter((s) => s.address.toLowerCase() !== key)
  release(address, 'dodge')
  syncAudience(game)
  room.send('lobbyLeft', {}, { to: [address] })
  if (game.seats.length === 0) {
    game.lobbyRemain = 0
    game.phase = 'ended'
    game.result = 'lobby empty'
    freeLaneIfIdle(game)
    publishBoard()
    return true
  }
  if (game.seats.length < minStartCount()) game.lobbyRemain = 0
  publishLobby(game)
  publishBoard()
  return true
}

export function publishLobby(game: Game): void {
  const count = game.seats.length
  const lobbyCount = game.lobbyRemain > 0 ? Math.ceil(game.lobbyRemain) : 0
  const phase = lobbyCount > 0 ? 'lobby' : 'filling'
  for (let i = 0; i < game.seats.length; i++) {
    const seat = game.seats[i]
    if (seat.fake) continue
    room.send(
      'lobbyUpdate',
      {
        gameId: game.id,
        laneId: game.lane,
        slot: i + 1,
        count,
        max: MATCH.maxPlayers,
        min: minStartCount(),
        lobbyCount,
        phase
      },
      { to: [seat.address] }
    )
  }
}

export function clearFakes(): void {
  const ids = fakes.map((f) => f.address.toLowerCase())
  fakes.length = 0
  const empty: Game[] = []
  for (const game of games) {
    game.seats = game.seats.filter((s) => !s.fake && !ids.includes(s.address.toLowerCase()))
    syncAudience(game)
    dropRunMembers(game.lane, ids)
    const reals = game.seats.filter((s) => !s.fake)
    if (reals.length === 0) empty.push(game)
  }
  for (const game of empty) {
    endEmpty(game.lane)
    game.phase = 'ended'
    if (!game.result) game.result = 'ended — no players left'
    freeLaneIfIdle(game)
  }
  publishBoard()
  publishFakes()
}

export function watchLane(address: string, lane: number): void {
  addLaneWatcher(lane, address)
  sendSnapshot(lane, [address])
  publishFakes()
}

export function unwatchAll(address: string): void {
  for (let i = 0; i < LANE.count; i++) removeLaneWatcher(i, address)
}

export function setGamePhase(lane: number, phase: Game['phase']): void {
  const game = games.find((g) => g.lane === lane)
  if (!game) return
  game.phase = phase
  setLanePhase(lane, phase === 'filling' ? 'idle' : phase)
  syncAudience(game)
  publishBoard()
}

export function markGameEnded(lane: number): void {
  const game = games.find((g) => g.lane === lane && g.phase !== 'ended')
  if (!game) return
  game.phase = 'ended'
  for (const seat of game.seats) {
    if (!seat.fake) release(seat.address, 'dodge')
  }
  publishBoard()
}

export function writeRaceStatus(
  lane: number,
  status: {
    elapsed: number
    barrelX: number
    dropped: number
    result?: string
    members: Array<{ address: string; alive: boolean; finished: boolean }>
  }
): void {
  const game = games.find((g) => g.lane === lane && g.phase !== 'ended') ?? games.find((g) => g.lane === lane)
  if (!game) return
  game.elapsed = status.elapsed
  game.barrelX = status.barrelX
  game.dropped = status.dropped
  if (status.result) game.result = status.result
  game.seatStates = status.members.map((m) => ({
    address: m.address,
    state: m.finished ? 'finished' : m.alive ? 'alive' : 'out'
  }))
  publishBoard()
}

export function resetSessions(): void {
  games.length = 0
  fakes.length = 0
  releaseAll('dodge')
  for (let i = 0; i < LANE.count; i++) setLaneMembers(i, [])
  publishBoard()
  publishFakes()
}

export function isSeatedInMatch(address: string): boolean {
  return seatedLive(address)
}

export function isNeedMoreThanOne(): boolean {
  return needMoreThanOne
}

export function minStartCount(): number {
  return needMoreThanOne ? 2 : 1
}

export function setNeedMoreThanOne(on: boolean): void {
  needMoreThanOne = on
  publishBoard()
  if (!on) startFilling()
}

/** Full lobby, or solo when >1 is off. */
export function canStart(game: Game): boolean {
  if (game.phase !== 'filling' || game.seats.length === 0) return false
  if (game.seats.length >= MATCH.maxPlayers) return true
  return !needMoreThanOne && game.seats.length >= minStartCount()
}

export function startFilling(): void {
  for (const game of games) startLobbyIfReady(game)
}

export function startFull(): void {
  for (const game of games) {
    if (game.phase === 'filling' && game.seats.length >= MATCH.maxPlayers) startLobbyIfReady(game)
  }
}

export function maybeStartFull(lane: number): void {
  const game = gameOnLane(lane)
  if (game) startLobbyIfReady(game)
}

export function sendSnapshot(lane: number, to?: string[]): void {
  const dest = to ?? laneTargets(lane)
  if (dest.length === 0) return
  const game = games.find((g) => g.lane === lane)
  const snap = readSnap(lane)
  room.send(
    'gameSnapshot',
    {
      gameId: game?.id ?? 0,
      laneId: lane,
      seed: snap.seed,
      phase: game?.phase ?? (isLaneAllocated(lane) ? 'idle' : 'empty'),
      dropped: snap.dropped,
      sunk: snap.sunk,
      obstacles: snap.obstacles
    },
    { to: dest }
  )
}

export function publishFakes(): void {
  room.send('fakeRoster', {
    fakes: fakes.map((f) => ({
      id: f.id,
      name: f.name,
      lane: f.lane,
      x: f.x,
      y: f.y,
      z: f.z,
      slot: f.slot
    }))
  })
}

function createGame(lane: number): Game {
  const game: Game = {
    id: nextGameId++,
    lane,
    phase: 'filling',
    seats: [],
    elapsed: 0,
    barrelX: 0,
    dropped: 0,
    result: '',
    seatStates: [],
    lobbyRemain: 0
  }
  games.push(game)
  if (!getLanePack(lane)) allocate(lane)
  setLanePhase(lane, 'idle')
  return game
}

function sit(game: Game, seat: Seat): void {
  if (!seat.fake) occupy(seat.address, 'dodge')
  game.seats.push(seat)
}

function seatHost(game: Game, host: string): void {
  if (!host || isFakeAddress(host)) return
  const prior = gameFor(host)
  if (prior && prior !== game && prior.phase === 'filling') leavePlayer(host)
  if (seatedLive(host)) return
  sit(game, { address: host, fake: false, name: shortName(host) })
  syncAudience(game)
}

function pickFilling(preferredLane?: number): Game | undefined {
  if (preferredLane !== undefined && preferredLane >= 0) {
    const prefer = games.find(
      (g) => g.lane === preferredLane && g.phase === 'filling' && g.seats.length < MATCH.maxPlayers
    )
    if (prefer) return prefer
  }
  return games.find((g) => g.phase === 'filling' && g.seats.length < MATCH.maxPlayers)
}

function pickLane(): number {
  for (let i = 0; i < LANE.count; i++) {
    if (!games.some((g) => g.lane === i && g.phase !== 'ended')) return i
  }
  for (let i = 0; i < LANE.count; i++) {
    const ended = games.find((g) => g.lane === i && g.phase === 'ended')
    if (!ended) continue
    recycle(ended)
    return i
  }
  return -1
}

function recycle(game: Game): void {
  const idx = games.indexOf(game)
  if (idx >= 0) games.splice(idx, 1)
  setLaneMembers(game.lane, [])
}

function freeLaneIfIdle(game: Game): void {
  setLaneMembers(game.lane, [])
  if (isLaneAllocated(game.lane) && game.phase !== 'racing' && game.phase !== 'loading' && game.phase !== 'countdown') {
    free(game.lane)
  }
}

function syncAudience(game: Game): void {
  setLaneMembers(
    game.lane,
    game.seats.map((s) => s.address)
  )
}

function seatedLive(address: string): boolean {
  const key = address.toLowerCase()
  return games.some((g) => g.phase !== 'ended' && g.seats.some((s) => s.address.toLowerCase() === key))
}

function gameFor(address: string): Game | undefined {
  const key = address.toLowerCase()
  return games.find((g) => g.seats.some((s) => s.address.toLowerCase() === key))
}

function hubBots(): FakeBot[] {
  return fakes.filter((f) => f.lane < 0)
}

function placeHubFake(bot: FakeBot): void {
  bot.lane = -1
  bot.slot = hubBots().length - 1
  const pose = hubBotPose(Math.max(0, bot.slot))
  bot.x = pose.x
  bot.y = pose.y
  bot.z = pose.z
}

function layoutHubBots(): void {
  const waiting = hubBots()
  for (let i = 0; i < waiting.length; i++) {
    waiting[i].slot = i
    const pose = hubBotPose(i)
    waiting[i].x = pose.x
    waiting[i].y = pose.y
    waiting[i].z = pose.z
  }
}

function placeFake(address: string, game: Game): void {
  const bot = fakes.find((f) => f.address.toLowerCase() === address.toLowerCase())
  if (!bot) return
  const slot = game.seats.findIndex((s) => s.address.toLowerCase() === address.toLowerCase())
  const spawn = laneSpawn(game.lane)
  const spread = (slot - (MATCH.maxPlayers - 1) / 2) * 1.4
  bot.lane = game.lane
  bot.slot = slot
  bot.x = spawn.x + (slot % 2) * 0.8
  bot.y = spawn.y
  bot.z = spawn.z + spread
}

function fakeName(address: string): string {
  const bot = fakes.find((f) => f.address.toLowerCase() === address.toLowerCase())
  return bot?.name ?? address
}

function shortName(address: string): string {
  if (address.length <= 15) return address
  return `${address.slice(0, 14)}…`
}

function publishBoard(): void {
  if (!boardEntity) return
  const list: GameInfo[] = games.map((g) => ({
    id: g.id,
    lane: g.lane,
    phase: g.phase,
    real: g.seats.filter((s) => !s.fake).length,
    fake: g.seats.filter((s) => s.fake).length,
    count: g.seats.length,
    max: MATCH.maxPlayers,
    label: `G${g.id}  dock ${g.lane + 1}  ${g.seats.length}/${MATCH.maxPlayers}  ${g.phase}`,
    elapsed: g.elapsed,
    barrelX: g.barrelX,
    dropped: g.dropped,
    result: g.result,
    seats: g.seats.map((s) => ({
      name: s.name,
      fake: s.fake,
      address: s.address,
      state: g.seatStates.find((st) => st.address.toLowerCase() === s.address.toLowerCase())?.state ?? 'waiting'
    }))
  }))
  const board = GameBoard.getMutable(boardEntity)
  board.json = JSON.stringify(list)
  board.needMoreThanOne = needMoreThanOne
  board.hubBots = hubBots().length
}
