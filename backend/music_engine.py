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

# Harmonic triads based on scale degrees (0-indexed)
# e.g., Degree 0 (I) uses degrees 0, 2, 4 of the scale
CHORD_TEMPLATES = {
    "triad": [0, 2, 4],
    "seventh": [0, 2, 4, 6],
    "power": [0, 4]
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

# Rhythmic weights for Complexity: [Quarter, Eighth, Sixteenth]
RHYTHM_WEIGHTS = {
    "stable": [0.8, 0.2, 0.0],   # Mostly "Walk"
    "balanced": [0.4, 0.5, 0.1], # Mix of "Walk" and "Run-ning"
    "creative": [0.2, 0.5, 0.3], # Lots of "Run-ning" and "Tiri-tiri"
    "chaotic": [0.1, 0.3, 0.6]   # High speed "Tiri-tiri" patterns
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
        
        # Check if the pitch is already in the scale
        if (pitch % 12) in allowed_chromas:
            return pitch

        # Generate candidate pitches in the current, lower, and upper octaves
        # We consider a wider range to ensure finding the truly nearest pitch
        # e.g., if pitch is 60 (C4), and scale is D major, closest might be B3 (59) or D4 (62)
        # So, we need to check at least +/- 1 octave from the current pitch's octave.
        
        # Determine the base octave for the current pitch
        current_octave_midi_base = (pitch // 12) * 12

        candidate_pitches = []
        # Check pitches in the octave below, current octave, and octave above
        for octave_offset in [-12, 0, 12]:
            for chroma_val in allowed_chromas:
                candidate_pitch = current_octave_midi_base + octave_offset + chroma_val
                if 0 <= candidate_pitch <= 127: # Ensure within MIDI range
                    candidate_pitches.append(candidate_pitch)
        
        if not candidate_pitches:
            # This case should ideally not be reached if allowed_chromas is not empty
            # and MIDI range is valid. Return original pitch as a fallback.
            return pitch 

        # Find the closest pitch from the candidates.
        # If multiple pitches are equidistant, choose the higher one.
        nearest_pitch = min(candidate_pitches, key=lambda p: (abs(p - pitch), -p))
        
        return nearest_pitch

    @staticmethod
    def apply_transformations(pm: pretty_midi.PrettyMIDI, req: GenerateRequest):
        for instrument in pm.instruments:
            if instrument.is_drum: continue # Do not transpose or scale-force drums

            # Apply transposition first, then force to scale
            if req.transpose != 0:
                for note in instrument.notes:
                    new_pitch = note.pitch + req.transpose
                    note.pitch = MusicEngine.force_to_scale(max(0, min(127, new_pitch)), req.mode, req.root)

            # Ensure all notes are within the specified scale (handles non-transposed notes too)
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
        
        # Voice 1: Melody
        program = req.instrument_id if req.instrument_id > 0 else INSTRUMENT_MAP.get(req.instrument, 0)
        is_drum = req.instrument == "drums" or program >= 128
        inst = pretty_midi.Instrument(program=0 if is_drum else min(program, 127), is_drum=is_drum)
        
        # Voice 3: Bass Line
        bass_program = 32 if not is_drum else 0
        bass_inst = pretty_midi.Instrument(program=bass_program, is_drum=is_drum)

        logic = SCALE_LOGIC.get(req.mode, SCALE_LOGIC["major"])
        scale_intervals = logic["intervals"]
        root_offset = ROOT_MAP.get(req.root, 0)
        
        # 16th note duration
        sixteenth = 60.0 / max(40, req.bpm) / 4.0
        
        # Define a functional progression: I - vi - IV - V (Classic Pop)
        progression_degrees = [0, 5, 3, 4] 
        current_time = 0
        
        # Get rhythmic weights based on complexity
        r_weights = RHYTHM_WEIGHTS.get(req.complexity, RHYTHM_WEIGHTS["balanced"])

        for bar in range(num_bars):
            # Determine the chord for this bar based on progression
            chord_root_degree = progression_degrees[bar % len(progression_degrees)]
            
            # Duration for one bar (assuming 4/4)
            bar_duration = sixteenth * 16
            
            if not is_drum:
                # BASS (The Pulse): Establish the "1 - 2 - 3 - 4" heartbeat
                bass_pitch = 36 + root_offset + scale_intervals[chord_root_degree]
                for beat in range(4):
                    b_start = current_time + (beat * sixteenth * 4)
                    b_end = b_start + (sixteenth * 3.8) # Slight gap for definition
                    bass_inst.notes.append(pretty_midi.Note(velocity=90, pitch=bass_pitch, start=b_start, end=b_end))

            # 3. MELODY (The Pattern): "Walk and Run" logic
            # Instead of fixed 8th notes, we fill the 16 slots of the bar dynamically
            filled_sixteenths = 0
            while filled_sixteenths < 16:
                # Pick a rhythm: 4 (Quarter), 2 (Eighth), or 1 (Sixteenth)
                possible_durs = [4, 2, 1]
                # Filter out durations that would exceed the bar length
                valid_durs = [d for d in possible_durs if (filled_sixteenths + d) <= 16]
                if not valid_durs: break
                
                # Randomly select duration based on weights (adjusted for valid options)
                duration_choice = np.random.choice(valid_durs, p=[r_weights[possible_durs.index(d)] for d in valid_durs] / np.sum([r_weights[possible_durs.index(d)] for d in valid_durs]))
                
                note_start = current_time + (filled_sixteenths * sixteenth)
                note_dur = duration_choice * sixteenth
                
                # Play logic: Quarter notes are almost always played, 16ths are flourishes
                play_prob = 0.9 if duration_choice == 4 else 0.7
                if np.random.random() < play_prob:
                    # Resolve to chord tones on main beats (Pulse)
                    if filled_sixteenths % 4 == 0:
                        degree = (chord_root_degree + np.random.choice(CHORD_TEMPLATES["triad"])) % len(scale_intervals)
                    else:
                        degree = np.random.randint(0, len(scale_intervals))
                    
                    m_pitch = 72 + root_offset + scale_intervals[degree]
                    inst.notes.append(pretty_midi.Note(velocity=100, pitch=m_pitch, start=note_start, end=note_start + note_dur))
                
                filled_sixteenths += duration_choice
            
            current_time += bar_duration
        
        pm.instruments.append(inst)
        if not is_drum:
            pm.instruments.append(bass_inst)
            
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