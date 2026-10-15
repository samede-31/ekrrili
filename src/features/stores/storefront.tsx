"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getLocalMarketplace } from "@/features/listings/local-marketplace";

export type StoreListingData = { id: string; title: string; image: string | null; price: number; wilaya: string };
export type StorefrontData = {
  name: string;
  bio: string;
  wilaya: string;
  mapLocation: string;
  phone: string;
  proUntil: string;
  businessHours: Record<string, string>;
  listings: StoreListingData[];
};

export function Storefront({ store: initialStore, demoMode = false, slug = "" }: { store?: StorefrontData; demoMode?: boolean; slug?: string }) {
  const [store, setStore] = useState(initialStore);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    if (demoMode) {
      const refresh = () => {
        const state = getLocalMarketplace();
        const profile = (state.proStores ?? []).find((item) => item.slug === slug && Date.parse(item.proUntil) > Date.now());
        setStore(profile ? {
          name: profile.storeName, bio: profile.bio, wilaya: profile.wilaya, mapLocation: "",
          phone: state.profile?.phoneNumber ?? "", proUntil: profile.proUntil, businessHours: profile.businessHours,
          listings: state.listings.filter((item) => item.ownerId === profile.ownerId && item.status === "active").map((item) => ({
            id: item.id, title: item.title.ar, image: item.images[0] ?? null, price: item.price, wilaya: item.wilaya,
          })),
        } : undefined);
      };
      refresh();
      window.addEventListener("ekrrili-local-marketplace-change", refresh);
      window.addEventListener("storage", refresh);
      return () => {
        window.clearInterval(timer);
        window.removeEventListener("ekrrili-local-marketplace-change", refresh);
        window.removeEventListener("storage", refresh);
      };
    }
    return () => window.clearInterval(timer);
  }, [demoMode, slug]);
  if (!store || Date.parse(store.proUntil) <= currentTime) return <main dir="rtl" className="min-h-screen bg-[#f7f9f7] p-8"><p className="text-sm text-[#738078]">لم يتم العثور على متجر محترف نشط.</p><Link className="mt-3 inline-block text-sm text-[#176744]" href="/stores">دليل المتاجر</Link></main>;
  return (
    <main dir="rtl" lang="ar" className="min-h-screen bg-[#f7f9f7] px-4 py-8 text-[#17231d] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/stores" className="text-sm font-bold text-[#176744]">← دليل المتاجر</Link>
        <section className="mt-6 rounded-3xl border border-[#e1e9e2] bg-white p-6 sm:p-9">
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-800">متجر محترف PRO · موثّق</span>
          <h1 className="mt-4 text-3xl font-extrabold">{store.name}</h1>
          <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-[#69776e]">{store.bio}</p>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#536159]">
            {store.wilaya && <span>📍 {store.wilaya}</span>}
            {store.mapLocation && <span>الموقع: {store.mapLocation}</span>}
            {store.phone && <a dir="ltr" href={`tel:${store.phone}`}>{store.phone}</a>}
          </div>
          {Object.keys(store.businessHours).length > 0 && <div className="mt-5 grid max-w-xl grid-cols-2 gap-2 text-xs sm:grid-cols-3">{Object.entries(store.businessHours).map(([day, hours]) => <p key={day} className="rounded-xl bg-[#f6f8f6] p-3"><strong>{day}</strong><span className="block mt-1">{hours}</span></p>)}</div>}
        </section>
        <h2 className="mt-9 text-xl font-extrabold">معدات المتجر المتاحة</h2>
        {store.listings.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{store.listings.map((listing) => <Link key={listing.id} href={`/listings/${listing.id}`} className="overflow-hidden rounded-2xl border bg-white"><div className="relative aspect-[4/3] bg-[#eff3ef]">{listing.image && <Image src={listing.image} alt="" fill unoptimized className="object-cover" />}</div><div className="p-4"><h3 className="font-bold">{listing.title}</h3><p className="mt-2 text-sm text-[#176744]">{new Intl.NumberFormat("fr-DZ").format(listing.price)} د.ج / يوم</p></div></Link>)}</div> : <p className="mt-4 rounded-xl bg-white p-6 text-sm text-[#738078]">لا توجد إعلانات نشطة حالياً.</p>}
      </div>
    </main>
  );
}
