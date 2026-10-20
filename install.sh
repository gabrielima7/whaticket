#!/usr/bin/env bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
echo "=========================================================="
echo "    Whaticket Enterprise v10.0.0 - Automated Installer   "
echo "=========================================================="
echo -e "${NC}"

# 1. Check Docker & Docker Compose
echo -e "${BLUE}[1/5] Verifying dependencies...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}[ERROR] Docker is not installed. Please install Docker first: https://docs.docker.com/engine/install/${NC}"
    exit 1
fi

DOCKER_COMPOSE_CMD=""
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}[ERROR] Docker Compose is not installed. Please install Docker Compose: https://docs.docker.com/compose/install/${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker and Docker Compose detected (${DOCKER_COMPOSE_CMD}).${NC}"

# 2. Check or Clone Project Files
echo -e "${BLUE}[2/5] Setting up project directory...${NC}"
INSTALL_DIR="whaticket"
if [ ! -f "docker-compose.yaml" ] && [ ! -f "docker-compose.yml" ]; then
    if [ ! -d "$INSTALL_DIR" ]; then
        echo "Cloning repository..."
        git clone https://github.com/gabrielima7/whaticket.git "$INSTALL_DIR"
    fi
    cd "$INSTALL_DIR"
fi

# 3. Configure .env file
echo -e "${BLUE}[3/5] Configuring environment variables (.env)...${NC}"
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
    else
        echo -e "${YELLOW}Warning: .env.example not found, creating baseline .env...${NC}"
        cat << 'EOF' > .env
DB_DIALECT=postgres
DB_HOST=whaticket_db
DB_PORT=5432
DB_USER=whaticket
DB_PASS=senha_postgres_a_ser_mudada
DB_NAME=whaticket
TZ=America/Sao_Paulo
PORT=3000
PROXY_PORT=8080
FRONTEND_PORT=3250
BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3250
CHROME_ARGS=--no-sandbox --disable-setuid-sandbox
REDIS_URI=redis://whaticket_redis:6379
REDIS_OPT_LIMITER_MAX=1
REDIS_OPT_LIMITER_DURATION=3000
USER_LIMIT=10000
CONNECTIONS_LIMIT=10000
CLOSED_SEND_BY_ME=true
COMPANY_NAME=Whaticket Enterprise
JWT_SECRET=jwt_secreto_a_ser_mudado
JWT_REFRESH_SECRET=jwt_refresh_secreto_a_ser_mudado
EOF
    fi

    # Generate secure random passwords and secrets
    GEN_DB_PASS=$(openssl rand -hex 16 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    GEN_JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
    GEN_JWT_REFRESH=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)

    sed -i "s/senha_postgres_a_ser_mudada/${GEN_DB_PASS}/g" .env || true
    sed -i "s/jwt_secreto_a_ser_mudado/${GEN_JWT_SECRET}/g" .env || true
    sed -i "s/jwt_refresh_secreto_a_ser_mudado/${GEN_JWT_REFRESH}/g" .env || true
    sed -i "s/postgres_host_a_ser_mudado/whaticket_db/g" .env || true
    sed -i "s/porta_postgres_a_ser_mudada/5432/g" .env || true
    sed -i "s/usuario_postgres_a_ser_mudado/whaticket/g" .env || true
    sed -i "s/nome_postgres_a_ser_mudado/whaticket/g" .env || true
    sed -i "s/redis_uri_a_ser_mudado/redis:\/\/whaticket_redis:6379/g" .env || true
    sed -i "s/fuso_horario_a_ser_mudado/America\/Sao_Paulo/g" .env || true
    sed -i "s/porta_backend_a_ser_mudada/3000/g" .env || true
    sed -i "s/porta_proxy_a_ser_mudada/8080/g" .env || true
    sed -i "s/chrome_args_a_ser_mudado/--no-sandbox --disable-setuid-sandbox/g" .env || true
    sed -i "s/company_name_a_ser_mudado/Whaticket Enterprise/g" .env || true
    sed -i "s/user_limit_a_ser_mudado/10000/g" .env || true
    sed -i "s/connections_limit_a_ser_mudado/10000/g" .env || true
    sed -i "s/closed_send_by_me_a_ser_mudado/true/g" .env || true
    sed -i "s/redis_limiter_max_a_ser_mudado/1/g" .env || true
    sed -i "s/redis_limiter_duracao_a_ser_mudado/3000/g" .env || true

    echo -e "${GREEN}✓ Generated secure credentials in .env.${NC}"
else
    echo -e "${YELLOW}✓ Existing .env detected, preserving current configuration.${NC}"
fi

# 4. Pull Pre-built Docker Images from GHCR
echo -e "${BLUE}[4/5] Pulling pre-built Docker images from GitHub Container Registry...${NC}"
$DOCKER_COMPOSE_CMD pull || echo -e "${YELLOW}Warning: Pull failed or local build fallback will be used.${NC}"

# 5. Launch Whaticket
echo -e "${BLUE}[5/5] Launching Whaticket Enterprise containers...${NC}"
$DOCKER_COMPOSE_CMD up -d

echo ""
echo -e "${GREEN}==========================================================${NC}"
echo -e "${GREEN}    Whaticket Enterprise v10.0.0 Deployed Successfully!   ${NC}"
echo -e "${GREEN}==========================================================${NC}"
echo ""
echo -e "Frontend:  ${BLUE}http://localhost:3250${NC}"
echo -e "Backend:   ${BLUE}http://localhost:3000${NC}"
echo ""
echo -e "Default credentials (if freshly seeded):"
echo -e "  Email:    ${YELLOW}admin@whaticket.com${NC}"
echo -e "  Password: ${YELLOW}123456${NC}"
echo ""
echo -e "Manage logs:  ${BLUE}$DOCKER_COMPOSE_CMD logs -f${NC}"
echo -e "Stop stack:   ${BLUE}$DOCKER_COMPOSE_CMD down${NC}"
echo ""
