from openai import OpenAI
import json
import re
import asyncio
from typing import List, Dict, Any

from app.config import settings

client = OpenAI(
    api_key=settings.GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)

SYSTEM_PROMPT = """You are the Living Archive Engine's classification core.
Analyze input and return STRICT JSON:

{
    "classification": {
        "path": ["Root", "Branch", "SubBranch", "Leaf"],
        "confidence": 0.95,
        "suggested_links": ["related_concept_1", "related_concept_2"],
        "alternative_paths": [["Other", "Path"]]
    },
    "entities": [
        {"text": "Entity Name", "label": "CONCEPT", "start": 0, "end": 11}
    ],
    "summary": "One sentence summary",
    "key_phrases": ["phrase 1", "phrase 2"]
}

Rules:
- Path depth: 2-4 levels
- Confidence: 0.0-1.0 based on clarity of categorization
- Labels: CONCEPT, PERSON, ORG, TECH, THEORY, FIELD
- Be concise, accurate, and deterministic"""

class AIEngine:
    def __init__(self):
        self.model = "llama-3.3-70b-versatile"
        self.fallback_model = "llama3-8b-8192"
    
    async def classify(self, text: str) -> Dict[str, Any]:
        try:
            return await self._call_groq(text, self.model)
        except Exception as e:
            print(f"Primary model failed: {e}, trying fallback")
            return await self._call_groq(text, self.fallback_model)
    
    async def _call_groq(self, text: str, model: str) -> Dict[str, Any]:
        response = client.responses.create(
            model=model,
            input=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text[:4000]}
            ],
            temperature=0.1,
            max_tokens=1000
        )
        
        content = response.output_text
        content = re.sub(r'```json\s*', '', content)
        content = re.sub(r'```\s*', '', content)
        
        parsed = json.loads(content.strip())
        
        return {
            "classification": {
                "path": parsed["classification"]["path"],
                "confidence": float(parsed["classification"]["confidence"]),
                "suggested_links": parsed["classification"].get("suggested_links", []),
                "alternative_paths": parsed["classification"].get("alternative_paths", [])
            },
            "entities": parsed.get("entities", []),
            "summary": parsed.get("summary", text[:100] + "..."),
            "key_phrases": parsed.get("key_phrases", [])
        }
    
    async def generate_embedding(self, text: str) -> List[float]:
        try:
            if settings.OPENAI_API_KEY:
                from openai import OpenAI as OpenAIBase
                openai_client = OpenAIBase(api_key=settings.OPENAI_API_KEY)
                response = openai_client.embeddings.create(
                    input=text[:8000],
                    model="text-embedding-3-small"
                )
                return response.data[0].embedding
        except Exception as e:
            print(f"OpenAI embedding failed: {e}, using fallback")
        
        # Fallback: deterministic pseudo-embedding
        import hashlib
        hash_val = int(hashlib.md5(text.encode()).hexdigest(), 16)
        return [(hash_val % 1000) / 1000.0 for _ in range(1536)]

ai_engine = AIEngine()
