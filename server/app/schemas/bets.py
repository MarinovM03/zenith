from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.schemas.fixtures import FixtureResponse
from app.services.bet_evaluator import Leg


class CreateBetRequest(BaseModel):
    stake: Decimal | None = Field(default=None, ge=0)
    odds: Decimal | None = Field(default=None, ge=1)
    legs: list[Leg] = Field(min_length=1, max_length=20)


class BetLegResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    fixture_id: int
    kind: str
    params: dict
    status: str
    fixture: FixtureResponse


class BetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: str
    stake: Decimal | None
    odds: Decimal | None
    created_at: datetime
    legs: list[BetLegResponse]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def potential_return(self) -> Decimal | None:
        if self.stake is None or self.odds is None:
            return None
        return (self.stake * self.odds).quantize(Decimal("0.01"))
