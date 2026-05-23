import { redirect } from "next/navigation";

import { auth } from "@/auth";

import DashboardOverview from "./DashboardOverview";
import { fetchMe, fetchMeSeries, fetchMeSummary } from "./actions";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.backendToken) redirect("/");

  const [user, summary, series] = await Promise.all([
    fetchMe(),
    fetchMeSummary(),
    fetchMeSeries(7),
  ]);

  return <DashboardOverview user={user} summary={summary} series={series} />;
}
