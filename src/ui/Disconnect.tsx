import { engine } from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { room } from '../net/messages'
import { lockAllInputs } from './inputLocks'

let everReady = false
let disconnected = false

export function isServerDisconnected(): boolean {
  return disconnected
}

export function setupDisconnectWatch(): void {
  if (room.isReady()) everReady = true
  room.onReady((ready) => {
    if (ready) {
      everReady = true
      disconnected = false
      return
    }
    if (!everReady) return
    disconnected = true
    lockAllInputs()
  })
  engine.addSystem(() => {
    if (!everReady || disconnected) return
    if (room.isReady()) return
    disconnected = true
    lockAllInputs()
  }, 5, 'server-disconnect')
}

export function disconnectUi() {
  if (!disconnected) return null
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column'
      }}
      uiBackground={{ color: Color4.create(0.02, 0.01, 0.01, 0.94) }}
    >
      <Label
        value="SERVER DISCONNECTED"
        fontSize={42}
        color={Color4.create(0.96, 0.9, 0.78, 1)}
        textAlign="middle-center"
        uiTransform={{ width: '100%', height: 56 }}
      />
      <Label
        value="The game server went away."
        fontSize={22}
        color={Color4.White()}
        textAlign="middle-center"
        uiTransform={{ width: '100%', height: 32, margin: { top: 12 } }}
      />
      <Label
        value="Reload the scene to reconnect."
        fontSize={18}
        color={Color4.create(0.8, 0.85, 0.6, 1)}
        textAlign="middle-center"
        uiTransform={{ width: '100%', height: 28, margin: { top: 8 } }}
      />
    </UiEntity>
  )
}
