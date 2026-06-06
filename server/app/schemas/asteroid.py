from pydantic import BaseModel


class Asteroid(BaseModel):
    id: str
    name: str
    hazardous: bool
    diameter_min_m: float
    diameter_max_m: float
    approach_date: str
    miss_distance_km: float
    miss_distance_lunar: float
    velocity_kps: float
