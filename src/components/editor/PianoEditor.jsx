import PianoRoll from "../../PianoRoll";
import "./PianoEditor.css";

const PianoEditor = ({
  sequence,
  bpm,
  currentTime,
  onSeek,
  onAddNote,
  onRemoveNote,
}) => {
  if (!sequence) {
    return <div className="empty">No Data</div>;
  }

  return (
    <div className="editor">
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
