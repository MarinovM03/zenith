from pydantic import BaseModel


class IssPosition(BaseModel):
    latitude: float
    longitude: float
    altitude_km: float
    velocity_kph: float
    visibility: str
    timestamp: int
