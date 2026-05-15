import { io } from 'socket.io-client';

const SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://chess-arena.fly.dev';

let socket = null;

export function getSocket(token: string) {
  if (socket) {
    socket.disconnect();
  }

  socket = io(SERVER_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
