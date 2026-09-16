import { Room } from '../models/Room.js';
import { SpinGame } from '../models/SpinGame.js';

// ─── Deterministic seeded PRNG (Mulberry32) ───────────────────────────────────
// We use a seeded PRNG so that any auditor can reproduce the exact elimination
// sequence by replaying the same seed against the same initial player list.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle(array, seed) {
  const rand = mulberry32(seed);
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── In-memory engine state ────────────────────────────────────────────────────
// Map<roomCode, { io, timer, gameId, remaining[], elimOrder, intervalMs }>
const activeEngines = new Map();

// ─── START spin game ───────────────────────────────────────────────────────────
export async function startSpinGame(roomCode, requestingUser, io, intervalMs = 5000) {
  const room = await Room.findOne({ code: roomCode, status: 'active' });
  if (!room) throw new Error('Room not found or inactive');

  // Edge Case 1: Room Owner / Admin verification
  if (requestingUser && room.owner.username !== requestingUser) {
    throw new Error('Only the room owner can start the spin wheel');
  }

  // Edge Case 2: Duplicate start request / idempotency
  if (activeEngines.has(roomCode) || room.spinState?.status === 'RUNNING') {
    throw new Error('A spin is already in progress in this room');
  }

  // Edge Case 3: Participant eligibility validation (Min 3, Max 20 online players)
  const onlineMembers = room.members.filter((m) => m.isOnline);
  if (onlineMembers.length < 3) {
    throw new Error(`Minimum 3 online players required to start Spin Wheel (currently ${onlineMembers.length})`);
  }
  if (onlineMembers.length > 20) {
    throw new Error(`Maximum 20 players allowed (currently ${onlineMembers.length})`);
  }

  const seed = Math.floor(Math.random() * 1_000_000);
  const playerUsernames = onlineMembers.map((m) => m.username);
  const shuffledOrder = seededShuffle(playerUsernames, seed);

  // Create audit record in database
  const game = await SpinGame.create({
    roomCode: room.code,
    roomName: room.name,
    status: 'RUNNING',
    startedBy: room.owner.username,
    startedAt: new Date(),
    initialPlayers: shuffledOrder,
    seed
  });

  // Update room spin state
  room.spinState.status = 'RUNNING';
  room.spinState.currentSpinId = game._id;
  room.spinState.winner = null;
  await room.save();

  // Initialize engine context
  const ctx = {
    io,
    gameId: game._id.toString(),
    roomCode,
    seed,
    remaining: [...shuffledOrder],
    elimOrder: 0,
    timer: null,
    intervalMs
  };
  activeEngines.set(roomCode, ctx);

  // Broadcast mandatory event: spin_started
  io.to(roomCode).emit('spin_started', {
    gameId: ctx.gameId,
    players: shuffledOrder,
    seed,
    startedBy: room.owner.username,
    startedAt: game.startedAt,
    intervalMs
  });

  console.log(`[Spin Engine] Spin started in ${roomCode} with ${shuffledOrder.length} players. Seed: ${seed}`);

  // Kick off first elimination
  scheduleNextElimination(ctx, game);

  return { game, room };
}

// ─── Schedule next elimination tick (5s default) ──────────────────────────────
function scheduleNextElimination(ctx, game) {
  ctx.timer = setTimeout(async () => {
    try {
      if (!activeEngines.has(ctx.roomCode)) return; // engine was aborted

      // Guard: if DB disconnected (e.g. test teardown), abort cleanly
      const mongoose = (await import('mongoose')).default;
      if (mongoose.connection.readyState !== 1) {
        activeEngines.delete(ctx.roomCode);
        return;
      }

      ctx.elimOrder += 1;

      // Edge Case: Check remaining players count
      if (ctx.remaining.length <= 1) {
        const winner = ctx.remaining[0] ?? null;
        await finaliseGame(ctx, game, winner);
        return;
      }


      // Eliminate the next participant in the deterministic sequence
      const eliminated = ctx.remaining.shift();

      // Persist elimination in SpinGame audit log
      game.eliminations.push({
        username: eliminated,
        eliminationOrder: ctx.elimOrder,
        eliminatedAt: new Date()
      });
      await game.save();

      // Broadcast mandatory event: user_eliminated
      ctx.io.to(ctx.roomCode).emit('user_eliminated', {
        gameId: ctx.gameId,
        username: eliminated,
        eliminationOrder: ctx.elimOrder,
        remaining: [...ctx.remaining],
        timestamp: new Date()
      });

      console.log(`[Spin Engine] Eliminated: ${eliminated} (#${ctx.elimOrder}) in ${ctx.roomCode}. Remaining: ${ctx.remaining.length}`);

      if (ctx.remaining.length === 1) {
        // Only one player remains -> finalize
        const winner = ctx.remaining[0];
        await finaliseGame(ctx, game, winner);
      } else {
        scheduleNextElimination(ctx, game);
      }
    } catch (err) {
      console.error('[Spin Engine] Elimination tick error:', err);
    }
  }, ctx.intervalMs || 5000);
}

