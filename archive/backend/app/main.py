from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine, Base
from app.api import ingest, nodes, search, auth
from app.services.graph_store import graph_store

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown
    await graph_store.close()

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(ingest.router, prefix=settings.API_V1_STR, tags=["ingest"])
app.include_router(nodes.router, prefix=settings.API_V1_STR, tags=["nodes"])
app.include_router(search.router, prefix=settings.API_V1_STR, tags=["search"])

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
