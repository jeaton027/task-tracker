# Daybook

A full-stack habit tracking app built for personal use. Create habits, group them into routines, and track progress across daily, weekly, monthly, and yearly views. Habits support two modes — **DO** (build a habit) and **AVOID** (break one) — with flexible scheduling, quantified targets, streak tracking, and vacation pauses.

The backend is a FastAPI REST API with PostgreSQL. The frontend is a React Native app (Expo SDK 56) designed for Android.

---

## What It Does

- **Habit tracking** with DO and AVOID modes, each with configurable targets (e.g. "drink 8 glasses of water" or "limit coffee to 2 cups")
- **Flexible scheduling**: daily, weekly, monthly, yearly, or custom intervals — with support for compound goals like "3x/day, 2 days/week"
- **Routines**: group habits into named sequences (Morning, Gym, Wind Down) and check them off in order
- **Four time views**: Today, Week, Month, Year — each showing only the habits relevant to that scope
- **Calendar views**: weekly heatmap bars and monthly per-habit grids showing completion history
- **Streaks and stats**: current streak, personal best, completion rates with period filtering
- **Trends**: line charts tracking up to 4 habits over time with a filterable picker
- **Vacation mode**: schedule date ranges where habits are paused, not failed
- **Grace period**: edit check-ins up to 3 days in the past
- **Sections**: organize habits into Morning, Day, and Evening groups
- **Categories and tags**: classify and filter habits
- **Auth**: JWT-based with access/refresh tokens, password change, and password reset flow

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (Expo SDK 56), TypeScript |
| State | React Query (TanStack Query) |
| Backend | Python 3.12, FastAPI |
| Database | PostgreSQL 16 |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| Auth | JWT (access + refresh + reset tokens), bcrypt |
| Containers | Docker + Docker Compose |
| Testing | pytest + httpx |
| Linting | Ruff, Black, mypy |

---

## Architecture

### Backend

Layered repository pattern — each layer has a single responsibility:

```
Request → Router → Service → Repository → Database
          (HTTP)   (rules)    (SQL)
```

- **`app/api/v1/`** — Route definitions, request validation, response formatting
- **`app/services/`** — Business logic: scheduling, streak calculations, DO/AVOID rules, stat aggregation
- **`app/repositories/`** — Database queries, nothing else
- **`app/models/`** — SQLAlchemy ORM models
- **`app/schemas/`** — Pydantic models for request/response shapes

### Mobile

```
Screen → React Query hook → API endpoint function → apiFetch (JWT-managed)
```

- **`mobile/src/screens/`** — Full-screen views (Today, Stats, Settings, Habit Detail, etc.)
- **`mobile/src/components/`** — Reusable UI: habit rows, status buttons, heatmaps, navigation, form controls
- **`mobile/src/api/`** — Typed endpoint functions, React Query hooks, optimistic update logic
- **`mobile/src/auth/`** — Auth context with secure token storage

---

## API Endpoints

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Get access + refresh tokens |
| POST | `/api/v1/auth/refresh` | Refresh an expired access token |
| GET | `/api/v1/auth/me` | Current user |
| POST | `/api/v1/auth/change-password` | Update password (authenticated) |
| POST | `/api/v1/auth/forgot-password` | Request password reset |
| POST | `/api/v1/auth/reset-password` | Reset password with token |

### Habits
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/habits` | List all habits |
| POST | `/api/v1/habits` | Create a habit |
| PATCH | `/api/v1/habits/{id}` | Update a habit |
| DELETE | `/api/v1/habits/{id}` | Delete a habit |
| GET | `/api/v1/habits/today` | All habits due today with status |
| POST | `/api/v1/habits/{id}/log` | Log a habit (with optional amount) |
| DELETE | `/api/v1/habits/{id}/log` | Remove a log entry |
| GET | `/api/v1/habits/{id}/stats` | Streak, completion rate, history |

### Calendar
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/calendar/weekly` | 7-day status bars for all habits |
| GET | `/api/v1/calendar/monthly` | Per-habit month grid |
| GET | `/api/v1/calendar/yearly` | Year overview |

### Stats
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/stats/overview` | Aggregate stats across all habits |
| GET | `/api/v1/stats/trends` | Time-series data for selected habits |

### Other
| Method | Path | Description |
|---|---|---|
| CRUD | `/api/v1/categories` | Habit categories |
| CRUD | `/api/v1/routines` | Routine management |
| CRUD | `/api/v1/vacations` | Vacation periods |
| GET | `/api/v1/health` | Health check |

---

## Data Model

```
User
 ├── Habit (mode, frequency, target, schedule, section, color, unit)
 │    ├── HabitLog (date, amount)
 │    └── Tag (many-to-many)
 ├── Category
 ├── Routine
 │    ├── RoutineHabit (ordered habit list)
 │    └── RoutineSession (completion log)
 └── VacationPeriod (start_date, end_date)
```

---

## Running Locally

### Prerequisites
- Docker + Docker Compose
- Node.js 18+
- Expo CLI (`npx expo`)

### Start the backend

```bash
docker compose up --build
```

API at `http://localhost:8000` — Swagger docs at `http://localhost:8000/docs`

### Run migrations

```bash
docker compose exec api alembic upgrade head
```

### Start the mobile app

```bash
cd mobile
npm install
npx expo start
```

Press `a` for Android emulator or scan the QR code with Expo Go.

### Run tests

```bash
docker compose exec api pytest
```

### Environment variables

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `APP_ENV` | `development` or `production` |
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | Secret for signing JWTs — change in production |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime (default: 15) |
| `REFRESH_TOKEN_EXPIRE_MINUTES` | Refresh token lifetime (default: 7 days) |
| `CORS_ORIGINS` | Comma-separated allowed origins |

---

## Future Plans

- Email delivery for password reset flow
- Interval-based habit scheduling (every N days/weeks)
- AI-generated habit insights based on log history
- Notification reminders
