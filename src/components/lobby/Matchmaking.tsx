'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore, useGameStore } from '@/store'
import { getSocket } from '@/lib/socket'
import { Loader2, Users, X } from 'lucide-react'

export default function Matchmaking({ onMatchFound }: { onMatchFound: () => void }) {
  const [searching, setSearching] = useState(false)
  const [queueInfo, setQueueInfo] = useState<{ position: number; message: string } | null>(null)
  const user = useAuthStore((s) => s.user)
  const setCurrentGame = useGameStore((s) => s.setCurrentGame)
  const setInQueue = useGameStore((s) => s.setInQueue)
  const socket = getSocket()

  const startSearch = () => {
    if (!user) return

    setSearching(true)
    setQueueInfo({ position: 1, message: 'Searching for opponent...' })

    socket.emit('auth:join-queue', {
      userId: user.id,
      username: user.username,
      rating: user.rating,
    })
  }

  const stopSearch = () => {
    setSearching(false)
    setQueueInfo(null)
    socket.emit('auth:leave-queue', {
      userId: user?.id,
      username: user?.username,
      rating: user?.rating,
    })
    setInQueue(false)
  }

  useEffect(() => {
    const handleQueueJoined = (data: { message: string; position: number }) => {
      setQueueInfo({ position: data.position, message: data.message })
      setInQueue(true, data.position)
    }

    const handleMatchFound = (data: { game: any; color: string }) => {
      setSearching(false)
      setQueueInfo(null)
      setCurrentGame({ ...data.game, color: data.color })
      setInQueue(false)
      onMatchFound()
    }

    socket.on('queue:joined', handleQueueJoined)
    socket.on('queue:match-found', handleMatchFound)

    return () => {
      socket.off('queue:joined', handleQueueJoined)
      socket.off('queue:match-found', handleMatchFound)
    }
  }, [socket, setCurrentGame, setInQueue, onMatchFound])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5" />
          Quick Match
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!searching ? (
          <>
            <p className="text-sm text-muted-foreground">
              Get matched with a random opponent. Standard 10+0 time control.
            </p>
            <Button onClick={startSearch} className="w-full" size="lg">
              <Users className="w-4 h-4 mr-2" />
              Find Match
            </Button>
          </>
        ) : (
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="font-medium">{queueInfo?.message || 'Searching...'}</span>
            </div>
            <div className="flex items-center justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
            <Button onClick={stopSearch} variant="outline" className="w-full">
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
