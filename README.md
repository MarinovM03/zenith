# Zenith

A space-exploration discovery app — NASA's Astronomy Picture of the Day, rocket launches with live countdowns, Mars rover photography, and near-Earth asteroids. Built as an installable PWA with Angular 21, FastAPI, PostgreSQL, and Redis.

> Pivoted from an earlier football project; the git history shows that evolution.

---

## Prerequisites

| Tool           | Version       |
| -------------- | ------------- |
| Node.js        | 20.x or 22.x  |
| Python         | 3.12          |
| Docker Desktop | latest        |
| Git            | any recent    |

You also need a free **NASA API key** from <https://api.nasa.gov> (instant). Launch Library 2 needs no key.

---

## First-time setup (Windows / PowerShell)

### 1. Start Postgres and Redis

```powershell
docker compose up -d
```

### 2. Backend env file

Create `server/.env` with the variables under [Environment variables](#environment-variables).

### 3. Backend

```powershell
cd server
py -V:3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --port 8001
```

API at <http://localhost:8001>, docs at <http://localhost:8001/docs>.

### 4. Frontend

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
npm start                  # ng serve on :4200
npx ng test --watch=false  # vitest
npm run build              # production build
```

### Dependencies

```powershell
docker compose up -d
docker compose down        # stop, keep data
docker compose down -v     # stop AND wipe data
```

---

## Environment variables

Source of truth is `server/app/core/config.py`. The frontend reads `client/src/environments/environment*.ts`.

Required in `server/.env`:

```
POSTGRES_USER=zenith
POSTGRES_PASSWORD=<choose one>
POSTGRES_DB=zenith
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=<long random string>

CORS_ORIGINS=http://localhost:4200

NASA_API_KEY=<your key from api.nasa.gov>
```

Never commit `.env`. `.gitignore` enforces this.

---

## Architecture

See [`CLAUDE.md`](CLAUDE.md) for the full brief and conventions. Significant decisions are in [`docs/adr/`](docs/adr/README.md).
