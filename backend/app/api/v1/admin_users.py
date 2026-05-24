"""管理员用户管理接口（admin-only）。"""

from datetime import UTC, datetime, time
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, aliased

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models.daily_nav import DailyNav
from app.models.share_transaction import ShareChangeType, ShareTransaction
from app.models.user import User
from app.schemas.admin_users import (
    AdjustRequest,
    TransactionRow,
    TransactionsPage,
    UserListRow,
    UsersListResponse,
)

router = APIRouter(prefix="/admin/users", tags=["admin"])

DEFAULT_NAV = Decimal("1.0")


def _current_nav(db: Session) -> Decimal:
    nav = db.query(DailyNav.final_nav).order_by(DailyNav.date.desc()).first()
    return Decimal(nav[0]) if nav else DEFAULT_NAV


def _user_shares(db: Session, user_id: int) -> Decimal:
    total = db.scalar(
        select(func.coalesce(func.sum(ShareTransaction.change_amount), Decimal(0))).where(
            ShareTransaction.user_id == user_id
        )
    )
    return Decimal(total or 0)


@router.get("", response_model=UsersListResponse)
def list_users(
    search: str = Query(default="", max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> UsersListResponse:
    shares_subq = (
        select(
            ShareTransaction.user_id.label("user_id"),
            func.coalesce(func.sum(ShareTransaction.change_amount), Decimal(0)).label("shares"),
            func.max(ShareTransaction.created_at).label("last_change_at"),
        )
        .group_by(ShareTransaction.user_id)
        .subquery()
    )

    stmt = select(
        User,
        func.coalesce(shares_subq.c.shares, Decimal(0)).label("shares"),
        shares_subq.c.last_change_at,
    ).outerjoin(shares_subq, User.id == shares_subq.c.user_id)

    if search:
        like = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.email).like(like),
                func.lower(func.coalesce(User.name, "")).like(like),
            )
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.execute(
        stmt.order_by(User.id).offset((page - 1) * page_size).limit(page_size)
    ).all()

    nav = _current_nav(db)
    items = [
        UserListRow(
            id=u.id,
            email=u.email,
            name=u.name,
            role=u.role,
            shares=Decimal(shares),
            valuation=Decimal(shares) * nav,
            last_change_at=last_change_at,
        )
        for u, shares, last_change_at in rows
    ]
    return UsersListResponse(
        items=items, total=total, page=page, page_size=page_size, current_nav=nav
    )


@router.post("/{user_id}/shares", response_model=UserListRow, status_code=status.HTTP_201_CREATED)
def adjust_shares(
    user_id: int,
    payload: AdjustRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> UserListRow:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    delta = payload.change_amount
    if delta == 0:
        raise HTTPException(status_code=400, detail="change_amount must be non-zero")

    if payload.effective_date is not None and payload.effective_date > datetime.now(UTC).date():
        raise HTTPException(status_code=400, detail="生效日期不能是未来日期")

    current = _user_shares(db, user_id)
    new_shares = current + delta
    if new_shares < 0:
        raise HTTPException(
            status_code=400,
            detail=f"调整后份额会变负（{current} + {delta} = {new_shares}）。拒绝。",
        )

    change_type = (
        ShareChangeType.admin_grant.value if delta > 0 else ShareChangeType.admin_revoke.value
    )
    tx = ShareTransaction(
        user_id=user_id,
        change_amount=delta,
        change_type=change_type,
        reason=f"[{payload.type}] {payload.reason.strip()}",
        operator_id=current_admin.id,
        related_date=None,
    )
    # 指定了生效日期就覆盖 created_at（pipeline 按 created_at 判定份额何时生效）；
    # 不填则走 server_default=now()。
    if payload.effective_date is not None:
        tx.created_at = datetime.combine(payload.effective_date, time.min, tzinfo=UTC)
    db.add(tx)
    db.commit()

    nav = _current_nav(db)
    return UserListRow(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        shares=new_shares,
        valuation=new_shares * nav,
        last_change_at=db.scalar(
            select(func.max(ShareTransaction.created_at)).where(
                ShareTransaction.user_id == user_id
            )
        ),
    )


@router.get("/{user_id}/transactions", response_model=TransactionsPage)
def list_transactions(
    user_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> TransactionsPage:
    if not db.get(User, user_id):
        raise HTTPException(status_code=404, detail="User not found")

    total = db.scalar(
        select(func.count(ShareTransaction.id)).where(ShareTransaction.user_id == user_id)
    ) or 0

    Operator = aliased(User)  # noqa: N806  (SQLAlchemy aliased-class convention)
    rows = db.execute(
        select(ShareTransaction, Operator.email.label("operator_email"))
        .outerjoin(Operator, Operator.id == ShareTransaction.operator_id)
        .where(ShareTransaction.user_id == user_id)
        .order_by(ShareTransaction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = [
        TransactionRow(
            id=tx.id,
            change_amount=Decimal(tx.change_amount),
            change_type=tx.change_type,
            reason=tx.reason,
            operator_email=op_email,
            related_date=tx.related_date,
            created_at=tx.created_at,
        )
        for tx, op_email in rows
    ]
    return TransactionsPage(items=items, total=total, page=page, page_size=page_size)
