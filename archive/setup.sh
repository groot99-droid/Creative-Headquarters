#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print banner
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           Living Archive Engine - Setup Script               ║"
echo "║              Self-organizing Knowledge System                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi
echo -e "${GREEN}✓ Docker is installed${NC}"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose is installed${NC}"

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon is not running. Please start Docker first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker daemon is running${NC}"

# Check Groq API key
if [ -z "$GROQ_API_KEY" ]; then
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
fi

if [ -z "$GROQ_API_KEY" ] || [ "$GROQ_API_KEY" = "gsk_your_key_here" ]; then
    echo -e "${RED}❌ GROQ_API_KEY is not set.${NC}"
    echo "   Please set your Groq API key:"
    echo "   export GROQ_API_KEY=gsk_your_actual_key_here"
    echo ""
    echo "   Or update the .env file with your key."
    exit 1
fi
echo -e "${GREEN}✓ Groq API key is configured${NC}"

# Create necessary directories
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p postgres_data neo4j_data redis_data
echo -e "${GREEN}✓ Directories created${NC}"

# Pull images first for better visibility
echo -e "${YELLOW}Pulling Docker images...${NC}"
docker-compose pull
echo -e "${GREEN}✓ Images pulled${NC}"

# Build and start services
echo -e "${YELLOW}Building and starting services...${NC}"
docker-compose up --build -d

echo ""
echo -e "${GREEN}✓ Services are starting up...${NC}"
echo ""

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
sleep 5

# Check service health
echo ""
echo -e "${BLUE}Service Status:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check PostgreSQL
if docker-compose exec -T postgres pg_isready -U postgres &> /dev/null; then
    echo -e "${GREEN}✓ PostgreSQL${NC}     - Ready (port 5432)"
else
    echo -e "${YELLOW}⏳ PostgreSQL${NC}     - Starting..."
fi

# Check Neo4j
if curl -s http://localhost:7474 &> /dev/null; then
    echo -e "${GREEN}✓ Neo4j${NC}          - Ready (ports 7474, 7687)"
else
    echo -e "${YELLOW}⏳ Neo4j${NC}          - Starting..."
fi

# Check Redis
if docker-compose exec -T redis redis-cli ping &> /dev/null; then
    echo -e "${GREEN}✓ Redis${NC}          - Ready (port 6379)"
else
    echo -e "${YELLOW}⏳ Redis${NC}          - Starting..."
fi

# Check Backend
if curl -s http://localhost:8000/health &> /dev/null; then
    echo -e "${GREEN}✓ Backend API${NC}    - Ready (port 8000)"
else
    echo -e "${YELLOW}⏳ Backend API${NC}    - Starting..."
fi

# Check Frontend
if curl -s http://localhost:3000 &> /dev/null; then
    echo -e "${GREEN}✓ Frontend${NC}       - Ready (port 3000)"
else
    echo -e "${YELLOW}⏳ Frontend${NC}       - Starting..."
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Print access information
echo -e "${GREEN}🚀 Living Archive Engine is starting up!${NC}"
echo ""
echo -e "${BLUE}Access Points:${NC}"
echo "  • Frontend:     http://localhost:3000"
echo "  • API Docs:     http://localhost:8000/docs"
echo "  • Neo4j Browser: http://localhost:7474 (neo4j/password)"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  • View logs:    docker-compose logs -f"
echo "  • Stop:         docker-compose down"
echo "  • Restart:      docker-compose restart"
echo "  • Full reset:   docker-compose down -v"
echo ""
echo -e "${YELLOW}Note: It may take 30-60 seconds for all services to fully start.${NC}"
echo -e "${YELLOW}      Run 'docker-compose logs -f backend' to monitor startup progress.${NC}"
echo ""
echo -e "${GREEN}Setup complete! 🎉${NC}"
