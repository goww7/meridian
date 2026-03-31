# Meridian — Deployment & Infrastructure

## Overview

Meridian runs as containerized services deployed to a cloud environment. This document covers local development, Docker configuration, CI/CD pipeline, and production infrastructure.

## Local Development

### Prerequisites

- Node.js 20+ (via nvm)
- pnpm 9+
- Docker & Docker Compose (for PostgreSQL, Redis)
- Git

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/meridian-dev/meridian.git
cd meridian

# 2. Install dependencies
pnpm install

# 3. Start infrastructure
docker compose up -d  # PostgreSQL + Redis

# 4. Configure environment
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY

# 5. Setup database
pnpm db:migrate
pnpm graph:init
pnpm db:seed

# 6. Start development
pnpm dev
```

### Docker Compose (Local Dev)

```yaml
# docker-compose.yml
services:
  postgres:
    image: apache/age:latest      # PostgreSQL 16 + AGE extension
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: meridian
      POSTGRES_PASSWORD: meridian
      POSTGRES_DB: meridian
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U meridian"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  redisdata:
```

## Docker Build

### API Dockerfile

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/policy-dsl/package.json ./packages/policy-dsl/
RUN pnpm install --frozen-lockfile --prod

FROM base AS build
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/ ./apps/api/
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter=@meridian/shared build
RUN pnpm --filter=@meridian/policy-dsl build
RUN pnpm --filter=@meridian/api build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/policy-dsl/dist ./packages/policy-dsl/dist
COPY apps/api/package.json ./apps/api/

USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/server.js"]
```

### Web Dockerfile

```dockerfile
# apps/web/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate

FROM base AS build
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/ ./apps/web/
COPY packages/shared/ ./packages/shared/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter=@meridian/shared build
RUN pnpm --filter=@meridian/web build

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### nginx.conf (SPA routing)

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://api:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: apache/age:latest
        env:
          POSTGRES_USER: meridian
          POSTGRES_PASSWORD: meridian
          POSTGRES_DB: meridian_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build --filter=@meridian/shared --filter=@meridian/policy-dsl
      - run: pnpm db:migrate
        env:
          DATABASE_URL: postgresql://meridian:meridian@localhost:5432/meridian_test
      - run: pnpm test -- --coverage
        env:
          DATABASE_URL: postgresql://meridian:meridian@localhost:5432/meridian_test
          REDIS_URL: redis://localhost:6379

  build:
    runs-on: ubuntu-latest
    needs: [lint, test]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Build and push Docker images
        run: |
          docker build -f apps/api/Dockerfile -t meridian-api:${{ github.sha }} .
          docker build -f apps/web/Dockerfile -t meridian-web:${{ github.sha }} .
          # Push to container registry

  deploy-staging:
    runs-on: ubuntu-latest
    needs: [build]
    environment: staging
    steps:
      - name: Deploy to staging
        run: |
          # Deploy using your preferred method (Kubernetes, ECS, Railway, etc.)
          echo "Deploying to staging..."

  deploy-production:
    runs-on: ubuntu-latest
    needs: [deploy-staging]
    environment: production
    steps:
      - name: Deploy to production
        run: |
          echo "Deploying to production..."
```

## Production Architecture

### Recommended: AWS

```
┌─────────────────────────────────────────────────┐
│                    CloudFront                    │
│                    (CDN)                         │
└─────────────┬───────────────────┬───────────────┘
              │                   │
       Static Assets         API Requests
              │                   │
              ▼                   ▼
        ┌──────────┐      ┌──────────────┐
        │    S3    │      │     ALB      │
        │ (web)   │      │ (load bal.)  │
        └──────────┘      └──────┬───────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ ECS/EKS  │ │ ECS/EKS  │ │ ECS/EKS  │
              │  API 1   │ │  API 2   │ │ Worker   │
              └──────────┘ └──────────┘ └──────────┘
                    │            │            │
              ┌─────┴────────────┴────────────┘
              ▼
        ┌──────────────────┐  ┌──────────────┐
        │   RDS PostgreSQL │  │ ElastiCache  │
        │   (Multi-AZ)    │  │   (Redis)    │
        └──────────────────┘  └──────────────┘
```

