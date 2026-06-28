#!/bin/bash
# =============================================================================
# FORSA OS — Local Setup Script
# Run once to set up your local development environment
# Usage: bash scripts/setup-local.sh
# =============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo "================================================"
echo "  FORSA OS — Local Development Setup"
echo "================================================"
echo ""

# Check dependencies
command -v docker >/dev/null 2>&1 || error "Docker not found. Install Docker Desktop first."
command -v node >/dev/null 2>&1 || error "Node.js not found. Install Node.js 20+."
command -v npm >/dev/null 2>&1 || error "npm not found."

info "Node version: $(node --version)"
info "npm version:  $(npm --version)"

# Copy env file
if [ ! -f ".env" ]; then
  cp .env.local .env
  info "Created .env from .env.local"
else
  warn ".env already exists — not overwriting"
fi

# Install dependencies
info "Installing npm dependencies..."
npm install

# Start Docker services
info "Starting Docker services (postgres, redis, minio, mailhog)..."
docker compose up -d

# Wait for postgres
info "Waiting for PostgreSQL to be ready..."
until docker compose exec -T postgres pg_isready -U postgres -q 2>/dev/null; do
  sleep 1
done
info "PostgreSQL ready"

# Create database users
info "Creating database users..."
docker compose exec -T postgres psql -U postgres << 'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'forsa_app') THEN
    CREATE USER forsa_app WITH PASSWORD 'localapppassword123';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'forsa_readonly') THEN
    CREATE USER forsa_readonly WITH PASSWORD 'localreadonlypassword123';
  END IF;
END $$;

GRANT CONNECT ON DATABASE forsa_os TO forsa_app, forsa_readonly;
GRANT USAGE ON SCHEMA public TO forsa_app, forsa_readonly;
SQL
info "Database users created"

# Create MinIO bucket
info "Creating MinIO bucket..."
sleep 3  # Wait for MinIO to be fully ready
docker run --rm --network host \
  minio/mc alias set local http://localhost:9000 minioadmin minioadmin123 2>/dev/null || true
docker run --rm --network host \
  minio/mc mb local/forsa-documents --ignore-existing 2>/dev/null || true
docker run --rm --network host \
  minio/mc anonymous set none local/forsa-documents 2>/dev/null || true
info "MinIO bucket 'forsa-documents' ready"

# Run migrations
info "Running database migrations..."
npx ts-node scripts/migrate.ts

# Seed reference data
info "Seeding reference data..."
npx ts-node scripts/seed.ts

# Seed admin user
info "Creating bootstrap admin user..."
echo ""
npx ts-node scripts/seed-admin.ts
echo ""

echo ""
echo "================================================"
echo -e "  ${GREEN}Setup Complete!${NC}"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Note the Tenant ID printed above"
echo "  2. Start the app:  npm run start:dev"
echo "  3. Open Swagger:   http://localhost:3000/api/v1/docs"
echo "  4. View emails:    http://localhost:8025"
echo "  5. View MinIO:     http://localhost:9001  (minioadmin/minioadmin123)"
echo ""
echo "Login credentials:"
echo "  Email:     admin@forsa.tn"
echo "  Password:  Admin123!dev"
echo "  TenantId:  (from output above)"
echo ""
