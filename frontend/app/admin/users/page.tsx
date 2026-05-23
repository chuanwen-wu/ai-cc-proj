import { redirect } from "next/navigation";

import { auth } from "@/auth";

import UsersDashboard from "./UsersDashboard";
import { fetchUsers } from "./actions";

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

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.backendToken) redirect("/");
  const role = await getRole(session.backendToken);
  if (role !== "admin") redirect("/");

  const initial = await fetchUsers("");
  return <UsersDashboard initial={initial} />;
}
