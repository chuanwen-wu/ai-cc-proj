"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  KeyRound,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import {
  createAccount,
  deleteAccount,
  runPipelineRange,
  setAccountActive,
  type BitfinexAccount,
  type PipelineRangeResult,
} from "./actions";
import { fmtDateTimeHKT } from "./format";

type Props = { initial: BitfinexAccount[] };

const inputClass =
  "w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:border-stone-500 focus:outline-none dark:border-zinc-800 dark:bg-[#0a0b0e] dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600";

function StatusBadge({ active }: { active: boolean }) {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200/70 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
        ACTIVE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-stone-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-stone-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
      <span className="h-1.5 w-1.5 rounded-full bg-stone-400 dark:bg-zinc-600" />
      PAUSED
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// Create Dialog
// ─────────────────────────────────────────────────────────────────
function CreateDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (a: BitfinexAccount) => void;
}) {
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
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

  const labelValid = label.trim().length >= 1;
  const keyValid = apiKey.trim().length >= 10;
  const secretValid = apiSecret.trim().length >= 10;
  const canSubmit = labelValid && keyValid && secretValid && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createAccount(label.trim(), apiKey.trim(), apiSecret.trim());
      onCreated(created);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
      setSubmitting(false);
    }
  };

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
              NEW ACCOUNT
            </div>
            <h3 className="font-display text-2xl leading-none tracking-tight text-stone-900 dark:text-zinc-50">
              新增 Bitfinex 账号
            </h3>
            <p className="mt-2 text-[12px] leading-relaxed text-stone-500 dark:text-zinc-500">
              密钥提交后以加密形式存储，列表中仅展示后 4 位，明文不再回显。
            </p>
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
              标签 <span className="ml-1 normal-case text-rose-600 dark:text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例如：主账号 / sub-account-1"
              maxLength={100}
              className={inputClass}
            />
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <label className="block text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500">
                API Key <span className="ml-1 normal-case text-rose-600 dark:text-rose-400">*</span>
              </label>
              <span
                className={`font-mono text-[10px] ${keyValid ? "text-stone-400 dark:text-zinc-600" : "text-rose-500 dark:text-rose-400"}`}
              >
                {apiKey.trim().length} / 10+
              </span>
            </div>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="粘贴 Bitfinex API Key"
              maxLength={200}
              className={inputClass + " font-mono"}
            />
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <label className="block text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500">
                API Secret <span className="ml-1 normal-case text-rose-600 dark:text-rose-400">*</span>
              </label>
              <span
                className={`font-mono text-[10px] ${secretValid ? "text-stone-400 dark:text-zinc-600" : "text-rose-500 dark:text-rose-400"}`}
              >
                {apiSecret.trim().length} / 10+
              </span>
            </div>
            <input
              type="password"
              autoComplete="off"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="粘贴 Bitfinex API Secret"
              maxLength={200}
              className={inputClass + " font-mono"}
            />
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
            {submitting ? "提交中…" : "确认新增"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Delete Confirm Dialog
// ─────────────────────────────────────────────────────────────────
function DeleteDialog({
  account,
  onClose,
  onDeleted,
}: {
  account: BitfinexAccount;
  onClose: () => void;
  onDeleted: (id: number) => void;
}) {
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

  const handleDelete = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await deleteAccount(account.id);
      onDeleted(account.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm dark:bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-[#e7e5e0] bg-white shadow-2xl dark:border-[#22232a] dark:bg-[#101115]"
      >
        <div className="p-6">
          <div className="mb-4 inline-flex rounded-xl bg-rose-50 p-2.5 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
            <Trash2 size={18} />
          </div>
          <h3 className="font-display text-xl leading-tight tracking-tight text-stone-900 dark:text-zinc-50">
            删除账号「{account.label}」？
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-stone-500 dark:text-zinc-500">
            删除后该账号的加密密钥将被永久移除，pipeline 不再使用它拉取数据。此操作不可撤销。
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400">
              <div className="flex items-center gap-2">
                <AlertCircle size={13} />
                <span>{error}</span>
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
            onClick={handleDelete}
            disabled={submitting}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-rose-600 dark:hover:bg-rose-500"
          >
            {submitting ? "删除中…" : "确认删除"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Manual Pipeline Pull / Recompute Panel
// ─────────────────────────────────────────────────────────────────
const fmtNav = (s: string | null): string => (s ? Number(s).toFixed(6) : "—");
const fmtAmount = (s: string | null): string =>
  s ? Number(s).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

function RunPipelinePanel({ hasActiveAccount }: { hasActiveAccount: boolean }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [today, setToday] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PipelineRangeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 默认区间 = 最近 7 天（含今天，UTC 自然日）；放到 mount 后再设，避免 SSR/CSR 时间不一致
  useEffect(() => {
    const t = new Date().toISOString().slice(0, 10);
    const s = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
    setToday(t);
    setStart(s);
    setEnd(t);
  }, []);

  const rangeValid = start !== "" && end !== "" && start <= end;
  const dayCount =
    rangeValid && start && end
      ? Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1
      : 0;

  const handleRun = async () => {
    setConfirming(false);
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await runPipelineRange(start, end);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "拉取失败");
    } finally {
      setRunning(false);
    }
  };

  const inputDateClass =
    "rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 transition-colors focus:border-stone-500 focus:outline-none dark:border-zinc-800 dark:bg-[#0a0b0e] dark:text-zinc-100 dark:focus:border-zinc-600";

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-[#e7e5e0] bg-white dark:border-[#22232a] dark:bg-[#101115]">
      <div className="border-b border-stone-100 p-5 dark:border-zinc-900 lg:p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-stone-100 text-stone-700 dark:bg-zinc-900/80 dark:text-zinc-300">
            <Download size={14} strokeWidth={1.8} />
          </span>
          <h2 className="font-display text-xl leading-none tracking-tight text-stone-900 dark:text-zinc-50">
            手动拉取 / 重算 funding
          </h2>
        </div>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-stone-500 dark:text-zinc-500">
          按 UTC 自然日逐日拉取所有 <span className="font-medium text-stone-700 dark:text-zinc-300">ACTIVE</span> 账号的资金费、重算 NAV 与份额分配，
          <span className="font-medium text-rose-600 dark:text-rose-400">覆盖区间内已有数据</span>。适用于新增账号后补拉、或参数调整后重算。
        </p>
      </div>

      <div className="p-5 lg:p-6">
        {!hasActiveAccount && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400">
            <AlertTriangle size={14} />
            当前没有 ACTIVE 账号，拉取结果的资金费会是 0。请先新增并启用账号。
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500">
              开始日期
            </label>
            <input
              type="date"
              lang="en-CA"
              value={start}
              max={end || today}
              onChange={(e) => setStart(e.target.value)}
              className={inputDateClass}
            />
          </div>
          <span className="pb-2.5 text-stone-400 dark:text-zinc-600">→</span>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500">
              结束日期
            </label>
            <input
              type="date"
              lang="en-CA"
              value={end}
              min={start}
              max={today}
              onChange={(e) => setEnd(e.target.value)}
              className={inputDateClass}
            />
          </div>
          <button
            onClick={() => setConfirming(true)}
            disabled={!rangeValid || running}
            className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2.5 text-[12px] font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-stone-900 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:hover:bg-zinc-50"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} strokeWidth={2.2} />}
            {running ? "拉取中…" : "拉取并重算"}
          </button>
          {rangeValid && !running && (
            <span className="pb-2.5 font-mono text-[11px] text-stone-400 dark:text-zinc-600">共 {dayCount} 天</span>
          )}
          {start !== "" && end !== "" && !rangeValid && (
            <span className="flex items-center gap-1 pb-2.5 text-[11px] text-rose-600 dark:text-rose-400">
              <AlertCircle size={11} /> 开始日期不能晚于结束日期
            </span>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400">
            <div className="flex items-center gap-2">
              <AlertCircle size={13} /> 拉取失败：{error}
            </div>
          </div>
        )}

        {result && (
          <div className="mt-5">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px]">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200/70 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400">
                <CheckCircle2 size={13} /> 完成
              </span>
              <span className="font-mono text-stone-500 dark:text-zinc-500">
                处理 {result.total_days} 天 · 计算 {result.computed_days} 天 · 跳过 {result.skipped_days} 天
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-stone-100 dark:border-zinc-900">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-stone-50 dark:bg-[#0a0b0e]">
                  <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-stone-500 dark:text-zinc-500">
                    <th className="px-4 py-2.5 font-medium">日期</th>
                    <th className="py-2.5 text-right font-medium">Raw 收益</th>
                    <th className="py-2.5 text-right font-medium">Final NAV</th>
                    <th className="px-4 py-2.5 text-right font-medium">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((d) => (
                    <tr
                      key={d.date}
                      className="border-t border-stone-50 dark:border-zinc-900/70"
                    >
                      <td className="px-4 py-2 font-mono text-[12px] text-stone-700 dark:text-zinc-300">{d.date}</td>
                      <td className="py-2 text-right font-mono text-[12px] tabular-nums text-stone-700 dark:text-zinc-300">
                        {d.skipped ? "—" : fmtAmount(d.raw_earnings)}
                      </td>
                      <td className="py-2 text-right font-mono text-[12px] tabular-nums text-stone-900 dark:text-zinc-50">
                        {d.skipped ? "—" : fmtNav(d.final_nav)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {d.skipped ? (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400 dark:text-zinc-600">
                            跳过·无份额
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            已计算
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {confirming && (
        <ConfirmRunDialog
          start={start}
          end={end}
          dayCount={dayCount}
          onClose={() => setConfirming(false)}
          onConfirm={handleRun}
        />
      )}
    </div>
  );
}

function ConfirmRunDialog({
  start,
  end,
  dayCount,
  onClose,
  onConfirm,
}: {
  start: string;
  end: string;
  dayCount: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm dark:bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[440px] overflow-hidden rounded-2xl border border-[#e7e5e0] bg-white shadow-2xl dark:border-[#22232a] dark:bg-[#101115]"
      >
        <div className="p-6">
          <div className="mb-4 inline-flex rounded-xl bg-amber-50 p-2.5 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
            <AlertTriangle size={18} />
          </div>
          <h3 className="font-display text-xl leading-tight tracking-tight text-stone-900 dark:text-zinc-50">
            确认拉取并重算？
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-stone-500 dark:text-zinc-500">
            将逐日重算{" "}
            <span className="font-mono font-medium text-stone-900 dark:text-zinc-100">
              {start} → {end}
            </span>{" "}
            （共 {dayCount} 天），并<span className="font-medium text-rose-600 dark:text-rose-400">覆盖该区间内已有的资金费、NAV 与平台费份额</span>。此操作不可撤销。
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-stone-100 p-6 pt-4 dark:border-zinc-900">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            确认拉取
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────
export default function BitfinexAccountsDashboard({ initial }: Props) {
  const [accounts, setAccounts] = useState<BitfinexAccount[]>(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BitfinexAccount | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const activeCount = accounts.filter((a) => a.active).length;

  const onCreated = (a: BitfinexAccount) => setAccounts((curr) => [...curr, a]);
  const onDeleted = (id: number) => setAccounts((curr) => curr.filter((a) => a.id !== id));

  const toggleActive = (a: BitfinexAccount) => {
    setPendingId(a.id);
    startTransition(async () => {
      try {
        const updated = await setAccountActive(a.id, !a.active);
        setAccounts((curr) => curr.map((x) => (x.id === updated.id ? updated : x)));
      } catch {
        // 失败保持原状
      } finally {
        setPendingId(null);
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#fafaf7] text-stone-900 transition-colors dark:bg-[#08090b] dark:text-zinc-100">
      <div className="mx-auto max-w-[1480px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <div className="mb-8 flex flex-col gap-6 lg:mb-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 font-mono text-[10px] tracking-[0.2em] text-stone-500 dark:text-zinc-500">
              ADMIN · BITFINEX ACCOUNTS
            </div>
            <h1 className="font-display text-4xl leading-[1.05] tracking-tight text-stone-900 dark:text-zinc-50 lg:text-5xl">
              Bitfinex 账号<span className="italic text-stone-400 dark:text-zinc-600"> / </span>密钥管理
            </h1>
            <p className="mt-2 max-w-lg text-sm text-stone-500 dark:text-zinc-500">
              管理 pipeline 拉取资金费所用的 API 密钥 · 密钥加密存储 · 仅展示后 4 位
            </p>
          </div>
          <div className="flex items-center gap-5 font-mono text-xs">
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500">
                ACTIVE
              </span>
              <span className="mt-0.5 text-sm text-stone-900 dark:text-zinc-50">
                {activeCount} / {accounts.length}
              </span>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2.5 text-[12px] font-medium text-stone-50 transition-colors hover:bg-stone-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus size={14} strokeWidth={2.4} />
              新增账号
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#e7e5e0] bg-white dark:border-[#22232a] dark:bg-[#101115]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left text-[10px] uppercase tracking-[0.12em] text-stone-500 dark:border-zinc-900 dark:text-zinc-500">
                  <th className="px-5 py-3.5 font-medium lg:px-6">标签</th>
                  <th className="py-3.5 font-medium">API Key</th>
                  <th className="py-3.5 font-medium">状态</th>
                  <th className="hidden py-3.5 font-medium lg:table-cell">创建时间</th>
                  <th className="py-3.5 pr-5 text-right font-medium lg:pr-6">操作</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-sm text-stone-400 dark:text-zinc-600">
                      还没有任何 Bitfinex 账号，点击右上角「新增账号」录入。
                    </td>
                  </tr>
                ) : (
                  accounts.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-stone-50 transition-colors last:border-b-0 hover:bg-stone-50/60 dark:border-zinc-900/70 dark:hover:bg-zinc-900/30"
                    >
                      <td className="px-5 py-4 lg:px-6">
                        <div className="flex items-center gap-2.5">
                          <span className="text-stone-400 dark:text-zinc-600">
                            <KeyRound size={14} strokeWidth={1.8} />
                          </span>
                          <span className="font-medium text-stone-900 dark:text-zinc-50">{a.label}</span>
                        </div>
                      </td>
                      <td className="py-4 font-mono text-[12px] text-stone-600 dark:text-zinc-400">
                        {a.api_key_masked || "—"}
                      </td>
                      <td className="py-4">
                        <StatusBadge active={a.active} />
                      </td>
                      <td className="hidden py-4 font-mono text-[11px] text-stone-500 dark:text-zinc-500 lg:table-cell">
                        {fmtDateTimeHKT(a.created_at)}
                      </td>
                      <td className="py-4 pr-5 text-right lg:pr-6">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleActive(a)}
                            disabled={pendingId === a.id}
                            className="rounded-lg border border-stone-200 px-3 py-1.5 text-[11px] font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                          >
                            {pendingId === a.id ? "…" : a.active ? "停用" : "启用"}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(a)}
                            className="inline-flex items-center rounded-lg border border-transparent p-1.5 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                            aria-label="删除"
                          >
                            <Trash2 size={15} strokeWidth={1.8} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-stone-100 px-5 py-3 text-[10px] uppercase tracking-[0.12em] text-stone-400 dark:border-zinc-900 dark:text-zinc-600 lg:px-6">
            <span>共 {accounts.length} 个账号</span>
            <span className="hidden sm:inline">仅 ACTIVE 账号参与 pipeline</span>
          </div>
        </div>

        <RunPipelinePanel hasActiveAccount={activeCount > 0} />
      </div>

      {showCreate && <CreateDialog onClose={() => setShowCreate(false)} onCreated={onCreated} />}
      {deleteTarget && (
        <DeleteDialog
          account={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}
