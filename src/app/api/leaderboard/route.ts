import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const leaderboard = await db.user.findMany({
      orderBy: { rating: 'desc' },
      select: {
        id: true,
        username: true,
        rating: true,
        gamesPlayed: true,
        wins: true,
        losses: true,
        draws: true,
      },
      take: 20,
    })

    return NextResponse.json({ leaderboard })
  } catch (error) {
    console.error('Leaderboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
