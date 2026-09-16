import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { Room } from '../models/Room.js';
import {
  startSpinGame,
  handlePlayerDeparture,
  getSpinState
} from '../services/spinEngine.js';

let ioInstance = null;

// Track active socket sessions: socket.id -> { roomCode, username }
const socketRegistry = new Map();

export const initSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Range']
    },
    pingTimeout: 30000,
    pingInterval: 15000
  });

  ioInstance.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    /**
     * Event: join_room
     * Client joins a specific room channel
     */
    socket.on('join_room', async ({ roomCode, username }) => {
      try {
        if (!roomCode || !username) {
          return socket.emit('error', { message: 'roomCode and username are required' });
        }

        const normalizedCode = roomCode.trim().toUpperCase();
        const trimmedUser = username.trim();

        // 1. Join Socket.IO room channel
        socket.join(normalizedCode);
        socketRegistry.set(socket.id, { roomCode: normalizedCode, username: trimmedUser });

        // 2. Fetch authoritative room state
        const room = await Room.findOne({ code: normalizedCode, status: 'active' });
        if (!room) {
          return socket.emit('error', { message: `Room ${normalizedCode} not found or inactive` });
        }

        // 3. Update or attach member socketId and presence
        const existingMemberIndex = room.members.findIndex(
          (m) => m.username.toLowerCase() === trimmedUser.toLowerCase()
        );

        let currentMember;
        if (existingMemberIndex !== -1) {
          room.members[existingMemberIndex].socketId = socket.id;
          room.members[existingMemberIndex].isOnline = true;
          currentMember = room.members[existingMemberIndex];
        } else {
          currentMember = {
            username: trimmedUser,
            socketId: socket.id,
            isOwner: room.members.length === 0,
            isOnline: true,
            virtualPoints: 100
          };
          room.members.push(currentMember);
        }

        // If no owner currently set, assign this user
        if (!room.owner?.username) {
          room.owner = { username: trimmedUser, socketId: socket.id };
        }

        await room.save();

        // Fetch spin state for reconnect state-recovery
        const spinDetail = await getSpinState(normalizedCode);

        // Mandatory Event: room_state -> Sent to the connecting/reconnecting client
        socket.emit('room_state', {
          room: {
            id: room._id,
            name: room.name,
            code: room.code,
            owner: room.owner,
            status: room.status,
            members: room.members,
            activeDraft: room.activeDraft,
            spinState: room.spinState,
            activeSpin: spinDetail
          }
        });

        // Mandatory Event: user_joined -> Broadcast to all other participants in the room
        socket.to(normalizedCode).emit('user_joined', {
          user: currentMember,
          members: room.members,
          message: `${trimmedUser} joined the room`
        });

        // Broadcast updated member roster to all connected sockets in this room
        ioInstance.to(normalizedCode).emit('room_members_updated', {
          members: room.members,
          onlineCount: room.members.filter((m) => m.isOnline).length
        });

        console.log(`[Socket.IO] ${trimmedUser} joined room ${normalizedCode} (Total: ${room.members.length})`);
      } catch (err) {
        console.error('[Socket.IO] join_room error:', err);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    /**
     * Event: share_draft
     * Member broadcasts an audio draft to the room
     */
    socket.on('share_draft', async ({ roomCode, draft }) => {
      try {
        if (!roomCode || !draft) return;
        const normalizedCode = roomCode.trim().toUpperCase();

        const room = await Room.findOne({ code: normalizedCode, status: 'active' });
        if (!room) return;

        room.activeDraft = {
          draftId: draft.id || draft._id,
          title: draft.title,
          fileUrl: draft.fileUrl,
          duration: draft.duration || 0,
          effectApplied: draft.effectApplied || 'none',
          waveformPeaks: draft.waveformPeaks || [],
          sharedBy: draft.createdBy || draft.sharedBy || 'Artist',
          sharedAt: new Date()
        };

        await room.save();

        // Mandatory Event: draft_shared -> Broadcast to all room participants
        ioInstance.to(normalizedCode).emit('draft_shared', {
          activeDraft: room.activeDraft,
          sharedBy: room.activeDraft.sharedBy,
          message: `${room.activeDraft.sharedBy} shared "${room.activeDraft.title}" with the room`
        });

        console.log(`[Socket.IO] Draft "${draft.title}" shared in room ${normalizedCode}`);
      } catch (err) {
        console.error('[Socket.IO] share_draft error:', err);
      }
    });

    /**
     * Event: start_spin
     * Owner manually initiates the multiplayer spin wheel
     */
    socket.on('start_spin', async ({ roomCode, username, intervalMs }) => {
      try {
        if (!roomCode) return;
        const normalizedCode = roomCode.trim().toUpperCase();
        console.log(`[Socket.IO] start_spin requested by ${username} in ${normalizedCode}`);
        await startSpinGame(normalizedCode, username, ioInstance, intervalMs || 5000);
      } catch (err) {
        console.error('[Socket.IO] start_spin error:', err.message);
        socket.emit('spin_error', { message: err.message });
      }
    });

    /**
     * Event: leave_room
     * Member explicitly leaves the room
     */
    socket.on('leave_room', async ({ roomCode, username }) => {
      try {
        if (!roomCode || !username) return;
        const normalizedCode = roomCode.trim().toUpperCase();
        const trimmedUser = username.trim();

        await handleUserDeparture(socket, normalizedCode, trimmedUser, false);
      } catch (err) {
        console.error('[Socket.IO] leave_room error:', err);
      }
    });

    /**
     * Event: disconnect
     * Connection drop / network leave
     */
    socket.on('disconnect', async () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
      const session = socketRegistry.get(socket.id);
      if (session) {
        const { roomCode, username } = session;
        socketRegistry.delete(socket.id);
        await handleUserDeparture(socket, roomCode, username, true);
      }
    });
  });

  return ioInstance;
};

