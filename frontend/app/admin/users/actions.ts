"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";

const API = process.env.INTERNAL_API_URL ?? "http://backend:8000";

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
  return (await r.json()) as T;
}

export type UserRow = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  shares: string;
  valuation: string;
  last_change_at: string | null;
};

export type UsersListResponse = {
  items: UserRow[];
  total: number;
  page: number;
  page_size: number;
  current_nav: string;
};

export type TxRow = {
  id: number;
  change_amount: string;
  change_type: string;
  reason: string;
  operator_email: string | null;
  related_date: string | null;
  created_at: string;
};

export type TxPage = {
  items: TxRow[];
  total: number;
  page: number;
  page_size: number;
};

export type AdjustLabel = "认购入金" | "赎回出金" | "修正" | "其他";

export async function fetchUsers(search: string, page = 1, pageSize = 50): Promise<UsersListResponse> {
  const params = new URLSearchParams({
    search,
    page: String(page),
    page_size: String(pageSize),
  });
  return call<UsersListResponse>(`/api/v1/admin/users?${params.toString()}`);
}

export async function fetchUserTransactions(userId: number, page = 1): Promise<TxPage> {
  return call<TxPage>(`/api/v1/admin/users/${userId}/transactions?page=${page}&page_size=100`);
}

export async function adjustShares(
  userId: number,
  changeAmount: string,
  type: AdjustLabel,
  reason: string,
): Promise<UserRow> {
  const updated = await call<UserRow>(`/api/v1/admin/users/${userId}/shares`, {
    method: "POST",
    body: JSON.stringify({ change_amount: changeAmount, type, reason }),
  });
  revalidatePath("/admin/users");
  return updated;
}
