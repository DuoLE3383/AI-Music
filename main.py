from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import numpy as np
import pretty_midi
import io
from starlette.responses import Response

app = FastAPI()

# Enable CORS for React frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants and Mappings
STYLE_MAP = {
    "pop": 0.2,
    "rock": 0.5,
    "jazz": 0.8,
    "classical": -0.3,
    "hiphop": 0.1,
    "edm": 0.6
}

INSTRUMENT_MAP = {
    "piano": 0,
    "guitar": 24,
    "violin": 40,
    "bass": 32,
    "keyboard": 80,
    "drums": 128
}

STRUCTURE_MAP = {
    "intro": 8,
    "verse": 16,
    "chorus": 16,
    "bridge": 8,
    "outro": 8,
    "hook": 4
}

COMPLEXITY_MAP = {
    "stable": 0.5,
    "balanced": 1.0,
    "creative": 1.5,
    "chaotic": 2.0
}

class GenerateRequest(BaseModel):
    style: str = "pop"
    instrument: str = "piano"
    structure: str = "verse"
    complexity: str = "balanced"
    transpose: int = 0
    reverse: bool = False
    humanize: bool = False

def apply_transformations(pm: pretty_midi.PrettyMIDI, req: GenerateRequest):
    """Applies MIDI transformations based on user selection."""
    for instrument in pm.instruments:
        # 1. Transpose (per semitone)
        if req.transpose != 0:
            for note in instrument.notes:
                new_pitch = note.pitch + (req.transpose * 12) # Assuming octave shifts
                note.pitch = max(0, min(127, new_pitch))

        # 2. Humanize (randomize velocity and timing slightly)
        if req.humanize:
            for note in instrument.notes:
                note.velocity = max(1, min(127, int(note.velocity + np.random.uniform(-15, 15))))
                note.start += np.random.uniform(-0.02, 0.02)
                note.end += np.random.uniform(-0.02, 0.02)

    # 3. Reverse (mirror notes across the total time axis)
    if req.reverse:
        total_time = pm.get_end_time()
        for instrument in pm.instruments:
            for note in instrument.notes:
                old_start = note.start
                note.start = total_time - note.end
                note.end = total_time - old_start
            instrument.notes.sort(key=lambda x: x.start)
            
    return pm

@app.post("/api/generate")
async def generate_music(req: GenerateRequest):
    # 1. Setup Generation Parameters
    latent_dim = 64
    num_bars = STRUCTURE_MAP.get(req.structure, 16)
    temp = COMPLEXITY_MAP.get(req.complexity, 1.0)
    
    # 2. Simulate Latent Space Sampling (Placeholder for actual Model inference)
    # In a real app, you would load a MusicVAE or RNN model here
    z = np.random.normal(size=(1, latent_dim))
    z += STYLE_MAP.get(req.style, 0)
    
    # 3. Create MIDI Object
    pm = pretty_midi.PrettyMIDI(initial_tempo=120)
    program = INSTRUMENT_MAP.get(req.instrument, 0)
    inst = pretty_midi.Instrument(program=program, is_drum=(req.instrument == "drums"))
    
    # Mock melody generation (Replace with model.decode(z, length=num_bars))
    current_time = 0
    for _ in range(num_bars * 2): # 2 notes per bar
        pitch = int(60 + np.random.randint(-10, 10))
        duration = 0.5
        inst.notes.append(pretty_midi.Note(velocity=100, pitch=pitch, start=current_time, end=current_time + duration))
        current_time += duration
    
    pm.instruments.append(inst)

    # 4. Apply Melodic Transforms
    pm = apply_transformations(pm, req)

    # 5. Return as MIDI file
    midi_data = io.BytesIO()
    pm.write(midi_data)
    return Response(content=midi_data.getvalue(), media_type="audio/midi")

@app.post("/api/remix")
async def remix_music(
    file: UploadFile = File(...),
    temperature: float = Query(1.0),
    length: int = Query(8),
    instrument: int = Query(0),
    bpm: int = Query(120)
):
    try:
        content = await file.read()
        pm = pretty_midi.PrettyMIDI(io.BytesIO(content))
        
        # Apply simple remixing logic: Change instrument and tempo
        for inst in pm.instruments:
            if not inst.is_drum:
                inst.program = instrument
        
        midi_data = io.BytesIO()
        pm.write(midi_data)
        return Response(content=midi_data.getvalue(), media_type="audio/midi")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))