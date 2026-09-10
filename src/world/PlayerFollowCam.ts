import { Transform, engine } from '@dcl/sdk/ecs'
import { Quaternion } from '@dcl/sdk/math'
import { DECK_Y, LANE, LANE_CAM, PLAYER_CAM, WATER_Y } from '../config'
import { RowMark } from '../net/schemas'
import { rowRestY } from '../games/barrel/Rows'
import { LaneState, getLanePhase } from '../net/schemas'
import { lockAllInputs } from '../ui/inputLocks'
import { detachPlayerCam, getCamFollow, getDockFollowLane, playerCamRoot } from './cameras'
import { laneZ } from './layout'

function startX(): number {
  return LANE.x0 + 0.5
}

const remembered = [startX(), startX(), startX(), startX()]
const lastPhase = ['', '', '', '']
let drowned = false
let ignoreWater = false

export function resetDockFollow(lane: number): void {
  if (lane < 0 || lane >= remembered.length) return
  remembered[lane] = startX()
}

export function resetDrownCam(): void {
  drowned = false
  ignoreWater = false
}

export function freezeDrownCam(): void {
  drowned = true
}

/** Keep the player-follow boom while we teleport a dead racer out of the water. */
export function ignoreDrownCam(on: boolean): void {
  drowned = false
  ignoreWater = on
}

export function registerPlayerFollowCam(): void {
  engine.addSystem(watchRaceStartForCam, -900, 'dock-cam-reset')
  engine.addSystem((dt) => {
    const mode = getCamFollow()
    if (
      mode === 'hub' ||
      mode === 'board' ||
      mode === 'loot' ||
      mode === 'cannon' ||
      mode === 'fish' ||
      mode === 'fishview' ||
      mode === 'fishcatch' ||
      mode === 'tutorial'
    )
      return

    const t = Transform.getMutable(playerCamRoot)
    t.rotation = Quaternion.Identity()

    const player = Transform.getOrNull(engine.PlayerEntity)
    if (ignoreWater) {
      drowned = false
    } else if (mode === 'player' && player && player.position.y <= WATER_Y - 1) {
      if (!drowned) {
        lockAllInputs()
        detachPlayerCam()
      }
      drowned = true
    }
    if (drowned) return

    if (mode === 'player') {
      if (!player) return
      const a = 1 - Math.exp(-PLAYER_CAM.follow * dt)
      t.position.x += (player.position.x - t.position.x) * a
      t.position.y += (player.position.y - t.position.y) * a
      t.position.z += (player.position.z - t.position.z) * a
      return
    }

    const dock = getDockFollowLane()
    if (dock === null) return

    const targetX = rowFollowX(dock)
    const a = 1 - Math.exp(-LANE_CAM.follow * dt)
    t.position.x += (targetX - t.position.x) * a
    t.position.y = DECK_Y
    t.position.z = laneZ(dock) + LANE.width / 2
  }, -1000, 'player-follow-cam')
}

function watchRaceStartForCam(): void {
  for (const [, state] of engine.getEntitiesWith(LaneState)) {
    for (let i = 0; i < LANE.count; i++) {
      const phase = getLanePhase(state, i)
      if (phase !== lastPhase[i]) {
        if (phase === 'racing' || phase === 'preview' || phase === 'loading' || phase === 'countdown') {
          resetDockFollow(i)
          resetDrownCam()
        }
        lastPhase[i] = phase
      }
    }
    return
  }
}

function rowFollowX(lane: number): number {
  const rest = rowRestY() - 0.2
  let hasZeroAtRest = false
  let minAlive = Number.POSITIVE_INFINITY
  let fallenFront = startX()
  let hasFallen = false

  for (const [entity, mark] of engine.getEntitiesWith(RowMark, Transform)) {
    if (mark.lane !== lane) continue
    const row = Transform.getOrNull(entity)
    if (!row) continue
    if (mark.index < minAlive) minAlive = mark.index
    const fallen = row.position.y < rest
    if (mark.index === 0 && !fallen) hasZeroAtRest = true
    if (fallen) {
      hasFallen = true
      const rowX = LANE.x0 + mark.index * LANE.rowDepth + LANE.rowDepth / 2
      if (rowX > fallenFront) fallenFront = rowX
    }
  }

  if (hasZeroAtRest) {
    remembered[lane] = startX()
    return remembered[lane]
  }

  if (hasFallen && fallenFront > remembered[lane]) {
    remembered[lane] = fallenFront
  }

  // Deleted rows never look "fallen" — follow the first sliver still on the dock.
  if (minAlive > 0 && minAlive !== Number.POSITIVE_INFINITY) {
    const deletedFront = LANE.x0 + (minAlive - 1) * LANE.rowDepth + LANE.rowDepth / 2
    if (deletedFront > remembered[lane]) remembered[lane] = deletedFront
  }

  return remembered[lane]
}
