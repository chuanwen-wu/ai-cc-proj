"use server";

import { auth } from "@/auth";

const API = process.env.INTERNAL_API_URL ?? "http://backend:8000";

async function call<T>(path: string): Promise<T> {
  const session = await auth();
  if (!session?.backendToken) throw new Error("Not authenticated");
  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${session.backendToken}` },
    cache: "no-store",
  });
  if (!r.ok) {
    throw new Error(`API ${path} failed: ${r.status}`);
  }
  return (await r.json()) as T;
}

export type Summary = {
  current_nav: string | null;
  current_nav_change_pct: string | null;
  today_raw_earnings: string | null;
  today_raw_change_pct: string | null;
  cumulative_platform_fee: string;
  total_aum: string | null;
  total_aum_change_pct: string | null;
  latest_date: string | null;
};

export type SeriesPoint = {
  date: string;
  nav: string;
  raw: string;
  fee: string;
  net: string;
  gross_nav: string;
  final_nav: string;
  aum_start: string;
  aum_end: string;
};

export type BreakdownRow = {
  account_id: number;
  account_label: string;
  currency: string;
  amount: string;
};

export async function fetchSummary(): Promise<Summary> {
  return call<Summary>("/api/v1/admin/earnings/summary");
}

export async function fetchSeries(days: number): Promise<SeriesPoint[]> {
  return call<SeriesPoint[]>(`/api/v1/admin/earnings/series?days=${days}`);
}

export async function fetchBreakdown(date: string): Promise<BreakdownRow[]> {
  return call<BreakdownRow[]>(`/api/v1/admin/earnings/history/${date}/breakdown`);
}
