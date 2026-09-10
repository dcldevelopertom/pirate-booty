import { Color4 } from '@dcl/sdk/math'

function hex(h: string, a = 1): Color4 {
  const n = parseInt(h.slice(1), 16)
  return Color4.create(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a)
}

export const PALETTE = {
  WOOD: hex('#8B5A2B'),
  WOOD_DARK: hex('#4A3018'),
  ROPE: hex('#C4A574'),
  WATER: hex('#3ECDE0'),
  FOAM: hex('#1A3A52'),
  SAND: hex('#C4A06A'),
  BARREL: hex('#6B3F1F'),
  SEAT: hex('#A67C52'),
  GOLD: hex('#D4A017'),
  SIGN: hex('#2C1810'),
  CREAM: hex('#F5E6C8'),
  KILL: hex('#C0392B', 0.18),
  FINISH: hex('#27AE60', 0.22),
  ROW_COLLIDER: hex('#E8B86D', 0.35),
  VOID: hex('#6B2B9A', 0.22)
}
