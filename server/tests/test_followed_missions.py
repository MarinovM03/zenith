from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.followed_mission import FollowedMissionRepository


async def _create_user(db_session: AsyncSession, email: str) -> User:
    user = User(email=email, hashed_password="test-hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_repository_upserts_mission_snapshot(db_session: AsyncSession) -> None:
    user = await _create_user(db_session, "mission-follower@test.com")
    repository = FollowedMissionRepository(db_session)

    followed = await repository.add_or_update(
        user.id,
        mission_id=7678,
        name="Tianlian 2-06",
        description="A data relay mission.",
        launch_id="launch-1",
        launch_name="Long March 3B | Tianlian 2-06",
        net=datetime(2026, 9, 1, 12, tzinfo=UTC),
        provider="CASC",
        image=None,
    )
    updated = await repository.add_or_update(
        user.id,
        mission_id=7678,
        name="Tianlian 2-06",
        description="Updated mission description.",
        launch_id="launch-1",
        launch_name="Long March 3B | Tianlian 2-06",
        net=datetime(2026, 9, 2, 14, tzinfo=UTC),
        provider="CASC",
        image="https://images.test/tianlian.jpg",
    )

    items = await repository.list_for_user(user.id)
    assert len(items) == 1
    assert updated.id == followed.id
    assert items[0].net.day == 2
    assert items[0].description == "Updated mission description."
    assert items[0].image == "https://images.test/tianlian.jpg"


@pytest.mark.asyncio
async def test_repository_isolates_missions_by_user(db_session: AsyncSession) -> None:
    user_a = await _create_user(db_session, "mission-follower-a@test.com")
    user_b = await _create_user(db_session, "mission-follower-b@test.com")
    repository = FollowedMissionRepository(db_session)
    mission = {
        "mission_id": 7470,
        "name": "Flight 13",
        "description": "A Starship test flight.",
        "launch_id": "starship-flight-13",
        "launch_name": "Starship | Flight 13",
        "net": datetime(2026, 10, 1, 10, tzinfo=UTC),
        "provider": "SpaceX",
        "image": None,
    }

    await repository.add_or_update(user_a.id, **mission)
    await repository.add_or_update(user_b.id, **mission)
    await repository.remove(user_b.id, 7470)

    assert len(await repository.list_for_user(user_a.id)) == 1
    assert await repository.list_for_user(user_b.id) == []
