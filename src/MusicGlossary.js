import React, { useEffect, useRef } from 'react';
import * as mm from '@magenta/music';

const PIXELS_PER_STEP = 30;

const MusicFunctions = ({ 
  onSelect, activeValues = {}, sequence = null,
  temp, setTemp, bpm, setBpm, timeSig, setTimeSig, 
  length, setLength, instrument, updateInstrument,
  setFile, handleUpload, handleGenerate, loading, 
  uploadProgress, abortControllerRef
}) => {
  const pitchCanvasRef = useRef(null);
  const rhythmCanvasRef = useRef(null);

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
        // Create a flattened rhythm sequence
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

  const modules = [
    {
      id: 'personality',
      title: "AI Personality",
      subsections: [
        { label: "Style Preset", items: ["Pop", "Rock", "Jazz", "Classical", "Hip-hop", "EDM"], category: "Style Presets" },
        { label: "Complexity", items: ["Stable", "Balanced", "Creative", "Chaotic"], category: "AI Complexity" }
      ]
    },
    {
      id: 'composition',
      title: "Lead Voice & Composition",
      subsections: [
        { label: "Lead Voice", items: ["Piano", "Guitar", "Drums", "Violin", "Bass", "Keyboard"], category: "Instruments" },
        { label: "Structure", items: ["Intro", "Verse", "Chorus", "Bridge", "Outro", "Hook"], category: "Song Structure" },
        // { label: "Quick Start", items: ["Add CDEFGAB"], category: "App Operations" }
      ]
    },
    {
      id: 'processing',
      title: "Melodic Transforms",
      subsections: [
        { label: "Post-Processing", items: ["Transpose +", "Transpose -", "Reverse", "Humanize"], category: "Melodic Transform" }
      ]
    }
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
    <div style={styles.container}>
      <div style={styles.rackHeader}>
        <div style={styles.title}>Control</div>
        <div style={styles.status}>Link Active</div>
      </div>
      
      <div style={styles.rackBody}>
        {/* Merged Global Controls */}
        <div style={styles.module}>
          <div style={styles.moduleLabel}>Session Master</div>
          <div style={styles.moduleContent}>
            <div style={styles.subSection}>
              <div style={styles.subLabel}>Base MIDI File</div>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} style={styles.fileInput} />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={styles.subLabel}>Scale</div>
                <div style={styles.buttonGroup}>
                  {['Major', 'Minor'].map(m => (
                    <button key={m} onClick={() => onSelect(m, 'Scale')} 
                      style={{...styles.chip, ...(activeValues.mode === m.toLowerCase() ? styles.activeChip : {})}}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.subLabel}>Time Sig</div>
                <div style={styles.buttonGroup}>
                  {['3/4', '4/4', '6/8'].map(ts => (
                    <button key={ts} onClick={() => onSelect(ts, 'Time Signature')} 
                      style={{...styles.chip, ...(activeValues.timeSig === ts ? styles.activeChip : {})}}>
                      {ts}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={styles.subLabel}>Temp: {temp}</div>
                <input type="range" min="0.1" max="2.0" step="0.1" value={temp} onChange={(e) => setTemp(parseFloat(e.target.value))} style={styles.range} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.subLabel}>BPM: {bpm}</div>
                <input type="range" min="40" max="240" step="1" value={bpm} onChange={(e) => setBpm(parseInt(e.target.value))} style={styles.range} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={styles.subLabel}>Length</div>
                <select value={length} onChange={(e) => setLength(parseInt(e.target.value))} style={styles.select}>
                  <option value="4">4 Bars</option>
                  <option value="8">8 Bars</option>
                  <option value="16">16 Bars</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button onClick={handleUpload} disabled={loading} style={loading ? styles.btnDisabled : styles.actionBtn}>Remix</button>
              <button onClick={handleGenerate} disabled={loading} style={loading ? styles.btnDisabled : {...styles.actionBtn, backgroundColor: '#6366f1', color: 'white'}}>AI Generate</button>
            </div>
            {loading && <div style={styles.progressBg}><div style={{...styles.progressFill, width: `${uploadProgress}%`}} /></div>}
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
          <div key={mod.id} style={styles.module}>
            <div style={styles.moduleLabel}>{mod.title}</div>
            <div style={styles.moduleContent}>
              {mod.subsections.map((sub) => (
                <div key={sub.label} style={styles.subSection}>
                  <div style={styles.subLabel}>{sub.label}</div>
                  <div style={styles.buttonGroup}>
                    {sub.items.map((item) => (
                      <button
                        key={item}
                        style={{
                          ...styles.chip,
                          ...(isItemActive(item, sub.label, sub.category) ? styles.activeChip : {})
                        }}
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

const styles = {
  container: {
    backgroundColor: '#0f172a',
    borderRadius: '24px',
    border: '1px solid #1e293b',
    overflow: 'hidden',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
  },
  rackHeader: {
    padding: '16px 24px',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: { fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '2px', color: '#64748b' },
  status: { fontSize: '9px', fontWeight: '800', color: '#10b981', textTransform: 'uppercase' },
  rackBody: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
  module: {
    padding: '16px',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.03)'
  },
  moduleLabel: { fontSize: '9px', fontWeight: '800', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '16px' },
  moduleContent: { display: 'flex', flexDirection: 'column', gap: '16px' },
  subSection: { display: 'flex', flexDirection: 'column', gap: '8px' },
  subLabel: { fontSize: '10px', fontWeight: '700', color: '#475569' },
  buttonGroup: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  chip: {
    padding: '6px 12px',
    backgroundColor: '#111418',
    borderRadius: '4px',
    color: '#bdc3c7',
    fontSize: '10px',
    fontWeight: '800',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    boxShadow: '0 2px 0 #111418',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  activeChip: {
    backgroundColor: '#6366f1',
    color: 'white',
    borderColor: '#111418',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4)',
    transform: 'translateY(1px)'
  },
  monitorGrid: { display: 'flex', flexDirection: 'column', gap: '12px' },
  monitorItem: { display: 'flex', flexDirection: 'column', gap: '4px' },
  miniCanvasScroll: { width: '100%', overflowX: 'auto', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '4px', height: '40px' },
  fileInput: { fontSize: '9px', color: '#64748b', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '4px', width: '100%' },
  range: { width: '100%', accentColor: '#6366f1', height: '4px', cursor: 'pointer' },
  select: { width: '100%', backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: '4px', fontSize: '10px', padding: '4px' },
  actionBtn: { flex: 1, padding: '10px', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', borderRadius: '4px', cursor: 'pointer', border: '1px solid #111418' },
  btnDisabled: { flex: 1, padding: '10px', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', borderRadius: '4px', opacity: 0.5, cursor: 'not-allowed', border: '1px solid #111418' },
  progressFill: { height: '100%', backgroundColor: '#6366f1', transition: 'width 0.3s ease' }
};

export default MusicFunctions;