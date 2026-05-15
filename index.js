/**
 * ChessArena Combined Server (API + Socket.io)
 *
 * Deploy: Koyeb (Free, No Sleep!)
 * - REST API (Express + Prisma + MySQL)
 * - Real-time Socket.io (Chess game logic)
 * Ekta port e duita mile jay!
 */

import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { z } from 'zod'
import { Chess } from 'chess.js'

// ─── Init ──────────────────────────────────────────────────────

const app = express()
const httpServer = createServer(app)
const prisma = new PrismaClient()

// ─── Socket.io Setup ───────────────────────────────────────────

const io = new Server(httpServer, {
  path: '/socket.io',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ─── Express Middleware ─────────────────────────────────────────

app.use(express.json())

// CORS
app.use((req, res, next) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
  const allowedOrigins = [
    frontendUrl,
    // Vercel preview URLs keo allow koro
    'https://chess-arena.vercel.app',
    'https://chess-arena-git-*.vercel.app',
  ]
  const origin = req.headers.origin || ''

  // Wildcard match for preview URLs
  const isAllowed = allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      const pattern = allowed.replace('*', '.*')
      return new RegExp(pattern).test(origin)
    }
    return allowed === origin
  })

  if (isAllowed || process.env.NODE_ENV !== 'production') {
    res.header('Access-Control-Allow-Origin', origin || '*')
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// ─── JWT Helpers ───────────────────────────────────────────────

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-secret-change-me'
)

async function signToken(payload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload
  } catch {
    return null
  }
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const token = authHeader.split(' ')[1]
  const payload = await verifyToken(token)
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
  req.user = payload
  next()
}

// ─── ELO Calculation ───────────────────────────────────────────

function calculateElo(playerRating, opponentRating, result) {
  const K = 32
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400))
  const actualScore = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0
  return Math.round(playerRating + K * (actualScore - expectedScore))
}

// ═══════════════════════════════════════════════════════════════
//  REST API ROUTES
// ═══════════════════════════════════════════════════════════════

// ─── Auth Routes ───────────────────────────────────────────────

const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(6).max(100),
})

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = registerSchema.parse(req.body)

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    })
    if (existingUser) {
      return res.status(409).json({
        error: existingUser.email === email ? 'Email already registered' : 'Username already taken'
      })
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { username, email, password: hashedPassword, rating: 1200 },
    })

    const token = await signToken({
      userId: user.id, username: user.username, email: user.email, rating: user.rating,
    })

    res.json({
      message: 'Registration successful',
      token,
      user: { id: user.id, username: user.username, email: user.email, rating: user.rating },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors })
    }
    console.error('Register error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    await prisma.user.update({ where: { id: user.id }, data: { isOnline: true } })

    const token = await signToken({
      userId: user.id, username: user.username, email: user.email, rating: user.rating,
    })

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id, username: user.username, email: user.email, rating: user.rating,
        gamesPlayed: user.gamesPlayed, wins: user.wins, losses: user.losses, draws: user.draws,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = req.user
  res.json({ user: { id: user.userId, username: user.username, email: user.email, rating: user.rating } })
})

// ─── Game Routes ───────────────────────────────────────────────

