"use client";

import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Circle,
  Clock,
  Edit3,
  MoreHorizontal,
  Search,
  Shield,
  Sliders,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  adjustShares,
  fetchUserTransactions,
  fetchUsers,
  type AdjustLabel,
  type TxRow,
  type UserRow,
  type UsersListResponse,
} from "./actions";
import {
  fmtDateTimeHKT,
  fmtShares,
  fmtSignedShares,
  fmtSignedUSD,
  fmtUSD,
  toNumber,
} from "./format";

type Props = { initial: UsersListResponse };

const ADJUST_TYPES: AdjustLabel[] = ["认购入金", "赎回出金", "修正", "其他"];

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-200/70 bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-400">
        <Shield size={9} strokeWidth={2.4} />
        ADMIN
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-stone-200 bg-stone-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-stone-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
      USER
    </span>
  );
}

function MetricInline({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[9px] uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500">
        {label}
      </span>
      <span className="mt-0.5 text-sm text-stone-900 dark:text-zinc-50">{value}</span>
    </div>
  );
}

const typeDotClass: Record<string, string> = {
  admin_grant: "bg-emerald-500 ring-emerald-100 dark:bg-emerald-400 dark:ring-emerald-950/60",
  admin_revoke: "bg-rose-500 ring-rose-100 dark:bg-rose-400 dark:ring-rose-950/60",
  fee_issuance: "bg-amber-500 ring-amber-100 dark:bg-amber-400 dark:ring-amber-950/60",
  initial: "bg-stone-400 ring-stone-100 dark:bg-zinc-500 dark:ring-zinc-900",
};

function txIcon(changeType: string, signPositive: boolean) {
  if (changeType === "fee_issuance") return <Edit3 size={11} strokeWidth={2} />;
  if (changeType === "initial") return <MoreHorizontal size={11} strokeWidth={2} />;
  return signPositive ? <ArrowDownLeft size={11} strokeWidth={2} /> : <ArrowUpRight size={11} strokeWidth={2} />;
}

