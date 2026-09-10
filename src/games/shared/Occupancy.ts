export type OccupiedGame = 'dodge' | 'loot' | 'cannon' | 'fish'

const seats = new Map<string, OccupiedGame>()

function key(address: string): string {
  return address.toLowerCase()
}

/** Claim a game. Same game is ok (re-entry). Another game fails. */
export function occupy(address: string, game: OccupiedGame): boolean {
  if (!address) return false
  const k = key(address)
  const cur = seats.get(k)
  if (cur && cur !== game) return false
  seats.set(k, game)
  return true
}

export function release(address: string, game?: OccupiedGame): void {
  if (!address) return
  const k = key(address)
  const cur = seats.get(k)
  if (!cur) return
  if (game && cur !== game) return
  seats.delete(k)
}

export function releaseAll(game?: OccupiedGame): void {
  if (!game) {
    seats.clear()
    return
  }
  for (const [k, g] of [...seats]) {
    if (g === game) seats.delete(k)
  }
}

export function isOccupied(address: string, except?: OccupiedGame): boolean {
  const cur = seats.get(key(address))
  if (!cur) return false
  if (except && cur === except) return false
  return true
}

export function occupiedGame(address: string): OccupiedGame | null {
  return seats.get(key(address)) ?? null
}
