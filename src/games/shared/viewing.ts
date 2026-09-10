let viewingLane: number | null = null
let playingLane: number | null = null

export function getViewingLane(): number | null {
  return viewingLane
}

export function getPlayingLane(): number | null {
  return playingLane
}

export function isBoundLane(lane: number): boolean {
  return viewingLane === lane || playingLane === lane
}

export function setViewingLane(lane: number | null): void {
  viewingLane = lane
}

export function setPlayingLane(lane: number | null): void {
  playingLane = lane
}
