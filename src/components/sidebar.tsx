"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "◈" },
  { href: "/memory", label: "Business Memory", icon: "◎" },
  { href: "/import", label: "CSV Import", icon: "↑" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-text">
      <div className="border-b border-white/10 px-6 py-5">
        <h1 className="text-lg font-semibold text-white">Business Memory</h1>
        <p className="mt-1 text-xs text-sidebar-text/70">
          Notes &amp; AI assistant
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-active font-medium text-white"
                  : "hover:bg-sidebar-active/60 hover:text-white"
              }`}
            >
              <span className="text-base opacity-80">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4 text-xs text-sidebar-text/50">
        Powered by Supabase &amp; OpenAI
      </div>
    </aside>
  );
}
