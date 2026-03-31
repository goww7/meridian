#!/usr/bin/env bash
set -e

# ═══════════════════════════════════════════════════════════
# Meridian UAT Runner
# Seeds the database with rich demo data and runs the full
# automated UAT test suite against the live API.
# ═══════════════════════════════════════════════════════════

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

API_URL="${API_URL:-http://localhost:3001}"
API_PID=""

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Meridian UAT Runner${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}[1/5] Checking prerequisites...${NC}"

if ! command -v pnpm &> /dev/null; then
  echo -e "${RED}Error: pnpm is not installed${NC}"
  exit 1
fi

# Check if PostgreSQL is reachable
if ! pg_isready -h localhost -p 5432 -U meridian &> /dev/null 2>&1; then
  echo -e "${YELLOW}  PostgreSQL not running. Starting docker compose...${NC}"
  docker compose up -d
  echo "  Waiting for PostgreSQL..."
  sleep 5
fi

echo -e "${GREEN}  ✓ Prerequisites OK${NC}"

# Run migrations
echo ""
echo -e "${YELLOW}[2/5] Running database migrations...${NC}"
pnpm db:migrate
echo -e "${GREEN}  ✓ Migrations complete${NC}"

# Seed UAT data
echo ""
echo -e "${YELLOW}[3/5] Seeding UAT data...${NC}"
pnpm db:uat-seed
echo -e "${GREEN}  ✓ UAT data seeded${NC}"

# Start API server if not running
echo ""
echo -e "${YELLOW}[4/5] Checking API server...${NC}"
if curl -s "${API_URL}/health" > /dev/null 2>&1; then
  echo -e "${GREEN}  ✓ API already running at ${API_URL}${NC}"
else
  echo -e "  Starting API server..."
  cd "$(dirname "$0")/.."
  pnpm --filter=@meridian/api dev &
  API_PID=$!
  echo "  Waiting for API to be ready..."
  for i in $(seq 1 30); do
    if curl -s "${API_URL}/health" > /dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  if ! curl -s "${API_URL}/health" > /dev/null 2>&1; then
    echo -e "${RED}  Error: API failed to start${NC}"
    kill $API_PID 2>/dev/null || true
    exit 1
  fi
  echo -e "${GREEN}  ✓ API started (PID: ${API_PID})${NC}"
fi

# Run UAT tests
echo ""
echo -e "${YELLOW}[5/5] Running UAT tests...${NC}"
echo ""
pnpm test:uat
UAT_EXIT=$?

# Cleanup
if [ -n "$API_PID" ]; then
  echo ""
  echo "Stopping API server..."
  kill $API_PID 2>/dev/null || true
fi

echo ""
if [ $UAT_EXIT -eq 0 ]; then
  echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  UAT PASSED${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
else
  echo -e "${RED}═══════════════════════════════════════════════════${NC}"
  echo -e "${RED}  UAT FAILED${NC}"
  echo -e "${RED}═══════════════════════════════════════════════════${NC}"
fi

exit $UAT_EXIT
