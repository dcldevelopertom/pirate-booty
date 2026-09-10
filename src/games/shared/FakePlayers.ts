import { AvatarShape, Entity, Transform, engine } from '@dcl/sdk/ecs'
import { Color3, Quaternion, Vector3 } from '@dcl/sdk/math'
import { room } from '../../net/messages'
import { getViewingLane } from './viewing'

export type FakeSpec = {
  id: string
  name: string
  lane: number
  x: number
  y: number
  z: number
  slot: number
}

const roster: FakeSpec[] = []
const entities = new Map<string, Entity>()

const SHIRTS = [
  'urn:decentraland:off-chain:base-avatars:green_tshirt',
  'urn:decentraland:off-chain:base-avatars:red_tshirt',
  'urn:decentraland:off-chain:base-avatars:blue_tshirt',
  'urn:decentraland:off-chain:base-avatars:m_sweater'
]

export function setupFakePlayers(): void {
  room.onMessage('fakeRoster', (data) => {
    roster.length = 0
    for (const f of data.fakes) roster.push(f)
    syncFakeVisuals(getViewingLane())
  })
}

export function getFakeRoster(): FakeSpec[] {
  return roster
}

export function syncFakeVisuals(viewingLane: number | null): void {
  const keep = new Set<string>()
  for (const spec of roster) {
    const onHub = spec.lane < 0
    const onView = viewingLane !== null && spec.lane === viewingLane
    if (!onHub && !onView) continue
    keep.add(spec.id)
    let e = entities.get(spec.id)
    if (!e || !Transform.has(e)) {
      e = spawnShape(spec)
      entities.set(spec.id, e)
    }
    const t = Transform.getMutable(e)
    t.position = Vector3.create(spec.x, spec.y, spec.z)
    t.rotation = Quaternion.fromEulerDegrees(0, 90, 0)
    if (AvatarShape.has(e)) AvatarShape.getMutable(e).name = spec.name
  }
  for (const [id, e] of entities) {
    if (keep.has(id)) continue
    if (Transform.has(e)) engine.removeEntity(e)
    entities.delete(id)
  }
}

function spawnShape(spec: FakeSpec): Entity {
  const e = engine.addEntity()
  Transform.create(e, {
    position: Vector3.create(spec.x, spec.y, spec.z),
    rotation: Quaternion.fromEulerDegrees(0, 90, 0)
  })
  const male = spec.slot % 2 === 0
  AvatarShape.create(e, {
    id: spec.id,
    name: spec.name,
    bodyShape: male
      ? 'urn:decentraland:off-chain:base-avatars:BaseMale'
      : 'urn:decentraland:off-chain:base-avatars:BaseFemale',
    wearables: [
      SHIRTS[spec.slot % SHIRTS.length],
      'urn:decentraland:off-chain:base-avatars:brown_pants',
      'urn:decentraland:off-chain:base-avatars:sneakers'
    ],
    emotes: [],
    eyeColor: Color3.create(0.3, 0.5, 0.8),
    skinColor: Color3.create(0.76 + (spec.slot % 3) * 0.05, 0.58, 0.46),
    hairColor: Color3.create(0.15 + spec.slot * 0.08, 0.1, 0.08)
  })
  return e
}
