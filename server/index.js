/**
 * ChessArena Backend Server
 *
 * এটা Render.com এ deploy হবে
 * Prisma (MySQL) ব্যবহার করে REST API চালায়
 */

import express from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { z } from 'zod'
import path from 'path'

const app = express()
const prisma = new PrismaClient()

// ─── Middleware ──────────────────────────────────────────────

app.use(express.json())

// CORS — Frontend থেকে API call করতে দেবে
app.use((req, res, next) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    // তোমার domain এখানে add করো
  ]
  const origin = req.headers.origin || ''
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// ─── JWT Helpers ─────────────────────────────────────────────

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-secret-change-me'
)

interface JWTPayload {
  userId: string
  username: string
  email: string
  rating: number
}

async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

// Auth middleware
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const token = authHeader.split(' ')[1]
  const payload = await verifyToken(token)
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
  (req as any).user = payload
  next()
}

// ─── ELO Calculation ────────────────────────────────────────

function calculateElo(
  playerRating: number,
  opponentRating: number,
  result: 'win' | 'loss' | 'draw'
): number {
  const K = 32
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400))
  const actualScore = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0
  return Math.round(playerRating + K * (actualScore - expectedScore))
}

// ─── Auth Routes ─────────────────────────────────────────────

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
  } catch (error: any) {
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
app.get('/api/auth/me', requireAuth, async (req: any, res) => {
  const user = req.user
  res.json({ user: { id: user.userId, username: user.username, email: user.email, rating: user.rating } })
})

// ─── Game Routes ─────────────────────────────────────────────

// GET /api/games
app.get('/api/games', requireAuth, async (req: any, res) => {
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
app.get('/api/games/:id', requireAuth, async (req: any, res) => {
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

app.post('/api/games/end', requireAuth, async (req: any, res) => {
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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error' })
    }
    console.error('End game error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── Leaderboard ─────────────────────────────────────────────

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

// ─── Health Check ────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── Start Server ────────────────────────────────────────────

const PORT = process.env.PORT || 10000

app.listen(PORT, () => {
  console.log(`[Backend] Running on port ${PORT}`)
  console.log(`[Backend] Health: http://localhost:${PORT}/api/health`)
})

// Graceful shutdown
process.on('SIGTERM', () => { prisma.$disconnect(); process.exit(0) })
process.on('SIGINT', () => { prisma.$disconnect(); process.exit(0) })
