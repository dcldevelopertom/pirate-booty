export type ClientGame = 'dodge' | 'loot' | 'cannon' | 'fish'

const busy = new Set<ClientGame>()

export function setClientBusy(game: ClientGame, on: boolean): void {
  if (on) busy.add(game)
  else busy.delete(game)
}

export function isClientBusy(except?: ClientGame): boolean {
  for (const g of busy) {
    if (g !== except) return true
  }
  return false
}
