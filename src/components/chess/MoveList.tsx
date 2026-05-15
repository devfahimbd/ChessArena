'use client'

import { useGameStore } from '@/store'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Crown, Flag } from 'lucide-react'

interface MoveListProps {
  className?: string
}

export default function MoveList({ className }: MoveListProps) {
  const moves = useGameStore((s) => s.currentGame?.moves ?? [])
  const currentGame = useGameStore((s) => s.currentGame)

  // Pair moves: [move1, move2], [move3, move4], etc.
  const pairedMoves: { num: number; white: string; black?: string }[] = []
  for (let i = 0; i < moves.length; i += 2) {
    pairedMoves.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    })
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Moves
        </h3>
        {currentGame && (
          <span className="text-xs text-muted-foreground">
            {moves.length} {moves.length === 1 ? 'move' : 'moves'}
          </span>
        )}
      </div>
      <ScrollArea className="h-[200px] sm:h-[280px] rounded-md border bg-background/50 p-2">
        {pairedMoves.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm py-8">
            <Flag className="w-6 h-6 mb-2 opacity-50" />
            <p>No moves yet</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {pairedMoves.map((pair) => (
              <div
                key={pair.num}
                className="grid grid-cols-[2rem_1fr_1fr] gap-1 text-sm font-mono"
              >
                <span className="text-muted-foreground text-right pr-1">
                  {pair.num}.
                </span>
                <span className="px-1.5 py-0.5 rounded bg-muted/50 hover:bg-muted transition-colors">
                  {pair.white}
                </span>
                {pair.black ? (
                  <span className="px-1.5 py-0.5 rounded bg-muted/50 hover:bg-muted transition-colors">
                    {pair.black}
                  </span>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Game result */}
      {currentGame?.isGameOver && currentGame.result && (
        <div className="mt-2 p-2 rounded-md bg-primary/10 text-primary text-sm font-medium text-center">
          {currentGame.resultReason === 'checkmate' && (
            <span className="flex items-center justify-center gap-1">
              <Crown className="w-4 h-4" />
              {currentGame.result === 'white' ? 'White' : 'Black'} wins by checkmate
            </span>
          )}
          {currentGame.resultReason === 'stalemate' && 'Draw by stalemate'}
          {currentGame.resultReason === 'resign' &&
            `${currentGame.result === 'white' ? 'Black' : 'White'} resigned`}
          {currentGame.resultReason === 'timeout' &&
            `${currentGame.result === 'white' ? 'Black' : 'White'} ran out of time`}
          {currentGame.resultReason === 'disconnect' &&
            `${currentGame.result === 'white' ? 'Black' : 'White'} disconnected`}
          {currentGame.resultReason === 'agreement' && 'Draw by agreement'}
          {currentGame.resultReason === 'insufficient material' && 'Draw by insufficient material'}
          {currentGame.resultReason === 'threefold repetition' && 'Draw by threefold repetition'}
        </div>
      )}
    </div>
  )
}
