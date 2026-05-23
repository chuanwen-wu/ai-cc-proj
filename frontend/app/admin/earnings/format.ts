/** USD currency formatting helpers shared by all admin-earnings client UI. */

export const toNumber = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export const fmtMoney = (n: number, digits = 2): string =>
  "$" +
  n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const fmtCompact = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return "$" + (n / 1e3).toFixed(2) + "K";
  return fmtMoney(n, 2);
};

export const fmtPct = (n: number): string => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";

export const fmtDateShort = (iso: string): string => {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};
