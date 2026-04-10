import React from 'react';
import './TransportBar.css';

const TransportBar = ({ isPlaying, togglePlay, bpm, setBpm, timeSig, handleDownload }) => {
  return (
    <div className="transport-bar">
      <div className="transport-group">
        <button
          onClick={togglePlay}
          className="play-btn"
          style={{
            backgroundColor: isPlaying ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)',
            color: isPlaying ? '#ef4444' : '#10b981',
            borderColor: isPlaying ? '#ef4444' : '#10b981',
          }}
        >
          {isPlaying ? '■ STOP' : '▶ START'}
        </button>
      </div>

      <div className="transport-divider" />

      <div className="transport-group">
        <div className="transport-item">
          <span className="transport-label">Tempo</span>
          <input
            type="number" 
            className="transport-input" 
            value={bpm} 
            onChange={(e) => setBpm(parseInt(e.target.value))} 
          />
        </div>
        <div className="transport-item">
          <span className="transport-label">SIG</span>
          <span className="transport-value">{timeSig}</span>
        </div>
      </div>

      <div className="transport-divider" />

      <div className="transport-group">
        <button onClick={handleDownload} className="export-btn">
          EXPORT MIDI
        </button>
      </div>
    </div>
  );
};

export default TransportBar;