import uuid
from sqlalchemy import Column, Text, Float, Boolean, Date, SmallInteger, ForeignKey
from sqlalchemy import TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base


class DietPlan(Base):
    __tablename__ = "diet_plans"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id     = Column(Text, nullable=False)
    week_start      = Column(Date, nullable=False)
    goal            = Column(Text, nullable=False)
    calorie_target  = Column(Float, nullable=False)
    protein_g       = Column(Float, nullable=True)
    carbs_g         = Column(Float, nullable=True)
    fat_g           = Column(Float, nullable=True)
    rag_prompt      = Column(Text, nullable=True)
    rag_sources     = Column(JSONB, nullable=True)
    manual_override = Column(Boolean, default=False)
    pdf_url         = Column(Text, nullable=True)
    created_at      = Column(TIMESTAMP(timezone=True), nullable=False)

    days = relationship("DietDay", back_populates="plan", cascade="all, delete-orphan")


class DietDay(Base):
    __tablename__ = "diet_days"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id        = Column(UUID(as_uuid=True), ForeignKey("diet_plans.id", ondelete="CASCADE"), nullable=False)
    day_of_week    = Column(SmallInteger, nullable=False)
    total_calories = Column(Float, nullable=True)
    notes          = Column(Text, nullable=True)

    plan  = relationship("DietPlan", back_populates="days")
    meals = relationship("DietMeal", back_populates="day", cascade="all, delete-orphan")


class DietMeal(Base):
    __tablename__ = "diet_meals"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    day_id          = Column(UUID(as_uuid=True), ForeignKey("diet_days.id", ondelete="CASCADE"), nullable=False)
    meal_type       = Column(Text, nullable=False)
    name            = Column(Text, nullable=False)
    quantity_g      = Column(Float, nullable=True)
    calories        = Column(Float, nullable=False)
    protein_g       = Column(Float, default=0)
    carbs_g         = Column(Float, default=0)
    fat_g           = Column(Float, default=0)
    manual_override = Column(Boolean, default=False)

    day = relationship("DietDay", back_populates="meals")
