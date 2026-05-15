'use client'

import { useState, useCallback, useMemo } from 'react'
import { Chess, Square, Move } from 'chess.js'
import { cn } from '@/lib/utils'
import { useGameStore } from '@/store'

// Piece Unicode symbols
const PIECES: Record<string, string> = {
  wK: '\u2654', wQ: '\u2655', wR: '\u2656', wB: '\u2657', wN: '\u2658', wP: '\u2659',
  bK: '\u265A', bQ: '\u265B', bR: '\u265C', bB: '\u265D', bN: '\u265E', bP: '\u265F',
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

interface ChessBoardProps {
  fen: string
  onMove?: (from: Square, to: Square, promotion?: string) => void
  orientation?: 'white' | 'black'
  disabled?: boolean
  lastMove?: { from: Square; to: Square } | null
}

export default function ChessBoard({
  fen,
  onMove,
  orientation = 'white',
  disabled = false,
  lastMove,
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [legalMoves, setLegalMoves] = useState<Square[]>([])
  const color = useGameStore((s) => s.currentGame?.color)
  const currentGame = useGameStore((s) => s.currentGame)
  const isSpectator = color === 'spectator'

  const chess = useMemo(() => new Chess(fen), [fen])

  const isMyTurn = useMemo(() => {
    if (!currentGame || isSpectator || disabled) return false
    return (
      (currentGame.turn === 'w' && color === 'w') ||
      (currentGame.turn === 'b' && color === 'b')
    )
  }, [currentGame, color, isSpectator, disabled])

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (disabled || isSpectator || !isMyTurn) return

      const piece = chess.get(square)

      if (selectedSquare) {
        // Try to make a move
        const isLegalTarget = legalMoves.includes(square)

        if (isLegalTarget) {
          // Check for promotion
          const movingPiece = chess.get(selectedSquare)
          if (movingPiece && movingPiece.type === 'p') {
            const rank = square[1]
            const isPromoting =
              (movingPiece.color === 'w' && rank === '8') ||
              (movingPiece.color === 'b' && rank === '1')

            if (isPromoting) {
              onMove?.(selectedSquare, square, 'q')
              setSelectedSquare(null)
              setLegalMoves([])
              return
            }
          }
          onMove?.(selectedSquare, square)
          setSelectedSquare(null)
          setLegalMoves([])
          return
        }

        // If clicking on own piece, select it instead
        if (piece && piece.color === chess.turn()) {
          setSelectedSquare(square)
          const moves = chess.moves({ square, verbose: true })
          setLegalMoves(moves.map((m: Move) => m.to as Square))
          return
        }

        // Deselect
        setSelectedSquare(null)
        setLegalMoves([])
      } else {
        // Select own piece
        if (piece && piece.color === chess.turn()) {
          setSelectedSquare(square)
          const moves = chess.moves({ square, verbose: true })
          setLegalMoves(moves.map((m: Move) => m.to as Square))
        }
      }
    },
    [chess, selectedSquare, legalMoves, onMove, disabled, isSpectator, isMyTurn]
  )

  const board = useMemo(() => {
    const boardState = chess.board()
    if (orientation === 'black') {
      return boardState.reverse().map((row) => row.reverse())
    }
    return boardState
  }, [chess, orientation])

  const ranks = orientation === 'white' ? RANKS : [...RANKS].reverse()
  const files = orientation === 'white' ? FILES : [...FILES].reverse()

  const isKingInCheck = currentGame?.isCheck ?? false
  const kingSquare = useMemo(() => {
    if (!isKingInCheck) return null
    const boardState = chess.board()
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = boardState[r][c]
        if (piece && piece.type === 'k' && piece.color === chess.turn()) {
          return `${FILES[c]}${8 - r}` as Square
        }
      }
    }
    return null
  }, [chess, isKingInCheck])

  return (
    <div className="select-none">
      <div className="relative aspect-square w-full max-w-[min(80vh,560px)] mx-auto">
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full border-2 border-foreground/20 rounded-sm overflow-hidden shadow-xl">
          {board.map((row, rowIdx) =>
            row.map((piece, colIdx) => {
              const file = files[colIdx]
              const rank = ranks[rowIdx]
              const square = `${file}${rank}` as Square
              const isLight = (rowIdx + colIdx) % 2 === 0
              const isSelected = selectedSquare === square
              const isLegalTarget = legalMoves.includes(square)
              const isLastMoveSquare =
                lastMove && (lastMove.from === square || lastMove.to === square)
              const isKingCheckSquare = kingSquare === square

              return (
                <div
                  key={square}
                  onClick={() => handleSquareClick(square)}
                  className={cn(
                    'relative flex items-center justify-center cursor-pointer transition-colors',
                    'text-[clamp(1.5rem,6vw,3.5rem)] leading-none',
                    isLight ? 'bg-[#f0d9b5]' : 'bg-[#b58863]',
                    isSelected && (isLight ? 'bg-[#f7ec5d]' : 'bg-[#dac33b]'),
                    isLastMoveSquare && !isSelected && 'bg-[#cdd26a]/60',
                    isKingCheckSquare && 'bg-red-500/80',
                    isLegalTarget && 'cursor-pointer',
                    (!isMyTurn || disabled || isSpectator) && 'cursor-default'
                  )}
                >
                  {/* Coordinate labels */}
                  {colIdx === 0 && (
                    <span
                      className={cn(
                        'absolute top-0.5 left-0.5 text-[0.55rem] font-bold pointer-events-none',
                        isLight ? 'text-[#b58863]' : 'text-[#f0d9b5]'
                      )}
                    >
                      {rank}
                    </span>
                  )}
                  {rowIdx === 7 && (
                    <span
                      className={cn(
                        'absolute bottom-0 right-0.5 text-[0.55rem] font-bold pointer-events-none',
                        isLight ? 'text-[#b58863]' : 'text-[#f0d9b5]'
                      )}
                    >
                      {file}
                    </span>
                  )}

                  {/* Legal move indicator */}
                  {isLegalTarget && !piece && (
                    <div className="w-[28%] h-[28%] rounded-full bg-black/20" />
                  )}
                  {isLegalTarget && piece && (
                    <div className="absolute inset-0 border-[3px] border-black/20 rounded-full" />
                  )}

                  {/* Piece */}
                  {piece && (
                    <span
                      className={cn(
                        'drop-shadow-sm z-10',
                        piece.color === 'w' ? 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]' : 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]'
                      )}
                    >
                      {PIECES[`${piece.color}${piece.type.toUpperCase()}`]}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
