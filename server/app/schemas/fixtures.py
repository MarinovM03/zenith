from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LeagueSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    country: str
    logo_url: str | None


class TeamSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    logo_url: str | None


class FixtureResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    external_id: int
    league: LeagueSummary
    home_team: TeamSummary
    away_team: TeamSummary
    kickoff_at: datetime
    status: str
    home_goals: int | None
    away_goals: int | None
