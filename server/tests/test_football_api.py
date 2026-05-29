from datetime import date

import httpx
import pytest

from app.services.football_api import APIFootballClient, APIFootballError


def _fixtures_payload(
    *,
    fixture_id: int = 1001,
    league_id: int = 39,
    league_name: str = "Premier League",
    home_team: tuple[int, str] = (33, "Manchester United"),
    away_team: tuple[int, str] = (34, "Newcastle"),
    status_short: str = "NS",
    home_goals: int | None = None,
    away_goals: int | None = None,
) -> dict:
    return {
        "errors": [],
        "response": [
            {
                "fixture": {
                    "id": fixture_id,
                    "date": "2026-05-28T15:00:00+00:00",
                    "status": {"short": status_short},
                },
                "league": {
                    "id": league_id,
                    "name": league_name,
                    "country": "England",
                    "logo": "https://example.com/logo.png",
                },
                "teams": {
                    "home": {"id": home_team[0], "name": home_team[1], "logo": None},
                    "away": {"id": away_team[0], "name": away_team[1], "logo": None},
                },
                "goals": {"home": home_goals, "away": away_goals},
            }
        ],
    }


def _mock_transport(handler) -> httpx.MockTransport:
    return httpx.MockTransport(handler)


@pytest.mark.asyncio
async def test_returns_parsed_fixtures_on_success() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/fixtures"
        assert request.url.params.get("league") == "39"
        assert request.url.params.get("season") == "2025"
        assert request.url.params.get("date") == "2026-05-28"
        assert request.headers["x-apisports-key"] == "secret"
        return httpx.Response(200, json=_fixtures_payload())

    http = httpx.AsyncClient(transport=_mock_transport(handler))
    client = APIFootballClient(
        base_url="https://v3.football.api-sports.io", api_key="secret", http_client=http
    )

    rows = await client.fixtures_by_league_and_date(
        league_id=39, season=2025, match_date=date(2026, 5, 28)
    )

    assert len(rows) == 1
    assert rows[0].fixture.id == 1001
    assert rows[0].league.name == "Premier League"
    assert rows[0].teams.home.name == "Manchester United"
    assert rows[0].goals.home is None


@pytest.mark.asyncio
async def test_empty_response_returns_empty_list() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"errors": [], "response": []})

    http = httpx.AsyncClient(transport=_mock_transport(handler))
    client = APIFootballClient(
        base_url="https://v3.football.api-sports.io", api_key="secret", http_client=http
    )

    rows = await client.fixtures_by_league_and_date(
        league_id=39, season=2025, match_date=date(2026, 5, 28)
    )
    assert rows == []


@pytest.mark.asyncio
async def test_non_200_status_raises() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="boom")

    http = httpx.AsyncClient(transport=_mock_transport(handler))
    client = APIFootballClient(
        base_url="https://v3.football.api-sports.io", api_key="secret", http_client=http
    )

    with pytest.raises(APIFootballError):
        await client.fixtures_by_league_and_date(
            league_id=39, season=2025, match_date=date(2026, 5, 28)
        )


@pytest.mark.asyncio
async def test_error_in_body_raises() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json={"errors": {"plan": "subscription required"}, "response": []}
        )

    http = httpx.AsyncClient(transport=_mock_transport(handler))
    client = APIFootballClient(
        base_url="https://v3.football.api-sports.io", api_key="secret", http_client=http
    )

    with pytest.raises(APIFootballError):
        await client.fixtures_by_league_and_date(
            league_id=39, season=2025, match_date=date(2026, 5, 28)
        )


@pytest.mark.asyncio
async def test_no_api_key_returns_empty_without_calling() -> None:
    called = False

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal called
        called = True
        return httpx.Response(200, json={"errors": [], "response": []})

    http = httpx.AsyncClient(transport=_mock_transport(handler))
    client = APIFootballClient(
        base_url="https://v3.football.api-sports.io", api_key="", http_client=http
    )

    rows = await client.fixtures_by_league_and_date(
        league_id=39, season=2025, match_date=date(2026, 5, 28)
    )
    assert rows == []
    assert called is False
