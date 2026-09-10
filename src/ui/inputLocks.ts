import { InputModifier, TouchScreenControls, engine } from '@dcl/sdk/ecs'

type LockMode = 'all' | 'hub' | 'dock' | 'board' | 'hold' | 'cannon' | 'fish' | 'tutorial'

let mode: LockMode = 'hub'
let applied: LockMode | null = null

const HUB_PLAY = {
  disableWalk: false,
  disableJog: false,
  disableRun: false,
  disableJump: false,
  disableEmote: false,
  disableDoubleJump: true,
  disableGliding: true
}

const DOCK_PLAY = {
  disableWalk: false,
  disableJog: false,
  disableRun: true,
  disableJump: false,
  disableEmote: false,
  disableDoubleJump: true,
  disableGliding: true
}

const CANNON_PLAY = {
  disableWalk: true,
  disableJog: true,
  disableRun: true,
  disableJump: true,
  disableEmote: true,
  disableDoubleJump: true,
  disableGliding: true
}

const BOARD_VIEW = {
  disableWalk: true,
  disableJog: true,
  disableRun: true,
  disableJump: true,
  disableEmote: true,
  disableDoubleJump: true,
  disableGliding: true
}

export function lockAllInputs(): void {
  mode = 'all'
  applied = 'all'
  write({ disableAll: true })
  TouchScreenControls.hideAll()
}

export function lockTutorial(): void {
  mode = 'tutorial'
  applied = 'tutorial'
  write({ disableAll: true })
  TouchScreenControls.hideAll()
  TouchScreenControls.hideJoystick()
}

export function lockCannonPlay(): void {
  mode = 'cannon'
  applied = 'cannon'
  write(CANNON_PLAY)
  hideJumpUi()
}

export function lockFishPlay(): void {
  mode = 'fish'
  applied = 'fish'
  write(CANNON_PLAY)
  TouchScreenControls.hideAll()
  TouchScreenControls.hideJoystick()
}

export function holdPlayer(): void {
  mode = 'hold'
  applied = 'hold'
  write({
    disableWalk: true,
    disableJog: true,
    disableRun: true,
    disableJump: true,
    disableEmote: true,
    disableDoubleJump: true,
    disableGliding: true
  })
}

export function unlockToGameplay(): void {
  mode = 'hub'
  applied = 'hub'
  write(HUB_PLAY)
  hideJumpUi()
}

export function unlockToDock(): void {
  mode = 'dock'
  applied = 'dock'
  write(DOCK_PLAY)
  hideJumpUi()
}

export function lockBoardView(): void {
  mode = 'board'
  applied = 'board'
  write(BOARD_VIEW)
}

export function isBoardViewLocked(): boolean {
  return mode === 'board'
}

export function registerInputLocks(): void {
  unlockToGameplay()
  engine.addSystem(enforceGameplayLocks, -100, 'input-locks')
}

function hideJumpUi(): void {
  TouchScreenControls.hideAll()
  TouchScreenControls.showJoystick()
}

function enforceGameplayLocks(): void {
  if (mode === 'tutorial' || mode === 'all') {
    write({ disableAll: true })
    TouchScreenControls.hideAll()
    if (mode === 'tutorial') TouchScreenControls.hideJoystick()
    return
  }
  if (mode === 'fish') {
    write(CANNON_PLAY)
    TouchScreenControls.hideAll()
    TouchScreenControls.hideJoystick()
    return
  }
  if (mode === 'hold' || mode === 'cannon') return
  if (applied === mode) return
  const want = mode === 'dock' ? DOCK_PLAY : mode === 'board' ? BOARD_VIEW : HUB_PLAY
  const cur = InputModifier.getOrNull(engine.PlayerEntity)
  const std = cur?.mode?.$case === 'standard' ? cur.mode.standard : undefined
  if (
    !!std?.disableWalk === want.disableWalk &&
    !!std?.disableJog === want.disableJog &&
    !!std?.disableJump === want.disableJump &&
    !!std?.disableEmote === want.disableEmote &&
    std?.disableDoubleJump === want.disableDoubleJump &&
    std?.disableGliding === want.disableGliding &&
    !!std?.disableRun === want.disableRun &&
    !std.disableAll
  ) {
    return
  }
  write(want)
  applied = mode
}

function write(standard: {
  disableAll?: boolean
  disableWalk?: boolean
  disableJog?: boolean
  disableRun?: boolean
  disableJump?: boolean
  disableEmote?: boolean
  disableDoubleJump?: boolean
  disableGliding?: boolean
}): void {
  InputModifier.createOrReplace(engine.PlayerEntity, {
    mode: {
      $case: 'standard',
      standard
    }
  })
}
