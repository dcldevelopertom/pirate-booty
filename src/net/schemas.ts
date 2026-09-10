import { engine, Schemas } from '@dcl/sdk/ecs'

/** Synced on each row root so clients can attach 1 m visual cubes. */
export const RowMark = engine.defineComponent('pirate-booty:RowMark', {
  lane: Schemas.Int,
  index: Schemas.Int,
  gen: Schemas.Int
})

export const KillMark = engine.defineComponent('pirate-booty:KillMark', {
  lane: Schemas.Int
})

export const BarrelMark = engine.defineComponent('pirate-booty:BarrelMark', {
  lane: Schemas.Int
})

export type SeatInfo = {
  name: string
  fake: boolean
  state: string
  address: string
}

export type GameInfo = {
  id: number
  lane: number
  phase: string
  real: number
  fake: number
  count: number
  max: number
  label: string
  elapsed: number
  barrelX: number
  dropped: number
  result: string
  seats: SeatInfo[]
}

export const GameBoard = engine.defineComponent('pirate-booty:GameBoard', {
  json: Schemas.String,
  needMoreThanOne: Schemas.Boolean,
  hubBots: Schemas.Int
})

export function readGames(): GameInfo[] {
  for (const [, board] of engine.getEntitiesWith(GameBoard)) {
    try {
      const parsed = JSON.parse(board.json) as GameInfo[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export function readNeedMoreThanOne(): boolean {
  for (const [, board] of engine.getEntitiesWith(GameBoard)) {
    return board.needMoreThanOne
  }
  return true
}

export function readHubBots(): number {
  for (const [, board] of engine.getEntitiesWith(GameBoard)) {
    return board.hubBots
  }
  return 0
}

export const LaneState = engine.defineComponent('pirate-booty:LaneState', {
  loaded0: Schemas.Boolean,
  loaded1: Schemas.Boolean,
  loaded2: Schemas.Boolean,
  loaded3: Schemas.Boolean,
  phase0: Schemas.String,
  phase1: Schemas.String,
  phase2: Schemas.String,
  phase3: Schemas.String
})

export function isLaneLoaded(state: { loaded0: boolean; loaded1: boolean; loaded2: boolean; loaded3: boolean }, lane: number): boolean {
  switch (lane) {
    case 0:
      return state.loaded0
    case 1:
      return state.loaded1
    case 2:
      return state.loaded2
    case 3:
      return state.loaded3
    default:
      return false
  }
}

export function getLanePhase(
  state: { phase0: string; phase1: string; phase2: string; phase3: string },
  lane: number
): string {
  switch (lane) {
    case 0:
      return state.phase0
    case 1:
      return state.phase1
    case 2:
      return state.phase2
    default:
      return state.phase3
  }
}
