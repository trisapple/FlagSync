# FlagSync

FlagSync is a full-stack web app for discovering and managing CTF competitions and hackathons.

## Tech Stack

- Frontend: React, Vite, React Router
- Backend: FastAPI, SQLAlchemy, PostgreSQL
- Tooling: ESLint, Ruff, Pytest, Bandit, npm audit, pip-audit

## Security Features

- Passwords are hashed with Passlib using Argon2 or bcrypt.
- Login sessions are stored in HttpOnly JWT cookies.
- Failed login attempts are tracked with Redis and temporarily locked out.
- The backend bootstraps reference roles on startup and can seed an admin user from environment variables.

## Project Structure

```text
FlagSync/
├── frontend/      # React/Vite app
├── backend/       # FastAPI app
├── scripts/       # Local check scripts
└── .github/       # CI workflow
```

## Setup

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The frontend runs at `http://localhost:5173`.

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Fill in the database values in `backend/.env`:

```text
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=
DB_NAME=
SECRET_KEY=
REDIS_URL=
CTF_BOOTSTRAP_ADMIN_EMAIL=
CTF_BOOTSTRAP_ADMIN_PASSWORD=
```

If you skip the PostgreSQL settings during local development or tests, the backend
falls back to a local SQLite database at `backend/flagsync.db`.

Then start the API:

```bash
uvicorn app.main:app --reload
```

The backend runs at `http://localhost:8000`.

## Useful Commands

Run frontend checks:

```bash
cd frontend
npm run lint
npm run build
```

Run backend tests:

```bash
cd backend
pytest -q
```

Run all checks:

```bash
./scripts/check.sh
```

## API Health Checks

- `GET /` returns a basic backend status message
- `GET /api/health` checks that the API is running
- `GET /api/health/database` checks the database connection

## Notes

- Keep frontend environment values in `frontend/.env`.
- Keep backend database values in `backend/.env`.
- Do not commit local `.env` files.
