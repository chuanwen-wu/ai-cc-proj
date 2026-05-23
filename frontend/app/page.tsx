import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";

export default async function Home() {
  const session = await auth();
  if (session?.backendToken) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold">ai-cc-proj</h1>
      <p className="mt-2 text-gray-600">Web3 理财产品 · 请登录以继续</p>

      <div className="mt-10 rounded-lg border bg-white p-6 shadow-sm">
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
      </div>
    </main>
  );
}
