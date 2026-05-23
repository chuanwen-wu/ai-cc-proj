"""测试 compute_nav_step 纯计算函数（无 DB 依赖）。

公式：
  threshold = aum_before × fee_threshold_apy / 365
  excess = max(0, raw_earnings - threshold)
  platform_fee = excess × fee_rate
  admin_shares_issued = platform_fee / gross_nav
"""

from decimal import Decimal

import pytest

from app.services.pipeline import compute_nav_step

# 公共默认配置
THRESHOLD_APY = Decimal("0.04")  # 4%
FEE_RATE = Decimal("0.5")  # 50%


def test_below_threshold_no_fee() -> None:
    """raw 收益低于年化 4% 门槛 → fee = 0，admin 不分新份额。"""
    aum = Decimal("10500")
    shares = Decimal("10000")
    threshold = aum * THRESHOLD_APY / Decimal(365)  # ≈ 1.151
    raw = threshold - Decimal("0.5")  # 略低于门槛

    comp = compute_nav_step(
        aum_before=aum,
        shares_before=shares,
        raw_earnings=raw,
        fee_threshold_apy=THRESHOLD_APY,
        fee_rate=FEE_RATE,
    )
    assert comp.platform_fee == Decimal(0)
    assert comp.admin_shares_issued == Decimal(0)
    assert comp.shares_after == shares
    assert comp.aum_after == aum + raw
    # NAV 不变成本——gross 和 final 应该相等
    assert comp.gross_nav == comp.final_nav


def test_at_threshold_no_fee() -> None:
    """raw 收益正好等于门槛 → fee 仍是 0。"""
    aum = Decimal("10500")
    shares = Decimal("10000")
    raw = aum * THRESHOLD_APY / Decimal(365)  # 正好门槛

    comp = compute_nav_step(
        aum_before=aum,
        shares_before=shares,
        raw_earnings=raw,
        fee_threshold_apy=THRESHOLD_APY,
        fee_rate=FEE_RATE,
    )
    assert comp.platform_fee == Decimal(0)
    assert comp.admin_shares_issued == Decimal(0)


def test_above_threshold_fee_charged() -> None:
    """raw 高于门槛 → fee = excess × 0.5；admin 新份额按 gross_nav 折算。"""
    aum = Decimal("10500")
    shares = Decimal("10000")
    raw = Decimal("5")  # 远高于 ~1.15 门槛

    threshold = aum * THRESHOLD_APY / Decimal(365)
    expected_excess = raw - threshold
    expected_fee = expected_excess * FEE_RATE

    comp = compute_nav_step(
        aum_before=aum,
        shares_before=shares,
        raw_earnings=raw,
        fee_threshold_apy=THRESHOLD_APY,
        fee_rate=FEE_RATE,
    )
    assert comp.platform_fee == expected_fee
    # admin 新份额 = fee / gross_nav
    expected_admin_shares = expected_fee / comp.gross_nav
    assert comp.admin_shares_issued == expected_admin_shares
    assert comp.shares_after == shares + expected_admin_shares
    # final_nav < gross_nav（因为发新份额稀释了）
    assert comp.final_nav < comp.gross_nav


def test_negative_raw_no_fee_users_absorb_loss() -> None:
    """raw 是负的（亏损）→ fee = 0，所有损失由现有份额持有者承担。"""
    aum = Decimal("10500")
    shares = Decimal("10000")
    raw = Decimal("-50")

    comp = compute_nav_step(
        aum_before=aum,
        shares_before=shares,
        raw_earnings=raw,
        fee_threshold_apy=THRESHOLD_APY,
        fee_rate=FEE_RATE,
    )
    assert comp.platform_fee == Decimal(0)
    assert comp.admin_shares_issued == Decimal(0)
    # 用户 NAV 下跌
    assert comp.final_nav < Decimal("1.05")
    assert comp.aum_after == aum + raw
    assert comp.shares_after == shares


def test_zero_shares_raises() -> None:
    """期初没份额，不应该调这个函数。"""
    with pytest.raises(ValueError, match="shares_before"):
        compute_nav_step(
            aum_before=Decimal(0),
            shares_before=Decimal(0),
            raw_earnings=Decimal(10),
            fee_threshold_apy=THRESHOLD_APY,
            fee_rate=FEE_RATE,
        )


def test_user_effective_apy_matches_design() -> None:
    """完整一致性：用户实际年化收益 ≈ 4% + 50% × max(0, gross_apy - 4%)。

    取一个具体例子：gross APY = 8%（即门槛上方 4%）。
    用户应该拿到 4% + 50% × 4% = 6% APY。
    """
    aum = Decimal("365000")  # 选 365 方便日化
    shares = Decimal("365000")  # NAV = 1.0
    # 8% APY 的日收益 = AUM × 8% / 365 = 80
    raw = Decimal("80")

    comp = compute_nav_step(
        aum_before=aum,
        shares_before=shares,
        raw_earnings=raw,
        fee_threshold_apy=THRESHOLD_APY,
        fee_rate=FEE_RATE,
    )

    # 用户份额没变，估值从 1.0 涨到 final_nav
    user_day_return = comp.final_nav - Decimal("1.0")
    # 期望日收益（按 6% APY）≈ 1.0 × 6% / 365 ≈ 0.0001643836
    expected_day_return = Decimal("0.06") / Decimal(365)
    # 允许 1e-6 误差
    assert abs(user_day_return - expected_day_return) < Decimal("0.000001")
