import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Use DATABASE_URL from environment if available (for production like Render)
# Fallback to local SQLite file for local development
SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./crm.db")

# If it's a postgresql URL (some providers use postgres://, SQLAlchemy requires postgresql://)
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Only add check_same_thread for SQLite
connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

pool_kwargs = (
    {"pool_pre_ping": True, "pool_recycle": 300}
    if not SQLALCHEMY_DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args=connect_args, **pool_kwargs
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
