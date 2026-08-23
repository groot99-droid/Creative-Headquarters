from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime
from enum import Enum

class IngestionSource(str, Enum):
    MANUAL = "manual_input"
    API = "api"
    IMPORT = "import"

class ContentPayload(BaseModel):
    raw_text: str = Field(..., min_length=1, max_length=50000)
    timestamp: datetime
    source: IngestionSource = IngestionSource.MANUAL
    metadata: Dict[str, Any] = Field(default_factory=dict)

class UserPreferences(BaseModel):
    auto_link: bool = True
    language: str = "en"
    confidence_threshold: float = 0.6

class ContextPayload(BaseModel):
    session_id: str
    user_id: Optional[str] = None
    user_preferences: UserPreferences = Field(default_factory=UserPreferences)

class IngestRequest(BaseModel):
    type: Literal["knowledge_ingestion"] = "knowledge_ingestion"
    content: ContentPayload
    context: ContextPayload

class ClassificationResult(BaseModel):
    path: List[str]
    confidence: float = Field(..., ge=0.0, le=1.0)
    suggested_links: List[str] = Field(default_factory=list)
    alternative_paths: List[List[str]] = Field(default_factory=list)

class ExtractedEntity(BaseModel):
    text: str
    label: str
    start: int
    end: int

class NodeData(BaseModel):
    node_id: str
    classification: ClassificationResult
    extracted_entities: List[ExtractedEntity]
    embedding_vector: List[float]
    summary: str
    key_phrases: List[str]

class EngineMetadata(BaseModel):
    processing_time_ms: float
    model_version: str
    store_size: int
    vector_search_hits: int = 0

class IngestResponse(BaseModel):
    ok: bool
    data: Optional[NodeData] = None
    meta: EngineMetadata
    error: Optional[str] = None

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None

class User(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
