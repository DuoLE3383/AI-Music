import React, { useEffect, useRef } from 'react';
import * as mm from '@magenta/music';

import './MusicGlossary.css';
const PIXELS_PER_STEP = 30;

const MusicFunctions = ({ 
  onSelect, activeValues = {}, sequence = null,
  temp, setTemp, bpm, setBpm, timeSig, setTimeSig, 
  length, setLength, instrument, updateInstrument,
  setFile, handleUpload, handleGenerate, loading, 
  uploadProgress, abortControllerRef
}) => {
  const pitchCanvasRef = useRef(null);

  useEffect(() => {
    if (sequence) {
      if (pitchCanvasRef.current) {
        new mm.PianoRollCanvasVisualizer(sequence, pitchCanvasRef.current, {
          noteRGB: '99, 102, 241',
          activeNoteRGB: '255, 255, 255',
          pixelsPerTimeStep: PIXELS_PER_STEP,
        });
      }
    }
  }, [sequence]);

  const modules = [
    {
      id: 'personality',
      title: "AI Personality",
      subsections: [
        { label: "Style Preset", items: ["Pop", "Rock", "Jazz", "Classical", "Hip-hop", "EDM"], category: "Style Presets" },
        { label: "Structure", items: ["Intro", "Verse", "Chorus", "Bridge", "Outro", "Hook"], category: "Song Structure" },
        { label: "Complexity", items: ["Stable", "Balanced", "Creative", "Chaotic"], category: "AI Complexity" }
      ]
    }
    // {
    //   id: 'composition',
    //   title: "Composition",
    //   subsections: [
    //   ]
    // },
    // {
    //   id: 'processing',
    //   title: "Melodic Transforms",
    //   subsections: [
    //     { label: "Post-Processing", items: ["Transpose +", "Transpose -", "Reverse", "Humanize", "Sprinkle"], category: "Melodic Transform" }
    //   ]
    // }
  ];

  const isItemActive = (item, label, category) => {
    const val = item.toLowerCase();
    const styleVal = val.replace('-', '');
    
    if (category === "Style Presets") return activeValues.style === styleVal;
    if (category === "AI Complexity") return activeValues.complexity === val;
    if (category === "Instruments") return activeValues.instrumentName === val;
    if (category === "Song Structure") return activeValues.structure === val;
    if (category === "Scale") return activeValues.mode === val;
    if (category === "Time Signature") return activeValues.timeSig === item;
    if (item === "Reverse") return activeValues.isReversed;
    if (item === "Humanize") return activeValues.isHumanized;
    return false;
  };

  return (
    <div className="music-glossary-container">
      <div className="music-glossary-rack-header">
        <div className="music-glossary-title">Control</div>
        <div className="music-glossary-status">Link Active</div>
      </div>
      
      <div className="music-glossary-rack-body">
        {/* Merged Global Controls */}
        <div className="music-glossary-module">
          <div className="music-glossary-module-label">Session Master</div>
          <div className="music-glossary-module-content">
            <div className="music-glossary-sub-section">
              <div className="music-glossary-sub-label">Base MIDI File</div>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} className="music-glossary-file-input" />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div className="music-glossary-sub-label">Scale</div>
                <div className="music-glossary-button-group">
                  {['Major', 'Minor'].map(m => (
                    <button key={m} onClick={() => onSelect(m, 'Scale')} 
                      className={`music-glossary-chip ${activeValues.mode === m.toLowerCase() ? 'active' : ''}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="music-glossary-sub-label">Time Sig</div>
                <div className="music-glossary-button-group">
                  {['3/4', '4/4', '6/8'].map(ts => (
                    <button key={ts} onClick={() => onSelect(ts, 'Time Signature')} 
                      className={`music-glossary-chip ${activeValues.timeSig === ts ? 'active' : ''}`}>
                      {ts}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Dynamic range inputs */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div className="music-glossary-sub-label">Temp: {temp}</div>
                <input type="range" min="0.1" max="2.0" step="0.1" value={temp} onChange={(e) => setTemp(parseFloat(e.target.value))} className="music-glossary-range" />
              </div>
              <div style={{ flex: 1 }}>
                <div className="music-glossary-sub-label">BPM: {bpm}</div>
                <input type="range" min="40" max="240" step="1" value={bpm} onChange={(e) => setBpm(parseInt(e.target.value))} className="music-glossary-range" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div className="music-glossary-sub-label">Length</div>
                <select value={length} onChange={(e) => setLength(parseInt(e.target.value))} className="music-glossary-select">
                  <option value="4">4 Bars</option>
                  <option value="8">8 Bars</option>
                  <option value="16">16 Bars</option>
                </select>
              </div>
            </div>

            {/* Dynamic button styles */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button onClick={handleUpload} disabled={loading} className={loading ? 'music-glossary-btn-disabled' : 'music-glossary-action-btn'}>Remix</button>
              <button onClick={handleGenerate} disabled={loading} className={loading ? 'music-glossary-btn-disabled' : 'music-glossary-action-btn'} style={loading ? {} : { backgroundColor: '#6366f1', color: 'white' }}>AI Generate</button>
            </div>
            {loading && <div className="music-glossary-progress-bg"><div className="music-glossary-progress-fill" style={{ width: `${uploadProgress}%` }} /></div>}
          </div>
        </div>

        {/* {sequence && (
          <div style={styles.module}>
            <div style={styles.moduleLabel}>Visual Monitor</div>
            <div style={styles.monitorGrid}>
              <div style={styles.monitorItem}>
                <div style={styles.subLabel}>Pitch</div>
                <div style={styles.miniCanvasScroll}><canvas ref={pitchCanvasRef} /></div>
              </div>
              <div style={styles.monitorItem}>
                <div style={styles.subLabel}>Rhythm</div>
                <div style={styles.miniCanvasScroll}><canvas ref={rhythmCanvasRef} /></div>
              </div>
            </div>
          </div>
        )} */}

        {modules.map((mod) => (
          <div key={mod.id} className="music-glossary-module">
            <div className="music-glossary-module-label">{mod.title}</div>
            <div className="music-glossary-module-content">
              {mod.subsections.map((sub) => (
                <div key={sub.label} className="music-glossary-sub-section">
                  <div className="music-glossary-sub-label">{sub.label}</div>
                  <div className="music-glossary-button-group">
                    {sub.items.map((item) => (
                      <button
                        key={item}
                        className={`music-glossary-chip ${isItemActive(item, sub.label, sub.category) ? 'active' : ''}`}
                        onClick={() => onSelect && onSelect(item, sub.category)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MusicFunctions;