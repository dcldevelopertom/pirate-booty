import { engine } from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'
import { getPlayer } from '@dcl/sdk/players'
import { FISH, LANE } from '../../config'
import { isAdmin } from '../../net/admins'
import { room } from '../../net/messages'
import { getLeaderboard, grantMatchReward } from '../../net/storage'
import { occupy, release } from '../shared/Occupancy'
import { currentPath, makeSimFish, makeSimSchool, snapshotPaths, tickSim, type SimFish } from './FishSim'
import { dist3, fishHookWorld, fishStandPose, fishSwimWorld, fishTargetAlong } from './FishSpace'
import { FISH_KINDS, fishKindById } from './FishTypes'

const TOAST_SEC = 3.6
const FAKE_PIRATES = [
  'Salty Peg',
  'Red Bess',
  'Two-Tooth',
  'Mad Calico',
  'Nimble Finn',
  'Iron Knee',
  'Lucky Dreg',
  'Capn Moss',
  'Whelk',
  'Briney Mae'
]

let busy = false
let busyT = 0
type FishSeat = {
  address: string
  slot: number
  depth: number
  hooked: boolean
  kind: string
  along: number
  fishDepth: number
  out: number
  fishId: number
  tension: number
  fightLeft: number
  sweetOut: number
  hold: boolean
  missLock: number
  pubWait: number
}

const holes = new Map<string, FishSeat>()
const watchers = new Map<string, string>()
let school: SimFish[] = []

function ensureSchool(): void {
  if (school.length > 0) return
  school = makeSimSchool(FISH.fishCount)
}

export function initFishSession(): void {
  if (!isServer()) return
  room.onMessage('fishClaim', (data, context) => {
    if (!context?.from) return
    claimHole(context.from, data.slot)
  })
  room.onMessage('fishLeave', (_data, context) => {
    if (context?.from) leaveFishing(context.from)
  })
  room.onMessage('fishAskHoles', (_data, context) => {
    if (!context?.from) return
    if (!occupy(context.from, 'fish')) {
      room.send('joinDenied', { reason: 'already in a game', game: 'fish' }, { to: [context.from] })
      return
    }
    ensureSchool()
    watchFishing(context.from)
    publishHoles(context.from)
    sendSchool(context.from)
  })
  room.onMessage('fishHook', (_data, context) => {
    if (context?.from) tryHook(context.from)
  })
  room.onMessage('fishFight', (data, context) => {
    if (!context?.from) return
    const seat = holes.get(context.from.toLowerCase())
    if (!seat || !seat.hooked) return
    seat.hold = !!data.hold
  })
  room.onMessage('fishLine', (data, context) => {
    if (context?.from) updateLine(context.from, data.depth)
  })
  room.onMessage('gmFakeCatch', (_data, context) => {
    if (!context?.from || !isAdmin(context.from)) return
    const kind = FISH_KINDS[Math.floor(Math.random() * FISH_KINDS.length)]
    const name = FAKE_PIRATES[Math.floor(Math.random() * FAKE_PIRATES.length)]
    if (!kind || !name) return
    const sent = blastCatch(name, kind.name, kind.image, true)
    room.send(
      'gmStorageResult',
      { ok: sent, detail: sent ? `${name} landed a ${kind.name}` : 'catch toast already live' },
      { to: [context.from] }
    )
  })
  engine.addSystem((dt) => {
    dropGoneFishers()
    const step = Math.min(dt > 1 ? dt / 1000 : dt, 0.05)
    if (school.length > 0 && (watchers.size > 0 || holes.size > 0)) {
      const paths = tickSim(school, step)
      for (const path of paths) sendPath(path)
    }
    tickFights(step)
    if (!busy) return
    busyT -= step
    if (busyT <= 0) busy = false
  }, 4, 'fish-catch-queue')
}

function emptySeat(address: string, slot: number): FishSeat {
  return {
    address,
    slot,
    depth: 10,
    hooked: false,
    kind: '',
    along: 0,
    fishDepth: 0,
    out: 0,
    fishId: 0,
    tension: 0.5,
    fightLeft: 0,
    sweetOut: 0,
    hold: false,
    missLock: 0,
    pubWait: 0
  }
}

function claimHole(address: string, slot: number): void {
  const key = address.toLowerCase()
  if (slot < 0 || slot >= FISH.slots) {
    room.send('fishHoleDenied', { reason: 'bad hole' }, { to: [address] })
    return
  }
  if (!occupy(address, 'fish')) {
    room.send('joinDenied', { reason: 'already in a game', game: 'fish' }, { to: [address] })
    return
  }
  for (const [who, seat] of holes) {
    if (seat.slot === slot && who !== key) {
      room.send('fishHoleDenied', { reason: 'taken' }, { to: [address] })
      return
    }
  }
  ensureSchool()
  watchFishing(address)
  const prev = holes.get(key)
  if (prev?.hooked) snapSeat(prev, false)
  holes.set(key, emptySeat(address, slot))
  room.send('fishClaimed', { slot }, { to: [address] })
  publishHoles()
}