// ─── Finalise game & crown winner ─────────────────────────────────────────────
async function finaliseGame(ctx, game, winner) {
  clearTimer(ctx);
  activeEngines.delete(ctx.roomCode);

  const WINNER_POINTS = 500;

  game.status = 'COMPLETED';
  game.winner = winner;
  game.pointsAwarded = WINNER_POINTS;
  game.completedAt = new Date();
  await game.save();

  // Update room state
  await Room.findOneAndUpdate(
    { code: ctx.roomCode },
    {
      'spinState.status': 'COMPLETED',
      'spinState.winner': winner
    }
  );

  // Award virtual points to winner in room members list
  if (winner) {
    await Room.findOneAndUpdate(
      { code: ctx.roomCode, 'members.username': winner },
      { $inc: { 'members.$.virtualPoints': WINNER_POINTS } }
    );
  }

  // Broadcast mandatory event: winner_announced
  ctx.io.to(ctx.roomCode).emit('winner_announced', {
    gameId: ctx.gameId,
    winner,
    pointsAwarded: WINNER_POINTS,
    totalPlayers: game.initialPlayers.length,
    eliminations: game.eliminations,
    completedAt: game.completedAt
  });

  console.log(`[Spin Engine] 🏆 Winner in ${ctx.roomCode}: ${winner} (+${WINNER_POINTS} pts)`);
}

// ─── Edge Case 4: Handle Player Departure During Spin ─────────────────────────
export async function handlePlayerDeparture(roomCode, username, io) {
  const ctx = activeEngines.get(roomCode);
  if (!ctx) return;

  const idx = ctx.remaining.indexOf(username);
  if (idx !== -1) {
    ctx.remaining.splice(idx, 1);
    console.log(`[Spin Engine] Player ${username} departed during active spin in ${roomCode}. Remaining: ${ctx.remaining.length}`);

    // If remaining drop to 1, crown the last one standing
    if (ctx.remaining.length === 1) {
      const winner = ctx.remaining[0];
      const game = await SpinGame.findById(ctx.gameId);
      if (game) {
        await finaliseGame(ctx, game, winner);
      }
    } else if (ctx.remaining.length === 0) {
      // If everyone left, abort
      await abortSpinEngine(roomCode, io, 'All participants left the room during spin');
    }
  }
}

// ─── Edge Case 5: Abort spin engine ───────────────────────────────────────────
export async function abortSpinEngine(roomCode, io, reason = 'aborted') {
  const ctx = activeEngines.get(roomCode);
  if (!ctx) return;

  clearTimer(ctx);
  activeEngines.delete(roomCode);

  await SpinGame.findByIdAndUpdate(ctx.gameId, {
    status: 'ABORTED',
    completedAt: new Date()
  });

  await Room.findOneAndUpdate(
    { code: roomCode },
    { 'spinState.status': 'ABORTED', 'spinState.winner': null }
  );

  io.to(roomCode).emit('spin_aborted', { gameId: ctx.gameId, reason });
  console.log(`[Spin Engine] Spin aborted in ${roomCode}: ${reason}`);
}

function clearTimer(ctx) {
  if (ctx?.timer) {
    clearTimeout(ctx.timer);
    ctx.timer = null;
  }
}

// ─── Inspection & History queries ─────────────────────────────────────────────
export async function getSpinState(roomCode) {
  const room = await Room.findOne({ code: roomCode, status: 'active' });
  if (!room) return null;

  const ctx = activeEngines.get(roomCode);
  let activeGame = null;
  if (room.spinState?.currentSpinId) {
    activeGame = await SpinGame.findById(room.spinState.currentSpinId).lean();
  }

  return {
    spinState: room.spinState,
    isRunning: Boolean(ctx),
    remaining: ctx ? ctx.remaining : [],
    game: activeGame
  };
}

export async function getSpinHistory(roomCode) {
  return SpinGame.find({ roomCode }).sort({ createdAt: -1 }).limit(10).lean();
}

export function isEngineActive(roomCode) {
  return activeEngines.has(roomCode);
}
