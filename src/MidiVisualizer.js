import React, { useRef, useEffect } from 'react';
import * as mm from '@magenta/music';

import './MidiVisualizer.css';
const MidiVisualizer = ({ sequence }) => {
  const pitchCanvasRef = useRef(null);
  const pitchVisRef = useRef(null);

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

    return () => {
      pitchVisRef.current = null;
    };
  }, [sequence]);

  return (
    <div className="visualizer-container">
      <div className="visualizer-section">
        <div className="visualizer-label">Pitch Profile</div>
        <div className="canvas-wrapper">
          <canvas ref={pitchCanvasRef} />
        </div>
      </div>
    </div>
  );
};

export default MidiVisualizer;