function updateLine(address: string, depth: number): void {
  const seat = holes.get(address.toLowerCase())
  if (!seat || seat.hooked) return
  const n = Number.isFinite(depth) ? depth : FISH.lineMin
  seat.depth = Math.max(FISH.lineMin, Math.min(FISH.lineMax, n))
  publishLine(seat)
}

function tryHook(address: string): void {
  const seat = holes.get(address.toLowerCase())
  if (!seat || seat.hooked) return
  if (seat.missLock > 0) {
    room.send('fishMiss', {}, { to: [address] })
    return
  }
  const hook = fishHookWorld(seat.slot, seat.depth)
  let best: SimFish | null = null
  let bestD = FISH.snagRange
  for (const f of school) {
    if (f.hooked || f.immune > 0) continue
    const d = dist3(hook, fishSwimWorld(f.along, f.depth, f.out))
    if (d >= bestD) continue
    bestD = d
    best = f
  }
  if (!best) {
    seat.missLock = FISH.snagLock
    room.send('fishMiss', {}, { to: [address] })
    return
  }
  best.hooked = true
  seat.hooked = true
  seat.kind = best.kind
  seat.fishId = best.id
  seat.along = best.along
  seat.fishDepth = best.depth
  seat.out = best.out
  seat.tension = 0.5
  seat.fightLeft = FISH.fightSeconds
  seat.sweetOut = 0
  seat.hold = false
  room.send('fishOn', { id: best.id, kind: best.kind }, { to: [address] })
  const others = watcherTos(address)
  if (others.length > 0) room.send('fishHooked', { id: best.id }, { to: others })
  publishLine(seat)
}

function tickFights(dt: number): void {
  for (const seat of holes.values()) {
    if (seat.missLock > 0) seat.missLock = Math.max(0, seat.missLock - dt)
    if (!seat.hooked) continue
    const fish = school.find((f) => f.id === seat.fishId)
    if (!fish) {
      snapSeat(seat, true)
      continue
    }
    seat.tension += (seat.hold ? 0.72 : -0.52) * dt
    seat.tension = Math.max(0, Math.min(1, seat.tension))
    const sweet = seat.tension >= 0.26 && seat.tension <= 0.7
    if (sweet) seat.sweetOut = 0
    else seat.sweetOut += dt
    const pull = sweet ? 0.72 : seat.tension < 0.26 ? -0.95 : -0.4
    reelFish(fish, seat, pull, dt)
    seat.fightLeft -= dt
    const snapped =
      seat.tension <= 0.08 || seat.tension >= 0.92 || seat.sweetOut > 0.7 || seat.fightLeft <= 0
    if (snapped) {
      snapSeat(seat, true)
      continue
    }
    if (fish.depth <= 0.72 && fish.out <= 0.8) {
      landSeat(seat, fish)
      continue
    }
    seat.pubWait -= dt
    if (seat.pubWait > 0) continue
    seat.pubWait = 0.1
    room.send(
      'fishFightState',
      {
        tension: seat.tension,
        fightLeft: seat.fightLeft,
        along: seat.along,
        fishDepth: seat.fishDepth,
        out: seat.out
      },
      { to: [seat.address] }
    )
    publishLine(seat)
  }
}

function reelFish(fish: SimFish, seat: FishSeat, pull: number, dt: number): void {
  fish.depth -= pull * 2.2 * dt
  fish.out -= pull * 1.6 * dt
  fish.depth = Math.max(0.55, Math.min(FISH.lineMax, fish.depth))
  fish.out = Math.max(0.12, Math.min(9, fish.out))
  const targetAlong = fishTargetAlong(seat.slot)
  fish.along += (targetAlong - fish.along) * (0.35 + Math.max(0, pull) * 1.4) * dt
  seat.along = fish.along
  seat.fishDepth = fish.depth
  seat.out = fish.out
  const pose = fishStandPose(seat.slot)
  const topY = FISH.y + LANE.rowHeight / 2
  const p = fishSwimWorld(fish.along, fish.depth, fish.out)
  const dx = p.x - pose.x
  const dy = p.y - topY
  const dz = p.z - pose.z
  seat.depth = Math.max(FISH.lineMin, Math.min(FISH.lineMax, Math.sqrt(dx * dx + dy * dy + dz * dz)))
}

function snapSeat(seat: FishSeat, tell: boolean): void {
  const id = seat.fishId
  resetHook(seat)
  respawnFish(id)
  seat.missLock = FISH.snagLock
  if (tell) room.send('fishSnap', {}, { to: [seat.address] })
  publishLine(seat)
  publishHoles()
}

