import { FISH } from '../../config'
import { pickFishKind, type FishKind } from './FishTypes'

export type SimFish = {
  id: number
  kind: string
  along: number
  depth: number
  out: number
  dir: number
  speed: number
  pause: number
  nextTurn: number
  immune: number
  hooked: boolean
}

export type FishPath = {
  id: number
  kind: string
  along0: number
  along1: number
  depth: number
  out: number
  dir: number
  dur: number
}

export function fishSpan(): number {
  return ((FISH.slots - 1) * FISH.slotGap) / 2 - 2
}

export function rollFishDepth(kind: FishKind): number {
  const span = FISH.depthMax - FISH.depthMin
  const kindLo = 1.2
  const kindHi = 11
  const t0 = Math.max(0, Math.min(1, (kind.depthMin - kindLo) / (kindHi - kindLo)))
  const t1 = Math.max(0, Math.min(1, (kind.depthMax - kindLo) / (kindHi - kindLo)))
  const min = FISH.depthMin + t0 * span
  const max = FISH.depthMin + t1 * span
  if (Math.random() < 0.45) return FISH.depthMin + Math.random() * span
  return min + Math.random() * Math.max(0.8, max - min)
}

export function makeSimFish(id: number): SimFish {
  const kind = pickFishKind()
  const span = fishSpan()
  return {
    id,
    kind: kind.id,
    along: (Math.random() * 2 - 1) * span,
    depth: rollFishDepth(kind),
    out: 1.5 + Math.random() * 7,
    dir: Math.random() < 0.5 ? 1 : -1,
    speed: kind.speed * (0.9 + Math.random() * 0.25),
    pause: 0,
    nextTurn: 2 + Math.random() * 7,
    immune: 0,
    hooked: false
  }
}

export function makeSimSchool(count: number): SimFish[] {
  const school: SimFish[] = []
  for (let i = 0; i < count; i++) school.push(makeSimFish(i + 1))
  return school
}

export function currentPath(s: SimFish): FishPath {
  if (s.pause > 0 || s.hooked) return holdPath(s, Math.max(0.05, s.pause))
  return swimPath(s)
}

function holdPath(s: SimFish, dur: number): FishPath {
  return {
    id: s.id,
    kind: s.kind,
    along0: s.along,
    along1: s.along,
    depth: s.depth,
    out: s.out,
    dir: s.dir,
    dur
  }
}

function swimPath(s: SimFish): FishPath {
  const span = fishSpan()
  const toEdge = s.dir > 0 ? (span - s.along) / Math.max(0.05, s.speed) : (s.along + span) / Math.max(0.05, s.speed)
  const dur = Math.max(0.12, Math.min(toEdge, Math.max(0.12, s.nextTurn)))
  const along1 = Math.max(-span, Math.min(span, s.along + s.dir * s.speed * dur))
  return {
    id: s.id,
    kind: s.kind,
    along0: s.along,
    along1,
    depth: s.depth,
    out: s.out,
    dir: s.dir,
    dur
  }
}

export function tickSim(school: SimFish[], dt: number): FishPath[] {
  const paths: FishPath[] = []
  const span = fishSpan()
  for (const s of school) {
    if (s.immune > 0) s.immune -= dt
    if (s.hooked) continue
    if (s.pause > 0) {
      s.pause -= dt
      if (s.pause > 0) continue
      s.dir *= -1
      s.nextTurn = 3 + Math.random() * 9
      paths.push(swimPath(s))
      continue
    }
    s.along += s.dir * s.speed * dt
    s.nextTurn -= dt
    if (s.along > span) {
      s.along = span
      s.pause = 0.35 + Math.random() * 0.7
      paths.push(holdPath(s, s.pause))
    } else if (s.along < -span) {
      s.along = -span
      s.pause = 0.35 + Math.random() * 0.7
      paths.push(holdPath(s, s.pause))
    } else if (s.nextTurn <= 0) {
      s.pause = 0.45 + Math.random() * 1.2
      s.nextTurn = 3 + Math.random() * 9
      paths.push(holdPath(s, s.pause))
    }
  }
  return paths
}

export function snapshotPaths(school: SimFish[]): FishPath[] {
  return school.filter((s) => !s.hooked).map((s) => currentPath(s))
}
