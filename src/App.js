import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import * as mm from '@magenta/music/es6/core';

const App = () => {
  const [file, setFile] = useState(null);
  const [temp, setTemp] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [remixSequence, setRemixSequence] = useState(null);
  const [remixBlob, setRemixBlob] = useState(null);

  const canvasRef = useRef(null);
  const visualizerRef = useRef(null);

  useEffect(() => {
    if (remixSequence && canvasRef.current) {
      // Clear the canvas before creating a new visualizer
      const context = canvasRef.current.getContext('2d');
      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      visualizerRef.current = new mm.PianoRollCanvasVisualizer(
        remixSequence,
        canvasRef.current,
        {
          noteRGB: '63, 81, 181',
          pixelsPerTimeStep: 30,
        }
      );
    }

    // Cleanup function to prevent memory leaks
    return () => {
      if (visualizerRef.current) {
        visualizerRef.current = null;
      }
    };
  }, [remixSequence]);

  const handleFileChange = (e) => setFile(e.target.files[0]);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setRemixSequence(null);
    setRemixBlob(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`http://localhost:8000/api/remix?temperature=${temp}`, formData, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data]);
      setRemixBlob(blob);

      // Convert blob to NoteSequence for visualization
      const ns = await mm.blobToNoteSequence(blob);
      setRemixSequence(ns);
      setStatus('Remix complete!');

    } catch (error) {
      if (axios.isCancel(error)) {
        console.log('Request cancelled:', error.message);
        setStatus('Generation cancelled.');
      } else {
        console.error('Error generating remix:', error);
        alert("Error processing MIDI. Make sure it's a short melodic phrase (2-4 bars).");
        setStatus('Failed.');
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null; // Clear the controller after request finishes or is cancelled
    }
  };

  const handleDownload = () => {
    if (!remixBlob) return;
    const url = window.URL.createObjectURL(remixBlob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `remix_${file.name}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleReset = () => {
    setFile(null);
    setRemixSequence(null);
    setRemixBlob(null);
    if (canvasRef.current) {
      canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={{marginTop: 0}}>FL AI Remixer</h2>
        <p style={{fontSize: '14px', color: '#888'}}>Export Piano Roll as MIDI, upload, then drag back to FL.</p>
        
        <input type="file" accept=".mid,.midi" onChange={handleFileChange} style={{marginBottom: '20px'}} />
        
        <div style={{marginBottom: '20px'}}>
          <label style={{display: 'block', marginBottom: '10px'}}>Creativity (Temp): {temp}</label>
          <input 
            type="range" min="0.1" max="2.0" step="0.1" 
            value={temp} onChange={(e) => setTemp(parseFloat(e.target.value))}
            style={{width: '100%'}}
          />
        </div>

        <button 
          onClick={handleUpload} 
          disabled={loading || !file}
          style={loading ? styles.buttonDisabled : styles.button}
        >
          {loading ? 'Generating...' : 'Generate Remix'}
        </button>

        {loading && ( // Show cancel button only when loading
          <button
            onClick={handleCancel}
            style={{ ...styles.button, backgroundColor: '#ff9800', marginTop: '10px' }}
          >
            Cancel Generation
          </button>
        )}

        {remixSequence && (
          <div style={{marginTop: '20px'}}>
            <h4 style={{marginBottom: '10px'}}>Preview:</h4>
            <button onClick={handleDownload} style={{...styles.button, backgroundColor: '#4caf50', marginTop: '10px'}}>
              Download MIDI
            </button>
            <button onClick={handleReset} style={{...styles.button, backgroundColor: '#f44336', marginTop: '10px'}}>
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#121212', color: '#fff', fontFamily: 'sans-serif', padding: '20px' },
  card: { backgroundColor: '#1e1e1e', padding: '30px', borderRadius: '12px', width: '450px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' },
  button: { width: '100%', padding: '12px', backgroundColor: '#3f51b5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: 'background-color 0.3s ease' },
  buttonDisabled: { width: '100%', padding: '12px', backgroundColor: '#444', color: '#888', border: 'none', borderRadius: '6px', cursor: 'not-allowed' },
  progressContainer: { margin: '20px 0' },
  statusText: { fontSize: '12px', marginBottom: '5px', color: '#aaa' },
  progressBarBackground: {
    width: '100%',
    height: '10px',
    backgroundColor: '#333',
    borderRadius: '5px',
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3f51b5',
    transition: 'width 0.3s ease'
  },
  pulseAnimation: {
    backgroundColor: '#637be1', // A slightly different color to indicate indeterminate state
    opacity: 0.8,
    animation: 'pulse 1.5s infinite alternate' // You'd need to define this CSS animation
  },
};

export default App;