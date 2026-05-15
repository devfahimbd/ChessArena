import { createServer } from 'http'
import { Server } from 'socket.io'
import { Chess } from 'chess.js'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthenticatedUser {
  userId: string
  username: string
  rating: number
}

interface ActiveGame {
  id: string
  whitePlayer: AuthenticatedUser | null
  blackPlayer: AuthenticatedUser | null
  whiteSocketId: string | null
  blackSocketId: string | null
  chess: Chess
  moves: string[]
  roomId: string | null
  status: 'waiting' | 'playing' | 'finished'
  result: '' | 'white' | 'black' | 'draw'
  resultReason: string
  timeControl: string
  initialTime: number
  whiteTime: number
  blackTime: number
  lastMoveAt: number | null
  timerInterval: ReturnType<typeof setInterval> | null
  spectators: Map<string, AuthenticatedUser>
}

// ─── State ───────────────────────────────────────────────────────────────────

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Active games indexed by game ID
const activeGames = new Map<string, ActiveGame>()

// Room ID → Game ID mapping
const roomMap = new Map<string, string>()

// Matchmaking queue
const matchmakingQueue: AuthenticatedUser[] = []

// Socket ID → User mapping
const socketUsers = new Map<string, AuthenticatedUser>()

// Socket ID → Game ID mapping
const socketGames = new Map<string, string>()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  // Make sure room ID is unique
  if (roomMap.has(result)) return generateRoomId()
  return result
}

function generateGameId(): string {
  return 'game_' + Math.random().toString(36).substr(2, 12)
}

function createNewGame(timeControl: string = '10+0'): ActiveGame {
  // Parse time control: "10+0" → 10 minutes, 0 increment
  const [minutes] = timeControl.split('+').map(Number)
  const initialTime = (minutes || 10) * 60

  return {
    id: generateGameId(),
    whitePlayer: null,
    blackPlayer: null,
    whiteSocketId: null,
    blackSocketId: null,
    chess: new Chess(),
    moves: [],
    roomId: null,
    status: 'waiting',
    result: '',
    resultReason: '',
    timeControl,
    initialTime,
    whiteTime: initialTime,
    blackTime: initialTime,
    lastMoveAt: null,
    timerInterval: null,
    spectators: new Map(),
  }
}

function getGameState(game: ActiveGame) {
  const chess = game.chess
  return {
    gameId: game.id,
    roomId: game.roomId,
    fen: chess.fen(),
    pgn: chess.pgn(),
    moves: game.moves,
    turn: chess.turn(), // 'w' or 'b'
    status: game.status,
    result: game.result,
    resultReason: game.resultReason,
    whitePlayer: game.whitePlayer ? { username: game.whitePlayer.username, rating: game.whitePlayer.rating } : null,
    blackPlayer: game.blackPlayer ? { username: game.blackPlayer.username, rating: game.blackPlayer.rating } : null,
    isCheck: chess.isCheck(),
    isCheckmate: chess.isCheckmate(),
    isStalemate: chess.isStalemate(),
    isDraw: chess.isDraw(),
    isGameOver: chess.isGameOver(),
    whiteTime: game.whiteTime,
    blackTime: game.blackTime,
    timeControl: game.timeControl,
  }
}

function startGameTimer(game: ActiveGame) {
  if (game.timerInterval) clearInterval(game.timerInterval)
  game.lastMoveAt = Date.now()

  game.timerInterval = setInterval(() => {
    if (game.status !== 'playing') {
      if (game.timerInterval) clearInterval(game.timerInterval)
      return
    }

    const elapsed = Math.floor((Date.now() - (game.lastMoveAt || Date.now())) / 1000)

    if (game.chess.turn() === 'w') {
      game.whiteTime = Math.max(0, game.whiteTime - elapsed)
      if (game.whiteTime <= 0) {
        // White loses on time
        game.whiteTime = 0
        endGame(game, 'black', 'timeout')
        return
      }
    } else {
      game.blackTime = Math.max(0, game.blackTime - elapsed)
      if (game.blackTime <= 0) {
        // Black loses on time
        game.blackTime = 0
        endGame(game, 'white', 'timeout')
        return
      }
    }

    // Broadcast time update to both players and spectators
    const state = getGameState(game)
    if (game.whiteSocketId) io.to(game.whiteSocketId).emit('game:time-update', state)
    if (game.blackSocketId) io.to(game.blackSocketId).emit('game:time-update', state)
    for (const [specSocketId] of game.spectators) {
      io.to(specSocketId).emit('game:time-update', state)
    }
  }, 1000)
}

