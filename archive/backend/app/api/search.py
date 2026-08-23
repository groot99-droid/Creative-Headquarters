from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.models import NodeModel
from app.database import get_db

router = APIRouter()

@router.get("/search")
async def search_nodes(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db)
):
    # Text search (would use vector search in production)
    result = await db.execute(
        select(NodeModel).where(
            or_(
                NodeModel.content.ilike(f"%{q}%"),
                NodeModel.summary.ilike(f"%{q}%"),
                NodeModel.title.ilike(f"%{q}%")
            )
        ).limit(20)
    )
    return result.scalars().all()
