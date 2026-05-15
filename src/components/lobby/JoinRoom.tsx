'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store'
import { getSocket } from '@/lib/socket'
import { toast } from 'sonner'
import { LogIn, Loader2 } from 'lucide-react'

export default function JoinRoom({ onJoined }: { onJoined: () => void }) {
  const [roomId, setRoomId] = useState('')
  const [joining, setJoining] = useState(false)
  const user = useAuthStore((s) => s.user)
  const socket = getSocket()

  const handleJoin = () => {
    if (!roomId.trim() || !user) return

    setJoining(true)
    socket.emit(
      'auth:join-room',
      {
        userId: user.id,
        username: user.username,
        rating: user.rating,
        roomId: roomId.trim(),
      },
      (response: any) => {
        setJoining(false)
        if (response?.error) {
          toast.error(response.error)
        }
      }
    )

    const handler = (data: any) => {
      setJoining(false)
      onJoined()
      toast.success('Joined the game!')
      socket.off('room:joined', handler)
    }
    socket.on('room:joined', handler)

    const errorHandler = (data: { message: string }) => {
      setJoining(false)
      toast.error(data.message)
      socket.off('error', errorHandler)
    }
    socket.on('error', errorHandler)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <LogIn className="w-5 h-5" />
          Join Room
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder="Enter room ID (e.g. ABC123)"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value.toUpperCase())}
          maxLength={6}
          className="font-mono text-center text-lg tracking-widest uppercase"
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        />
        <Button
          onClick={handleJoin}
          className="w-full"
          disabled={joining || roomId.trim().length < 4}
        >
          {joining ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <LogIn className="w-4 h-4 mr-2" />
          )}
          Join Game
        </Button>
      </CardContent>
    </Card>
  )
}
