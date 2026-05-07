import uuid
from sqlalchemy import Column, Text, Integer, Float, Boolean, SmallInteger, ForeignKey
from sqlalchemy import TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base


class Routine(Base):
    __tablename__ = "routines"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id  = Column(Text, nullable=False)
    name         = Column(Text, nullable=False)
    goal         = Column(Text, nullable=False)
    weeks        = Column(Integer, nullable=False, default=4)
    days_per_week= Column(Integer, nullable=False)
    rag_prompt   = Column(Text, nullable=True)
    rag_sources  = Column(JSONB, nullable=True)
    is_active    = Column(Boolean, default=True)
    created_at   = Column(TIMESTAMP(timezone=True), nullable=False)

    days = relationship("RoutineDay", back_populates="routine", cascade="all, delete-orphan")


class RoutineDay(Base):
    __tablename__ = "routine_days"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    routine_id = Column(UUID(as_uuid=True), ForeignKey("routines.id", ondelete="CASCADE"), nullable=False)
    day_index  = Column(SmallInteger, nullable=False)
    focus      = Column(Text, nullable=True)
    notes      = Column(Text, nullable=True)

    routine   = relationship("Routine", back_populates="days")
    exercises = relationship("RoutineExercise", back_populates="day", cascade="all, delete-orphan")


class RoutineExercise(Base):
    __tablename__ = "routine_exercises"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    day_id      = Column(UUID(as_uuid=True), ForeignKey("routine_days.id", ondelete="CASCADE"), nullable=False)
    name        = Column(Text, nullable=False)
    sets        = Column(Integer, nullable=True)
    reps        = Column(Text, nullable=True)
    rest_sec    = Column(Integer, nullable=True)
    met_value   = Column(Float, nullable=True)
    order_index = Column(SmallInteger, nullable=False, default=0)

    day = relationship("RoutineDay", back_populates="exercises")
