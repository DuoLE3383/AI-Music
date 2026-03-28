import io
import numpy as np
import pretty_midi
from pydantic import BaseModel
from sqlalchemy.orm import Session
from models import MusicCheckpoint

# Constants and Mappings
STYLE_MAP = {
    "pop": 0.2, "rock": 0.5, "jazz": 0.8, 
    "classical": -0.3, "hiphop": 0.1, "edm": 0.6,
    "hit song": 0.4, 
    "live performance": 0.1, 
    "top chart": 0.5, 
    "release": 0.2, 
    "cover": -0.1
}

SCALE_LOGIC = {
    "major": {"intervals": [0, 2, 4, 5, 7, 9, 11]},
    "minor": {"intervals": [0, 2, 3, 5, 7, 8, 10]}
}

INSTRUMENT_MAP = {
    "piano": 0, "guitar": 24, "violin": 40,
    "bass": 32, "keyboard": 80, "drums": 128,
    "singer": 52, 
    "vocalist": 53, 
    "composer": 0, 
    "songwriter": 24, 
    "producer": 80, 
    "conductor": 48, 
    "band": 30, 
    "orchestra": 48
}

ROOT_MAP = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11
}

STRUCTURE_MAP = {
    "intro": 8, "verse": 16, "chorus": 16,
    "bridge": 8, "outro": 8, "hook": 4
}

COMPLEXITY_MAP = {
    "stable": 0.5, 
    "balanced": 1.0, 
    "creative": 1.5, 
    "chaotic": 2.0,
    "melody": 1.2,
    "harmony": 0.8
}

class GenerateRequest(BaseModel):
    style: str = "pop"
    instrument: str = "piano"
    instrument_id: int = 0
    structure: str = "verse"
    complexity: str = "balanced"
    transpose: int = 0
    reverse: bool = False
    humanize: bool = False
    temperature: float = 1.0
    length: int = 8
    bpm: int = 120
    mode: str = "major"
    root: str = "C"
    time_signature: str = "4/4"

class MusicEngine:
    @staticmethod
    def force_to_scale(pitch: int, mode: str, root: str = "C") -> int:
        logic = SCALE_LOGIC.get(mode, SCALE_LOGIC["major"])
        root_offset = ROOT_MAP.get(root, 0)
        allowed_chromas = [(root_offset + i) % 12 for i in logic["intervals"]]
        
        chroma = pitch % 12
        if chroma in allowed_chromas:
            return pitch
        nearest_chroma = min(allowed_chromas, key=lambda x: abs(x - chroma))
        return (pitch // 12) * 12 + nearest_chroma

    @staticmethod
    def apply_transformations(pm: pretty_midi.PrettyMIDI, req: GenerateRequest):
        for instrument in pm.instruments:
            if instrument.is_drum: continue # FIX: Do not transpose or scale-force drums

            if req.transpose != 0:
                for note in instrument.notes:
                    # Changed from *12 (octave) to semitones for reasonable behavior
                    new_pitch = note.pitch + req.transpose
                    note.pitch = MusicEngine.force_to_scale(max(0, min(127, new_pitch)), req.mode, req.root)

            for note in instrument.notes:
                note.pitch = MusicEngine.force_to_scale(note.pitch, req.mode, req.root)

            if req.humanize:
                for note in instrument.notes:
                    note.velocity = max(1, min(127, int(note.velocity + np.random.uniform(-15, 15))))
                    note.start += np.random.uniform(-0.02, 0.02)
                    note.end += np.random.uniform(-0.02, 0.02)

        if req.reverse:
            total_time = pm.get_end_time()
            for instrument in pm.instruments:
                for note in instrument.notes:
                    old_start = note.start
                    note.start = total_time - note.end
                    note.end = total_time - old_start
                instrument.notes.sort(key=lambda x: x.start)
        return pm

    @staticmethod
    def generate(req: GenerateRequest, db: Session):
        # Reasonable Logic: If structure is 'custom', use the length slider. 
        # Otherwise, use the preset bars from the structure map.
        if req.structure == "custom":
            num_bars = req.length
        else:
            num_bars = STRUCTURE_MAP.get(req.structure, req.length)
            
        pm = pretty_midi.PrettyMIDI(initial_tempo=req.bpm)
        
        program = req.instrument_id if req.instrument_id > 0 else INSTRUMENT_MAP.get(req.instrument, 0)
        is_drum = req.instrument == "drums" or program >= 128
        # Standard MIDI: Drums use program 0 on Channel 10, PrettyMIDI handles this via is_drum
        inst = pretty_midi.Instrument(program=0 if is_drum else min(program, 127), is_drum=is_drum)
        
        logic = SCALE_LOGIC.get(req.mode, SCALE_LOGIC["major"])
        scale_intervals = logic["intervals"]
        root_offset = ROOT_MAP.get(req.root, 0)
        note_duration = (60.0 / max(40, req.bpm)) * 2.0

        current_time = 0
        for _ in range(num_bars * 2):
            degree = np.random.randint(0, len(scale_intervals))
            octave_offset = np.random.randint(0, 2) * 12
            pitch = 48 + root_offset + octave_offset + scale_intervals[degree]
            
            inst.notes.append(pretty_midi.Note(velocity=100, pitch=pitch, start=current_time, end=current_time + note_duration))
            current_time += note_duration
        
        pm.instruments.append(inst)
        pm = MusicEngine.apply_transformations(pm, req)

        midi_data = io.BytesIO()
        pm.write(midi_data)
        midi_bytes = midi_data.getvalue()

        MusicEngine.save_to_history(db, req, midi_bytes)
        return midi_bytes

    @staticmethod
    def remix(content: bytes, instrument: str, bpm: int, db: Session):
        pm = pretty_midi.PrettyMIDI(io.BytesIO(content))
        
        # Resolve the instrument name to a MIDI program ID
        program = INSTRUMENT_MAP.get(instrument.lower(), 0)
        is_drum = instrument.lower() == "drums" or program >= 128

        for inst in pm.instruments:
            if not inst.is_drum and not is_drum:
                inst.program = min(program, 127)
            inst.is_drum = is_drum
        
        midi_data = io.BytesIO()
        pm.write(midi_data)
        midi_bytes = midi_data.getvalue()

        # Fix: Save the correct instrument name in history
        req = GenerateRequest(style="remix", instrument=instrument, bpm=bpm)
        MusicEngine.save_to_history(db, req, midi_bytes)
        return midi_bytes

    @staticmethod
    def save_to_history(db: Session, req: GenerateRequest, midi_data: bytes):
        checkpoint = MusicCheckpoint(
            style=req.style,
            instrument=req.instrument,
            structure=req.structure,
            complexity=req.complexity,
            bpm=req.bpm,
            mode=req.mode,
            transpose=req.transpose,
            reverse=req.reverse,
            humanize=req.humanize,
            midi_data=midi_data
        )
        db.add(checkpoint)
        db.commit()