"use client";

import {
  Activity,
  ChevronDown,
  ChevronRight,
  Circle,
  Coins,
  Layers,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  fetchBreakdown,
  type BreakdownRow,
  type SeriesPoint,
  type Summary,
} from "./actions";
import { fmtCompact, fmtDateShort, fmtMoney, fmtPct, toNumber } from "./format";

type Range = 7 | 30 | 90 | "all";

type Props = {
  summary: Summary;
  series: SeriesPoint[];
};

function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDark;
}

// ─────────────────────────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────────────────────────
function Kpi({
  index,
  label,
  value,
  delta,
  deltaLabel,
  Icon,
}: {
  index: string;
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  Icon: typeof Activity;
}) {
  const positive = delta !== null && delta !== undefined && delta >= 0;
  return (
    <div className="group relative overflow-hidden rounded-xl border border-[#e7e5e0] bg-white p-5 transition-all hover:border-stone-400/60 dark:border-[#22232a] dark:bg-[#101115] dark:hover:border-zinc-700 lg:p-6">
      <div className="absolute right-5 top-4 font-mono text-[10px] tracking-widest text-stone-400 dark:text-zinc-600">
        {index}
      </div>
      <div className="mb-5 flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-stone-100 text-stone-700 dark:bg-zinc-900/80 dark:text-zinc-300">
          <Icon size={14} strokeWidth={1.8} />
        </div>
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500">
          {label}
        </div>
      </div>
      <div
        className="mb-3 font-display text-[2.4rem] leading-none tracking-tight text-stone-900 dark:text-zinc-50 lg:text-[2.65rem]"
        style={{ fontFeatureSettings: '"ss01", "ss02"' }}
      >
        {value}
      </div>
      {delta !== null && delta !== undefined && (
        <div className="flex items-center gap-1.5">
          <div
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium ${
              positive
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
            }`}
          >
            {positive ? <TrendingUp size={11} strokeWidth={2.2} /> : <TrendingDown size={11} strokeWidth={2.2} />}
            {fmtPct(delta)}
          </div>
          {deltaLabel && (
            <span className="text-[11px] text-stone-500 dark:text-zinc-500">{deltaLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// NAV Area Chart
// ─────────────────────────────────────────────────────────────────
function NavChart({ data, isDark }: { data: SeriesPoint[]; isDark: boolean }) {
  const [range, setRange] = useState<Range>(30);
  const sliced = useMemo(() => {
    if (range === "all") return data;
    return data.slice(-range);
  }, [range, data]);

  const navs = sliced.map((d) => toNumber(d.final_nav));
  const first = navs[0] ?? 1;
  const last = navs[navs.length - 1] ?? 1;
  const change = first === 0 ? 0 : ((last - first) / first) * 100;
  const positive = change >= 0;
  const lineColor = positive ? (isDark ? "#34d399" : "#059669") : isDark ? "#fb7185" : "#dc2626";
  const gridColor = isDark ? "#22232a" : "#eeece6";
  const axisColor = isDark ? "#6b6b75" : "#9c9a92";

  const chartData = sliced.map((d) => ({ date: d.date, nav: toNumber(d.final_nav) }));
  const ranges: { label: string; value: Range }[] = [
    { label: "7天", value: 7 },
    { label: "30天", value: 30 },
    { label: "90天", value: 90 },
    { label: "全部", value: "all" },
  ];

  return (
    <div className="rounded-xl border border-[#e7e5e0] bg-white p-5 dark:border-[#22232a] dark:bg-[#101115] lg:p-7">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-widest text-stone-400 dark:text-zinc-600">02</span>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500">
              NAV · Net Asset Value
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <h2 className="font-display text-2xl tracking-tight text-stone-900 dark:text-zinc-50 lg:text-3xl">
              单位净值走势
            </h2>
            <span className={`font-mono text-sm ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {fmtPct(change)}
            </span>
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-stone-200 bg-stone-100 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/80">
          {ranges.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                range === r.value
                  ? "bg-white text-stone-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-stone-500 hover:text-stone-700 dark:text-zinc-500 dark:hover:text-zinc-300"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="-ml-2 h-72 lg:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="navFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.18} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => fmtDateShort(d)}
              stroke={axisColor}
              tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: axisColor }}
              tickLine={false}
              axisLine={false}
              minTickGap={30}
            />
            <YAxis
              domain={["dataMin - 0.005", "dataMax + 0.005"]}
              stroke={axisColor}
              tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: axisColor }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => v.toFixed(4)}
              width={60}
            />
            <Tooltip
              cursor={{ stroke: axisColor, strokeWidth: 1, strokeDasharray: "3 3" }}
              contentStyle={{
                background: isDark ? "#0a0b0e" : "#ffffff",
                border: `1px solid ${gridColor}`,
                borderRadius: 8,
                fontSize: 11,
                fontFamily: "JetBrains Mono, monospace",
                padding: "8px 12px",
              }}
              labelStyle={{ color: isDark ? "#a1a1aa" : "#71717a", fontSize: 10, marginBottom: 4 }}
              itemStyle={{ color: isDark ? "#fafafa" : "#18181b" }}
              formatter={(v: number) => [v.toFixed(4), "NAV"]}
              labelFormatter={(d: string) => d + " HKT"}
            />
            <Area
              type="monotone"
              dataKey="nav"
              stroke={lineColor}
              strokeWidth={1.5}
              fill="url(#navFill)"
              activeDot={{ r: 4, strokeWidth: 0, fill: lineColor }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Daily Earnings Stacked Bar
// ─────────────────────────────────────────────────────────────────
function EarningsChart({ data, isDark }: { data: SeriesPoint[]; isDark: boolean }) {
  const sliced = data.slice(-30);
  const gridColor = isDark ? "#22232a" : "#eeece6";
  const axisColor = isDark ? "#6b6b75" : "#9c9a92";
  const netColor = isDark ? "#34d399" : "#059669";
  const feeColor = isDark ? "#fbbf24" : "#d97706";

  const chartData = sliced.map((d) => ({
    date: d.date,
    net: toNumber(d.net),
    fee: toNumber(d.fee),
  }));
  const totalRaw = sliced.reduce((s, d) => s + toNumber(d.raw), 0);
  const totalFee = sliced.reduce((s, d) => s + toNumber(d.fee), 0);
  const totalNet = sliced.reduce((s, d) => s + toNumber(d.net), 0);

  return (
    <div className="rounded-xl border border-[#e7e5e0] bg-white p-5 dark:border-[#22232a] dark:bg-[#101115] lg:p-7">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-widest text-stone-400 dark:text-zinc-600">03</span>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500">
              Daily Earnings · 近 30 日
            </span>
          </div>
          <h2 className="font-display text-2xl tracking-tight text-stone-900 dark:text-zinc-50 lg:text-3xl">
            每日收益构成
          </h2>
        </div>
        <div className="flex flex-wrap gap-4 text-xs lg:gap-6">
          <LegendItem color={netColor} label="用户净收益" value={fmtCompact(totalNet)} />
          <LegendItem color={feeColor} label="平台费" value={fmtCompact(totalFee)} />
          <LegendItem color={isDark ? "#52525b" : "#a1a1aa"} dashed label="Raw 收益合计" value={fmtCompact(totalRaw)} />
        </div>
      </div>
      <div className="-ml-2 h-72 lg:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => fmtDateShort(d)}
              stroke={axisColor}
              tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: axisColor }}
              tickLine={false}
              axisLine={false}
              minTickGap={20}
            />
            <YAxis
              stroke={axisColor}
              tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: axisColor }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => fmtCompact(v).replace("$", "")}
              width={56}
            />
            <Tooltip
              cursor={{ fill: isDark ? "#ffffff05" : "#00000005" }}
              contentStyle={{
                background: isDark ? "#0a0b0e" : "#ffffff",
                border: `1px solid ${gridColor}`,
                borderRadius: 8,
                fontSize: 11,
                fontFamily: "JetBrains Mono, monospace",
                padding: "10px 12px",
              }}
              labelStyle={{ color: isDark ? "#a1a1aa" : "#71717a", fontSize: 10, marginBottom: 6 }}
              itemStyle={{ color: isDark ? "#fafafa" : "#18181b", padding: "2px 0" }}
              formatter={(v: number, name: string) => {
                const labels: Record<string, string> = { net: "用户净收益", fee: "平台费" };
                return [fmtMoney(v), labels[name] || name];
              }}
              labelFormatter={(d: string) => d + " HKT"}
            />
            <Bar dataKey="net" stackId="a" fill={netColor} radius={[0, 0, 2, 2]} />
            <Bar dataKey="fee" stackId="a" fill={feeColor} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  value,
  dashed,
}: {
  color: string;
  label: string;
  value: string;
  dashed?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 rounded-sm"
        style={{
          background: dashed ? "transparent" : color,
          border: dashed ? `1.5px dashed ${color}` : "none",
        }}
      />
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wider text-stone-500 dark:text-zinc-500">{label}</span>
        <span className="font-mono text-[12px] text-stone-900 dark:text-zinc-100">{value}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Data Table with expandable breakdown
// ─────────────────────────────────────────────────────────────────
function DataTable({ data }: { data: SeriesPoint[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [breakdowns, setBreakdowns] = useState<Record<string, BreakdownRow[] | "loading" | "error">>({});
  const rows = useMemo(() => [...data].reverse().slice(0, 30), [data]);

  const toggle = async (date: string) => {
    if (expanded === date) {
      setExpanded(null);
      return;
    }
    setExpanded(date);
    if (breakdowns[date] === undefined) {
      setBreakdowns((m) => ({ ...m, [date]: "loading" }));
      try {
        const rows = await fetchBreakdown(date);
        setBreakdowns((m) => ({ ...m, [date]: rows }));
      } catch {
        setBreakdowns((m) => ({ ...m, [date]: "error" }));
      }
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[#e7e5e0] bg-white dark:border-[#22232a] dark:bg-[#101115]">
      <div className="border-b border-stone-100 px-5 pb-5 pt-5 dark:border-zinc-900 lg:px-7 lg:pt-7">
        <div className="mb-2 flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-widest text-stone-400 dark:text-zinc-600">04</span>
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500">
            Ledger · 最近 30 日明细
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl tracking-tight text-stone-900 dark:text-zinc-50 lg:text-3xl">
            日度账本数据
          </h2>
          <span className="hidden font-mono text-[11px] text-stone-500 dark:text-zinc-500 sm:block">
            点击行展开账号明细 →
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-left text-[10px] uppercase tracking-[0.12em] text-stone-500 dark:border-zinc-900 dark:text-zinc-500">
              <th className="w-8 px-5 py-3 font-medium lg:px-7"></th>
              <th className="py-3 font-medium">日期 (HKT)</th>
              <th className="py-3 text-right font-medium">Raw</th>
              <th className="py-3 text-right font-medium">平台费</th>
              <th className="py-3 text-right font-medium">Gross NAV</th>
              <th className="py-3 text-right font-medium">Final NAV</th>
              <th className="py-3 text-right font-medium">AUM 期初</th>
              <th className="py-3 pr-5 text-right font-medium lg:pr-7">AUM 期末</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-sm text-stone-400 lg:px-7">
                  暂无数据。等 pipeline 跑过一次即可看到。
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const isOpen = expanded === row.date;
              const aumStart = toNumber(row.aum_start);
              const aumEnd = toNumber(row.aum_end);
              const aumDelta = aumEnd - aumStart;
              const br = breakdowns[row.date];
              return (
                <Fragment key={row.date}>
                  <tr
                    onClick={() => toggle(row.date)}
                    className={`cursor-pointer border-b border-stone-50 transition-colors dark:border-zinc-900/70 ${
                      isOpen ? "bg-stone-50/80 dark:bg-zinc-900/40" : "hover:bg-stone-50/60 dark:hover:bg-zinc-900/30"
                    }`}
                  >
                    <td className="px-5 py-3.5 text-stone-400 dark:text-zinc-600 lg:px-7">
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="py-3.5 font-mono text-[12px] text-stone-700 dark:text-zinc-300">{row.date}</td>
                    <td className="py-3.5 text-right font-mono text-[12px] tabular-nums text-stone-700 dark:text-zinc-300">
                      {fmtMoney(toNumber(row.raw))}
                    </td>
                    <td className="py-3.5 text-right font-mono text-[12px] tabular-nums text-amber-700 dark:text-amber-500">
                      {fmtMoney(toNumber(row.fee))}
                    </td>
                    <td className="py-3.5 text-right font-mono text-[12px] tabular-nums text-stone-500 dark:text-zinc-500">
                      {toNumber(row.gross_nav).toFixed(4)}
                    </td>
                    <td className="py-3.5 text-right font-mono text-[12px] font-medium tabular-nums text-stone-900 dark:text-zinc-50">
                      {toNumber(row.final_nav).toFixed(4)}
                    </td>
                    <td className="py-3.5 text-right font-mono text-[12px] tabular-nums text-stone-500 dark:text-zinc-500">
                      {fmtCompact(aumStart)}
                    </td>
                    <td className="py-3.5 pr-5 text-right font-mono text-[12px] tabular-nums lg:pr-7">
                      <span className="text-stone-900 dark:text-zinc-50">{fmtCompact(aumEnd)}</span>
                      <span
                        className={`ml-2 text-[10px] ${
                          aumDelta >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {aumDelta >= 0 ? "↑" : "↓"}
                      </span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-stone-100 bg-stone-50/40 dark:border-zinc-900 dark:bg-zinc-950/40">
                      <td colSpan={8} className="px-5 py-5 lg:px-7">
                        <div className="mb-4 flex items-center gap-2">
                          <Circle size={6} className="fill-emerald-500 text-emerald-500" />
                          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500">
                            账号明细 · {row.date}
                          </span>
                        </div>
                        {br === "loading" && (
                          <div className="text-sm text-stone-500 dark:text-zinc-500">载入中…</div>
                        )}
                        {br === "error" && (
                          <div className="text-sm text-rose-500">载入失败，请刷新重试。</div>
                        )}
                        {Array.isArray(br) && br.length === 0 && (
                          <div className="text-sm text-stone-500 dark:text-zinc-500">
                            当日没有 funding records（可能没接 Bitfinex 账号）。
                          </div>
                        )}
                        {Array.isArray(br) && br.length > 0 && (
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {br.map((acc, idx) => (
                              <div
                                key={`${acc.account_id}-${acc.currency}-${idx}`}
                                className="rounded-lg border border-stone-200 bg-white p-3.5 dark:border-zinc-900 dark:bg-[#0a0b0e]"
                              >
                                <div className="mb-2.5 flex items-start justify-between">
                                  <div>
                                    <div className="mb-0.5 font-mono text-[10px] text-stone-400 dark:text-zinc-600">
                                      #{acc.account_id} · {acc.currency}
                                    </div>
                                    <div className="text-[12px] font-medium text-stone-900 dark:text-zinc-100">
                                      {acc.account_label}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-baseline justify-between border-t border-stone-100 pt-2.5 dark:border-zinc-900">
                                  <div className="text-[9px] uppercase tracking-wider text-stone-400 dark:text-zinc-600">
                                    收益
                                  </div>
                                  <div
                                    className={`font-mono text-[12px] tabular-nums ${
                                      toNumber(acc.amount) >= 0
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-rose-600 dark:text-rose-400"
                                    }`}
                                  >
                                    {toNumber(acc.amount) >= 0 ? "+" : ""}
                                    {fmtMoney(toNumber(acc.amount))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────
function Header() {
  const [timeStr, setTimeStr] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const utcMs = Date.now();
      const hkt = new Date(utcMs + 8 * 60 * 60 * 1000);
      setTimeStr(hkt.toISOString().slice(0, 19).replace("T", " "));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:mb-10">
      <div>
        <div className="mb-3 flex items-center gap-3">
          <div className="font-mono text-[10px] tracking-[0.2em] text-stone-500 dark:text-zinc-500">
            ADMIN · PRODUCT REVENUE
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
              Live
            </span>
          </div>
        </div>
        <h1 className="font-display text-4xl leading-[1.05] tracking-tight text-stone-900 dark:text-zinc-50 lg:text-5xl">
          产品收益<span className="italic text-stone-400 dark:text-zinc-600"> / </span>管理视图
        </h1>
        <p className="mt-2 max-w-lg text-sm text-stone-500 dark:text-zinc-500">
          实时聚合所有账号的 NAV、收益与平台费分配 · 全部时间以香港时区结算
        </p>
      </div>
      <div className="text-left sm:text-right">
        <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500">
          Last update
        </div>
        <div className="font-mono text-sm text-stone-900 dark:text-zinc-100" suppressHydrationWarning>
          {timeStr ?? "—"} <span className="text-stone-400 dark:text-zinc-600">HKT</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────
export default function EarningsDashboard({ summary, series }: Props) {
  const isDark = useDarkMode();

  const navValue = summary.current_nav ? toNumber(summary.current_nav).toFixed(4) : "—";
  const navDelta = summary.current_nav_change_pct ? toNumber(summary.current_nav_change_pct) : null;
  const rawValue = summary.today_raw_earnings ? fmtCompact(toNumber(summary.today_raw_earnings)) : "—";
  const rawDelta = summary.today_raw_change_pct ? toNumber(summary.today_raw_change_pct) : null;
  const feeValue = fmtCompact(toNumber(summary.cumulative_platform_fee));
  const aumValue = summary.total_aum ? fmtCompact(toNumber(summary.total_aum)) : "—";
  const aumDelta = summary.total_aum_change_pct ? toNumber(summary.total_aum_change_pct) : null;

  return (
    <>
      <div className="min-h-screen bg-[#fafaf7] text-stone-900 transition-colors dark:bg-[#08090b] dark:text-zinc-100">
        <div
          className="pointer-events-none fixed inset-0 opacity-[0.025] dark:opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        <div className="relative mx-auto max-w-[1480px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
          <Header />

          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:mb-4 lg:grid-cols-4 lg:gap-4">
            <Kpi index="01" label="当前 NAV" value={navValue} delta={navDelta} deltaLabel="vs 昨日" Icon={Activity} />
            <Kpi index="02" label="今日收益 (Raw)" value={rawValue} delta={rawDelta} deltaLabel="vs 昨日" Icon={Coins} />
            <Kpi index="03" label="累计平台费" value={feeValue} Icon={Layers} />
            <Kpi index="04" label="总 AUM" value={aumValue} delta={aumDelta} deltaLabel="vs 30 日前" Icon={Wallet} />
          </div>

          <div className="mb-3 grid grid-cols-1 gap-3 lg:mb-4 lg:gap-4">
            <NavChart data={series} isDark={isDark} />
            <EarningsChart data={series} isDark={isDark} />
          </div>

          <DataTable data={series} />

          <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-stone-200 pt-6 text-[10px] uppercase tracking-[0.14em] text-stone-400 sm:flex-row sm:items-center dark:border-zinc-900 dark:text-zinc-600">
            <span>© 2026 · Treasury Operations Console</span>
            <span className="font-mono">ai-cc-proj</span>
          </div>
        </div>
      </div>
    </>
  );
}
