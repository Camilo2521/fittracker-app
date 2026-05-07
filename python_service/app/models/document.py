import uuid
from sqlalchemy import Column, Text, Integer, String, JSON
from sqlalchemy import TIMESTAMP
from app.database import Base
from app.config import get_settings

_is_postgres = "postgresql" in get_settings().database_url

# Types compatibles con SQLite y PostgreSQL
if _is_postgres:
    from sqlalchemy.dialects.postgresql import UUID as _UUID, JSONB
    try:
        from pgvector.sqlalchemy import Vector
        _vector_col = lambda: Column(Vector(384), nullable=True)
    except ImportError:
        _vector_col = lambda: Column(Text, nullable=True)
    _uuid_col  = lambda **kw: Column(_UUID(as_uuid=True), **kw)
    _json_col  = lambda: Column(JSONB, nullable=True)
else:
    # SQLite: usar String/Text/JSON
    _uuid_col  = lambda **kw: Column(String(36), **kw)
    _json_col  = lambda: Column(JSON, nullable=True)
    _vector_col = lambda: Column(Text, nullable=True)   # embeddings como texto


class Document(Base):
    __tablename__ = "documents"

    id          = _uuid_col(primary_key=True, default=lambda: str(uuid.uuid4()))
    source      = Column(Text, nullable=False)
    title       = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False, default=0)
    content     = Column(Text, nullable=False)
    embedding   = _vector_col()
    token_count = Column(Integer, nullable=True)
    ingested_at = Column(TIMESTAMP(timezone=True), nullable=False)


class RagQuery(Base):
    __tablename__ = "rag_queries"

    id          = _uuid_col(primary_key=True, default=lambda: str(uuid.uuid4()))
    external_id = Column(Text, nullable=False)
    query_type  = Column(Text, nullable=False)
    prompt      = Column(Text, nullable=False)
    response    = Column(Text, nullable=False)
    sources_used = _json_col()
    tokens_in   = Column(Integer, nullable=True)
    tokens_out  = Column(Integer, nullable=True)
    latency_ms  = Column(Integer, nullable=True)
    created_at  = Column(TIMESTAMP(timezone=True), nullable=False)
