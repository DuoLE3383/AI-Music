import PianoRoll from "./PianoRoll";
import EditorHeader from "./EditorHeader";
import "./PianoEditor.css";

const PianoEditor = ({
  sequence,
  bpm,
  setBpm,
  currentTime,
  isPlaying,
  onPlay,
  onStop,
  onSeek,
  onAddNote,
  onRemoveNote,
  instrument,
  updateInstrument,
  timeSig,
  handleDownload,
  onTransform
}) => {
  if (!sequence) {
    return <div className="empty">No Data</div>;
  }

  return (
    <div className="editor">
      <EditorHeader
        isPlaying={isPlaying}
        onPlay={onPlay}
        onStop={onStop}
        bpm={bpm}
        setBpm={setBpm}
        instrument={instrument}
        updateInstrument={updateInstrument}
        timeSig={timeSig}
        handleDownload={handleDownload}
        onTransform={onTransform}
      />
      <PianoRoll
        sequence={{ ...sequence, tempos: [{ qpm: bpm }] }}
        currentTime={currentTime}
        onSeek={onSeek}
        onAddNote={onAddNote}
        onRemoveNote={onRemoveNote}
      />
    </div>
  );
};

export default PianoEditor;
