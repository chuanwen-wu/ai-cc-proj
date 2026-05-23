"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MeHistoryPage, MeHistoryRow, MeSeriesPoint } from "../actions";
import { fetchMeHistory } from "../actions";
import {
  fmtDateHKT,
  fmtDateShort,
  fmtNav,
  fmtPct,
  fmtShares,
  fmtSignedUSD,
  fmtUSD,
  toNumber,
} from "../format";

type RangeKey = "7" | "30" | "90" | "all";

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "7", label: "7 天" },
  { key: "30", label: "30 天" },
  { key: "90", label: "90 天" },
  { key: "all", label: "全部" },
];

type Props = {
  series: MeSeriesPoint[];
  history: MeHistoryPage;
};

function trendColor(n: number): string {
  if (n > 0) return "text-emerald-600 dark:text-emerald-400";
  if (n < 0) return "text-rose-600 dark:text-rose-400";
  return "text-stone-500 dark:text-zinc-500";
}

type ChartTipProps = {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; payload: { date: string } }>;
};

function ChartTooltip({ active, payload }: ChartTipProps) {
  if (!active || !payload?.length) return null;
  const val = payload.find((p) => p.dataKey === "valuation");
  const ret = payload.find((p) => p.dataKey === "cumReturnPct");
  return (
    <div className="rounded-md border border-stone-200 bg-white px-3 py-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-zinc-500">
        {payload[0].payload.date}
      </div>
      {val && (
        <div className="mt-1 font-mono text-sm font-semibold text-stone-900 dark:text-zinc-100">
          估值：{fmtUSD(val.value)}
        </div>
      )}
      {ret && (
        <div className="font-mono text-sm text-cyan-700 dark:text-cyan-400">
          累计收益：{fmtPct(ret.value)}
        </div>
      )}
    </div>
  );
}

