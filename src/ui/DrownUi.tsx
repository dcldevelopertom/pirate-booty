import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { drownRemain, isDrownUiVisible } from '../world/Drown'

export function drownUi() {
  if (!isDrownUiVisible()) return null
  const n = Math.max(1, Math.ceil(drownRemain()))
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
        pointerFilter: 'block'
      }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.72) }}
    >
      <UiEntity
        uiTransform={{
          width: 920,
          height: 530,
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: { top: 74, bottom: 114, left: 98, right: 98 }
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: 'images/panel-info.png' }
        }}
      >
        <Label
          value="YOU DIED"
          fontSize={66}
          color={Color4.create(0.96, 0.82, 0.35, 1)}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: 80, margin: { bottom: 12 } }}
        />
        <Label
          value={String(n)}
          fontSize={72}
          color={Color4.White()}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: 90 }}
        />
      </UiEntity>
    </UiEntity>
  )
}
