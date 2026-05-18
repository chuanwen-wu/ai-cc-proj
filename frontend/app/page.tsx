import { auth, signIn, signOut } from "@/auth";

export default async function Home() {
  const session = await auth();

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
            <div className="text-xs text-gray-500">
              Backend JWT: {session.backendToken ? "✅ 已签发" : "⚠️ 未签发，检查后端 /api/v1/auth/google"}
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
