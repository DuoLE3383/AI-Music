import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import * as mm from '@magenta/music';
import MidiVisualizer from '../MidiVisualizer';

const App = () => {
  const [file, setFile] = useState(null);
  const [temp, setTemp] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [remixSequence, setRemixSequence] = useState(null);
  const [remixBlob, setRemixBlob] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const abortControllerRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    playerRef.current = new mm.Player();
    return () => { if (playerRef.current) playerRef.current.stop(); };
  }, []);

  const stopPlayer = () => {
    if (playerRef.current?.isPlaying()) playerRef.current.stop();
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying) stopPlayer();
    else if (remixSequence) {
      setIsPlaying(true);
      playerRef.current.start(remixSequence).then(() => setIsPlaying(false));
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true); setStatus('Uploading...'); stopPlayer();
    abortControllerRef.current = new AbortController();
    const formData = new FormData(); formData.append('file', file);

    try {
      const res = await axios.post(`http://localhost:8000/api/remix?temperature=${temp}`, formData, {
        responseType: 'blob', signal: abortControllerRef.current.signal,
        onUploadProgress: (e) => setUploadProgress(Math.round((e.loaded * 100) / e.total))
      });
      const ns = await mm.blobToNoteSequence(res.data);
      setRemixBlob(res.data); setRemixSequence(ns); setStatus('Remix complete!');
    } catch (e) { setStatus(axios.isCancel(e) ? 'Cancelled' : 'Failed'); }
    finally { setLoading(false); abortControllerRef.current = null; }
  };

  const handleGenerate = async () => {
    setLoading(true); setStatus('Generating...'); stopPlayer();
    abortControllerRef.current = new AbortController();
    try {
      const res = await axios.get(`http://localhost:8000/api/generate?temperature=${temp}`, {
        responseType: 'blob', signal: abortControllerRef.current.signal
      });
      const ns = await mm.blobToNoteSequence(res.data);
      setRemixBlob(res.data); setRemixSequence(ns); setStatus('Generation complete!');
    } catch (e) { setStatus(axios.isCancel(e) ? 'Cancelled' : 'Failed'); }
    finally { setLoading(false); }
  };

  const handleDownload = () => {
    const url = window.URL.createObjectURL(remixBlob);
    const a = document.createElement('a');
    a.href = url; a.download = file ? `remix_${file.name}` : 'generated.mid';
    a.click();
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>AI MIDI Remixer</h2>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{marginBottom: '20px'}} />
        <div style={{marginBottom: '20px'}}>
          <label>Temperature: {temp}</label>
          <input type="range" min="0.1" max="2.0" step="0.1" value={temp} onChange={(e) => setTemp(e.target.value)} style={{width: '100%'}} />
        </div>

        {loading && (
          <div style={{margin: '10px 0'}}>
            <div style={{fontSize: '12px'}}>{status} ({uploadProgress}%)</div>
            <div style={styles.progressBg}><div style={{...styles.progressFill, width: `${uploadProgress}%`}} /></div>
            <button onClick={() => abortControllerRef.current?.abort()} style={styles.cancelBtn}>Cancel</button>
          </div>
        )}

        <div style={{display: 'flex', gap: '10px'}}>
          <button onClick={handleUpload} disabled={loading || !file} style={loading || !file ? styles.btnDisabled : styles.btn}>Remix</button>
          <button onClick={handleGenerate} disabled={loading} style={loading ? styles.btnDisabled : {...styles.btn, backgroundColor: '#673ab7'}}>Generate</button>
        </div>

        {remixSequence && (
          <div style={{marginTop: '20px'}}>
            <MidiVisualizer sequence={remixSequence} />
            <button onClick={togglePlay} style={{...styles.btn, backgroundColor: isPlaying ? '#f44336' : '#2196f3', marginTop: '10px'}}>
              {isPlaying ? 'Stop' : 'Play'}
            </button>
            <button onClick={handleDownload} style={{...styles.btn, backgroundColor: '#4caf50', marginTop: '10px'}}>Download</button>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif' },
  card: { backgroundColor: '#1e1e1e', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' },
  btn: { width: '100%', padding: '10px', backgroundColor: '#3f51b5', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  btnDisabled: { width: '100%', padding: '10px', backgroundColor: '#444', color: '#888', border: 'none', borderRadius: '4px', cursor: 'not-allowed' },
  cancelBtn: { marginTop: '5px', backgroundColor: 'transparent', color: '#ff5252', border: '1px solid #ff5252', borderRadius: '4px', cursor: 'pointer', width: '100%', padding: '5px' },
  progressBg: { width: '100%', height: '8px', backgroundColor: '#333', borderRadius: '4px', overflow: 'hidden', marginTop: '5px' },
  progressFill: { height: '100%', backgroundColor: '#3f51b5', transition: 'width 0.3s ease' }
};
export default App;