from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.models import NodeModel
from app.database import get_db
from app.api.auth import get_current_user

router = APIRouter()

@router.get("/nodes")
async def list_nodes(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user)
):
    result = await db.execute(select(NodeModel).order_by(NodeModel.created_at.desc()))
    nodes = result.scalars().all()
    return [{
        "id": n.id,
        "title": n.title,
        "content": n.content,
        "path": n.path,
        "confidence": n.confidence,
        "summary": n.summary,
        "created_at": n.created_at.isoformat()
    } for n in nodes]

@router.get("/nodes/{node_id}")
async def get_node(node_id: str, db: AsyncSession = Depends(get_db)):
    node = await db.get(NodeModel, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node
