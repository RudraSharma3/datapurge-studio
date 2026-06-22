import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# ── DYNAMIC ENVIRONMENT CONNECTION OVERRIDES ──
# Pull live cloud credentials from system parameters, or fall back to your local setup
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://datapurge_admin:postgres@localhost:5432/datapurge_db"
)

# Render or Heroku connection keys sometimes output 'postgres://' which crashes SQLAlchemy 1.4+
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# ── FIXED DATABASE CONNECTION MANAGEMENT FOR NEON SERVERLESS ──
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,     # Forces SQLAlchemy to verify the connection is alive right before running SQL
    pool_recycle=300,       # Automatically recycles connection socks older than 5 minutes
    pool_size=5,            # Keeps the connection footprint low for Render free tiers
    max_overflow=10
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """
    Dependency injector to spin up and cleanly teardown database 
    connections per operational API call loop.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()