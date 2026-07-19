from collections.abc import AsyncIterator
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.main import app
from app.models.user import User
from app.routers.launch import get_launch_service
from app.schemas.launch import Launch, LaunchStatus
from app.services.auth import create_access_token, hash_password
from app.services.launch import LaunchService


def _launch(*, net: datetime | None = None, status_abbrev: str = "TBC") -> Launch:
    return Launch(
        id="launch-1",
        name="Artemis II",
        status=LaunchStatus(name="To Be Confirmed", abbrev=status_abbrev),
        net=net or datetime(2026, 9, 1, 12, tzinfo=UTC),
        provider="NASA",
        image="https://images.test/artemis.jpg",
    )


@pytest_asyncio.fixture
async def followed_client(
    db_session: AsyncSession,
) -> AsyncIterator[tuple[AsyncClient, dict[str, str], AsyncMock]]:
    user = User(email="following@test.com", hashed_password=hash_password("password123"))
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    async def override_get_db() -> AsyncIterator[AsyncSession]:
        yield db_session

    launch_service = AsyncMock(spec=LaunchService)
    launch_service.get_detail.return_value = _launch()
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_launch_service] = lambda: launch_service
    headers = {"Authorization": f"Bearer {create_access_token(user.id)}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client, headers, launch_service

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_routes_require_authentication(followed_client: tuple) -> None:
    client, _, _ = followed_client
    response = await client.get("/followed-launches")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_follow_list_update_and_unfollow(
    followed_client: tuple[AsyncClient, dict[str, str], AsyncMock],
) -> None:
    client, headers, launch_service = followed_client

    followed = await client.put("/followed-launches/launch-1", headers=headers)
    assert followed.status_code == 200
    assert followed.json()["launch_id"] == "launch-1"
    assert followed.json()["provider"] == "NASA"

    launch_service.get_detail.return_value = _launch(
        net=datetime(2026, 9, 2, 14, tzinfo=UTC), status_abbrev="Go"
    )
    updated = await client.put("/followed-launches/launch-1", headers=headers)
    assert updated.status_code == 200
    assert updated.json()["status_abbrev"] == "Go"

    listed = await client.get("/followed-launches", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["net"].startswith("2026-09-02T14:00:00")

    removed = await client.delete("/followed-launches/launch-1", headers=headers)
    assert removed.status_code == 204
    assert (await client.get("/followed-launches", headers=headers)).json() == []
