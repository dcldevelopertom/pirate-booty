import { AudioSource, Entity, Transform, engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { WATER_Y } from '../config'
import { cannonCam, fishCatchCam, fishViewCam } from './cameras'
import { hubCenter } from './layout'

const WAVES = 'assets/sounds/dock-waves.mp3'
const MUSIC = 'assets/sounds/dock-music.mp3'
const REEL = 'assets/sounds/fish-reel.mp3'
const CATCHES = [
  'assets/sounds/catch-ohyea.mp3',
  'assets/sounds/catch-nicecatch.mp3',
  'assets/sounds/catch-greatone.mp3'
]
const SNAPS = [
  'assets/sounds/snap-anotherone.mp3',
  'assets/sounds/snap-darn.mp3'
]
const CANNON = 'assets/sounds/cannon-fire.mp3'
const SPLASH = 'assets/sounds/splash.mp3'

let wavesEnt: Entity
let musicEnt: Entity
let snapEnt: Entity
let catchEnt: Entity
let cannonEnt: Entity
let splashEnt: Entity
let reelOn = false
let reelLooping = false
let dockOn = false
let muted = false

const WAVE_VOL = 0.15
const MUSIC_VOL = 0.05
const REEL_VOL = 0.8

export function isSoundOn(): boolean {
  return !muted
}

export function toggleSound(): void {
  muted = !muted
  if (muted) {
    if (AudioSource.has(wavesEnt)) AudioSource.getMutable(wavesEnt).playing = false
    if (AudioSource.has(musicEnt)) AudioSource.getMutable(musicEnt).playing = false
    if (AudioSource.has(fishViewCam)) AudioSource.getMutable(fishViewCam).playing = false
    return
  }
  if (dockOn) {
    dockOn = false
    startDockAmbience()
  }
  if (reelLooping) {
    reelLooping = false
    startReelLoop()
  }
  if (reelOn) {
    reelOn = false
    setReelSound(true)
  }
}

export function setupSceneAudio(): void {
  wavesEnt = engine.addEntity()
  Transform.create(wavesEnt)
  musicEnt = engine.addEntity()
  Transform.create(musicEnt)
  snapEnt = engine.addEntity()
  Transform.create(snapEnt)
  catchEnt = engine.addEntity()
  Transform.create(catchEnt)
  cannonEnt = engine.addEntity()
  Transform.create(cannonEnt)
  splashEnt = engine.addEntity()
  Transform.create(splashEnt)
  parkHubAudio()
  engine.addSystem(followCamAudio, 8, 'audio-follow-cam')
}

function parkHubAudio(): void {
  const c = hubCenter()
  const p = Vector3.create(c.x, c.y + 4, c.z)
  place(wavesEnt, p)
  place(musicEnt, p)
}

function followCamAudio(): void {
  const fish = worldPosition(fishViewCam)
  if (fish) place(snapEnt, fish)
  const caught = worldPosition(fishCatchCam)
  if (caught) place(catchEnt, caught)
  const gun = worldPosition(cannonCam)
  if (gun) place(cannonEnt, gun)
}

function worldPosition(entity: Entity): Vector3 | null {
  const t = Transform.getOrNull(entity)
  if (!t) return null
  let pos = Vector3.create(t.position.x, t.position.y, t.position.z)
  let parent = t.parent
  let guard = 0
  while (parent && guard++ < 8) {
    const p = Transform.getOrNull(parent)
    if (!p) break
    pos = Vector3.add(p.position, Vector3.rotate(pos, p.rotation))
    parent = p.parent
  }
  return pos
}

function place(audio: Entity, p: Vector3): void {
  const t = Transform.getMutableOrNull(audio)
  if (!t) return
  t.position.x = p.x
  t.position.y = p.y
  t.position.z = p.z
}

export function stopHubAmbience(): void {
  dockOn = false
  if (AudioSource.has(wavesEnt)) AudioSource.getMutable(wavesEnt).playing = false
  if (AudioSource.has(musicEnt)) AudioSource.getMutable(musicEnt).playing = false
}

export function startDockAmbience(): void {
  dockOn = true
  if (muted) return
  parkHubAudio()
  AudioSource.createOrReplace(wavesEnt, {
    audioClipUrl: WAVES,
    playing: true,
    loop: true,
    volume: WAVE_VOL,
    currentTime: 0
  })
  AudioSource.createOrReplace(musicEnt, {
    audioClipUrl: MUSIC,
    playing: true,
    loop: true,
    volume: MUSIC_VOL,
    currentTime: 0
  })
}

/** Loop sits on fishViewCam so the source is the fishing camera, not the avatar. */
export function startReelLoop(): void {
  if (reelLooping) return
  reelLooping = true
  if (muted) return
  AudioSource.createOrReplace(fishViewCam, {
    audioClipUrl: REEL,
    playing: true,
    loop: true,
    volume: reelOn ? REEL_VOL : 0,
    currentTime: 0
  })
}

export function stopReelLoop(): void {
  reelLooping = false
  reelOn = false
  if (AudioSource.has(fishViewCam)) AudioSource.getMutable(fishViewCam).playing = false
}

export function setReelSound(on: boolean): void {
  if (on === reelOn) return
  reelOn = on
  if (muted && on) return
  if (on) {
    reelLooping = true
    AudioSource.createOrReplace(fishViewCam, {
      audioClipUrl: REEL,
      playing: true,
      loop: true,
      volume: REEL_VOL,
      currentTime: 0
    })
    return
  }
  const a = AudioSource.getMutableOrNull(fishViewCam)
  if (a) a.volume = 0
}

export function playFishCatch(): void {
  if (muted) return
  AudioSource.createOrReplace(catchEnt, {
    audioClipUrl: CATCHES[Math.floor(Math.random() * CATCHES.length)],
    playing: true,
    loop: false,
    volume: 0.9,
    currentTime: 0
  })
}

export function playFishSnap(): void {
  if (muted) return
  AudioSource.createOrReplace(snapEnt, {
    audioClipUrl: SNAPS[Math.floor(Math.random() * SNAPS.length)],
    playing: true,
    loop: false,
    volume: 0.9,
    currentTime: 0
  })
}

export function playCannonFire(): void {
  if (muted) return
  AudioSource.createOrReplace(cannonEnt, {
    audioClipUrl: CANNON,
    playing: true,
    loop: false,
    volume: 0.3,
    currentTime: 0
  })
}

export function playSplashSound(x: number, z: number): void {
  if (muted) return
  const t = Transform.getMutableOrNull(splashEnt)
  if (t) {
    t.position.x = x
    t.position.y = WATER_Y
    t.position.z = z
  }
  AudioSource.createOrReplace(splashEnt, {
    audioClipUrl: SPLASH,
    playing: true,
    loop: false,
    volume: 0.75,
    currentTime: 0
  })
}
