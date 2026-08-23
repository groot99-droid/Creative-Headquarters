from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from typing import Optional
import time
import asyncio

from app.schemas import IngestRequest, IngestResponse, NodeData, ClassificationResult, EngineMetadata, ExtractedEntity
from app.services.ai_engine import ai_engine
from app.services.vector_store import vector_store
from app.services.graph_store import graph_store
from app.models import NodeModel
from app.database import get_db
from app.api.auth import get_current_user

router = APIRouter()

async def _store_vector(node_id: str, embedding: list, metadata: dict):
    if vector_store:
        await vector_store.upsert(node_id, embedding, metadata)

async def _store_graph(node_id: str, path: list, metadata: dict):
    await graph_store.create_node(node_id, path, metadata)

async def _get_store_count(db: AsyncSession) -> int:
    result = await db.execute(select(func.count(NodeModel.id)))
    return result.scalar()

@router.post("/ingest", response_model=IngestResponse)
async def ingest_knowledge(
    request: IngestRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user)
):
    start_time = time.time()
    
    try:
        # Parallel: embedding + classification
        embedding_task = ai_engine.generate_embedding(request.content.raw_text)
        classification_task = ai_engine.classify(request.content.raw_text)
        
        embedding, classification = await asyncio.gather(embedding_task, classification_task)
        
        # Vector search
        similar = []
        if vector_store and vector_store.index:
            similar = await vector_store.query(embedding, top_k=5)
        
        # Merge suggestions
        suggested_from_vectors = [s["metadata"].get("path", [""])[-1] for s in similar if s["score"] > 0.8]
        all_suggestions = list(set(
            classification["classification"]["suggested_links"] + suggested_from_vectors
        ))[:5]
        
        # Create node
        node = NodeModel(
            title=request.content.raw_text[:200],
            content=request.content.raw_text,
            path=classification["classification"]["path"],
            confidence=classification["classification"]["confidence"],
            entities=classification["entities"],
            summary=classification["summary"],
            session_id=request.context.session_id,
            user_id=current_user["id"] if current_user else None,
            metadata={"key_phrases": classification["key_phrases"], "source": request.content.source}
        )
        
        db.add(node)
        await db.commit()
        await db.refresh(node)
        
        # Background tasks
        background_tasks.add_task(_store_vector, node.id, embedding, {
            "path": node.path, "summary": node.summary, "user_id": node.user_id
        })
        background_tasks.add_task(_store_graph, node.id, node.path, {"suggested_links": all_suggestions})
        
        processing_time = (time.time() - start_time) * 1000
        
        return IngestResponse(
            ok=True,
            data=NodeData(
                node_id=node.id,
                classification=ClassificationResult(
                    path=classification["classification"]["path"],
                    confidence=classification["classification"]["confidence"],
                    suggested_links=all_suggestions,
                    alternative_paths=classification["classification"].get("alternative_paths", [])
                ),
                extracted_entities=[ExtractedEntity(**e) for e in classification["entities"]],
                embedding_vector=embedding,
                summary=classification["summary"],
                key_phrases=classification["key_phrases"]
            ),
            meta=EngineMetadata(
                processing_time_ms=round(processing_time, 2),
                model_version="groq-llama-3.3-70b",
                store_size=await _get_store_count(db),
                vector_search_hits=len(similar)
            )
        )
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
