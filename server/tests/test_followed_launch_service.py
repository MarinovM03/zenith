from datetime import UTC, datetime
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.repositories.followed_launch import FollowedLaunchRepository
from app.schemas.launch import Launch, LaunchStatus
from app.services.followed_launch import FollowedLaunchService
from app.services.launch import LaunchService


def _launch() -> Launch:
    return Launch(
        id="launch-1",
        name="Artemis II",
        status=LaunchStatus(name="Go for Launch", abbrev="Go"),
        net=datetime(2026, 9, 1, 12, tzinfo=UTC),
        provider="NASA",
        image="https://images.test/artemis.jpg",
    )


@pytest.mark.asyncio
async def test_follow_validates_launch_and_persists_normalised_snapshot() -> None:
    user_id = uuid4()
    launch = _launch()
    repository = AsyncMock(spec=FollowedLaunchRepository)
    launch_service = AsyncMock(spec=LaunchService)
    launch_service.get_detail.return_value = launch
    expected = repository.add_or_update.return_value
    service = FollowedLaunchService(repository, launch_service)

    result = await service.follow(user_id, launch.id)

    assert result is expected
    launch_service.get_detail.assert_awaited_once_with(launch.id)
    repository.add_or_update.assert_awaited_once_with(
        user_id,
        launch_id=launch.id,
        name=launch.name,
        net=launch.net,
        status_name=launch.status.name,
        status_abbrev=launch.status.abbrev,
        provider=launch.provider,
        image=launch.image,
    )


@pytest.mark.asyncio
async def test_list_and_unfollow_delegate_with_user_ownership() -> None:
    user_id = uuid4()
    repository = AsyncMock(spec=FollowedLaunchRepository)
    launch_service = AsyncMock(spec=LaunchService)
    repository.list_for_user.return_value = []
    service = FollowedLaunchService(repository, launch_service)

    assert await service.list_for_user(user_id) == []
    await service.unfollow(user_id, "launch-1")

    repository.list_for_user.assert_awaited_once_with(user_id)
    repository.remove.assert_awaited_once_with(user_id, "launch-1")
