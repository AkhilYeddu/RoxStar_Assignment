import request from 'supertest';
import mongoose from 'mongoose';
import http from 'http';
import { io as ClientIO } from 'socket.io-client';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { Room } from '../src/models/Room.js';
import { Draft } from '../src/models/Draft.js';
import { initSocket } from '../src/socket/roomSocket.js';

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
  await Draft.deleteMany({});
});

describe('Roxstar Room Management & Real-Time API Suite (Section B)', () => {
  describe('REST APIs - Section B1', () => {
    it('should reject room creation without name or username', async () => {
      const res = await request(app).post('/api/rooms').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should create a room with unique code and owner membership', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .send({ name: 'Studio One', username: 'Producer Jay' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Studio One');
      expect(res.body.data.code).toHaveLength(6);
      expect(res.body.data.owner.username).toBe('Producer Jay');
      expect(res.body.data.members).toHaveLength(1);
      expect(res.body.data.members[0].username).toBe('Producer Jay');
      expect(res.body.data.members[0].isOwner).toBe(true);
    });

    it('should get room details by code', async () => {
      const created = await Room.create({
        name: 'Vocal Chamber',
        code: 'VOCAL1',
        owner: { username: 'Singer Mia' },
        members: [{ username: 'Singer Mia', isOwner: true, isOnline: true }]
      });

      const res = await request(app).get(`/api/rooms/${created.code}`);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Vocal Chamber');
      expect(res.body.data.members).toHaveLength(1);
    });

    it('should join an active room', async () => {
      const room = await Room.create({
        name: 'Open Jam',
        code: 'JAM101',
        owner: { username: 'Host' },
        members: [{ username: 'Host', isOwner: true, isOnline: true }]
      });

      const res = await request(app)
        .post(`/api/rooms/${room.code}/join`)
        .send({ username: 'Guitarist Sam' });

      expect(res.status).toBe(200);
      expect(res.body.data.members).toHaveLength(2);
      expect(res.body.data.members.some((m) => m.username === 'Guitarist Sam')).toBe(true);
    });

    it('should share a saved draft with the room', async () => {
      const draft = await Draft.create({
        title: 'Lead Harmony',
        fileName: 'lead_harm.wav',
        fileUrl: '/api/drafts/audio/lead_harm.wav',
        duration: 8.5,
        effectApplied: 'reverb'
      });

      const room = await Room.create({
        name: 'Listening Room',
        code: 'LISTEN',
        owner: { username: 'DJ' },
        members: [{ username: 'DJ', isOwner: true, isOnline: true }]
      });

      const res = await request(app)
        .post(`/api/rooms/${room.code}/share-draft`)
        .send({ draftId: draft._id, sharedBy: 'DJ' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Lead Harmony');
      expect(res.body.data.fileUrl).toBe('/api/drafts/audio/lead_harm.wav');

      const updatedRoom = await Room.findOne({ code: 'LISTEN' });
      expect(updatedRoom.activeDraft.title).toBe('Lead Harmony');
    });

    it('should leave a room and clean presence', async () => {
      const room = await Room.create({
        name: 'Trio Lounge',
        code: 'TRIO99',
        owner: { username: 'Host' },
        members: [
          { username: 'Host', isOwner: true, isOnline: true },
          { username: 'Guest', isOwner: false, isOnline: true }
        ]
      });

      const res = await request(app)
        .post(`/api/rooms/${room.code}/leave`)
        .send({ username: 'Guest' });

      expect(res.status).toBe(200);
      expect(res.body.remainingMembers).toBe(1);

      const check = await Room.findOne({ code: 'TRIO99' });
      expect(check.members).toHaveLength(1);
      expect(check.members[0].username).toBe('Host');
    });
  });

  describe('WebSocket Events - Section B2', () => {
    let clientA;
    let clientB;

    beforeEach((done) => {
      clientA = ClientIO(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        forceNew: true
      });
      clientB = ClientIO(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        forceNew: true
      });

      let connectedCount = 0;
      const checkConnected = () => {
        connectedCount++;
        if (connectedCount === 2) done();
      };

      clientA.on('connect', checkConnected);
      clientB.on('connect', checkConnected);
    });

    afterEach(() => {
      if (clientA?.connected) clientA.disconnect();
      if (clientB?.connected) clientB.disconnect();
    });

    it('should emit room_state upon joining/reconnecting', (done) => {
      Room.create({
        name: 'Live Studio',
        code: 'LIVE01',
        owner: { username: 'Host' },
        members: [{ username: 'Host', isOwner: true, isOnline: true }]
      }).then(() => {
        clientA.on('room_state', (payload) => {
          expect(payload.room).toBeDefined();
          expect(payload.room.code).toBe('LIVE01');
          expect(payload.room.name).toBe('Live Studio');
          done();
        });

        clientA.emit('join_room', { roomCode: 'LIVE01', username: 'Host' });
      });
    });

    it('should broadcast user_joined when another client connects', (done) => {
      Room.create({
        name: 'Duo Room',
        code: 'DUO001',
        owner: { username: 'Host' },
        members: [{ username: 'Host', isOwner: true, isOnline: true }]
      }).then(() => {
        clientA.emit('join_room', { roomCode: 'DUO001', username: 'Host' });

        clientA.on('user_joined', (data) => {
          expect(data.user.username).toBe('NewGuest');
          expect(data.message).toContain('NewGuest joined');
          done();
        });

        // Delay slightly to ensure clientA has joined room channel
        setTimeout(() => {
          clientB.emit('join_room', { roomCode: 'DUO001', username: 'NewGuest' });
        }, 80);
      });
    });

    it('should broadcast draft_shared when a draft is broadcasted', (done) => {
      Room.create({
        name: 'Shared Space',
        code: 'SHARE1',
        owner: { username: 'Host' },
        members: [{ username: 'Host', isOwner: true, isOnline: true }]
      }).then(() => {
        clientA.emit('join_room', { roomCode: 'SHARE1', username: 'Host' });
        clientB.emit('join_room', { roomCode: 'SHARE1', username: 'Auditor' });

        clientB.on('draft_shared', (data) => {
          expect(data.activeDraft.title).toBe('Chorus Harmony');
          expect(data.sharedBy).toBe('Host');
          done();
        });

        setTimeout(() => {
          clientA.emit('share_draft', {
            roomCode: 'SHARE1',
            draft: {
              title: 'Chorus Harmony',
              fileUrl: '/api/drafts/audio/chorus.wav',
              duration: 5.4,
              effectApplied: 'echo',
              sharedBy: 'Host'
            }
          });
        }, 100);
      });
    });

    it('should broadcast user_left when a client leaves', (done) => {
      Room.create({
        name: 'Exit Room',
        code: 'EXIT01',
        owner: { username: 'Host' },
        members: [
          { username: 'Host', isOwner: true, isOnline: true },
          { username: 'LeavingUser', isOwner: false, isOnline: true }
        ]
      }).then(() => {
        clientA.emit('join_room', { roomCode: 'EXIT01', username: 'Host' });
        clientB.emit('join_room', { roomCode: 'EXIT01', username: 'LeavingUser' });

        clientA.on('user_left', (data) => {
          expect(data.username).toBe('LeavingUser');
          done();
        });

        setTimeout(() => {
          clientB.emit('leave_room', { roomCode: 'EXIT01', username: 'LeavingUser' });
        }, 100);
      });
    });
  });
});
