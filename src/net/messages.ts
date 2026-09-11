import { Schemas } from '@dcl/sdk/ecs'
import { registerMessages } from '@dcl/sdk/network'

export const Messages = {
  gmLoadLane: Schemas.Map({ laneId: Schemas.Int, on: Schemas.Boolean }),
  gmLoadAll: Schemas.Map({}),
  gmUnloadAll: Schemas.Map({}),
  gmRestart: Schemas.Map({ laneId: Schemas.Int }),
  gmRestartAll: Schemas.Map({}),
  gmResetGames: Schemas.Map({}),
  gmResetCoins: Schemas.Map({
    scope: Schemas.String,
    address: Schemas.Optional(Schemas.String)
  }),
  gmStartLane: Schemas.Map({ laneId: Schemas.Int }),
  gmStartPreview: Schemas.Map({ laneId: Schemas.Int }),
  gmStartPreviewAll: Schemas.Map({}),
  gmStopLane: Schemas.Map({ laneId: Schemas.Int }),
  gmStopAll: Schemas.Map({}),
  gmStorageResult: Schemas.Map({
    ok: Schemas.Boolean,
    detail: Schemas.String
  }),
  raceLog: Schemas.Map({
    text: Schemas.String
  }),
  laneFall: Schemas.Map({
    laneId: Schemas.Int
  }),
  playerJoinMatch: Schemas.Map({
    laneId: Schemas.Int
  }),
  playerLeaveMatch: Schemas.Map({}),
  lobbyUpdate: Schemas.Map({
    gameId: Schemas.Int,
    laneId: Schemas.Int,
    slot: Schemas.Int,
    count: Schemas.Int,
    max: Schemas.Int,
    min: Schemas.Int,
    lobbyCount: Schemas.Int,
    phase: Schemas.String
  }),
  lobbyLeft: Schemas.Map({}),
  gmSpawnFakes: Schemas.Map({
    count: Schemas.Int,
    startNow: Schemas.Boolean
  }),
  gmAssignFakes: Schemas.Map({
    gameId: Schemas.Int,
    count: Schemas.Int
  }),
  gmClearFakes: Schemas.Map({}),
  gmNewGame: Schemas.Map({
    count: Schemas.Int
  }),
  gmWatchGame: Schemas.Map({
    laneId: Schemas.Int
  }),
  gmUnwatch: Schemas.Map({}),
  gmSetNeedMoreThanOne: Schemas.Map({
    on: Schemas.Boolean
  }),
  joinDenied: Schemas.Map({
    reason: Schemas.String,
    game: Schemas.String
  }),
  matchQueued: Schemas.Map({
    gameId: Schemas.Int,
    laneId: Schemas.Int,
    slot: Schemas.Int,
    max: Schemas.Int,
    phase: Schemas.String
  }),
  gameSnapshot: Schemas.Map({
    gameId: Schemas.Int,
    laneId: Schemas.Int,
    seed: Schemas.Int,
    phase: Schemas.String,
    dropped: Schemas.Int,
    sunk: Schemas.Int,
    obstacles: Schemas.Array(
      Schemas.Map({
        x: Schemas.Int,
        z: Schemas.Int,
        sx: Schemas.Int,
        sy: Schemas.Int,
        sz: Schemas.Int,
        skin: Schemas.Int
      })
    )
  }),
  fakeRoster: Schemas.Map({
    fakes: Schemas.Array(
      Schemas.Map({
        id: Schemas.String,
        name: Schemas.String,
        lane: Schemas.Int,
        x: Schemas.Float,
        y: Schemas.Float,
        z: Schemas.Float,
        slot: Schemas.Int
      })
    )
  }),
  matchPrep: Schemas.Map({
    laneId: Schemas.Int,
    x: Schemas.Float,
    y: Schemas.Float,
    z: Schemas.Float,
    lookX: Schemas.Float,
    lookY: Schemas.Float,
    lookZ: Schemas.Float
  }),
  matchCountdown: Schemas.Map({
    laneId: Schemas.Int,
    count: Schemas.Int
  }),
  matchLayout: Schemas.Map({
    laneId: Schemas.Int,
    seed: Schemas.Int,
    obstacles: Schemas.Array(
      Schemas.Map({
        x: Schemas.Int,
        z: Schemas.Int,
        sx: Schemas.Int,
        sy: Schemas.Int,
        sz: Schemas.Int,
        skin: Schemas.Int
      })
    )
  }),
  rowDrop: Schemas.Map({
    laneId: Schemas.Int,
    index: Schemas.Int
  }),
  rowSunk: Schemas.Map({
    laneId: Schemas.Int,
    index: Schemas.Int
  }),
  laneCleared: Schemas.Map({
    laneId: Schemas.Int,
    gen: Schemas.Int
  }),
  finishDrop: Schemas.Map({
    laneId: Schemas.Int
  }),
  playerPose: Schemas.Map({
    laneId: Schemas.Int,
    x: Schemas.Float,
    y: Schemas.Float,
    z: Schemas.Float
  }),
  matchOver: Schemas.Map({
    laneId: Schemas.Int,
    died: Schemas.Boolean
  }),
  playerFinished: Schemas.Map({
    laneId: Schemas.Int,
    place: Schemas.Int,
    coins: Schemas.Int
  }),
  matchResults: Schemas.Map({
    laneId: Schemas.Int,
    youPlace: Schemas.Int,
    youCoins: Schemas.Int,
    youTotal: Schemas.Int,
    youWins: Schemas.Int,
    rows: Schemas.Array(
      Schemas.Map({
        name: Schemas.String,
        place: Schemas.Int,
        state: Schemas.String,
        coins: Schemas.Int
      })
    )
  }),
  myStats: Schemas.Map({
    coins: Schemas.Int,
    wins: Schemas.Int
  }),
  leaderboard: Schemas.Map({
    rows: Schemas.Array(
      Schemas.Map({
        address: Schemas.String,
        name: Schemas.String,
        coins: Schemas.Int,
        wins: Schemas.Int
      })
    )
  }),
  playerJoinLoot: Schemas.Map({}),
  playerLeaveLoot: Schemas.Map({}),
  lootLobbyUpdate: Schemas.Map({
    gameId: Schemas.Int,
    slot: Schemas.Int,
    count: Schemas.Int,
    max: Schemas.Int,
    min: Schemas.Int,
    lobbyCount: Schemas.Int,
    phase: Schemas.String
  }),
  lootLeft: Schemas.Map({}),
  lootPrep: Schemas.Map({
    slot: Schemas.Int,
    x: Schemas.Float,
    y: Schemas.Float,
    z: Schemas.Float,
    lookX: Schemas.Float,
    lookY: Schemas.Float,
    lookZ: Schemas.Float
  }),
  lootCountdown: Schemas.Map({
    count: Schemas.Int
  }),
  lootGo: Schemas.Map({
    remain: Schemas.Int,
    coins: Schemas.Array(
      Schemas.Map({
        id: Schemas.Int,
        x: Schemas.Float,
        z: Schemas.Float
      })
    )
  }),
  lootGrab: Schemas.Map({
    id: Schemas.Int
  }),
  lootBank: Schemas.Map({}),
  lootTaken: Schemas.Map({
    id: Schemas.Int,
    address: Schemas.String,
    held: Schemas.Int
  }),
  lootGone: Schemas.Map({
    id: Schemas.Int
  }),
  lootSpawn: Schemas.Map({
    id: Schemas.Int,
    x: Schemas.Float,
    z: Schemas.Float
  }),
  lootScore: Schemas.Map({
    held: Schemas.Int,
    stashed: Schemas.Int,
    remain: Schemas.Int
  }),
  lootRoster: Schemas.Map({
    addresses: Schemas.Array(Schemas.String)
  }),
  lootShark: Schemas.Map({
    id: Schemas.Int,
    y: Schemas.Float,
    ms: Schemas.Int,
    points: Schemas.Array(
      Schemas.Map({
        x: Schemas.Float,
        z: Schemas.Float
      })
    )
  }),
  lootSharkBite: Schemas.Map({
    id: Schemas.Int,
    x: Schemas.Float,
    z: Schemas.Float
  }),
  lootSharkHit: Schemas.Map({
    id: Schemas.Int,
    address: Schemas.String,
    x: Schemas.Float,
    z: Schemas.Float,
    held: Schemas.Int
  }),
  lootCarry: Schemas.Map({
    address: Schemas.String,
    held: Schemas.Int
  }),
  lootBanked: Schemas.Map({
    address: Schemas.String,
    slot: Schemas.Int,
    amount: Schemas.Int
  }),
  lootTick: Schemas.Map({
    remain: Schemas.Int,
    rows: Schemas.Array(
      Schemas.Map({
        name: Schemas.String,
        held: Schemas.Int,
        stashed: Schemas.Int
      })
    )
  }),
  playerJoinCannon: Schemas.Map({}),
  playerLeaveCannon: Schemas.Map({}),
  cannonLobbyUpdate: Schemas.Map({
    gameId: Schemas.Int,
    slot: Schemas.Int,
    count: Schemas.Int,
    max: Schemas.Int,
    min: Schemas.Int,
    lobbyCount: Schemas.Int,
    phase: Schemas.String
  }),
  cannonLeft: Schemas.Map({}),
  cannonPrep: Schemas.Map({
    slot: Schemas.Int,
    x: Schemas.Float,
    y: Schemas.Float,
    z: Schemas.Float,
    lookX: Schemas.Float,
    lookY: Schemas.Float,
    lookZ: Schemas.Float
  }),
  cannonCountdown: Schemas.Map({
    count: Schemas.Int
  }),
  cannonGo: Schemas.Map({
    remain: Schemas.Int
  }),
  cannonTick: Schemas.Map({
    remain: Schemas.Int,
    rows: Schemas.Array(
      Schemas.Map({
        name: Schemas.String,
        hits: Schemas.Int
      })
    )
  }),
  cannonFire: Schemas.Map({
    pitch: Schemas.Float,
    yaw: Schemas.Float
  }),
  cannonShot: Schemas.Map({
    id: Schemas.Int,
    address: Schemas.String,
    x: Schemas.Float,
    y: Schemas.Float,
    z: Schemas.Float,
    vx: Schemas.Float,
    vy: Schemas.Float,
    vz: Schemas.Float
  }),
  cannonShip: Schemas.Map({
    id: Schemas.Int,
    x: Schemas.Float,
    y: Schemas.Float,
    z: Schemas.Float,
    dir: Schemas.Float,
    speed: Schemas.Float,
    scale: Schemas.Float
  }),
  cannonSunk: Schemas.Map({
    id: Schemas.Int,
    address: Schemas.String,
    hits: Schemas.Int,
    coins: Schemas.Int,
    x: Schemas.Float,
    y: Schemas.Float,
    z: Schemas.Float
  }),
  cannonGone: Schemas.Map({
    id: Schemas.Int
  }),
  cannonSplash: Schemas.Map({
    x: Schemas.Float,
    y: Schemas.Float,
    z: Schemas.Float
  }),
  fishClaim: Schemas.Map({
    slot: Schemas.Int
  }),
  fishLeave: Schemas.Map({}),
  fishAskHoles: Schemas.Map({}),
  fishHoles: Schemas.Map({
    rows: Schemas.Array(
      Schemas.Map({
        slot: Schemas.Int,
        address: Schemas.String,
        depth: Schemas.Float,
        hooked: Schemas.Boolean,
        kind: Schemas.String,
        along: Schemas.Float,
        fishDepth: Schemas.Float,
        out: Schemas.Float
      })
    )
  }),
  fishLine: Schemas.Map({
    depth: Schemas.Float
  }),
  fishLineState: Schemas.Map({
    slot: Schemas.Int,
    address: Schemas.String,
    depth: Schemas.Float,
    hooked: Schemas.Boolean,
    kind: Schemas.String,
    along: Schemas.Float,
    fishDepth: Schemas.Float,
    out: Schemas.Float
  }),
  fishSchool: Schemas.Map({
    fish: Schemas.Array(
      Schemas.Map({
        id: Schemas.Int,
        kind: Schemas.String,
        along0: Schemas.Float,
        along1: Schemas.Float,
        depth: Schemas.Float,
        out: Schemas.Float,
        dir: Schemas.Int,
        dur: Schemas.Float
      })
    )
  }),
  fishPath: Schemas.Map({
    id: Schemas.Int,
    kind: Schemas.String,
    along0: Schemas.Float,
    along1: Schemas.Float,
    depth: Schemas.Float,
    out: Schemas.Float,
    dir: Schemas.Int,
    dur: Schemas.Float
  }),
  fishHook: Schemas.Map({}),
  fishOn: Schemas.Map({
    id: Schemas.Int,
    kind: Schemas.String
  }),
  fishMiss: Schemas.Map({}),
  fishFight: Schemas.Map({
    hold: Schemas.Boolean
  }),
  fishFightState: Schemas.Map({
    tension: Schemas.Float,
    fightLeft: Schemas.Float,
    along: Schemas.Float,
    fishDepth: Schemas.Float,
    out: Schemas.Float
  }),
  fishSnap: Schemas.Map({}),
  fishLanded: Schemas.Map({
    fish: Schemas.String,
    image: Schemas.String,
    coins: Schemas.Int
  }),
  fishHooked: Schemas.Map({
    id: Schemas.Int
  }),
  fishUnhook: Schemas.Map({
    id: Schemas.Int
  }),
  fishClaimed: Schemas.Map({
    slot: Schemas.Int
  }),
  fishHoleDenied: Schemas.Map({
    reason: Schemas.String
  }),
  fishCatch: Schemas.Map({
    name: Schemas.String,
    fish: Schemas.String,
    image: Schemas.String
  }),
  fishCatchToast: Schemas.Map({
    name: Schemas.String,
    fish: Schemas.String,
    image: Schemas.String
  }),
  playerAskStats: Schemas.Map({}),
  tutorialOffer: Schemas.Map({
    show: Schemas.Boolean,
    force: Schemas.Boolean
  }),
  tutorialDone: Schemas.Map({}),
  gmSetTutorialForce: Schemas.Map({
    on: Schemas.Boolean
  }),
  gmClearTutorial: Schemas.Map({
    scope: Schemas.String,
    address: Schemas.Optional(Schemas.String)
  }),
  gmBumpObstacles: Schemas.Map({
    delta: Schemas.Int
  }),
  gmFakeCatch: Schemas.Map({}),
  gmSetMobileOnly: Schemas.Map({
    on: Schemas.Boolean
  }),
  mobileOnlyState: Schemas.Map({
    on: Schemas.Boolean
  }),
  gmListPlayers: Schemas.Map({}),
  gmPlayerList: Schemas.Map({
    rows: Schemas.Array(
      Schemas.Map({
        address: Schemas.String,
        name: Schemas.String,
        coins: Schemas.Int,
        wins: Schemas.Int
      })
    ),
    snaps: Schemas.Array(
      Schemas.Map({
        at: Schemas.Int,
        count: Schemas.Int
      })
    )
  }),
  gmResetPlayer: Schemas.Map({ address: Schemas.String }),
  gmDeletePlayer: Schemas.Map({ address: Schemas.String }),
  gmListBoard: Schemas.Map({}),
  gmBoardList: Schemas.Map({
    rows: Schemas.Array(
      Schemas.Map({
        address: Schemas.String,
        name: Schemas.String,
        coins: Schemas.Int,
        wins: Schemas.Int
      })
    ),
    snaps: Schemas.Array(
      Schemas.Map({
        at: Schemas.Int,
        count: Schemas.Int
      })
    )
  }),
  gmResetBoard: Schemas.Map({}),
  gmSnapPlayers: Schemas.Map({}),
  gmSnapBoard: Schemas.Map({}),
  gmViewSnap: Schemas.Map({
    kind: Schemas.String,
    at: Schemas.Int
  }),
  gmSnapData: Schemas.Map({
    kind: Schemas.String,
    at: Schemas.Int,
    rows: Schemas.Array(
      Schemas.Map({
        address: Schemas.String,
        name: Schemas.String,
        coins: Schemas.Int,
        wins: Schemas.Int
      })
    )
  })
}

export const room = registerMessages(Messages)

export function broadcastLeaderboard(
  rows: Array<{ address: string; name: string; coins: number; wins: number }>
): void {
  room.send('leaderboard', {
    rows: rows
      .filter((r) => r.coins >= 1)
      .slice(0, 10)
      .map((r) => ({
      address: r.address,
      name: r.name,
      coins: r.coins,
      wins: r.wins
    }))
  })
}
