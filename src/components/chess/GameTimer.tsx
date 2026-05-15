'use client'

import { cn } from '@/lib/utils'

interface GameTimerProps {
  whiteTime: number
  blackTime: number
  turn: 'w' | 'b'
  isGameOver: boolean
  className?: string
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function GameTimer({
  whiteTime,
  blackTime,
  turn,
  isGameOver,
  className,
}: GameTimerProps) {
  const whiteActive = turn === 'w' && !isGameOver
  const blackActive = turn === 'b' && !isGameOver
  const whiteLow = whiteTime < 60 && !isGameOver
  const blackLow = blackTime < 60 && !isGameOver

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* White timer */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-1.5 rounded-md border-2 transition-all',
          whiteActive
            ? 'border-primary bg-primary/5'
            : 'border-transparent bg-muted/50',
          whiteLow && whiteActive && 'border-red-500 bg-red-500/10 animate-pulse'
        )}
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-white border border-foreground/20" />
          <span className="text-sm font-medium">White</span>
        </div>
        <span
          className={cn(
            'font-mono text-lg font-bold tabular-nums',
            whiteLow && whiteActive && 'text-red-600'
          )}
        >
          {formatTime(whiteTime)}
        </span>
      </div>

      {/* Black timer */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-1.5 rounded-md border-2 transition-all',
          blackActive
            ? 'border-primary bg-primary/5'
            : 'border-transparent bg-muted/50',
          blackLow && blackActive && 'border-red-500 bg-red-500/10 animate-pulse'
        )}
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-foreground border border-foreground/20" />
          <span className="text-sm font-medium">Black</span>
        </div>
        <span
          className={cn(
            'font-mono text-lg font-bold tabular-nums',
            blackLow && blackActive && 'text-red-600'
          )}
        >
          {formatTime(blackTime)}
        </span>
      </div>
    </div>
  )
}
