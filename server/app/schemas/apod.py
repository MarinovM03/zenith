from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class Apod(BaseModel):
    date: date
    title: str
    explanation: str
    url: str
    hdurl: str | None = None
    media_type: Literal["image", "video"]
    copyright: str | None = None
    thumbnail_url: str | None = Field(
        default=None,
        description="For video APODs, NASA provides a thumbnail when thumbs=True is requested.",
    )
