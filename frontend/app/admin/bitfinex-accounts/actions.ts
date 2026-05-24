"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";

const API = process.env.INTERNAL_API_URL ?? "http://backend:8000";
const BASE = "/api/v1/admin/bitfinex-accounts";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await auth();
  if (!session?.backendToken) throw new Error("Not authenticated");
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${session.backendToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!r.ok) {
    let detail = `${r.status}`;
    try {
      const body = await r.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      // ignore parse error
    }
    throw new Error(detail);
  }
  // DELETE 返回 204 无 body
  if (r.status === 204) return undefined as T;
  return (await r.json()) as T;
}

export type BitfinexAccount = {
  id: number;
  label: string;
  api_key_masked: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export async function fetchAccounts(): Promise<BitfinexAccount[]> {
  return call<BitfinexAccount[]>(BASE);
}

export async function createAccount(
  label: string,
  apiKey: string,
  apiSecret: string,
): Promise<BitfinexAccount> {
  const created = await call<BitfinexAccount>(BASE, {
    method: "POST",
    body: JSON.stringify({ label, api_key: apiKey, api_secret: apiSecret }),
  });
  revalidatePath("/admin/bitfinex-accounts");
  return created;
}

export async function setAccountActive(id: number, active: boolean): Promise<BitfinexAccount> {
  const updated = await call<BitfinexAccount>(`${BASE}/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
  revalidatePath("/admin/bitfinex-accounts");
  return updated;
}

export async function deleteAccount(id: number): Promise<void> {
  await call<void>(`${BASE}/${id}`, { method: "DELETE" });
  revalidatePath("/admin/bitfinex-accounts");
}

export type PipelineDayResult = {
  date: string;
  skipped: boolean;
  raw_earnings: string | null;
  platform_fee: string | null;
  gross_nav: string | null;
  final_nav: string | null;
  admin_shares_issued: string | null;
  message: string;
};

export type PipelineRangeResult = {
  start_date: string;
  end_date: string;
  total_days: number;
  computed_days: number;
  skipped_days: number;
  results: PipelineDayResult[];
};

export async function runPipelineRange(
  startDate: string,
  endDate: string,
): Promise<PipelineRangeResult> {
  const res = await call<PipelineRangeResult>("/api/v1/admin/pipeline/run-range", {
    method: "POST",
    body: JSON.stringify({ start_date: startDate, end_date: endDate }),
  });
  // pipeline 重算会改 NAV / 收益数据，顺带让相关页面失效
  revalidatePath("/admin/bitfinex-accounts");
  revalidatePath("/admin/earnings");
  return res;
}
