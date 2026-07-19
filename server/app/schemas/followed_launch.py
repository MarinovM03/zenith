from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class FollowedLaunchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    launch_id: str
    name: str
    net: datetime
    status_name: str
    status_abbrev: str
    provider: str | None
    image: str | None
    created_at: datetime
    updated_at: datetime
