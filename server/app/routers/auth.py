from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_db
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.services.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    verify_password,
)

DbDep = Annotated[AsyncSession, Depends(get_db)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "acca_refresh"


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/auth",
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/5minutes")
async def register(
    request: Request,
    body: RegisterRequest,
    db: DbDep,
) -> User:
    repo = UserRepository(db)
    if await repo.get_by_email(body.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email already registered")
    return await repo.create(email=body.email, hashed_password=hash_password(body.password))


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/5minutes")
async def login(
    request: Request,
    response: Response,
    body: LoginRequest,
    db: DbDep,
) -> TokenResponse:
    user = await UserRepository(db).get_by_email(body.email)
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid credentials")
    _set_refresh_cookie(response, create_refresh_token(user.id))
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request) -> TokenResponse:
    cookie = request.cookies.get(REFRESH_COOKIE_NAME)
    if cookie is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="missing refresh token"
        )
    user_id = decode_token(cookie, "refresh")
    return TokenResponse(access_token=create_access_token(user_id))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/auth")


@router.get("/me", response_model=UserResponse)
async def me(current_user: CurrentUserDep) -> User:
    return current_user
