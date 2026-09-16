import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Download } from 'lucide-react';

export const AudioPlayer = ({ src, peaks = [], title = 'Audio Take', duration: propDuration }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(propDuration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((err) => {
        console.warn('Playback error:', err);
      });
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const restartAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    if (!isPlaying) {
      audio.play().then(() => setIsPlaying(true));
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume || 0.8;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === null) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Generate fallback peaks if empty
  const displayPeaks = peaks && peaks.length > 0 ? peaks : Array(48).fill(0.25);
  const progressRatio = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="audio-player-card" id={`player-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="player-controls-row">
        <button
          type="button"
          className="play-toggle-btn"
          onClick={togglePlay}
          id="player-toggle-btn"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="play-icon-offset" />}
        </button>

        <button
          type="button"
          className="player-sub-btn"
          onClick={restartAudio}
          title="Restart playback"
        >
          <RotateCcw size={15} />
        </button>

        {/* Waveform Visualizer & Seekbar */}
        <div className="waveform-seek-container">
          <div className="waveform-bars-track">
            {displayPeaks.map((peak, idx) => {
              const barRatio = idx / displayPeaks.length;
              const isPassed = barRatio <= progressRatio;
              return (
                <div
                  key={idx}
                  className={`waveform-bar ${isPassed ? 'passed' : ''}`}
                  style={{
                    height: `${Math.max(12, peak * 100)}%`
                  }}
                />
              );
            })}
          </div>

          <input
            type="range"
            min="0"
            max={duration || 1}
            step="0.05"
            value={currentTime}
            onChange={handleSeek}
            className="seek-range-overlay"
            aria-label="Seek audio"
          />
        </div>

        <div className="time-display">
          <span>{formatTime(currentTime)}</span>
          <span className="time-sep">/</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Volume controls */}
        <div className="volume-control-group">
          <button type="button" className="mute-toggle-btn" onClick={toggleMute}>
            {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="volume-slider"
            aria-label="Volume"
          />
        </div>

        {src && (
          <a
            href={src}
            download={`${title}.wav`}
            className="download-btn"
            title="Download audio file"
          >
            <Download size={15} />
          </a>
        )}
      </div>
    </div>
  );
};
