import React, { useState, useEffect } from 'react';
import { AudioStudio } from './components/AudioStudio';
import { DraftList } from './components/DraftList';
import { RoomLobby } from './components/RoomLobby';
import { LiveRoom } from './components/LiveRoom';
import { api } from './services/api';
import { socketService } from './services/socket';
import {
  Mic2,
  Users,
  CircleDot,
  Radio,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

export function App() {
  const [currentView, setCurrentView] = useState('studio'); // 'studio' | 'rooms'
  const [activeRoom, setActiveRoom] = useState(null);
  const [currentUsername, setCurrentUsername] = useState('Roxstar Artist');

  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backendStatus, setBackendStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [toastMessage, setToastMessage] = useState('');

  // Fetch drafts from backend on mount
  const loadDrafts = async () => {
    try {
      setLoading(true);
      const res = await api.getDrafts();
      if (res.success) {
        setDrafts(res.data || []);
      }
    } catch (err) {
      console.warn('Could not load drafts:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Check backend health
  const checkHealth = async () => {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        setBackendStatus('online');
      } else {
        setBackendStatus('offline');
      }
    } catch {
      setBackendStatus('offline');
    }
  };

  useEffect(() => {
    loadDrafts();
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleDraftSaved = (newDraft) => {
    setDrafts((prev) => [newDraft, ...prev]);
    showToast(`Draft "${newDraft.title}" saved to library!`);
  };

  const handleDraftDeleted = (deletedId) => {
    setDrafts((prev) =>
      prev.filter(
        (d) =>
          d._id !== deletedId &&
          d.id !== deletedId &&
          String(d._id) !== String(deletedId) &&
          String(d.id) !== String(deletedId)
      )
    );
    showToast('Draft removed from storage.');
  };

  const handleShareToRoom = (draft) => {
    if (activeRoom) {
      socketService.shareDraft(activeRoom.code, {
        id: draft._id,
        title: draft.title,
        fileUrl: draft.fileUrl || `/api/drafts/audio/${draft.fileName}`,
        duration: draft.duration,
        effectApplied: draft.effectApplied,
        waveformPeaks: draft.waveformPeaks,
        sharedBy: currentUsername
      });
      setCurrentView('rooms');
      showToast(`Draft "${draft.title}" broadcasted to room ${activeRoom.code}!`);
    } else {
      setCurrentView('rooms');
      showToast(`Enter or create a room to broadcast "${draft.title}"!`);
    }
  };

  const handleEnterRoom = (room, username) => {
    setActiveRoom(room);
    setCurrentUsername(username);
    setCurrentView('rooms');
    showToast(`Entered room "${room.name}" as ${username}`);
  };

  const handleLeaveRoom = () => {
    setActiveRoom(null);
    showToast('Returned to Room Lobby');
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  return (
    <div className="app-shell" id="roxxstar-app">
      {/* Toast banner */}
      {toastMessage && (
        <div className="global-toast" id="global-toast">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP NAVIGATION BAR */}
      <header className="studio-header">
        <div className="header-brand">
          <div className="brand-logo-badge">
            <Radio className="brand-icon" size={24} />
          </div>
          <div className="brand-texts">
            <h1 className="brand-title">ROXSTAR</h1>
            <span className="brand-subtitle">Voice Draft & Room Engine</span>
          </div>
        </div>

        {/* Multi-Module Navigation Tabs */}
        <nav className="module-nav-pills">
          <button
            type="button"
            className={`nav-pill ${currentView === 'studio' ? 'active-pill' : 'inactive-tab-btn'}`}
            id="nav-module-voice"
            onClick={() => setCurrentView('studio')}
          >
            <Mic2 size={15} />
            <span>1. Voice Draft Studio</span>
            <span className="pill-status-active">ACTIVE</span>
          </button>

          <button
            type="button"
            className={`nav-pill ${currentView === 'rooms' ? 'active-pill' : 'inactive-tab-btn'}`}
            id="nav-module-room"
            onClick={() => setCurrentView('rooms')}
          >
            <Users size={15} />
            <span>2. Real-Time Rooms & Spin Wheel</span>
            {activeRoom ? (
              <span className="pill-status-in-room">IN ROOM: {activeRoom.code}</span>
            ) : (
              <span className="pill-status-active">ACTIVE</span>
            )}
          </button>
        </nav>

        {/* Backend health status pill */}
        <div className="header-status-group">
          <div className={`backend-indicator ${backendStatus}`} id="backend-status-indicator">
            <span className="status-ping"></span>
            <span className="status-label">
              {backendStatus === 'online'
                ? 'BACKEND & SOCKETS ONLINE'
                : backendStatus === 'offline'
                ? 'OFFLINE'
                : 'CONNECTING...'}
            </span>
          </div>
        </div>
      </header>

      {/* MAIN VIEW CONTROLLER */}
      <main className="studio-main-container">
        {currentView === 'studio' ? (
          <>
            {/* VIEW 1: AUDIO RECORDING STUDIO & DSP RACK */}
            <section className="studio-section">
              <AudioStudio onDraftSaved={handleDraftSaved} />
            </section>

            {/* DRAFT MANAGEMENT LIBRARY */}
            <section className="library-section">
              <DraftList
                drafts={drafts}
                loading={loading}
                onDraftDeleted={handleDraftDeleted}
                onShareToRoom={handleShareToRoom}
              />
            </section>
          </>
        ) : (
          /* VIEW 2: REAL-TIME ROOMS (SECTION B) */
          <section className="rooms-section" id="rooms-section">
            {activeRoom ? (
              <LiveRoom
                initialRoom={activeRoom}
                username={currentUsername}
                userDrafts={drafts}
                onLeaveRoom={handleLeaveRoom}
              />
            ) : (
              <RoomLobby
                onEnterRoom={handleEnterRoom}
                defaultUsername={currentUsername}
              />
            )}
          </section>
        )}
      </main>

      {/* FOOTER */}
      <footer className="studio-footer">
        <div className="footer-left">
          <span>Roxstar Assessment • Phase 1 (Voice DSP) &amp; Phase 2 (Real-Time Rooms &amp; Spin Wheel Engine)</span>
        </div>
        <div className="footer-right">
          <span className="footer-spec">Node.js + Express + Socket.IO + MongoDB + React</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