/**
 * Clean presence, handle spin departure, and broadcast user_left
 */
async function handleUserDeparture(socket, roomCode, username, isDisconnect = false) {
  try {
    if (mongoose.connection.readyState !== 1) return;
    const room = await Room.findOne({ code: roomCode, status: 'active' });
    if (!room) return;

    // Edge Case: Handle active spin departure
    if (ioInstance) {
      await handlePlayerDeparture(roomCode, username, ioInstance);
    }

    const memberIndex = room.members.findIndex(
      (m) => m.username.toLowerCase() === username.toLowerCase()
    );

    if (memberIndex !== -1) {
      if (isDisconnect) {
        // Mark temporarily offline
        room.members[memberIndex].isOnline = false;
      } else {
        // Explicit leave -> remove from members
        room.members.splice(memberIndex, 1);
      }

      const isBotUser = (name) => /^(CyberVoice|BeatMaster|EchoDiva|SynthWave|Bot)/i.test(name || '');
      const remainingHumans = room.members.filter((m) => m.isOnline && !isBotUser(m.username));

      if (remainingHumans.length === 0) {
        room.status = 'inactive';
        room.members.forEach((m) => (m.isOnline = false));
      } else if (room.owner?.username === username && room.members.length > 0) {
        // If leaving user was owner and other online human members exist, transfer ownership
        const nextOwner = remainingHumans[0] || room.members.find((m) => m.isOnline) || room.members[0];
        if (nextOwner) {
          nextOwner.isOwner = true;
          room.owner = { username: nextOwner.username, socketId: nextOwner.socketId };
        }
      }

      await room.save();

      socket.leave(roomCode);

      // Mandatory Event: user_left -> Broadcast departure to room
      ioInstance.to(roomCode).emit('user_left', {
        username,
        members: room.members,
        newOwner: room.owner,
        isDisconnect,
        message: `${username} ${isDisconnect ? 'disconnected from' : 'left'} the room`
      });

      // Broadcast updated member roster
      ioInstance.to(roomCode).emit('room_members_updated', {
        members: room.members,
        onlineCount: room.members.filter((m) => m.isOnline).length
      });

      console.log(`[Socket.IO] ${username} departed room ${roomCode}`);
    }
  } catch (err) {
    console.error('[Socket.IO] handleUserDeparture error:', err);
  }
}

export const getIO = () => ioInstance;
