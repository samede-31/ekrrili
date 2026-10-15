import { notFound } from "next/navigation";
import { Storefront } from "@/features/stores/storefront";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getSupabasePublicConfig()) return <Storefront demoMode slug={slug} />;
  const supabase = await createSupabaseServerClient();
  const { data: store, error } = await supabase.from("active_pro_stores")
    .select("owner_id, store_name, store_bio, store_wilaya, business_hours, map_location, phone_number, pro_until")
    .eq("store_slug", slug).maybeSingle();
  if (error) return <main dir="rtl" lang="ar" className="min-h-screen bg-[#f7f9f7] p-6"><p role="alert" className="mx-auto max-w-xl rounded-2xl bg-white p-5 text-sm text-red-800">{error.message}</p></main>;
  if (!store) notFound();
  const { data: listings, error: listingsError } = await supabase.from("listings")
    .select("id, title, images, price_per_day, wilaya")
    .eq("owner_id", store.owner_id).eq("status", "active")
    .order("created_at", { ascending: false });
  if (listingsError) return <main dir="rtl" lang="ar" className="min-h-screen bg-[#f7f9f7] p-6"><p role="alert" className="mx-auto max-w-xl rounded-2xl bg-white p-5 text-sm text-red-800">{listingsError.message}</p></main>;
  return <Storefront store={{
    name: store.store_name ?? "متجر محترف",
    bio: store.store_bio ?? "",
    wilaya: store.store_wilaya ?? "",
    mapLocation: store.map_location ?? "",
    phone: store.phone_number ?? "",
    proUntil: store.pro_until ?? "",
    businessHours: store.business_hours as Record<string, string>,
    listings: (listings ?? []).map((listing) => ({
      id: listing.id,
      title: listing.title,
      image: listing.images[0] ?? null,
      price: Number(listing.price_per_day),
      wilaya: listing.wilaya,
    })),
  }} />;
}
