import React, { useRef, useEffect, useState } from 'react';
import * as mm from '@magenta/music';

const PIXELS_PER_STEP = 40;

const PianoRoll = ({ sequence, currentTime, onSeek, onAddNote }) => {
  const [isPaintMode, setIsPaintMode] = useState(false);
  const pitchCanvasRef = useRef(null);
  const rhythmCanvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (sequence) {
      if (pitchCanvasRef.current) {
        new mm.PianoRollCanvasVisualizer(sequence, pitchCanvasRef.current, {
          noteRGB: '99, 102, 241',
          activeNoteRGB: '255, 255, 255',
          pixelsPerTimeStep: PIXELS_PER_STEP,
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
          pixelsPerTimeStep: PIXELS_PER_STEP,
        });
      }
    }
  }, [sequence]);

  // Calculate playhead position
  const playheadPosition = currentTime * PIXELS_PER_STEP;

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
    if (!sequence) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const seekTime = x / PIXELS_PER_STEP;

    if (isPaintMode && onAddNote) {
      let pitch;
      if (isRhythm) {
        pitch = 60; // Use fixed pitch for rhythm painting to match visualizer
      } else {
        // Map Y coordinate to MIDI pitch (range: 36 - 84)
        const canvasHeight = rect.height || 150;
        pitch = Math.round(84 - (y / canvasHeight) * (84 - 36));
      }
      
      onAddNote({
        pitch: Math.max(0, Math.min(127, pitch)),
        startTime: seekTime,
        endTime: seekTime + 0.25,
        velocity: 80
      });
    } else if (onSeek) {
      onSeek(Math.max(0, Math.min(seekTime, sequence.totalTime || 0)));
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
          {isPaintMode ? '🖌️ Paint Mode' : '🔍 Seek Mode'}
        </button>
        <div style={styles.info}>
          {isPaintMode ? 'Click canvas to add notes' : 'Click to Seek'}
        </div>
      </div>
      <div ref={containerRef} style={styles.scrollContainer}>
        <div style={styles.section}>
          <div style={styles.label}>Pitch Profile</div>
          <div style={styles.canvasStack} onClick={(e) => handleClick(e, false)}>
            <canvas ref={pitchCanvasRef} />
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
          <div style={styles.canvasStack} onClick={(e) => handleClick(e, true)}>
            <canvas ref={rhythmCanvasRef} />
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
  info: { fontSize: '9px', color: '#6366f1', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 },
  section: { marginBottom: '16px' },
  label: { fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', marginBottom: '8px', fontWeight: '800' },
  scrollContainer: {
    width: '100%',
    overflowX: 'auto',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: '12px',
    padding: '12px'
  },
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