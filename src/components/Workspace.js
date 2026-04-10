import React from 'react';
import PianoEditor from './editor/PianoEditor';

const Workspace = ({ remixSequence, ...editorProps }) => {
  return (
    <main className="workspace">
      {remixSequence ? (
        <div className="editor-card">
          <PianoEditor
            sequence={remixSequence}
            {...editorProps}
          />
        </div>
      ) : (
        <div className="empty-canvas-container">
          <div className="empty-canvas-icon"></div>
          <h2 className="empty-canvas-title">Empty Canvas</h2>
          <p className="empty-canvas-text">
            Select a style from the sidebar or upload a MIDI file to begin your creative session.
          </p>
        </div>
      )}
    </main>
  );
};

export default Workspace;