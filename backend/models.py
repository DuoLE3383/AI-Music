import datetime
from sqlalchemy import Column, Integer, String, Boolean, LargeBinary, DateTime
from database import Base

class MusicCheckpoint(Base):
    __tablename__ = "checkpoints"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    style = Column(String)
    instrument = Column(String)
    structure = Column(String)
    complexity = Column(String)
    bpm = Column(Integer)
    mode = Column(String)
    transpose = Column(Integer)
    reverse = Column(Boolean)
    humanize = Column(Boolean)
    midi_data = Column(LargeBinary)