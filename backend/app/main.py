from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.roles import router as roles_router

app = FastAPI(
    title="FlagSync API",
    description="Backend API for the FlagSync platform",
    version="0.1.0",
)

# Allows the local React/Vite frontend to call this backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(roles_router)


@app.get("/")
def root():
    return {"message": "FlagSync backend is running"}


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "flagsync-api",
    }


@app.get("/api/health/database")
def database_health_check(
    db: Session = Depends(get_db),
):
    try:
        db.execute(text("SELECT 1"))

        return {
            "status": "healthy",
            "database": "connected",
        }

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Database connection unavailable",
        )
