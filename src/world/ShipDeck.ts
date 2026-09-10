import { Vector3 } from '@dcl/sdk/math'
import { SHIP } from '../config'
import { PALETTE } from './palette'
import { shipCenter } from './layout'
import { box, cylinder, label } from './primitives'

export function buildShipDeck(): void {
  const c = shipCenter()
  box(undefined, Vector3.create(c.x, 2.4, c.z), Vector3.create(SHIP.sx, 4.4, SHIP.sz), PALETTE.WOOD_DARK)
  box(undefined, c, Vector3.create(SHIP.sx - 4, 0.35, SHIP.sz - 4), PALETTE.WOOD)

  box(
    undefined,
    Vector3.create(c.x - 18, SHIP.deckY + 1.6, c.z),
    Vector3.create(14, 3.2, 12),
    PALETTE.WOOD_DARK
  )

  cylinder(undefined, Vector3.create(c.x + 8, SHIP.deckY + 4, c.z), Vector3.create(0.35, 8, 0.35), PALETTE.ROPE)
  box(undefined, Vector3.create(c.x + 8, SHIP.deckY + 7.2, c.z), Vector3.create(10, 0.2, 0.25), PALETTE.ROPE, 'none')

  const coins = [
    Vector3.create(c.x + 4, SHIP.deckY + 0.12, c.z + 4),
    Vector3.create(c.x + 10, SHIP.deckY + 0.12, c.z - 3),
    Vector3.create(c.x + 16, SHIP.deckY + 0.12, c.z + 2),
    Vector3.create(c.x - 4, SHIP.deckY + 0.12, c.z - 6),
    Vector3.create(c.x + 2, SHIP.deckY + 0.12, c.z - 8),
    Vector3.create(c.x + 12, SHIP.deckY + 0.12, c.z + 8),
    Vector3.create(c.x - 8, SHIP.deckY + 0.12, c.z + 6),
    Vector3.create(c.x + 20, SHIP.deckY + 0.12, c.z)
  ]
  for (const p of coins) {
    cylinder(undefined, p, Vector3.create(0.35, 0.08, 0.35), PALETTE.GOLD, 'none')
  }

  label(undefined, Vector3.create(c.x, SHIP.deckY + 4.5, c.z + 10), 'SHIP DECK', 3, PALETTE.CREAM)
}
