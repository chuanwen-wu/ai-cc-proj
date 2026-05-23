import { redirect } from "next/navigation";

import { auth } from "@/auth";

import EarningsDashboard from "./EarningsDashboard";
import { fetchSeries, fetchSummary } from "./actions";

const INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? "http://backend:8000";

async function getRole(token: string): Promise<string | null> {
  try {
    const r = await fetch(`${INTERNAL_API_URL}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const u = (await r.json()) as { role: string };
    return u.role;
  } catch {
    return null;
  }
}

export default async function AdminEarningsPage() {
  const session = await auth();
  if (!session?.backendToken) redirect("/");
  const role = await getRole(session.backendToken);
  if (role !== "admin") redirect("/");

  // 一次性拉所有 series（最多 365 天足够前端切 7/30/90/全部）
  const [summary, series] = await Promise.all([fetchSummary(), fetchSeries(365)]);

  return <EarningsDashboard summary={summary} series={series} />;
}
