from datetime import date

from pydantic import BaseModel


class MarsPhoto(BaseModel):
    id: str
    sol: int
    earth_date: date | None = None
    camera: str
    img_src: str
    full_src: str
    rover: str
