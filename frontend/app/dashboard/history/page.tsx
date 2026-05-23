import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { fetchMeHistory, fetchMeSeries } from "../actions";
import HistoryDetail from "./HistoryDetail";

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.backendToken) redirect("/");

  // 拉 365 天足够前端切 7/30/90/全部；再拉第一页分页数据
  const [series, history] = await Promise.all([
    fetchMeSeries(365),
    fetchMeHistory(1, 20),
  ]);

  return <HistoryDetail series={series} history={history} />;
}
