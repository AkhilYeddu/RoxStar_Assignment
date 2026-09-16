import request from 'supertest';
import mongoose from 'mongoose';
import http from 'http';
import { io as ClientIO } from 'socket.io-client';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { Room } from '../src/models/Room.js';
import { SpinGame } from '../src/models/SpinGame.js';
import { initSocket } from '../src/socket/roomSocket.js';
import { seededShuffle } from '../src/services/spinEngine.js';

let mongoServer;
let httpServer;
let serverPort;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  httpServer = http.createServer(app);
  initSocket(httpServer);

  await new Promise((resolve) => {
    httpServer.listen(0, () => {
      serverPort = httpServer.address().port;
      resolve();
    });
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  await new Promise((resolve) => httpServer.close(resolve));
});

beforeEach(async () => {
  await Room.deleteMany({});
  await SpinGame.deleteMany({});
});

describe('Roxstar Spin Wheel Logic and Reasoning Suite (Section C & D)', () => {
  describe('C1 & C2: Deterministic PRNG and Core Rules', () => {
    it('seededShuffle must produce identical deterministic results for the same seed', () => {
      const players = ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve'];
      const seed = 482910;

      const order1 = seededShuffle(players, seed);
      const order2 = seededShuffle(players, seed);
      const order3 = seededShuffle(players, 999999);

      expect(order1).toEqual(order2);
      expect(order1).toHaveLength(players.length);
      // Different seed should result in different order (with overwhelming probability)
      expect(order1).not.toEqual(order3);
    });

    it('should reject spin start if fewer than 3 online players are present', async () => {
      const room = await Room.create({
        name: 'Under-capacity Lounge',
        code: 'MIN001',
        owner: { username: 'HostUser' },
        status: 'active',
        members: [
          { username: 'HostUser', isOwner: true, isOnline: true, virtualPoints: 100 },
          { username: 'GuestTwo', isOwner: false, isOnline: true, virtualPoints: 100 }
        ]
      });

      const res = await request(app)
        .post(`/api/rooms/${room.code}/spin/start`)
        .send({ username: 'HostUser' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Minimum 3 online players required/);
    });

    it('should reject spin start if requested by a non-owner user', async () => {
      const room = await Room.create({
        name: 'Trio Arena',
        code: 'TRIO01',
        owner: { username: 'RealHost' },
        status: 'active',
        members: [
          { username: 'RealHost', isOwner: true, isOnline: true, virtualPoints: 100 },
          { username: 'Impostor', isOwner: false, isOnline: true, virtualPoints: 100 },
          { username: 'ThirdUser', isOwner: false, isOnline: true, virtualPoints: 100 }
        ]
      });

      const res = await request(app)
        .post(`/api/rooms/${room.code}/spin/start`)
        .send({ username: 'Impostor' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Only the room owner can start/);
    });
  });

  describe('C2, C3, B2: Full Spin Wheel Elimination Lifecycle & WebSocket Broadcasting', () => {
    let clientOwner;
    let clientTwo;
    let clientThree;

    afterEach(() => {
      if (clientOwner?.connected) clientOwner.disconnect();
      if (clientTwo?.connected) clientTwo.disconnect();
      if (clientThree?.connected) clientThree.disconnect();
    });

    it(
      'should start spin, emit eliminations, crown exactly one winner, and award 500 virtual points',
      async () => {
      // 1. Setup room with 3 members
      const room = await Room.create({
        name: 'Championship Stage',
        code: 'SPIN99',
        owner: { username: 'HostAce' },
        status: 'active',
        members: [
          { username: 'HostAce', isOwner: true, isOnline: true, virtualPoints: 100 },
          { username: 'SingerBob', isOwner: false, isOnline: true, virtualPoints: 100 },
          { username: 'DrummerCid', isOwner: false, isOnline: true, virtualPoints: 100 }
        ]
      });

      const socketUrl = `http://localhost:${serverPort}`;

      // Connect 3 socket clients
      clientOwner = ClientIO(socketUrl, { transports: ['websocket'] });
      clientTwo = ClientIO(socketUrl, { transports: ['websocket'] });
      clientThree = ClientIO(socketUrl, { transports: ['websocket'] });

      await new Promise((res) => clientOwner.on('connect', res));
      await new Promise((res) => clientTwo.on('connect', res));
      await new Promise((res) => clientThree.on('connect', res));

      clientOwner.emit('join_room', { roomCode: 'SPIN99', username: 'HostAce' });
      clientTwo.emit('join_room', { roomCode: 'SPIN99', username: 'SingerBob' });
      clientThree.emit('join_room', { roomCode: 'SPIN99', username: 'DrummerCid' });

      await new Promise((res) => setTimeout(res, 100));

      // Listen for mandatory WebSocket events
      const spinStartedPromise = new Promise((resolve) => {
        clientTwo.on('spin_started', (data) => resolve(data));
      });

      const eliminations = [];
      clientTwo.on('user_eliminated', (data) => {
        eliminations.push(data);
      });

      const winnerPromise = new Promise((resolve) => {
        clientTwo.on('winner_announced', (data) => resolve(data));
      });

      // Start spin with accelerated 50ms elimination timer for fast test execution
      const startRes = await request(app)
        .post('/api/rooms/SPIN99/spin/start')
        .send({ username: 'HostAce', intervalMs: 50 });

      expect(startRes.status).toBe(200);
      expect(startRes.body.success).toBe(true);

      // Verify spin_started event
      const spinStartData = await spinStartedPromise;
      expect(spinStartData.players).toHaveLength(3);
      expect(typeof spinStartData.seed).toBe('number');
      expect(spinStartData.startedBy).toBe('HostAce');

      // Verify winner_announced event (within 1 second)
      const winnerData = await winnerPromise;
      expect(winnerData.winner).toBeDefined();
      expect(winnerData.pointsAwarded).toBe(500);
      expect(winnerData.totalPlayers).toBe(3);
      expect(winnerData.eliminations).toHaveLength(2); // In 3-player game, exactly 2 are eliminated

      // Verify eliminations order
      expect(eliminations).toHaveLength(2);
      expect(eliminations[0].eliminationOrder).toBe(1);
      expect(eliminations[1].eliminationOrder).toBe(2);
      expect(eliminations.map((e) => e.username)).not.toContain(winnerData.winner);

      // Verify database audit log
      const gameRecord = await SpinGame.findById(winnerData.gameId);
      expect(gameRecord).not.toBeNull();
      expect(gameRecord.status).toBe('COMPLETED');
      expect(gameRecord.winner).toBe(winnerData.winner);
      expect(gameRecord.pointsAwarded).toBe(500);

      // Verify winner was awarded points in Room member list
      const updatedRoom = await Room.findOne({ code: 'SPIN99' });
      const winningMember = updatedRoom.members.find((m) => m.username === winnerData.winner);
      expect(winningMember.virtualPoints).toBe(600); // 100 initial + 500 awarded
      },
      30000
    );
  });

  describe('C4: Edge-Case Handling & Reasoning', () => {
    it('Edge Case 1: Duplicate start request while running should be rejected with 400', async () => {
      await Room.create({
        name: 'High Roller Room',
        code: 'DUP001',
        owner: { username: 'BossUser' },
        status: 'active',
        members: [
          { username: 'BossUser', isOwner: true, isOnline: true, virtualPoints: 100 },
          { username: 'PlayerTwo', isOwner: false, isOnline: true, virtualPoints: 100 },
          { username: 'PlayerThree', isOwner: false, isOnline: true, virtualPoints: 100 }
        ]
      });

      // Start first spin with 5000ms normal timer
      const res1 = await request(app)
        .post('/api/rooms/DUP001/spin/start')
        .send({ username: 'BossUser', intervalMs: 5000 });

      expect(res1.status).toBe(200);

      // Attempt immediate duplicate start
      const res2 = await request(app)
        .post('/api/rooms/DUP001/spin/start')
        .send({ username: 'BossUser', intervalMs: 5000 });

      expect(res2.status).toBe(400);
      expect(res2.body.message).toMatch(/already in progress/);
    });

    it('Edge Case 2: Inspecting spin state and audit history via REST APIs', async () => {
      const room = await Room.create({
        name: 'History Club',
        code: 'HIST01',
        owner: { username: 'HostHist' },
        status: 'active',
        members: [
          { username: 'HostHist', isOwner: true, isOnline: true, virtualPoints: 100 },
          { username: 'HistGuest1', isOwner: false, isOnline: true, virtualPoints: 100 },
          { username: 'HistGuest2', isOwner: false, isOnline: true, virtualPoints: 100 }
        ]
      });

      // Run completed spin
      await request(app)
        .post('/api/rooms/HIST01/spin/start')
        .send({ username: 'HostHist', intervalMs: 30 });

      await new Promise((res) => setTimeout(res, 200));

      // Query GET /api/rooms/:code/spin
      const stateRes = await request(app).get('/api/rooms/HIST01/spin');
      expect(stateRes.status).toBe(200);
      expect(stateRes.body.success).toBe(true);
      expect(stateRes.body.data.spinState.status).toBe('COMPLETED');
      expect(stateRes.body.data.spinState.winner).toBeDefined();

      // Query GET /api/rooms/:code/spin/history
      const historyRes = await request(app).get('/api/rooms/HIST01/spin/history');
      expect(historyRes.status).toBe(200);
      expect(historyRes.body.success).toBe(true);
      expect(Array.isArray(historyRes.body.data)).toBe(true);
      expect(historyRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(historyRes.body.data[0].status).toBe('COMPLETED');
    });
  });
});
