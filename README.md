# FlagSync

FlagSync is a full-stack web app for discovering and managing CTF competitions and hackathons.

## Tech Stack

- Frontend: React, Vite, React Router
- Backend: FastAPI, SQLAlchemy, PostgreSQL
- Tooling: ESLint, Ruff, Pytest, Bandit, npm audit, pip-audit

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
```

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
