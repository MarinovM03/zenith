from datetime import datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import JSON, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.fixture import Fixture


class BetStatus(str, Enum):
    PENDING = "pending"
    WON = "won"
    LOST = "lost"
    VOID = "void"


class LegStatus(str, Enum):
    PENDING = "pending"
    WON = "won"
    LOST = "lost"
    VOID = "void"


class Bet(Base):
    __tablename__ = "bets"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=BetStatus.PENDING.value)
    stake: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    odds: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    legs: Mapped[list["BetLeg"]] = relationship(
        back_populates="bet",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class BetLeg(Base):
    __tablename__ = "bet_legs"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    bet_id: Mapped[UUID] = mapped_column(
        ForeignKey("bets.id", ondelete="CASCADE"), index=True, nullable=False
    )
    fixture_id: Mapped[int] = mapped_column(ForeignKey("fixtures.id"), index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    params: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=LegStatus.PENDING.value)

    bet: Mapped[Bet] = relationship(back_populates="legs")
    fixture: Mapped[Fixture] = relationship(lazy="joined")
