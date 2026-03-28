import { useState } from "react";
import * as mm from "@magenta/music";

export const useAIEngine = () => {
  const [loading, setLoading] = useState(false);
  const [sequence, setSequence] = useState(null);

  const handleResult = async (blob) => {
    const ns = await mm.blobToNoteSequence(blob);
    setSequence(ns);
  };

  return {
    loading,
    setLoading,
    sequence,
    setSequence,
    handleResult,
  };
};
