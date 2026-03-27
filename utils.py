import os

def ensure_directory(path: str):
    """Ensures that a directory exists, creating it if necessary."""
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)

def is_midi_file(filename: str) -> bool:
    """Checks if the file has a valid MIDI extension."""
    ext = os.path.splitext(filename)[1].lower()
    return ext in ('.mid', '.midi')