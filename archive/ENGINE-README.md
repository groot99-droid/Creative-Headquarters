# Living Archive Engine

A self-organizing knowledge system that uses AI to classify, store, and visualize information in a dynamic graph structure.

## Features

- **AI-Powered Classification**: Automatically categorizes knowledge using Groq's LLaMA models
- **Graph Visualization**: Interactive D3.js force-directed graph of knowledge relationships
- **Tree View**: Hierarchical browsing of classified knowledge
- **Vector Search**: Semantic similarity search (with Pinecone or fallback)
- **User Authentication**: JWT-based auth with registration/login
- **Background Tasks**: Celery workers for reorganization and maintenance

## Quick Start

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Groq API key

### Setup

1. **Clone/navigate to the project:**
   ```bash
   cd living-archive
   ```

2. **Set your Groq API key:**
   ```bash
   export GROQ_API_KEY=gsk_your_actual_key_here
   ```
   
   Or edit the `.env` file directly.

3. **Run the setup script:**
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - API Documentation: http://localhost:8000/docs
   - Neo4j Browser: http://localhost:7474 (login: neo4j/password)

### Manual Start (without setup script)

```bash
docker-compose up --build
```

## Architecture

```
┌─────────────────────────────────────────┐
│           User Browser                  │
│    (React + D3 + Tailwind)              │
└─────────────┬───────────────────────────┘
              │ HTTP
┌─────────────▼───────────────────────────┐
│      FastAPI Backend (Port 8000)        │
│  - Auth (JWT)  │  - Ingest (AI)         │
│  - Search      │  - Background Tasks    │
└──────┬────────────┬─────────────────────┘
       │            │
┌──────▼──────┐  ┌──▼─────────────┐
│ PostgreSQL  │  │ Neo4j          │
│ (Nodes)     │  │ (Graph)        │
└─────────────┘  └────────────────┘
       │
┌──────▼─────────┐
│ Pinecone       │
│ (Vectors)      │
│ OR pgvector    │
└────────────────┘
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/token` - Login (OAuth2 form)

### Knowledge Management
- `POST /api/ingest` - Submit knowledge for classification
- `GET /api/nodes` - List all nodes
- `GET /api/nodes/{id}` - Get specific node
- `GET /api/search?q={query}` - Search nodes

### Health
- `GET /health` - Service health check

## Data Flow

1. User submits text via frontend
2. Backend sends text to Groq AI for:
   - Classification (path + confidence)
   - Entity extraction
   - Summarization
   - Key phrase identification
3. Results stored in:
   - PostgreSQL: Node data
   - Neo4j: Graph relationships
   - Pinecone (optional): Vector embeddings
4. Frontend displays in Tree/Graph/List views

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | Yes | - | Groq API key for AI |
| `SECRET_KEY` | Yes | dev-secret | JWT signing key |
| `POSTGRES_PASSWORD` | No | postgres | Database password |
| `NEO4J_PASSWORD` | No | password | Neo4j password |
| `PINECONE_API_KEY` | No | - | Optional vector DB |
| `OPENAI_API_KEY` | No | - | Optional for embeddings |

### Ports

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | React app |
| Backend | 8000 | FastAPI |
| PostgreSQL | 5432 | Database |
| Neo4j HTTP | 7474 | Browser |
| Neo4j Bolt | 7687 | Driver |
| Redis | 6379 | Cache/Queue |

## Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose logs -f [service_name]

# Common fixes
docker-compose down -v  # Full reset (removes data!)
docker system prune -f   # Clean Docker cache
```

### Database connection errors

Wait for PostgreSQL to be ready:
```bash
docker-compose exec postgres pg_isready -U postgres
```

### AI classification not working

Verify Groq API key:
```bash
curl -H "Authorization: Bearer $GROQ_API_KEY" \
  https://api.groq.com/openai/v1/models
```

### Frontend can't connect to backend

Check CORS settings in `backend/app/main.py` and ensure ports match.

### Neo4j connection issues

Neo4j takes 30-60 seconds to start. Check status:
```bash
curl http://localhost:7474
```

## Development

### Backend Development

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

### Running Tests

```bash
# Backend tests
docker-compose exec backend pytest

# Frontend tests
cd frontend && npm test
```

## Production Deployment

1. Change default passwords in `.env`
2. Use strong `SECRET_KEY`
3. Enable HTTPS/TLS
4. Configure proper logging
5. Set up monitoring (Prometheus/Grafana)
6. Use managed PostgreSQL/Neo4j services

## License

MIT License - See LICENSE file

## Support

For issues or questions:
- Check logs: `docker-compose logs -f`
- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health
