# Habit Tracker API

A production-style backend API for building and tracking personal habits. Users can create habits in two modes — **DO** (mark done to succeed) or **AVOID** (not logging it is the win) — and track them on daily, weekly, monthly, or custom schedules. The app surfaces calendar views, streak data, and eventually AI-generated insights to help users understand their patterns over time.

Built as a full-stack portfolio project. Backend first, React frontend to follow.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Python 3.12 |
| Framework | FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| Auth | JWT (access + refresh tokens), passlib/bcrypt |
| Containerization | Docker + Docker Compose |
| Testing | pytest + httpx |
| Linting / Formatting | Ruff, Black, mypy |

---

## Architecture

This project uses a **layered repository pattern**:

```
Request → API (router) → Service → Repository → Database
           validates       business    SQL only
           HTTP stuff      logic
```

- **`app/api/`** — HTTP layer: request validation, response formatting, route definitions
- **`app/services/`** — Business logic: scheduling rules, DO/AVOID logic, streak calculations
- **`app/repositories/`** — Database layer: all SQL queries live here, nothing else
- **`app/models/`** — SQLAlchemy ORM models
- **`app/schemas/`** — Pydantic models for request/response validation

---

## Feature Goals

- **Habit tracking** with DO and AVOID modes
  - DO habit: mark it done → green. Don't mark it → red.
  - AVOID habit: don't log it → green. Log it → red.
- **Flexible scheduling**: daily, weekly, monthly, or custom intervals
- **Terminal or ongoing habits**: optionally set an end date
- **Categories**: one per habit — Morning / Day / Evening (or custom)
- **Tags**: freeform, multiple per habit (e.g. "health", "work")
- **Calendar views**:
  - Weekly: stacked red/green bars across 7 days
  - Monthly: per-habit view showing each day's status
- **Streak tracking**: current streak and personal best per habit
- **Vacation mode**: pre-schedule a date range where habits are paused, not failed
- **Grace period**: edit check-ins up to 3 days in the past
- **TODO task list**: one-time non-recurring tasks (Phase 7)
- **Analytics**: completion rates, day-of-week patterns, weakest/strongest habits
- **Notifications**: reminders (platform TBD)
- **AI insights**: LLM-generated analysis of habit patterns (Phase 9)
- **React frontend**: full UI to consume this API (Phase 10)

---

## Roadmap

### ✅ Phase 0 — Scaffold
- [x] Project structure, FastAPI app, CORS middleware
- [x] Pydantic settings with `.env` support
- [x] Versioned API routing (`/api/v1/`)
- [x] Health check endpoint
- [x] Docker + Docker Compose (API + PostgreSQL)
- [x] pytest setup with integration test for health check

---

### 🔧 Phase 1 — Database Foundation
> Alembic, SQLAlchemy async sessions, JWT auth

- [ ] **Step 1** — Configure Alembic + wire up async DB session (`db/session.py`, `db/base.py`, `alembic.ini`)
- [ ] **Step 2** — `User` model + first Alembic migration
- [ ] **Step 3** — Auth endpoints: register, login, refresh token, logout
  - Password hashing (passlib/bcrypt)
  - JWT creation and validation (python-jose)
  - `get_current_user` dependency for protected routes

---

### 🗂️ Phase 2 — Habit Data Model
> SQLAlchemy relationships, many-to-many joins, Pydantic schemas

- [ ] **Step 4** — `Category` model + CRUD (default: Morning / Day / Evening)
- [ ] **Step 5** — `Tag` model + CRUD (freeform, user-owned)
- [ ] **Step 6** — `Habit` model + CRUD
  - Fields: `name`, `description`, `mode` (DO/AVOID), `frequency` (daily/weekly/monthly/custom), `start_date`, `end_date` (optional), `category_id`, `is_active`
- [ ] **Step 7** — Habit ↔ Tag many-to-many association + migration

---

### 📋 Phase 3 — Daily Tracking
> Date logic, business rules, service layer patterns

- [ ] **Step 8** — `HabitLog` model + migration
- [ ] **Step 9** — Check-in endpoints
  - `GET /habits/today` — all habits due today with current status
  - `POST /habits/{id}/log` — mark a habit done
  - `DELETE /habits/{id}/log` — unmark a habit (supports grace period)

---

### 📅 Phase 4 — Calendar Views
> Date aggregation, query optimization

- [ ] **Step 10** — Weekly calendar endpoint
  - `GET /calendar/weekly?date=YYYY-MM-DD` — 7-day view with red/green status per habit
- [ ] **Step 11** — Monthly per-habit calendar endpoint
  - `GET /calendar/monthly?habit_id=X&month=YYYY-MM` — full month, day-by-day status

---

### 🔥 Phase 5 — Streaks
> Stateful tracking, computed fields

- [ ] **Step 12** — Streak calculation (current streak + personal best per habit)
  - `GET /habits/{id}/stats` — streak, completion rate, longest run

---

### ⚙️ Phase 6 — Advanced Habit Features
> Scheduling edge cases, soft overrides

- [ ] **Step 13** — Vacation mode (`VacationPeriod` model — habits auto-skip, not fail, during a date range)
- [ ] **Step 14** — Grace period (allow editing logs up to 3 days in the past)

---

### ✅ Phase 7 — TODO Task List
> Second item type, polymorphic data modeling

- [ ] **Step 15** — `Task` model (one-time, non-recurring, with due date + priority)
- [ ] **Step 16** — Task CRUD + completion endpoint

---

### 📊 Phase 8 — Analytics & Notifications
> Aggregation queries, background jobs

- [ ] **Step 17** — Analytics endpoints (completion rates, weakest/strongest habits, day-of-week patterns)
- [ ] **Step 18** — Notification scaffolding (push / email — platform TBD)

---

### 🤖 Phase 9 — AI Insights
> LLM API integration, prompt engineering

- [ ] **Step 19** — AI-generated habit analysis (Claude or OpenAI) based on log history and patterns

---

### 🖥️ Phase 10 — React Frontend
> Full-stack integration

- [ ] **Step 20+** — React app: habit list, daily check-in UI, weekly/monthly calendar views, streak display

---

## Running Locally

### Prerequisites
- Docker + Docker Compose

### Start the stack

```bash
docker compose up --build
```

API will be available at `http://localhost:8000`
Interactive docs (Swagger UI) at `http://localhost:8000/docs`
Health check at `http://localhost:8000/api/v1/health`

### Run tests

```bash
docker compose exec api pytest
```

### Environment variables

Copy `.env.example` to `.env` and update as needed:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `APP_ENV` | `development` or `production` |
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | Secret used to sign JWTs — change in production |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | How long access tokens live (default: 15) |
| `REFRESH_TOKEN_EXPIRE_MINUTES` | How long refresh tokens live (default: 7 days) |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins |




# docker commands
Run a command inside the running API container
	docker compose exec api <command>

Examples:
	docker compose exec api alembic upgrade head       # run migrations
	docker compose exec api pytest                     # run tests
	docker compose exec api alembic revision --autogenerate -m "add user table"  # generate a migration

Stop Docker cleanly
	docker compose down

Stop AND wipe the database volume (nuclear reset)
	docker compose down -v
