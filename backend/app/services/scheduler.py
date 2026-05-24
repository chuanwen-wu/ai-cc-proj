"""APScheduler 集成。

定时 01:35 UTC 跑前一日的 pipeline。只在 INSTANCE_ROLE='scheduler' 时启动。
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import settings
from app.db.session import SessionLocal
from app.services.pipeline import run_pipeline_for_date

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def _run_daily_pipeline_job() -> None:
    """APScheduler 触发的入口。跑前一日（UTC 自然日）。"""
    target = (datetime.now(UTC) - timedelta(days=1)).date()
    logger.info("Scheduler firing pipeline for %s", target)
    db = SessionLocal()
    try:
        run_pipeline_for_date(db, target)
        db.commit()
        logger.info("Pipeline %s committed", target)
    except Exception:
        db.rollback()
        logger.exception("Scheduler pipeline %s failed", target)
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler | None:
    """在 FastAPI 启动时调用；如果不该启就返回 None。"""
    global _scheduler
    if settings.INSTANCE_ROLE != "scheduler":
        logger.info("INSTANCE_ROLE=%s, 跳过 APScheduler 启动", settings.INSTANCE_ROLE)
        return None
    if _scheduler is not None:
        logger.warning("Scheduler 已经启动过，跳过")
        return _scheduler
    sched = BackgroundScheduler(timezone="UTC")
    sched.add_job(
        _run_daily_pipeline_job,
        trigger=CronTrigger(hour=1, minute=35, timezone="UTC"),
        id="daily_pipeline",
        replace_existing=True,
        coalesce=True,
        misfire_grace_time=3600,  # 容忍 1h 内的错过
    )
    sched.start()
    _scheduler = sched
    logger.info(
        "Scheduler 已启动：daily_pipeline cron 35 1 * * * UTC (= 09:35 HKT)"
    )
    return sched


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
