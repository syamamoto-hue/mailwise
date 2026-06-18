import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mailwise 統合送信用リスト作成",
  description: "複数CSVから統合送信用リストを作成するWebアプリ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <nav className="nav">
          <span className="brand">Mailwise リスト統合</span>
          <Link href="/">CSVアップロード</Link>
          <Link href="/ng">配信NG管理</Link>
          <Link href="/fixed-ng">固定NG管理</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
