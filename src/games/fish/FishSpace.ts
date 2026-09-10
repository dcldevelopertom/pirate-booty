import { FISH, LANE, WATER_Y } from '../../config'

export function fishYawRad(): number {
  return (FISH.yaw * Math.PI) / 180
}

/** Local +X of a yawed sliver — along the row of holes. */
export function fishRowAxis(): { x: number; z: number } {
  const yaw = fishYawRad()
  return { x: Math.cos(yaw), z: -Math.sin(yaw) }
}

/** Local +Z of a yawed sliver — toward the hub, away from the fishing cam. */
export function fishLookAxis(): { x: number; z: number } {
  const yaw = fishYawRad()
  return { x: Math.sin(yaw), z: Math.cos(yaw) }
}

export function fishSlotPos(slot: number): { x: number; z: number } {
  const i = Math.max(0, Math.min(FISH.slots - 1, slot))
  const row = fishRowAxis()
  const t = (i - (FISH.slots - 1) / 2) * FISH.slotGap
  return { x: FISH.x0 + row.x * t, z: FISH.z0 + row.z * t }
}

/** Camera-facing lip of the dock. */
export function fishNearOffset(): { x: number; z: number } {
  const look = fishLookAxis()
  const d = LANE.width / 2 - 0.85
  return { x: -look.x * d, z: -look.z * d }
}

export function fishStandPose(slot: number): {
  x: number
  y: number
  z: number
  lookX: number
  lookY: number
  lookZ: number
} {
  const p = fishSlotPos(slot)
  const near = fishNearOffset()
  const look = fishLookAxis()
  const x = p.x + near.x
  const y = FISH.y + LANE.rowHeight / 2 + 0.6
  const z = p.z + near.z
  return { x, y, z, lookX: x - look.x * 12, lookY: y, lookZ: z - look.z * 12 }
}

export function fishHookWorld(slot: number, depth: number): { x: number; y: number; z: number } {
  const pose = fishStandPose(slot)
  const topY = FISH.y + LANE.rowHeight / 2
  return { x: pose.x, y: topY - depth, z: pose.z }
}

export function fishSwimWorld(along: number, depth: number, out: number): { x: number; y: number; z: number } {
  const row = fishRowAxis()
  const look = fishLookAxis()
  return {
    x: FISH.x0 + row.x * along - look.x * out,
    y: WATER_Y - depth,
    z: FISH.z0 + row.z * along - look.z * out
  }
}

export function fishTargetAlong(slot: number): number {
  return (slot - (FISH.slots - 1) / 2) * FISH.slotGap
}

export function dist3(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}
