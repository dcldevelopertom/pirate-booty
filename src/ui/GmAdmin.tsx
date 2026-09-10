import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Button, Input, Label, UiEntity } from '@dcl/sdk/react-ecs'
import { room } from '../net/messages'

type Row = { address: string; name: string; coins: number; wins: number }
type Snap = { at: number; count: number }

type Panel = 'none' | 'players' | 'board'

let panel: Panel = 'none'
let query = ''
let playerRows: Row[] = []
let boardRows: Row[] = []
let playerSnaps: Snap[] = []
let boardSnaps: Snap[] = []
let viewingSnap: { kind: string; at: number; rows: Row[] } | null = null
let confirmDelete = ''

export function setupGmAdmin(): void {
  room.onMessage('gmPlayerList', (data) => {
    playerRows = data.rows
    playerSnaps = data.snaps
    if (viewingSnap?.kind === 'players') viewingSnap = null
  })
  room.onMessage('gmBoardList', (data) => {
    boardRows = data.rows
    boardSnaps = data.snaps
    if (viewingSnap?.kind === 'board') viewingSnap = null
  })
  room.onMessage('gmSnapData', (data) => {
    viewingSnap = { kind: data.kind, at: data.at, rows: data.rows }
  })
}

export function openPlayers(): void {
  panel = 'players'
  viewingSnap = null
  query = ''
  confirmDelete = ''
  room.send('gmListPlayers', {})
}

export function openBoard(): void {
  panel = 'board'
  viewingSnap = null
  query = ''
  room.send('gmListBoard', {})
}

export function gmAdminUi() {
  if (panel === 'none') return null
  if (panel === 'players') return playersPanel()
  return boardPanel()
}

function playersPanel() {
  const live = viewingSnap?.kind === 'players' ? viewingSnap.rows : playerRows
  const q = query.trim().toLowerCase()
  const rows = q
    ? live.filter((r) => r.name.toLowerCase().includes(q) || r.address.toLowerCase().includes(q))
    : live
  return centered('PLAYERS', () => {
    panel = 'none'
  }, (
    <UiEntity uiTransform={{ width: '100%', flexGrow: 1, flexDirection: 'column' }}>
      <Input
        placeholder="search name or wallet"
        value={query}
        onChange={(v) => {
          query = v
        }}
        fontSize={14}
        uiTransform={{ width: '100%', height: 36, margin: { bottom: 8 } }}
        uiBackground={{ color: Color4.create(0.12, 0.1, 0.08, 1) }}
        color={Color4.White()}
        placeholderColor={Color4.create(0.6, 0.55, 0.45, 1)}
      />
      {rowBtns([
        { label: 'Save snapshot', onClick: () => room.send('gmSnapPlayers', {}) },
        {
          label: viewingSnap ? 'Show live' : 'Live',
          onClick: () => {
            viewingSnap = null
            room.send('gmListPlayers', {})
          }
        }
      ])}
      <UiEntity
        uiTransform={{
          width: '100%',
          height: 280,
          flexDirection: 'column',
          overflow: 'scroll',
          margin: { top: 8 }
        }}
      >
        {rows.length === 0 ? (
          <Label value="no players stored yet" fontSize={14} color={Color4.create(0.7, 0.65, 0.55, 1)} uiTransform={{ height: 24, width: '100%' }} />
        ) : (
          rows.map((r) => playerRow(r, !!viewingSnap))
        )}
      </UiEntity>
      <Label value="SNAPSHOTS" fontSize={12} color={Color4.White()} uiTransform={{ height: 20, margin: { top: 8 }, width: '100%' }} />
      <UiEntity uiTransform={{ width: '100%', height: 80, flexDirection: 'column', overflow: 'scroll' }}>
        {playerSnaps.length === 0 ? (
          <Label value="none" fontSize={12} color={Color4.create(0.7, 0.65, 0.55, 1)} uiTransform={{ height: 18, width: '100%' }} />
        ) : (
          playerSnaps.map((s) => (
            <Button
              value={`${fmt(s.at)}  ·  ${s.count} players`}
              variant="secondary"
              uiTransform={{ width: '100%', height: 26, margin: { top: 2 } }}
              onMouseDown={() => room.send('gmViewSnap', { kind: 'players', at: s.at })}
            />
          ))
        )}
      </UiEntity>
    </UiEntity>
  ))
}

