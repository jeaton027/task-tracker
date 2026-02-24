# Task Tracker

Backend API for tracking recurring habits and tasks.

## Goals
- Implement secure auth (register/login/logout + token refresh).
- Support full CRUD for categories, tags, items, and events.
- Add calendar views that summarize scheduled/success/fail totals.
- Enforce clear scheduling rules for `DO` and `AVOID` tracking modes.
- Keep the project production-style with migrations, tests, and Dockerized setup.

## Roadmap
1. Scaffold API + Docker + health checks.
2. Add DB foundation (SQLAlchemy + Alembic).
3. Add user model and auth flow.
4. Add categories and tags CRUD.
5. Add items CRUD and scheduling model.
6. Add events/check-ins routes.
7. Add calendar aggregation endpoints + indexes + tests.
8. Add filtering/pagination and docs polish.
9. Finalize README and deploy notes.
