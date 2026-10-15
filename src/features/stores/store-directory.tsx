"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLocalMarketplace } from "@/features/listings/local-marketplace";
export type StoreCardData = {
  name: string;
  slug: string;
  bio: string;
  wilaya: string;
  proUntil: string;
  listingCount: number;
};

export function StoreDirectory({ stores: initialStores, demoMode = false }: { stores: StoreCardData[]; demoMode?: boolean }) {
  const [stores, setStores] = useState(initialStores);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    if (!demoMode) return () => window.clearInterval(timer);
    const refresh = () => {
      const state = getLocalMarketplace();
      setStores((state.proStores ?? []).filter((store) => Date.parse(store.proUntil) > Date.now()).map((store) => ({
        name: store.storeName, slug: store.slug, bio: store.bio, wilaya: store.wilaya, proUntil: store.proUntil,
        listingCount: state.listings.filter((listing) => listing.ownerId === store.ownerId && listing.status === "active").length,
      })));
    };
    refresh();
    window.addEventListener("ekrrili-local-marketplace-change", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("ekrrili-local-marketplace-change", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [demoMode]);
  const activeStores = stores.filter((store) => Date.parse(store.proUntil) > currentTime);
  return (
    <main dir="rtl" lang="ar" className="min-h-screen bg-[#f7f9f7] px-4 py-10 text-[#17231d] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm font-bold text-[#176744]">العودة إلى السوق</Link>
        <p className="mt-8 text-xs font-bold text-[#176744]">متاجر المحترفين</p>
        <h1 className="mt-2 text-3xl font-extrabold">متاجر اكريلي المحترفة</h1>
        <p className="mt-2 text-sm text-[#69776e]">وكالات ومحلات موثّقة تجمع معداتها وخدماتها في مكان واحد.</p>
        {activeStores.length ? <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeStores.map((store) => (
            <Link key={store.slug} href={`/stores/${store.slug}`} className="rounded-2xl border border-[#e2e9e3] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-800">متجر محترف PRO ✓</span>
              <h2 className="mt-3 text-lg font-extrabold">{store.name}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#68766d]">{store.bio || "متجر محترف موثّق على اكريلي."}</p>
              <div className="mt-4 flex justify-between text-xs text-[#758179]"><span>{store.wilaya}</span><span>{store.listingCount} إعلان نشط</span></div>
            </Link>
          ))}
        </div> : <div className="mt-8 rounded-2xl border border-dashed border-[#d5e0d7] bg-white p-10 text-center text-sm text-[#738078]">لا توجد متاجر محترفين معتمدة حالياً.</div>}
      </div>
    </main>
  );
}
