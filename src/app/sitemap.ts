import type { MetadataRoute } from "next";
import { demoListings } from "@/features/listings/demo-listings";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const staticRoutes = ["", "/stores", "/support", "/privacy", "/terms"].map((route) => ({
    url: `${origin}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" as const : "monthly" as const,
    priority: route === "" ? 1 : 0.4,
  }));

  if (!getSupabasePublicConfig()) {
    return [
      ...staticRoutes,
      ...demoListings.map((listing) => ({
        url: `${origin}/listings/${encodeURIComponent(listing.id)}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  }

  const supabase = await createSupabaseServerClient();
  const listings: Array<{ id: string; updated_at: string | null }> = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("listings")
      .select("id, updated_at")
      .eq("status", "active")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw new Error(`تعذر إنشاء خريطة الإعلانات: ${error.message}`);
    listings.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  const stores: Array<{ store_slug: string | null }> = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("active_pro_stores")
      .select("store_slug")
      .order("store_slug")
      .range(offset, offset + 499);
    if (error) throw new Error(`تعذر إنشاء خريطة المتاجر: ${error.message}`);
    stores.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }

  return [
    ...staticRoutes,
    ...listings.map((listing) => ({
      url: `${origin}/listings/${encodeURIComponent(listing.id)}`,
      lastModified: listing.updated_at ? new Date(listing.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...stores.flatMap((store) => store.store_slug ? [{
      url: `${origin}/stores/${encodeURIComponent(store.store_slug)}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }] : []),
  ];
}
