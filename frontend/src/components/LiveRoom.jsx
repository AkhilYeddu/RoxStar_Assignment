import React, { useState, useEffect, useRef } from 'react';
import { socketService } from '../services/socket';
import { api } from '../services/api';
import { AudioPlayer } from './AudioPlayer';
import { SpinWheel } from './SpinWheel';
import {
  Users,
  Radio,
  Copy,
  Check,
  LogOut,
  Disc3,
  Share2,
  Crown,
  Sparkles,
  Volume2,
  Music,
  Pencil,
  CheckCircle2
} from 'lucide-react';

export const LiveRoom = ({ initialRoom, username, userDrafts = [], onLeaveRoom }) => {
  const [room, setRoom] = useState(initialRoom);
  const [activeDraft, setActiveDraft] = useState(initialRoom.activeDraft || null);
  const [members, setMembers] = useState(initialRoom.members || []);
  const [copiedCode, setCopiedCode] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [roomNotifications, setRoomNotifications] = useState([]);

  // Username editing inside live room
  const [displayUsername, setDisplayUsername] = useState(username);
  const [editingName, setEditingName] = useState(false);
  const [editNameInput, setEditNameInput] = useState(username);
  const editInputRef = useRef(null);

  const roomCode = initialRoom.code;

  const addNotification = (text) => {
    const id = Date.now() + Math.random();
    setRoomNotifications((prev) => [...prev.slice(-4), { id, text }]);
    setTimeout(() => {
      setRoomNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  };

  // Handle username update: leave under old name, rejoin under new name
  const handleUpdateUsername = async () => {
    const newName = editNameInput.trim();
    if (!newName || newName === displayUsername) {
      setEditingName(false);
      return;
    }
    try {
      // Notify server via API that old member left, new one joined
      await api.leaveRoom(roomCode, displayUsername);
      await api.joinRoom(roomCode, newName);
      socketService.leaveRoom(roomCode, displayUsername);
      socketService.joinRoom(roomCode, newName);
      setDisplayUsername(newName);
      addNotification(`Username updated to "${newName}"`);
    } catch (err) {
      console.warn('Username update error:', err);
      addNotification('Could not update username — please try again.');
    } finally {
      setEditingName(false);
    }
  };

  useEffect(() => {
    // 1. Join room via Socket.IO
    socketService.joinRoom(roomCode, username);

    // 2. Listen for mandatory room_state event (Section B2)
    const handleRoomState = ({ room: syncedRoom }) => {
      setRoom(syncedRoom);
      setMembers(syncedRoom.members || []);
      if (syncedRoom.activeDraft?.fileUrl) {
        setActiveDraft(syncedRoom.activeDraft);
      }
      console.log('[LiveRoom] Authoritative room_state synchronized:', syncedRoom.code);
    };

    // 3. Listen for mandatory user_joined event (Section B2)
    const handleUserJoined = (data) => {
      const updated = data.members || [];
      setMembers(updated);
      setRoom((prev) => (prev ? { ...prev, members: updated } : prev));
      addNotification(data.message || `${data.user?.username} joined the room`);
    };

    // 4. Listen for mandatory user_left event (Section B2)
    const handleUserLeft = (data) => {
      const updated = data.members || [];
      setMembers(updated);
      setRoom((prev) => (prev ? { ...prev, members: updated } : prev));
      addNotification(data.message || `${data.username} left the room`);
    };

    // 4b. Listen for room_members_updated broadcast
    const handleMembersUpdated = (data) => {
      if (data.members) {
        setMembers(data.members);
        setRoom((prev) => (prev ? { ...prev, members: data.members } : prev));
      }
    };

    // 5. Listen for mandatory draft_shared event (Section B2)
    const handleDraftShared = (data) => {
      setActiveDraft(data.activeDraft);
      addNotification(data.message || `${data.sharedBy} shared "${data.activeDraft.title}"`);
    };

    socketService.on('room_state', handleRoomState);
    socketService.on('user_joined', handleUserJoined);
    socketService.on('user_left', handleUserLeft);
    socketService.on('room_members_updated', handleMembersUpdated);
    socketService.on('draft_shared', handleDraftShared);

    return () => {
      socketService.off('room_state', handleRoomState);
      socketService.off('user_joined', handleUserJoined);
      socketService.off('user_left', handleUserLeft);
      socketService.off('room_members_updated', handleMembersUpdated);
      socketService.off('draft_shared', handleDraftShared);
    };
  }, [roomCode, username]);

  const fetchLatestRoom = async () => {
    try {
      const res = await api.getRoomByCode(roomCode);
      if (res.data) {
        setRoom(res.data);
        setMembers(res.data.members || []);
        if (res.data.activeDraft?.fileUrl) {
          setActiveDraft(res.data.activeDraft);
        }
      }
    } catch (err) {
      console.warn('Failed to refresh room:', err);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleLeave = async () => {
    try {
      socketService.leaveRoom(roomCode, username);
      await api.leaveRoom(roomCode, username);
    } catch (err) {
      console.warn('Error leaving room via API:', err);
    } finally {
      if (onLeaveRoom) onLeaveRoom();
    }
  };

  const handleBroadcastDraft = (draft) => {
    socketService.shareDraft(roomCode, {
      id: draft._id,
      title: draft.title,
      fileUrl: draft.fileUrl || `/api/drafts/audio/${draft.fileName}`,
      duration: draft.duration,
      effectApplied: draft.effectApplied,
      waveformPeaks: draft.waveformPeaks,
      sharedBy: username
    });
    setShareModalOpen(false);
  };

  const isOwner = room.owner?.username?.toLowerCase() === displayUsername.toLowerCase();

  return (
    <div className="live-room-container" id="live-room-view">
      {/* ROOM TOP BAR */}
      <div className="room-topbar">
        <div className="topbar-left">
          <div className="live-badge">
            <Radio size={14} className="pulse-icon" />
            <span>LIVE ROOM</span>
          </div>
          <h2 className="topbar-room-name">{room.name}</h2>
          <div className="room-code-pill" onClick={handleCopyCode} title="Click to copy room code">
            <span className="code-label">CODE:</span>
            <span className="code-value">{roomCode}</span>
            {copiedCode ? <Check size={14} className="copied-icon" /> : <Copy size={14} />}
          </div>
        </div>

        <div className="topbar-right">
          <button
            type="button"
            className="broadcast-open-btn"
            onClick={() => setShareModalOpen(true)}
            id="open-broadcast-modal-btn"
          >
            <Share2 size={16} />
            <span>Broadcast Draft</span>
          </button>

          <button
            type="button"
            className="leave-room-btn"
            onClick={handleLeave}
            id="leave-room-btn"
          >
            <LogOut size={16} />
            <span>Leave Room</span>
          </button>
        </div>
      </div>

      {/* NOTIFICATION FEED */}
      {roomNotifications.length > 0 && (
        <div className="room-notification-ticker">
          {roomNotifications.map((n) => (
            <div key={n.id} className="room-ticker-item">
              <Sparkles size={13} />
              <span>{n.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* MAIN STAGE GRID */}
      <div className="room-stage-grid">
        {/* LEFT COLUMN: BROADCAST STAGE */}
        <div className="stage-main-col">
          {/* AUDIO BROADCAST ARENA */}
          <div className="broadcast-arena-card">
            <div className="arena-header">
              <div className="arena-title">
                <Disc3 className="spin-icon arena-icon" size={22} />
                <h3>Room Broadcast Stage</h3>
              </div>
              {activeDraft?.title && (
                <span className="broadcasting-badge">NOW PLAYING</span>
              )}
            </div>

            {activeDraft && activeDraft.title ? (
              <div className="active-broadcast-box">
                <div className="broadcast-meta">
                  <div className="broadcast-info">
                    <h4>{activeDraft.title}</h4>
                    <span className="shared-by-text">
                      Broadcasted by <strong>{activeDraft.sharedBy}</strong>
                    </span>
                  </div>
                  <span className={`effect-badge badge-${activeDraft.effectApplied || 'clean'}`}>
                    {(activeDraft.effectApplied || 'clean').toUpperCase()}
                  </span>
                </div>

                <div className="stage-player-wrapper">
                  <AudioPlayer
                    src={api.getAudioUrl(activeDraft.fileUrl)}
                    peaks={activeDraft.waveformPeaks}
                    title={activeDraft.title}
                    duration={activeDraft.duration}
                  />
                </div>
              </div>
            ) : (
              <div className="stage-idle-box">
                <Music size={40} className="idle-music-icon" />
                <h4>Broadcast Stage is Idle</h4>
                <p>No draft is currently playing. Be the first to share a vocal take with the room!</p>
                <button
                  type="button"
                  className="stage-broadcast-cta"
                  onClick={() => setShareModalOpen(true)}
                >
                  <Share2 size={16} />
                  <span>Choose Draft to Broadcast</span>
                </button>
              </div>
            )}
          </div>

          {/* MULTIPLAYER SPIN WHEEL ARENA (PHASE 3) */}
          <SpinWheel
            room={room}
            members={members}
            currentUsername={displayUsername || username}
            isOwner={isOwner}
            onRefreshRoom={fetchLatestRoom}
          />
        </div>

        {/* RIGHT COLUMN: PARTICIPANTS & PRESENCE */}
        <div className="stage-sidebar-col">
          <div className="participants-card" id="participants-panel">
            <div className="participants-header">
              <div className="participants-title">
                <Users size={18} className="cyan-icon" />
                <h3>Room Members ({members.length})</h3>
              </div>
              <span className="max-cap-label">Max: 20</span>
            </div>

            <div className="participants-list">
              {members.map((member) => {
                const isSelf =
                  member.username.toLowerCase() === displayUsername.toLowerCase() ||
                  member.username.toLowerCase() === username.toLowerCase();
                return (
                  <div
                    className={`participant-item ${isSelf ? 'is-self' : ''}`}
                    key={member.username}
                  >
                    <div className="participant-info">
                      <span className={`presence-dot ${member.isOnline !== false ? 'online' : 'offline'}`} />
                      {isSelf && editingName ? (
                        <div className="inline-name-edit">
                          <input
                            ref={editInputRef}
                            className="name-edit-input"
                            value={editNameInput}
                            onChange={(e) => setEditNameInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateUsername();
                              if (e.key === 'Escape') setEditingName(false);
                            }}
                            autoFocus
                            maxLength={24}
                          />
                          <button
                            type="button"
                            className="name-save-btn"
                            onClick={handleUpdateUsername}
                            title="Save username"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="participant-name">
                          {member.username}
                          {isSelf && (
                            <>
                              {' (You)'}
                              <button
                                type="button"
                                className="edit-name-btn"
                                onClick={() => {
                                  setEditNameInput(displayUsername);
                                  setEditingName(true);
                                }}
                                title="Edit username"
                              >
                                <Pencil size={11} />
                              </button>
                            </>
                          )}
                        </span>
                      )}
                    </div>

                    <div className="participant-tags">
                      {member.isOwner && (
                        <span className="host-tag" title="Room Owner">
                          <Crown size={12} />
                          <span>HOST</span>
                        </span>
                      )}
                      <span className="points-pill" title="Virtual points">
                        {member.virtualPoints || 100} pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* SHARE DRAFT MODAL */}
      {shareModalOpen && (
        <div className="modal-backdrop">
          <div className="share-draft-modal">
            <div className="modal-header">
              <div className="modal-title-group">
                <Share2 size={20} className="cyan-icon" />
                <h3>Broadcast a Draft to Room</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShareModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <p className="modal-sub">
              Select a vocal take from your Voice Draft library. It will immediately play on the room's main stage.
            </p>

            {userDrafts.length === 0 ? (
              <div className="modal-empty-drafts">
                <p>You have no saved drafts in your library yet!</p>
                <p className="subtext">Go to the Voice Draft Studio to record and save your vocal take.</p>
              </div>
            ) : (
              <div className="modal-drafts-list">
                {userDrafts.map((draft) => (
                  <div className="modal-draft-row" key={draft._id}>
                    <div className="modal-draft-info">
                      <h4 className="modal-draft-title">{draft.title}</h4>
                      <div className="modal-draft-meta">
                        <span className="meta-dur">{draft.duration?.toFixed(1)}s</span>
                        <span className="meta-sep">•</span>
                        <span className={`effect-badge badge-${draft.effectApplied || 'clean'}`}>
                          {(draft.effectApplied || 'clean').toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="broadcast-confirm-btn"
                      onClick={() => handleBroadcastDraft(draft)}
                    >
                      <Volume2 size={15} />
                      <span>Broadcast</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
