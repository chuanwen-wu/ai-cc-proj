import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? "http://backend:8000";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // 首次登录：用 Google id_token 换后端 JWT
      if (account?.id_token) {
        try {
          const res = await fetch(`${INTERNAL_API_URL}/api/v1/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id_token: account.id_token }),
          });
          if (res.ok) {
            const data = (await res.json()) as { access_token: string };
            token.backendToken = data.access_token;
          } else {
            console.error("Backend auth exchange failed:", await res.text());
          }
        } catch (e) {
          console.error("Backend auth exchange error:", e);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.backendToken) {
        session.backendToken = token.backendToken as string;
      }
      return session;
    },
  },
});