// GET /api/games
app.get('/api/games', requireAuth, async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      where: {
        OR: [
          { whitePlayerId: req.user.userId },
          { blackPlayerId: req.user.userId },
        ],
      },
      include: {
        whitePlayer: { select: { id: true, username: true, rating: true } },
        blackPlayer: { select: { id: true, username: true, rating: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    res.json({
      games: games.map(g => ({ ...g, moves: JSON.parse(g.moves) }))
    })
  } catch (error) {
    console.error('Games fetch error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/games/:id
app.get('/api/games/:id', requireAuth, async (req, res) => {
  try {
    const game = await prisma.game.findUnique({
      where: { id: req.params.id },
      include: {
        whitePlayer: { select: { id: true, username: true, rating: true } },
        blackPlayer: { select: { id: true, username: true, rating: true } },
      },
    })
    if (!game) return res.status(404).json({ error: 'Game not found' })
    res.json({ game: { ...game, moves: JSON.parse(game.moves) } })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/games/end
const endGameSchema = z.object({
  gameId: z.string(),
  result: z.enum(['white', 'black', 'draw']),
  resultReason: z.string(),
  whitePlayerId: z.string(),
  blackPlayerId: z.string(),
  moves: z.array(z.string()),
  pgn: z.string().optional(),
})

app.post('/api/games/end', requireAuth, async (req, res) => {
  try {
    const data = endGameSchema.parse(req.body)

    const [whitePlayer, blackPlayer] = await Promise.all([
      prisma.user.findUnique({ where: { id: data.whitePlayerId } }),
      prisma.user.findUnique({ where: { id: data.blackPlayerId } }),
    ])
    if (!whitePlayer || !blackPlayer) {
      return res.status(404).json({ error: 'Player not found' })
    }

    const whiteResult = data.result === 'white' ? 'win' : data.result === 'black' ? 'loss' : 'draw'
    const blackResult = data.result === 'black' ? 'win' : data.result === 'white' ? 'loss' : 'draw'

    const newWhiteRating = calculateElo(whitePlayer.rating, blackPlayer.rating, whiteResult)
    const newBlackRating = calculateElo(blackPlayer.rating, whitePlayer.rating, blackResult)

    await Promise.all([
      prisma.user.update({
        where: { id: data.whitePlayerId },
        data: {
          rating: newWhiteRating,
          gamesPlayed: { increment: 1 },
          wins: whiteResult === 'win' ? { increment: 1 } : undefined,
          losses: whiteResult === 'loss' ? { increment: 1 } : undefined,
          draws: whiteResult === 'draw' ? { increment: 1 } : undefined,
        },
      }),
      prisma.user.update({
        where: { id: data.blackPlayerId },
        data: {
          rating: newBlackRating,
          gamesPlayed: { increment: 1 },
          wins: blackResult === 'win' ? { increment: 1 } : undefined,
          losses: blackResult === 'loss' ? { increment: 1 } : undefined,
          draws: blackResult === 'draw' ? { increment: 1 } : undefined,
        },
      }),
    ])

    const existingGame = await prisma.game.findUnique({ where: { id: data.gameId } })
    if (existingGame) {
      await prisma.game.update({
        where: { id: data.gameId },
        data: {
          status: 'finished', result: data.result, resultReason: data.resultReason,
          moves: JSON.stringify(data.moves), pgn: data.pgn || '', endedAt: new Date(),
        },
      })
    } else {
      await prisma.game.create({
        data: {
          id: data.gameId, whitePlayerId: data.whitePlayerId, blackPlayerId: data.blackPlayerId,
          status: 'finished', result: data.result, resultReason: data.resultReason,
          moves: JSON.stringify(data.moves), pgn: data.pgn || '', endedAt: new Date(),
        },
      })
    }

    res.json({ message: 'Game result recorded', whiteRating: newWhiteRating, blackRating: newBlackRating })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error' })
    }
    console.error('End game error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── Leaderboard ───────────────────────────────────────────────

app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = await prisma.user.findMany({
      orderBy: { rating: 'desc' },
      select: { id: true, username: true, rating: true, gamesPlayed: true, wins: true, losses: true, draws: true },
      take: 20,
    })
    res.json({ leaderboard })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── Health Check ──────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ═══════════════════════════════════════════════════════════════
//  SOCKET.IO - REAL-TIME CHESS GAME
// ═══════════════════════════════════════════════════════════════

// ─── Types ─────────────────────────────────────────────────────

// ─── State ─────────────────────────────────────────────────────

const activeGames = new Map()
const roomMap = new Map()
const matchmakingQueue = []
const socketUsers = new Map()
const socketGames = new Map()

// ─── Helpers ───────────────────────────────────────────────────

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  if (roomMap.has(result)) return generateRoomId()
  return result
}

function generateGameId() {
  return 'game_' + Math.random().toString(36).substr(2, 12)
}

function createNewGame(timeControl = '10+0') {
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

function getGameState(game) {
  const chess = game.chess
  return {
    gameId: game.id,
    roomId: game.roomId,
    fen: chess.fen(),
    pgn: chess.pgn(),
    moves: game.moves,
    turn: chess.turn(),
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

function startGameTimer(game) {
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
        game.whiteTime = 0
        endGame(game, 'black', 'timeout')
        return
      }
    } else {
      game.blackTime = Math.max(0, game.blackTime - elapsed)
      if (game.blackTime <= 0) {
        game.blackTime = 0
        endGame(game, 'white', 'timeout')
        return
      }
    }

    const state = getGameState(game)
    if (game.whiteSocketId) io.to(game.whiteSocketId).emit('game:time-update', state)
    if (game.blackSocketId) io.to(game.blackSocketId).emit('game:time-update', state)
    for (const [specSocketId] of game.spectators) {
      io.to(specSocketId).emit('game:time-update', state)
    }
  }, 1000)
}

function endGame(game, result, reason) {
  if (game.timerInterval) {
    clearInterval(game.timerInterval)
    game.timerInterval = null
  }

  game.status = 'finished'
  game.result = result
  game.resultReason = reason

  const state = getGameState(game)

  if (game.whiteSocketId) io.to(game.whiteSocketId).emit('game:ended', state)
  if (game.blackSocketId) io.to(game.blackSocketId).emit('game:ended', state)

  for (const [specSocketId] of game.spectators) {
    io.to(specSocketId).emit('game:ended', state)
  }

  console.log(`Game ${game.id} ended: ${result} by ${reason}`)
}

// ─── Socket Auth ───────────────────────────────────────────────

function authenticateSocket(socket, data) {
  if (!data || !data.userId || !data.username) {
    socket.emit('error', { message: 'Authentication required' })
    return null
  }
  const user = {
    userId: data.userId,
    username: data.username,
    rating: data.rating || 1200,
  }
  socketUsers.set(socket.id, user)
  return user
}

// ─── Socket Event Handlers ─────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`)

  // ─── Matchmaking ─────────────────────────────────────────────

  socket.on('auth:join-queue', (data) => {
    const user = authenticateSocket(socket, data)
    if (!user) return

    if (matchmakingQueue.some(u => u.userId === user.userId)) {
      socket.emit('queue:joined', { message: 'Already in queue', position: matchmakingQueue.length })
      return
    }

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

    if (matchmakingQueue.length >= 2) {
      const player1 = matchmakingQueue.shift()
      const player2 = matchmakingQueue.shift()

      const game = createNewGame('10+0')
      game.whitePlayer = player1
      game.blackPlayer = player2
      game.status = 'playing'

      let p1SocketId = null
      let p2SocketId = null
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

    const game = activeGames.get(gameId)
    if (game.status !== 'waiting') {
      socket.emit('error', { message: 'Game already in progress or finished' })
      return
    }

    if (game.whitePlayer?.userId === user.userId) {
      socket.emit('error', { message: 'Cannot join your own room' })
      return
    }

    game.blackPlayer = user
    game.blackSocketId = socket.id
    game.status = 'playing'

    socketGames.set(socket.id, game.id)
    socket.join(`room-${roomId}`)

    const state = getGameState(game)
    socket.emit('room:joined', {
      roomId,
      game: state,
      color: 'b',
    })

    if (game.whiteSocketId) {
      io.to(game.whiteSocketId).emit('room:game-start', state)
    }

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

    const game = activeGames.get(gameId)
    game.spectators.set(socket.id, user)
    socket.join(`room-${roomId}`)

    socket.emit('room:spectating', {
      roomId,
      game: getGameState(game),
    })
  })

  socket.on('auth:leave-room', (data) => {
    const user = authenticateSocket(socket, data)
    if (!user) return

    const gameId = socketGames.get(socket.id)
    if (!gameId) return

    const game = activeGames.get(gameId)
    if (!game) return

    if (game.status === 'waiting' && game.roomId) {
      activeGames.delete(gameId)
      roomMap.delete(game.roomId)
      socketGames.delete(socket.id)
      socket.emit('room:left', { message: 'Room deleted' })
    }
  })

  // ─── Game Moves ──────────────────────────────────────────────

  socket.on('game:move', (data) => {
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

    const isWhite = socket.id === game.whiteSocketId
    const isBlack = socket.id === game.blackSocketId

    if (!isWhite && !isBlack) {
      socket.emit('game:error', { message: 'Not a player in this game' })
      return
    }

    if ((isWhite && game.chess.turn() !== 'w') || (isBlack && game.chess.turn() !== 'b')) {
      socket.emit('game:error', { message: 'Not your turn' })
      return
    }

    try {
      const moveResult = game.chess.move(data.move, { sloppy: true })

      if (moveResult) {
        game.moves.push(moveResult.san)
        game.lastMoveAt = Date.now()

        const state = getGameState(game)

        const opponentSocketId = isWhite ? game.blackSocketId : game.whiteSocketId
        if (opponentSocketId) {
          io.to(opponentSocketId).emit('game:move', {
            ...state,
            lastMove: moveResult.san,
          })
        }

        socket.emit('game:move-confirmed', {
          ...state,
          lastMove: moveResult.san,
        })

        for (const [specSocketId] of game.spectators) {
          io.to(specSocketId).emit('game:move', {
            ...state,
            lastMove: moveResult.san,
          })
        }

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
    } catch (err) {
      socket.emit('game:error', { message: err.message || 'Invalid move' })
    }
  })

  // ─── Resign ──────────────────────────────────────────────────

  socket.on('game:resign', (data) => {
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

  socket.on('game:offer-draw', (data) => {
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

  socket.on('game:accept-draw', (data) => {
    const game = activeGames.get(data.gameId)
    if (!game || game.status !== 'playing') return
    endGame(game, 'draw', 'agreement')
  })

  socket.on('game:decline-draw', (data) => {
    const game = activeGames.get(data.gameId)
    if (!game || game.status !== 'playing') return

    const user = socketUsers.get(socket.id)
    if (!user) return

    const isBlack = socket.id === game.blackSocketId
    const opponentSocketId = isBlack ? game.whiteSocketId : game.blackSocketId

    if (opponentSocketId) {
      io.to(opponentSocketId).emit('game:draw-declined', { gameId: game.id })
    }
  })

  // ─── Chat ────────────────────────────────────────────────────

  socket.on('game:chat', (data) => {
    const user = socketUsers.get(socket.id)
    if (!user) return

    const game = activeGames.get(data.gameId)
    if (!game) return

    const chatMsg = {
      username: user.username,
      message: data.message,
      timestamp: new Date().toISOString(),
    }

    if (game.whiteSocketId) io.to(game.whiteSocketId).emit('game:chat', chatMsg)
    if (game.blackSocketId) io.to(game.blackSocketId).emit('game:chat', chatMsg)

    for (const [specSocketId] of game.spectators) {
      io.to(specSocketId).emit('game:chat', chatMsg)
    }
  })

  // ─── Reconnect ───────────────────────────────────────────────

  socket.on('game:get-state', (data) => {
    const game = activeGames.get(data.gameId)
    if (!game) {
      socket.emit('error', { message: 'Game not found' })
      return
    }

    const user = socketUsers.get(socket.id)
    let color = null

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

    if (user) {
      const idx = matchmakingQueue.findIndex(u => u.userId === user.userId)
      if (idx !== -1) matchmakingQueue.splice(idx, 1)
    }

    const gameId = socketGames.get(socket.id)
    if (gameId) {
      const game = activeGames.get(gameId)
      if (game) {
        if (game.status === 'waiting') {
          if (game.roomId) roomMap.delete(game.roomId)
          activeGames.delete(gameId)
        } else if (game.status === 'playing') {
          const isWhite = socket.id === game.whiteSocketId
          const opponentSocketId = isWhite ? game.blackSocketId : game.whiteSocketId

          if (opponentSocketId) {
            io.to(opponentSocketId).emit('game:opponent-disconnected', {
              username: user?.username,
              gameId,
            })
          }

          const winner = isWhite ? 'black' : 'white'
          endGame(game, winner, 'disconnect')
        }

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

// ═══════════════════════════════════════════════════════════════
//  START SERVER - Ekta port e API + Socket mile jay!
// ═══════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 10000

httpServer.listen(PORT, () => {
  console.log('')
  console.log(`  ChessArena Combined Server Running!`)
  console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  API:       http://localhost:${PORT}/api/health`)
  console.log(`  Socket.io: http://localhost:${PORT}/socket.io`)
  console.log(`  Port:      ${PORT}`)
  console.log('')
})

// Graceful shutdown
process.on('SIGTERM', () => { prisma.$disconnect(); httpServer.close(); process.exit(0) })
process.on('SIGINT', () => { prisma.$disconnect(); httpServer.close(); process.exit(0) })