function endGame(game: ActiveGame, result: 'white' | 'black' | 'draw', reason: string) {
  if (game.timerInterval) {
    clearInterval(game.timerInterval)
    game.timerInterval = null
  }

  game.status = 'finished'
  game.result = result
  game.resultReason = reason

  const state = getGameState(game)

  // Notify players
  if (game.whiteSocketId) io.to(game.whiteSocketId).emit('game:ended', state)
  if (game.blackSocketId) io.to(game.blackSocketId).emit('game:ended', state)

  // Notify spectators
  for (const [specSocketId] of game.spectators) {
    io.to(specSocketId).emit('game:ended', state)
  }

  console.log(`Game ${game.id} ended: ${result} by ${reason}`)
}

// ─── Authentication Middleware ───────────────────────────────────────────────

// All events starting with "auth:" require user data
function authenticateSocket(socket: any, data: any): AuthenticatedUser | null {
  if (!data || !data.userId || !data.username) {
    socket.emit('error', { message: 'Authentication required' })
    return null
  }
  const user: AuthenticatedUser = {
    userId: data.userId,
    username: data.username,
    rating: data.rating || 1200,
  }
  socketUsers.set(socket.id, user)
  return user
}

// ─── Socket Event Handlers ───────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`)

  // ─── Matchmaking ─────────────────────────────────────────────

  socket.on('auth:join-queue', (data) => {
    const user = authenticateSocket(socket, data)
    if (!user) return

    // Check if already in queue
    if (matchmakingQueue.some(u => u.userId === user.userId)) {
      socket.emit('queue:joined', { message: 'Already in queue', position: matchmakingQueue.length })
      return
    }

    // Check if already in a game
    if (socketGames.has(socket.id)) {
      socket.emit('error', { message: 'Already in a game' })
      return
    }

    matchmakingQueue.push(user)
    console.log(`[Queue] ${user.username} joined queue (size: ${matchmakingQueue.length})`)

    socket.emit('queue:joined', {
      message: 'Joined matchmaking queue',
      position: matchmakingQueue.length,
    })

    // If two players in queue, create a game
    if (matchmakingQueue.length >= 2) {
      const player1 = matchmakingQueue.shift()!
      const player2 = matchmakingQueue.shift()!

      const game = createNewGame('10+0')
      game.whitePlayer = player1
      game.blackPlayer = player2
      game.status = 'playing'

      // Find sockets for both players
      let p1SocketId: string | null = null
      let p2SocketId: string | null = null
      for (const [sid, u] of socketUsers) {
        if (u.userId === player1.userId) p1SocketId = sid
        if (u.userId === player2.userId) p2SocketId = sid
      }

      game.whiteSocketId = p1SocketId
      game.blackSocketId = p2SocketId

      if (p1SocketId) {
        socketGames.set(p1SocketId, game.id)
        io.to(p1SocketId).emit('queue:match-found', {
          game: getGameState(game),
          color: 'w',
        })
      }
      if (p2SocketId) {
        socketGames.set(p2SocketId, game.id)
        io.to(p2SocketId).emit('queue:match-found', {
          game: getGameState(game),
          color: 'b',
        })
      }

      activeGames.set(game.id, game)
      startGameTimer(game)

      console.log(`[Game] Created ${game.id}: ${player1.username} (W) vs ${player2.username} (B)`)
    }
  })

  socket.on('auth:leave-queue', (data) => {
    const user = authenticateSocket(socket, data)
    if (!user) return

    const idx = matchmakingQueue.findIndex(u => u.userId === user.userId)
    if (idx !== -1) {
      matchmakingQueue.splice(idx, 1)
      socket.emit('queue:left', { message: 'Left queue' })
      console.log(`[Queue] ${user.username} left queue (size: ${matchmakingQueue.length})`)
    }
  })

  // ─── Room System ─────────────────────────────────────────────

  socket.on('auth:create-room', (data) => {
    const user = authenticateSocket(socket, data)
    if (!user) return

    if (socketGames.has(socket.id)) {
      socket.emit('error', { message: 'Already in a game' })
      return
    }

    const roomId = generateRoomId()
    const timeControl = data.timeControl || '10+0'

    const game = createNewGame(timeControl)
    game.roomId = roomId
    game.whitePlayer = user
    game.whiteSocketId = socket.id
    game.status = 'waiting'

    activeGames.set(game.id, game)
    roomMap.set(roomId, game.id)
    socketGames.set(socket.id, game.id)

    socket.emit('room:created', {
      roomId,
      game: getGameState(game),
      color: 'w',
    })

    socket.join(`room-${roomId}`)

    console.log(`[Room] ${user.username} created room ${roomId}`)
  })

  socket.on('auth:join-room', (data) => {
    const user = authenticateSocket(socket, data)
    if (!user) return

    const roomId = (data.roomId || '').toUpperCase().trim()
    const gameId = roomMap.get(roomId)

    if (!gameId) {
      socket.emit('error', { message: 'Room not found' })
      return
    }

    const game = activeGames.get(gameId)!
    if (game.status !== 'waiting') {
      socket.emit('error', { message: 'Game already in progress or finished' })
      return
    }

    // Don't join your own room
    if (game.whitePlayer?.userId === user.userId) {
      socket.emit('error', { message: 'Cannot join your own room' })
      return
    }

    // Assign as black player
    game.blackPlayer = user
    game.blackSocketId = socket.id
    game.status = 'playing'

    socketGames.set(socket.id, game.id)
    socket.join(`room-${roomId}`)

    // Notify both players
    const state = getGameState(game)
    socket.emit('room:joined', {
      roomId,
      game: state,
      color: 'b',
    })

    if (game.whiteSocketId) {
      io.to(game.whiteSocketId).emit('room:game-start', state)
    }

    // Start game timer
    startGameTimer(game)

    console.log(`[Room] ${user.username} joined room ${roomId} as black`)
  })

  socket.on('auth:spectate-room', (data) => {
    const user = authenticateSocket(socket, data)
    if (!user) return

    const roomId = (data.roomId || '').toUpperCase().trim()
    const gameId = roomMap.get(roomId)

    if (!gameId) {
      socket.emit('error', { message: 'Room not found' })
      return
    }

    const game = activeGames.get(gameId)!
    game.spectators.set(socket.id, user)
    socket.join(`room-${roomId}`)

    socket.emit('room:spectating', {
      roomId,
      game: getGameState(game),
    })

    console.log(`[Room] ${user.username} spectating room ${roomId}`)
  })

  socket.on('auth:leave-room', (data) => {
    const user = authenticateSocket(socket, data)
    if (!user) return

    const gameId = socketGames.get(socket.id)
    if (!gameId) return

    const game = activeGames.get(gameId)
    if (!game) return

    // If game hasn't started, clean up the room
    if (game.status === 'waiting' && game.roomId) {
      activeGames.delete(gameId)
      roomMap.delete(game.roomId)
      socketGames.delete(socket.id)
      socket.emit('room:left', { message: 'Room deleted' })
    }
  })

  // ─── Game Moves ──────────────────────────────────────────────

  socket.on('game:move', (data: { move: string; gameId: string }) => {
    const user = socketUsers.get(socket.id)
    if (!user) {
      socket.emit('game:error', { message: 'Not authenticated' })
      return
    }

    const game = activeGames.get(data.gameId)
    if (!game) {
      socket.emit('game:error', { message: 'Game not found' })
      return
    }

    if (game.status !== 'playing') {
      socket.emit('game:error', { message: 'Game is not in progress' })
      return
    }

    // Verify the move is from the correct player
    const isWhite = socket.id === game.whiteSocketId
    const isBlack = socket.id === game.blackSocketId

    if (!isWhite && !isBlack) {
      socket.emit('game:error', { message: 'Not a player in this game' })
      return
    }

    // Verify it's this player's turn
    if ((isWhite && game.chess.turn() !== 'w') || (isBlack && game.chess.turn() !== 'b')) {
      socket.emit('game:error', { message: 'Not your turn' })
      return
    }

    // Validate and make the move using chess.js
    try {
      const moveResult = game.chess.move(data.move, { sloppy: true })

      if (moveResult) {
        game.moves.push(moveResult.san)
        game.lastMoveAt = Date.now()

        const state = getGameState(game)

        // Broadcast move to opponent and spectators
        const opponentSocketId = isWhite ? game.blackSocketId : game.whiteSocketId
        if (opponentSocketId) {
          io.to(opponentSocketId).emit('game:move', {
            ...state,
            lastMove: moveResult.san,
          })
        }

        // Send confirmation to the mover
        socket.emit('game:move-confirmed', {
          ...state,
          lastMove: moveResult.san,
        })

        // Notify spectators
        for (const [specSocketId] of game.spectators) {
          io.to(specSocketId).emit('game:move', {
            ...state,
            lastMove: moveResult.san,
          })
        }

        // Check for game end
        if (game.chess.isGameOver()) {
          if (game.chess.isCheckmate()) {
            const winner = game.chess.turn() === 'w' ? 'black' : 'white'
            endGame(game, winner, 'checkmate')
          } else if (game.chess.isStalemate()) {
            endGame(game, 'draw', 'stalemate')
          } else if (game.chess.isDraw()) {
            endGame(game, 'draw', 'insufficient material')
          } else if (game.chess.isThreefoldRepetition()) {
            endGame(game, 'draw', 'threefold repetition')
          }
        }

        console.log(`[Game] ${game.id}: ${user.username} played ${moveResult.san}`)
      } else {
        socket.emit('game:error', { message: 'Invalid move' })
      }
    } catch (err: any) {
      socket.emit('game:error', { message: err.message || 'Invalid move' })
    }
  })

  // ─── Resign ──────────────────────────────────────────────────

  socket.on('game:resign', (data: { gameId: string }) => {
    const user = socketUsers.get(socket.id)
    if (!user) return

    const game = activeGames.get(data.gameId)
    if (!game || game.status !== 'playing') return

    const isWhite = socket.id === game.whiteSocketId
    const isBlack = socket.id === game.blackSocketId

    if (!isWhite && !isBlack) return

    const winner = isWhite ? 'black' : 'white'
    endGame(game, winner, 'resign')
  })

  // ─── Draw Offer ──────────────────────────────────────────────

  socket.on('game:offer-draw', (data: { gameId: string }) => {
    const user = socketUsers.get(socket.id)
    if (!user) return

    const game = activeGames.get(data.gameId)
    if (!game || game.status !== 'playing') return

    const isWhite = socket.id === game.whiteSocketId
    const opponentSocketId = isWhite ? game.blackSocketId : game.whiteSocketId

    if (opponentSocketId) {
      io.to(opponentSocketId).emit('game:draw-offered', {
        from: user.username,
        gameId: game.id,
      })
    }
  })

  socket.on('game:accept-draw', (data: { gameId: string }) => {
    const game = activeGames.get(data.gameId)
    if (!game || game.status !== 'playing') return

    endGame(game, 'draw', 'agreement')
  })

  socket.on('game:decline-draw', (data: { gameId: string }) => {
    const game = activeGames.get(data.gameId)
    if (!game || game.status !== 'playing') return

    const user = socketUsers.get(socket.id)
    if (!user) return

    const isBlack = socket.id === game.blackSocketId
    const opponentSocketId = isBlack ? game.whiteSocketId : game.blackSocketId

    if (opponentSocketId) {
      io.to(opponentSocketId).emit('game:draw-declined', {
        gameId: game.id,
      })
    }
  })

  // ─── Chat ────────────────────────────────────────────────────

  socket.on('game:chat', (data: { gameId: string; message: string }) => {
    const user = socketUsers.get(socket.id)
    if (!user) return

    const game = activeGames.get(data.gameId)
    if (!game) return

    const chatMsg = {
      username: user.username,
      message: data.message,
      timestamp: new Date().toISOString(),
    }

    // Send to opponent
    if (game.whiteSocketId) io.to(game.whiteSocketId).emit('game:chat', chatMsg)
    if (game.blackSocketId) io.to(game.blackSocketId).emit('game:chat', chatMsg)

    // Send to spectators
    for (const [specSocketId] of game.spectators) {
      io.to(specSocketId).emit('game:chat', chatMsg)
    }
  })

  // ─── Get game state (reconnect) ──────────────────────────────

  socket.on('game:get-state', (data: { gameId: string }) => {
    const game = activeGames.get(data.gameId)
    if (!game) {
      socket.emit('error', { message: 'Game not found' })
      return
    }

    const user = socketUsers.get(socket.id)
    let color: string | null = null

    if (user) {
      if (game.whitePlayer?.userId === user.userId) color = 'w'
      else if (game.blackPlayer?.userId === user.userId) color = 'b'
      else color = 'spectator'
    }

    socket.emit('game:state', {
      ...getGameState(game),
      color,
    })
  })

  // ─── Disconnect ──────────────────────────────────────────────

  socket.on('disconnect', () => {
    const user = socketUsers.get(socket.id)
    console.log(`[Socket] Disconnected: ${socket.id} (${user?.username || 'unknown'})`)

    // Remove from matchmaking queue
    if (user) {
      const idx = matchmakingQueue.findIndex(u => u.userId === user.userId)
      if (idx !== -1) matchmakingQueue.splice(idx, 1)
    }

    // Handle active game disconnect
    const gameId = socketGames.get(socket.id)
    if (gameId) {
      const game = activeGames.get(gameId)
      if (game) {
        // If waiting (room created but no opponent), clean up
        if (game.status === 'waiting') {
          if (game.roomId) roomMap.delete(game.roomId)
          activeGames.delete(gameId)
          console.log(`[Game] Cleaned up waiting game ${gameId}`)
        } else if (game.status === 'playing') {
          // Notify opponent about disconnect
          const isWhite = socket.id === game.whiteSocketId
          const opponentSocketId = isWhite ? game.blackSocketId : game.whiteSocketId

          if (opponentSocketId) {
            io.to(opponentSocketId).emit('game:opponent-disconnected', {
              username: user?.username,
              gameId,
            })
          }

          // End game after a timeout (opponent wins by disconnect)
          // In production, you'd give a reconnect window. For simplicity, we end immediately.
          const winner = isWhite ? 'black' : 'white'
          endGame(game, winner, 'disconnect')

          console.log(`[Game] ${user?.username} disconnected from game ${gameId}`)
        }

        // Remove spectator
        game.spectators.delete(socket.id)
      }
      socketGames.delete(socket.id)
    }

    socketUsers.delete(socket.id)
  })

  socket.on('error', (error) => {
    console.error(`[Socket] Error (${socket.id}):`, error)
  })
})

// ─── Start Server ────────────────────────────────────────────────────────────

const PORT = 3003

httpServer.listen(PORT, () => {
  console.log(`[Chess Server] Running on port ${PORT}`)
  console.log(`[Chess Server] Waiting for connections...`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Chess Server] Shutting down...')
  httpServer.close()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[Chess Server] Shutting down...')
  httpServer.close()
  process.exit(0)
})
