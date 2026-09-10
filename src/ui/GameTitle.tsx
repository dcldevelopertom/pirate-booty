import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'

export function gameTitle(src: string, width = 280, height = 88) {
  return (
    <UiEntity
      uiTransform={{ width, height, margin: { bottom: 4 } }}
      uiBackground={{
        textureMode: 'stretch',
        texture: { src }
      }}
    />
  )
}
