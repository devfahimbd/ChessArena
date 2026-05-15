'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore, useGameStore } from '@/store'
import { getSocket } from '@/lib/socket'
import { toast } from 'sonner'
import { Plus, Copy, Loader2 } from 'lucide-react'

interface CreateRoomProps {
  onRoomCreated: (roomId: string) => void
}

export default function CreateRoom({ onRoomCreated }: CreateRoomProps) {
  const [timeControl, setTimeControl] = useState('10+0')
  const [creating, setCreating] = useState(false)
  const [roomId, setRoomId] = useState<string | null>(null)
  const user = useAuthStore((s) => s.user)
  const socket = getSocket()

  const handleCreate = () => {
    if (!user) return

    setCreating(true)
    socket.emit(
      'auth:create-room',
      {
        userId: user.id,
        username: user.username,
        rating: user.rating,
        timeControl,
      },
      (response: any) => {
        setCreating(false)
        if (response?.error) {
          toast.error(response.error)
          return
        }
      }
    )

    // Listen for room:created
    const handler = (data: { roomId: string; game: any; color: string }) => {
      setRoomId(data.roomId)
      onRoomCreated(data.roomId)
      toast.success(`Room created: ${data.roomId}`)
      socket.off('room:created', handler)
    }
    socket.on('room:created', handler)
  }

  const copyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId)
      toast.success('Room ID copied to clipboard!')
    }
  }

  if (roomId) {
    return (
      <Card className="border-2 border-primary/30 bg-primary/5">
        <CardContent className="p-4 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Room created! Share this ID:</p>
          <div className="flex items-center gap-2 justify-center">
            <div className="font-mono text-2xl font-bold tracking-widest bg-background px-4 py-2 rounded-lg border-2">
              {roomId}
            </div>
            <Button size="icon" variant="outline" onClick={copyRoomId}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Waiting for opponent to join...
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Create Room
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Time Control</Label>
          <Select value={timeControl} onValueChange={setTimeControl}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1+0">1 min (Bullet)</SelectItem>
              <SelectItem value="3+0">3 min (Blitz)</SelectItem>
              <SelectItem value="3+2">3+2 (Blitz)</SelectItem>
              <SelectItem value="5+0">5 min (Blitz)</SelectItem>
              <SelectItem value="5+3">5+3 (Blitz)</SelectItem>
              <SelectItem value="10+0">10 min (Rapid)</SelectItem>
              <SelectItem value="10+5">10+5 (Rapid)</SelectItem>
              <SelectItem value="15+10">15+10 (Rapid)</SelectItem>
              <SelectItem value="30+0">30 min (Classical)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleCreate} className="w-full" disabled={creating}>
          {creating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          Create Room
        </Button>
      </CardContent>
    </Card>
  )
}
