import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    if (!this.socket) {
      // Connect to the backend server (through Vite proxy or direct)
      this.socket = io({
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
      });

      this.socket.on('connect', () => {
        console.log('[Socket] Connected to server, ID:', this.socket.id);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
      });

      this.socket.on('error', (err) => {
        console.error('[Socket] Server error:', err);
      });
    }
    return this.socket;
  }

  joinRoom(roomCode, username) {
    this.connect();
    this.socket.emit('join_room', { roomCode, username });
  }

  leaveRoom(roomCode, username) {
    if (this.socket) {
      this.socket.emit('leave_room', { roomCode, username });
    }
  }

  shareDraft(roomCode, draft) {
    if (this.socket) {
      this.socket.emit('share_draft', { roomCode, draft });
    }
  }

  startSpin(roomCode, username, intervalMs = 5000) {
    if (this.socket) {
      this.socket.emit('start_spin', { roomCode, username, intervalMs });
    }
  }

  on(event, callback) {
    this.connect();
    this.socket.on(event, callback);
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
