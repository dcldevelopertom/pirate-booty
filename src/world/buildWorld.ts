import { SkyboxTime, engine } from '@dcl/sdk/ecs'
import { buildBoardNpc, buildCrateSitters } from './BoardNpc'
import { buildBootyLootSign } from './BootyLootSign'
import { buildCannonFodderSign } from './CannonFodderSign'
import { buildFishingSign } from './FishingSign'
import { buildFishPier } from '../games/fish/FishArena'
import { buildCameras } from './cameras'
import { buildDeckDodgeKiosk } from './DeckDodgeKiosk'
import { buildDeckHide } from './DeckHide'
import { buildDockLanes } from './DockLanes'
import { buildHubPier } from './HubPier'
import { buildLeaderboard } from './Leaderboard'
import { buildParkedShip } from './ParkedShip'
import { buildProps } from './Props'
import { buildWater } from './Water'
import { buildLootArena } from './LootArena'
import { buildLootHide } from './LootHide'

export function buildStaticWorld(): void {
  SkyboxTime.createOrReplace(engine.RootEntity, { fixedTime: 10 * 3600 })
  buildWater()
  buildDockLanes()
  buildDeckHide()
  buildHubPier()
  buildDeckDodgeKiosk()
  buildBootyLootSign()
  buildCannonFodderSign()
  buildFishingSign()
  buildFishPier()
  buildLeaderboard()
  buildBoardNpc()
  buildParkedShip()
  buildLootArena()
  buildLootHide()
  buildProps()
  buildCrateSitters()
  buildCameras()
}