// ─────────────────────────────────────────────────────────────────
// Adjust Dialog
// ─────────────────────────────────────────────────────────────────
function AdjustDialog({
  user,
  currentNav,
  onClose,
  onAdjusted,
}: {
  user: UserRow;
  currentNav: number;
  onClose: () => void;
  onAdjusted: (u: UserRow) => void;
}) {
  const [deltaInput, setDeltaInput] = useState("");
  const [type, setType] = useState<AdjustLabel>("认购入金");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const delta = parseFloat(deltaInput);
  const deltaValid = !isNaN(delta) && deltaInput.trim() !== "" && delta !== 0;
  const reasonValid = reason.trim().length >= 5;
  const canSubmit = deltaValid && reasonValid && !submitting;
  const currentShares = toNumber(user.shares);
  const newShares = deltaValid ? currentShares + delta : currentShares;
  const currentVal = currentShares * currentNav;
  const newVal = newShares * currentNav;
  const valDelta = newVal - currentVal;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await adjustShares(user.id, deltaInput.trim(), type, reason.trim());
      onAdjusted(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:border-stone-500 focus:outline-none dark:border-zinc-800 dark:bg-[#0a0b0e] dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm dark:bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-2xl border border-[#e7e5e0] bg-white shadow-2xl dark:border-[#22232a] dark:bg-[#101115]"
      >
        <div className="flex items-start justify-between border-b border-stone-100 p-6 pb-5 dark:border-zinc-900">
          <div>
            <div className="mb-1.5 font-mono text-[10px] tracking-[0.14em] text-stone-500 dark:text-zinc-500">
              ADJUSTMENT
            </div>
            <h3 className="mb-1 font-display text-2xl leading-none tracking-tight text-stone-900 dark:text-zinc-50">
              调整份额
            </h3>
            <div className="mt-2 flex items-center gap-2 text-[12px] text-stone-500 dark:text-zinc-500">
              <span className="font-medium text-stone-900 dark:text-zinc-100">{user.name ?? user.email}</span>
              <span>·</span>
              <span className="font-mono">{user.email}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="-m-1.5 rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500">
              变动数量
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={deltaInput}
              onChange={(e) => setDeltaInput(e.target.value)}
              placeholder="+100 入金 / -50 赎回"
              className={inputClass + " font-mono"}
            />
            {deltaInput && !deltaValid && (
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400">
                <AlertCircle size={11} /> 请输入非零的有效数字（支持负数）
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500">
              调整类型
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AdjustLabel)}
              className={inputClass + " cursor-pointer"}
            >
              {ADJUST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <label className="block text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500">
                备注 <span className="ml-1 normal-case text-rose-600 dark:text-rose-400">*</span>
              </label>
              <span className={`font-mono text-[10px] ${reason.length >= 5 ? "text-stone-400 dark:text-zinc-600" : "text-rose-500 dark:text-rose-400"}`}>
                {reason.length} / 5+
              </span>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请说明原因（至少 5 个字符）"
              rows={3}
              className={inputClass + " resize-none leading-relaxed"}
            />
          </div>

          <div className="mt-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 dark:border-zinc-800 dark:bg-[#0a0b0e]">
            <div className="mb-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500">
              <Circle size={6} className="fill-emerald-500 text-emerald-500" /> 实时预览
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-stone-600 dark:text-zinc-400">调整后份额</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-stone-400 line-through dark:text-zinc-600">{fmtShares(currentShares)}</span>
                  <span className="text-stone-400 dark:text-zinc-600">→</span>
                  <span className="font-medium text-stone-900 dark:text-zinc-50">{fmtShares(newShares)}</span>
                  {deltaValid && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        delta > 0
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                      }`}
                    >
                      {fmtSignedShares(delta)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-stone-600 dark:text-zinc-400">调整后估值</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-stone-400 line-through dark:text-zinc-600">{fmtUSD(currentVal)}</span>
                  <span className="text-stone-400 dark:text-zinc-600">→</span>
                  <span className="font-medium text-stone-900 dark:text-zinc-50">{fmtUSD(newVal)}</span>
                  {deltaValid && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        valDelta > 0
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                      }`}
                    >
                      {fmtSignedUSD(valDelta)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-3 border-t border-stone-200 pt-3 font-mono text-[10px] text-stone-400 dark:border-zinc-900 dark:text-zinc-600">
              按当前 NAV = {currentNav.toFixed(4)} 估算
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400">
              <div className="flex items-center gap-2">
                <AlertCircle size={13} />
                <span>提交失败：{error}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-stone-100 p-6 pt-4 dark:border-zinc-900">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-stone-900 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:hover:bg-zinc-50"
          >
            {submitting ? "提交中…" : "确认提交"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// History Drawer
// ─────────────────────────────────────────────────────────────────
function HistoryDrawer({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [txs, setTxs] = useState<TxRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    fetchUserTransactions(user.id).then(
      (r) => setTxs(r.items),
      (e: unknown) => setError(e instanceof Error ? e.message : "fetch failed"),
    );
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [user.id, onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm dark:bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative h-full w-full max-w-[480px] overflow-y-auto border-l border-[#e7e5e0] bg-white shadow-2xl dark:border-[#22232a] dark:bg-[#101115]"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-stone-100 bg-white p-6 pb-5 dark:border-zinc-900 dark:bg-[#101115]">
          <div>
            <div className="mb-1.5 font-mono text-[10px] tracking-[0.14em] text-stone-500 dark:text-zinc-500">
              HISTORY
            </div>
            <h3 className="font-display text-2xl leading-none tracking-tight text-stone-900 dark:text-zinc-50">
              份额变动历史
            </h3>
            <div className="mt-2 flex items-center gap-2 text-[12px] text-stone-500 dark:text-zinc-500">
              <span className="font-medium text-stone-900 dark:text-zinc-100">{user.name ?? user.email}</span>
              <span>·</span>
              <span className="font-mono">{user.email}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="-m-1.5 rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {error && <div className="text-sm text-rose-500">加载失败：{error}</div>}
          {!error && txs === null && <div className="text-sm text-stone-500 dark:text-zinc-500">载入中…</div>}
          {!error && txs?.length === 0 && (
            <div className="text-sm text-stone-500 dark:text-zinc-500">还没有任何份额变动记录。</div>
          )}
          {txs && txs.length > 0 && (
            <ol className="relative space-y-5 border-l border-stone-200 pl-5 dark:border-zinc-800">
              {txs.map((tx) => {
                const amount = toNumber(tx.change_amount);
                const positive = amount >= 0;
                const dotClass = typeDotClass[tx.change_type] ?? typeDotClass.initial;
                return (
                  <li key={tx.id} className="relative">
                    <span
                      className={`absolute -left-[26px] top-1.5 h-2 w-2 rounded-full ring-4 ${dotClass}`}
                    />
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-stone-500 dark:text-zinc-500">
                          {fmtDateTimeHKT(tx.created_at)}
                        </span>
                        <span className="text-[12px] font-medium text-stone-900 dark:text-zinc-100">
                          {prettyType(tx)}
                        </span>
                      </div>
                      <span
                        className={`font-mono text-[12px] tabular-nums ${
                          positive
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-rose-700 dark:text-rose-400"
                        }`}
                      >
                        {fmtSignedShares(amount)}
                      </span>
                    </div>
                    <div className="mt-1 text-[12px] leading-relaxed text-stone-600 dark:text-zinc-400">
                      {tx.reason}
                    </div>
                    {tx.operator_email && (
                      <div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-stone-400 dark:text-zinc-600">
                        <Clock size={10} />
                        {tx.operator_email}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function prettyType(tx: TxRow): string {
  // 后端 reason 以 "[认购入金] ..." 开头时优先用方括号里的标签
  const m = /^\[(.+?)\]/.exec(tx.reason);
  if (m) return m[1];
  switch (tx.change_type) {
    case "admin_grant":
      return "入金";
    case "admin_revoke":
      return "出金";
    case "fee_issuance":
      return "平台费";
    case "initial":
      return "初始";
    default:
      return tx.change_type;
  }
}

// ─────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────
export default function UsersDashboard({ initial }: Props) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserRow[]>(initial.items);
  const [currentNav, setCurrentNav] = useState(toNumber(initial.current_nav));
  const [adjustTarget, setAdjustTarget] = useState<UserRow | null>(null);
  const [historyTarget, setHistoryTarget] = useState<UserRow | null>(null);
  const [, startTransition] = useTransition();
  const [icon] = useState(() => <Sliders size={11} strokeWidth={2} />);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      startTransition(async () => {
        try {
          const r = await fetchUsers(query);
          setUsers(r.items);
          setCurrentNav(toNumber(r.current_nav));
        } catch {
          // keep stale data on error
        }
      });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const totalUsers = users.filter((u) => u.role === "user").length;
  const totalAdmins = users.filter((u) => u.role === "admin").length;
  const totalShares = useMemo(
    () => users.reduce((s, u) => s + toNumber(u.shares), 0),
    [users],
  );

  const onAdjusted = (updated: UserRow) => {
    setUsers((curr) => curr.map((u) => (u.id === updated.id ? updated : u)));
  };

  return (
    <div className="min-h-screen bg-[#fafaf7] text-stone-900 transition-colors dark:bg-[#08090b] dark:text-zinc-100">
      <div className="mx-auto max-w-[1480px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <div className="mb-8 lg:mb-10">
          <div className="mb-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 font-mono text-[10px] tracking-[0.2em] text-stone-500 dark:text-zinc-500">
                ADMIN · USER MANAGEMENT
              </div>
              <h1 className="font-display text-4xl leading-[1.05] tracking-tight text-stone-900 dark:text-zinc-50 lg:text-5xl">
                用户管理<span className="italic text-stone-400 dark:text-zinc-600"> / </span>份额账本
              </h1>
              <p className="mt-2 max-w-lg text-sm text-stone-500 dark:text-zinc-500">
                管理所有客户份额持仓 · 调整入金赎回记录 · 全部操作留痕审计
              </p>
            </div>
            <div className="flex items-center gap-5 font-mono text-xs lg:gap-7">
              <MetricInline label="USERS" value={totalUsers.toString()} />
              <div className="h-8 w-px bg-stone-200 dark:bg-zinc-800" />
              <MetricInline label="ADMINS" value={totalAdmins.toString()} />
              <div className="h-8 w-px bg-stone-200 dark:bg-zinc-800" />
              <MetricInline label="TOTAL SHARES" value={fmtShares(totalShares)} />
            </div>
          </div>

          <div className="relative max-w-xl">
            <Search
              size={15}
              strokeWidth={1.8}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-zinc-600"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索邮箱或姓名..."
              className="w-full rounded-xl border border-[#e7e5e0] bg-white py-3 pl-11 pr-10 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:border-stone-400 focus:outline-none dark:border-[#22232a] dark:bg-[#101115] dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 transition-colors hover:text-stone-700 dark:text-zinc-600 dark:hover:text-zinc-300"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#e7e5e0] bg-white dark:border-[#22232a] dark:bg-[#101115]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left text-[10px] uppercase tracking-[0.12em] text-stone-500 dark:border-zinc-900 dark:text-zinc-500">
                  <th className="px-5 py-3.5 font-medium lg:px-6">用户</th>
                  <th className="hidden py-3.5 font-medium md:table-cell">邮箱</th>
                  <th className="py-3.5 font-medium">角色</th>
                  <th className="py-3.5 text-right font-medium">当前份额</th>
                  <th className="py-3.5 text-right font-medium">当前估值 (USD)</th>
                  <th className="hidden py-3.5 font-medium lg:table-cell">最近变动</th>
                  <th className="py-3.5 pr-5 text-right font-medium lg:pr-6">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-sm text-stone-400 dark:text-zinc-600">
                      没有匹配的用户
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const shares = toNumber(u.shares);
                    const valuation = shares * currentNav;
                    return (
                      <tr
                        key={u.id}
                        onClick={() => setHistoryTarget(u)}
                        className="cursor-pointer border-b border-stone-50 transition-colors last:border-b-0 hover:bg-stone-50/60 dark:border-zinc-900/70 dark:hover:bg-zinc-900/30"
                      >
                        <td className="px-5 py-4 lg:px-6">
                          <div className="font-medium text-stone-900 dark:text-zinc-50">{u.name ?? u.email}</div>
                          <div className="mt-0.5 max-w-[180px] truncate font-mono text-[11px] text-stone-500 dark:text-zinc-500 md:hidden">
                            {u.email}
                          </div>
                        </td>
                        <td className="hidden py-4 font-mono text-[12px] text-stone-600 dark:text-zinc-400 md:table-cell">
                          {u.email}
                        </td>
                        <td className="py-4">
                          <RoleBadge role={u.role} />
                        </td>
                        <td className="py-4 text-right font-mono text-[12px] tabular-nums text-stone-900 dark:text-zinc-50">
                          {fmtShares(shares)}
                        </td>
                        <td className="py-4 text-right font-mono text-[12px] tabular-nums text-stone-700 dark:text-zinc-300">
                          {fmtUSD(valuation)}
                        </td>
                        <td className="hidden py-4 font-mono text-[11px] text-stone-500 dark:text-zinc-500 lg:table-cell">
                          {fmtDateTimeHKT(u.last_change_at)}
                        </td>
                        <td className="py-4 pr-5 text-right lg:pr-6">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAdjustTarget(u);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-1.5 text-[11px] font-medium text-stone-50 transition-colors hover:bg-stone-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                          >
                            {icon}
                            调整份额
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-stone-100 px-5 py-3 text-[10px] uppercase tracking-[0.12em] text-stone-400 dark:border-zinc-900 dark:text-zinc-600 lg:px-6">
            <span>共 {users.length} 条记录</span>
            <span className="hidden items-center gap-1.5 sm:flex">
              <span>NAV</span>
              <span className="font-mono normal-case tracking-normal text-stone-600 dark:text-zinc-400">
                {currentNav.toFixed(4)}
              </span>
              <span>· HKT</span>
            </span>
          </div>
        </div>
      </div>

      {adjustTarget && (
        <AdjustDialog
          user={adjustTarget}
          currentNav={currentNav}
          onClose={() => setAdjustTarget(null)}
          onAdjusted={onAdjusted}
        />
      )}
      {historyTarget && <HistoryDrawer user={historyTarget} onClose={() => setHistoryTarget(null)} />}
    </div>
  );
}
