from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.bets import BetResponse, CreateBetRequest
from app.services.auth import get_current_user
from app.services.bets import BetService

DbDep = Annotated[AsyncSession, Depends(get_db)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]

router = APIRouter(prefix="/bets", tags=["bets"])


@router.post("", response_model=BetResponse, status_code=status.HTTP_201_CREATED)
async def create_bet(
    current_user: CurrentUserDep,
    db: DbDep,
    body: CreateBetRequest,
) -> BetResponse:
    bet = await BetService(db).create_bet(user_id=current_user.id, request=body)
    return BetResponse.model_validate(bet)


@router.get("", response_model=list[BetResponse])
async def list_bets(current_user: CurrentUserDep, db: DbDep) -> list[BetResponse]:
    bets = await BetService(db).list_bets(user_id=current_user.id)
    return [BetResponse.model_validate(b) for b in bets]


@router.get("/{bet_id}", response_model=BetResponse)
async def get_bet(current_user: CurrentUserDep, db: DbDep, bet_id: UUID) -> BetResponse:
    bet = await BetService(db).get_bet(bet_id=bet_id, user_id=current_user.id)
    return BetResponse.model_validate(bet)
