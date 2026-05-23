"""Pipeline 触发 + 状态查询接口（admin-only）。"""

import logging
from datetime import UTC, datetime, timedelta
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models.daily_nav import DailyNav
from app.models.user import User
from app.schemas.pipeline import DailyNavOut, PipelineRunResponse
from app.services.pipeline import PipelineError, run_pipeline_for_date

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/pipeline", tags=["admin"])


@router.post("/run", response_model=PipelineRunResponse)
def trigger_pipeline(
    date: date_type | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> PipelineRunResponse:
    """手动触发某日 pipeline。默认是昨天（UTC 自然日）。"""
    target = date or (datetime.now(UTC).date() - timedelta(days=1))
    try:
        nav = run_pipeline_for_date(db, target)
        db.commit()
    except PipelineError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        db.rollback()
        logger.exception("Pipeline run failed for %s", target)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline failed: {type(e).__name__}",
        ) from e

    if nav is None:
        return PipelineRunResponse(
            date=target, skipped=True, message="No user shares yet; only funding_records persisted."
        )
    return PipelineRunResponse(
        date=target,
        skipped=False,
        raw_earnings=nav.total_raw_earnings,
        platform_fee=nav.platform_fee,
        gross_nav=nav.gross_nav,
        final_nav=nav.final_nav,
        admin_shares_issued=nav.admin_shares_issued,
        message=f"Pipeline OK for {target}",
    )


@router.get("/latest", response_model=DailyNavOut | None)
def get_latest_nav(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> DailyNav | None:
    return db.query(DailyNav).order_by(DailyNav.date.desc()).first()
