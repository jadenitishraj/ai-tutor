"""
JWT decoding & auth dependencies
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from bson import ObjectId

from ..config import get_settings
from ..database import get_db

logger = logging.getLogger(__name__)

# Note: Even though we don't have a direct password login, we use this to get the token out of the header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    settings = get_settings()
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    settings = get_settings()
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        # Some frontend passes token in query param or localStorage, but typical is Bearer header
        raise credentials_exception

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError as e:
        logger.error(f"JWT decode error: {e}")
        raise credentials_exception
        
    db = get_db()
    
    # Support fake ID for static admin or normal ObjectIDs
    if user_id == "static_admin_id" or user_id == "000000000000000000000001":
        return str(user_id)
        
    if not ObjectId.is_valid(user_id):
        raise credentials_exception
        
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise credentials_exception
        
    return str(user["_id"])
