import { Entity, VisibilityComponent } from '@dcl/sdk/ecs'

type HubItem = { entity: Entity; stayForCannon: boolean }

const hubGlbs: HubItem[] = []
let visible = true

export function registerHubGlb(entity: Entity, stayForCannon = false): void {
  hubGlbs.push({ entity, stayForCannon })
  VisibilityComponent.createOrReplace(entity, { visible: true, propagateToChildren: true })
}

export function setHubGlbsVisible(on: boolean, mode: 'all' | 'cannon' = 'all'): void {
  visible = on
  for (const item of hubGlbs) {
    const show = on || (mode === 'cannon' && item.stayForCannon)
    VisibilityComponent.createOrReplace(item.entity, { visible: show, propagateToChildren: true })
  }
}

export function areHubGlbsVisible(): boolean {
  return visible
}
