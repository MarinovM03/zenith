from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.favourite import FavouriteRepository
from app.services.auth import create_access_token, hash_password


@pytest_asyncio.fixture
async def auth_headers(db_session: AsyncSession) -> dict[str, str]:
    user = User(email="fav@test.com", hashed_password=hash_password("password123"))
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest.mark.asyncio
async def test_list_requires_auth(client: AsyncClient) -> None:
    response = await client.get("/favourites")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_add_then_list(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    body = {"kind": "apod", "ref_id": "2026-06-06", "payload": {"title": "The Hydra Cluster"}}
    added = await client.post("/favourites", json=body, headers=auth_headers)
    assert added.status_code == 201
    assert added.json()["ref_id"] == "2026-06-06"

    listed = await client.get("/favourites", headers=auth_headers)
    assert listed.status_code == 200
    items = listed.json()
    assert len(items) == 1
    assert items[0]["kind"] == "apod"
    assert items[0]["payload"]["title"] == "The Hydra Cluster"


@pytest.mark.asyncio
async def test_add_is_idempotent(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    body = {"kind": "launch", "ref_id": "abc-123", "payload": {}}
    await client.post("/favourites", json=body, headers=auth_headers)
    await client.post("/favourites", json=body, headers=auth_headers)

    listed = await client.get("/favourites", headers=auth_headers)
    assert len(listed.json()) == 1


@pytest.mark.asyncio
async def test_remove(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    body = {"kind": "apod", "ref_id": "2026-06-06", "payload": {}}
    await client.post("/favourites", json=body, headers=auth_headers)

    removed = await client.delete(
        "/favourites", params={"kind": "apod", "ref_id": "2026-06-06"}, headers=auth_headers
    )
    assert removed.status_code == 204

    listed = await client.get("/favourites", headers=auth_headers)
    assert listed.json() == []


@pytest.mark.asyncio
async def test_invalid_kind_rejected(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    response = await client.post(
        "/favourites", json={"kind": "nonsense", "ref_id": "x", "payload": {}}, headers=auth_headers
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_repository_isolates_users(db_session: AsyncSession) -> None:
    repo = FavouriteRepository(db_session)
    user_a, user_b = uuid4(), uuid4()

    await repo.add(user_a, "apod", "2026-06-06", {"title": "A"})
    assert len(await repo.list_for_user(user_a)) == 1
    assert await repo.list_for_user(user_b) == []

    await repo.remove(user_b, "apod", "2026-06-06")
    assert len(await repo.list_for_user(user_a)) == 1
