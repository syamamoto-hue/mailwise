"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "ダッシュボード", icon: "📊" },
  { href: "/webinars", label: "ウェビナー一覧", icon: "📋" },
  { href: "/calendar", label: "カレンダー", icon: "🗓️" },
  { href: "/templates", label: "マスターテンプレート", icon: "🧩" },
  { href: "/import", label: "CSV取込 / 書出", icon: "📥" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="w-56 shrink-0 bg-slate-900 text-slate-300 flex flex-col">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="text-lg font-bold text-white">
          Webinar<span className="text-brand"> ToDo</span>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-white/30 mt-0.5">
          ウェビナー準備管理
        </div>
      </div>
      <nav className="flex-1 py-3">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex items-center gap-3 px-5 py-2.5 text-[13.5px] border-l-[3px] transition-colors ${
              isActive(n.href)
                ? "bg-brand/10 text-brand border-brand font-semibold"
                : "border-transparent text-white/60 hover:bg-white/5 hover:text-white/90"
            }`}
          >
            <span className="w-5 text-center">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="px-5 py-3 text-[10px] text-white/25 border-t border-white/10">
        社内利用 / ログインなし
      </div>
    </aside>
  );
}
