import { Storage } from '@dcl/sdk/server'

Storage.configure({ skipIfUnchanged: true, cacheReads: true })

const COINS = 'coins'
const WINS = 'crowns'
const EPOCH = 'economyEpoch'
const BOARD = 'leaderboard'
const PLAYERS = 'players'
const PLAYER_SNAPS = 'playerSnaps'
const BOARD_SNAPS = 'boardSnaps'
const SNAP_KEEP = 20
const TUTORIAL = 'tutorialBooty'
const TUTORIAL_SEEN = 'tutorialSeen'
const TUTORIAL_FORCE = 'tutorialForce'
const MOBILE_ONLY = 'mobileOnly'

export type PlayerStats = { coins: number; wins: number }

export type BoardRow = {
  address: string
  name: string
  coins: number
  wins: number
}

export type SnapMeta = { at: number; count: number }

export type DataSnap = { at: number; rows: BoardRow[] }

export async function resetPlayerEconomy(address: string): Promise<boolean> {
  await snapshotPlayers()
  const a = await Storage.player.set(address, COINS, 0)
  const b = await Storage.player.set(address, WINS, 0)
  const players = await listPlayers()
  const row = players.find((p) => p.address.toLowerCase() === address.toLowerCase())
  if (row) {
    row.coins = 0
    row.wins = 0
    await sceneSet(PLAYERS, players)
  } else {
    await upsertPlayer(address, shortName(address), { coins: 0, wins: 0 })
  }
  await rewriteLeaderboardFromPlayers()
  return a && b
}

export async function resetAllEconomies(): Promise<number> {
  await snapshotPlayers()
  await snapshotBoard()
  const players = await listPlayers()
  for (const row of players) {
    row.coins = 0
    row.wins = 0
    try {
      await Storage.player.set(row.address, COINS, 0)
      await Storage.player.set(row.address, WINS, 0)
    } catch (e) {
      console.log('[SERVER] coin reset failed', row.address, e)
    }
  }
  await sceneSet(PLAYERS, players)
  await rewriteLeaderboardFromPlayers()
  return players.length
}

export async function bumpEconomyEpoch(): Promise<{ ok: boolean; epoch: number }> {
  const raw = await sceneGet<string>(EPOCH)
  const next = (raw ? parseInt(String(raw), 10) : 0) + 1
  const ok = await Storage.set(EPOCH, String(next))
  return { ok, epoch: next }
}

export async function getEconomyEpoch(): Promise<number> {
  const raw = await sceneGet<string>(EPOCH)
  return raw ? parseInt(String(raw), 10) : 0
}

export async function getPlayerStats(address: string): Promise<PlayerStats> {
  const row = (await listPlayers()).find((p) => p.address.toLowerCase() === address.toLowerCase())
  const stats = row ? { coins: toNum(row.coins), wins: toNum(row.wins) } : { coins: 0, wins: 0 }
  await Storage.player.set(address, COINS, stats.coins)
  await Storage.player.set(address, WINS, stats.wins)
  if (!row) await upsertPlayer(address, shortName(address), stats)
  return stats
}

export function coinsForPlace(place: number): number {
  if (place === 1) return 25
  if (place === 2) return 15
  if (place === 3) return 10
  return 5
}

export async function grantMatchReward(
  address: string,
  name: string,
  coins: number,
  win: boolean
): Promise<PlayerStats> {
  const stats = await getPlayerStats(address)
  stats.coins += coins
  if (win) stats.wins += 1
  await Storage.player.set(address, COINS, stats.coins)
  await Storage.player.set(address, WINS, stats.wins)
  await upsertPlayer(address, name, stats)
  return stats
}

export async function ensureSceneStorage(): Promise<void> {
  const map = await sceneMap()
  if (!Array.isArray(map.get(PLAYERS))) await sceneSet(PLAYERS, [])
  if (!Array.isArray(map.get(BOARD))) await sceneSet(BOARD, [])
  if (!Array.isArray(map.get(TUTORIAL_SEEN))) await sceneSet(TUTORIAL_SEEN, [])
  if (map.get(TUTORIAL_FORCE) !== true && map.get(TUTORIAL_FORCE) !== false) await sceneSet(TUTORIAL_FORCE, false)
  if (map.get(MOBILE_ONLY) !== true && map.get(MOBILE_ONLY) !== false) await sceneSet(MOBILE_ONLY, false)
  console.log('[SERVER] storage ready')
}

export async function shouldOfferTutorial(address: string): Promise<{ show: boolean; force: boolean }> {
  const force = (await sceneGet<boolean>(TUTORIAL_FORCE)) === true
  if (force) return { show: true, force: true }
  const seen = await listTutorialSeen()
  return { show: !seen.includes(address.toLowerCase()), force: false }
}

export async function markTutorialSeen(address: string): Promise<void> {
  const key = address.toLowerCase()
  const seen = await listTutorialSeen()
  if (!seen.includes(key)) {
    seen.push(key)
    await sceneSet(TUTORIAL_SEEN, seen)
  }
  await Storage.player.set(address, TUTORIAL, 1)
}

export async function clearTutorialSeen(address?: string): Promise<number> {
  const seen = await listTutorialSeen()
  if (address) {
    const key = address.toLowerCase()
    const next = seen.filter((a) => a !== key)
    await sceneSet(TUTORIAL_SEEN, next)
    try {
      await Storage.player.delete(address, TUTORIAL)
    } catch {
      // player key may not exist
    }
    return seen.length - next.length
  }
  await sceneSet(TUTORIAL_SEEN, [])
  for (const a of seen) {
    try {
      await Storage.player.delete(a, TUTORIAL)
    } catch {
      // player key may not exist
    }
  }
  return seen.length
}

