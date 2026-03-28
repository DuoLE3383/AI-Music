import io
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Query, HTTPException, Depends
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, Base, get_db
from models import MusicCheckpoint
from music_engine import MusicEngine, GenerateRequest

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    print("Backend initialized with PrettyMIDI")
    yield

app = FastAPI(lifespan=lifespan)

# Enable CORS for React frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/generate")
async def generate_music(req: GenerateRequest, db: Session = Depends(get_db)):
    midi_bytes = MusicEngine.generate(req, db)
    return Response(content=midi_bytes, media_type="audio/midi")

@app.get("/api/history")
async def get_history(db: Session = Depends(get_db)):
    """Fetch session history (musical checkpoints) from the database."""
    checkpoints = db.query(MusicCheckpoint).order_by(MusicCheckpoint.timestamp.desc()).all()
    return [
        {
            "id": c.id,
            "timestamp": c.timestamp.isoformat(),
            "style": c.style,
            "instrument": c.instrument,
            "structure": c.structure,
            "complexity": c.complexity,
            "bpm": c.bpm,
            "mode": c.mode,
            "transpose": c.transpose,
            "reverse": c.reverse,
            "humanize": c.humanize
        } for c in checkpoints
    ]

@app.get("/api/history/{checkpoint_id}")
async def get_historical_midi(checkpoint_id: int, db: Session = Depends(get_db)):
    """Download a MIDI file from a previous session checkpoint."""
    checkpoint = db.query(MusicCheckpoint).filter(MusicCheckpoint.id == checkpoint_id).first()
    if not checkpoint:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    return Response(content=checkpoint.midi_data, media_type="audio/midi")

@app.delete("/api/history/{checkpoint_id}")
async def delete_history_item(checkpoint_id: int, db: Session = Depends(get_db)):
    """Allows the 'Clear' or 'Delete' button in the UI to remove specific history items."""
    checkpoint = db.query(MusicCheckpoint).filter(MusicCheckpoint.id == checkpoint_id).first()
    if not checkpoint:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    db.delete(checkpoint)
    db.commit()
    return {"status": "deleted"}

@app.post("/api/remix")
async def remix_music(
    file: UploadFile = File(...),
    temperature: float = Query(1.0),
    length: int = Query(8),
    instrument: str = Query("piano"),
    bpm: int = Query(120),
    db: Session = Depends(get_db)
):
    try:
        content = await file.read()
        midi_bytes = MusicEngine.remix(content, instrument, bpm, db)
        return Response(content=midi_bytes, media_type="audio/midi")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)