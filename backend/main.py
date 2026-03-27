from fastapi import FastAPI, UploadFile, File, Query
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from contextlib import asynccontextmanager
import note_seq
from magenta.models.music_vae import configs
from magenta.models.music_vae import trained_model
import io
import os

# Using absolute path logic ensures uvicorn can find the checkpoint 
# regardless of the directory from which the script is launched.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHECKPOINT_PATH = os.path.join(BASE_DIR, 'checkpoints', 'cat-mel_2bar_small.tar')
model_config = configs.CONFIG_MAP['cat-mel_2bar_small']
model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    if os.path.exists(CHECKPOINT_PATH):
        try:
            model = trained_model.TrainedModel(
                model_config,
                batch_size=4,
                checkpoint_dir_or_path=CHECKPOINT_PATH
            )
        except Exception as e:
            print(f"Error loading model: {e}")
    else:
        print(f"Checkpoint not found at {CHECKPOINT_PATH}. Please download the .tar file.")
    yield

app = FastAPI(lifespan=lifespan)

# Enable CORS so the React frontend can communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/generate")
async def generate_midi(temperature: float = Query(1.0)):
    if model is None:
        return Response(content="Model not loaded.", status_code=503)
    
    generated_sequences = model.sample(n=1, length=32, temperature=temperature)
    
    output_midi_io = io.BytesIO()
    note_seq.sequence_proto_to_midi_file(generated_sequences[0], output_midi_io)
    return Response(content=output_midi_io.getvalue(), media_type="audio/midi")

@app.post("/api/remix")
async def remix_midi(file: UploadFile = File(...), temperature: float = Query(1.0)):
    midi_data = await file.read()
    
    if model is None:
        return Response(content="Model not loaded.", status_code=503)

    input_ns = note_seq.midi_to_note_sequence(midi_data)
    
    quantized_ns = note_seq.quantize_note_sequence(
        input_ns, 
        steps_per_quarter=model_config.data_converter.steps_per_quarter
    )

    _, _, z = model.encode([quantized_ns])
    reconstructed_sequences = model.decode(z, length=32, temperature=temperature)
    
    output_midi_io = io.BytesIO()
    note_seq.sequence_proto_to_midi_file(reconstructed_sequences[0], output_midi_io)
    return Response(content=output_midi_io.getvalue(), media_type="audio/midi")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)