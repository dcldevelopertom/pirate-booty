import { InputAction, Transform, engine, inputSystem } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { FLYCAM } from '../config'
import { adminFlyCam, restoreFollowCam, viewAdminFlyCam } from '../world/cameras'
import { lockAllInputs, unlockToGameplay } from './inputLocks'

let enabled = false
let yaw = FLYCAM.start.yaw
let pitch = FLYCAM.start.pitch

export function isFlyCamOn(): boolean {
  return enabled
}

export type FlyCamPose = {
  x: number
  y: number
  z: number
  pitch: number
  yaw: number
}

export function getFlyCamPose(): FlyCamPose {
  const t = Transform.getOrNull(adminFlyCam)
  const p = t?.position
  return {
    x: p?.x ?? 0,
    y: p?.y ?? 0,
    z: p?.z ?? 0,
    pitch,
    yaw
  }
}

export function flyCamCopyText(): string {
  const p = getFlyCamPose()
  const n = (v: number) => (Math.round(v * 100) / 100).toFixed(2)
  return `FLYCAM x=${n(p.x)} y=${n(p.y)} z=${n(p.z)} pitch=${n(p.pitch)} yaw=${n(p.yaw)}`
}

export function setFlyCam(on: boolean): void {
  if (on === enabled) return
  enabled = on
  if (on) {
    const t = Transform.get(adminFlyCam)
    // Keep current pose if we already flew; otherwise use default.
    Transform.getMutable(adminFlyCam).position = Vector3.create(t.position.x, t.position.y, t.position.z)
    lockAllInputs()
    viewAdminFlyCam()
  } else {
    unlockToGameplay()
    restoreFollowCam()
  }
}

export function registerFlyCamSystem(): void {
  engine.addSystem((dt) => {
    if (!enabled) return

    let yawDelta = 0
    let pitchDelta = 0
    if (inputSystem.isPressed(InputAction.IA_ACTION_3)) yawDelta -= 1
    if (inputSystem.isPressed(InputAction.IA_ACTION_4)) yawDelta += 1
    if (inputSystem.isPressed(InputAction.IA_PRIMARY)) pitchDelta -= 1
    if (inputSystem.isPressed(InputAction.IA_SECONDARY)) pitchDelta += 1

    yaw += yawDelta * FLYCAM.yawDegPs * dt
    pitch += pitchDelta * FLYCAM.pitchDegPs * dt
    if (pitch < FLYCAM.pitchMin) pitch = FLYCAM.pitchMin
    if (pitch > FLYCAM.pitchMax) pitch = FLYCAM.pitchMax

    // Yaw 0 looks +Z (north). W follows look, so W=N, A=W, D=E.
    const yawQ = Quaternion.fromEulerDegrees(0, yaw, 0)
    const forward = Vector3.rotate(Vector3.create(0, 0, 1), yawQ)
    const right = Vector3.rotate(Vector3.create(1, 0, 0), yawQ)

    const move = Vector3.Zero()
    if (inputSystem.isPressed(InputAction.IA_FORWARD)) {
      move.x += forward.x
      move.z += forward.z
    }
    if (inputSystem.isPressed(InputAction.IA_BACKWARD)) {
      move.x -= forward.x
      move.z -= forward.z
    }
    if (inputSystem.isPressed(InputAction.IA_RIGHT)) {
      move.x += right.x
      move.z += right.z
    }
    if (inputSystem.isPressed(InputAction.IA_LEFT)) {
      move.x -= right.x
      move.z -= right.z
    }

    const t = Transform.getMutable(adminFlyCam)
    if (move.x !== 0 || move.z !== 0) {
      const len = Math.sqrt(move.x * move.x + move.z * move.z)
      t.position.x += (move.x / len) * FLYCAM.moveMps * dt
      t.position.z += (move.z / len) * FLYCAM.moveMps * dt
    }
    if (inputSystem.isPressed(InputAction.IA_JUMP)) t.position.y += FLYCAM.verticalMps * dt
    // Shift is IA_MODIFIER now; IA_WALK is C / the walk button.
    if (inputSystem.isPressed(InputAction.IA_MODIFIER) || inputSystem.isPressed(InputAction.IA_WALK)) {
      t.position.y -= FLYCAM.verticalMps * dt
    }

    t.rotation = Quaternion.fromEulerDegrees(pitch, yaw, 0)
  })
}
