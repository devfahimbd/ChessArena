import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  username: string
  email: string
  rating: number
  gamesPlayed?: number
  wins?: number
  losses?: number
  draws?: number
}

interface GameState {
  fen: string
  pgn: string
  moves: string[]
  turn: 'w' | 'b'
  status: 'waiting' | 'playing' | 'finished'
  result: string
  resultReason: string
  whitePlayer: { username: string; rating: number } | null
  blackPlayer: { username: string; rating: number } | null
  isCheck: boolean
  isCheckmate: boolean
  isStalemate: boolean
  isDraw: boolean
  isGameOver: boolean
  whiteTime: number
  blackTime: number
  timeControl: string
  gameId: string
  roomId: string | null
  color: 'w' | 'b' | 'spectator' | null
}

interface AuthStore {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  setAuth: (token: string, user: User) => void
  logout: () => void
}

interface GameStore {
  currentGame: GameState | null
  inQueue: boolean
  queuePosition: number
  drawOffered: boolean
  drawFrom: string | null
  opponentDisconnected: boolean
  chatMessages: { username: string; message: string; timestamp: string }[]
  setCurrentGame: (game: GameState | null) => void
  updateGameFromSocket: (partial: Partial<GameState>) => void
  setInQueue: (inQueue: boolean, position?: number) => void
  setDrawOffered: (offered: boolean, from?: string) => void
  setOpponentDisconnected: (disconnected: boolean) => void
  addChatMessage: (msg: { username: string; message: string; timestamp: string }) => void
  resetGame: () => void
  clearChat: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
      logout: () => set({ token: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'chess-auth',
    }
  )
)

export const useGameStore = create<GameStore>()((set) => ({
  currentGame: null,
  inQueue: false,
  queuePosition: 0,
  drawOffered: false,
  drawFrom: null,
  opponentDisconnected: false,
  chatMessages: [],

  setCurrentGame: (game) => set({ currentGame: game }),

  updateGameFromSocket: (partial) =>
    set((state) => ({
      currentGame: state.currentGame
        ? { ...state.currentGame, ...partial }
        : null,
    })),

  setInQueue: (inQueue, position = 0) =>
    set({ inQueue, queuePosition: position }),

  setDrawOffered: (offered, from = null) =>
    set({ drawOffered: offered, drawFrom: from }),

  setOpponentDisconnected: (disconnected) =>
    set({ opponentDisconnected: disconnected }),

  addChatMessage: (msg) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, msg].slice(-50), // Keep last 50 messages
    })),

  resetGame: () =>
    set({
      currentGame: null,
      inQueue: false,
      queuePosition: 0,
      drawOffered: false,
      drawFrom: null,
      opponentDisconnected: false,
    }),

  clearChat: () => set({ chatMessages: [] }),
}))
