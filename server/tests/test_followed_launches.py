from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.followed_launch import FollowedLaunchRepository


async def _create_user(db_session: AsyncSession, email: str) -> User:
    user = User(email=email, hashed_password="test-hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_repository_upserts_launch_snapshot(db_session: AsyncSession) -> None:
    user = await _create_user(db_session, "follower@test.com")
    repository = FollowedLaunchRepository(db_session)

    followed = await repository.add_or_update(
        user.id,
        launch_id="launch-1",
        name="Artemis II",
        net=datetime(2026, 9, 1, 12, tzinfo=UTC),
        status_name="To Be Confirmed",
        status_abbrev="TBC",
        provider="NASA",
        image="https://images.test/artemis.jpg",
    )
    updated = await repository.add_or_update(
        user.id,
        launch_id="launch-1",
        name="Artemis II",
        net=datetime(2026, 9, 2, 14, tzinfo=UTC),
        status_name="Go for Launch",
        status_abbrev="Go",
        provider="NASA",
        image="https://images.test/artemis.jpg",
    )

    items = await repository.list_for_user(user.id)
    assert len(items) == 1
    assert updated.id == followed.id
    assert items[0].net.day == 2
    assert items[0].status_abbrev == "Go"


@pytest.mark.asyncio
async def test_repository_isolates_launches_by_user(db_session: AsyncSession) -> None:
    user_a = await _create_user(db_session, "follower-a@test.com")
    user_b = await _create_user(db_session, "follower-b@test.com")
    repository = FollowedLaunchRepository(db_session)
    launch = {
        "launch_id": "shared-launch",
        "name": "Shared mission",
        "net": datetime(2026, 10, 1, 10, tzinfo=UTC),
        "status_name": "Go for Launch",
        "status_abbrev": "Go",
        "provider": "Example provider",
        "image": None,
    }

    await repository.add_or_update(user_a.id, **launch)
    await repository.add_or_update(user_b.id, **launch)
    await repository.remove(user_b.id, "shared-launch")

    assert len(await repository.list_for_user(user_a.id)) == 1
    assert await repository.list_for_user(user_b.id) == []
