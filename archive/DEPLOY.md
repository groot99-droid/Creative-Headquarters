# Living Archive Engine - Deployment Guide

## Quick Deploy (Your Machine)

### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB+ RAM available

### Step 1: Extract and Navigate
```bash
cd living-archive
```

### Step 2: Verify Environment
Set your Groq API key in `.env` (never commit the real value):
```
GROQ_API_KEY=gsk_REPLACE_WITH_YOUR_OWN_KEY
```

### Step 3: Launch
```bash
chmod +x setup.sh
./setup.sh
```

Or manually:
```bash
docker-compose up --build
```

### Step 4: Access
Wait 30-60 seconds for all services to start, then:

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | - |
| API Docs | http://localhost:8000/docs | - |
| Backend Health | http://localhost:8000/health | - |
| Neo4j Browser | http://localhost:7474 | neo4j/password |

## Cloud Deployment Options

### Option 1: Render.com
1. Create a Blueprint from `render.yaml` (included)
2. Add environment variables from `.env`
3. Deploy

### Option 2: AWS ECS
Use the included `ecs-task-definition.json` with Fargate.

### Option 3: Digital Ocean App Platform
1. Connect your repo
2. Use `docker-compose.yml` as the spec
3. Add env vars

## Verification Steps

After startup, verify all services:

```bash
# Check all containers are running
docker-compose ps

# Check backend health
curl http://localhost:8000/health

# Check logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Test AI classification
curl -X POST http://localhost:8000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "type": "knowledge_ingestion",
    "content": {
      "raw_text": "Machine learning is a subset of artificial intelligence",
      "timestamp": "2024-01-01T00:00:00Z",
      "source": "manual_input"
    },
    "context": {
      "session_id": "test-session",
      "user_preferences": {"auto_link": true, "language": "en"}
    }
  }'
```

## Service Architecture (When Running)

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Frontend    │  │   Backend    │  │ Celery Worker│      │
│  │   :3000      │  │    :8000     │  │              │      │
│  │  (React)     │  │  (FastAPI)   │  │ (Background) │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │              │
│  ┌──────┴─────────────────┴──────────────────┴──────┐      │
│  │              PostgreSQL :5432                     │      │
│  │              Neo4j :7474/:7687                    │      │
│  │              Redis :6379                          │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Port Conflicts
If ports are already in use, modify `docker-compose.yml`:
```yaml
ports:
  - "3001:80"  # Instead of 3000:80
  - "8001:8000"  # Instead of 8000:8000
```

### Memory Issues
Increase Docker memory limit to 4GB+ in Docker Desktop settings.

### Neo4j Slow Startup
Neo4j takes 30-60 seconds to initialize. Wait for the health check to pass.

## Files Included

- `docker-compose.yml` - Full stack orchestration
- `.env` - Environment variables (your Groq key included)
- `setup.sh` - Automated setup script
- `backend/` - FastAPI application
- `frontend/` - React application
- `README.md` - Full documentation

## Support

Run `docker-compose logs -f [service]` to debug issues.
