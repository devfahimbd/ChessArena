'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Crown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PlayerInfoProps {
  username: string
  rating: number
  color: 'w' | 'b'
  isActive: boolean
  isOpponent: boolean
  className?: string
}

export default function PlayerInfo({
  username,
  rating,
  color,
  isActive,
  isOpponent,
  className,
}: PlayerInfoProps) {
  const initials = username.slice(0, 2).toUpperCase()

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg border transition-all',
        isActive
          ? 'border-primary/50 bg-primary/5 shadow-sm'
          : 'border-transparent bg-muted/30',
        className
      )}
    >
      <Avatar className="h-10 w-10">
        <AvatarFallback
          className={cn(
            'text-sm font-bold',
            color === 'w'
              ? 'bg-white text-black border border-foreground/20'
              : 'bg-foreground text-white'
          )}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm truncate">{username}</span>
          {isActive && (
            <Crown className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {isOpponent ? 'Opponent' : 'You'} &middot; {rating}
        </span>
      </div>
      <Badge variant="outline" className="text-xs shrink-0">
        {color === 'w' ? 'White' : 'Black'}
      </Badge>
    </div>
  )
}
