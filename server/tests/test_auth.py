from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest
from httpx import AsyncClient

from app.core.config import get_settings

VALID_EMAIL = "martin@example.com"
VALID_PASSWORD = "correct-horse-battery-staple"


async def _register(
    client: AsyncClient, email: str = VALID_EMAIL, password: str = VALID_PASSWORD
) -> dict:
    response = await client.post("/auth/register", json={"email": email, "password": password})
    assert response.status_code == 201, response.text
    return response.json()


async def _login(
    client: AsyncClient, email: str = VALID_EMAIL, password: str = VALID_PASSWORD
) -> dict:
    response = await client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()


class TestRegister:
    @pytest.mark.asyncio
    async def test_success(self, client: AsyncClient) -> None:
        body = await _register(client)
        assert body["email"] == VALID_EMAIL
        assert body["subscription_tier"] == "free"
        assert "id" in body
        assert "created_at" in body
        assert "hashed_password" not in body

    @pytest.mark.asyncio
    async def test_lowercases_email(self, client: AsyncClient) -> None:
        body = await _register(client, email="MARTIN@Example.com")
        assert body["email"] == "martin@example.com"

    @pytest.mark.asyncio
    async def test_duplicate_email_returns_409(self, client: AsyncClient) -> None:
        await _register(client)
        response = await client.post(
            "/auth/register", json={"email": VALID_EMAIL, "password": VALID_PASSWORD}
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_invalid_email_returns_422(self, client: AsyncClient) -> None:
        response = await client.post(
            "/auth/register", json={"email": "not-an-email", "password": VALID_PASSWORD}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_short_password_returns_422(self, client: AsyncClient) -> None:
        response = await client.post(
            "/auth/register", json={"email": VALID_EMAIL, "password": "short"}
        )
        assert response.status_code == 422


class TestLogin:
    @pytest.mark.asyncio
    async def test_success_returns_access_token_and_refresh_cookie(
        self, client: AsyncClient
    ) -> None:
        await _register(client)
        response = await client.post(
            "/auth/login", json={"email": VALID_EMAIL, "password": VALID_PASSWORD}
        )
        assert response.status_code == 200
        body = response.json()
        assert body["token_type"] == "bearer"
        assert body["access_token"]
        assert "zenith_refresh" in response.cookies

    @pytest.mark.asyncio
    async def test_wrong_password_returns_401(self, client: AsyncClient) -> None:
        await _register(client)
        response = await client.post(
            "/auth/login", json={"email": VALID_EMAIL, "password": "wrong-password"}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_unknown_email_returns_same_401(self, client: AsyncClient) -> None:
        response = await client.post(
            "/auth/login",
            json={"email": "nobody@example.com", "password": VALID_PASSWORD},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "invalid credentials"


class TestMe:
    @pytest.mark.asyncio
    async def test_with_valid_token(self, client: AsyncClient) -> None:
        await _register(client)
        token = (await _login(client))["access_token"]
        response = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        assert response.json()["email"] == VALID_EMAIL

    @pytest.mark.asyncio
    async def test_without_token_returns_401(self, client: AsyncClient) -> None:
        response = await client.get("/auth/me")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_with_invalid_token_returns_401(self, client: AsyncClient) -> None:
        response = await client.get("/auth/me", headers={"Authorization": "Bearer garbage"})
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_token_rejected_as_access(self, client: AsyncClient) -> None:
        await _register(client)
        await _login(client)
        refresh_cookie = client.cookies.get("zenith_refresh")
        assert refresh_cookie is not None
        response = await client.get(
            "/auth/me", headers={"Authorization": f"Bearer {refresh_cookie}"}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_expired_token_returns_401(self, client: AsyncClient) -> None:
        settings = get_settings()
        expired = jwt.encode(
            {
                "sub": str(uuid4()),
                "type": "access",
                "exp": int((datetime.now(UTC) - timedelta(minutes=1)).timestamp()),
            },
            settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
        )
        response = await client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"})
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_token_without_expiration_returns_401(self, client: AsyncClient) -> None:
        settings = get_settings()
        token = jwt.encode(
            {
                "sub": str(uuid4()),
                "type": "access",
                "iat": int(datetime.now(UTC).timestamp()),
            },
            settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
        )
        response = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401


class TestRefresh:
    @pytest.mark.asyncio
    async def test_success_returns_new_access(self, client: AsyncClient) -> None:
        await _register(client)
        await _login(client)
        response = await client.post("/auth/refresh")
        assert response.status_code == 200
        assert response.json()["access_token"]

    @pytest.mark.asyncio
    async def test_without_cookie_returns_401(self, client: AsyncClient) -> None:
        response = await client.post("/auth/refresh")
        assert response.status_code == 401


class TestLogout:
    @pytest.mark.asyncio
    async def test_clears_refresh_cookie(self, client: AsyncClient) -> None:
        await _register(client)
        await _login(client)
        assert client.cookies.get("zenith_refresh") is not None
        response = await client.post("/auth/logout")
        assert response.status_code == 204
        set_cookie = response.headers.get("set-cookie", "")
        assert "zenith_refresh=" in set_cookie
