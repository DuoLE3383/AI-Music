import React, { useRef, useEffect } from 'react';
import * as mm from '@magenta/music';

const MidiVisualizer = ({ sequence }) => {
  const pitchCanvasRef = useRef(null);
  const rhythmCanvasRef = useRef(null);
  const pitchVisRef = useRef(null);
  const rhythmVisRef = useRef(null);

  useEffect(() => {
    if (!sequence) return;

    // 1. Initialize Pitch Visualizer (Standard Piano Roll)
    if (pitchCanvasRef.current) {
      pitchVisRef.current = new mm.PianoRollCanvasVisualizer(sequence, pitchCanvasRef.current, {
        noteRGB: '99, 102, 241',
        activeNoteRGB: '255, 255, 255',
        pixelsPerTimeStep: 40,
      });
    }

    // 2. Initialize Rhythm Visualizer (Flattened Pitch)
    if (rhythmCanvasRef.current) {
      // Create a copy of the sequence where all notes have the same pitch
      const rhythmSequence = {
        ...sequence,
        notes: sequence.notes.map(n => ({ ...n, pitch: 60 })) 
      };

      rhythmVisRef.current = new mm.PianoRollCanvasVisualizer(rhythmSequence, rhythmCanvasRef.current, {
        noteRGB: '139, 92, 246',
        activeNoteRGB: '255, 255, 255',
        pixelsPerTimeStep: 40,
      });
    }

    return () => {
      pitchVisRef.current = null;
      rhythmVisRef.current = null;
    };
  }, [sequence]);

  return (
    <div style={styles.visualizerContainer}>
      <div style={styles.section}>
        <div style={styles.label}>Pitch Profile</div>
        <div style={styles.canvasWrapper}>
          <canvas ref={pitchCanvasRef} />
        </div>
      </div>
      
      <div style={styles.section}>
        <div style={styles.label}>Rhythmic Pattern</div>
        <div style={styles.canvasWrapper}>
          <canvas ref={rhythmCanvasRef} />
        </div>
      </div>
    </div>
  );
};

const styles = {
  visualizerContainer: {
    marginTop: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  section: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: '12px',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.05)'
  },
  label: {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: '#64748b',
    marginBottom: '8px',
    fontWeight: '800'
  },
  canvasWrapper: {
    width: '100%',
    height: '100px',
    overflowX: 'auto',
    overflowY: 'hidden'
  }
};
export default MidiVisualizer;