import uuid
from sqlalchemy import Column, Text, Integer, Float, Boolean, ForeignKey, String, JSON
from sqlalchemy import TIMESTAMP
from sqlalchemy.orm import relationship
from app.database import Base
from app.config import get_settings

_is_postgres = "postgresql" in get_settings().database_url

if _is_postgres:
    from sqlalchemy.dialects.postgresql import UUID as _UUID, JSONB
    _uuid_col  = lambda **kw: Column(_UUID(as_uuid=True), **kw)
    _fk_col    = lambda tbl, **kw: Column(_UUID(as_uuid=True), ForeignKey(tbl, **kw))
    _json_col  = lambda: Column(JSONB, nullable=True)
    _default_id = uuid.uuid4
else:
    _uuid_col  = lambda **kw: Column(String(36), **kw)
    _fk_col    = lambda tbl, **kw: Column(String(36), ForeignKey(tbl, **kw))
    _json_col  = lambda: Column(JSON, nullable=True)
    _default_id = lambda: str(uuid.uuid4())


class RepSession(Base):
    __tablename__ = "rep_sessions"

    id                  = _uuid_col(primary_key=True, default=_default_id)
    external_id         = Column(Text, nullable=False, index=True)
    exercise_type       = Column(Text, nullable=False)
    mode                = Column(Text, nullable=False, default="yolov8")
    started_at          = Column(TIMESTAMP(timezone=True), nullable=False)
    ended_at            = Column(TIMESTAMP(timezone=True), nullable=True)
    total_reps          = Column(Integer, nullable=False, default=0)
    total_sets          = Column(Integer, nullable=False, default=0)
    calories_burned     = Column(Float, nullable=True)
    avg_form_score      = Column(Float, nullable=True)
    notes               = Column(Text, nullable=True)
    synced_from_offline = Column(Boolean, default=False)
    created_at          = Column(TIMESTAMP(timezone=True), nullable=False)

    sets = relationship("RepSet", back_populates="session", cascade="all, delete-orphan")


class RepSet(Base):
    __tablename__ = "rep_sets"

    id             = _uuid_col(primary_key=True, default=_default_id)
    session_id     = _fk_col("rep_sessions.id", ondelete="CASCADE")
    set_number     = Column(Integer, nullable=False)
    reps           = Column(Integer, nullable=False)
    duration_sec   = Column(Float, nullable=True)
    form_score     = Column(Float, nullable=True)
    keypoints_json = _json_col()
    created_at     = Column(TIMESTAMP(timezone=True), nullable=False)

    session = relationship("RepSession", back_populates="sets")
