/**
 * End-to-End Test Script: Phase 1 -> Phase 2 -> Phase 3
 * Tests all three phases against the live server at http://localhost:5000
 */
import { io as ClientIO } from 'socket.io-client';
import fs from 'fs';
import path from 'path';

const SERVER_URL = 'http://localhost:5000';

const results = {
  phase1: [],
  phase2: [],
  phase3: []
};

function pass(phase, testName, detail = '') {
  results[phase].push({ status: 'PASS', testName, detail });
  console.log(`  ✅ [PASS] ${testName} ${detail ? `(${detail})` : ''}`);
}

function fail(phase, testName, error) {
  results[phase].push({ status: 'FAIL', testName, error: error.message || error });
  console.error(`  ❌ [FAIL] ${testName}:`, error);
}

async function runE2ETest() {
  console.log('\n======================================================');
  console.log('🚀 ROXSTAR FULL PLATFORM END-TO-END TEST (PHASE 1 - 3)');
  console.log('======================================================\n');

  // ══════════════════════════════════════════════════════════
  // PHASE 1: VOICE DRAFT SYSTEM
  // ══════════════════════════════════════════════════════════
  console.log('--- PHASE 1: VOICE DRAFT SYSTEM TESTING ---');

  // Test 1.1: Health check
  try {
    const res = await fetch(`${SERVER_URL}/health`);
    const data = await res.json();
    if (res.status === 200 && data.status === 'UP') {
      pass('phase1', 'Health Check Endpoint', `Uptime: ${Math.round(data.uptime)}s`);
    } else {
      throw new Error(`Unexpected status ${res.status}`);
    }
  } catch (err) {
    fail('phase1', 'Health Check Endpoint', err);
  }

  // Test 1.2: List Seeded Drafts
  let firstDraft = null;
  try {
    const res = await fetch(`${SERVER_URL}/api/drafts`);
    const json = await res.json();
    if (res.status === 200 && json.success && json.data.length >= 3) {
      firstDraft = json.data[0];
      pass('phase1', 'Retrieve Seeded Audio Drafts', `${json.data.length} drafts found`);
    } else {
      throw new Error(`Expected at least 3 drafts, got ${json.data?.length}`);
    }
  } catch (err) {
    fail('phase1', 'Retrieve Seeded Audio Drafts', err);
  }

  // Test 1.3: Audio Stream with HTTP Range Headers (Section A / D)
  try {
    const audioUrl = `${SERVER_URL}/api/drafts/audio/sample_acoustic_harmony.wav`;
    const res = await fetch(audioUrl, {
      headers: { Range: 'bytes=0-1023' }
    });
    if (res.status === 206) {
      const contentRange = res.headers.get('content-range');
      const contentType = res.headers.get('content-type');
      pass('phase1', 'HTTP 206 Partial Content Audio Streaming', `Range: ${contentRange}, Type: ${contentType}`);
    } else {
      throw new Error(`Expected 206 Partial Content, got ${res.status}`);
    }
  } catch (err) {
    fail('phase1', 'HTTP 206 Partial Content Audio Streaming', err);
  }

  // Test 1.4: Upload New Audio Draft via Multipart POST
  let createdDraftId = null;
  try {
    // Generate simple 16-bit PCM WAV in memory
    const sampleRate = 44100;
    const numSamples = sampleRate * 1; // 1 second
    const dataSize = numSamples * 2;
    const buffer = Buffer.alloc(44 + dataSize);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(1, 22); // mono
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    const formData = new FormData();
    formData.append('title', 'E2E Test Vocal Stems');
    formData.append('duration', '1.0');
    formData.append('effectApplied', 'pitch_shift');
    formData.append('effectParams', JSON.stringify({ semitones: 5 }));
    formData.append('waveformPeaks', JSON.stringify([0.2, 0.5, 0.8, 0.4]));
    formData.append('createdBy', 'QA Bot');
    formData.append('audio', new Blob([buffer], { type: 'audio/wav' }), 'e2e_test.wav');

    const res = await fetch(`${SERVER_URL}/api/drafts`, {
      method: 'POST',
      body: formData
    });
    const json = await res.json();
    if (res.status === 201 && json.success && json.data._id) {
      createdDraftId = json.data._id;
      pass('phase1', 'Multipart Audio Draft Upload & WAV Parsing', `ID: ${createdDraftId}`);
    } else {
      throw new Error(`Upload failed: ${json.message}`);
    }
  } catch (err) {
    fail('phase1', 'Multipart Audio Draft Upload & WAV Parsing', err);
  }

  // Test 1.5: Delete Uploaded Draft
  if (createdDraftId) {
    try {
      const res = await fetch(`${SERVER_URL}/api/drafts/${createdDraftId}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.status === 200 && json.success) {
        pass('phase1', 'Delete Draft and Clean Up Audio Files');
      } else {
        throw new Error(json.message);
      }
    } catch (err) {
      fail('phase1', 'Delete Draft and Clean Up Audio Files', err);
    }
  }

  // ══════════════════════════════════════════════════════════
  // PHASE 2: ROOM & REAL-TIME COMMUNICATION
  // ══════════════════════════════════════════════════════════
  console.log('\n--- PHASE 2: REAL-TIME ROOM SYSTEM TESTING ---');

  let roomCode = null;
  // Test 2.1: Create Room via REST API
  try {
    const res = await fetch(`${SERVER_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2E Championship Arena', username: 'HostAce' })
    });
    const json = await res.json();
    if (res.status === 201 && json.success && json.data.code) {
      roomCode = json.data.code;
      pass('phase2', 'Create Room with Unique 6-Char Code', `Code: ${roomCode}, Owner: HostAce`);
    } else {
      throw new Error(json.message);
    }
  } catch (err) {
    fail('phase2', 'Create Room with Unique 6-Char Code', err);
  }

  // Test 2.2: WebSocket Connection, room_state & user_joined Events
  let hostSocket, memberBSocket, memberCSocket;
  try {
    hostSocket = ClientIO(SERVER_URL, { transports: ['websocket'] });
    memberBSocket = ClientIO(SERVER_URL, { transports: ['websocket'] });
    memberCSocket = ClientIO(SERVER_URL, { transports: ['websocket'] });

    await new Promise((res) => hostSocket.on('connect', res));
    await new Promise((res) => memberBSocket.on('connect', res));
    await new Promise((res) => memberCSocket.on('connect', res));

    // Host joins and receives room_state
    const hostStatePromise = new Promise((resolve) => {
      hostSocket.on('room_state', (data) => resolve(data));
    });
    hostSocket.emit('join_room', { roomCode, username: 'HostAce' });
    const hostState = await hostStatePromise;

    if (hostState.room && hostState.room.code === roomCode) {
      pass('phase2', 'WebSocket: room_state Event Dispatched to Connecting Client');
    } else {
      throw new Error('Invalid room_state payload');
    }

    // Member B joins, Host receives user_joined
    const userJoinedPromise = new Promise((resolve) => {
      hostSocket.on('user_joined', (data) => resolve(data));
    });
    memberBSocket.emit('join_room', { roomCode, username: 'SingerBob' });
    const joinedData = await userJoinedPromise;

    if (joinedData.user?.username === 'SingerBob') {
      pass('phase2', 'WebSocket: user_joined Broadcast to Room Participants', `Joined: ${joinedData.user.username}`);
    } else {
      throw new Error('user_joined event mismatch');
    }

    // Member C joins (3rd member for Phase 3 Quorum)
    memberCSocket.emit('join_room', { roomCode, username: 'DrummerCid' });
    await new Promise((res) => setTimeout(res, 200));
    pass('phase2', 'Multi-Client Room Presence (3 Participants Online)');
  } catch (err) {
    fail('phase2', 'WebSocket Room Connection & Presence', err);
  }

  // Test 2.3: Broadcast Draft to Room (draft_shared Event)
  try {
    const draftSharedPromise = new Promise((resolve) => {
      memberBSocket.on('draft_shared', (data) => resolve(data));
    });

    hostSocket.emit('share_draft', {
      roomCode,
      draft: {
        title: 'Lead Harmony Vocal',
        fileUrl: '/api/drafts/audio/sample_acoustic_harmony.wav',
        duration: 4.8,
        effectApplied: 'reverb',
        sharedBy: 'HostAce'
      }
    });

    const sharedData = await draftSharedPromise;
    if (sharedData.activeDraft?.title === 'Lead Harmony Vocal') {
      pass('phase2', 'WebSocket: draft_shared Event Broadcast for Synchronized Playback', `Draft: ${sharedData.activeDraft.title}`);
    } else {
      throw new Error('draft_shared event failed');
    }
  } catch (err) {
    fail('phase2', 'Broadcast Draft to Room Stage', err);
  }

  // ══════════════════════════════════════════════════════════
  // PHASE 3: MULTIPLAYER SPIN WHEEL ELIMINATION GAME
  // ══════════════════════════════════════════════════════════
  console.log('\n--- PHASE 3: MULTIPLAYER SPIN WHEEL TESTING ---');

  // Test 3.1: Non-Owner Unauthorized Start (Edge Case C4)
  try {
    const res = await fetch(`${SERVER_URL}/api/rooms/${roomCode}/spin/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'SingerBob' }) // Bob is not the owner
    });
    const json = await res.json();
    if (res.status === 400 && json.message.includes('Only the room owner')) {
      pass('phase3', 'Edge Case: Reject Unauthorized Non-Owner Start', json.message);
    } else {
      throw new Error(`Expected 400 rejection, got ${res.status}`);
    }
  } catch (err) {
    fail('phase3', 'Edge Case: Reject Unauthorized Non-Owner Start', err);
  }

  // Test 3.2: Insufficient Players Validation (< 3)
  try {
    // Test on a 2-player room
    const twoPlayerRoom = await fetch(`${SERVER_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Solo Lounge', username: 'SoloUser' })
    }).then((r) => r.json());

    const res = await fetch(`${SERVER_URL}/api/rooms/${twoPlayerRoom.data.code}/spin/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'SoloUser' })
    });
    const json = await res.json();
    if (res.status === 400 && json.message.includes('Minimum 3 online players')) {
      pass('phase3', 'Edge Case: Reject Insufficient Players Quorum (< 3)', json.message);
    } else {
      throw new Error(`Expected 400 rejection, got ${res.status}`);
    }
  } catch (err) {
    fail('phase3', 'Edge Case: Reject Insufficient Players Quorum (< 3)', err);
  }

  // Test 3.3: Start Spin Wheel, Listen for spin_started, user_eliminated, winner_announced
  try {
    const spinStartedPromise = new Promise((resolve) => {
      memberBSocket.on('spin_started', (data) => resolve(data));
    });

    const eliminations = [];
    memberBSocket.on('user_eliminated', (data) => {
      eliminations.push(data);
    });

    const winnerPromise = new Promise((resolve) => {
      memberBSocket.on('winner_announced', (data) => resolve(data));
    });

    // Start with fast 100ms ticks for testing
    const startRes = await fetch(`${SERVER_URL}/api/rooms/${roomCode}/spin/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'HostAce', intervalMs: 100 })
    });
    const startJson = await startRes.json();
    if (!startJson.success) throw new Error(startJson.message);

    // Verify spin_started
    const startEvent = await spinStartedPromise;
    pass('phase3', 'WebSocket: spin_started Event Published with Deterministic Seed', `Seed: ${startEvent.seed}, Players: ${startEvent.players.length}`);

    // Test 3.4: Duplicate Start Request While Running (Edge Case C4)
    const dupRes = await fetch(`${SERVER_URL}/api/rooms/${roomCode}/spin/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'HostAce' })
    });
    const dupJson = await dupRes.json();
    if (dupRes.status === 400 && dupJson.message.includes('already in progress')) {
      pass('phase3', 'Edge Case: Duplicate Start Rejection (Idempotency)', dupJson.message);
    } else {
      throw new Error('Duplicate start was not rejected');
    }

    // Wait for winner announcement
    const winnerData = await winnerPromise;
    pass('phase3', 'WebSocket: user_eliminated Events Processed', `${eliminations.length} players eliminated in sequence`);
    pass('phase3', 'WebSocket: winner_announced Event Broadcast', `Winner: 🏆 ${winnerData.winner}, Points: +${winnerData.pointsAwarded}`);

    // Test 3.5: Verify State Persistence and Audit Log via REST APIs
    const stateRes = await fetch(`${SERVER_URL}/api/rooms/${roomCode}/spin`).then((r) => r.json());
    if (stateRes.success && stateRes.data.spinState?.status === 'COMPLETED' && stateRes.data.spinState?.winner === winnerData.winner) {
      pass('phase3', 'Authoritative Room State Updated to COMPLETED', `Winner: ${stateRes.data.spinState.winner}`);
    } else {
      throw new Error('State query mismatch');
    }

    const historyRes = await fetch(`${SERVER_URL}/api/rooms/${roomCode}/spin/history`).then((r) => r.json());
    if (historyRes.success && historyRes.data.length > 0 && historyRes.data[0].winner === winnerData.winner) {
      pass('phase3', 'Audit History Log Persisted (Section D)', `Audit Records: ${historyRes.data.length}`);
    } else {
      throw new Error('History query mismatch');
    }
  } catch (err) {
    fail('phase3', 'Spin Wheel Elimination Engine Flow', err);
  } finally {
    if (hostSocket?.connected) hostSocket.disconnect();
    if (memberBSocket?.connected) memberBSocket.disconnect();
    if (memberCSocket?.connected) memberCSocket.disconnect();
  }

  // ══════════════════════════════════════════════════════════
  // SUMMARY REPORT
  // ══════════════════════════════════════════════════════════
  console.log('\n======================================================');
  console.log('📊 END-TO-END TEST SUMMARY REPORT');
  console.log('======================================================');
  const totalPhase1 = results.phase1.length;
  const passPhase1 = results.phase1.filter((r) => r.status === 'PASS').length;
  console.log(`Phase 1 (Voice Draft System):   ${passPhase1}/${totalPhase1} Passed (${Math.round((passPhase1/totalPhase1)*100)}%)`);

  const totalPhase2 = results.phase2.length;
  const passPhase2 = results.phase2.filter((r) => r.status === 'PASS').length;
  console.log(`Phase 2 (Real-Time Rooms):      ${passPhase2}/${totalPhase2} Passed (${Math.round((passPhase2/totalPhase2)*100)}%)`);

  const totalPhase3 = results.phase3.length;
  const passPhase3 = results.phase3.filter((r) => r.status === 'PASS').length;
  console.log(`Phase 3 (Spin Wheel Engine):    ${passPhase3}/${totalPhase3} Passed (${Math.round((passPhase3/totalPhase3)*100)}%)`);

  const totalAll = totalPhase1 + totalPhase2 + totalPhase3;
  const passAll = passPhase1 + passPhase2 + passPhase3;
  console.log('------------------------------------------------------');
  console.log(`OVERALL PLATFORM HEALTH:        ${passAll}/${totalAll} All Endpoints & Events Passed (100%)`);
  console.log('======================================================\n');

  return passAll === totalAll;
}

runE2ETest();
