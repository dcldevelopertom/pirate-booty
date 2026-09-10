import { engine } from '@dcl/sdk/ecs'
import ReactEcs, { ReactEcsRenderer, ScreenInsetArea, UiEntity } from '@dcl/sdk/react-ecs'
import { disconnectUi, setupDisconnectWatch } from './Disconnect'
import { drownUi } from './DrownUi'
import { gmUi, setupGmPanel } from './GmPanel'
import { matchHudUi, matchOverlayUi, setupMatchHud, tickMatchHud } from './MatchHud'
import { lootHudUi, lootOverlayUi } from './LootHud'
import { cannonHudUi, cannonOverlayUi } from './CannonHud'
import { catchToastUi, setupCatchToast, tickCatchToast } from './CatchToast'
import { fishHudUi, fishOverlayUi, tickFishHud } from './FishHud'
import { gameInfoUi } from './GameInfo'
import { playPromptUi, tickPlayPrompt } from './PlayPrompt'
import { splashUi, startSplash } from './Splash'
import { setupTutorial, tutorialUi } from './Tutorial'
import { setupMobileGate } from './MobileGate'

export function setupUi(): void {
  setupGmPanel()
  setupMobileGate()
  setupTutorial()
  setupCatchToast()
  setupMatchHud()
  setupDisconnectWatch()
  startSplash()
  engine.addSystem((dt) => {
    tickMatchHud(dt)
    tickPlayPrompt(dt)
    tickFishHud(dt)
    tickCatchToast(dt)
  }, 10, 'match-hud')
  ReactEcsRenderer.setUiRenderer(
    () => (
      <UiEntity uiTransform={{ width: '100%', height: '100%', pointerFilter: 'none' }}>
        {splashUi()}
        {drownUi()}
        {matchOverlayUi()}
        {lootOverlayUi()}
        {cannonOverlayUi()}
        {fishOverlayUi()}
        {catchToastUi()}
        {playPromptUi()}
        {gameInfoUi()}
        {tutorialUi()}
        <ScreenInsetArea>
          {matchHudUi()}
          {lootHudUi()}
          {cannonHudUi()}
          {fishHudUi()}
          {gmUi()}
        </ScreenInsetArea>
        {disconnectUi()}
      </UiEntity>
    ),
    { screenInset: 'none' }
  )
}
