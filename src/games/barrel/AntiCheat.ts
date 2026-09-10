import { isServer } from '@dcl/sdk/network'
import { ANTI, BARREL, DECK_Y, LANE, RACE, WATER_Y } from '../../config'
import { room } from '../../net/messages'
import { laneZ } from '../../world/layout'
import { getRaceRun, markMemberFinish, markMemberOut } from './Race'

type Sample = { t: number; x: number; y: number; z: number; strikes: number }

const last = new Map<string, Sample>()

export function initAntiCheat(): void {
  if (!isServer()) return
  room.onMessage('playerPose', (data, context) => {
    if (!context) return
    inspectPose(data.laneId, context.from, data.x, data.y, data.z)
  })
}

export function forgetPoses(): void {
  last.clear()
}

export function inspectPose(lane: number, address: string, x: number, y: number, z: number): void {
  const run = getRaceRun(lane)
  if (!run || run.preview) return
  const key = address.toLowerCase()
  const member = run.members.find((m) => m.address.toLowerCase() === key)
  if (!member || !member.alive || member.finished) return

  const now = run.elapsed
  const prev = last.get(key)
  if (prev && now - prev.t < ANTI.poseMinDt) return

  const localX = x - LANE.x0
  const localZ = z - laneZ(lane)
  const onLane =
    localX >= -ANTI.laneSlack &&
    localX <= LANE.length + LANE.finishPad + ANTI.laneSlack &&
    localZ >= -ANTI.laneSlack &&
    localZ <= LANE.width + ANTI.laneSlack

  if (!onLane) {
    last.set(key, { t: now, x, y, z, strikes: prev?.strikes ?? 0 })
    return
  }

  if (prev && now > 2) {
    const dt = Math.max(now - prev.t, ANTI.poseMinDt)
    const dx = x - prev.x
    const dz = z - prev.z
    const speed = Math.sqrt(dx * dx + dz * dz) / dt
    if (speed > ANTI.maxMps * 1.35) {
      strike(lane, key, member, prev, now, x, y, z, `speed ${speed.toFixed(1)}`)
      return
    }
  }

  if (y < WATER_Y - 1) {
    markMemberOut(lane, address, 'below deck')
    last.set(key, { t: now, x, y, z, strikes: 0 })
    return
  }

  const minFinish = ((RACE.finishLocalX - BARREL.startX) / ANTI.maxMps) * ANTI.finishSlack
  if (localX >= RACE.finishLocalX && y > DECK_Y - 0.5) {
    if (run.elapsed < minFinish) {
      strike(lane, key, member, prev, now, x, y, z, `early finish t=${run.elapsed.toFixed(2)}`)
      return
    }
    markMemberFinish(lane, address, 'pose')
  }

  last.set(key, { t: now, x, y, z, strikes: prev?.strikes ?? 0 })
}

function strike(
  lane: number,
  key: string,
  member: { address: string; alive: boolean; finished: boolean },
  prev: Sample | undefined,
  now: number,
  x: number,
  y: number,
  z: number,
  why: string
): void {
  const n = (prev?.strikes ?? 0) + 1
  last.set(key, { t: now, x, y, z, strikes: n })
  console.log('[SERVER][ANTI]', member.address.slice(0, 8), why, `strike ${n}/${ANTI.maxStrikes}`)
  if (n >= ANTI.maxStrikes) markMemberOut(lane, member.address, `anti ${why}`)
}
