from sqlalchemy import Column, String, Float, DateTime, JSON, ForeignKey, Text, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base

class UserModel(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    is_active = Column(Float, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    nodes = relationship("NodeModel", back_populates="owner")

class NodeModel(Base):
    __tablename__ = "nodes"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(500))
    content = Column(Text)
    path = Column(ARRAY(String))
    confidence = Column(Float)
    embedding_id = Column(String)
    entities = Column(JSON)
    summary = Column(Text)
    metadata = Column(JSON)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    session_id = Column(String, index=True)
    
    owner = relationship("UserModel", back_populates="nodes")
