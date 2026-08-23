from neo4j import AsyncGraphDatabase
from app.config import settings
from typing import List, Dict

class GraphStore:
    def __init__(self):
        self.driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
        )
    
    async def close(self):
        await self.driver.close()
    
    async def create_node(self, node_id: str, path: List[str], metadata: Dict):
        async with self.driver.session() as session:
            for i, segment in enumerate(path):
                level = i
                parent = path[i-1] if i > 0 else "Root"
                
                await session.run("""
                    MERGE (p:Concept {name: $parent, level: $parent_level})
                    MERGE (c:Concept {
                        name: $name, 
                        level: $level,
                        node_id: $node_id,
                        created_at: datetime()
                    })
                    MERGE (p)-[:PARENT_OF {weight: 1.0}]->(c)
                """, {
                    "parent": parent,
                    "parent_level": i-1,
                    "name": segment,
                    "level": level,
                    "node_id": node_id if i == len(path)-1 else f"{node_id}_{i}"
                })
            
            for link in metadata.get("suggested_links", []):
                await session.run("""
                    MATCH (a:Concept {node_id: $node_id})
                    MATCH (b:Concept {name: $target})
                    MERGE (a)-[:RELATES_TO {
                        type: 'suggested',
                        weight: 0.5,
                        created_at: datetime()
                    }]->(b)
                """, {"node_id": node_id, "target": link})

graph_store = GraphStore()
