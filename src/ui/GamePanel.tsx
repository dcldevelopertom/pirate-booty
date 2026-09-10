import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

const PANEL = { width: 920, height: 530 }
const IMAGE = { width: 320, height: 196 }
const CANNON_IMAGE = { width: 268, height: 164 }

export function cannonPanelImageSize(): { width: number; height: number } {
  return CANNON_IMAGE
}

export function gameLobbyUi(opts: {
  title: string
  image?: string
  imageWidth?: number
  imageHeight?: number
  countLine: string
  wait: string
  onLeave: () => void
}) {
  return gameStatusPanel({
    image: opts.image,
    imageWidth: opts.imageWidth,
    imageHeight: opts.imageHeight,
    body: (
      <UiEntity
        uiTransform={{
          width: '100%',
          height: '100%',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <Label
          value={opts.title}
          fontSize={32}
          color={Color4.create(0.96, 0.82, 0.35, 1)}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: 42, margin: { bottom: 8 } }}
        />
        <Label
          value={opts.countLine}
          fontSize={36}
          color={Color4.White()}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: 48 }}
        />
        <Label
          value={opts.wait}
          fontSize={18}
          color={Color4.create(0.8, 0.85, 0.6, 1)}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: 28, margin: { top: 6, bottom: 10 } }}
        />
        {panelBackButton('Leave', opts.onLeave)}
      </UiEntity>
    )
  })
}

export function gameStatusPanel(opts: {
  image?: string
  imageWidth?: number
  imageHeight?: number
  body: ReactEcs.JSX.Element
}) {
  const imgW = opts.imageWidth ?? IMAGE.width
  const imgH = opts.imageHeight ?? IMAGE.height
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
          width: PANEL.width,
          height: PANEL.height,
          flexDirection: 'row',
          justifyContent: 'center',
          padding: { top: 74, bottom: 114, left: 98, right: 98 },
          alignItems: 'center'
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: 'images/panel-info.png' }
        }}
      >
        {opts.image ? (
          <UiEntity
            uiTransform={{ width: imgW, height: imgH, margin: { right: 22 } }}
            uiBackground={{
              textureMode: 'stretch',
              texture: { src: opts.image }
            }}
          />
        ) : null}
        <UiEntity
          uiTransform={{
            width: 380,
            height: 310,
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          {opts.body}
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

export function gameResultsUi(opts: {
  title: string
  image: string
  imageWidth?: number
  imageHeight?: number
  placeLine: string
  note?: string
  bankLine: string
  rows: Array<{ value: string; color?: Color4 }>
  onBack: () => void
}) {
  const rowColor = Color4.create(0.92, 0.86, 0.74, 1)
  return gameStatusPanel({
    image: opts.image,
    imageWidth: opts.imageWidth,
    imageHeight: opts.imageHeight,
    body: (
      <UiEntity
        uiTransform={{
          width: '100%',
          height: '100%',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <Label
          value={opts.title}
          fontSize={32}
          color={Color4.create(0.96, 0.82, 0.35, 1)}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: 42, margin: { bottom: 4 } }}
        />
        <Label
          value={opts.placeLine}
          fontSize={20}
          color={Color4.White()}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: 28 }}
        />
        {opts.note ? (
          <Label
            value={opts.note}
            fontSize={14}
            color={Color4.create(0.95, 0.72, 0.4, 1)}
            textAlign="middle-center"
            textWrap="wrap"
            uiTransform={{ width: '100%', height: 36 }}
          />
        ) : null}
        <Label
          value={opts.bankLine}
          fontSize={16}
          color={Color4.create(0.8, 0.85, 0.6, 1)}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: 22, margin: { bottom: 6 } }}
        />
        {opts.rows.map((r, i) => (
          <Label
            key={`${r.value}-${i}`}
            value={r.value}
            fontSize={16}
            color={r.color ?? rowColor}
            textAlign="middle-center"
            uiTransform={{ width: '100%', height: 20 }}
          />
        ))}
        {panelBackButton('Go back', opts.onBack)}
      </UiEntity>
    )
  })
}

export function panelBackButton(label: string, onClick: () => void) {
  return (
    <UiEntity
      uiTransform={{
        width: 168,
        height: 52,
        margin: { top: 12 },
        justifyContent: 'center',
        alignItems: 'center',
        pointerFilter: 'block'
      }}
      uiBackground={{
        textureMode: 'stretch',
        texture: { src: 'images/btn-back.png' }
      }}
      onMouseDown={onClick}
    >
      <Label
        value={label}
        fontSize={20}
        color={Color4.create(0.96, 0.82, 0.35, 1)}
        textAlign="middle-center"
        uiTransform={{ width: '100%', height: '100%', pointerFilter: 'none' }}
      />
    </UiEntity>
  )
}
