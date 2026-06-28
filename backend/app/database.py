import os
from collections.abc import Generator
from urllib.parse import quote_plus

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

load_dotenv()

database_url = os.getenv("DATABASE_URL")

if database_url is None:
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_host = os.getenv("DB_HOST")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "postgres")

    if all([db_user, db_password, db_host]):
        # Prevent special password characters such as @ or # from breaking the URL.
        encoded_password = quote_plus(db_password)
        database_url = (
            f"postgresql+psycopg2://{db_user}:{encoded_password}@{db_host}:{db_port}/{db_name}"
        )
    else:
        database_url = os.getenv("SQLITE_DATABASE_URL", "sqlite:///./flagsync.db")

engine_kwargs = {
    "pool_pre_ping": True,
}

if database_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    if database_url == "sqlite:///:memory:":
        engine_kwargs["poolclass"] = StaticPool


class Base(DeclarativeBase):
    pass


engine = create_engine(
    database_url,
    **engine_kwargs,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
