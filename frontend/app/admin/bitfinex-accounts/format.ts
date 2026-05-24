export const fmtDateTimeHKT = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  // UTC ms + 8h → HKT
  const hkt = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return hkt.toISOString().slice(0, 16).replace("T", " ");
};
