from datetime import date

from pydantic import BaseModel


class MarsPhoto(BaseModel):
    id: int
    sol: int
    earth_date: date
    camera: str
    camera_abbrev: str
    img_src: str
    rover: str