function boardPanel() {
  const live = viewingSnap?.kind === 'board' ? viewingSnap.rows : boardRows
  return centered('LEADERBOARD', () => {
    panel = 'none'
  }, (
    <UiEntity uiTransform={{ width: '100%', flexGrow: 1, flexDirection: 'column' }}>
      {rowBtns([
        { label: 'Save snapshot', onClick: () => room.send('gmSnapBoard', {}) },
        { label: 'Reset board', onClick: () => room.send('gmResetBoard', {}) },
        {
          label: viewingSnap ? 'Show live' : 'Live',
          onClick: () => {
            viewingSnap = null
            room.send('gmListBoard', {})
          }
        }
      ])}
      <UiEntity
        uiTransform={{
          width: '100%',
          height: 300,
          flexDirection: 'column',
          overflow: 'scroll',
          margin: { top: 8 }
        }}
      >
        {live.length === 0 ? (
          <Label value="leaderboard empty" fontSize={14} color={Color4.create(0.7, 0.65, 0.55, 1)} uiTransform={{ height: 24, width: '100%' }} />
        ) : (
          live.map((r, i) => (
            <Label
              value={`${i + 1}.  ${r.name}   ${r.wins} wins   ${r.coins} coins`}
              fontSize={14}
              color={Color4.White()}
              uiTransform={{ width: '100%', height: 24, margin: { top: 2 } }}
            />
          ))
        )}
      </UiEntity>
      <Label value="SNAPSHOTS" fontSize={12} color={Color4.White()} uiTransform={{ height: 20, margin: { top: 8 }, width: '100%' }} />
      <UiEntity uiTransform={{ width: '100%', height: 80, flexDirection: 'column', overflow: 'scroll' }}>
        {boardSnaps.length === 0 ? (
          <Label value="none" fontSize={12} color={Color4.create(0.7, 0.65, 0.55, 1)} uiTransform={{ height: 18, width: '100%' }} />
        ) : (
          boardSnaps.map((s) => (
            <Button
              value={`${fmt(s.at)}  ·  ${s.count} rows`}
              variant="secondary"
              uiTransform={{ width: '100%', height: 26, margin: { top: 2 } }}
              onMouseDown={() => room.send('gmViewSnap', { kind: 'board', at: s.at })}
            />
          ))
        )}
      </UiEntity>
    </UiEntity>
  ))
}

function playerRow(r: Row, readOnly: boolean) {
  const del = confirmDelete === r.address
  return (
    <UiEntity uiTransform={{ width: '100%', height: 52, flexDirection: 'column', margin: { top: 4 } }}>
      <Label
        value={`${r.name}   ${r.address.slice(0, 8)}…   coins ${r.coins}   wins ${r.wins}`}
        fontSize={13}
        color={Color4.White()}
        uiTransform={{ width: '100%', height: 20 }}
      />
      {readOnly ? null : (
        <UiEntity uiTransform={{ width: '100%', height: 30, flexDirection: 'row' }}>
          <Button
            value="Reset"
            variant="secondary"
            uiTransform={{ width: '48%', height: 28, margin: { right: 4 } }}
            onMouseDown={() => room.send('gmResetPlayer', { address: r.address })}
          />
          <Button
            value={del ? 'Confirm delete' : 'Delete'}
            variant="secondary"
            uiTransform={{ width: '48%', height: 28 }}
            onMouseDown={() => {
              if (!del) {
                confirmDelete = r.address
                return
              }
              confirmDelete = ''
              room.send('gmDeletePlayer', { address: r.address })
            }}
          />
        </UiEntity>
      )}
    </UiEntity>
  )
}

function centered(title: string, onClose: () => void, body: ReactEcs.JSX.Element) {
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20
      }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.45) }}
    >
      <UiEntity
        uiTransform={{
          width: 560,
          height: 560,
          flexDirection: 'column',
          padding: 16
        }}
        uiBackground={{ color: Color4.create(0.07, 0.05, 0.03, 0.97) }}
      >
        <UiEntity uiTransform={{ width: '100%', height: 36, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Label value={title} fontSize={18} color={Color4.create(0.96, 0.9, 0.78, 1)} uiTransform={{ height: 32, width: 300 }} />
          <Button value="Close" variant="secondary" uiTransform={{ width: 80, height: 32 }} onMouseDown={onClose} />
        </UiEntity>
        {body}
      </UiEntity>
    </UiEntity>
  )
}

function rowBtns(items: Array<{ label: string; onClick: () => void }>) {
  return (
    <UiEntity uiTransform={{ width: '100%', height: 34, flexDirection: 'row', margin: { top: 4 } }}>
      {items.map((item) => (
        <Button
          value={item.label}
          variant="secondary"
          uiTransform={{ width: `${100 / items.length}%`, height: 32, margin: { right: 4 } }}
          onMouseDown={item.onClick}
        />
      ))}
    </UiEntity>
  )
}

function fmt(at: number): string {
  const d = new Date(at * 1000)
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
