"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "파형 분석" },
  { href: "/simulator", label: "센서 연결" },
  { href: "/models", label: "모델" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-white/8 bg-[#080c10]">
        <div className="border-b border-white/8 px-5 py-5">
          <p className="text-[11px] tracking-[0.18em] text-sky-400/80 uppercase">Analytics</p>
          <h1 className="mt-1 text-lg font-semibold text-zinc-50">센서 분석</h1>
          <p className="mt-1 text-xs text-zinc-500">InfluxDB · MLflow</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm ${
                  active ? "bg-sky-500/15 text-sky-200" : "text-zinc-400 hover:bg-white/4 hover:text-zinc-200"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <a href="http://localhost:3000" className="px-5 py-4 text-[11px] text-zinc-600 hover:text-zinc-400">
          MES로 돌아가기
        </a>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
