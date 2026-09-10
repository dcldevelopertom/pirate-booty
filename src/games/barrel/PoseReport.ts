import { Transform, engine } from '@dcl/sdk/ecs'
import { room } from '../../net/messages'

let lane: number | null = null
let acc = 0

export function setPoseLane(id: number | null): void {
  lane = id
}

export function registerPoseReport(): void {
  engine.addSystem((dt) => {
    if (lane === null) return
    acc += dt
    if (acc < 0.15) return
    acc = 0
    const t = Transform.getOrNull(engine.PlayerEntity)
    if (!t) return
    room.send('playerPose', {
      laneId: lane,
      x: t.position.x,
      y: t.position.y,
      z: t.position.z
    })
  }, 5, 'pose-report')
}
