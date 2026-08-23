from typing import List, Dict, Optional
from app.config import settings

class VectorStore:
    def __init__(self):
        self.pc = None
        self.index = None
        
        if settings.PINECONE_API_KEY:
            try:
                from pinecone import Pinecone
                self.pc = Pinecone(api_key=settings.PINECONE_API_KEY)
                self.index_name = settings.PINECONE_INDEX_NAME
                self._ensure_index()
                self.index = self.pc.Index(self.index_name)
            except Exception as e:
                print(f"Pinecone init failed: {e}")
    
    def _ensure_index(self):
        if self.index_name not in self.pc.list_indexes().names():
            from pinecone import ServerlessSpec
            self.pc.create_index(
                name=self.index_name,
                dimension=1536,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-west-2")
            )
    
    async def upsert(self, node_id: str, embedding: List[float], metadata: Dict):
        if not self.index:
            return
        
        self.index.upsert(vectors=[{
            "id": node_id,
            "values": embedding,
            "metadata": {
                "node_id": node_id,
                "path": metadata.get("path", []),
                "summary": metadata.get("summary", "")[:500],
                "created_at": metadata.get("created_at")
            }
        }])
    
    async def query(self, embedding: List[float], top_k: int = 5, filter: Optional[Dict] = None) -> List[Dict]:
        if not self.index:
            return []
        
        results = self.index.query(
            vector=embedding,
            top_k=top_k,
            include_metadata=True,
            filter=filter
        )
        
        return [{
            "node_id": match.id,
            "score": match.score,
            "metadata": match.metadata
        } for match in results.matches]
    
    async def delete(self, node_id: str):
        if self.index:
            self.index.delete(ids=[node_id])

vector_store = VectorStore()
