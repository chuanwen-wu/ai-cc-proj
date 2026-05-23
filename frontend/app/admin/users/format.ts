export const toNumber = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export const fmtShares = (n: number): string =>
  n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export const fmtUSD = (n: number): string =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtSignedShares = (n: number): string =>
  (n >= 0 ? "+" : "") + fmtShares(n);

export const fmtSignedUSD = (n: number): string =>
  (n >= 0 ? "+" : "-") +
  "$" +
  Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDateTimeHKT = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  // UTC ms + 8h → HKT
  const hkt = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return hkt.toISOString().slice(0, 16).replace("T", " ");
};
