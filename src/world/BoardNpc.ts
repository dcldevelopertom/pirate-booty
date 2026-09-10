import {
  AvatarShape,
  Entity,
  InputAction,
  InteractionType,
  PointerEventType,
  PointerEvents,
  Transform,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'
import { Color3, Quaternion, Vector3 } from '@dcl/sdk/math'
import { isServer } from '@dcl/sdk/network'
import { movePlayerTo, triggerEmote } from '~system/RestrictedActions'
import { CAPN, HUB } from '../config'
import { hubCenter } from './layout'
import { getSitSeats } from './Props'

const BOUNTY = 'urn:decentraland:matic:collections-v2:0x71d30bed480f85f7d96f07c8c59c0cc214fbcea7:0'
const VERTUAL = 'urn:decentraland:matic:collections-v2:0xca02ef4072a1699c33726c5ea60818372506912f:0'
const sitters: Entity[] = []

export function buildBoardNpc(): void {
  const c = hubCenter()
  spawnNpc('capn', "Cap'n", true, [BOUNTY], Vector3.create(c.x + CAPN.dx, HUB.y + CAPN.dy, c.z + CAPN.dz), CAPN.yaw)
  spawnNpc(
    'bosun',
    'Bosun',
    false,
    [BOUNTY],
    Vector3.create(HUB.x0 + 4.8, HUB.y + 0.5, HUB.z0 + 13.6),
    150
  )
}

export function buildCrateSitters(): void {
  const x0 = HUB.x0
  const z0 = HUB.z0
  const x1 = x0 + HUB.sx
  const z1 = z0 + HUB.sz
  spawnNpc('pip', 'Pip', true, [VERTUAL], Vector3.create(x0 + 6.7, HUB.y + 1.15, z0 + 2.55), 0, 'sittingChair1')
  spawnNpc('sal', 'Sailor', false, [VERTUAL], Vector3.create(x1 - 7.4, HUB.y + 0.75, z1 - 3.5), 180, 'sittingChair1')
  for (const seat of getSitSeats()) {
    hookPlayerSeat(seat.crate, seat.sitX, seat.sitY, seat.sitZ, seat.lookX, seat.lookZ)
  }
  if (!isServer()) {
    engine.addSystem(() => {
      for (const seat of playerSeats) {
        if (!inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN, seat.crate)) continue
        void sitPlayer(seat.sitX, seat.sitY, seat.sitZ, seat.lookX, seat.lookZ)
      }
    })
  }
  engine.addSystem((dt) => {
    sitPulse += dt
    if (sitPulse < 3) return
    sitPulse = 0
    for (const e of sitters) {
      if (!AvatarShape.has(e)) continue
      const shape = AvatarShape.getMutable(e)
      shape.expressionTriggerTimestamp = (shape.expressionTriggerTimestamp ?? 0) + 1
    }
  })
}

let sitPulse = 0

type SeatHook = {
  crate: Entity
  sitX: number
  sitY: number
  sitZ: number
  lookX: number
  lookZ: number
}

const playerSeats: SeatHook[] = []

function spawnNpc(
  id: string,
  name: string,
  male: boolean,
  extra: string[],
  position: Vector3,
  yaw: number,
  emote?: string
): void {
  const npc = engine.addEntity()
  Transform.create(npc, {
    position,
    rotation: Quaternion.fromEulerDegrees(0, yaw, 0)
  })
  AvatarShape.create(npc, {
    id,
    name,
    bodyShape: male
      ? 'urn:decentraland:off-chain:base-avatars:BaseMale'
      : 'urn:decentraland:off-chain:base-avatars:BaseFemale',
    wearables: [
      ...extra,
      male
        ? 'urn:decentraland:off-chain:base-avatars:eyes_00'
        : 'urn:decentraland:off-chain:base-avatars:f_eyes_00',
      male
        ? 'urn:decentraland:off-chain:base-avatars:eyebrows_00'
        : 'urn:decentraland:off-chain:base-avatars:f_eyebrows_00',
      male
        ? 'urn:decentraland:off-chain:base-avatars:mouth_00'
        : 'urn:decentraland:off-chain:base-avatars:f_mouth_00'
    ],
    emotes: emote ? [emote] : [],
    expressionTriggerId: emote ?? '',
    expressionTriggerTimestamp: emote ? 1 : 0,
    eyeColor: Color3.create(0.18, 0.42, 0.55),
    skinColor: Color3.create(0.72, 0.52, 0.38),
    hairColor: Color3.create(0.08, 0.06, 0.05)
  })
  if (emote) sitters.push(npc)
}

function hookPlayerSeat(
  crate: Entity,
  sitX: number,
  sitY: number,
  sitZ: number,
  lookX: number,
  lookZ: number
): void {
  if (isServer()) return
  const hover = {
    button: InputAction.IA_POINTER,
    hoverText: 'Sit',
    maxDistance: 5,
    maxPlayerDistance: 5,
    showFeedback: true,
    showHighlight: true
  }
  PointerEvents.create(crate, {
    pointerEvents: [
      {
        eventType: PointerEventType.PET_DOWN,
        eventInfo: { ...hover },
        interactionType: InteractionType.CURSOR
      },
      {
        eventType: PointerEventType.PET_DOWN,
        eventInfo: { ...hover },
        interactionType: InteractionType.PROXIMITY
      }
    ]
  })
  playerSeats.push({ crate, sitX, sitY, sitZ, lookX, lookZ })
}

async function sitPlayer(x: number, y: number, z: number, lookX: number, lookZ: number): Promise<void> {
  try {
    await movePlayerTo({
      newRelativePosition: { x, y, z },
      cameraTarget: { x: x + lookX, y: y + 1.4, z: z + lookZ },
      avatarTarget: { x: x + lookX, y, z: z + lookZ }
    })
    await triggerEmote({ predefinedEmote: 'sittingChair1' })
  } catch (e) {
    console.log('[SIT] failed', e)
  }
}
