import { useEffect, useState } from "react";
import "./styles/layout.css";

import TransportBar from "./components/transport/TransportBar";
import SidebarControls from "./components/sidebar/SidebarControls";
import PianoEditor from "./components/editor/PianoEditor";

import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { useAIEngine } from "./hooks/useAIEngine";

const App = () => {
  const [bpm, setBpm] = useState(120);
  const [currentTime, setCurrentTime] = useState(0);

  const { init, play, stop, isPlaying } = useAudioPlayer();
  const { sequence, setSequence } = useAIEngine();

  useEffect(() => {
    init();
  }, []);

  return (
    <div className="app">
      <TransportBar
        isPlaying={isPlaying}
        onPlay={() => play(sequence)}
        onStop={stop}
        bpm={bpm}
        setBpm={setBpm}
      />

      <div className="main">
        <SidebarControls
          onGenerate={() => console.log("generate")}
          onUpload={() => console.log("upload")}
        />

        <div className="workspace">
          <PianoEditor
            sequence={sequence}
            bpm={bpm}
            currentTime={currentTime}
            onSeek={setCurrentTime}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
