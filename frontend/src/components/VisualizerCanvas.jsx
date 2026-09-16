import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../audio/AudioEngine';

export const VisualizerCanvas = ({ isRecording, mode = 'both' }) => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Background subtle grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (isRecording) {
        const freqData = audioEngine.getFrequencyData();
        const timeData = audioEngine.getTimeDomainData();

        // 1. Draw Frequency Bars (Background layer)
        if (freqData.length > 0 && (mode === 'freq' || mode === 'both')) {
          const barCount = 48;
          const barWidth = (width / barCount) - 2;
          const step = Math.floor(freqData.length / barCount);

          for (let i = 0; i < barCount; i++) {
            const val = freqData[i * step] / 255;
            const barHeight = Math.max(4, val * (height * 0.75));
            const x = i * (barWidth + 2);
            const y = height - barHeight;

            // Gradient from cyan to purple
            const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
            gradient.addColorStop(0, 'rgba(0, 240, 255, 0.15)');
            gradient.addColorStop(0.6, 'rgba(139, 92, 246, 0.5)');
            gradient.addColorStop(1, 'rgba(236, 72, 153, 0.85)');

            ctx.fillStyle = gradient;
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'rgba(0, 240, 255, 0.4)';
            ctx.fillRect(x, y, barWidth, barHeight);
            ctx.shadowBlur = 0;
          }
        }

        // 2. Draw Oscilloscope Waveform (Foreground layer)
        if (timeData.length > 0 && (mode === 'wave' || mode === 'both')) {
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#00f0ff';
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#00f0ff';

          ctx.beginPath();
          const sliceWidth = width / timeData.length;
          let x = 0;

          for (let i = 0; i < timeData.length; i++) {
            const v = timeData[i] / 128.0; // 0..2
            const y = (v * height) / 2;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
            x += sliceWidth;
          }

          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      } else {
        // Idle ambient animated wave
        phase += 0.03;
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
        ctx.beginPath();

        const midY = height / 2;
        for (let x = 0; x < width; x++) {
          const y = midY + Math.sin(x * 0.02 + phase) * 8 * Math.sin(x * 0.005);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Idle center line
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.2)';
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const y = midY + Math.cos(x * 0.015 - phase) * 5;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRecording, mode]);

  return (
    <div className="visualizer-container" id="audio-visualizer-container">
      <canvas
        ref={canvasRef}
        width={720}
        height={160}
        className="visualizer-canvas"
        id="audio-visualizer-canvas"
      />
      <div className="visualizer-overlay">
        <span className="visualizer-status">
          <span className={`status-dot ${isRecording ? 'recording' : 'idle'}`}></span>
          {isRecording ? 'LIVE MIC AUDIO CAPTURE' : 'STANDBY - READY TO RECORD'}
        </span>
        <span className="visualizer-spec">44.1 kHz • 16-Bit PCM • Low Latency</span>
      </div>
    </div>
  );
};
