import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { Draft } from '../src/models/Draft.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Draft.deleteMany({});
});

describe('Roxstar Voice Draft API Suite', () => {
  describe('GET /health', () => {
    it('should return UP status and service name', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.service).toContain('Roxstar');
    });
  });

  describe('POST /api/drafts', () => {
    it('should reject request without audio file', async () => {
      const res = await request(app)
        .post('/api/drafts')
        .field('title', 'My Test Vocal');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Audio file is required/i);
    });

    it('should reject request without title', async () => {
      const dummyBuffer = Buffer.from('RIFF....WAVEfmt ....data....');
      const res = await request(app)
        .post('/api/drafts')
        .attach('audio', dummyBuffer, 'test.wav');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Draft title is required/i);
    });

    it('should successfully save draft with audio, effect and metadata', async () => {
      const dummyBuffer = Buffer.from('RIFF44WAVEfmt 16000data....');
      const res = await request(app)
        .post('/api/drafts')
        .field('title', 'Echo Chorus Take 1')
        .field('duration', '8.4')
        .field('effectApplied', 'echo')
        .field('effectParams', JSON.stringify({ echoDelay: 0.3, echoFeedback: 0.5 }))
        .field('waveformPeaks', JSON.stringify([0.1, 0.4, 0.9, 0.5, 0.2]))
        .attach('audio', dummyBuffer, 'take1.wav');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Echo Chorus Take 1');
      expect(res.body.data.duration).toBe(8.4);
      expect(res.body.data.effectApplied).toBe('echo');
      expect(res.body.data.effectParams.echoDelay).toBe(0.3);
      expect(res.body.data.fileUrl).toContain('/api/drafts/audio/');
    });
  });

  describe('GET /api/drafts', () => {
    it('should list saved drafts sorted by latest first', async () => {
      await Draft.create([
        {
          title: 'Draft 1',
          fileName: 'draft1.wav',
          fileUrl: '/api/drafts/audio/draft1.wav',
          duration: 5.2,
          effectApplied: 'none'
        },
        {
          title: 'Draft 2 (Reverb)',
          fileName: 'draft2.wav',
          fileUrl: '/api/drafts/audio/draft2.wav',
          duration: 10.1,
          effectApplied: 'reverb'
        }
      ]);

      const res = await request(app).get('/api/drafts');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.total).toBe(2);
    });

    it('should filter drafts by applied effect', async () => {
      await Draft.create([
        {
          title: 'Echo Take',
          fileName: 'echo.wav',
          fileUrl: '/api/drafts/audio/echo.wav',
          duration: 4.0,
          effectApplied: 'echo'
        },
        {
          title: 'Clean Take',
          fileName: 'clean.wav',
          fileUrl: '/api/drafts/audio/clean.wav',
          duration: 6.0,
          effectApplied: 'none'
        }
      ]);

      const res = await request(app).get('/api/drafts?effect=echo');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].effectApplied).toBe('echo');
    });
  });

  describe('GET /api/drafts/:id', () => {
    it('should return draft by id', async () => {
      const created = await Draft.create({
        title: 'Single Draft',
        fileName: 'single.wav',
        fileUrl: '/api/drafts/audio/single.wav',
        duration: 3.5,
        effectApplied: 'pitch_shift'
      });

      const res = await request(app).get(`/api/drafts/${created._id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Single Draft');
      expect(res.body.data.effectApplied).toBe('pitch_shift');
    });

    it('should return 404 for non-existent id', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/drafts/${nonExistentId}`);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/drafts/:id', () => {
    it('should delete draft from database', async () => {
      const created = await Draft.create({
        title: 'To Delete',
        fileName: 'delete_me.wav',
        fileUrl: '/api/drafts/audio/delete_me.wav',
        duration: 2.0
      });

      const res = await request(app).delete(`/api/drafts/${created._id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const findDeleted = await Draft.findById(created._id);
      expect(findDeleted).toBeNull();
    });
  });
});
