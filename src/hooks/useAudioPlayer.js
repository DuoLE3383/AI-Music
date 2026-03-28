import { useRef, useState } from "react";
import * as mm from "@magenta/music";

export const useAudioPlayer = () => {
  const playerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const init = () => {
    playerRef.current = new mm.SoundFontPlayer(
      "https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus"
    );
  };

  const play = async (sequence, offset = 0) => {
    if (!playerRef.current) return;

    setIsPlaying(true);
    await playerRef.current.start(sequence, undefined, offset);
    setIsPlaying(false);
  };

  const stop = () => {
    playerRef.current?.stop();
    setIsPlaying(false);
  };

  return { init, play, stop, isPlaying };
};
