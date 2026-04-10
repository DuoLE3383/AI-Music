import React from 'react';
import MusicFunctions from '../MusicGlossary'; // Giữ nguyên nếu MusicGlossary cũng ở trong /components

const Sidebar = ({
  onSelect,
  activeValues,
  sequence,
  temp, setTemp,
  bpm, setBpm,
  timeSig, setTimeSig,
  length, setLength,
  instrument, updateInstrument,
  setFile,
  handleUpload,
  handleGenerate,
  handleTrain,
  checkpoints,
  loading,
  uploadProgress
}) => {
  return (
    <aside className="sidebar">
      <MusicFunctions
        onSelect={onSelect}
        activeValues={activeValues}
        sequence={sequence}
        temp={temp} setTemp={setTemp}
        bpm={bpm} setBpm={setBpm}
        timeSig={timeSig} setTimeSig={setTimeSig}
        length={length} setLength={setLength}
        instrument={instrument} updateInstrument={updateInstrument}
        setFile={setFile}
        handleUpload={handleUpload}
        handleGenerate={handleGenerate}
        handleTrain={handleTrain}
        checkpoints={checkpoints}
        loading={loading}
        uploadProgress={uploadProgress}
      />
    </aside>
  );
};

export default Sidebar;