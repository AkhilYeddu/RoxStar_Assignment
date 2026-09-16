import { Room } from '../models/Room.js';
import { Draft } from '../models/Draft.js';
import { getIO } from '../socket/roomSocket.js';
import { startSpinGame, getSpinState, getSpinHistory } from '../services/spinEngine.js';

// Helper to generate a random unique room code
const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * @desc Create a new room
 * @route POST /api/rooms
 */
export const createRoom = async (req, res, next) => {
  try {
    const { name, username } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Room name is required' });
    }
    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Owner username is required' });
    }

    // Generate unique code
    let code = generateRoomCode();
    let existing = await Room.findOne({ code });
    while (existing) {
      code = generateRoomCode();
      existing = await Room.findOne({ code });
    }

    const trimmedUser = username.trim();
    const room = await Room.create({
      name: name.trim(),
      code,
      owner: { username: trimmedUser },
      status: 'active',
      members: [
        {
          username: trimmedUser,
          isOwner: true,
          isOnline: true,
          virtualPoints: 100
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Room created successfully',
      data: room
    });
  } catch (err) {
    next(err);
  }
};

const isBotUser = (name) => /^(CyberVoice|BeatMaster|EchoDiva|SynthWave|Bot)/i.test(name || '');

/**
 * @desc List active rooms
 * @route GET /api/rooms
 */
