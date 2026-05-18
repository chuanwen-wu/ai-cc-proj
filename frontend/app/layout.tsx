import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ai-cc-proj",
  description: "Web3 wealth product",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