function landSeat(seat: FishSeat, fish: SimFish): void {
  const kind = fishKindById(fish.kind) ?? FISH_KINDS[0]
  const id = fish.id
  const name = dclName(seat.address)
  resetHook(seat)
  respawnFish(id)
  room.send(
    'fishLanded',
    { fish: kind.name, image: kind.image, coins: kind.coins },
    { to: [seat.address] }
  )
  blastCatch(name, kind.name, kind.image, false)
  void bankFishCatch(seat.address, name, kind.coins)
  publishLine(seat)
  publishHoles()
}

function resetHook(seat: FishSeat): void {
  seat.hooked = false
  seat.kind = ''
  seat.fishId = 0
  seat.along = 0
  seat.fishDepth = 0
  seat.out = 0
  seat.hold = false
  seat.tension = 0.5
  seat.fightLeft = 0
  seat.sweetOut = 0
}

function respawnFish(id: number): void {
  const i = school.findIndex((f) => f.id === id)
  if (i < 0) return
  school[i] = makeSimFish(id)
  sendPath(currentPath(school[i]))
}

function publishLine(seat: FishSeat): void {
  const others = fisherTos(seat.address)
  if (others.length === 0) return
  room.send(
    'fishLineState',
    {
      slot: seat.slot,
      address: seat.address,
      depth: seat.depth,
      hooked: seat.hooked,
      kind: seat.kind,
      along: seat.along,
      fishDepth: seat.fishDepth,
      out: seat.out
    },
    { to: others }
  )
}

function leaveFishing(address: string): void {
  const key = address.toLowerCase()
  const seat = holes.get(key)
  if (seat?.hooked) snapSeat(seat, false)
  const hadHole = holes.delete(key)
  const hadWatch = watchers.delete(key)
  release(address, 'fish')
  if (hadHole || hadWatch) publishHoles()
}

function dropGoneFishers(): void {
  let changed = false
  for (const [key, seat] of [...holes]) {
    if (getPlayer({ userId: seat.address })) continue
    if (seat.hooked) snapSeat(seat, false)
    holes.delete(key)
    watchers.delete(key)
    release(seat.address, 'fish')
    changed = true
  }
  for (const [key, address] of [...watchers]) {
    if (getPlayer({ userId: address })) continue
    watchers.delete(key)
    release(address, 'fish')
    changed = true
  }
  if (changed) publishHoles()
}

function watchFishing(address: string): void {
  watchers.set(address.toLowerCase(), address)
}

function watcherTos(except?: string): string[] {
  const out: string[] = []
  const skip = except?.toLowerCase()
  for (const address of watchers.values()) {
    if (skip && address.toLowerCase() === skip) continue
    out.push(address)
  }
  return out
}

function fisherTos(except?: string): string[] {
  const out: string[] = []
  const skip = except?.toLowerCase()
  for (const s of holes.values()) {
    if (skip && s.address.toLowerCase() === skip) continue
    out.push(s.address)
  }
  return out
}

function sendSchool(to: string): void {
  room.send('fishSchool', { fish: snapshotPaths(school) }, { to: [to] })
}

function sendPath(path: ReturnType<typeof currentPath>): void {
  const to = watcherTos()
  if (to.length === 0) return
  room.send('fishPath', path, { to })
}

function publishHoles(to?: string): void {
  const rows: Array<{
    slot: number
    address: string
    depth: number
    hooked: boolean
    kind: string
    along: number
    fishDepth: number
    out: number
  }> = []
  for (const seat of holes.values()) {
    rows.push({
      slot: seat.slot,
      address: seat.address,
      depth: seat.depth,
      hooked: seat.hooked,
      kind: seat.kind,
      along: seat.along,
      fishDepth: seat.fishDepth,
      out: seat.out
    })
  }
  const dest = to ? [to] : watcherTos()
  if (dest.length === 0) return
  room.send('fishHoles', { rows }, { to: dest })
}

async function bankFishCatch(address: string, name: string, coins: number): Promise<void> {
  if (coins <= 0) return
  try {
    const stats = await grantMatchReward(address, name, coins, false)
    room.send('myStats', { coins: stats.coins, wins: stats.wins }, { to: [address] })
    const board = await getLeaderboard()
    room.send('leaderboard', {
      rows: board.map((r) => ({ address: r.address, name: r.name, coins: r.coins, wins: r.wins }))
    })
  } catch (e) {
    console.log('[SERVER] fish reward failed', address, e)
  }
}

function blastCatch(name: string, fish: string, image: string, force: boolean): boolean {
  if (busy && !force) return false
  busy = true
  busyT = TOAST_SEC
  room.send('fishCatchToast', { name, fish, image })
  return true
}

function dclName(address: string): string {
  const player = getPlayer({ userId: address })
  const name = player?.name?.trim()
  if (name) return name.slice(0, 20)
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
