from sqlalchemy import Column, Integer, String, Text, DateTime, func
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="user", nullable=False) 
    
    # ── FIXED DATETIME CALLABLE LIFECYCLE HOOKS ──
    # Using server_default ensures database-side native clock evaluations
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Inquiry(Base):
    __tablename__ = "inquiries"
    
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    
    # ── FIXED DATETIME CALLABLE LIFECYCLE HOOKS ──
    created_at = Column(DateTime(timezone=True), server_default=func.now())