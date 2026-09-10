import { getRealm } from '~system/Runtime'
import { ADMINS } from '../config'

let preview = false
let ready = false

export async function initAdmins(): Promise<void> {
  try {
    const { realmInfo } = await getRealm({})
    preview = !!realmInfo?.isPreview
  } catch {
    preview = false
  }
  ready = true
}

export function isPreview(): boolean {
  return preview
}

export function adminsReady(): boolean {
  return ready
}

export function isAdmin(address: string | undefined | null): boolean {
  if (preview) return true
  if (!address) return false
  const a = address.toLowerCase()
  return ADMINS.some((w) => w.toLowerCase() === a)
}
