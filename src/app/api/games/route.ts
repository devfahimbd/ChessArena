import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const payload = await verifyToken(token)

    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // Get user's games (as white or black player)
    const games = await db.game.findMany({
      where: {
        OR: [
          { whitePlayerId: payload.userId },
          { blackPlayerId: payload.userId },
        ],
      },
      include: {
        whitePlayer: { select: { id: true, username: true, rating: true } },
        blackPlayer: { select: { id: true, username: true, rating: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Parse moves from JSON string
    const gamesWithParsedMoves = games.map((game) => ({
      ...game,
      moves: JSON.parse(game.moves),
    }))

    return NextResponse.json({ games: gamesWithParsedMoves })
  } catch (error) {
    console.error('Games fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
