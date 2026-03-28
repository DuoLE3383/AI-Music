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
  0: 'C',
  2: 'D',
  4: 'E',
  5: 'F',
  7: 'G',
  9: 'A',
  11: 'B'
};

const IS_SHARP = [1, 3, 6, 8, 10];

const PianoRoll = ({ sequence, currentTime, onSeek, onAddNote, onRemoveNote }) => {
  const [isPaintMode, setIsPaintMode] = useState(false);
  const [isSprinkleMode, setIsSprinkleMode] = useState(false);
  const [pixelsPerBeat, setPixelsPerBeat] = useState(PIXELS_PER_BEAT);
  const pitchCanvasRef = useRef(null);
  const rhythmCanvasRef = useRef(null);
  const melodyScrollRef = useRef(null);
  const wrapperRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Get BPM from sequence or default to 120
  const qpm = sequence?.tempos?.[0]?.qpm || 120;
  const secondsPerBeat = 60 / qpm;
  const pixelsPerSecond = pixelsPerBeat / secondsPerBeat;
  const totalWidth = (sequence?.totalTime || 0) * pixelsPerSecond;

  // Melody Playhead
  const melodyPlayheadX = currentTime * pixelsPerSecond;

  // Rhythm Auto-Zoom logic: fit the entire sequence into the available container width
  // Subtracting 100px to account for the sidebar and padding
  const rhythmPPS = (sequence?.totalTime > 0 && containerWidth > 0) 
    ? (containerWidth - 100) / sequence.totalTime 
    : pixelsPerSecond;
  const rhythmPlayheadX = currentTime * rhythmPPS;

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
          width: '100%',
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

      if (rhythmCanvasRef.current) {
        // Create a copy of the sequence where all notes have the same pitch
        const rhythmSequence = {
          ...sequence,
          notes: sequence.notes.map(n => ({ ...n, pitch: 60 })) 
        };
        new mm.PianoRollCanvasVisualizer(rhythmSequence, rhythmCanvasRef.current, {
          noteRGB: '139, 92, 246',
          activeNoteRGB: '255, 255, 255',
          pixelsPerTimeStep: rhythmPPS,
          minPitch: 70,
          maxPitch: 80,
          noteHeight: RHYTHM_HEIGHT
        });
      }
    }
  }, [sequence, pixelsPerSecond, rhythmPPS]);

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

  const handleClick = (e, isRhythm = false) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sidebarWidth = 50;
    const x = Math.max(0, e.clientX - rect.left - sidebarWidth);
    const y = e.clientY - rect.top;
    
    const pps = isRhythm ? rhythmPPS : pixelsPerSecond;
    const seekTime = x / pps;

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
    <div style={styles.wrapper}>
      <div style={styles.headerRow}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => { setIsPaintMode(!isPaintMode); setIsSprinkleMode(false); }}
            style={{
              ...styles.toggleBtn, 
              backgroundColor: isPaintMode && !isSprinkleMode ? '#6366f1' : 'transparent',
              borderColor: isPaintMode && !isSprinkleMode ? '#818cf8' : '#334155'
            }}
          >
            ✏️ Pen
          </button>
          <button 
            onClick={() => { setIsSprinkleMode(!isSprinkleMode); setIsPaintMode(true); }}
            style={{
              ...styles.toggleBtn, 
              backgroundColor: isSprinkleMode ? '#a855f7' : 'transparent',
              borderColor: isSprinkleMode ? '#c084fc' : '#334155'
            }}
          >
            ✨ Sprinkle
          </button>
        </div>

        <div style={styles.zoomControls}>
          <button onClick={() => setPixelsPerBeat(prev => Math.max(10, prev - 10))} style={styles.zoomBtn}>-</button>
          <span style={styles.zoomLabel}>Zoom</span>
          <button onClick={() => setPixelsPerBeat(prev => Math.min(200, prev + 10))} style={styles.zoomBtn}>+</button>
        </div>

        <div style={styles.info}>
          {isSprinkleMode ? 'Sprinkler Active: Burst Mode' : isPaintMode ? 'Pen Mode: Single Notes' : 'Seek Mode'}
        </div>
      </div>
      <div ref={melodyScrollRef} style={styles.melodyScrollContainer}>
        <div style={styles.section}>
          <div style={styles.label}>Lead Voice (Melody)</div>
          <div style={{ ...styles.canvasStack, height: PITCH_HEIGHT }} onClick={(e) => handleClick(e, false)}>
            <div style={{ ...styles.gridOverlay, width: Math.max(totalWidth + 400, melodyScrollRef.current?.clientWidth || 0) }}>
              {renderGrid()}
            </div>
            <canvas ref={pitchCanvasRef} style={{ height: PITCH_HEIGHT, display: 'block', marginLeft: '50px' }} />
            <div 
              style={{
                ...styles.timeBar,
                transform: `translateX(${melodyPlayheadX + 50}px)`
              }} 
            />
          </div>
        </div>
        
        <div style={styles.section}>
          <div style={styles.label}>Rhythmic Pattern</div>
          <div style={{ ...styles.canvasStack, height: RHYTHM_HEIGHT }} onClick={(e) => handleClick(e, true)}>
            <canvas ref={rhythmCanvasRef} style={{ height: RHYTHM_HEIGHT, display: 'block', marginLeft: '50px' }} />
            <div 
              style={{
                ...styles.timeBar,
                transform: `translateX(${rhythmPlayheadX + 50}px)`
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
  headerRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '12px' },
  toggleBtn: {
    padding: '6px 12px',
    fontSize: '10px',
    fontWeight: '800',
    color: 'white',
    borderRadius: '6px',
    border: '1px solid',
    cursor: 'pointer',
    textTransform: 'uppercase',
    transition: 'all 0.2s ease'
  },
  selectSmall: { backgroundColor: '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: '4px', padding: '4px 8px', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' },
  zoomControls: { display: 'flex', alignItems: 'center', gap: '8px', marginRight: '20px' },
  zoomLabel: { fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
  info: { fontSize: '9px', color: '#6366f1', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 },
  section: { marginBottom: '16px' },
  label: { fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', marginBottom: '8px', fontWeight: '800' },
  melodyScrollContainer: {
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
  mainLayout: { display: 'flex', flexDirection: 'column' },
  zoomBtn: { backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' },
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
  gridLabelContainer: { 
    position: 'sticky', 
    left: 0, 
    zIndex: 5, 
    width: '50px', 
    height: '100%', 
    backgroundColor: '#0f172a', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    borderRight: '2px solid rgba(99, 102, 241, 0.2)',
    flexShrink: 0
  },
  gridLabel: {
    fontSize: '10px',
    color: '#94a3b8',
    fontWeight: '800',
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