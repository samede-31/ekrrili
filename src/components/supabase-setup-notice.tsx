import Link from "next/link";

export function SupabaseSetupNotice() {
  return (
    <main dir="rtl" lang="ar" className="flex min-h-screen items-center justify-center bg-[#f7f8f6] px-4 py-10">
      <section className="w-full max-w-lg rounded-3xl border border-[#e2e8e3] bg-white p-7 shadow-sm sm:p-9">
        <Link href="/" className="text-sm font-bold text-[#17734e]">اكريلي · EKRILLI</Link>
        <h1 className="mt-5 text-2xl font-extrabold text-[#17231d]">إعداد Supabase مطلوب</h1>
        <p className="mt-3 text-sm leading-7 text-[#65736b]">
          أضف بيانات مشروعك إلى <code dir="ltr" className="inline-block rounded bg-[#f2f5f2] px-1.5">.env.local</code>
          {" "}ثم شغّل ملفات الترحيل الموجودة في{" "}
          <code dir="ltr" className="inline-block rounded bg-[#f2f5f2] px-1.5">supabase/migrations</code>.
        </p>
        <p className="mt-4 rounded-xl bg-[#f3f8f4] p-4 text-xs leading-6 text-[#52645a]">
          المتغيرات المطلوبة: <code dir="ltr">NEXT_PUBLIC_SUPABASE_URL</code> و
          {" "}<code dir="ltr">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. راجع <code dir="ltr">.env.example</code>.
        </p>
      </section>
    </main>
  );
}
