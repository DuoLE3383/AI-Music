import React, { useRef, useEffect } from 'react';
import * as mm from '@magenta/music';

const MidiVisualizer = ({ sequence }) => {
  const canvasRef = useRef(null);
  const visualizerRef = useRef(null);

  useEffect(() => {
    if (sequence && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      visualizerRef.current = new mm.PianoRollCanvasVisualizer(sequence, canvasRef.current, {
        noteRGB: '63, 81, 181',
        pixelsPerTimeStep: 30,
      });
    }

    return () => {
      if (canvasRef.current) {
        const context = canvasRef.current.getContext('2d');
        context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      visualizerRef.current = null;
    };
  }, [sequence]);

  return (
    <div style={styles.visualizerContainer}>
      <canvas ref={canvasRef} />
    </div>
  );
};

const styles = {
  visualizerContainer: { width: '100%', height: '150px', backgroundColor: '#000', borderRadius: '6px', overflowX: 'auto', overflowY: 'hidden' }
};
export default MidiVisualizer;