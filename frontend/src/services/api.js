const API_BASE = '/api/drafts';

export const api = {
  async getDrafts(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}${query ? `?${query}` : ''}`);
    if (!res.ok) throw new Error(`Failed to fetch drafts: ${res.statusText}`);
    return res.json();
  },

  async getDraftById(id) {
    const res = await fetch(`${API_BASE}/${id}`);
    if (!res.ok) throw new Error(`Draft not found: ${res.statusText}`);
    return res.json();
  },

  async createDraft({ title, audioBlob, duration, effectApplied, effectParams, waveformPeaks, createdBy }) {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('audio', audioBlob, `${title.replace(/\s+/g, '_')}.wav`);
    formData.append('duration', duration.toString());
    formData.append('effectApplied', effectApplied || 'none');
    formData.append('effectParams', JSON.stringify(effectParams || {}));
    formData.append('waveformPeaks', JSON.stringify(waveformPeaks || []));
    formData.append('createdBy', createdBy || 'Guest Artist');

    const res = await fetch(API_BASE, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Failed to save draft (${res.status})`);
    }

    return res.json();
  },

  async deleteDraft(id) {
    const cleanId = String(id).trim();
    const res = await fetch(`${API_BASE}/${cleanId}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to delete draft (${res.status})`);
    }
    return res.json();
  },

  getAudioUrl(pathOrFilename) {
    if (!pathOrFilename) return '';
    if (pathOrFilename.startsWith('http')) return pathOrFilename;
    if (pathOrFilename.startsWith('/')) return pathOrFilename;
    return `${API_BASE}/audio/${pathOrFilename}`;
  },

  // Room Endpoints (Section B1)
  async createRoom({ name, username }) {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create room');
    }
    return res.json();
  },

  async getRooms() {
    const res = await fetch('/api/rooms');
    if (!res.ok) throw new Error('Failed to fetch rooms');
    return res.json();
  },

  async getRoomByCode(code) {
    const res = await fetch(`/api/rooms/${code}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Room not found');
    }
    return res.json();
  },

  async joinRoom(code, username) {
    const res = await fetch(`/api/rooms/${code}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to join room');
    }
    return res.json();
  },

  async leaveRoom(code, username) {
    const res = await fetch(`/api/rooms/${code}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    if (!res.ok) throw new Error('Failed to leave room');
    return res.json();
  },

  async shareDraftToRoom(code, draftId, sharedBy) {
    const res = await fetch(`/api/rooms/${code}/share-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId, sharedBy })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to share draft with room');
    }
    return res.json();
  },

  // Spin Wheel Endpoints (Phase 3 - Section D1)
  async startSpin(code, username, intervalMs = 5000) {
    const res = await fetch(`/api/rooms/${code}/spin/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, intervalMs })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to start spin wheel');
    }
    return res.json();
  },

  async getSpinState(code) {
    const res = await fetch(`/api/rooms/${code}/spin`);
    if (!res.ok) throw new Error('Failed to get spin state');
    return res.json();
  },

  async getSpinHistory(code) {
    const res = await fetch(`/api/rooms/${code}/spin/history`);
    if (!res.ok) throw new Error('Failed to get spin history');
    return res.json();
  }
};


