import { isServer } from '@dcl/sdk/network'
import { getUserData } from '~system/UserIdentity'
import { LANE } from './config'
import { allocate, initLanePool } from './games/barrel/LanePool'
import { initMatchSession } from './games/shared/MatchSession'
import { setupFakePlayers } from './games/shared/FakePlayers'
import { setupGameView } from './games/shared/GameView'
import { registerRaceTick } from './games/barrel/Race'
import { registerBarrelVisuals } from './games/barrel/Boulder'
import { registerRowVisuals } from './games/barrel/RowVisuals'
import { initAntiCheat } from './games/barrel/AntiCheat'
import { registerLocalObstacles } from './games/barrel/LocalObstacles'
import { initMatchFlow } from './games/barrel/MatchFlow'
import { initLootSession } from './games/loot/LootSession'
import { initCannonSession } from './games/cannon/CannonSession'
import { initFishSession } from './games/fish/FishSession'
import { registerPoseReport } from './games/barrel/PoseReport'
import { initGmHandlers } from './games/barrel/gmHandlers'
import { initAdmins } from './net/admins'
import './net/messages'
import { registerFlyCamSystem } from './ui/AdminFlyCam'
import { setLocalAddress } from './ui/GmPanel'
import { registerInputLocks } from './ui/inputLocks'
import { setupUi } from './ui/ui'
import { registerPlayerFollowCam } from './world/PlayerFollowCam'
import { buildDrownTrigger, registerDrownWatch } from './world/Drown'
import { buildWaterSplash, registerWaterSplash } from './world/WaterSplash'
import { setupSceneAudio } from './world/Audio'
import { buildStaticWorld } from './world/buildWorld'
import { setupBootyLootSign } from './world/BootyLootSign'
import { setupCannonFodderSign } from './world/CannonFodderSign'
import { setupFishingSign } from './world/FishingSign'
import { setLocalPirateName, setupFishClient } from './games/fish/FishClient'
import { setupDeckDodgeKiosk } from './world/DeckDodgeKiosk'
import { setupWorldBoard } from './world/Leaderboard'
import { setupPlayKiosks } from './world/PlayKiosks'
import { setupLootClient } from './games/loot/LootClient'
import { setupCannonClient } from './games/cannon/CannonClient'

export async function main() {
  const side = isServer() ? 'SERVER' : 'CLIENT'
  console.log(`[${side}] Pirate Booty`)

  buildStaticWorld()
  await initAdmins()

  if (isServer()) {
    initLanePool()
    initMatchSession()
    initGmHandlers()
    initMatchFlow()
    initLootSession()
    initCannonSession()
    initFishSession()
    initAntiCheat()
    registerRaceTick()
    if (LANE.defaultLoaded >= 0) allocate(LANE.defaultLoaded)
    return
  }

  try {
    const user = await getUserData({})
    if (user.data?.userId) setLocalAddress(user.data.userId)
    if (user.data?.displayName) setLocalPirateName(user.data.displayName)
  } catch {
    // preview guest
  }

  setupGameView()
  setupFakePlayers()
  registerRowVisuals()
  registerBarrelVisuals()
  registerLocalObstacles()
  registerPoseReport()
  registerInputLocks()
  setupWorldBoard()
  setupDeckDodgeKiosk()
  setupBootyLootSign()
  setupCannonFodderSign()
  setupFishingSign()
  setupPlayKiosks()
  setupLootClient()
  setupCannonClient()
  setupFishClient()
  setupSceneAudio()
  setupUi()
  buildDrownTrigger()
  registerDrownWatch()
  buildWaterSplash()
  registerWaterSplash()
  registerPlayerFollowCam()
  registerFlyCamSystem()
}
