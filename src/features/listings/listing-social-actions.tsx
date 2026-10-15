"use client";

import { Copy, Heart, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ListingSocialActions({
  listingId,
  title,
  dailyPrice,
  wilaya,
  demoMode,
  initialFavorite = false,
}: {
  listingId: string;
  title: string;
  dailyPrice: number;
  wilaya: string;
  demoMode: boolean;
  initialFavorite?: boolean;
}) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState<"ar" | "en" | "fr">("ar");
  const shareText = language === "en"
    ? `${title} — ${new Intl.NumberFormat("en-US").format(dailyPrice)} DZD/day · ${wilaya} · ${url}`
    : language === "fr"
      ? `${title} — ${new Intl.NumberFormat("fr-DZ").format(dailyPrice)} DA/jour · ${wilaya} · ${url}`
      : `${title} — ${new Intl.NumberFormat("fr-DZ").format(dailyPrice)} د.ج / يوم · ${wilaya} · ${url}`;

  useEffect(() => {
    setUrl(`${window.location.origin}/listings/${listingId}`);
    const storedLanguage = window.localStorage.getItem("ekrrili-language-v1");
    if (storedLanguage === "en" || storedLanguage === "fr" || storedLanguage === "ar") setLanguage(storedLanguage);
    const onLanguageChange = (event: Event) => {
      const selected = (event as CustomEvent<"ar" | "en" | "fr">).detail;
      if (selected === "ar" || selected === "en" || selected === "fr") setLanguage(selected);
    };
    window.addEventListener("ekrrili-language-change", onLanguageChange);
    return () => window.removeEventListener("ekrrili-language-change", onLanguageChange);
  }, [listingId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const local = JSON.parse(window.localStorage.getItem("ekrrili-favorites-v1") ?? "[]") as string[];
        if (demoMode) {
          const { getLocalMarketplace } = await import("@/features/listings/local-marketplace");
          if (active) setFavorite((getLocalMarketplace().favorites ?? local).includes(listingId));
          return;
        }
        const supabase = createSupabaseBrowserClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) {
          if (active) setFavorite(local.includes(listingId));
          return;
        }
        const { data, error } = await supabase.from("listing_favorites").select("listing_id").eq("user_id", user.id).eq("listing_id", listingId).maybeSingle();
        if (error) throw error;
        if (active) setFavorite(Boolean(data) || local.includes(listingId));
      } catch (caught) {
        if (active) setMessage(caught instanceof Error ? `تعذر تحميل حالة المفضلة: ${caught.message}` : "تعذر تحميل حالة المفضلة.");
      }
    };
    void load();
    return () => { active = false; };
  }, [demoMode, listingId]);

  const toggleFavorite = async () => {
    const next = !favorite;
    setFavorite(next);
    try {
      const local = JSON.parse(window.localStorage.getItem("ekrrili-favorites-v1") ?? "[]") as string[];
      const nextLocal = next ? [...new Set([...local, listingId])] : local.filter((id) => id !== listingId);
      window.localStorage.setItem("ekrrili-favorites-v1", JSON.stringify(nextLocal));
      if (demoMode) {
        const { getLocalMarketplace, saveLocalMarketplace } = await import("@/features/listings/local-marketplace");
        const state = getLocalMarketplace();
        saveLocalMarketplace({ ...state, favorites: nextLocal });
        return;
      }
      const supabase = createSupabaseBrowserClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;
      const result = next
        ? await supabase.from("listing_favorites").upsert({ user_id: user.id, listing_id: listingId })
        : await supabase.from("listing_favorites").delete().eq("user_id", user.id).eq("listing_id", listingId);
      if (result.error) throw result.error;
    } catch (caught) {
      setFavorite(!next);
      setMessage(caught instanceof Error ? `تعذر حفظ المفضلة: ${caught.message}` : "تعذر حفظ المفضلة.");
    }
  };

  const share = async () => {
    setMessage("");
    try {
      if (navigator.share) {
        await navigator.share({ title, text: shareText, url });
      } else {
        await navigator.clipboard.writeText(shareText);
        setMessage("تم نسخ رابط الإعلان ونص المشاركة.");
      }
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      setMessage(caught instanceof Error ? `تعذرت المشاركة: ${caught.message}` : "تعذرت المشاركة.");
    }
  };

  const copyLink = async () => {
    setMessage("");
    try {
      await navigator.clipboard.writeText(url);
      setMessage(language === "en" ? "Listing link copied." : language === "fr" ? "Lien de l'annonce copié." : "تم نسخ رابط الإعلان.");
    } catch (caught) {
      setMessage(caught instanceof Error ? `تعذر نسخ الرابط: ${caught.message}` : "تعذر نسخ الرابط.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => void toggleFavorite()} aria-pressed={favorite} aria-label={favorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#e0e7e1] bg-white px-3 text-sm font-bold text-[#58665d] hover:bg-[#f6f9f6]">
        <Heart size={17} fill={favorite ? "#dd695f" : "none"} className={favorite ? "text-[#dd695f]" : ""} /> {favorite ? "في المفضلة" : "أضف للمفضلة"}
      </button>
      <button type="button" onClick={() => void share()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#e0e7e1] bg-white px-3 text-sm font-bold text-[#58665d] hover:bg-[#f6f9f6]">
        <Share2 size={17} /> مشاركة الإعلان
      </button>
      <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-xl border border-[#cce3d2] bg-[#f1f8f3] px-3 text-sm font-bold text-[#176744]">{language === "en" ? "WhatsApp" : language === "fr" ? "WhatsApp" : "واتساب"}</a>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer" aria-label="Share on Facebook" className="inline-flex h-10 items-center rounded-xl border border-[#d7e2f3] bg-[#f3f7fd] px-3 text-sm font-bold text-[#2458a6]">Facebook</a>
      <button type="button" onClick={() => void copyLink()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#e0e7e1] bg-white px-3 text-sm font-bold text-[#58665d] hover:bg-[#f6f9f6]"><Copy size={15} /> {language === "en" ? "Copy link" : language === "fr" ? "Copier le lien" : "نسخ الرابط"}</button>
      {message && <span role="status" className="w-full text-xs text-[#68766d]">{message}</span>}
    </div>
  );
}
