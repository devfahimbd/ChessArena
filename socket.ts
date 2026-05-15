import { io, Socket } from 'socket.io-client'

// Socket.io client singleton — reconnects automatically
let socketInstance: Socket | null = null

export function getSocket(): Socket {
  if (socketInstance && socketInstance.connected) {
    return socketInstance
  }

  const isProduction = process.env.NODE_ENV === 'production'
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
  }

  if (isProduction && (socketUrl || apiUrl)) {
    // Combined server: Socket + API ekta URL e (Koyeb)
    // NEXT_PUBLIC_SOCKET_URL set thakle seta use hobe
    // Na thakle NEXT_PUBLIC_API_URL use hobe (same server!)
    const url = socketUrl || apiUrl || ''
    socketInstance = io(url, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    })
  } else {
    // Development: Local combined server (ekta port e)
    socketInstance = io('http://localhost:10000', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 15000,
    })
  }

  return socketInstance
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
  }
}