export async function setTutorialForce(on: boolean): Promise<boolean> {
  return sceneSet(TUTORIAL_FORCE, on)
}

export async function getTutorialForce(): Promise<boolean> {
  return (await sceneGet<boolean>(TUTORIAL_FORCE)) === true
}

export async function setMobileOnly(on: boolean): Promise<boolean> {
  return sceneSet(MOBILE_ONLY, on)
}

export async function getMobileOnly(): Promise<boolean> {
  return (await sceneGet<boolean>(MOBILE_ONLY)) === true
}

async function listTutorialSeen(): Promise<string[]> {
  const rows = await sceneGet<string[]>(TUTORIAL_SEEN)
  return Array.isArray(rows) ? rows.map((a) => a.toLowerCase()) : []
}

export async function listPlayers(): Promise<BoardRow[]> {
  const rows = await sceneGet<BoardRow[]>(PLAYERS)
  return Array.isArray(rows) ? rows : []
}

export async function getLeaderboard(): Promise<BoardRow[]> {
  const rows = await sceneGet<BoardRow[]>(BOARD)
  const list = Array.isArray(rows) ? rows.slice() : []
  list.sort((a, b) => b.coins - a.coins || b.wins - a.wins)
  return list.filter((r) => toNum(r.coins) >= 1).slice(0, 10)
}

export async function deletePlayer(address: string): Promise<boolean> {
  await snapshotPlayers()
  await snapshotBoard()
  const key = address.toLowerCase()
  await Storage.player.delete(address, COINS)
  await Storage.player.delete(address, WINS)
  const players = (await listPlayers()).filter((p) => p.address.toLowerCase() !== key)
  await sceneSet(PLAYERS, players)
  await rewriteLeaderboardFromPlayers()
  return true
}

export async function resetLeaderboard(): Promise<boolean> {
  await snapshotBoard()
  return sceneSet(BOARD, [])
}

export async function snapshotPlayers(): Promise<number> {
  const rows = await listPlayers()
  return pushSnap(PLAYER_SNAPS, rows)
}

export async function snapshotBoard(): Promise<number> {
  const rows = await getLeaderboard()
  return pushSnap(BOARD_SNAPS, rows)
}

export async function listPlayerSnaps(): Promise<SnapMeta[]> {
  return (await loadSnaps(PLAYER_SNAPS)).map((s) => ({ at: s.at, count: s.rows.length }))
}

export async function listBoardSnaps(): Promise<SnapMeta[]> {
  return (await loadSnaps(BOARD_SNAPS)).map((s) => ({ at: s.at, count: s.rows.length }))
}

export async function getPlayerSnap(at: number): Promise<BoardRow[]> {
  return (await loadSnaps(PLAYER_SNAPS)).find((s) => s.at === at)?.rows ?? []
}

export async function getBoardSnap(at: number): Promise<BoardRow[]> {
  return (await loadSnaps(BOARD_SNAPS)).find((s) => s.at === at)?.rows ?? []
}

async function upsertPlayer(address: string, name: string, stats: PlayerStats): Promise<void> {
  const key = address.toLowerCase()
  const players = await listPlayers()
  const next = players.filter((p) => p.address.toLowerCase() !== key)
  next.push({ address, name, coins: stats.coins, wins: stats.wins })
  next.sort((a, b) => b.coins - a.coins || b.wins - a.wins)
  await sceneSet(PLAYERS, next)
  await sceneSet(BOARD, next.filter((p) => toNum(p.coins) >= 1).slice(0, 10))
}

async function rewriteLeaderboardFromPlayers(): Promise<void> {
  const players = await listPlayers()
  players.sort((a, b) => b.coins - a.coins || b.wins - a.wins)
  await sceneSet(BOARD, players.filter((p) => toNum(p.coins) >= 1).slice(0, 10))
}

async function loadSnaps(key: string): Promise<DataSnap[]> {
  const snaps = await sceneGet<DataSnap[]>(key)
  return Array.isArray(snaps) ? snaps : []
}

let sceneCache: Map<string, unknown> | null = null

async function sceneMap(): Promise<Map<string, unknown>> {
  if (sceneCache) return sceneCache
  const map = new Map<string, unknown>()
  try {
    const listed = await Storage.getValues({ limit: 200 })
    for (const entry of listed.data ?? []) map.set(entry.key, entry.value)
  } catch {
    // empty scene
  }
  sceneCache = map
  return map
}

async function sceneGet<T>(key: string): Promise<T | null> {
  const map = await sceneMap()
  if (map.has(key)) return map.get(key) as T
  return null
}

async function sceneSet<T>(key: string, value: T): Promise<boolean> {
  const ok = await Storage.set(key, value)
  const map = sceneCache ?? new Map<string, unknown>()
  map.set(key, value)
  sceneCache = map
  return ok
}

function shortName(address: string): string {
  if (address.length <= 15) return address
  return `${address.slice(0, 14)}…`
}

async function pushSnap(key: string, rows: BoardRow[]): Promise<number> {
  const snaps = await loadSnaps(key)
  const at = Math.floor(Date.now() / 1000)
  snaps.unshift({ at, rows: rows.slice() })
  await sceneSet(key, snaps.slice(0, SNAP_KEEP))
  return at
}

function toNum(v: number | string | null | undefined): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') return parseInt(v, 10) || 0
  return 0
}
