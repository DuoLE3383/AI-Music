from fastapi import FastAPI, UploadFile, File, Query
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import note_seq
from magenta.models.music_vae import configs
from magenta.models.music_vae import trained_model
import io
import os

app = FastAPI()

# 1. Initialize the Model
# 'cat-mel_2bar_small' is a common config for 2-bar melodies.
# You will need to download the .tar checkpoint and provide the path here.
# Download from: https://goo.gl/magenta/js-checkpoints-json
CHECKPOINT_PATH = './checkpoints/cat-mel_2bar_small.tar'
model_config = configs.CONFIG_MAP['cat-mel_2bar_small']
model = None # Initialized on startup

# Enable CORS so the React frontend can communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def load_model():
    global model
    if os.path.exists(CHECKPOINT_PATH):
        model = trained_model.TrainedModel(
            model_config, 
            batch_size=4, 
            checkpoint_dir_or_path=CHECKPOINT_PATH
        )

@app.post("/api/remix")
async def remix_midi(file: UploadFile = File(...), temperature: float = Query(1.0)):
    midi_data = await file.read()
    
    if model is None:
        return Response(content="Model not loaded. Checkpoint missing?", status_code=500)

    # 1. Convert MIDI to NoteSequence
    input_ns = note_seq.midi_to_note_sequence(midi_data)
    
    # 2. Quantize the sequence (MusicVAE requirement)
    quantized_ns = note_seq.quantize_note_sequence(
        input_ns, 
        steps_per_quarter=model_config.data_converter.steps_per_quarter
    )

    # 3. Encode and Decode (The "Remix")
    # We encode the input to latent space and decode it with temperature
    _, _, z = model.encode([quantized_ns])
    # length is set to 32 steps (2 bars at 16th notes)
    reconstructed_sequences = model.decode(z, length=32, temperature=temperature)
    
    # 4. Convert back to MIDI bytes
    output_midi_io = io.BytesIO()
    note_seq.sequence_proto_to_midi_file(
        reconstructed_sequences[0], 
        output_midi_io
    )
    
    return Response(content=output_midi_io.getvalue(), media_type="audio/midi")

if __name__ == "__main__":
    # This allows you to run the backend with 'python main.py'
    uvicorn.run(app, host="0.0.0.0", port=8000)