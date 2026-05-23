"""管理 Bitfinex 账号的 CRUD 接口（admin-only）。"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.core.encryption import decrypt, encrypt
from app.db.session import get_db
from app.models.bitfinex_account import BitfinexAccount
from app.models.user import User
from app.schemas.bitfinex import (
    BitfinexAccountCreate,
    BitfinexAccountOut,
    BitfinexAccountUpdate,
)

router = APIRouter(prefix="/admin/bitfinex-accounts", tags=["admin"])


def _to_out(account: BitfinexAccount) -> BitfinexAccountOut:
    key_plain = decrypt(account.api_key_encrypted)
    masked = f"{'*' * max(0, len(key_plain) - 4)}{key_plain[-4:]}" if key_plain else ""
    return BitfinexAccountOut(
        id=account.id,
        label=account.label,
        api_key_masked=masked,
        active=account.active,
        created_at=account.created_at,
        updated_at=account.updated_at,
    )


@router.get("", response_model=list[BitfinexAccountOut])
def list_accounts(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> list[BitfinexAccountOut]:
    return [_to_out(a) for a in db.query(BitfinexAccount).order_by(BitfinexAccount.id).all()]


@router.post("", response_model=BitfinexAccountOut, status_code=status.HTTP_201_CREATED)
def create_account(
    payload: BitfinexAccountCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> BitfinexAccountOut:
    account = BitfinexAccount(
        label=payload.label,
        api_key_encrypted=encrypt(payload.api_key),
        api_secret_encrypted=encrypt(payload.api_secret),
        active=True,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return _to_out(account)


@router.patch("/{account_id}", response_model=BitfinexAccountOut)
def update_account(
    account_id: int,
    payload: BitfinexAccountUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> BitfinexAccountOut:
    account = db.get(BitfinexAccount, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if payload.label is not None:
        account.label = payload.label
    if payload.active is not None:
        account.active = payload.active
    db.commit()
    db.refresh(account)
    return _to_out(account)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> None:
    account = db.get(BitfinexAccount, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(account)
    db.commit()
