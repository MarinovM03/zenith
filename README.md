# Acca

Real-time football accumulator tracker. Log multi-leg bets, watch them resolve live as matches unfold, and analyse your long-term performance. Built with Angular 21, FastAPI, PostgreSQL, and Redis. A tracking and analytics tool — not a gambling platform.

---

## Prerequisites

| Tool                | Version       |
|---------------------|---------------|
| Node.js             | 20.x or 22.x  |
| Python              | 3.12          |
| Docker Desktop      | latest        |
| Git                 | any recent    |

---

## First-time setup (Windows / PowerShell)

### 1. Start Postgres and Redis

```powershell
docker compose up -d
```

### 2. Backend env file

Create `server/.env` with the variables listed under [Environment variables](#environment-variables) below.

### 3. Backend

```powershell
cd server
py -V:3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8001
```

API at <http://localhost:8001>. Interactive docs at <http://localhost:8001/docs>.

### 4. Frontend

In a separate terminal:

```powershell
cd client
npm install
npm start
```

App at <http://localhost:4200>.

---

## Day-to-day commands

### Backend

```powershell
cd server
.\.venv\Scripts\Activate.ps1

uvicorn app.main:app --reload --port 8001
pytest
ruff check .
black .
alembic upgrade head
alembic revision --autogenerate -m "<message>"
```

### Frontend

```powershell
cd client
npm start                             # ng serve on :4200
npx ng test --watch=false             # vitest
npm run build                         # production build
```

### Dependencies

```powershell
docker compose up -d
docker compose down                   # stop, keep data
docker compose down -v                # stop AND wipe data
```

---

## Environment variables

Source of truth is `server/app/core/config.py`. The frontend reads `client/src/environments/environment*.ts`.

Required in `server/.env`:

```
POSTGRES_USER=acca
POSTGRES_PASSWORD=<choose one>
POSTGRES_DB=acca
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=<long random string>

CORS_ORIGINS=http://localhost:4200

API_FOOTBALL_KEY=<your key from api-football.com>
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
```

Never commit `.env`. `.gitignore` enforces this.

---

## Architecture

See [`docs/adr/`](docs/adr/README.md). Start with [ADR-0001](docs/adr/0001-stack-and-layered-architecture.md).
