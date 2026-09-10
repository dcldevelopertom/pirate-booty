import {
  AvatarModifierArea,
  AvatarModifierType,
  Entity,
  PlayerIdentityData,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'
import { Vector3 } from '@dcl/sdk/math'
import { DECK_Y, LANE, WATER_Y } from '../config'
import { getFishOccupantAddresses } from '../games/fish/FishArena'
import { getPlayingLane, getViewingLane } from '../games/shared/viewing'
import { readGames } from '../net/schemas'
import { laneZ } from './layout'

const meshes: Entity[] = []
const meshScale: Vector3[] = []
const volumes: Entity[] = []
const lastExclude: string[][] = [[], [], [], []]
let meshOn = true

export function isDeckHideMeshVisible(): boolean {
  return meshOn
}

export function buildDeckHide(): void {
  const height = DECK_Y + 6 - WATER_Y
  const y = WATER_Y + height / 2
  const padZ = 2
  const padX = 2

  for (let i = 0; i < LANE.count; i++) {
    const size = Vector3.create(LANE.length + padX * 2, height, LANE.width + padZ * 2)
    const pos = Vector3.create(LANE.x0 + LANE.length / 2, y, laneZ(i) + LANE.width / 2)

    const volume = engine.addEntity()
    Transform.create(volume, { position: pos })
    AvatarModifierArea.create(volume, {
      area: size,
      modifiers: [AvatarModifierType.AMT_HIDE_AVATARS],
      excludeIds: []
    })
    volumes.push(volume)
  }

}

export function registerDeckHideExcludes(): void {
  if (isServer()) return
  engine.addSystem(syncDeckHideExcludes, 20, 'deck-hide-excludes')
}

export function setDeckHideMeshVisible(on: boolean): void {
  meshOn = on
  for (let i = 0; i < meshes.length; i++) {
    const mesh = meshes[i]
    if (!Transform.has(mesh)) continue
    Transform.getMutable(mesh).scale = on ? meshScale[i] : Vector3.Zero()
  }
}

function localAddress(): string {
  const id = PlayerIdentityData.getOrNull(engine.PlayerEntity)
  return id?.address ?? ''
}

function syncDeckHideExcludes(): void {
  const local = localAddress()
  const playing = getPlayingLane()
  const viewing = getViewingLane()
  const games = readGames()

  for (let lane = 0; lane < LANE.count; lane++) {
    const seen = new Set<string>()
    const ids: string[] = []
    pushId(ids, seen, local)
    for (const id of getFishOccupantAddresses()) pushId(ids, seen, id)

    const session = playing === lane || viewing === lane
    if (session) {
      const game = games.find((g) => g.lane === lane && g.phase !== 'ended')
      if (game) {
        for (const seat of game.seats) {
          if (seat.fake) continue
          pushId(ids, seen, seat.address)
        }
      }
    }

    const prev = lastExclude[lane]
    if (sameIds(prev, ids)) continue
    lastExclude[lane] = ids
    const vol = volumes[lane]
    if (!vol || !AvatarModifierArea.has(vol)) continue
    AvatarModifierArea.getMutable(vol).excludeIds = ids
  }
}

function pushId(ids: string[], seen: Set<string>, id: string): void {
  if (!id) return
  const key = id.toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  ids.push(id)
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}
