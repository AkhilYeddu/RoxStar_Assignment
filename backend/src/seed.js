import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Draft } from './models/Draft.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Generate valid minimal PCM WAV file
function createWavBuffer(seconds = 3, freq = 440) {
  const sampleRate = 44100;
  const numSamples = sampleRate * seconds;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.5 * Math.exp(-t * 0.3);
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return buffer;
}

export async function seedInitialDrafts() {
  const count = await Draft.countDocuments();
  if (count > 0) return;

  const draftsData = [
    {
      title: 'Acoustic Intro Harmony',
      filename: 'sample_acoustic_harmony.wav',
      duration: 4.8,
      effectApplied: 'reverb',
      effectParams: { reverbRoomSize: 2.2, reverbMix: 0.5 },
      waveformPeaks: [0.1, 0.3, 0.7, 0.9, 0.6, 0.4, 0.2, 0.5, 0.8, 0.6, 0.3, 0.1],
      createdBy: 'Sarah Vox'
    },
    {
      title: 'Cyber Chorus Vocal Lead',
      filename: 'sample_cyber_chorus.wav',
      duration: 6.2,
      effectApplied: 'echo',
      effectParams: { echoDelay: 0.28, echoFeedback: 0.45 },
      waveformPeaks: [0.2, 0.5, 0.85, 1.0, 0.9, 0.75, 0.4, 0.6, 0.95, 0.8, 0.4, 0.2],
      createdBy: 'DJ Roxx'
    },
    {
      title: 'Sub-Bass Demon Growl',
      filename: 'sample_demon_growl.wav',
      duration: 3.5,
      effectApplied: 'pitch_shift',
      effectParams: { pitchShiftSemitones: -7 },
      waveformPeaks: [0.4, 0.8, 0.9, 0.7, 0.85, 0.6, 0.3, 0.2],
      createdBy: 'BassMaster'
    }
  ];

  for (const item of draftsData) {
    const filePath = path.join(uploadDir, item.filename);
    if (!fs.existsSync(filePath)) {
      const wav = createWavBuffer(Math.round(item.duration), item.effectApplied === 'pitch_shift' ? 220 : 440);
      fs.writeFileSync(filePath, wav);
    }

    await Draft.create({
      title: item.title,
      fileName: item.filename,
      fileUrl: `/api/drafts/audio/${item.filename}`,
      mimeType: 'audio/wav',
      duration: item.duration,
      fileSize: 44 + Math.round(item.duration * 44100 * 2),
      effectApplied: item.effectApplied,
      effectParams: item.effectParams,
      waveformPeaks: item.waveformPeaks,
      createdBy: item.createdBy
    });
  }

  console.log('[Seed] Initial audio drafts seeded successfully.');
}
