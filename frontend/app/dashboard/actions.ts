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

export type MeSummary = {
  shares: string;
  current_nav: string;
  valuation: string;
  cost_basis: string;
  cumulative_return: string;
  cumulative_return_pct: string | null;
  today_change: string | null;
  today_change_pct: string | null;
  has_history: boolean;
};

export type MeSeriesPoint = {
  date: string;
  shares: string;
  nav: string;
  valuation: string;
  cumulative_return_pct: string | null;
};

export type MeHistoryRow = {
  date: string;
  shares: string;
  nav: string;
  valuation: string;
  day_change: string | null;
  day_change_pct: string | null;
};

export type MeHistoryPage = {
  items: MeHistoryRow[];
  total: number;
  page: number;
  page_size: number;
};

export type MeUser = {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: string;
};

export async function fetchMeSummary(): Promise<MeSummary> {
  return call<MeSummary>("/api/v1/me/summary");
}

export async function fetchMeSeries(days: number): Promise<MeSeriesPoint[]> {
  return call<MeSeriesPoint[]>(`/api/v1/me/series?days=${days}`);
}

export async function fetchMeHistory(page = 1, pageSize = 20): Promise<MeHistoryPage> {
  return call<MeHistoryPage>(`/api/v1/me/history?page=${page}&page_size=${pageSize}`);
}

export async function fetchMe(): Promise<MeUser> {
  return call<MeUser>("/api/v1/users/me");
}
