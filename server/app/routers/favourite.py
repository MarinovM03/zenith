from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.favourite import Favourite
from app.models.user import User
from app.repositories.favourite import FavouriteRepository
from app.schemas.favourite import FavouriteCreate, FavouriteResponse
from app.services.auth import get_current_user

DbDep = Annotated[AsyncSession, Depends(get_db)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]

router = APIRouter(prefix="/favourites", tags=["favourites"])


@router.get("", response_model=list[FavouriteResponse])
async def list_favourites(current_user: CurrentUserDep, db: DbDep) -> list[Favourite]:
    return await FavouriteRepository(db).list_for_user(current_user.id)


@router.post("", response_model=FavouriteResponse, status_code=status.HTTP_201_CREATED)
async def add_favourite(
    body: FavouriteCreate, current_user: CurrentUserDep, db: DbDep
) -> Favourite:
    return await FavouriteRepository(db).add(current_user.id, body.kind, body.ref_id, body.payload)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favourite(
    current_user: CurrentUserDep,
    db: DbDep,
    kind: Annotated[str, Query()],
    ref_id: Annotated[str, Query()],
) -> None:
    await FavouriteRepository(db).remove(current_user.id, kind, ref_id)
