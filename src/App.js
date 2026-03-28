import React, { useState, useRef, useEffect } from 'react';
import * as mm from '@magenta/music';
import PianoRoll from './PianoRoll';
import MusicFunctions from './MusicGlossary';
import TransportBar from './TransportBar';
import { generateMusic, remixMusic } from './services/api';
import './App.css';

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
  const [checkpoints, setCheckpoints] = useState([]);

  // States to track categorical parameters for the AI backend
  const [style, setStyle] = useState('pop');
  const [instrumentName, setInstrumentName] = useState('piano');
  const [structure, setStructure] = useState('verse');
  const [complexity, setComplexity] = useState('balanced');
  const [transposeVal, setTransposeVal] = useState(0);
  const [isReversed, setIsReversed] = useState(false);
  const [isHumanized, setIsHumanized] = useState(false);
  const [mode, setMode] = useState('major');
  const [root, setRoot] = useState('C');
  const [role, setRole] = useState('');
  const [chords, setChords] = useState(['C']);
  const [theoryTerm, setTheoryTerm] = useState('');
  const [prodTerm, setProdTerm] = useState('');
  const [phrase, setPhrase] = useState('');

  const abortControllerRef = useRef(null);
  const playerRef = useRef(null);
  const midiMeRef = useRef(null);
  const mvaeRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    // Use SoundFontPlayer for high-quality instrument sounds
    playerRef.current = new mm.SoundFontPlayer('https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus');
    // Initialize MidiMe for personalized AI training
    midiMeRef.current = new mm.MidiMe({ latent_size: 4, epochs: 20 });
    // Load MusicVAE to act as the "encoder" for our training data
    mvaeRef.current = new mm.MusicVAE('https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_2bar_small');
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
  }, [style, mode, root, timeSig, bpm, complexity, structure, instrumentName, instrument]);

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
      playerRef.current.resumeContext();
      setIsPlaying(true);

      const offset = currentTime;
      const startTimestamp = Date.now();
      const updateProgress = () => {
        if (playerRef.current?.isPlaying()) {
          const elapsed = (Date.now() - startTimestamp) / 1000;
          const nextTime = offset + elapsed;
          setCurrentTime(nextTime);
          if (nextTime < remixSequence.totalTime) {
          animationFrameRef.current = requestAnimationFrame(updateProgress);
          }
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
      const params = { temperature: temp, length, instrument, bpm };
      const res = await remixMusic(formData, params, 
        (e) => setUploadProgress(Math.round((e.loaded * 100) / e.total)),
        abortControllerRef.current.signal
      );
      const ns = await mm.blobToNoteSequence(res.data);
      setRemixSequence(ns); setStatus('Remix complete!');
    } catch (e) { setStatus(e.name === 'AbortError' ? 'Cancelled' : 'Failed'); }
    finally { setLoading(false); abortControllerRef.current = null; }
  };

  const handleGenerate = async () => {
    setLoading(true); setStatus('Generating...'); setUploadProgress(0); stopPlayer();
    abortControllerRef.current = new AbortController();
    try {
      const payload = {
        style,
        instrument: instrumentName,
        instrument_id: instrument,
        structure,
        complexity,
        chords,
        transpose: transposeVal,
        reverse: isReversed,
        humanize: isHumanized,
        temperature: temp,
        length: length,
        bpm: bpm,
        mode: mode,
        root: root,
        time_signature: timeSig
      };

      const res = await generateMusic(payload, 
        (e) => { if (e.total) setUploadProgress(Math.round((e.loaded * 100) / e.total)); },
        abortControllerRef.current.signal
      );

      // If the backend returns an error message (JSON) instead of a MIDI file, 
      // we must extract the error text from the blob.
      if (res.data.type === 'application/json') {
        const text = await res.data.text();
        const errorJson = JSON.parse(text);
        throw new Error(errorJson.detail || errorJson.error || 'AI Generation failed');
      }

      const ns = await mm.blobToNoteSequence(res.data);
      setRemixSequence(ns); setStatus('Generation complete!');
      setCheckpoints(prev => [{
        id: Date.now(),
        type: `AI ${style.toUpperCase()}`,
        sequence: ns,
        timestamp: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 10));
    } catch (e) {
      if (e.name === 'AbortError') {
        setStatus('Cancelled');
      } else {
        let errorMsg = e.message;
        // Extract error details from Blob if backend returned an error JSON
        if (e.response && e.response.data instanceof Blob) {
          const text = await e.response.data.text();
          try {
            const json = JSON.parse(text);
            errorMsg = json.detail || json.error || errorMsg;
          } catch (pErr) { errorMsg = text || errorMsg; }
        }
        console.error('Generation Error:', e);
        setStatus(`Error: ${errorMsg}`);
        alert(`AI Generation Failed: ${errorMsg}`);
      }
    }
    finally { setLoading(false); abortControllerRef.current = null; }
  };

  // Auto-train the Personal AI whenever the sequence changes
  useEffect(() => {
    if (remixSequence && remixSequence.notes.length >= 4 && !loading) {
      handleTrainAI();
    }
  }, [remixSequence]);

  const handleTrainAI = async () => {
    if (!remixSequence || remixSequence.notes.length < 4) {
      return;
    }

    setLoading(true);
    setStatus('Training Personal AI...');

    try {
      const midiMe = midiMeRef.current;
      const mvae = mvaeRef.current;

      if (!midiMe.initialized) await midiMe.initialize();
      if (!mvae.initialized) await mvae.initialize();

      // Prepare the sequence: Quantize to 2-bar chunks (required by mel_2bar_small)
      const quantized = mm.sequences.quantizeNoteSequence(remixSequence, 4);
      quantized.notes = quantized.notes.filter(n => n.startTime < 32); // Limit to first 2 bars for training stability


      // Encode sequence into latents using MusicVAE
      const z = await mvae.encode([quantized]);

      // Train MidiMe on these specific latents to capture your personal style
      await midiMe.train(z);
      z.dispose();
      setStatus('Personal AI Checkpoint Updated!');
    } catch (e) {
      console.error(e);
      setStatus('Training Failed');
    } finally { setLoading(false); }
  };

  const handleGlossarySelect = (term, category) => {
    if (category === "App Operations") {
      if (term === "Remix") handleUpload();
      else if (term === "Generate") handleGenerate();
      else if (term === "Play" && !isPlaying) togglePlay();
      else if (term === "Stop" && isPlaying) stopPlayer();
      else if (term === "Add CDEFGAB") handleAddCDEFGABSequence();
      else if (term === "Download") handleDownload();
    } else if (category === "Checkpoints") {
      const cp = checkpoints.find(c => c.id.toString() === term);
      if (cp) { setRemixSequence(cp.sequence); setStatus(`Loaded ${cp.type}`); }
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
    } else if (category === "Root Note") {
      setRoot(term);
      setStatus(`Key set to ${term} ${mode}`);
    } else if (category === "Chords") {
      setChords(term.split('-'));
      setStatus(`Progression: ${term}`);
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
        else if (term === "Sprinkle") {
          const repeats = 2;
          const spacing = 60 / bpm / 4; // 16th note spacing based on current BPM
          const velDecay = 0.9;
          const sprinkledNotes = [];

          prev.notes.forEach(n => {
            sprinkledNotes.push(n);
            for (let i = 1; i <= repeats; i++) {
              sprinkledNotes.push({
                ...n,
                startTime: n.startTime + (i * spacing),
                endTime: n.endTime + (i * spacing),
                velocity: Math.floor(n.velocity * Math.pow(velDecay, i))
              });
            }
          });

          newSequence.notes = sprinkledNotes.sort((a, b) => a.startTime - b.startTime);
          newSequence.totalTime = Math.max(...sprinkledNotes.map(n => n.endTime));
        }

        return newSequence;
      });

      setStatus(`Applied ${term} to current sequence`);
    } else if (category === "AI Complexity") {
      setComplexity(term.toLowerCase());
      setStatus(`AI Complexity set to ${term}`);
    } else if (category === "Roles") {
      setRole(term.toLowerCase());
      setStatus(`Role set to ${term}`);
    } else if (category === "Basic") {
      setTheoryTerm(term.toLowerCase());
      setStatus(`Theory term: ${term}`);
    } else if (category === "Production") {
      setProdTerm(term.toLowerCase());
      setStatus(`Production setting: ${term}`);
    } else if (category === "Phrases") {
      setPhrase(term.toLowerCase());
      setStatus(`Concept: ${term}`);
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
    <div className="app-container">
      <header className="app-header">
        <div className="logo-section">
          <div className="logo">REASONABLE<span>R</span></div>
          <div className="status-badge">{status || 'System Ready'}</div>
        </div>
        <TransportBar 
          isPlaying={isPlaying} togglePlay={togglePlay} 
          bpm={bpm} setBpm={setBpm} timeSig={timeSig} 
          handleDownload={handleDownload} 
        />
      </header>

      <div className="main-layout">
        <aside className="sidebar">
          <MusicFunctions
            onSelect={handleGlossarySelect}
            activeValues={{
              style, instrumentName, structure, complexity, role,
              theoryTerm, prodTerm, phrase,
              transposeVal, isReversed, isHumanized, mode, root, timeSig
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
            handleTrain={handleTrainAI}
            checkpoints={checkpoints}
            loading={loading}
            uploadProgress={uploadProgress} />
        </aside>

        <main className="workspace">
          {remixSequence ? (
            <div className="editor-card">
              <div className="editor-header">
                <div className="daw-tab">Editor / <span style={{color: '#64748b'}}>Pattern_01</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="transport-label">Voice</span>
                  <select value={instrument} onChange={(e) => updateInstrument(e.target.value)} className="select-small">
                    <option value="0">Grand Piano</option>
                    <option value="24">Nylon Gtr</option>
                    <option value="32">Ac. Bass</option>
                    <option value="40">Violin</option>
                    <option value="128">Drum Kit</option>
                  </select>
                </div>
              </div>
              
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <PianoRoll
                  sequence={{ ...remixSequence, tempos: [{ qpm: bpm }] }}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                  onAddNote={handleNoteAdd}
                  onRemoveNote={handleNoteRemove} />
              </div>

              <div className="insights-row">
                <div className="insight-item">
                  <div className="insight-label">AI Personality</div>
                  <div className="insight-value">{style} / {complexity}</div>
                </div>
                <div className="insight-item">
                  <div className="insight-label">Context</div>
                  <div className="insight-value">{structure}</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #27272a', borderRadius: '12px' }}>
              <h2 style={{ color: '#334155', fontSize: '24px', fontWeight: '900', textTransform: 'uppercase' }}>No Data</h2>
              <p style={{ color: '#64748b', fontSize: '14px' }}>Waiting for generation or remix...</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;