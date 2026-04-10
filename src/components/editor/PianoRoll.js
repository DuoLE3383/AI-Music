import React, { useRef, useEffect, useState } from 'react';
import * as mm from '@magenta/music';

import './PianoRoll.css';
const PIXELS_PER_BEAT = 40; 
const PITCH_HEIGHT = 400;
// const RHYTHM_HEIGHT = 100;
const MIN_PITCH = 36;
const MAX_PITCH = 84;
const PITCH_RANGE = MAX_PITCH - MIN_PITCH;

const PITCH_NOTE_HEIGHT = PITCH_HEIGHT / (PITCH_RANGE + 1);
const PITCH_LABELS = {
  1: 'C#',
  3: 'D#',
  6: 'F#',
  8: 'G#',
  10: 'A#'
};
const NATURAL_LABELS = {
  0: 'C',
  2: 'D',
  4: 'E',
  5: 'F',
  7: 'G',
  9: 'A',
  11: 'B'
};

const IS_SHARP = [1, 3, 6, 8, 10];

const PianoRoll = ({ sequence, currentTime, onSeek, onAddNote, onRemoveNote, timeSig = '4/4' }) => {
  const [isPaintMode, setIsPaintMode] = useState(false);
  const [isSprinkleMode, setIsSprinkleMode] = useState(false);
  const [pixelsPerBeat, setPixelsPerBeat] = useState(PIXELS_PER_BEAT);
  const pitchCanvasRef = useRef(null);
  const melodyScrollRef = useRef(null);
  const wrapperRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Get BPM from sequence or default to 120
  const qpm = sequence?.tempos?.[0]?.qpm || 120;
  const secondsPerBeat = 60 / qpm;
  const pixelsPerSecond = pixelsPerBeat / secondsPerBeat;
  const totalWidth = (sequence?.totalTime || 0) * pixelsPerSecond;

  // Parse time signature for grid lines (e.g., 4/4, 6/8, 3/4)
  const [num, den] = timeSig.split('/').map(Number);
  const pixelsPerStep = pixelsPerBeat * (4 / den);
  const secondsPerStep = secondsPerBeat * (4 / den);

  // Melody Playhead
  const melodyPlayheadX = currentTime * pixelsPerSecond;

  const renderGrid = () => {
    const lines = [];

    // Horizontal Pitch Rows
    for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
      const mod = p % 12;
      const y = (MAX_PITCH - p) * PITCH_NOTE_HEIGHT;
      const isSharp = IS_SHARP.includes(mod);
      
      lines.push(
        <div key={`row-${p}`} className="piano-roll-grid-row" style={{ 
          top: y, 
          height: PITCH_NOTE_HEIGHT,
          width: '100%',
          backgroundColor: isSharp ? 'rgba(0,0,0,0.3)' : 'transparent'
        }}>
          <div className="piano-roll-grid-line" />
          <div className="piano-roll-grid-label-container">
            <span className="piano-roll-grid-label" style={{
              color: isSharp ? '#475569' : '#94a3b8'
            }}>
              {NATURAL_LABELS[mod] || PITCH_LABELS[mod]}
            </span>
          </div>
        </div>
      );
    }

    // Vertical Beat Lines
    const totalSteps = Math.ceil((sequence?.totalTime || 0) / secondsPerStep) + (num * 2);
    for (let i = 0; i <= totalSteps; i++) {
      const x = i * pixelsPerStep;
      const isBarLine = i % num === 0;
      lines.push(
        <div key={`v-${i}`} className="piano-roll-vertical-line" style={{ 
          left: x + 50, 
          borderLeft: isBarLine ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.05)' 
        }} />
      );
      
      if (isBarLine) {
        lines.push(
          <div key={`time-label-${i}`} className="piano-roll-time-label" style={{ left: x + 55 }}>
            {Math.floor(i / num) + 1}
          </div>
        );
      }
    }

    return lines;
  };

  // Track width changes for the Rhythm Auto-Zoom
  useEffect(() => {
    if (!wrapperRef.current) return;
    
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (sequence) {
      if (pitchCanvasRef.current) {
        const visualizer = new mm.PianoRollCanvasVisualizer(sequence, pitchCanvasRef.current, {
          noteRGB: '99, 102, 241',
          activeNoteRGB: '255, 255, 255',
          pixelsPerTimeStep: pixelsPerSecond,
          minPitch: MIN_PITCH,
          maxPitch: MAX_PITCH,
          noteHeight: PITCH_NOTE_HEIGHT
        });
      }
    }
  }, [sequence, pixelsPerSecond]);

  // Auto-scroll logic: Only for the Melody container
  useEffect(() => {
    if (melodyScrollRef.current) {
      const container = melodyScrollRef.current;
      const scrollBuffer = 150;
      const absolutePlayhead = melodyPlayheadX + 50;

      if (absolutePlayhead > container.scrollLeft + container.clientWidth - scrollBuffer) {
        container.scrollLeft = absolutePlayhead - (container.clientWidth / 2);
      } else if (absolutePlayhead < container.scrollLeft + scrollBuffer && absolutePlayhead > 50) {
        container.scrollLeft = Math.max(0, absolutePlayhead - (container.clientWidth / 2));
      }
    }
  }, [melodyPlayheadX]);

  const handleAutoZoomMelody = () => {
    if (!sequence || !melodyScrollRef.current) return;
    const totalTime = sequence.totalTime || 1;
    const targetPPS = (melodyScrollRef.current.clientWidth - 100) / totalTime;
    const targetPixelsPerBeat = targetPPS * secondsPerBeat;
    setPixelsPerBeat(Math.max(10, Math.min(200, targetPixelsPerBeat)));
  };

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sidebarWidth = 50;
    const x = Math.max(0, e.clientX - rect.left - sidebarWidth);
    const y = e.clientY - rect.top;
    
    const seekTime = x / pixelsPerSecond;

    // Seek if clicking the top ruler (first 25px) or if not in paint mode
    if (y < 25 || !isPaintMode) {
      if (onSeek) onSeek(Math.max(0, Math.min(seekTime, sequence?.totalTime || 0)));
      return;
    }

    if (sequence) {
      let pitch = MAX_PITCH - Math.floor(y / PITCH_NOTE_HEIGHT);
      pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, pitch));

      // Check if a note already exists at this time and pitch
      const existingNote = sequence.notes.find(n => 
        n.pitch === pitch && 
        seekTime >= n.startTime && 
        seekTime <= n.endTime
      );
      
      if (existingNote && onRemoveNote) {
        onRemoveNote(existingNote);
      } else if (onAddNote) {
        const baseNote = {
          pitch: pitch,
          startTime: seekTime,
          endTime: seekTime + (secondsPerBeat / 4), // Add a 16th note by default
          velocity: 80
        };

        if (isSprinkleMode) {
          const repeats = 3;
          const spacing = secondsPerBeat / 8; // 1/32 note spacing
          const velDecay = 0.85;
          
          for (let x = 0; x <= repeats; x++) {
            onAddNote({
              ...baseNote,
              startTime: baseNote.startTime + (x * spacing),
              endTime: baseNote.endTime + (x * spacing),
              velocity: Math.floor(baseNote.velocity * Math.pow(velDecay, x))
            });
          }
        } else {
          onAddNote(baseNote);
        }
      }
    } else if (onSeek) {
      onSeek(Math.max(0, Math.min(seekTime, sequence?.totalTime || 0)));
    }
  };

  return (
    <div className="piano-roll-wrapper">
      <div className="piano-roll-header-row">
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => { setIsPaintMode(!isPaintMode); setIsSprinkleMode(false); }}
            className="piano-roll-toggle-btn"
            style={{ 
              backgroundColor: isPaintMode && !isSprinkleMode ? '#6366f1' : 'transparent',
              borderColor: isPaintMode && !isSprinkleMode ? '#818cf8' : '#334155'
            }}
          >
            ✏️ Pen
          </button>
          <button 
            onClick={() => { setIsSprinkleMode(!isSprinkleMode); setIsPaintMode(true); }}
            className="piano-roll-toggle-btn"
            style={{ 
              backgroundColor: isSprinkleMode ? '#a855f7' : 'transparent',
              borderColor: isSprinkleMode ? '#c084fc' : '#334155'
            }}
          >
            ✨ Sprinkle
          </button>
        </div>

        <div className="piano-roll-zoom-controls">
          <button onClick={() => setPixelsPerBeat(prev => Math.max(10, prev - 10))} className="piano-roll-zoom-btn">-</button>
          <span className="piano-roll-zoom-label">Zoom</span>
          <button onClick={() => setPixelsPerBeat(prev => Math.min(200, prev + 10))} className="piano-roll-zoom-btn">+</button>
        </div>

        <div className="piano-roll-info">
          {isSprinkleMode ? 'Sprinkler Active: Burst Mode' : isPaintMode ? 'Pen Mode: Single Notes' : 'Seek Mode'}
        </div>
      </div>
      <div ref={melodyScrollRef} className="piano-roll-melody-scroll-container">
        <div className="piano-roll-section">
          <div className="piano-roll-label">Lead Voice (Melody)</div>
          <div className="piano-roll-canvas-stack" style={{ height: PITCH_HEIGHT }} onClick={handleClick}>
            <div className="piano-roll-grid-overlay" style={{ width: Math.max(totalWidth + 400, melodyScrollRef.current?.clientWidth || 0) }}>
              {renderGrid()}
            </div>
            <canvas ref={pitchCanvasRef} style={{ height: PITCH_HEIGHT, display: 'block', marginLeft: '50px' }} />
            <div 
              className="piano-roll-time-bar"
              style={{ 
                transform: `translateX(${melodyPlayheadX + 50}px)`
              }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PianoRoll;