export const getRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find({
      status: 'active',
      members: { $elemMatch: { isOnline: true } }
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const io = getIO();
    const formatted = [];

    for (const r of rooms) {
      // 1. Real human online check (exclude demo bots)
      const onlineHumans = (r.members || []).filter(
        (m) => m.isOnline && !isBotUser(m.username)
      );
      if (onlineHumans.length === 0) continue;

      // 2. Active socket connection check: if Socket.IO is initialized and has clients,
      // verify at least one socket is in this room channel
      if (io) {
        const socketRoom = io.sockets.adapter?.rooms?.get(r.code);
        const socketCount = socketRoom ? socketRoom.size : 0;
        if (io.sockets?.sockets?.size > 0 && socketCount === 0) {
          continue; // All clients disconnected from this room
        }
      }

      formatted.push({
        id: r._id,
        name: r.name,
        code: r.code,
        owner: r.owner.username,
        memberCount: r.members.length,
        onlineCount: onlineHumans.length,
        activeDraft: r.activeDraft?.title || null,
        createdAt: r.createdAt
      });
    }

    res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Get room details and participant list by code
 * @route GET /api/rooms/:code
 */
export const getRoomDetails = async (req, res, next) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const room = await Room.findOne({ code, status: 'active' });

    if (!room) {
      return res.status(404).json({ success: false, message: `Room "${code}" not found` });
    }

    res.status(200).json({
      success: true,
      data: room
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Join a room
 * @route POST /api/rooms/:code/join
 */
export const joinRoom = async (req, res, next) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const { username } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Username is required to join' });
    }

    const trimmedUser = username.trim();
    const room = await Room.findOne({ code, status: 'active' });

    if (!room) {
      return res.status(404).json({ success: false, message: `Room "${code}" not found` });
    }

    // Maximum 20 eligible users per PDF specification (Section C1)
    if (room.members.length >= 20) {
      return res.status(400).json({ success: false, message: 'Room has reached maximum capacity of 20 users' });
    }

    const existingIdx = room.members.findIndex(
      (m) => m.username.toLowerCase() === trimmedUser.toLowerCase()
    );

    let member;
    if (existingIdx !== -1) {
      room.members[existingIdx].isOnline = true;
      member = room.members[existingIdx];
    } else {
      member = {
        username: trimmedUser,
        isOwner: room.members.length === 0,
        isOnline: true,
        virtualPoints: 100
      };
      room.members.push(member);
    }

    await room.save();

    const io = getIO();
    if (io) {
      io.to(code).emit('user_joined', {
        user: member,
        members: room.members,
        message: `${trimmedUser} joined via API`
      });
      io.to(code).emit('room_members_updated', {
        members: room.members,
        onlineCount: room.members.filter((m) => m.isOnline).length
      });
    }

    res.status(200).json({
      success: true,
      message: `Joined room ${code}`,
      data: room
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Leave a room
 * @route POST /api/rooms/:code/leave
 */
export const leaveRoom = async (req, res, next) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const { username } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Username is required to leave' });
    }

    const trimmedUser = username.trim();
    const room = await Room.findOne({ code, status: 'active' });

    if (!room) {
      return res.status(404).json({ success: false, message: `Room "${code}" not found` });
    }

    const memberIdx = room.members.findIndex(
      (m) => m.username.toLowerCase() === trimmedUser.toLowerCase()
    );

    if (memberIdx !== -1) {
      room.members.splice(memberIdx, 1);

      const remainingHumans = room.members.filter((m) => !isBotUser(m.username));
      if (remainingHumans.length === 0) {
        // No human members left; mark room inactive and clear lingering bots
        room.status = 'inactive';
        room.members = [];
      } else if (room.owner.username === trimmedUser && remainingHumans.length > 0) {
        // Reassign ownership to next online human
        const nextOwner = remainingHumans.find((m) => m.isOnline) || remainingHumans[0];
        nextOwner.isOwner = true;
        room.owner.username = nextOwner.username;
      }

      await room.save();

      const io = getIO();
      if (io) {
        io.to(code).emit('user_left', {
          username: trimmedUser,
          members: room.members,
          newOwner: room.owner,
          message: `${trimmedUser} left the room`
        });
        io.to(code).emit('room_members_updated', {
          members: room.members,
          onlineCount: room.members.filter((m) => m.isOnline).length
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Left room ${code}`,
      remainingMembers: room.members.length
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Share a draft with the room
 * @route POST /api/rooms/:code/share-draft
 */
export const shareDraftToRoom = async (req, res, next) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const { draftId, sharedBy } = req.body;

    if (!draftId) {
      return res.status(400).json({ success: false, message: 'draftId is required' });
    }

    const [room, draft] = await Promise.all([
      Room.findOne({ code, status: 'active' }),
      Draft.findById(draftId)
    ]);

    if (!room) {
      return res.status(404).json({ success: false, message: `Room "${code}" not found` });
    }
    if (!draft) {
      return res.status(404).json({ success: false, message: 'Draft not found' });
    }

    room.activeDraft = {
      draftId: draft._id,
      title: draft.title,
      fileUrl: draft.fileUrl,
      duration: draft.duration,
      effectApplied: draft.effectApplied,
      waveformPeaks: draft.waveformPeaks,
      sharedBy: sharedBy || draft.createdBy || 'Artist',
      sharedAt: new Date()
    };

    await room.save();

    // Broadcast mandatory draft_shared event via Socket.IO
    const io = getIO();
    if (io) {
      io.to(code).emit('draft_shared', {
        activeDraft: room.activeDraft,
        sharedBy: room.activeDraft.sharedBy,
        message: `${room.activeDraft.sharedBy} shared "${room.activeDraft.title}" with the room`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Draft broadcasted to room successfully',
      data: room.activeDraft
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Start Spin Wheel
 * @route POST /api/rooms/:code/spin/start
 */
export const startSpin = async (req, res, next) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const { username, intervalMs } = req.body;
    const io = getIO();

    const { game, room } = await startSpinGame(code, username, io, intervalMs || 5000);

    res.status(200).json({
      success: true,
      message: 'Spin wheel started successfully',
      data: {
        gameId: game._id,
        initialPlayers: game.initialPlayers,
        startedBy: game.startedBy,
        startedAt: game.startedAt,
        spinState: room.spinState
      }
    });
  } catch (err) {
    if (
      err.message.includes('Minimum 3') ||
      err.message.includes('Only the room owner') ||
      err.message.includes('already in progress') ||
      err.message.includes('Maximum 20') ||
      err.message.includes('not found')
    ) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * @desc Get current spin state and active game
 * @route GET /api/rooms/:code/spin
 */
export const getRoomSpinState = async (req, res, next) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const state = await getSpinState(code);
    if (!state) {
      return res.status(404).json({ success: false, message: `Room "${code}" not found` });
    }
    res.status(200).json({
      success: true,
      data: state
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Get spin game audit history for room
 * @route GET /api/rooms/:code/spin/history
 */
export const getRoomSpinHistory = async (req, res, next) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const history = await getSpinHistory(code);
    res.status(200).json({
      success: true,
      data: history
    });
  } catch (err) {
    next(err);
  }
};

