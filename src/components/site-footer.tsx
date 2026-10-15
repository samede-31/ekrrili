"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <footer className="border-t border-[#e2e8e3] bg-white px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-start">
        <Link href="/" className="text-sm font-extrabold text-[#176744]">اكريلي · EKRRILI</Link>
        <nav aria-label="روابط السوق والدعم" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-[#637168]">
          <Link href="/stores" className="hover:text-[#176744]">متاجر PRO</Link>
          <Link href="/privacy" className="hover:text-[#176744]">سياسة الخصوصية</Link>
          <Link href="/terms" className="hover:text-[#176744]">الشروط والأحكام</Link>
          <Link href="/support" className="hover:text-[#176744]">المساعدة والدعم</Link>
        </nav>
        <span className="max-w-xl text-center text-[10px] leading-5 text-[#8a968e]">© اكريلي — منصة إعلانات مبوبة فقط. رسوم التمييز واشتراك PRO خدمات إعلانية للمنصة؛ أما أموال الكراء والضمان والبضائع فلا تمر عبر اكريلي.</span>
      </div>
    </footer>
  );
}