export default function HistoryDetail({ series, history }: Props) {
  const [range, setRange] = useState<RangeKey>("30");
  const [page, setPage] = useState(history.page);
  const [historyState, setHistoryState] = useState<MeHistoryPage>(history);
  const [isPending, startTransition] = useTransition();

  // Client-side filter for chart
  const chartData = useMemo(() => {
    const points = series.map((p) => ({
      date: p.date,
      valuation: toNumber(p.valuation),
      cumReturnPct: p.cumulative_return_pct ? toNumber(p.cumulative_return_pct) : 0,
    }));
    if (range === "all") return points;
    const n = parseInt(range, 10);
    return points.slice(-n);
  }, [series, range]);

  const earliest = chartData[0];
  const latest = chartData[chartData.length - 1];
  const periodChange =
    earliest && latest ? latest.valuation - earliest.valuation : 0;
  const cumReturnPct = latest?.cumReturnPct ?? 0;

  // Reset page when range changes
  useEffect(() => {
    setPage(1);
    startTransition(async () => {
      const h = await fetchMeHistory(1, historyState.page_size);
      setHistoryState(h);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const totalPages = Math.max(1, Math.ceil(historyState.total / historyState.page_size));

  const gotoPage = (p: number) => {
    setPage(p);
    startTransition(async () => {
      const h = await fetchMeHistory(p, historyState.page_size);
      setHistoryState(h);
    });
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 dark:bg-[#0a0b0f] dark:text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* Header */}
        <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-900 dark:text-zinc-500 dark:hover:text-zinc-100"
            >
              <ArrowLeft size={12} />
              返回概览
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-stone-900 dark:text-zinc-100 sm:text-4xl">
              资产变化历史
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-stone-500 dark:text-zinc-500">
              查看不同时间区间内的估值趋势、累计收益表现，以及每日资产变化记录。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-stone-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setRange(opt.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  range === opt.key
                    ? "bg-stone-900 text-white dark:bg-zinc-100 dark:text-stone-900"
                    : "text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </header>

        {/* Summary cards */}
        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-stone-500 dark:text-zinc-500">
              当前估值
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-stone-900 dark:text-zinc-100">
              {latest ? fmtUSD(latest.valuation) : "—"}
            </div>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-stone-500 dark:text-zinc-500">
              累计收益
            </div>
            <div className={`mt-2 font-mono text-2xl font-semibold ${trendColor(cumReturnPct)}`}>
              {fmtPct(cumReturnPct)}
            </div>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-stone-500 dark:text-zinc-500">
              区间估值变化
            </div>
            <div className={`mt-2 font-mono text-2xl font-semibold ${trendColor(periodChange)}`}>
              {periodChange > 0 ? "+" : ""}
              {fmtUSD(periodChange)}
            </div>
          </div>
        </section>

        {/* Chart */}
        <section className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-stone-500 dark:text-zinc-500">
                趋势图
              </div>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-stone-900 dark:text-zinc-100">
                估值与累计收益双轴对比
              </h2>
              <p className="mt-1 text-sm text-stone-500 dark:text-zinc-500">
                左轴：估值（USD）。右轴：累计收益率（%）。
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <CalendarDays size={12} />
              HKT 时区
            </div>
          </div>
          <div className="mt-6 h-[320px] w-full sm:h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#a8a29e" }}
                  tickFormatter={fmtDateShort}
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#a8a29e" }}
                  tickFormatter={(v: number) => `$${Math.round(v).toLocaleString()}`}
                  width={60}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#0891b2" }}
                  tickFormatter={(v: number) => `${v}%`}
                  width={44}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="valuation"
                  stroke="#0f766e"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: "#0f766e" }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumReturnPct"
                  stroke="#0891b2"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#0891b2" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Table */}
        <section className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-2 border-b border-stone-200 px-5 py-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-stone-500 dark:text-zinc-500">
                历史记录
              </div>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-stone-900 dark:text-zinc-100">
                每日资产明细
              </h2>
            </div>
            <div className="text-xs text-stone-500 dark:text-zinc-500">
              共 {historyState.total} 条
            </div>
          </div>

          {/* Desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-500">
                  <th className="px-6 py-3 font-semibold">日期 (HKT)</th>
                  <th className="px-6 py-3 font-semibold">当日份额</th>
                  <th className="px-6 py-3 font-semibold">当日 NAV</th>
                  <th className="px-6 py-3 font-semibold">当日估值</th>
                  <th className="px-6 py-3 font-semibold">日变化</th>
                </tr>
              </thead>
              <tbody className={isPending ? "opacity-50" : ""}>
                {historyState.items.map((row: MeHistoryRow) => {
                  const dc = row.day_change ? toNumber(row.day_change) : null;
                  const dcPct = row.day_change_pct ? toNumber(row.day_change_pct) : null;
                  return (
                    <tr
                      key={row.date}
                      className="border-b border-stone-100 text-sm last:border-b-0 hover:bg-stone-50 dark:border-zinc-900 dark:hover:bg-zinc-900/30"
                    >
                      <td className="px-6 py-3 font-medium text-stone-800 dark:text-zinc-200">
                        {fmtDateHKT(row.date)}
                      </td>
                      <td className="px-6 py-3 font-mono text-stone-600 dark:text-zinc-400">
                        {fmtShares(toNumber(row.shares))}
                      </td>
                      <td className="px-6 py-3 font-mono text-stone-600 dark:text-zinc-400">
                        {fmtNav(toNumber(row.nav))}
                      </td>
                      <td className="px-6 py-3 font-mono text-stone-800 dark:text-zinc-200">
                        {fmtUSD(toNumber(row.valuation))}
                      </td>
                      <td className="px-6 py-3">
                        {dc !== null && dcPct !== null ? (
                          <>
                            <div className={`font-mono font-semibold ${trendColor(dc)}`}>
                              {dc > 0 ? "+" : ""}
                              {fmtUSD(dc)}
                            </div>
                            <div className={`mt-0.5 font-mono text-xs ${trendColor(dcPct)}`}>
                              {fmtPct(dcPct)}
                            </div>
                          </>
                        ) : (
                          <span className="text-stone-400 dark:text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {historyState.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-stone-500 dark:text-zinc-500">
                      暂无历史记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="divide-y divide-stone-100 md:hidden dark:divide-zinc-900">
            {historyState.items.map((row: MeHistoryRow) => {
              const dc = row.day_change ? toNumber(row.day_change) : null;
              const dcPct = row.day_change_pct ? toNumber(row.day_change_pct) : null;
              return (
                <div key={row.date} className="px-5 py-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-[10px] text-stone-400 dark:text-zinc-600">日期</div>
                      <div className="mt-0.5 text-sm font-semibold text-stone-800 dark:text-zinc-200">
                        {fmtDateHKT(row.date)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-stone-400 dark:text-zinc-600">估值</div>
                      <div className="mt-0.5 font-mono text-sm font-semibold text-stone-800 dark:text-zinc-200">
                        {fmtUSD(toNumber(row.valuation))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-stone-400 dark:text-zinc-600">日变化</div>
                      {dc !== null && dcPct !== null ? (
                        <>
                          <div className={`mt-0.5 font-mono text-sm font-semibold ${trendColor(dc)}`}>
                            {dc > 0 ? "+" : ""}
                            {fmtUSD(dc)}
                          </div>
                          <div className={`font-mono text-xs ${trendColor(dcPct)}`}>
                            {fmtPct(dcPct)}
                          </div>
                        </>
                      ) : (
                        <div className="mt-0.5 text-sm text-stone-400 dark:text-zinc-600">—</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {historyState.items.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-stone-500 dark:text-zinc-500">
                暂无历史记录
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 border-t border-stone-200 px-5 py-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="text-xs text-stone-500 dark:text-zinc-500">
              第 {page} / {totalPages} 页
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => gotoPage(page - 1)}
                className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                <ArrowLeft size={12} />
                上一页
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => gotoPage(page + 1)}
                className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                下一页
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
