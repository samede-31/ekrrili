import Link from "next/link";
import { ArrowRight, CircleHelp, FileText, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

const legalPages = {
  privacy: {
    title: "سياسة الخصوصية",
    description: "كيف نتعامل مع معلوماتك عند استخدام اكريلي.",
    icon: ShieldCheck,
  },
  terms: {
    title: "الشروط والأحكام",
    description: "قواعد استخدام المنصة ومسؤوليات أطراف الكراء.",
    icon: FileText,
  },
  support: {
    title: "المساعدة والدعم",
    description: "إجابات سريعة عن الكراء والتأمين والنزاعات.",
    icon: CircleHelp,
  },
} as const;

export function LegalPage({
  page,
  children,
}: {
  page: keyof typeof legalPages;
  children: ReactNode;
}) {
  const { title, description, icon: Icon } = legalPages[page];

  return (
    <main dir="rtl" lang="ar" className="min-h-[70vh] bg-[#f7f8f6] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-[#52645a] hover:text-[#176744]">
          <ArrowRight size={16} aria-hidden="true" /> العودة إلى السوق
        </Link>
        <header className="mb-6 rounded-3xl bg-[#176744] p-6 text-white sm:p-9">
          <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Icon size={24} aria-hidden="true" />
          </span>
          <p className="text-[10px] font-bold tracking-[.18em] text-white/70">EKRRILI · اكريلي</p>
          <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm leading-7 text-white/80">{description}</p>
        </header>
        <article className="space-y-6 rounded-3xl border border-[#e4eae5] bg-white p-5 text-sm leading-8 text-[#435148] shadow-sm sm:p-9">
          {children}
        </article>
        <p className="mt-4 text-center text-[10px] text-[#829087]">آخر تحديث: 15 أكتوبر 2026</p>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-extrabold text-[#17231d]">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
