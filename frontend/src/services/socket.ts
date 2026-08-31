import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

/**
 * Assumed contract: see docs/websocket-contract.md.
 * Connects through Kong at VITE_WS_URL, path /games/socket.io, authenticated
 * via the handshake `auth.token`.
 */
export function connectGameSocket(token: string): Socket {
  if (socket?.connected) return socket

  socket = io(import.meta.env.VITE_WS_URL ?? 'http://localhost:8000', {
    path: '/games/socket.io',
    auth: { token },
    transports: ['websocket'],
  })

  return socket
}

export function disconnectGameSocket() {
  socket?.disconnect()
  socket = null
}
