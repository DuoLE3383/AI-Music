import "./TransportBar.css";

const TransportBar = ({ isPlaying, onPlay, onStop, bpm, setBpm }) => {
  return (
    <div className="transport">
      <button onClick={isPlaying ? onStop : onPlay}>
        {isPlaying ? "STOP" : "PLAY"}
      </button>

      <input
        type="number"
        value={bpm}
        onChange={(e) => setBpm(+e.target.value)}
      />
    </div>
  );
};

export default TransportBar;
