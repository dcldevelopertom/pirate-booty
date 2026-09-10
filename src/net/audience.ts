const members: string[][] = [[], [], [], []]
const watchers: string[][] = [[], [], [], []]

export function isFakeAddress(address: string): boolean {
  return address.toLowerCase().startsWith('fake-')
}

export function setLaneMembers(lane: number, addresses: string[]): void {
  members[lane] = addresses.filter((a) => !isFakeAddress(a))
}

export function addLaneWatcher(lane: number, address: string): void {
  if (!address || isFakeAddress(address)) return
  const list = watchers[lane]
  const key = address.toLowerCase()
  if (list.some((a) => a.toLowerCase() === key)) return
  list.push(address)
}

export function removeLaneWatcher(lane: number, address: string): void {
  const key = address.toLowerCase()
  watchers[lane] = watchers[lane].filter((a) => a.toLowerCase() !== key)
}

export function laneTargets(lane: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const a of [...members[lane], ...watchers[lane]]) {
    const key = a.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(a)
  }
  return out
}

export function sendOpts(lane: number): { to: string[] } | null {
  const to = laneTargets(lane)
  if (to.length === 0) return null
  return { to }
}
