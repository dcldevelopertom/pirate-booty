import {
  ColliderLayer,
  Entity,
  GltfContainer,
  InputAction,
  Material,
  MeshCollider,
  MeshRenderer,
  TextAlignMode,
  TextShape,
  Transform,
  engine,
  pointerEventsSystem
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { HUB } from '../config'
import { PALETTE } from './palette'
import { hubCenter } from './layout'
import { room } from '../net/messages'
import { paint } from './primitives'
import { attachBoardCam, getCamFollow, isBoardCamOn, viewBoard, viewHub } from './cameras'
import { lockBoardView, unlockToGameplay } from '../ui/inputLocks'
import { isFlyCamOn } from '../ui/AdminFlyCam'
import { isSplashVisible } from '../ui/Splash'
import { isTutorialOpen } from '../ui/Tutorial'
import { registerHubGlb } from './HubHide'

const ROWS = 5
const ROW_H = 0.34
const ROW_FONT = 1.15
const HEAD_FONT = 0.88

type Slot = {
  pic: Entity
  name: Entity
  coins: Entity
  wins: Entity
}

const slots: Slot[] = []
let boardHit: Entity | null = null
let boardArmed = false

export function setupWorldBoard(): void {
  room.onMessage('leaderboard', (data) => {
    paintLeaderboard(data.rows)
  })
}

export function armLeaderboardPointer(): void {
  if (boardArmed || !boardHit) return
  boardArmed = true
  hookBoardClick(boardHit)
}

export function buildLeaderboard(): void {
  const c = hubCenter()
  const pos = Vector3.create(c.x + 8.2, HUB.y + 2.6, c.z)
  const yaw = -90
  const root = engine.addEntity()
  Transform.create(root, {
    position: pos,
    rotation: Quaternion.fromEulerDegrees(0, yaw, 0)
  })

  const plaque = engine.addEntity()
  Transform.create(plaque, {
    parent: root,
    scale: Vector3.create(3, 3, 3)
  })
  GltfContainer.create(plaque, {
    src: 'assets/models/leaderboard.glb',
    visibleMeshesCollisionMask: ColliderLayer.CL_NONE,
    invisibleMeshesCollisionMask: ColliderLayer.CL_NONE
  })
  registerHubGlb(root)
  attachBoardCam(pos, yaw)
  boardHit = engine.addEntity()
  Transform.create(boardHit, {
    position: pos,
    rotation: Quaternion.fromEulerDegrees(0, yaw, 0),
    scale: Vector3.create(8, 6.6, 3)
  })
  MeshCollider.setBox(boardHit, ColliderLayer.CL_POINTER)
  placeTreasure(root, 2.15, 0.7, -1.55, 40)
  placeTreasure(root, -2.15, 0.7, -1.55, 40)
  placeTreasure(root, -1.1, 0.28, -1.5, 25)
  placeTreasure(root, -0.55, 0.1, -1.55, 25)
  placeTreasure(root, 0, 0.02, -1.58, 25)
  placeTreasure(root, 0.55, 0.1, -1.55, 25)
  placeTreasure(root, 1.1, 0.28, -1.5, 25)
  header(root, Vector3.create(1.5, 1.32, 0.2), '#')
  header(root, Vector3.create(0.18, 1.32, 0.2), 'NAME')
  header(root, Vector3.create(-0.78, 1.32, 0.2), 'COINS')
  header(root, Vector3.create(-1.4, 1.32, 0.2), 'WINS')

  for (let i = 0; i < ROWS; i++) {
    const y = 0.98 - i * ROW_H
    text(root, Vector3.create(1.5, y, 0.2), String(i + 1), ROW_FONT, PALETTE.GOLD)
    const pic = engine.addEntity()
    Transform.create(pic, {
      parent: root,
      position: Vector3.create(1.18, y, 0.2),
      scale: Vector3.create(0.24, 0.24, 0.03)
    })
    MeshRenderer.setBox(pic)
    paint(pic, PALETTE.WOOD)
    slots.push({
      pic,
      name: text(root, Vector3.create(0.12, y, 0.2), '—', 1, PALETTE.CREAM, TextAlignMode.TAM_MIDDLE_CENTER, 1.45),
      coins: text(root, Vector3.create(-0.78, y, 0.2), '—', ROW_FONT, PALETTE.GOLD),
      wins: text(root, Vector3.create(-1.4, y, 0.2), '—', ROW_FONT, PALETTE.CREAM)
    })
  }
}

export function paintLeaderboard(
  rows: Array<{ address: string; name: string; coins: number; wins: number }>
): void {
  const sorted = rows
    .filter((r) => r.coins >= 1)
    .slice()
    .sort((a, b) => b.coins - a.coins || b.wins - a.wins)
  for (let i = 0; i < ROWS; i++) {
    const slot = slots[i]
    if (!slot) continue
    const row = sorted[i]
    if (!row) {
      write(slot.name, '—')
      write(slot.coins, '—')
      write(slot.wins, '—')
      paint(slot.pic, PALETTE.WOOD)
      continue
    }
    write(slot.name, clip(boardName(row), 15))
    write(slot.coins, String(row.coins))
    write(slot.wins, String(row.wins))
    if (row.address && !row.address.startsWith('fake-')) {
      Material.setPbrMaterial(slot.pic, {
        texture: Material.Texture.Avatar({ userId: row.address }),
        roughness: 1,
        metallic: 0,
        emissiveTexture: Material.Texture.Avatar({ userId: row.address }),
        emissiveColor: Color3.create(1, 1, 1),
        emissiveIntensity: 0.6
      })
    } else {
      paint(slot.pic, PALETTE.WOOD)
    }
  }
}

function hookBoardClick(face: Entity): void {
  pointerEventsSystem.onPointerDown(
    {
      entity: face,
      opts: {
        button: InputAction.IA_POINTER,
        hoverText: 'Leaderboard',
        maxDistance: 40,
        maxPlayerDistance: 40,
        showFeedback: true,
        showHighlight: true
      }
    },
    () => {
      try {
        console.log('[BOARD] click start', {
          splash: isSplashVisible(),
          fly: isFlyCamOn(),
          on: isBoardCamOn(),
          cam: getCamFollow()
        })
        if (isSplashVisible() || isTutorialOpen() || isFlyCamOn()) {
          console.log('[BOARD] click ignored')
          return
        }
        if (isBoardCamOn()) {
          console.log('[BOARD] switching to hub cam')
          viewHub()
          unlockToGameplay()
          return
        }
        console.log('[BOARD] switching to board cam')
        viewBoard()
        lockBoardView()
        console.log('[BOARD] click done', getCamFollow())
      } catch (e) {
        console.log('[BOARD] click error', e)
      }
    }
  )
}

function placeTreasure(parent: Entity, localX: number, localZ: number, localY = -1.55, yaw = 70): void {
  const e = engine.addEntity()
  Transform.create(e, {
    parent,
    position: Vector3.create(localX, localY - 0.5, localZ),
    rotation: Quaternion.fromEulerDegrees(0, yaw, 0)
  })
  GltfContainer.create(e, {
    src: 'assets/models/gold-treasure.glb',
    visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS,
    invisibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS
  })
}

function header(parent: Entity, position: Vector3, value: string): Entity {
  return text(parent, position, value, HEAD_FONT, PALETTE.GOLD)
}

function text(
  parent: Entity,
  position: Vector3,
  value: string,
  fontSize: number,
  color: Color4,
  align: TextAlignMode = TextAlignMode.TAM_MIDDLE_CENTER,
  width?: number
): Entity {
  const e = engine.addEntity()
  Transform.create(e, {
    parent,
    position,
    rotation: Quaternion.fromEulerDegrees(0, 180, 0)
  })
  TextShape.create(e, {
    text: value,
    fontSize,
    textColor: color,
    textAlign: align,
    ...(width != null ? { width, textWrapping: false } : {})
  })
  return e
}

function write(entity: Entity, value: string): void {
  if (!TextShape.has(entity)) return
  TextShape.getMutable(entity).text = value
}

function boardName(row: { name: string; address: string }): string {
  if (row.address && (!row.name || row.name.startsWith('0x') || row.name.endsWith('…'))) {
    return row.address
  }
  return row.name || row.address
}

function clip(value: string, max: number): string {
  if (!value) return '—'
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}
