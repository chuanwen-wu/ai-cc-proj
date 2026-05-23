export const toNumber = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export const fmtShares = (n: number): string =>
  n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export const fmtUSD = (n: number): string =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtPct = (n: number): string => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";

export const fmtSignedUSD = (n: number): string =>
  (n >= 0 ? "+" : "-") +
  "$" +
  Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtNav = (n: number): string =>
  n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export const fmtDateHKT = (iso: string): string => {
  // iso is YYYY-MM-DD; treat as UTC midnight then add 8h for HKT display
  const d = new Date(iso + "T00:00:00Z");
  const hkt = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return hkt.toISOString().slice(0, 10);
};

export const fmtDateShort = (iso: string): string => {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};

export const greeting = (): string => {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
};
