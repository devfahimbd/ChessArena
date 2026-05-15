'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useGameStore, useAuthStore } from '@/store'
import { getSocket } from '@/lib/socket'
import { Send } from 'lucide-react'

export default function GameChat({ disabled }: { disabled?: boolean }) {
  const [message, setMessage] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const messages = useGameStore((s) => s.chatMessages)
  const addChatMessage = useGameStore((s) => s.addChatMessage)
  const currentGame = useGameStore((s) => s.currentGame)
  const user = useAuthStore((s) => s.user)
  const socket = getSocket()

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    const handler = (msg: { username: string; message: string; timestamp: string }) => {
      addChatMessage(msg)
    }
    socket.on('game:chat', handler)
    return () => {
      socket.off('game:chat', handler)
    }
  }, [socket, addChatMessage])

  const sendMessage = () => {
    if (!message.trim() || !currentGame || disabled) return

    const chatMsg = {
      username: user?.username || 'You',
      message: message.trim(),
      timestamp: new Date().toISOString(),
    }

    socket.emit('game:chat', {
      gameId: currentGame.gameId,
      message: message.trim(),
    })

    addChatMessage(chatMsg)
    setMessage('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b">
        <h3 className="text-sm font-semibold text-muted-foreground">Chat</h3>
      </div>
      <ScrollArea className="flex-1 p-2" ref={scrollRef}>
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No messages yet. Say hello!
          </p>
        ) : (
          <div className="space-y-1.5">
            {messages.map((msg, i) => {
              const isOwn = msg.username === user?.username
              return (
                <div key={i} className={cn('text-sm', isOwn && 'text-right')}>
                  <span className={cn('font-semibold text-xs', isOwn ? 'text-primary' : 'text-muted-foreground')}>
                    {msg.username}:
                  </span>{' '}
                  <span>{msg.message}</span>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
      <div className="p-2 border-t flex gap-1.5">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          disabled={disabled}
          className="text-sm h-8"
        />
        <Button size="icon" variant="ghost" onClick={sendMessage} disabled={disabled || !message.trim()} className="shrink-0 h-8 w-8">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