### Environment Variables (Production)

```bash
# Database
DATABASE_URL=postgresql://meridian:<password>@rds-endpoint:5432/meridian
DATABASE_POOL_SIZE=20
DATABASE_SSL=true

# Redis
REDIS_URL=rediss://<password>@elasticache-endpoint:6379
REDIS_TLS=true

# Auth
JWT_SECRET=<32+ byte random secret>
JWT_EXPIRY=900                    # 15 minutes
REFRESH_TOKEN_EXPIRY=604800       # 7 days

# AI
ANTHROPIC_API_KEY=sk-ant-...
AI_MAX_CONCURRENT=10
AI_RATE_LIMIT_PER_MIN=30

# GitHub
GITHUB_APP_ID=12345
GITHUB_PRIVATE_KEY=<base64 encoded>
GITHUB_WEBHOOK_SECRET=<random secret>

# App
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://app.meridian.dev
LOG_LEVEL=info

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel-collector:4318
SENTRY_DSN=https://...@sentry.io/...
```

### Database Configuration

**Production PostgreSQL:**
- Instance: db.r6g.xlarge (4 vCPU, 32GB RAM) — starting point
- Storage: gp3, 100GB initial, auto-scaling
- Multi-AZ: Yes
- Backups: Daily automated, 30-day retention
- Read replica: 1 (for graph queries and analytics)
- Extensions: `age`, `pgcrypto`, `pg_trgm` (full-text search)

**Connection pooling:**
- PgBouncer sidecar or RDS Proxy
- Pool size: 20 per API instance
- Transaction mode

### Redis Configuration

- ElastiCache Redis 7
- Instance: cache.r6g.large (2 vCPU, 13GB)
- Cluster mode: No (single node for now)
- Eviction policy: `allkeys-lru`
- Persistence: AOF (append-only file)

## Monitoring & Alerting

### Health Endpoints

```
GET /health       → 200 { "status": "ok" }
GET /health/ready → 200 { "db": "ok", "redis": "ok", "queue": "ok" }
GET /health/live  → 200 { "uptime": 12345, "version": "1.0.0" }
```

### Key Metrics to Monitor

| Metric | Warning | Critical |
|--------|---------|----------|
| API response time (p95) | > 500ms | > 2s |
| API error rate (5xx) | > 1% | > 5% |
| Database connections | > 80% pool | > 95% pool |
| Redis memory | > 70% | > 90% |
| Queue depth | > 100 | > 500 |
| Queue job failure rate | > 5% | > 20% |
| AI generation time (p95) | > 30s | > 60s |
| Disk usage | > 70% | > 90% |

### Logging

- Structured JSON via Pino
- Shipped to CloudWatch Logs / Datadog
- Retention: 90 days hot, 1 year cold
- Log levels: `info` in production, `debug` in staging

## Backup & Recovery

- **Database:** RDS automated snapshots (daily) + point-in-time recovery
- **Redis:** AOF persistence, daily snapshot backup
- **Secrets:** Stored in AWS Secrets Manager / SSM Parameter Store
- **Recovery Time Objective (RTO):** < 1 hour
- **Recovery Point Objective (RPO):** < 5 minutes (point-in-time recovery)

## Scaling Strategy

### Phase 1 (0-50 customers)

- Single API instance (2 vCPU, 4GB)
- Single worker instance
- Single PostgreSQL (db.r6g.large)
- Single Redis (cache.r6g.medium)

### Phase 2 (50-200 customers)

- 2-3 API instances behind ALB
- 2 worker instances
- PostgreSQL + 1 read replica
- Redis with more memory

### Phase 3 (200+ customers)

- Auto-scaling group (3-10 API instances)
- Dedicated worker pool (3-5 instances)
- PostgreSQL Multi-AZ + 2 read replicas
- Redis cluster mode
- CDN for static assets
