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
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
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