import { auth, signIn, signOut } from "@/auth";

const INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? "http://backend:8000";

type Me = {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
};

async function fetchMe(token: string): Promise<Me | null> {
  try {
    const res = await fetch(`${INTERNAL_API_URL}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Me;
  } catch {
    return null;
  }
}

async function pingAdmin(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${INTERNAL_API_URL}/api/v1/admin/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function Home() {
  const session = await auth();
  const me = session?.backendToken ? await fetchMe(session.backendToken) : null;
  const adminOk = session?.backendToken && me?.role === "admin"
    ? await pingAdmin(session.backendToken)
    : false;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold">ai-cc-proj</h1>
      <p className="mt-2 text-gray-600">Web3 理财产品 · 骨架页面</p>

      <div className="mt-10 rounded-lg border bg-white p-6 shadow-sm">
        {session?.user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {session.user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name ?? ""}
                  className="h-10 w-10 rounded-full"
                />
              )}
              <div>
                <div className="font-medium">{session.user.name}</div>
                <div className="text-sm text-gray-500">{session.user.email}</div>
              </div>
            </div>

            <div className="space-y-1 rounded-md bg-gray-50 p-3 text-sm">
              <div>
                <span className="text-gray-500">Backend JWT:</span>{" "}
                {session.backendToken ? "✅ 已签发" : "⚠️ 未签发"}
              </div>
              {me && (
                <div>
                  <span className="text-gray-500">Role:</span>{" "}
                  <span
                    className={
                      me.role === "admin"
                        ? "rounded bg-purple-100 px-2 py-0.5 font-medium text-purple-700"
                        : "rounded bg-gray-200 px-2 py-0.5 font-medium text-gray-700"
                    }
                  >
                    {me.role}
                  </span>
                </div>
              )}
              {me?.role === "admin" && (
                <div>
                  <span className="text-gray-500">/admin/ping:</span>{" "}
                  {adminOk ? "✅ 200" : "❌ 失败"}
                </div>
              )}
            </div>

            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button
                type="submit"
                className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
              >
                退出登录
              </button>
            </form>
          </div>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("google");
            }}
          >
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500"
            >
              使用 Google 登录
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
