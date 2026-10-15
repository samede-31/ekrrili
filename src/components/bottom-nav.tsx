"use client";

import { FileText, House, PlusSquare, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "الرئيسية", icon: House },
  { href: "/list-an-item", label: "أضف إعلان", icon: PlusSquare },
  { href: "/agreement-demo", label: "العقود", icon: FileText },
  { href: "/dashboard", label: "حسابي", icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="app-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-[#e3e9e4] bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_rgba(24,49,32,0.08)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[10px] font-bold transition-colors",
                  active ? "text-[#176744]" : "text-[#77847b] hover:bg-[#f5f8f5]",
                )}
              >
                <Icon size={21} strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
