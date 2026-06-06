from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

FavouriteKind = Literal["apod", "launch", "mars", "asteroid"]


class FavouriteCreate(BaseModel):
    kind: FavouriteKind
    ref_id: str = Field(min_length=1, max_length=200)
    payload: dict[str, Any] = Field(default_factory=dict)


class FavouriteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: str
    ref_id: str
    payload: dict[str, Any]
    created_at: datetime
