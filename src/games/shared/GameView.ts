import { room } from '../../net/messages'
import { viewHub, viewLane } from '../../world/cameras'
import { registerDeckHideExcludes } from '../../world/DeckHide'
import { undressOtherBarrels } from '../barrel/Boulder'
import { applyLayout, clearLocal, spawnBoundObstacles } from '../barrel/LocalObstacles'
import { applyFallen, rebuildLocalLane, wipeAllLanes, wipeLane } from '../barrel/RowVisuals'
import { syncFakeVisuals } from './FakePlayers'
import { getPlayingLane, getViewingLane, setPlayingLane as writePlaying, setViewingLane } from './viewing'

export { getPlayingLane, getViewingLane, isBoundLane } from './viewing'

export function bindLane(lane: number): void {
  const prev = getViewingLane()
  if (prev === lane) {
    undressOtherBarrels(lane)
    syncFakeVisuals(lane)
    return
  }
  if (prev !== null) wipeLane(prev)
  setViewingLane(lane)
  rebuildLocalLane(lane, 0)
  spawnBoundObstacles(lane)
  undressOtherBarrels(lane)
  syncFakeVisuals(lane)
}

export function unbindLane(): void {
  setViewingLane(null)
  if (getPlayingLane() === null) {
    wipeAllLanes()
    clearLocal()
    undressOtherBarrels(-1)
    syncFakeVisuals(null)
  }
}

export function setPlayingLane(lane: number | null): void {
  writePlaying(lane)
  if (lane !== null) bindLane(lane)
}

export function applySnapshot(data: {
  laneId: number
  dropped: number
  sunk: number
  obstacles: Array<{ x: number; z: number; sx: number; sy: number; sz: number; skin: number }>
}): void {
  bindLane(data.laneId)
  applyLayout(data.laneId, data.obstacles)
  applyFallen(data.laneId, data.dropped, data.sunk)
}

/** Admin spectate: dock camera + that game's pieces. Avatar stays put. */
export function spectateLane(lane: number): void {
  bindLane(lane)
  viewLane(lane)
  room.send('gmWatchGame', { laneId: lane })
}

export async function jumpToLane(lane: number): Promise<void> {
  spectateLane(lane)
}

export function leaveGameView(): void {
  room.send('gmUnwatch', {})
  writePlaying(null)
  unbindLane()
  viewHub()
}

export function setupGameView(): void {
  registerDeckHideExcludes()
  room.onMessage('gameSnapshot', (data) => {
    applySnapshot(data)
  })
  room.onMessage('matchLayout', (data) => {
    applyLayout(data.laneId, data.obstacles)
    if (getViewingLane() === data.laneId || getPlayingLane() === data.laneId) return
    // real players bind from matchPrep; watchers already bound
  })
}
