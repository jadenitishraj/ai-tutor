import logging
from fastapi import APIRouter, Request, HTTPException, status
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth, OAuthError

from ..config import get_settings
from ..database import get_db
from ..utils.auth import create_access_token

logger = logging.getLogger(__name__)
router = APIRouter()

oauth = OAuth()

# We register the Google OAuth client lazily inside a startup event 
# or directly by defining it since config is available.
def init_oauth():
    settings = get_settings()
    oauth.register(
        name='google',
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        client_kwargs={
            'scope': 'openid email profile'
        }
    )

init_oauth()

@router.get("/login")
async def login(request: Request):
    """Initiates Google OAuth flow."""
    redirect_uri = request.url_for('auth_callback')
    return await oauth.google.authorize_redirect(request, str(redirect_uri))

@router.get("/callback/google", name="auth_callback")
async def auth_callback(request: Request):
    """Callback triggered by Google after user consents."""
    try:
        token = await oauth.google.authorize_access_token(request)
    except OAuthError as error:
        logger.error(f"OAuth Error: {error.error}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not authenticate with Google",
        )
        
    user = token.get('userinfo')
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User info missing from Google"
        )
        
    db = get_db()
    email = user.get("email")
    name = user.get("name")
    
    # Check if user exists in the traditional `users` collection
    doc = await db["users"].find_one({"Email": email})
    if not doc:
        # Create a new user mapping standard fields
        result = await db["users"].insert_one({
            "Email": email,
            "Name": name,
            "Role": "user" # Default role
        })
        user_id = str(result.inserted_id)
    else:
        user_id = str(doc["_id"])
        
    # Generate our JWT access token
    jwt_token = create_access_token(data={"sub": user_id})
    
    settings = get_settings()
    frontend_url = settings.frontend_url
    
    # Redirect back to the frontend with the token in the URL query.
    # The frontend will grab it and store it in localStorage.
    return RedirectResponse(url=f"{frontend_url}/?token={jwt_token}")
