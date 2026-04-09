import React from 'react';

const EditorHeader = ({ 
  isPlaying, onPlay, onStop, 
  bpm, setBpm, 
  timeSig, handleDownload,
  instrument, updateInstrument,
  onTransform
}) => {
  return (
    <div className="editor-header">
      <div className="daw-tab">Editor / <span style={{color: '#64748b'}}>Pattern_01</span></div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="transport-group">
          <button
            onClick={isPlaying ? onStop : onPlay}
            className="play-btn"
            style={{
              backgroundColor: isPlaying ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)',
              color: isPlaying ? '#ef4444' : '#10b981',
              borderColor: isPlaying ? '#ef4444' : '#10b981',
              padding: '4px 12px',
              fontSize: '11px'
            }}
          >
            {isPlaying ? '■ STOP' : '▶ START'}
          </button>
        </div>

        <div className="transport-item">
          <span className="transport-label">BPM</span>
          <input 
            type="number" 
            className="transport-input" 
            value={bpm} 
            onChange={(e) => setBpm(parseInt(e.target.value))} 
            style={{ width: '50px' }}
          />
        </div>

        <div className="transport-item">
          <span className="transport-label">Voice</span>
          <select value={instrument} onChange={(e) => updateInstrument(e.target.value)} className="select-small">
            <option value="0">Grand Piano</option>
            <option value="24">Nylon Gtr</option>
            <option value="32">Ac. Bass</option>
            <option value="40">Violin</option>
            <option value="128">Drum Kit</option>
          </select>
        </div>

        <div className="transport-divider" style={{ width: '1px', height: '20px', background: '#334155' }} />

        <div className="transform-group" style={{ display: 'flex', gap: '4px' }}>
          <button className="btn-mini" onClick={() => onTransform('Transpose +', 'Melodic Transform')}>T+</button>
          <button className="btn-mini" onClick={() => onTransform('Transpose -', 'Melodic Transform')}>T-</button>
          <button className="btn-mini" onClick={() => onTransform('Reverse', 'Melodic Transform')}>REV</button>
          <button className="btn-mini" onClick={() => onTransform('Humanize', 'Melodic Transform')}>HUM</button>
          <button className="btn-mini" onClick={() => onTransform('Sprinkle', 'Melodic Transform')}>✨</button>
        </div>

        <button onClick={handleDownload} className="export-btn" style={{ fontSize: '10px' }}>
          MIDI
        </button>
      </div>
    </div>
  );
};

export default EditorHeader;