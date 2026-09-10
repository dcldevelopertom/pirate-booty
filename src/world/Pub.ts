import { Vector3 } from '@dcl/sdk/math'
import { DECK_Y, PUB } from '../config'
import { PALETTE } from './palette'
import { pubCenter } from './layout'
import { box, cylinder, label } from './primitives'

export function buildPub(): void {
  const c = pubCenter()
  box(undefined, c, Vector3.create(PUB.sx, 0.35, PUB.sz), PALETTE.WOOD)

  const wallY = DECK_Y + PUB.wallH / 2
  const t = 0.3
  box(undefined, Vector3.create(c.x, wallY, PUB.z0 + t / 2), Vector3.create(PUB.sx, PUB.wallH, t), PALETTE.WOOD_DARK)
  box(
    undefined,
    Vector3.create(c.x, wallY, PUB.z0 + PUB.sz - t / 2),
    Vector3.create(PUB.sx, PUB.wallH, t),
    PALETTE.WOOD_DARK
  )
  box(undefined, Vector3.create(PUB.x0 + t / 2, wallY, c.z), Vector3.create(t, PUB.wallH, PUB.sz), PALETTE.WOOD_DARK)
  // Open east-ish doorway: short wall on the north side of the east face only
  box(
    undefined,
    Vector3.create(PUB.x0 + PUB.sx - t / 2, wallY, c.z + 8),
    Vector3.create(t, PUB.wallH, 10),
    PALETTE.WOOD_DARK
  )

  box(undefined, Vector3.create(c.x, DECK_Y + PUB.wallH, c.z), Vector3.create(PUB.sx, 0.25, PUB.sz), PALETTE.WOOD_DARK)

  const stools = [
    Vector3.create(c.x - 4, DECK_Y + 0.28, c.z - 3),
    Vector3.create(c.x, DECK_Y + 0.28, c.z - 3),
    Vector3.create(c.x + 4, DECK_Y + 0.28, c.z - 3),
    Vector3.create(c.x - 4, DECK_Y + 0.28, c.z + 3),
    Vector3.create(c.x, DECK_Y + 0.28, c.z + 3),
    Vector3.create(c.x + 4, DECK_Y + 0.28, c.z + 3)
  ]
  for (const p of stools) {
    cylinder(undefined, p, Vector3.create(0.45, 0.55, 0.45), PALETTE.SEAT)
  }

  label(undefined, Vector3.create(c.x, DECK_Y + 3.2, c.z), 'THE PUB', 3, PALETTE.CREAM)
}
