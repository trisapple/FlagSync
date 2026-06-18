#!/usr/bin/env bash

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "================================"
echo "Running frontend checks"
echo "================================"

cd "$PROJECT_ROOT/frontend"

echo "Running ESLint..."
npm run lint

echo "Building frontend..."
npm run build

echo "Checking frontend dependencies..."
npm audit --audit-level=high

echo
echo "================================"
echo "Running backend checks"
echo "================================"

cd "$PROJECT_ROOT/backend"

if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
fi

echo "Running Ruff linting..."
ruff check .

echo "Checking Ruff formatting..."
ruff format --check .

echo "Running backend tests..."
pytest -q

echo "Running Bandit security scan..."
bandit -r app -x tests

echo "Checking backend dependencies..."
pip-audit -r requirements.txt

echo
echo "================================"
echo "All checks passed successfully"
echo "================================"