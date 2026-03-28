import React, { useRef, useEffect, useState } from 'react';
import * as mm from '@magenta/music';

const PIXELS_PER_BEAT = 40; 
const PITCH_HEIGHT = 400;
const RHYTHM_HEIGHT = 100;
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
  0: 'C (Do)',
  2: 'D (Re)',
  4: 'E (Mi)',
  5: 'F (Fa)',
  7: 'G (Sol)',
  9: 'A (La)',
  11: 'B (Si)'
};

const IS_SHARP = [1, 3, 6, 8, 10];

const PianoRoll = ({ sequence, currentTime, onSeek, onAddNote, onRemoveNote }) => {
  const [isPaintMode, setIsPaintMode] = useState(false);
  const [pixelsPerBeat, setPixelsPerBeat] = useState(PIXELS_PER_BEAT);
  const pitchCanvasRef = useRef(null);
  const rhythmCanvasRef = useRef(null);
  const containerRef = useRef(null);

  // Get BPM from sequence or default to 120
  const qpm = sequence?.tempos?.[0]?.qpm || 120;
  const secondsPerBeat = 60 / qpm;
  const pixelsPerSecond = pixelsPerBeat / secondsPerBeat;
  const totalWidth = (sequence?.totalTime || 0) * pixelsPerSecond;

  // Calculate playhead position based on time -> pixels
  const playheadPosition = currentTime * pixelsPerSecond;

  const renderGrid = () => {
    const lines = [];

    // Horizontal Pitch Rows
    for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
      const mod = p % 12;
      const y = (MAX_PITCH - p) * PITCH_NOTE_HEIGHT;
      const isSharp = IS_SHARP.includes(mod);
      
      lines.push(
        <div key={`row-${p}`} style={{ 
          ...styles.gridRow, 
          top: y, 
          height: PITCH_NOTE_HEIGHT,
          backgroundColor: isSharp ? 'rgba(0,0,0,0.3)' : 'transparent'
        }}>
          <div style={styles.gridLine} />
          <div style={styles.gridLabelContainer}>
            <span style={{...styles.gridLabel, color: isSharp ? '#475569' : '#94a3b8'}}>
              {NATURAL_LABELS[mod] || PITCH_LABELS[mod]}
            </span>
          </div>
        </div>
      );
    }

    // Vertical Beat Lines
    const totalBeats = Math.ceil((sequence?.totalTime || 0) / secondsPerBeat) + 4;
    for (let i = 0; i <= totalBeats; i++) {
      lines.push(<div key={`v-${i}`} style={{ ...styles.verticalLine, left: i * pixelsPerBeat, borderLeft: i % 4 === 0 ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.05)' }} />);
    }

    return lines;
  };

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

      if (rhythmCanvasRef.current) {
        // Create a copy of the sequence where all notes have the same pitch
        const rhythmSequence = {
          ...sequence,
          notes: sequence.notes.map(n => ({ ...n, pitch: 60 })) 
        };
        new mm.PianoRollCanvasVisualizer(rhythmSequence, rhythmCanvasRef.current, {
          noteRGB: '139, 92, 246',
          activeNoteRGB: '255, 255, 255',
          pixelsPerTimeStep: pixelsPerSecond,
          minPitch: 60,
          maxPitch: 60,
          noteHeight: RHYTHM_HEIGHT
        });
      }
    }
  }, [sequence, pixelsPerSecond]);

  // Auto-scroll the container to follow the playhead
  useEffect(() => {
    if (containerRef.current && playheadPosition > 0) {
      const container = containerRef.current;
      const scrollBuffer = 100;
      if (playheadPosition > container.scrollLeft + container.clientWidth - scrollBuffer) {
        container.scrollLeft = playheadPosition - (container.clientWidth / 2);
      }
    }
  }, [playheadPosition]);

  const handleClick = (e, isRhythm = false) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const seekTime = x / pixelsPerSecond;

    if (isPaintMode && sequence) {
      let pitch = 60;
      if (isRhythm) {
        pitch = 60; // Use fixed pitch for rhythm painting to match visualizer
      } else {
        // Precisely map Y coordinate to MIDI pitch using the same height logic
        pitch = MAX_PITCH - Math.floor(y / PITCH_NOTE_HEIGHT);
      }
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
        onAddNote({
          pitch: pitch,
          startTime: seekTime,
          endTime: seekTime + (secondsPerBeat / 4), // Add a 16th note by default
          velocity: 80
        });
      }
    } else if (onSeek) {
      onSeek(Math.max(0, Math.min(seekTime, sequence?.totalTime || 0)));
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.headerRow}>
        <button 
          onClick={() => setIsPaintMode(!isPaintMode)}
          style={{
            ...styles.toggleBtn, 
            backgroundColor: isPaintMode ? '#6366f1' : 'transparent',
            borderColor: isPaintMode ? '#818cf8' : '#334155'
          }}
        >
          {isPaintMode ? '✏️ Pen Mode' : '🔍 Seek Mode'}
        </button>

        <div style={styles.zoomControls}>
          <button onClick={() => setPixelsPerBeat(prev => Math.max(10, prev - 10))} style={styles.zoomBtn}>-</button>
          <span style={styles.zoomLabel}>Zoom</span>
          <button onClick={() => setPixelsPerBeat(prev => Math.min(200, prev + 10))} style={styles.zoomBtn}>+</button>
        </div>

        <div style={styles.info}>
          {isPaintMode ? 'Click canvas to add notes' : 'Click to Seek'}
        </div>
      </div>
      <div ref={containerRef} style={styles.scrollContainer}>
        <div style={styles.section}>
          <div style={styles.label}>Lead Voice (Melody)</div>
          <div style={{ ...styles.canvasStack, height: PITCH_HEIGHT }} onClick={(e) => handleClick(e, false)}>
            <div style={{ ...styles.gridOverlay, width: Math.max(2000, totalWidth + 400) }}>
              {renderGrid()}
            </div>
            <canvas ref={pitchCanvasRef} style={{ height: PITCH_HEIGHT, display: 'block' }} />
            <div 
              style={{
                ...styles.timeBar,
                transform: `translateX(${playheadPosition}px)`
              }} 
            />
          </div>
        </div>
        
        <div style={styles.section}>
          <div style={styles.label}>Rhythmic Pattern</div>
          <div style={{ ...styles.canvasStack, height: RHYTHM_HEIGHT }} onClick={(e) => handleClick(e, true)}>
            <canvas ref={rhythmCanvasRef} style={{ height: RHYTHM_HEIGHT, display: 'block' }} />
            <div 
              style={{
                ...styles.timeBar,
                transform: `translateX(${playheadPosition}px)`
              }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  wrapper: {
    backgroundColor: '#020617',
    padding: '20px',
    borderRadius: '20px',
    border: '1px solid #1e293b',
    marginBottom: '20px'
  },
  headerRow: { display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' },
  toggleBtn: {
    marginRight: 'auto',
    fontSize: '9px',
    fontWeight: '800',
    color: 'white',
    border: '1px solid',
    borderRadius: '4px',
    padding: '4px 10px',
    cursor: 'pointer',
    textTransform: 'uppercase',
    transition: 'all 0.2s',
    letterSpacing: '0.5px'
  },
  zoomControls: { display: 'flex', alignItems: 'center', gap: '8px', marginRight: '20px' },
  zoomBtn: { 
    backgroundColor: '#1e293b', 
    border: '1px solid #334155', 
    color: 'white', 
    borderRadius: '4px', 
    padding: '2px 8px', 
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    transition: 'background 0.2s'
  },
  zoomLabel: { fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
  info: { fontSize: '9px', color: '#6366f1', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 },
  section: { marginBottom: '16px' },
  label: { fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', marginBottom: '8px', fontWeight: '800' },
  scrollContainer: {
    width: '100%',
    overflowX: 'auto',
    backgroundColor: '#0f172a',
    borderRadius: '12px',
    padding: '12px',
    border: '1px solid #1e293b',
    // Custom scrollbar styling
    scrollbarWidth: 'thin',
    scrollbarColor: '#334155 transparent'
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: PITCH_HEIGHT,
    pointerEvents: 'none',
    zIndex: 1
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    width: '100%',
    height: '1px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  gridRow: {
    position: 'absolute',
    left: 0,
    width: '100%',
    display: 'flex',
    alignItems: 'flex-start',
    borderBottom: '1px solid rgba(255,255,255,0.02)',
    boxSizing: 'border-box'
  },
  gridLabelContainer: { position: 'sticky', left: 0, zIndex: 5, paddingLeft: '4px' },
  gridLabel: {
    fontSize: '8px',
    color: '#475569',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
  },
  verticalLine: { position: 'absolute', top: 0, height: '100%', pointerEvents: 'none' },
  canvasStack: { position: 'relative', display: 'inline-block', cursor: 'pointer' },
  timeBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '2px',
    height: '100%',
    backgroundColor: '#ef4444',
    zIndex: 10,
    pointerEvents: 'none',
    boxShadow: '0 0 8px #ef4444'
  }
};

export default PianoRoll;