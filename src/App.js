import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import * as mm from '@magenta/music';
import PianoRoll from './PianoRoll';
import MusicFunctions from './MusicGlossary';

const App = () => {
  const [file, setFile] = useState(null);
  const [temp, setTemp] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [timeSig, setTimeSig] = useState('4/4');
  const [length, setLength] = useState(8);
  const [instrument, setInstrument] = useState(0);
  const [bpm, setBpm] = useState(182);
  const [status, setStatus] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [remixSequence, setRemixSequence] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // States to track categorical parameters for the AI backend
  const [style, setStyle] = useState('pop');
  const [instrumentName, setInstrumentName] = useState('piano');
  const [structure, setStructure] = useState('verse');
  const [complexity, setComplexity] = useState('balanced');
  const [transposeVal, setTransposeVal] = useState(0);
  const [isReversed, setIsReversed] = useState(false);
  const [isHumanized, setIsHumanized] = useState(false);
  const [mode, setMode] = useState('major');

  const abortControllerRef = useRef(null);
  const playerRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Functions to create piano roll data (NoteSequences) programmatically
  const SequenceUtils = {
    /**
     * Creates a NoteSequence from raw note data.
     * @param {Array} notes - List of { pitch, start, end }
     */
    create: (notes) => ({
      notes: notes.map(n => ({ pitch: n.pitch, startTime: n.start, endTime: n.end, velocity: n.velocity || 80 })),
      totalTime: notes.length > 0 ? Math.max(...notes.map(n => n.end)) : 0,
      tempos: [{ qpm: bpm }]
    })
  };

  useEffect(() => {
    // Use SoundFontPlayer for high-quality instrument sounds
    playerRef.current = new mm.SoundFontPlayer('https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus');
    return () => {
      if (playerRef.current) playerRef.current.stop();
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Real-time update: If style changes, re-generate automatically
  useEffect(() => {
    if (remixSequence && !loading) {
      handleGenerate();
    }
    // Added missing dependencies to make the rack controls real-time
  }, [style, mode, timeSig, bpm, complexity, structure]);

  const stopPlayer = () => {
    if (playerRef.current?.isPlaying()) playerRef.current.stop();
    setIsPlaying(false);
    setCurrentTime(0);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  const togglePlay = () => {
    if (isPlaying) {
      stopPlayer();
    } else if (remixSequence) {
      playerRef.current.resumeContext(); // Call on the instance, not the class
      setIsPlaying(true);
      
      const offset = currentTime;
      const startTimestamp = Date.now();
      const updateProgress = () => {
        if (playerRef.current?.isPlaying()) {
          setCurrentTime(offset + (Date.now() - startTimestamp) / 1000);
          animationFrameRef.current = requestAnimationFrame(updateProgress);
        }
      };

      playerRef.current.start(remixSequence, undefined, offset).then(() => {
        setIsPlaying(false);
        if (playerRef.current && !playerRef.current.isPlaying()) setCurrentTime(0);
        cancelAnimationFrame(animationFrameRef.current);
      });

      updateProgress();
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true); setStatus('Uploading...'); setUploadProgress(0); stopPlayer();
    abortControllerRef.current = new AbortController();
    const formData = new FormData(); formData.append('file', file);

    try {
      const res = await axios.post(`http://localhost:8000/api/remix?temperature=${temp}&length=${length}&instrument=${instrument}&bpm=${bpm}`, formData, {
        responseType: 'blob', signal: abortControllerRef.current.signal,
        onUploadProgress: (e) => setUploadProgress(Math.round((e.loaded * 100) / e.total))
      });
      const ns = await mm.blobToNoteSequence(res.data);
      setRemixSequence(ns); setStatus('Remix complete!');
    } catch (e) { setStatus(axios.isCancel(e) ? 'Cancelled' : 'Failed'); }
    finally { setLoading(false); abortControllerRef.current = null; }
  };

  const handleGenerate = async () => {
    setLoading(true); setStatus('Generating...'); setUploadProgress(0); stopPlayer();
    abortControllerRef.current = new AbortController();
    try {
      const res = await axios.post(`http://localhost:8000/api/generate`, {
        style,
        instrument: instrumentName,
        instrument_id: instrument,
        structure,
        complexity,
        transpose: transposeVal,
        reverse: isReversed,
        humanize: isHumanized,
        temperature: temp,
        length: length,
        bpm: bpm,
        mode: mode,
        time_signature: timeSig
      }, {
        responseType: 'blob', 
        signal: abortControllerRef.current.signal,
        onDownloadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded * 100) / e.total));
        }
      });

      // If the backend returns an error message (JSON) instead of a MIDI file, 
      // we must extract the error text from the blob.
      if (res.data.type === 'application/json') {
        const text = await res.data.text();
        const errorJson = JSON.parse(text);
        throw new Error(errorJson.detail || errorJson.error || 'AI Generation failed');
      }

      const ns = await mm.blobToNoteSequence(res.data);
      setRemixSequence(ns); setStatus('Generation complete!');
    } catch (e) { 
      if (axios.isCancel(e)) {
        setStatus('Cancelled');
      } else {
        console.error('Generation Error:', e);
        setStatus(`Error: ${e.message || 'Failed'}`);
        alert(e.message || "The AI model failed to generate a melody. Check if the backend is running.");
      }
    }
    finally { setLoading(false); abortControllerRef.current = null; }
  };

  const handleGlossarySelect = (term, category) => {
    if (category === "App Operations") {
      if (term === "Remix") handleUpload();
      else if (term === "Generate") handleGenerate();
      else if (term === "Play" && !isPlaying) togglePlay();
      else if (term === "Stop" && isPlaying) stopPlayer();
      else if (term === "Add CDEFGAB") handleAddCDEFGABSequence();
      else if (term === "Download") handleDownload();
    } else if (category === "Instruments") {
      const name = term.toLowerCase();
      // Map to numeric ID for local playback/UI
      const instrumentMap = { 'piano': 0, 'guitar': 24, 'drums': 128, 'violin': 40, 'bass': 32, 'keyboard': 80 };
      if (instrumentMap[name] !== undefined) {
        updateInstrument(instrumentMap[name].toString());
      }
      setStatus(`Instrument set to ${term}`);
    } else if (category === "Style Presets") {
      const styleCode = term.toLowerCase().replace('-', '');
      setStyle(styleCode);
      setStatus(`AI Style set to ${term}`);
    } else if (category === "Song Structure") {
      setStructure(term.toLowerCase());
      setStatus(`Song structure set to ${term}`);
    } else if (category === "Time Signature") {
      setTimeSig(term);
      setStatus(`Time signature set to ${term}`);
    } else if (category === "Scale" || term === "Major" || term === "Minor") {
      setMode(term.toLowerCase());
      setStatus(`Scale set to ${term}`);
    } else if (category === "Melodic Transform") {
      if (!remixSequence) {
        setStatus('Generate a sequence first');
        return;
      }

      setRemixSequence(prev => {
        const newSequence = JSON.parse(JSON.stringify(prev)); // Deep copy to trigger re-render
        
        if (term === "Transpose +") {
          setTransposeVal(v => v + 1);
          newSequence.notes = prev.notes.map(n => ({ ...n, pitch: Math.min(127, n.pitch + 1) }));
        } 
        else if (term === "Transpose -") {
          setTransposeVal(v => v - 1);
          newSequence.notes = prev.notes.map(n => ({ ...n, pitch: Math.max(0, n.pitch - 1) }));
        } 
        else if (term === "Reverse") {
          setIsReversed(!isReversed);
          const total = prev.totalTime;
          newSequence.notes = prev.notes.map(n => ({
            ...n,
            startTime: total - n.endTime,
            endTime: total - n.startTime
          })).sort((a, b) => a.startTime - b.startTime);
        } 
        else if (term === "Humanize") {
          setIsHumanized(!isHumanized);
          newSequence.notes = prev.notes.map(n => {
            const timeJitter = (Math.random() - 0.5) * 0.04; // 40ms jitter
            const velJitter = Math.floor((Math.random() - 0.5) * 30);
            const newStart = Math.max(0, n.startTime + timeJitter);
            return {
              ...n,
              startTime: newStart,
              endTime: Math.max(newStart + 0.05, n.endTime + timeJitter),
              velocity: Math.max(1, Math.min(127, (n.velocity || 80) + velJitter))
            };
          });
        }
        
        return newSequence;
      });

      setStatus(`Applied ${term} to current sequence`);
    } else if (category === "AI Complexity") {
      setComplexity(term.toLowerCase());
      setStatus(`AI Complexity set to ${term}`);
    }
  };

  const updateInstrument = (val) => {
    const id = parseInt(val);
    setInstrument(id);
    const idMap = { 
      0: 'piano', 
      24: 'guitar', 
      40: 'violin', 
      56: 'trumpet', 
      80: 'keyboard', 
      118: 'drums', 
      128: 'drums' 
    };
    if (idMap[id]) setInstrumentName(idMap[id]);

    // Patch existing sequence so playback uses the new instrument immediately without regeneration
    if (remixSequence) {
      setRemixSequence(prev => ({
        ...prev,
        notes: prev.notes.map(n => ({ 
          ...n, 
          program: id, 
          isDrum: id === 118 || id === 128 
        }))
      }));
    }
  };

  const handleNoteAdd = (note) => {
    setRemixSequence(prev => ({
      notes: [...(prev?.notes || []), { ...note, program: instrument, isDrum: instrument === 118 || instrument === 128 }],
      tempos: prev?.tempos || [{ qpm: bpm }],
      // Ensure totalTime expands if we paint beyond the current end
      totalTime: Math.max(prev?.totalTime || 0, note.endTime)
    }));
    setStatus('Note added manually');
  };

  const handleNoteRemove = (noteToRemove) => {
    setRemixSequence(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        notes: prev.notes.filter(n => n !== noteToRemove)
      };
    });
    setStatus('Note removed');
  };

  const handleAddCDEFGABSequence = () => {
    const cdefgabPitches = [60, 62, 64, 65, 67, 69, 71]; // C4, D4, E4, F4, G4, A4, B4
    const beatDuration = 60 / bpm;
    const noteDuration = beatDuration / 2; // Actual half-beat duration in seconds

    setRemixSequence(prev => {
      const newNotes = [];
      let startTime = 0; // Always start at the beginning for Quick Start

      cdefgabPitches.forEach(pitch => {
        newNotes.push({
          pitch: pitch,
          startTime: startTime,
          endTime: startTime + noteDuration,
          velocity: 80,
          program: instrument, // Use current instrument
          isDrum: instrument === 118 || instrument === 128
        });
        startTime += noteDuration;
      });

      return {
        notes: newNotes,
        totalTime: startTime,
        tempos: [{ qpm: bpm }]
      };
    });
    setStatus('Added CDEFGAB sequence');
  };

  const handleSeek = (time) => {
    if (isPlaying) stopPlayer();
    setCurrentTime(time);
  };

  const handleDownload = () => {
    if (!remixSequence) return;
    try {
      // Convert the current live NoteSequence back to MIDI bytes
      const midiBytes = mm.sequenceProtoToMidi(remixSequence);
      const blob = new Blob([midiBytes], { type: 'audio/midi' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; 
      a.download = file ? `remix_${file.name}` : 'generated.mid';
      a.click();
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error('Download failed:', err);
      setStatus('Download failed');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.logo}>AI MIDI <span style={{color: '#6366f1'}}>STUDIO</span></div>
        <div style={styles.statusBadge}>{status || 'Ready'}</div>
      </div>

      <div style={styles.mainLayout}>
        <div style={styles.leftColumn}>
          <MusicFunctions 
            onSelect={handleGlossarySelect} 
            activeValues={{
              style, instrumentName, structure, complexity, 
              transposeVal, isReversed, isHumanized, mode, timeSig 
            }}
            sequence={remixSequence}
            temp={temp} setTemp={setTemp}
            bpm={bpm} setBpm={setBpm}
            timeSig={timeSig} setTimeSig={setTimeSig}
            length={length} setLength={setLength}
            instrument={instrument} updateInstrument={updateInstrument}
            setFile={setFile}
            handleUpload={handleUpload}
            handleGenerate={handleGenerate}
            loading={loading}
            uploadProgress={uploadProgress}
          />
        </div>

        <div style={styles.rightColumn}>
          {remixSequence ? (
            <div style={styles.visualizerCard}>
              <div style={styles.rightHeader}>
                <div style={styles.dawTab}>Piano Roll - Pattern 1</div>
                <div style={{display: 'flex', gap: '8px'}}>
                  <button 
                    onClick={togglePlay} 
                    style={{
                      ...styles.controlBtn, 
                      color: isPlaying ? '#ef4444' : '#10b981',
                      backgroundColor: isPlaying ? 'rgba(239, 68, 68, 0.1)' : 'transparent'
                    }}>
                    {isPlaying ? 'Stop' : 'Play'}
                  </button>
                  <button onClick={handleDownload} style={{...styles.controlBtn, color: '#e67e22'}}>Download</button>
                </div>
              </div>

              <div style={styles.pianoRollWrapper}>
                <PianoRoll 
                  sequence={{...remixSequence, tempos: [{ qpm: bpm }]}} 
                  currentTime={currentTime} 
                  onSeek={handleSeek}
                  onAddNote={handleNoteAdd}
                  onRemoveNote={handleNoteRemove}
                />
              </div>

              <div style={styles.subSection}>
                <div style={styles.label}>Waveform Pattern</div>
                <div style={styles.waveformPlaceholder}>Waveform rendering engine ready...</div>
              </div>

              <div style={styles.subSection}>
                <div style={styles.label}>AI Generation Insights</div>
                <div style={styles.insightsGrid}>
                  <div style={styles.insightItem}>
                    <div style={styles.insightLabel}>Style</div>
                    <div style={styles.insightValue}>{style}</div>
                  </div>
                  <div style={styles.insightItem}>
                    <div style={styles.insightLabel}>Complexity</div>
                    <div style={styles.insightValue}>{complexity}</div>
                  </div>
                  <div style={styles.insightItem}>
                    <div style={styles.insightLabel}>Structure</div>
                    <div style={styles.insightValue}>{structure}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={styles.emptyStateCard}>
              <h2 style={styles.visualizerTitle}>Output Preview</h2>
              <p style={{color: '#64748b', fontSize: '14px'}}>Waiting for generation or remix...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', width: '100%', boxSizing: 'border-box', fontFamily: "'Segoe UI', Tahoma, sans-serif", background: '#191c21', color: '#bdc3c7', overflowY: 'auto', padding: '0 20px 40px 20px' },
  header: { width: '100%', maxWidth: '1600px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '2px solid #2c313a', marginBottom: '30px' },
  logo: { fontSize: '20px', fontWeight: '900', letterSpacing: '2px', color: '#e67e22' },
  statusBadge: { fontSize: '10px', padding: '6px 12px', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '20px', color: '#818cf8', fontWeight: '700', textTransform: 'uppercase' },
  mainLayout: { display: 'flex', flexDirection: 'row', gap: '40px', alignItems: 'flex-start', width: '100%', maxWidth: '1600px', flexWrap: 'wrap' },
  leftColumn: { display: 'flex', flexDirection: 'column', gap: '20px', flex: '1 1 380px', minWidth: '320px', maxWidth: '450px' },
  rightColumn: { flex: '2 1 600px', width: '100%', minWidth: '320px' },
  controlCard: { backgroundColor: '#24282e', padding: '24px', borderRadius: '4px', border: '1px solid #3e444e', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' },
  visualizerCard: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  rightHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  dawTab: { fontSize: '9px', fontWeight: '800', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '1.5px' },
  pianoRollWrapper: { background: 'transparent' },
  section: { marginBottom: '24px' },
  row: { display: 'flex', gap: '20px', marginBottom: '24px' },
  label: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', display: 'block', marginBottom: '8px', fontWeight: '700' },
  fileInput: { width: '100%', padding: '12px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px dashed #475569', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' },
  select: { width: '100%', padding: '12px', backgroundColor: '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: '12px', outline: 'none' },
  controlBtn: { padding: '6px 16px', backgroundColor: 'transparent', border: '1px solid #334155', borderRadius: '4px', cursor: 'pointer', fontWeight: '900', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', color: '#94a3b8' },
  progressBg: { width: '100%', height: '6px', backgroundColor: '#1e293b', borderRadius: '3px', overflow: 'hidden', marginTop: '12px' },
  rangeDAW: { width: '100%', accentColor: '#6366f1', cursor: 'pointer' },
  subSection: { padding: '20px' },
};
export default App;