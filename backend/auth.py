from datetime import datetime, timedelta, timezone
import os
import jwt
import bcrypt

# Pull security secrets from environment variable vectors cleanly for hosting safety fallbacks
SECRET_KEY = os.getenv("JWT_SECRET", "SUPER_LONG_RANDOM_SECRET_KEY_FOR_LOCAL_SECURITY_TOKENS")
ALGORITHM = "HS256"

def hash_password(password: str) -> str:
    """
    Convert plaintext to raw bytes, salt it, and secure hash 
    it back to a safe database storage string.
    """
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(pwd_bytes, salt)
    return hashed_password.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Safely compare standard client plain entry credentials 
    against storage hashed parameters signatures.
    """
    password_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)

def create_access_token(data: dict, expires_delta: timedelta = timedelta(hours=8)) -> str:
    """
    Forge unique timezone-aware authorization token strings
    for frontend application session management blocks.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)