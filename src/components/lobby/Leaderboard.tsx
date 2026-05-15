'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

interface LeaderboardEntry {
  id: string
  username: string
  rating: number
  gamesPlayed: number
  wins: number
  losses: number
  draws: number
}

export default function Leaderboard({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLeaderboard = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/leaderboard')
      const data = await res.json()
      setEntries(data.leaderboard || [])
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  const getWinRate = (entry: LeaderboardEntry) => {
    if (entry.gamesPlayed === 0) return '0%'
    return Math.round((entry.wins / entry.gamesPlayed) * 100) + '%'
  }

  const getRankIcon = (index: number) => {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `#${index + 1}`
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Leaderboard
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchLeaderboard} disabled={loading}>
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </Button>
          <Button size="sm" variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 && !loading ? (
          <p className="text-center text-muted-foreground py-8">
            No players yet. Be the first!
          </p>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-1">
              {entries.map((entry, index) => (
                <div
                  key={entry.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                    'hover:bg-muted/50',
                    index === 0 && 'bg-yellow-500/5',
                    index === 1 && 'bg-gray-400/5',
                    index === 2 && 'bg-amber-700/5'
                  )}
                >
                  <span className="text-lg w-10 text-center font-bold shrink-0">
                    {getRankIcon(index)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{entry.username}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.gamesPlayed} games &middot; WR: {getWinRate(entry)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-sm">{entry.rating}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.wins}W / {entry.losses}L / {entry.draws}D
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
