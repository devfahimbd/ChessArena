import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { calculateElo } from '@/lib/elo'
import { z } from 'zod'

const endGameSchema = z.object({
  gameId: z.string(),
  result: z.enum(['white', 'black', 'draw']),
  resultReason: z.string(),
  whitePlayerId: z.string(),
  blackPlayerId: z.string(),
  moves: z.array(z.string()),
  pgn: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const data = endGameSchema.parse(body)

    // Get both players
    const [whitePlayer, blackPlayer] = await Promise.all([
      db.user.findUnique({ where: { id: data.whitePlayerId } }),
      db.user.findUnique({ where: { id: data.blackPlayerId } }),
    ])

    if (!whitePlayer || !blackPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    // Calculate new ELO ratings
    let whiteResult: 'win' | 'loss' | 'draw'
    let blackResult: 'win' | 'loss' | 'draw'

    if (data.result === 'white') {
      whiteResult = 'win'
      blackResult = 'loss'
    } else if (data.result === 'black') {
      whiteResult = 'loss'
      blackResult = 'win'
    } else {
      whiteResult = 'draw'
      blackResult = 'draw'
    }

    const newWhiteRating = calculateElo(whitePlayer.rating, blackPlayer.rating, whiteResult)
    const newBlackRating = calculateElo(blackPlayer.rating, whitePlayer.rating, blackResult)

    // Update both players
    await Promise.all([
      db.user.update({
        where: { id: data.whitePlayerId },
        data: {
          rating: newWhiteRating,
          gamesPlayed: { increment: 1 },
          wins: whiteResult === 'win' ? { increment: 1 } : undefined,
          losses: whiteResult === 'loss' ? { increment: 1 } : undefined,
          draws: whiteResult === 'draw' ? { increment: 1 } : undefined,
        },
      }),
      db.user.update({
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

    // Create or update the game record
    const existingGame = await db.game.findUnique({
      where: { id: data.gameId },
    })

    if (existingGame) {
      await db.game.update({
        where: { id: data.gameId },
        data: {
          status: 'finished',
          result: data.result,
          resultReason: data.resultReason,
          moves: JSON.stringify(data.moves),
          pgn: data.pgn || '',
          endedAt: new Date(),
        },
      })
    } else {
      await db.game.create({
        data: {
          id: data.gameId,
          whitePlayerId: data.whitePlayerId,
          blackPlayerId: data.blackPlayerId,
          status: 'finished',
          result: data.result,
          resultReason: data.resultReason,
          moves: JSON.stringify(data.moves),
          pgn: data.pgn || '',
          endedAt: new Date(),
        },
      })
    }

    return NextResponse.json({
      message: 'Game result recorded',
      whiteRating: newWhiteRating,
      blackRating: newBlackRating,
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('End game error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
