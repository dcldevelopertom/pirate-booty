import { Transform, TriggerArea, engine, triggerAreaEventsSystem } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { HUB } from '../config'
import { hidePlayPrompt, showPlayPrompt, type PlayGame } from '../ui/PlayPrompt'

export function setupPlayKiosks(): void {
  hookZone(HUB.x0 + 3.5, HUB.z0 + 15, 'loot')
  hookZone(HUB.x0 + 15.5, HUB.z0 + 14, 'cannon')
  hookZone(HUB.x0 + 15.8, HUB.z0 + 5.4, 'dodge')
  hookZone(HUB.x0 + 3.7, HUB.z0 + 3.7, 'fish')
}

function hookZone(x: number, z: number, game: PlayGame): void {
  const e = engine.addEntity()
  Transform.create(e, {
    position: Vector3.create(x, HUB.y + 2.5, z),
    scale: Vector3.create(5, 5, 5)
  })
  TriggerArea.setBox(e)
  triggerAreaEventsSystem.onTriggerEnter(e, () => showPlayPrompt(game))
  triggerAreaEventsSystem.onTriggerExit(e, () => hidePlayPrompt(game))
}
