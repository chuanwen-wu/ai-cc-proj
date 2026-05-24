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
from app.schemas.pipeline import (
    DailyNavOut,
    PipelineRangeRequest,
    PipelineRangeRunResponse,
    PipelineRunResponse,
)
from app.services.pipeline import PipelineError, run_pipeline_for_date

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/pipeline", tags=["admin"])

# 单次手动重算允许的最大日期跨度，防止误操作触发超长跑批。
MAX_RANGE_DAYS = 366


def _day_response(target: date_type, nav: DailyNav | None) -> PipelineRunResponse:
    """把单日 pipeline 结果转成 API 响应。nav 为 None 表示当日无用户份额、跳过 NAV。"""
    if nav is None:
        return PipelineRunResponse(
            date=target,
            skipped=True,
            message="No user shares; only funding_records persisted.",
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

    return _day_response(target, nav)


@router.post("/run-range", response_model=PipelineRangeRunResponse)
def trigger_pipeline_range(
    payload: PipelineRangeRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> PipelineRangeRunResponse:
    """手动触发 [start_date, end_date] 区间的 pipeline，逐日重算并覆盖已有数据。

    日期按升序处理，因为每日 NAV 依赖前一日的期末状态。整段在一个事务里跑，
    任一日失败则全部回滚，避免留下半截不一致的数据。
    """
    start, end = payload.start_date, payload.end_date
    if start > end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date 不能晚于 end_date",
        )
    today = datetime.now(UTC).date()
    if end > today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"end_date {end} 在未来，拒绝跑批",
        )
    span = (end - start).days + 1
    if span > MAX_RANGE_DAYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"日期跨度 {span} 天超过上限 {MAX_RANGE_DAYS} 天，请缩小范围",
        )

    results: list[PipelineRunResponse] = []
    computed = skipped = 0
    cur = start
    try:
        while cur <= end:
            nav = run_pipeline_for_date(db, cur)
            # 显式 flush，确保下一日 _state_before 能读到当日刚写入的 daily_nav。
            db.flush()
            if nav is None:
                skipped += 1
            else:
                computed += 1
            results.append(_day_response(cur, nav))
            cur += timedelta(days=1)
        db.commit()
    except PipelineError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{cur} 跑批失败：{e}",
        ) from e
    except Exception as e:
        db.rollback()
        logger.exception("Pipeline range run failed at %s", cur)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline failed at {cur}: {type(e).__name__}",
        ) from e

    return PipelineRangeRunResponse(
        start_date=start,
        end_date=end,
        total_days=span,
        computed_days=computed,
        skipped_days=skipped,
        results=results,
    )


@router.get("/latest", response_model=DailyNavOut | None)
def get_latest_nav(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> DailyNav | None:
    return db.query(DailyNav).order_by(DailyNav.date.desc()).first()
