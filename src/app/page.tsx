'use client'

import { useEffect, useCallback, useState } from 'react'
import { useAuthStore, useGameStore } from '@/store'
import { getSocket } from '@/lib/socket'
import LoginForm from '@/components/auth/LoginForm'
import RegisterForm from '@/components/auth/RegisterForm'
import ChessBoard from '@/components/chess/ChessBoard'
import MoveList from '@/components/chess/MoveList'
import GameTimer from '@/components/chess/GameTimer'
import PlayerInfo from '@/components/chess/PlayerInfo'
import GameChat from '@/components/chess/GameChat'
import CreateRoom from '@/components/lobby/CreateRoom'
import JoinRoom from '@/components/lobby/JoinRoom'
import Matchmaking from '@/components/lobby/Matchmaking'
import Leaderboard from '@/components/lobby/Leaderboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  LogOut,
  Trophy,
  History,
  Home,
  Swords,
  Crown,
  Flag,
  Handshake,
  MessageSquare,
  Loader2,
} from 'lucide-react'
import type { Square } from 'chess.js'
import { disconnectSocket } from '@/lib/socket'

type View = 'auth' | 'lobby' | 'game' | 'history' | 'leaderboard'

export default function HomePage() {
  // Auth state
  const { user, isAuthenticated, logout } = useAuthStore()
  const [showRegister, setShowRegister] = useState(false)

  // Game state
  const {
    currentGame,
    setCurrentGame,
    updateGameFromSocket,
    resetGame,
    drawOffered,
    setDrawOffered,
    opponentDisconnected,
    setOpponentDisconnected,
    inQueue,
  } = useGameStore()

  // View state
  const [view, setView] = useState<View>(isAuthenticated ? 'lobby' : 'auth')

  // Navigate on auth change
  useEffect(() => {
    if (isAuthenticated && view === 'auth') setView('lobby')
    if (!isAuthenticated && view !== 'auth') setView('auth')
  }, [isAuthenticated])

  // Connect socket and listen for events when authenticated
  useEffect(() => {
    if (!isAuthenticated) return

    const socket = getSocket()

    const handleConnect = () => {
      console.log('Socket connected')
    }

    const handleGameStart = (data: { game: any; color: string }) => {
      setCurrentGame({ ...data.game, color: data.color })
      setView('game')
      resetGame()
      setCurrentGame({ ...data.game, color: data.color })
      toast.success('Game started!')
    }

    const handleGameState = (data: any) => {
      updateGameFromSocket(data)
    }

    const handleGameMove = (data: any) => {
      updateGameFromSocket(data)
    }

    const handleGameMoveConfirmed = (data: any) => {
      updateGameFromSocket(data)
    }

    const handleGameTimeUpdate = (data: any) => {
      updateGameFromSocket(data)
    }

    const handleGameEnded = (data: any) => {
      updateGameFromSocket(data)
      toast.info(
        `Game ended: ${data.result === 'draw' ? 'Draw' : data.result === 'white' ? 'White wins' : 'Black wins'}`
      )
    }

    const handleGameError = (data: { message: string }) => {
      toast.error(data.message)
    }

    const handleDrawOffered = (data: { from: string; gameId: string }) => {
      setDrawOffered(true, data.from)
      toast.info(`${data.from} is offering a draw`)
    }

    const handleDrawDeclined = () => {
      toast.info('Draw offer was declined')
      setDrawOffered(false)
    }

    const handleOpponentDisconnected = (data: { username: string }) => {
      setOpponentDisconnected(true)
      toast.warning(`${data.username} disconnected!`)
    }

    const handleError = (data: { message: string }) => {
      toast.error(data.message)
    }

    socket.on('connect', handleConnect)
    socket.on('room:game-start', handleGameStart)
    socket.on('game:state', handleGameState)
    socket.on('game:move', handleGameMove)
    socket.on('game:move-confirmed', handleGameMoveConfirmed)
    socket.on('game:time-update', handleGameTimeUpdate)
    socket.on('game:ended', handleGameEnded)
    socket.on('game:error', handleGameError)
    socket.on('game:draw-offered', handleDrawOffered)
    socket.on('game:draw-declined', handleDrawDeclined)
    socket.on('game:opponent-disconnected', handleOpponentDisconnected)
    socket.on('error', handleError)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('room:game-start', handleGameStart)
      socket.off('game:state', handleGameState)
      socket.off('game:move', handleGameMove)
      socket.off('game:move-confirmed', handleGameMoveConfirmed)
      socket.off('game:time-update', handleGameTimeUpdate)
      socket.off('game:ended', handleGameEnded)
      socket.off('game:error', handleGameError)
      socket.off('game:draw-offered', handleDrawOffered)
      socket.off('game:draw-declined', handleDrawDeclined)
      socket.off('game:opponent-disconnected', handleOpponentDisconnected)
      socket.off('error', handleError)
    }
  }, [isAuthenticated, setCurrentGame, updateGameFromSocket, resetGame, setDrawOffered, setOpponentDisconnected])

  const handleMove = useCallback(
    (from: Square, to: Square, promotion?: string) => {
      if (!currentGame) return
      const socket = getSocket()
      socket.emit('game:move', {
        gameId: currentGame.gameId,
        move: promotion ? `${from}${to}=${promotion}` : `${from}${to}`,
      })
    },
    [currentGame]
  )

  const handleResign = useCallback(() => {
    if (!currentGame) return
    const socket = getSocket()
    socket.emit('game:resign', { gameId: currentGame.gameId })
  }, [currentGame])

  const handleOfferDraw = useCallback(() => {
    if (!currentGame) return
    const socket = getSocket()
    socket.emit('game:offer-draw', { gameId: currentGame.gameId })
    toast.info('Draw offer sent')
  }, [currentGame])

  const handleAcceptDraw = useCallback(() => {
    if (!currentGame) return
    const socket = getSocket()
    socket.emit('game:accept-draw', { gameId: currentGame.gameId })
    setDrawOffered(false)
  }, [currentGame, setDrawOffered])

  const handleDeclineDraw = useCallback(() => {
    setDrawOffered(false)
    toast.info('Draw declined')
  }, [setDrawOffered])

  const handleLeaveGame = useCallback(() => {
    resetGame()
    setView('lobby')
  }, [resetGame])

  const handleLogout = useCallback(() => {
    resetGame()
    logout()
    setView('auth')
    try {
      disconnectSocket()
    } catch {
      // ignore
    }
  }, [logout, resetGame])

  // ─── Auth View ────────────────────────────────────────────

  if (view === 'auth') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/30">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-20 text-8xl opacity-5 select-none">&#9814;</div>
          <div className="absolute bottom-20 right-20 text-8xl opacity-5 select-none">&#9820;</div>
          <div className="absolute top-1/2 left-1/4 text-6xl opacity-5 select-none">&#9816;</div>
          <div className="absolute top-1/3 right-1/3 text-6xl opacity-5 select-none">&#9822;</div>
        </div>
        <div className="relative z-10 w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold tracking-tight flex items-center justify-center gap-2">
              <Swords className="w-7 h-7 text-primary" />
              ChessArena
            </h1>
            <p className="text-muted-foreground mt-1">Real-time multiplayer chess</p>
          </div>
          {showRegister ? (
            <RegisterForm onSwitch={() => setShowRegister(false)} />
          ) : (
            <LoginForm onSwitch={() => setShowRegister(true)} />
          )}
        </div>
      </div>
    )
  }

  // ─── Main App (Lobby + Game) ──────────────────────────────

  const isPlaying = view === 'game' && currentGame
  const isMyTurn = currentGame
    ? (currentGame.turn === 'w' && currentGame.color === 'w') ||
      (currentGame.turn === 'b' && currentGame.color === 'b')
    : false

  // Last move for highlighting
  const lastMove =
    currentGame && currentGame.moves.length >= 2
      ? null // Simplified: we highlight based on FEN
      : null

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 h-14">
          <button
            onClick={() => !isPlaying ? setView('lobby') : handleLeaveGame()}
            className="flex items-center gap-2 font-bold text-lg hover:text-primary transition-colors"
          >
            <Swords className="w-5 h-5 text-primary" />
            ChessArena
          </button>

          <div className="flex items-center gap-2">
            {user && (
              <div className="flex items-center gap-3 mr-2">
                <Badge variant="outline" className="font-mono">
                  {user.rating}
                </Badge>
                <span className="text-sm font-medium hidden sm:inline">{user.username}</span>
              </div>
            )}

            {isPlaying && (
              <Button variant="outline" size="sm" onClick={handleLeaveGame}>
                <Home className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Lobby</span>
              </Button>
            )}

            {!isPlaying && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setView('leaderboard')}>
                  <Trophy className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Ranks</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        {/* ─── Game View ─────────────────────────────────── */}
        {view === 'game' && currentGame && (
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
              {/* Left: Board + Controls */}
              <div className="space-y-4">
                {/* Opponent Info (shown at top) */}
                <PlayerInfo
                  username={currentGame.blackPlayer?.username || 'Waiting...'}
                  rating={currentGame.blackPlayer?.rating || 0}
                  color={currentGame.color === 'b' ? 'w' : 'b'}
                  isActive={currentGame.turn === 'b'}
                  isOpponent={currentGame.color !== 'b'}
                />

                {/* Game Timer */}
                <GameTimer
                  whiteTime={currentGame.whiteTime}
                  blackTime={currentGame.blackTime}
                  turn={currentGame.turn}
                  isGameOver={currentGame.isGameOver}
                />

                {/* Chess Board */}
                <ChessBoard
                  fen={currentGame.fen}
                  onMove={handleMove}
                  orientation={currentGame.color === 'b' ? 'black' : 'white'}
                  disabled={currentGame.isGameOver || !isMyTurn}
                />

                {/* Player Info (you) */}
                <PlayerInfo
                  username={currentGame.whitePlayer?.username || 'Waiting...'}
                  rating={currentGame.whitePlayer?.rating || 0}
                  color={currentGame.color === 'w' ? 'w' : 'b'}
                  isActive={currentGame.turn === 'w'}
                  isOpponent={currentGame.color !== 'w'}
                />

                {/* Game Controls */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {!currentGame.isGameOver && (
                    <>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleResign}
                        className="gap-1"
                      >
                        <Flag className="w-4 h-4" />
                        Resign
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOfferDraw}
                        className="gap-1"
                      >
                        <Handshake className="w-4 h-4" />
                        Offer Draw
                      </Button>
                    </>
                  )}
                  {currentGame.isGameOver && (
                    <Button onClick={handleLeaveGame} className="gap-1">
                      <Home className="w-4 h-4" />
                      Back to Lobby
                    </Button>
                  )}
                </div>

                {/* Draw offer dialog */}
                {drawOffered && !currentGame.isGameOver && (
                  <Card className="border-primary/50 bg-primary/5">
                    <CardContent className="p-3 flex items-center justify-between">
                      <span className="text-sm">
                        <Handshake className="w-4 h-4 inline mr-1" />
                        {useGameStore.getState().drawFrom} offers a draw
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAcceptDraw}>
                          Accept
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleDeclineDraw}>
                          Decline
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Opponent disconnected */}
                {opponentDisconnected && !currentGame.isGameOver && (
                  <Card className="border-yellow-500/50 bg-yellow-500/5">
                    <CardContent className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2 text-yellow-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm font-medium">Opponent disconnected</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right: Move list + Chat */}
              <div className="flex flex-col gap-4 h-fit lg:sticky lg:top-20">
                <MoveList />
                <div className="h-[200px] rounded-lg border overflow-hidden">
                  <GameChat disabled={currentGame.isGameOver} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Lobby View ────────────────────────────────── */}
        {view === 'lobby' && (
          <div className="max-w-4xl mx-auto">
            {/* Welcome Card */}
            <Card className="mb-6 border-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <Crown className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      Welcome back, {user?.username}!
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Rating: <span className="font-mono font-bold">{user?.rating}</span> &middot;{' '}
                      Games: {user?.gamesPlayed ?? 0} &middot;{' '}
                      Wins: {user?.wins ?? 0} &middot;{' '}
                      Losses: {user?.losses ?? 0} &middot;{' '}
                      Draws: {user?.draws ?? 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Matchmaking onMatchFound={() => setView('game')} />
              <CreateRoom onRoomCreated={() => {}} />
              <JoinRoom onJoined={() => setView('game')} />
            </div>
          </div>
        )}

        {/* ─── Leaderboard View ──────────────────────────── */}
        {view === 'leaderboard' && (
          <div className="py-4">
            <Leaderboard onBack={() => setView('lobby')} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-4 mt-auto">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          ChessArena &middot; Real-time multiplayer chess &middot; Built with Next.js, Socket.io & chess.js
        </div>
      </footer>
    </div>
  )
}
