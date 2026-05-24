"use client";

import {
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  Coins,
  Landmark,
  Shield,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import type { MeSeriesPoint, MeSummary, MeUser } from "./actions";
import { fmtPct, fmtShares, fmtSignedUSD, fmtUSD, greeting, toNumber } from "./format";

type Props = {
  user: MeUser;
  summary: MeSummary;
  series: MeSeriesPoint[];
};

function trendColor(n: number): string {
  if (n > 0) return "text-emerald-600 dark:text-emerald-400";
  if (n < 0) return "text-rose-600 dark:text-rose-400";
  return "text-stone-500 dark:text-zinc-500";
}

function trendBg(n: number): string {
  if (n > 0) return "bg-emerald-50 dark:bg-emerald-950/40";
  if (n < 0) return "bg-rose-50 dark:bg-rose-950/40";
  return "bg-stone-50 dark:bg-zinc-900";
}

function TrendArrow({ value }: { value: number }) {
  if (value === 0) return null;
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  return <Icon size={12} strokeWidth={2.4} />;
}

function Kpi({
  index,
  label,
  value,
  helper,
  trend,
  Icon,
}: {
  index: string;
  label: string;
  value: string;
  helper?: string;
  trend?: number | null;
  Icon: typeof Coins;
}) {
  const positive = trend !== null && trend !== undefined && trend >= 0;
  const trendNum = trend ?? 0;
  return (
    <div className="group relative overflow-hidden rounded-xl border border-stone-200 bg-white p-5 transition-all hover:border-stone-400/60 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 lg:p-6">
      <div className="absolute right-5 top-4 font-mono text-[10px] tracking-widest text-stone-400 dark:text-zinc-600">
        {index}
      </div>
      <div className="mb-5 flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-stone-100 text-stone-700 dark:bg-zinc-900/80 dark:text-zinc-300">
          <Icon size={14} strokeWidth={1.8} />
        </div>
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-stone-500 dark:text-zinc-400">
          {label}
        </span>
      </div>
      <div className="font-mono text-2xl font-semibold tracking-tight text-stone-900 dark:text-zinc-100 lg:text-3xl">
        {value}
      </div>
      {helper && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-stone-500 dark:text-zinc-500">
          {trend !== null && trend !== undefined && (
            <span
              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono font-medium ${trendColor(trendNum)} ${trendBg(trendNum)}`}
            >
              <TrendArrow value={trendNum} />
              {fmtPct(trendNum)}
            </span>
          )}
          <span>{helper}</span>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-white/50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-950/30 sm:p-12">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-stone-100 text-stone-500 dark:bg-zinc-900 dark:text-zinc-500">
        <Wallet size={28} strokeWidth={1.5} />
      </div>
      <h3 className="mt-6 text-xl font-semibold tracking-tight text-stone-900 dark:text-zinc-100">
        你还没有持仓
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500 dark:text-zinc-500">
        联系管理员入金后，你将在这里看到份额、估值、收益和每日变化。
      </p>
    </div>
  );
}

type ChartTipProps = {
  active?: boolean;
  payload?: Array<{ value: number; payload: { date: string } }>;
};

function ChartTooltip({ active, payload }: ChartTipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-md border border-stone-200 bg-white px-3 py-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-zinc-500">
        {p.payload.date}
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold text-stone-900 dark:text-zinc-100">
        {fmtUSD(p.value)}
      </div>
    </div>
  );
}

export default function DashboardOverview({ user, summary, series }: Props) {
  const shares = toNumber(summary.shares);
  const valuation = toNumber(summary.valuation);
  const cumReturn = toNumber(summary.cumulative_return);
  const cumReturnPct = summary.cumulative_return_pct
    ? toNumber(summary.cumulative_return_pct)
    : null;
  const todayChange = summary.today_change ? toNumber(summary.today_change) : null;
  const todayChangePct = summary.today_change_pct
    ? toNumber(summary.today_change_pct)
    : null;
  const hasHistory = summary.has_history;

  const chartData = useMemo(
    () =>
      series.map((p) => ({
        date: p.date,
        value: toNumber(p.valuation),
      })),
    [series],
  );

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 dark:bg-[#0a0b0f] dark:text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-stone-500 dark:text-zinc-500">
              <span>我的账户</span>
              {user.role === "admin" && (
                <span className="inline-flex items-center gap-1 rounded border border-amber-200/70 bg-amber-50 px-1.5 py-0.5 font-mono text-[9px] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-400">
                  <Shield size={9} strokeWidth={2.4} />
                  ADMIN
                </span>
              )}
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900 dark:text-zinc-100 sm:text-4xl">
              <span suppressHydrationWarning>{greeting()}</span>，{user.name ?? user.email}
            </h1>
            <p className="mt-2 text-sm text-stone-500 dark:text-zinc-500">
              当前资产表现一览 · 估值每日更新
            </p>
          </div>
          {user.role === "admin" && (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/earnings"
                className="rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                产品收益 →
              </Link>
              <Link
                href="/admin/users"
                className="rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                用户管理 →
              </Link>
              <Link
                href="/admin/bitfinex-accounts"
                className="rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Bitfinex 账号 →
              </Link>
            </div>
          )}
        </header>

        {/* Empty state */}
        {!hasHistory && (
          <div className="mt-8">
            <EmptyState />
          </div>
        )}

        {/* KPI cards */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            index="01"
            label="我的份额"
            value={fmtShares(shares)}
            helper={hasHistory ? "已确认持仓" : "暂无份额记录"}
            Icon={Coins}
          />
          <Kpi
            index="02"
            label="当前估值"
            value={fmtUSD(valuation)}
            helper={hasHistory ? "按最新净值估算" : "入金后将显示"}
            Icon={Landmark}
          />
          <Kpi
            index="03"
            label="累计收益"
            value={fmtSignedUSD(cumReturn)}
            helper={hasHistory ? `净入金 ${fmtUSD(toNumber(summary.cost_basis))}` : "暂无收益数据"}
            trend={cumReturnPct}
            Icon={BarChart3}
          />
          <Kpi
            index="04"
            label="今日变化"
            value={todayChange !== null ? fmtSignedUSD(todayChange) : "—"}
            helper={hasHistory && todayChangePct !== null ? "较昨日估值" : "暂无今日变化"}
            trend={todayChangePct}
            Icon={CircleDollarSign}
          />
        </section>

        {/* Mini chart */}
        <section className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-stone-500 dark:text-zinc-500">
                最近 7 天
              </div>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-stone-900 dark:text-zinc-100">
                估值走势
              </h2>
              <p className="mt-1 text-sm text-stone-500 dark:text-zinc-500">
                {hasHistory
                  ? "迷你折线图展示近 7 天估值变化。"
                  : "入金后即可生成估值曲线。"}
              </p>
            </div>
          </div>
          <div className="mt-6 h-56 w-full sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f766e" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#a8a29e" }}
                  dy={8}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#d6d3d1", strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0f766e"
                  strokeWidth={2}
                  fill="url(#valGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#0f766e", strokeWidth: 2, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-6 rounded-xl border border-stone-900 bg-stone-900 p-6 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-stone-900 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">查看账户完整历史</h2>
              <p className="mt-2 max-w-xl text-sm opacity-70">
                深入查看每一次估值更新、入金记录、收益变动与资产明细。
              </p>
            </div>
            {hasHistory ? (
              <Link
                href="/dashboard/history"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-bold text-stone-900 transition hover:-translate-y-0.5 hover:bg-stone-100 dark:bg-stone-900 dark:text-zinc-100 dark:hover:bg-stone-800"
              >
                查看完整历史
                <ArrowRight size={16} strokeWidth={2.4} />
              </Link>
            ) : (
              <button
                disabled
                className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-md bg-white/20 px-5 py-3 text-sm font-bold opacity-50"
              >
                查看完整历史
                <ArrowRight size={16} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
