import { isMobile } from '@dcl/sdk/platform'
import { room } from '../net/messages'

let mobileOnly = false
let ready = false

export function setupMobileGate(): void {
  room.onMessage('mobileOnlyState', (data) => {
    mobileOnly = data.on
    ready = true
  })
}

export function isMobileGateReady(): boolean {
  return ready
}

export function isMobileOnly(): boolean {
  return mobileOnly
}

export function isDesktopBlocked(): boolean {
  return ready && mobileOnly && !isMobile()
}

export function markGateReady(): void {
  ready = true
}
