from datetime import datetime

from pydantic import BaseModel


class LaunchStatus(BaseModel):
    name: str
    abbrev: str


class Launch(BaseModel):
    id: str
    name: str
    status: LaunchStatus
    net: datetime
    provider: str | None = None
    rocket: str | None = None
    mission: str | None = None
    mission_description: str | None = None
    pad: str | None = None
    location: str | None = None
    image: str | None = None
    webcast_url: str | None = None
