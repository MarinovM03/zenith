# Zenith

A space-exploration discovery app — a live home dashboard, NASA's Astronomy Picture of the Day, rocket launches with live countdowns, Mars rover photography, near-Earth asteroids, and live ISS tracking. Signed-in users can save favourites and follow upcoming launches. Built with Angular 21, FastAPI, PostgreSQL, and Redis on a dark violet theme.

---

## Features

- **Home dashboard** — the Picture of the Day as a hero, personalized followed-launch scheduling for signed-in users, and live launch, asteroid, Mars, and ISS cards.
- **Picture of the Day** — today's APOD with a browsable date archive.
- **Launches** — upcoming and past launches (Launch Library 2) with live countdowns and detail pages.
- **Mars** — latest Perseverance raw images with "load more" paging.
- **Asteroids** — near-Earth objects for the next 7 days, hazardous ones flagged.
- **ISS** — live position, altitude, speed, and orbital day/night state.
- **Following** — follow upcoming launches, review local-time schedules, and export calendar events.
- **Favourites** — save items behind JWT auth (access token + HTTP-only refresh cookie).

---

## Prerequisites

| Tool           | Version      |
| -------------- | ------------ |
| Node.js        | 20.x or 22.x |
| Python         | 3.12         |
| Docker Desktop | latest       |
| Git            | any recent   |

You also need a free **NASA API key** from <https://api.nasa.gov> (instant). Launch Library 2 needs no key.

---

## First-time setup (Windows / PowerShell)

### 1. Start Postgres and Redis

```powershell
docker compose up -d
```

Compose runs **only** the local dependencies (Postgres + Redis); the app itself runs on the host.

### 2. Backend env file

Create `server/.env`. The available keys are defined in `server/app/core/config.py` (`Settings`) — at minimum set `JWT_SECRET` and `NASA_API_KEY`. Never commit this file.

### 3. Backend

```powershell
cd server
py -V:3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --port 8001
```

API at <http://127.0.0.1:8001>, docs at <http://127.0.0.1:8001/docs>. Port **8001** because Windows reserves 8000.

### 4. Frontend

```powershell
cd client
npm install
npm start   # ng serve --host 127.0.0.1
```

App at <http://127.0.0.1:4200>. **Use `127.0.0.1`, not `localhost`** — the SameSite refresh cookie and CORS are configured for `127.0.0.1:4200`, and mixing the two hosts breaks auth. (`npm start` already binds `127.0.0.1`.)

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
npm start                  # ng serve on 127.0.0.1:4200
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

## Tests & checks

CI runs all of these — keep them green before pushing:

```powershell
# Backend (from server/, venv active)
pytest
ruff check .
black --check .

# Frontend (from client/)
npx ng test --watch=false
npm run build
npx prettier --check "src/**/*.{ts,html,css}"
```

---

## Project structure

```
client/                 Angular 21 (standalone components, signals, OnPush)
  src/app/features/     apod, launches, mars, asteroids, iss, home, following, favourites, auth
  src/app/core/         services (auth, HTTP data, favourites, followed launches), guards, interceptors
  src/app/shared/       cosmic-background, countdown, skeleton, img-fade, favourite-button
  src/styles.css        global design tokens (colours, spacing, radius, shadows)
server/                 FastAPI (Python 3.12, async)
  app/routers/          HTTP endpoints (no DB access here)
  app/services/         business logic, upstream httpx clients, Redis cache
  app/repositories/     database access
  app/models/           SQLAlchemy 2.0 ORM
  app/schemas/          Pydantic v2 schemas
  app/core/             settings + security
  alembic/              migrations
docker-compose.yml      Postgres + Redis (local deps only)
```

---

## Notes & gotchas

- **Frontend host:** always `127.0.0.1:4200`, never `localhost` (SameSite cookie + IPv6 slowness).
- **Mars data:** comes from `mars.nasa.gov/rss/api` (Perseverance / `mars2020`); the old `mars-photos.herokuapp.com` API is dead.
- **NASA latency:** NASA hosts have high cold-CDN latency (a cold deep Mars page can take 15–20s). Upstream read timeouts are generous (Mars ~25s, APOD ~15s) and timeouts are not negative-cached, so a retry can still succeed. Slowness here is upstream, not your firewall.
- **Caching:** every upstream call is cached in Redis (read-through), with per-resource TTLs (APOD 24h, upcoming launches ~5–10 min, Mars and past launches 24h, asteroids 6h).
- **Rendering:** content routes are prerendered to static HTML (Angular SSG, `outputMode: static`) for fast first paint and SEO; live data loads client-side after hydration. Auth and dynamic routes (`/login`, `/register`, `/following`, `/favourites`, `/apod/:date`, `/launches/:id`) render client-side, so a static host must serve `index.csr.html` as their SPA fallback. Don't add timers or `window`/`document` access in a component constructor without a browser guard (`isPlatformBrowser`/`afterNextRender`), or prerendering will fail.

---

## Architecture

**Backend** is layered — `routers/` → `services/` → `repositories/` → `models/`; routers never touch the DB directly. Pydantic v2 schemas are kept separate from the SQLAlchemy ORM, everything is `async`, and every upstream call goes through a read-through Redis cache. Auth is a JWT access token (15 min) plus a 7-day HTTP-only refresh cookie, with bcrypt password hashing (SHA-256 pre-hash) and slowapi rate limiting on auth routes.

**Frontend** is standalone Angular components with signal-based state, `inject()`, `OnPush`, and lazy-loaded feature routes. Content routes are prerendered at build time (static SSG) for fast first paint and SEO, then hydrated on the client. Cross-cutting concerns (auth, HTTP, toasts) live in `core/services/`; reusable UI in `shared/`; global design tokens in `src/styles.css`.
