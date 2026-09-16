import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Users,
  PlusCircle,
  LogIn,
  RefreshCw,
  Sparkles,
  Radio,
  Disc3,
  ArrowRight,
  ShieldAlert,
  User,
  Check,
  Lock
} from 'lucide-react';

export const RoomLobby = ({ onEnterRoom, defaultUsername = 'Vocal Artist' }) => {
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [activeRoomUsername, setActiveRoomUsername] = useState(defaultUsername || 'Vocal Artist');

  // Create Room form state
  const [createName, setCreateName] = useState('');
  const [createUsername, setCreateUsername] = useState(defaultUsername);
  const [creating, setCreating] = useState(false);

  // Join Room form state
  const [joinCode, setJoinCode] = useState('');
  const [joinUsername, setJoinUsername] = useState(defaultUsername);
  const [joining, setJoining] = useState(false);

  // Error alerts
  const [errorMessage, setErrorMessage] = useState('');

  const fetchRooms = async () => {
    try {
      setLoadingRooms(true);
      const res = await api.getRooms();
      if (res.success) {
        setRooms(res.data || []);
      }
    } catch (err) {
      console.warn('Could not fetch rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(() => {
      api
        .getRooms()
        .then((res) => {
          if (res.success) {
            setRooms(res.data || []);
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!createName.trim() || !createUsername.trim()) {
      setErrorMessage('Please provide both room name and your username.');
      return;
    }

    try {
      setCreating(true);
      const res = await api.createRoom({
        name: createName.trim(),
        username: createUsername.trim()
      });

      if (res.success && res.data) {
        onEnterRoom(res.data, createUsername.trim());
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinByCode = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!joinCode.trim() || !joinUsername.trim()) {
      setErrorMessage('Please enter room code and your username.');
      return;
    }

    try {
      setJoining(true);
      const res = await api.joinRoom(joinCode.trim().toUpperCase(), joinUsername.trim());
      if (res.success && res.data) {
        onEnterRoom(res.data, joinUsername.trim());
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to join room');
    } finally {
      setJoining(false);
    }
  };

  const handleQuickJoin = async (room) => {
    setErrorMessage('');
    try {
      const res = await api.joinRoom(room.code, joinUsername.trim() || 'Artist');
      if (res.success && res.data) {
        onEnterRoom(res.data, joinUsername.trim() || 'Artist');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to join room');
    }
  };

  return (
    <div className="room-lobby-container" id="room-lobby">
      <div className="lobby-hero-banner">
        <div className="hero-text-col">
          <div className="lobby-badge">
            <Radio size={15} />
            <span>REAL-TIME MULTIPLAYER AUDIO ROOMS</span>
          </div>
          <h2>Collaborative Audio Lounges</h2>
          <p>
            Connect with artists in real-time, broadcast your voice drafts with synchronized playback,
            and compete in multiplayer spin wheel eliminations.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="studio-alert-error" id="lobby-error-alert">
          <ShieldAlert size={18} />
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage('')} className="alert-dismiss-btn">
            ✕
          </button>
        </div>
      )}

      {/* Action Cards Grid: Create Room & Join by Code */}
      <div className="lobby-action-grid">
        {/* CREATE ROOM CARD */}
        <div className="lobby-card create-card" id="card-create-room">
          <div className="card-header">
            <PlusCircle className="card-icon cyan-icon" size={22} />
            <h3>Create a New Room</h3>
          </div>
          <p className="card-desc">Start an authoritative live audio room as the owner/host.</p>

          <form onSubmit={handleCreateRoom} className="lobby-form">
            <div className="form-group">
              <label htmlFor="create-room-name">Room Title</label>
              <input
                id="create-room-name"
                type="text"
                placeholder="e.g. Late Night Cypher #1"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="create-host-username">Host Username</label>
              <input
                id="create-host-username"
                type="text"
                placeholder="e.g. Master Producer"
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              id="submit-create-room-btn"
              className="primary-lobby-btn"
              disabled={creating}
            >
              <Sparkles size={16} />
              <span>{creating ? 'Creating Room...' : 'Create & Enter Room'}</span>
            </button>
          </form>
        </div>

        {/* JOIN BY CODE CARD */}
        <div className="lobby-card join-card" id="card-join-room">
          <div className="card-header">
            <LogIn className="card-icon violet-icon" size={22} />
            <h3>Join by Room Code</h3>
          </div>
          <p className="card-desc">Enter a 6-character room code provided by a host.</p>

          <form onSubmit={handleJoinByCode} className="lobby-form">
            <div className="form-group">
              <label htmlFor="join-room-code">Room Code</label>
              <input
                id="join-room-code"
                type="text"
                maxLength={8}
                placeholder="e.g. ROX942"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="code-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="join-username">Your Username</label>
              <input
                id="join-username"
                type="text"
                placeholder="e.g. Vocalist Leo"
                value={joinUsername}
                onChange={(e) => setJoinUsername(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              id="submit-join-room-btn"
              className="secondary-lobby-btn"
              disabled={joining}
            >
              <LogIn size={16} />
              <span>{joining ? 'Connecting...' : 'Join Room'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* ACTIVE ROOMS LIST */}
      <div className="active-rooms-section">
        <div className="section-title-row">
          <div className="title-group">
            <Users className="cyan-icon" size={20} />
            <h3>Active Social Rooms ({rooms.length})</h3>
          </div>
          <button
            type="button"
            className="refresh-btn"
            onClick={fetchRooms}
            disabled={loadingRooms}
            id="refresh-rooms-btn"
          >
            <RefreshCw size={14} className={loadingRooms ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {loadingRooms ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Scanning active rooms...</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="empty-rooms-box">
            <Radio size={36} className="empty-radio" />
            <h4>No Active Rooms Right Now</h4>
            <p>Create the first room above to start collaborating with other artists!</p>
          </div>
        ) : (
          <div className="rooms-grid">
            {rooms.map((r) => (
              <div className="room-card" key={r.code} id={`room-card-${r.code}`}>
                <div className="room-card-top">
                  <div className="room-card-info">
                    <h4 className="room-name">{r.name}</h4>
                    <span className="room-private-badge">
                      <Lock size={12} />
                      <span>Private Room</span>
                    </span>
                  </div>
                  <span className="online-count-chip">
                    <span className="live-dot"></span>
                    {r.onlineCount} Online
                  </span>
                </div>

                <div className="room-meta-row">
                  <span className="room-host">Host: <strong>{r.owner}</strong></span>
                  {r.activeDraft && (
                    <span className="room-active-draft">
                      <Disc3 size={13} className="spin-icon" />
                      {r.activeDraft}
                    </span>
                  )}
                </div>

                <div className="private-room-hint">
                  <Lock size={14} className="lock-icon" />
                  <span>Join via Room Code above</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
