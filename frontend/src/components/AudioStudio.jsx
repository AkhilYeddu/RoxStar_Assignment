import React, { useState, useEffect, useRef } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import { VisualizerCanvas } from './VisualizerCanvas';
import { EffectRack } from './EffectRack';
import { AudioPlayer } from './AudioPlayer';
import { api } from '../services/api';
import {
  Mic,
  Square,
  XCircle,
  Save,
  RotateCcw,
  Radio,
  Check,
  AlertCircle,
  Disc3,
  Layers,
  Sparkles
} from 'lucide-react';

export const AudioStudio = ({ onDraftSaved }) => {
  const [recordState, setRecordState] = useState('idle'); // 'idle' | 'recording' | 'reviewing'
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [permissionError, setPermissionError] = useState(null);
  const [recordedData, setRecordedData] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Save form fields
  const [draftTitle, setDraftTitle] = useState('');
  const [artistName, setArtistName] = useState('Roxstar Vocalist');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');

  const timerIntervalRef = useRef(null);

  // Timer effect during recording
  useEffect(() => {
    if (recordState === 'recording') {
      const startTime = Date.now();
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((Date.now() - startTime) / 1000);
      }, 50);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [recordState]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Start Voice Recording
  const handleStartRecord = async () => {
    setPermissionError(null);
    setSaveSuccessMessage('');
    try {
      await audioEngine.startRecording();
      setTimerSeconds(0);
      setRecordState('recording');
    } catch (err) {
      console.error('Microphone error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError('Microphone permission denied. Please allow microphone access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionError('No microphone hardware detected on this device.');
      } else {
        setPermissionError(`Audio capture failure: ${err.message}`);
      }
    }
  };

  // Stop Recording & Generate Preview
  const handleStopRecord = () => {
    const result = audioEngine.stopRecording();
    if (!result || result.duration < 0.2) {
      setPermissionError('Recording was too short. Hold and speak for at least 1 second.');
      setRecordState('idle');
      return;
    }

    const localUrl = URL.createObjectURL(result.blob);
    setPreviewUrl(localUrl);
    setRecordedData(result);
    setDraftTitle(`Vocal Take ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);
    setRecordState('reviewing');
  };

  // Cancel Recording
  const handleCancelRecord = () => {
    audioEngine.cancelRecording();
    setRecordState('idle');
    setTimerSeconds(0);
    setRecordedData(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  // Discard Review and return to idle
  const handleDiscard = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setRecordedData(null);
    setRecordState('idle');
    setTimerSeconds(0);
  };

  // Save Draft to MongoDB
  const handleSaveDraft = async (e) => {
    e.preventDefault();
    if (!draftTitle.trim()) {
      alert('Please enter a draft title.');
      return;
    }

    try {
      setIsSaving(true);
      const saved = await api.createDraft({
        title: draftTitle.trim(),
        audioBlob: recordedData.blob,
        duration: recordedData.duration,
        effectApplied: recordedData.effectApplied,
        effectParams: recordedData.effectParams,
        waveformPeaks: recordedData.waveformPeaks,
        createdBy: artistName.trim()
      });

      setSaveSuccessMessage(`Draft "${saved.data.title}" successfully saved!`);
      if (onDraftSaved) onDraftSaved(saved.data);

      setTimeout(() => {
        handleDiscard();
        setSaveSuccessMessage('');
      }, 1500);
    } catch (err) {
      alert(`Failed to save draft: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}.${ms}`;
  };

  return (
    <div className="audio-studio-wrapper" id="audio-studio">
      {/* Studio Banner / Status */}
      <div className="studio-console-banner">
        <div className="console-indicator">
          <Radio className="console-pulse" size={16} />
          <span>ROXSTAR AUDIO WORKSTATION</span>
        </div>
        <div className="console-specs">
          <span>DSP PIPELINE: ACTIVE</span>
          <span className="spec-dot">•</span>
          <span>STUDIO GRADE 44.1kHz</span>
          <span className="spec-dot">•</span>
          <span>WEBAUDIO BUFFERING</span>
        </div>
      </div>

      {/* Permission / Capture Error Alert */}
      {permissionError && (
        <div className="studio-alert-error" id="mic-permission-error">
          <AlertCircle size={18} />
          <span>{permissionError}</span>
          <button type="button" onClick={() => setPermissionError(null)} className="alert-dismiss-btn">
            ✕
          </button>
        </div>
      )}

      {/* Visualizer Rack */}
      <div className="studio-visualizer-section">
        <VisualizerCanvas isRecording={recordState === 'recording'} />
      </div>

      {/* Recording Stage / Controls */}
      <div className="studio-control-deck">
        {recordState === 'idle' && (
          <div className="deck-idle-view">
            <button
              type="button"
              id="start-record-btn"
              className="primary-record-btn"
              onClick={handleStartRecord}
            >
              <div className="record-inner-ring">
                <Mic size={32} />
              </div>
              <span className="record-btn-text">START RECORDING</span>
            </button>
            <p className="record-helper-text">
              Speak into your microphone. Applied DSP effects will be processed directly into the draft audio.
            </p>
          </div>
        )}

        {recordState === 'recording' && (
          <div className="deck-recording-view">
            <div className="live-timer-badge">
              <span className="live-rec-dot"></span>
              <span className="live-timer-text" id="live-record-timer">{formatTimer(timerSeconds)}</span>
            </div>

            <div className="recording-actions-row">
              <button
                type="button"
                id="stop-record-btn"
                className="action-deck-btn btn-stop"
                onClick={handleStopRecord}
              >
                <Square size={18} />
                <span>STOP & PREVIEW</span>
              </button>

              <button
                type="button"
                id="cancel-record-btn"
                className="action-deck-btn btn-cancel"
                onClick={handleCancelRecord}
              >
                <XCircle size={18} />
                <span>CANCEL</span>
              </button>
            </div>
          </div>
        )}

        {recordState === 'reviewing' && recordedData && (
          <div className="deck-review-view" id="review-draft-section">
            <div className="review-header-badge">
              <Disc3 className="spin-icon" size={18} />
              <span>RECORDING COMPLETE — REVIEW & SAVE DRAFT</span>
            </div>

            {/* Audio Preview Player */}
            <div className="review-player-box">
              <AudioPlayer
                src={previewUrl}
                peaks={recordedData.waveformPeaks}
                title={draftTitle}
                duration={recordedData.duration}
              />
            </div>

            {/* Draft Save Form */}
            <form className="draft-save-form" onSubmit={handleSaveDraft}>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="draft-title-input">Draft Name / Title</label>
                  <input
                    id="draft-title-input"
                    type="text"
                    required
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="e.g. Lead Vocal Chorus Take"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="draft-artist-input">Artist / Created By</label>
                  <input
                    id="draft-artist-input"
                    type="text"
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    placeholder="Your name or handle"
                  />
                </div>
              </div>

              <div className="draft-save-meta-summary">
                <div className="meta-chip">
                  <span className="chip-key">Duration:</span>
                  <span className="chip-val">{recordedData.duration.toFixed(2)}s</span>
                </div>
                <div className="meta-chip">
                  <span className="chip-key">Effect Applied:</span>
                  <span className="chip-val highlight">{recordedData.effectApplied.toUpperCase()}</span>
                </div>
                <div className="meta-chip">
                  <span className="chip-key">Format:</span>
                  <span className="chip-val">16-Bit PCM WAV</span>
                </div>
              </div>

              {saveSuccessMessage && (
                <div className="save-success-banner">
                  <Check size={16} />
                  <span>{saveSuccessMessage}</span>
                </div>
              )}

              <div className="review-buttons-row">
                <button
                  type="submit"
                  id="save-draft-btn"
                  className="save-confirm-btn"
                  disabled={isSaving}
                >
                  <Save size={18} />
                  <span>{isSaving ? 'Saving to MongoDB...' : 'Save Draft'}</span>
                </button>

                <button
                  type="button"
                  id="discard-draft-btn"
                  className="discard-btn"
                  onClick={handleDiscard}
                  disabled={isSaving}
                >
                  <RotateCcw size={16} />
                  <span>Discard & Retake</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* DSP Effect Rack */}
      <EffectRack />
    </div>
  );
};
