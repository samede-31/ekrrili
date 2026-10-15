import { StoreDirectory } from "@/features/stores/store-directory";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  if (!getSupabasePublicConfig()) return <StoreDirectory stores={[]} demoMode />;
  const supabase = await createSupabaseServerClient();
  const { data: rows, error } = await supabase.from("active_pro_stores")
    .select("owner_id, store_name, store_slug, store_bio, store_wilaya, pro_until");
  if (error) return <main dir="rtl" lang="ar" className="min-h-screen bg-[#f7f9f7] p-6"><p role="alert" className="mx-auto max-w-xl rounded-2xl bg-white p-5 text-sm text-red-800">{error.message}</p></main>;
  const ownerIds = (rows ?? []).map((row) => row.owner_id);
  const { data: listings, error: listingsError } = ownerIds.length
    ? await supabase.from("listings").select("owner_id").in("owner_id", ownerIds).eq("status", "active")
    : { data: [], error: null };
  if (listingsError) return <main dir="rtl" lang="ar" className="min-h-screen bg-[#f7f9f7] p-6"><p role="alert" className="mx-auto max-w-xl rounded-2xl bg-white p-5 text-sm text-red-800">{listingsError.message}</p></main>;
  return <StoreDirectory stores={(rows ?? []).map((store) => ({
    name: store.store_name ?? "متجر محترف",
    slug: store.store_slug ?? "",
    bio: store.store_bio ?? "",
    wilaya: store.store_wilaya ?? "",
    proUntil: store.pro_until ?? "",
    listingCount: (listings ?? []).filter((listing) => listing.owner_id === store.owner_id).length,
  }))} />;
}
