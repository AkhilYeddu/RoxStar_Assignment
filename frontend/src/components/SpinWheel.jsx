import React, { useEffect, useRef, useState } from 'react';
import {
  Trophy,
  Flame,
  AlertTriangle,
  RotateCw,
  Sparkles,
  UserCheck,
  UserX,
  History,
  Timer,
  Play,
  Bot
} from 'lucide-react';
import { socketService } from '../services/socket';
import { api } from '../services/api';

const SEGMENT_COLORS = [
  '#00f0ff', // cyan
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#14b8a6', // teal
  '#f43f5e', // rose
  '#a855f7', // purple
  '#eab308'  // yellow
];

export const SpinWheel = ({
  room,
  members: propMembers,
  currentUsername,
  isOwner,
  onRefreshRoom
}) => {
  const [spinStatus, setSpinStatus] = useState(room?.spinState?.status || 'WAITING');
  const [initialPlayers, setInitialPlayers] = useState([]);
  const [remainingPlayers, setRemainingPlayers] = useState([]);
  const [eliminations, setEliminations] = useState([]);
  const [winner, setWinner] = useState(room?.spinState?.winner || null);
  const [pointsAwarded, setPointsAwarded] = useState(500);
  const [countdown, setCountdown] = useState(5);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [historyList, setHistoryList] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isFastDemo, setIsFastDemo] = useState(false);
  const [addingBot, setAddingBot] = useState(false);

  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const spinSpeedRef = useRef(0.08);

  // Synchronize members from either prop or room object
  const activeMembers = propMembers && propMembers.length > 0 ? propMembers : room?.members || [];
  const onlineMembers = activeMembers.filter((m) => m.isOnline !== false);
  const eligibleCount = onlineMembers.length;
  const canStart = isOwner && eligibleCount >= 3 && eligibleCount <= 20 && spinStatus !== 'RUNNING';

  // Audio effects synthesizer using Web Audio
  const playSoundEffect = (type) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'elimination') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.35);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'winner') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.12);
        osc.frequency.setValueAtTime(659.25, now + 0.24);
        osc.frequency.setValueAtTime(880, now + 0.36);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        osc.start(now);
        osc.stop(now + 0.8);
      } else if (type === 'tick') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch {
      // Audio context may be restricted before user gesture
    }
  };

  // Subscribe to mandatory Socket.IO events for Phase 3
  useEffect(() => {
    const handleSpinStarted = (data) => {
      console.log('[SpinWheel] spin_started event:', data);
      setErrorMsg(null);
      setSpinStatus('RUNNING');
      setWinner(null);
      setEliminations([]);
      setInitialPlayers(data.players || []);
      setRemainingPlayers(data.players || []);
      setIsSpinning(true);
      setCountdown(data.intervalMs ? Math.round(data.intervalMs / 1000) : 5);
      startCountdownTimer(data.intervalMs ? Math.round(data.intervalMs / 1000) : 5);
      onRefreshRoom?.();
    };

    const handleUserEliminated = (data) => {
      console.log('[SpinWheel] user_eliminated event:', data);
      playSoundEffect('elimination');
      setEliminations((prev) => [
        ...prev,
        { username: data.username, order: data.eliminationOrder }
      ]);
      setRemainingPlayers(data.remaining || []);
      setCountdown(isFastDemo ? 2 : 5);
      startCountdownTimer(isFastDemo ? 2 : 5);
    };

    const handleWinnerAnnounced = (data) => {
      console.log('[SpinWheel] winner_announced event:', data);
      playSoundEffect('winner');
      clearInterval(countdownIntervalRef.current);
      setSpinStatus('COMPLETED');
      setIsSpinning(false);
      setWinner(data.winner);
      setPointsAwarded(data.pointsAwarded || 500);
      onRefreshRoom?.();
    };

    const handleSpinAborted = (data) => {
      console.log('[SpinWheel] spin_aborted event:', data);
      clearInterval(countdownIntervalRef.current);
      setSpinStatus('ABORTED');
      setIsSpinning(false);
      setErrorMsg(`Spin aborted: ${data.reason}`);
      onRefreshRoom?.();
    };

    const handleSpinError = (data) => {
      setErrorMsg(data.message);
    };

    const handleMemberChange = () => {
      onRefreshRoom?.();
    };

    socketService.on('spin_started', handleSpinStarted);
    socketService.on('user_eliminated', handleUserEliminated);
    socketService.on('winner_announced', handleWinnerAnnounced);
    socketService.on('spin_aborted', handleSpinAborted);
    socketService.on('spin_error', handleSpinError);
    socketService.on('user_joined', handleMemberChange);
    socketService.on('user_left', handleMemberChange);
    socketService.on('room_members_updated', handleMemberChange);

    return () => {
      socketService.off('spin_started', handleSpinStarted);
      socketService.off('user_eliminated', handleUserEliminated);
      socketService.off('winner_announced', handleWinnerAnnounced);
      socketService.off('spin_aborted', handleSpinAborted);
      socketService.off('spin_error', handleSpinError);
      socketService.off('user_joined', handleMemberChange);
      socketService.off('user_left', handleMemberChange);
      socketService.off('room_members_updated', handleMemberChange);
      clearInterval(countdownIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isFastDemo, onRefreshRoom]);

  // Countdown timer for 5-second ticks
  const startCountdownTimer = (initialSec) => {
    clearInterval(countdownIntervalRef.current);
    setCountdown(initialSec);
    let current = initialSec;

    countdownIntervalRef.current = setInterval(() => {
      current -= 1;
      if (current >= 0) {
        setCountdown(current);
        if (current > 0) playSoundEffect('tick');
      } else {
        clearInterval(countdownIntervalRef.current);
      }
    }, 1000);
  };

  // Canvas continuous rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    let angle = rotationAngle;

    const render = () => {
      if (isSpinning) {
        angle += spinSpeedRef.current;
        setRotationAngle(angle);
      }

      ctx.clearRect(0, 0, width, height);

      const activeList = remainingPlayers.length > 0 ? remainingPlayers : onlineMembers.map((m) => m.username);
      const totalSegments = Math.max(activeList.length, 1);
      const sliceAngle = (2 * Math.PI) / totalSegments;

      // Draw outer glowing ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 10, 0, 2 * Math.PI);
      ctx.strokeStyle = isSpinning ? '#00f0ff' : 'rgba(139, 92, 246, 0.4)';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = isSpinning ? 18 : 6;
      ctx.stroke();
      ctx.restore();

      // Draw slices
      for (let i = 0; i < totalSegments; i++) {
        const startAngle = angle + i * sliceAngle;
        const endAngle = startAngle + sliceAngle;
        const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#070a12';
        ctx.stroke();

        // Draw Player Labels
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px "Outfit", sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;

        const name = activeList[i] || `P${i + 1}`;
        const truncated = name.length > 10 ? `${name.substring(0, 8)}…` : name;
        ctx.fillText(truncated, radius - 20, 4);
        ctx.restore();
      }

      // Draw Center Hub
      ctx.beginPath();
      ctx.arc(centerX, centerY, 32, 0, 2 * Math.PI);
      ctx.fillStyle = '#070a12';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = isSpinning ? '#ec4899' : '#8b5cf6';
      ctx.shadowColor = '#ec4899';
      ctx.shadowBlur = 12;
      ctx.stroke();

      // Center Icon / Status
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText(isSpinning ? `${countdown}s` : 'ROXX', centerX, centerY);

      // Draw Top Pointer
      ctx.beginPath();
      ctx.moveTo(centerX - 12, centerY - radius - 12);
      ctx.lineTo(centerX + 12, centerY - radius - 12);
      ctx.lineTo(centerX, centerY - radius + 10);
      ctx.closePath();
      ctx.fillStyle = '#ff0055';
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 15;
      ctx.fill();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isSpinning, remainingPlayers, onlineMembers, rotationAngle, countdown]);

  // Trigger spin wheel
  const handleStartSpin = async () => {
    try {
      setErrorMsg(null);
      const intervalMs = isFastDemo ? 2000 : 5000;
      await api.startSpin(room.code, currentUsername, intervalMs);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // Helper to add mock demo bots to satisfy min 3 player condition instantly
  const handleAddDemoBots = async () => {
    try {
      setAddingBot(true);
      setErrorMsg(null);
      const botNames = ['CyberVoice', 'BeatMaster', 'EchoDiva', 'SynthWave'];
      const needed = Math.max(0, 3 - onlineMembers.length);
      const toAdd = needed === 0 ? 1 : needed;

      for (let i = 0; i < toAdd; i++) {
        const botName = `${botNames[i % botNames.length]}_${Math.floor(Math.random() * 90 + 10)}`;
        await api.joinRoom(room.code, botName);
      }
      onRefreshRoom?.();
    } catch (err) {
      setErrorMsg(`Failed to add demo bot: ${err.message}`);
    } finally {
      setAddingBot(false);
    }
  };

  // Load audit history
  const loadHistory = async () => {
    try {
      const res = await api.getSpinHistory(room.code);
      setHistoryList(res.data || []);
      setShowHistory(true);
    } catch (err) {
      setErrorMsg(`Failed to load history: ${err.message}`);
    }
  };

  return (
    <div className="spin-wheel-arena-card">
      {/* Header bar */}
      <div className="arena-header">
        <div className="arena-title">
          <Flame className="flame-icon" size={20} />
          <h3>Multiplayer Spin Wheel Elimination Arena</h3>
          <span className="arena-status-chip status-running">
            {spinStatus === 'RUNNING' ? 'LIVE ELIMINATION' : spinStatus}
          </span>
        </div>

        <div className="arena-controls">
          <button
            type="button"
            className="history-toggle-btn"
            onClick={loadHistory}
            title="View Audit Logs"
          >
            <History size={15} />
            <span>Audit History</span>
          </button>
        </div>
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div className="spin-error-banner">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)}>×</button>
        </div>
      )}

      {/* Main Wheel & Info Area */}
      <div className="wheel-stage-layout">
        {/* Left: Animated Canvas Wheel */}
        <div className="wheel-canvas-box">
          <canvas
            ref={canvasRef}
            width={340}
            height={340}
            className={`spin-canvas ${isSpinning ? 'active-spinning' : ''}`}
          />
          {spinStatus === 'RUNNING' && (
            <div className="live-elim-countdown-pill">
              <Timer size={14} className="spin-pulse-icon" />
              <span>Next Elimination in <strong>{countdown}s</strong></span>
            </div>
          )}
        </div>

        {/* Right: Game State & Actions */}
        <div className="wheel-details-box">
          {/* Winner announcement banner */}
          {spinStatus === 'COMPLETED' && winner && (
            <div className="winner-celebration-card">
              <div className="trophy-sparkle-group">
                <Trophy size={42} className="trophy-icon" />
                <Sparkles size={24} className="sparkle-icon" />
              </div>
              <h4>CHAMPION OF THE ROOM!</h4>
              <div className="winner-name-banner">{winner}</div>
              <p className="points-award-tag">+{pointsAwarded} Virtual Points Awarded!</p>
            </div>
          )}

          {/* Eligibility bar */}
          <div className="eligibility-status-card">
            <div className="card-sub-header">
              <UserCheck size={16} />
              <span>Participant Eligibility (Rule C1: Min 3, Max 20)</span>
            </div>
            <div className="meter-row">
              <span className="count-bold">{eligibleCount}</span>
              <span className="count-sub">Online Participants</span>
              {eligibleCount >= 3 && eligibleCount <= 20 ? (
                <span className="status-badge-ok">READY TO SPIN</span>
              ) : (
                <span className="status-badge-need">
                  {eligibleCount < 3 ? `NEED ${3 - eligibleCount} MORE` : 'TOO MANY'}
                </span>
              )}
            </div>

            {/* Quick Demo Bot Adder for Easy 1-Click Testing */}
            {eligibleCount < 3 && (
              <div className="demo-bot-helper">
                <p>Testing solo? Add demo players with 1 click to satisfy the 3-player rule:</p>
                <button
                  type="button"
                  className="add-bot-btn"
                  onClick={handleAddDemoBots}
                  disabled={addingBot}
                >
                  <Bot size={15} />
                  <span>{addingBot ? 'Adding...' : 'Add Demo Bots (Simulate 3+ Players)'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Active players / Eliminations ticker */}
          {spinStatus === 'RUNNING' && (
            <div className="eliminations-live-ticker">
              <div className="ticker-col">
                <h5>Remaining ({remainingPlayers.length})</h5>
                <div className="pills-wrap">
                  {remainingPlayers.map((p) => (
                    <span key={p} className="player-live-pill">
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              {eliminations.length > 0 && (
                <div className="ticker-col">
                  <h5>Eliminated ({eliminations.length})</h5>
                  <div className="pills-wrap">
                    {eliminations.map((e) => (
                      <span key={e.username} className="player-elim-pill">
                        <UserX size={11} />
                        #{e.order} {e.username}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action trigger section */}
          <div className="wheel-action-bar">
            {isOwner ? (
              <div className="owner-spin-actions">
                <div className="speed-toggle">
                  <label>
                    <input
                      type="checkbox"
                      checked={isFastDemo}
                      onChange={(e) => setIsFastDemo(e.target.checked)}
                      disabled={spinStatus === 'RUNNING'}
                    />
                    <span>Fast Mode (2s ticks for demo)</span>
                  </label>
                </div>

                <button
                  type="button"
                  className="primary-spin-trigger-btn"
                  onClick={handleStartSpin}
                  disabled={!canStart}
                >
                  {spinStatus === 'RUNNING' ? (
                    <>
                      <RotateCw size={18} className="spin-icon-anim" />
                      <span>Spin in Progress...</span>
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      <span>START SPIN WHEEL ({eligibleCount} Players)</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="spectator-info-box">
                <p>
                  {spinStatus === 'RUNNING'
                    ? '⚡ Spin Wheel is actively eliminating! Cheer on the finalists!'
                    : 'Awaiting room owner to initiate the Spin Wheel…'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="modal-backdrop" onClick={() => setShowHistory(false)}>
          <div className="share-draft-modal history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <History size={20} className="cyan-icon" />
                <h3>Spin Wheel Audit Logs (Section C & D)</h3>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowHistory(false)}>
                ×
              </button>
            </div>

            <p className="modal-sub">
              Every spin execution is deterministically logged with PRNG seed, player order, elimination sequence, and awarded points.
            </p>

            <div className="history-list">
              {historyList.length === 0 ? (
                <div className="empty-history">No spin records recorded yet in this room.</div>
              ) : (
                historyList.map((g, idx) => (
                  <div key={g._id || idx} className="history-item-row">
                    <div className="history-top">
                      <span className="history-winner">🏆 Winner: <strong>{g.winner || 'None'}</strong></span>
                      <span className="history-seed">Seed: #{g.seed}</span>
                    </div>
                    <div className="history-meta">
                      <span>Players: {g.initialPlayers?.length || 0}</span>
                      <span>•</span>
                      <span>Eliminations: {g.eliminations?.length || 0}</span>
                      <span>•</span>
                      <span>Points: +{g.pointsAwarded || 500}</span>
                      <span>•</span>
                      <span>Status: {g.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
