import { io, Socket } from 'socket.io-client'

// Socket.io client singleton — reconnects automatically
let socketInstance: Socket | null = null

export function getSocket(): Socket {
  if (socketInstance && socketInstance.connected) {
    return socketInstance
  }

  // Production: Render.com এর URL ব্যবহার হবে
  // Development: local XTransformPort ব্যবহার হবে
  const isProduction = process.env.NODE_ENV === 'production'
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL

  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
  }

  if (isProduction && socketUrl) {
    // Production: Direct connection to Render.com
    socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 15000,
    })
  } else {
    // Development: Local via Caddy proxy
    socketInstance = io('/?XTransformPort=3003', {
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
