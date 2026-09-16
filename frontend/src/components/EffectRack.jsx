import React, { useState } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import { Sliders, Activity, Sparkles, Volume2, Power } from 'lucide-react';

export const EffectRack = ({ onEffectChange }) => {
  const [effects, setEffects] = useState({
    echo: {
      enabled: false,
      delay: 0.25,
      feedback: 0.4,
      mix: 0.5
    },
    reverb: {
      enabled: false,
      roomSize: 1.8,
      mix: 0.45
    },
    pitch: {
      enabled: false,
      semitones: 0,
      mix: 0.8
    }
  });

  const toggleEffect = (name) => {
    const updated = {
      ...effects,
      [name]: {
        ...effects[name],
        enabled: !effects[name].enabled
      }
    };
    setEffects(updated);
    audioEngine.toggleEffect(name, updated[name].enabled);
    if (onEffectChange) onEffectChange(updated);
  };

  const updateParam = (name, param, value) => {
    const numVal = parseFloat(value);
    const updated = {
      ...effects,
      [name]: {
        ...effects[name],
        [param]: numVal
      }
    };
    setEffects(updated);
    audioEngine.setEffectParam(name, param, numVal);
    if (onEffectChange) onEffectChange(updated);
  };

  const applyPitchPreset = (semitones) => {
    const updated = {
      ...effects,
      pitch: {
        ...effects.pitch,
        enabled: true,
        semitones
      }
    };
    setEffects(updated);
    audioEngine.toggleEffect('pitch', true);
    audioEngine.setEffectParam('pitch', 'semitones', semitones);
    if (onEffectChange) onEffectChange(updated);
  };

  return (
    <div className="effect-rack-container" id="effect-rack">
      <div className="effect-rack-header">
        <div className="rack-title-group">
          <Sliders className="rack-icon" size={20} />
          <h3>DSP Studio Effect Rack</h3>
        </div>
        <div className="rack-status-badge">
          {effects.echo.enabled || effects.reverb.enabled || effects.pitch.enabled
            ? 'EFFECTS ACTIVE IN AUDIO PATH'
            : 'BYPASS (CLEAN VOCALS)'}
        </div>
      </div>

      <div className="effect-modules-grid">
        {/* ECHO / DELAY MODULE */}
        <div className={`effect-module ${effects.echo.enabled ? 'active' : ''}`} id="module-echo">
          <div className="module-top">
            <div className="module-name">
              <Activity size={16} />
              <span>ECHO / DELAY</span>
            </div>
            <button
              type="button"
              id="toggle-echo-btn"
              className={`module-power-btn ${effects.echo.enabled ? 'power-on' : ''}`}
              onClick={() => toggleEffect('echo')}
              title={effects.echo.enabled ? 'Bypass Echo' : 'Enable Echo'}
            >
              <Power size={14} />
              <span>{effects.echo.enabled ? 'ON' : 'BYPASS'}</span>
            </button>
          </div>

          <div className="module-controls">
            <div className="control-group">
              <div className="control-label">
                <span>Delay Time</span>
                <span className="control-value">{Math.round(effects.echo.delay * 1000)} ms</span>
              </div>
              <input
                id="echo-delay-slider"
                type="range"
                min="0.05"
                max="1.0"
                step="0.01"
                value={effects.echo.delay}
                onChange={(e) => updateParam('echo', 'delay', e.target.value)}
                disabled={!effects.echo.enabled}
              />
            </div>

            <div className="control-group">
              <div className="control-label">
                <span>Feedback Repeat</span>
                <span className="control-value">{Math.round(effects.echo.feedback * 100)}%</span>
              </div>
              <input
                id="echo-feedback-slider"
                type="range"
                min="0.1"
                max="0.85"
                step="0.05"
                value={effects.echo.feedback}
                onChange={(e) => updateParam('echo', 'feedback', e.target.value)}
                disabled={!effects.echo.enabled}
              />
            </div>

            <div className="control-group">
              <div className="control-label">
                <span>Wet / Dry Mix</span>
                <span className="control-value">{Math.round(effects.echo.mix * 100)}%</span>
              </div>
              <input
                id="echo-mix-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={effects.echo.mix}
                onChange={(e) => updateParam('echo', 'mix', e.target.value)}
                disabled={!effects.echo.enabled}
              />
            </div>
          </div>
        </div>

        {/* REVERB MODULE */}
        <div className={`effect-module ${effects.reverb.enabled ? 'active' : ''}`} id="module-reverb">
          <div className="module-top">
            <div className="module-name">
              <Sparkles size={16} />
              <span>STUDIO REVERB</span>
            </div>
            <button
              type="button"
              id="toggle-reverb-btn"
              className={`module-power-btn ${effects.reverb.enabled ? 'power-on' : ''}`}
              onClick={() => toggleEffect('reverb')}
              title={effects.reverb.enabled ? 'Bypass Reverb' : 'Enable Reverb'}
            >
              <Power size={14} />
              <span>{effects.reverb.enabled ? 'ON' : 'BYPASS'}</span>
            </button>
          </div>

          <div className="module-controls">
            <div className="control-group">
              <div className="control-label">
                <span>Decay Room Size</span>
                <span className="control-value">{effects.reverb.roomSize.toFixed(1)} s</span>
              </div>
              <input
                id="reverb-room-slider"
                type="range"
                min="0.5"
                max="3.5"
                step="0.1"
                value={effects.reverb.roomSize}
                onChange={(e) => updateParam('reverb', 'roomSize', e.target.value)}
                disabled={!effects.reverb.enabled}
              />
            </div>

            <div className="control-group">
              <div className="control-label">
                <span>Wet Acoustic Mix</span>
                <span className="control-value">{Math.round(effects.reverb.mix * 100)}%</span>
              </div>
              <input
                id="reverb-mix-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={effects.reverb.mix}
                onChange={(e) => updateParam('reverb', 'mix', e.target.value)}
                disabled={!effects.reverb.enabled}
              />
            </div>

            <div className="reverb-presets">
              <span className="preset-label">Acoustics:</span>
              <button
                type="button"
                className="mini-preset-chip"
                onClick={() => { updateParam('reverb', 'roomSize', 0.8); updateParam('reverb', 'mix', 0.35); }}
                disabled={!effects.reverb.enabled}
              >
                Small Room
              </button>
              <button
                type="button"
                className="mini-preset-chip"
                onClick={() => { updateParam('reverb', 'roomSize', 2.0); updateParam('reverb', 'mix', 0.5); }}
                disabled={!effects.reverb.enabled}
              >
                Concert Hall
              </button>
              <button
                type="button"
                className="mini-preset-chip"
                onClick={() => { updateParam('reverb', 'roomSize', 3.2); updateParam('reverb', 'mix', 0.7); }}
                disabled={!effects.reverb.enabled}
              >
                Cathedral
              </button>
            </div>
          </div>
        </div>

        {/* PITCH SHIFT MODULE */}
        <div className={`effect-module ${effects.pitch.enabled ? 'active' : ''}`} id="module-pitch">
          <div className="module-top">
            <div className="module-name">
              <Volume2 size={16} />
              <span>PITCH SHIFT</span>
            </div>
            <button
              type="button"
              id="toggle-pitch-btn"
              className={`module-power-btn ${effects.pitch.enabled ? 'power-on' : ''}`}
              onClick={() => toggleEffect('pitch')}
              title={effects.pitch.enabled ? 'Bypass Pitch Shift' : 'Enable Pitch Shift'}
            >
              <Power size={14} />
              <span>{effects.pitch.enabled ? 'ON' : 'BYPASS'}</span>
            </button>
          </div>

          <div className="module-controls">
            <div className="control-group">
              <div className="control-label">
                <span>Semitone Transposition</span>
                <span className="control-value">
                  {effects.pitch.semitones > 0 ? `+${effects.pitch.semitones}` : effects.pitch.semitones} st
                </span>
              </div>
              <input
                id="pitch-semitones-slider"
                type="range"
                min="-12"
                max="12"
                step="1"
                value={effects.pitch.semitones}
                onChange={(e) => updateParam('pitch', 'semitones', e.target.value)}
                disabled={!effects.pitch.enabled}
              />
            </div>

            <div className="pitch-presets-grid">
              <button
                type="button"
                id="pitch-demon-preset"
                className={`preset-btn ${effects.pitch.semitones === -7 && effects.pitch.enabled ? 'active-preset' : ''}`}
                onClick={() => applyPitchPreset(-7)}
              >
                Demon (-7)
              </button>
              <button
                type="button"
                id="pitch-deep-preset"
                className={`preset-btn ${effects.pitch.semitones === -4 && effects.pitch.enabled ? 'active-preset' : ''}`}
                onClick={() => applyPitchPreset(-4)}
              >
                Deep (-4)
              </button>
              <button
                type="button"
                id="pitch-natural-preset"
                className={`preset-btn ${effects.pitch.semitones === 0 && effects.pitch.enabled ? 'active-preset' : ''}`}
                onClick={() => applyPitchPreset(0)}
              >
                Natural (0)
              </button>
              <button
                type="button"
                id="pitch-high-preset"
                className={`preset-btn ${effects.pitch.semitones === 4 && effects.pitch.enabled ? 'active-preset' : ''}`}
                onClick={() => applyPitchPreset(4)}
              >
                High (+4)
              </button>
              <button
                type="button"
                id="pitch-chipmunk-preset"
                className={`preset-btn ${effects.pitch.semitones === 8 && effects.pitch.enabled ? 'active-preset' : ''}`}
                onClick={() => applyPitchPreset(8)}
              >
                Helium (+8)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
