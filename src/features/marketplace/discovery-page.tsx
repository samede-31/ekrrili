"use client";

import {
  BadgeCheck,
  Camera,
  CarFront,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Construction,
  Heart,
  House,
  Laptop,
  MapPin,
  Menu,
  PartyPopper,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  TentTree,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { categories as localCategories, locations, type CategoryId, type Locale } from "@/features/listings/listing-options";
import { demoListings, type DemoListing } from "@/features/listings/demo-listings";
import { getLocalMarketplace, saveLocalMarketplace, type LocalListing } from "@/features/listings/local-marketplace";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { NotificationBell, type NotificationItem } from "@/features/notifications/notification-bell";
import { setSiteLanguage, type SiteLanguage } from "@/components/site-preferences";
import { cn } from "@/lib/utils";

type MarketplaceCategory = CategoryId | "all";
type DiscoveryListing = DemoListing & { status?: LocalListing["status"]; featuredUntil?: string | null };

const copy = {
  ar: {
    language: "Français",
    tagline: "اكريلي · سوق الكراء بين الأفراد",
    explore: "اكتشف",
    myListings: "إعلاناتي",
    favorites: "المفضلة",
    agreementDemo: "معاينة العقد",
    signIn: "تسجيل الدخول",
    addListing: "أضف إعلانك",
    heroEyebrow: "أغراض أكثر، تجارب أكثر",
    heroTitle: "ما تحتاجه، قريب منك.",
    heroDescription: "اكتشف أشياء مميزة للكراء من أشخاص موثوقين في ولايتك.",
    searchPlaceholder: "ماذا تبحث عنه اليوم؟",
    location: "الولاية",
    allWilayas: "كل الولايات",
    category: "الفئة",
    allCategories: "كل الفئات",
    maxPrice: "السعر اليومي الأقصى",
    priceRange: "نطاق السعر اليومي",
    resetFilters: "إعادة ضبط",
    search: "ابحث",
    categoriesHeading: "تصفّح حسب الفئة",
    all: "الكل",
    resultsHeading: "أغراض للكراء بالقرب منك",
    resultsCount: "إعلان",
    resultsCountPlural: "إعلانات",
    demoNotice: "نماذج توضيحية · سيتم ربط الإعلانات الحقيقية قريباً",
    sortBy: "ترتيب حسب",
    recommended: "المقترح",
    priceLow: "السعر: الأقل أولاً",
    ratingHigh: "الأعلى تقييماً",
    perDay: "دج / يوم",
    caution: "الضمان",
    noCaution: "بدون ضمان",
    verified: "موثّق",
    reviews: "تقييم",
    reviewsPlural: "تقييمات",
    owner: "المضيف",
    emptyTitle: "لم نعثر على نتائج",
    emptyDescription: "جرّب تغيير الفئة أو الولاية أو نطاق السعر.",
    clearFilters: "مسح الفلاتر",
    footer: "اكريلي — شارك أغراضك واكتشف المزيد",
  },
  fr: {
    language: "العربية",
    tagline: "EKRRILI · LOCATION ENTRE PARTICULIERS",
    explore: "Explorer",
    myListings: "Mes annonces",
    favorites: "Favoris",
    agreementDemo: "Contrat PDF (démo)",
    signIn: "Connexion",
    addListing: "Déposer une annonce",
    heroEyebrow: "Plus d'objets, plus d'expériences",
    heroTitle: "Ce qu'il vous faut, tout près.",
    heroDescription: "Découvrez des biens à louer auprès de personnes de confiance près de chez vous.",
    searchPlaceholder: "Que recherchez-vous aujourd'hui ?",
    location: "Wilaya",
    allWilayas: "Toutes les wilayas",
    category: "Catégorie",
    allCategories: "Toutes les catégories",
    maxPrice: "Prix journalier maximum",
    priceRange: "Fourchette de prix par jour",
    resetFilters: "Réinitialiser",
    search: "Rechercher",
    categoriesHeading: "Explorer par catégorie",
    all: "Tout",
    resultsHeading: "À louer près de chez vous",
    resultsCount: "annonce",
    resultsCountPlural: "annonces",
    demoNotice: "Exemples de démonstration · Les annonces réelles seront bientôt connectées",
    sortBy: "Trier par",
    recommended: "Recommandées",
    priceLow: "Prix : croissant",
    ratingHigh: "Mieux notées",
    perDay: "DA / jour",
    caution: "Caution",
    noCaution: "Sans caution",
    verified: "Vérifié",
    reviews: "avis",
    reviewsPlural: "avis",
    owner: "Hôte",
    emptyTitle: "Aucun résultat trouvé",
    emptyDescription: "Essayez de modifier la catégorie, la wilaya ou le prix.",
    clearFilters: "Effacer les filtres",
    footer: "Ekrrili — Partagez vos biens, découvrez-en plus",
  },
  en: {
    language: "Language",
    tagline: "EKRRILI · PEER-TO-PEER RENTALS",
    explore: "Explore",
    myListings: "My listings",
    favorites: "Favorites",
    agreementDemo: "Agreement template",
    signIn: "Sign in",
    addListing: "Post an ad",
    heroEyebrow: "More things, more experiences",
    heroTitle: "What you need, close by.",
    heroDescription: "Discover useful items offered by people in your area.",
    searchPlaceholder: "What are you looking for today?",
    location: "Wilaya",
    allWilayas: "All wilayas",
    category: "Category",
    allCategories: "All categories",
    maxPrice: "Maximum daily price",
    priceRange: "Daily price range",
    resetFilters: "Reset",
    search: "Search",
    categoriesHeading: "Browse by category",
    all: "All",
    resultsHeading: "Items available near you",
    resultsCount: "listing",
    resultsCountPlural: "listings",
    demoNotice: "Demo listings · saved locally in this browser",
    sortBy: "Sort by",
    recommended: "Recommended",
    priceLow: "Price: lowest first",
    ratingHigh: "Highest rated",
    perDay: "DZD / day",
    caution: "Deposit",
    noCaution: "No deposit",
    verified: "Verified",
    reviews: "review",
    reviewsPlural: "reviews",
    owner: "Owner",
    emptyTitle: "No results found",
    emptyDescription: "Try changing the category, wilaya, or price range.",
    clearFilters: "Clear filters",
    footer: "Ekrrili — Share what you own, discover more",
  },
} satisfies Record<SiteLanguage, Record<string, string>>;

const categoryIcons: Record<MarketplaceCategory, typeof Camera> = {
  all: Sparkles,
  camera: Camera,
  vehicle: CarFront,
  machinery: Construction,
  electronics: Laptop,
  event: PartyPopper,
  camping: TentTree,
  "real-estate": House,
};

const maxDailyPrice = 20000;
const formatNumber = (value: number, locale: SiteLanguage) =>
  new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : locale === "en" ? "en-US" : "fr-DZ").format(value);

export function DiscoveryPage({
  initialListings = demoListings,
  initialCategories,
  demoMode = true,
  loadError = "",
  initialNotifications = [],
  initialFavoriteIds = [],
  favoritesOnly = false,
}: {
  initialListings?: DemoListing[];
  initialCategories?: Array<{ id: CategoryId; name: Record<Locale, string> }>;
  demoMode?: boolean;
  loadError?: string;
  initialNotifications?: NotificationItem[];
  initialFavoriteIds?: string[];
  favoritesOnly?: boolean;
}) {
  const [listings, setListings] = useState<DiscoveryListing[]>(initialListings);
  const [marketplaceCategories, setMarketplaceCategories] = useState(
    initialCategories ?? localCategories.map(({ id, label }) => ({ id, name: label })),
  );
  const [locale, setLocale] = useState<SiteLanguage>("ar");
  const [activeCategory, setActiveCategory] = useState<MarketplaceCategory>("all");
  const [wilaya, setWilaya] = useState("");
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(maxDailyPrice);
  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [sort, setSort] = useState("recommended");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(initialFavoriteIds);
  const [favoriteError, setFavoriteError] = useState("");
  const maxPriceCeiling = Math.max(maxDailyPrice, Math.ceil(Math.max(...listings.map((item) => item.price), maxDailyPrice) / 500) * 500);
  const text = copy[locale];
  const rtl = locale === "ar";
  const direction = rtl ? "rtl" : "ltr";
  const contentLocale: Locale = locale === "ar" ? "ar" : "fr";

  const chooseLocale = (next: SiteLanguage) => {
    setLocale(next);
    setSiteLanguage(next);
  };

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [direction, locale]);

  useEffect(() => {
    const saved = window.localStorage.getItem("ekrrili-language-v1");
    if (saved === "ar" || saved === "en" || saved === "fr") setLocale(saved);
    const onLanguageChange = (event: Event) => {
      const selected = (event as CustomEvent<SiteLanguage>).detail;
      if (selected === "ar" || selected === "en" || selected === "fr") setLocale(selected);
    };
    window.addEventListener("ekrrili-language-change", onLanguageChange);
    return () => window.removeEventListener("ekrrili-language-change", onLanguageChange);
  }, []);

  useEffect(() => {
    setListings(initialListings);
  }, [initialListings]);

  useEffect(() => {
    if (demoMode) {
      setFavorites(getLocalMarketplace().favorites ?? []);
      return;
    }
    try {
      const local = JSON.parse(window.localStorage.getItem("ekrrili-favorites-v1") ?? "[]") as string[];
      setFavorites([...new Set([...initialFavoriteIds, ...local])]);
    } catch (caught) {
      setFavoriteError(caught instanceof Error ? `تعذر تحميل المفضلة: ${caught.message}` : "تعذر تحميل المفضلة.");
    }
  }, [demoMode, initialFavoriteIds]);

  useEffect(() => {
    if (initialCategories) setMarketplaceCategories(initialCategories);
  }, [initialCategories]);

  useEffect(() => {
    setMaxPrice((current) => current >= maxDailyPrice ? maxPriceCeiling : Math.min(current, maxPriceCeiling));
  }, [maxPriceCeiling]);

  useEffect(() => {
    if (!demoMode) return;
    const refresh = () => setListings(getLocalMarketplace().listings);
    refresh();
    window.addEventListener("ekrrili-local-marketplace-change", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("ekrrili-local-marketplace-change", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [demoMode]);

  useEffect(() => {
    if (demoMode) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel("marketplace-listings-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, () => {
        window.location.reload();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [demoMode]);

  useEffect(() => {
    const refreshFeatured = () => {
      const now = Date.now();
      setListings((current) => current.map((listing) => ({
        ...listing,
        featured: Boolean(listing.featured && listing.featuredUntil && Date.parse(listing.featuredUntil) > now),
      })));
    };
    const timer = window.setInterval(refreshFeatured, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const filteredListings = useMemo(() => {
    const query = appliedSearch.trim().toLocaleLowerCase();
    const matching = listings.filter((listing) => {
      if (favoritesOnly && !favorites.includes(listing.id)) return false;
      if (listing.status && listing.status !== "active") return false;
      const matchesCategory = activeCategory === "all" || listing.category === activeCategory;
      const matchesWilaya = !wilaya || listing.wilaya === wilaya;
      const matchesPrice = listing.price >= minPrice && listing.price <= maxPrice;
      const location = locations.find((item) => item.code === listing.wilaya);
      const searchable = [
        listing.title.ar,
        listing.title.fr,
        listing.commune,
        location?.name.ar,
        location?.name.fr,
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return matchesCategory && matchesWilaya && matchesPrice && (!query || searchable.includes(query));
    });
    return [...matching].sort((a, b) => {
      const now = Date.now();
      const featuredA = Boolean(a.featured && a.featuredUntil && Date.parse(a.featuredUntil) > now);
      const featuredB = Boolean(b.featured && b.featuredUntil && Date.parse(b.featuredUntil) > now);
      const featuredOrder = Number(featuredB) - Number(featuredA);
      if (featuredOrder !== 0) return featuredOrder;
      if (sort === "price") return a.price - b.price;
      if (sort === "rating") return b.rating - a.rating;
      return 0;
    });
  }, [activeCategory, appliedSearch, favorites, favoritesOnly, listings, maxPrice, minPrice, sort, wilaya]);

  const resetFilters = () => {
    setActiveCategory("all");
    setWilaya("");
    setMinPrice(0);
    setMaxPrice(maxPriceCeiling);
    setSearchText("");
    setAppliedSearch("");
  };

  const toggleFavorite = async (id: string) => {
    const previous = favorites;
    const next = previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id];
    setFavorites(next);
    setFavoriteError("");
    window.localStorage.setItem("ekrrili-favorites-v1", JSON.stringify(next));
    if (demoMode) {
      try {
        const state = getLocalMarketplace();
        const saved = state.favorites ?? [];
        const updated = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id];
        saveLocalMarketplace({ ...state, favorites: updated });
      } catch (caught) {
        setFavorites(previous);
        setFavoriteError(caught instanceof Error ? caught.message : "تعذر حفظ المفضلة محلياً.");
      }
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      setFavorites(previous);
      setFavoriteError(`تعذر تحديث المفضلة: ${authError.message}`);
      return;
    }
    if (!user) return;
    const result = next.includes(id)
      ? await supabase.from("listing_favorites").upsert({ user_id: user.id, listing_id: id })
      : await supabase.from("listing_favorites").delete().eq("user_id", user.id).eq("listing_id", id);
    if (result.error) {
      setFavorites(previous);
      setFavoriteError(`تعذر حفظ المفضلة: ${result.error.message}`);
    }
  };

  const runSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedSearch(searchText);
  };

  return (
    <main dir={direction} className="min-h-screen bg-[#f8faf8] text-[#19271e]">
      <header className="sticky top-0 z-40 border-b border-[#e8ede8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Ekrrili">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f4ec] text-xl font-bold text-[#17734e]">ا</span>
            <span>
              <span className="block text-lg font-extrabold tracking-tight text-[#145b3e]">اكريلي</span>
              <span className="block text-[9px] font-bold tracking-[0.18em] text-[#819086]">EKRRILI</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-[#536159] md:flex">
            <a href="#discover" className="text-[#176744]">{text.explore}</a>
            <Link href="/dashboard" className="transition hover:text-[#176744]">{text.myListings}</Link>
            <Link href="/stores" className="transition hover:text-[#176744]">متاجر PRO</Link>
            <Link href="/favorites" className="transition hover:text-[#176744]">{text.favorites}</Link>
            <Link href="/agreement-demo" className="transition hover:text-[#176744]">{text.agreementDemo}</Link>
            <Link href="/admin" className="inline-flex items-center gap-1.5 rounded-full bg-[#edf5ef] px-3 py-1.5 text-xs font-extrabold text-[#176744] transition hover:bg-[#dcefe2]">
              <BadgeCheck size={14} /> لوحة الإدارة
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <NotificationBell demoMode={demoMode} initialNotifications={initialNotifications} />
            <select aria-label="Language" value={locale} onChange={(event) => chooseLocale(event.target.value as SiteLanguage)} className="hidden h-9 rounded-lg border border-[#dfe6e0] bg-white px-2 text-xs font-semibold sm:inline-flex">
              <option value="ar">العربية</option><option value="en">English</option><option value="fr">Français</option>
            </select>
            <Link href="/login" className="hidden rounded-xl border border-[#dfe6e0] px-4 py-2.5 text-sm font-semibold text-[#35463b] hover:bg-[#f7faf7] sm:inline-flex">
              {text.signIn}
            </Link>
            <Link
              href="/list-an-item"
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#17734e] px-4 text-xs font-bold text-white transition hover:bg-[#10583b] sm:px-5 sm:text-sm"
            >
              {text.addListing}
            </Link>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e2e8e3] text-[#52645a] sm:hidden"
              aria-label={text.explore}
              onClick={() => setMobileFiltersOpen((open) => !open)}
            >
              {mobileFiltersOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
        {mobileFiltersOpen && (
          <div className="border-t border-[#edf0ed] bg-white px-4 py-3 sm:hidden">
            <div className="flex items-center justify-between">
              <select aria-label="Language" value={locale} onChange={(event) => chooseLocale(event.target.value as SiteLanguage)} className="h-9 rounded-lg border border-[#dfe6e0] bg-white px-2 text-xs font-semibold">
                <option value="ar">العربية</option><option value="en">English</option><option value="fr">Français</option>
              </select>
              <div className="flex flex-wrap justify-end gap-x-4 gap-y-2">
                <Link href="/dashboard" onClick={() => setMobileFiltersOpen(false)} className="text-sm text-[#176744]">{text.myListings}</Link>
                <Link href="/stores" onClick={() => setMobileFiltersOpen(false)} className="text-sm text-[#176744]">متاجر PRO</Link>
                <Link href="/favorites" onClick={() => setMobileFiltersOpen(false)} className="text-sm text-[#176744]">{text.favorites}</Link>
                <Link href="/admin" onClick={() => setMobileFiltersOpen(false)} className="text-sm font-bold text-[#176744]">لوحة الإدارة</Link>
                <Link href="/login" onClick={() => setMobileFiltersOpen(false)} className="text-sm text-[#176744]">{text.signIn}</Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <section className="relative isolate overflow-hidden bg-[#123e2e] text-white">
        <div className="absolute inset-0 -z-10 opacity-20">
          <div className="absolute -end-24 -top-44 h-[420px] w-[420px] rounded-full border border-white/30" />
          <div className="absolute -end-8 -top-28 h-[320px] w-[320px] rounded-full border border-white/25" />
          <div className="absolute -bottom-56 -start-20 h-[430px] w-[430px] rounded-full border border-white/20" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_0%,rgba(120,193,145,0.42),transparent_55%)]" />
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-[#cce5d5] sm:text-xs">
              <Sparkles size={14} />
              {text.heroEyebrow}
            </span>
            <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-5xl">{text.heroTitle}</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#d2e1d7] sm:text-base">{text.heroDescription}</p>
          </div>

          <form onSubmit={runSearch} className="mx-auto mt-8 grid max-w-5xl gap-2 rounded-2xl bg-white p-2.5 text-[#1c2b21] shadow-[0_18px_55px_-20px_rgba(0,0,0,0.45)] sm:grid-cols-[1.3fr_0.85fr_0.85fr_auto] sm:items-center sm:gap-1 sm:rounded-full sm:p-2">
            <label className="flex min-h-12 items-center gap-3 rounded-xl px-3 sm:px-4">
              <Search size={19} className="shrink-0 text-[#17734e]" />
              <input
                value={searchText}
                onChange={(event) => {
                  setSearchText(event.target.value);
                  setAppliedSearch(event.target.value);
                }}
                placeholder={text.searchPlaceholder}
                className="w-full min-w-0 border-0 bg-transparent text-sm outline-none placeholder:text-[#a0aaa3]"
              />
            </label>
            <label className="flex min-h-12 items-center gap-3 border-t border-[#edf0ed] px-3 sm:border-t-0 sm:border-s sm:px-4">
              <MapPin size={18} className="shrink-0 text-[#17734e]" />
              <span className="min-w-0 flex-1">
                <span className="mb-0.5 block text-[10px] font-semibold text-[#8b968f]">{text.location}</span>
                <select
                  value={wilaya}
                  onChange={(event) => setWilaya(event.target.value)}
                  className="w-full appearance-none border-0 bg-transparent text-xs font-semibold outline-none"
                  aria-label={text.location}
                >
                  <option value="">{text.allWilayas}</option>
                  {locations.map((item) => <option key={item.code} value={item.code}>{item.name[contentLocale]}</option>)}
                </select>
              </span>
              <ChevronDown size={15} className="shrink-0 text-[#8a968e]" />
            </label>
            <label className="flex min-h-12 items-center gap-3 border-t border-[#edf0ed] px-3 sm:border-t-0 sm:border-s sm:px-4">
              <SlidersHorizontal size={17} className="shrink-0 text-[#17734e]" />
              <span className="min-w-0 flex-1">
                <span className="mb-0.5 block text-[10px] font-semibold text-[#8b968f]">{text.category}</span>
                <select
                  value={activeCategory}
                  onChange={(event) => setActiveCategory(event.target.value as MarketplaceCategory)}
                  className="w-full appearance-none border-0 bg-transparent text-xs font-semibold outline-none"
                  aria-label={text.category}
                >
                  <option value="all">{text.allCategories}</option>
                  {marketplaceCategories.map((item) => <option key={item.id} value={item.id}>{item.name[contentLocale]}</option>)}
                </select>
              </span>
              <ChevronDown size={15} className="shrink-0 text-[#8a968e]" />
            </label>
            <button type="submit" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#17734e] px-6 text-sm font-bold text-white transition hover:bg-[#10583b] sm:rounded-full">
              <Search size={17} />
              {text.search}
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <section aria-labelledby="categories-heading" className="pb-2 pt-9">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="categories-heading" className="text-base font-bold sm:text-lg">{text.categoriesHeading}</h2>
            <span className="hidden text-xs text-[#89958d] sm:inline">{rtl ? "اكتشف شيئاً جديداً" : "Trouvez votre prochain coup de cœur"}</span>
          </div>
          <div className="scrollbar-none -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-3 sm:mx-0 sm:gap-3 sm:px-0">
            <CategoryPill
              id="all"
              label={text.all}
              icon={Sparkles}
              active={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
            />
            {marketplaceCategories.map((category) => {
              const Icon = categoryIcons[category.id];
              return (
                <CategoryPill
                  key={category.id}
                  id={category.id}
                  label={category.name[contentLocale]}
                  icon={Icon}
                  active={activeCategory === category.id}
                  onClick={() => setActiveCategory(category.id)}
                />
              );
            })}
          </div>
        </section>

        <section aria-label={text.priceRange} className="mb-6 mt-1 rounded-2xl border border-[#e6ece7] bg-white px-4 py-4 sm:px-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-[#33453a]">
              <SlidersHorizontal size={16} className="text-[#17734e]" />
              {text.priceRange}
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#536159]">
              <span>{formatNumber(minPrice, locale)} {text.perDay.split(" /")[0]}</span>
              <span className="text-[#a3ada5]">—</span>
              <span>{maxPrice >= maxPriceCeiling ? `${formatNumber(maxPriceCeiling, locale)}+` : formatNumber(maxPrice, locale)} {text.perDay.split(" /")[0]}</span>
              {(minPrice > 0 || maxPrice < maxPriceCeiling) && (
                <button type="button" onClick={() => { setMinPrice(0); setMaxPrice(maxPriceCeiling); }} className="ms-2 text-[#17734e] hover:underline">
                  {text.resetFilters}
                </button>
              )}
            </div>
          </div>
          <div className="relative mx-2 h-7">
            <div className="absolute inset-x-0 top-3 h-1.5 rounded-full bg-[#e7eee8]" />
            <div
              className="absolute top-3 h-1.5 rounded-full bg-[#4ca778]"
              style={{
                left: `${(minPrice / maxPriceCeiling) * 100}%`,
                right: `${100 - (maxPrice / maxPriceCeiling) * 100}%`,
              }}
            />
            <input
              type="range"
              min="0"
              max={maxPriceCeiling}
              step="500"
              value={minPrice}
              aria-label={rtl ? "أقل سعر يومي" : "Prix minimum par jour"}
              onChange={(event) => setMinPrice(Math.min(Number(event.target.value), maxPrice - 500))}
              className="price-range absolute inset-0 h-7 w-full cursor-pointer appearance-none bg-transparent"
            />
            <input
              type="range"
              min="0"
              max={maxPriceCeiling}
              step="500"
              value={maxPrice}
              aria-label={rtl ? "أعلى سعر يومي" : "Prix maximum par jour"}
              onChange={(event) => setMaxPrice(Math.max(Number(event.target.value), minPrice + 500))}
              className="price-range absolute inset-0 h-7 w-full cursor-pointer appearance-none bg-transparent"
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[#9aa59d]">
            <span>0 {text.perDay.split(" /")[0]}</span>
            <span>{formatNumber(maxPriceCeiling, locale)}+ {text.perDay.split(" /")[0]}</span>
          </div>
        </section>

        <section id="discover" className="pb-14 pt-2">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{favoritesOnly ? text.favorites : text.resultsHeading}</h2>
              <p className="mt-1 text-xs text-[#87938b]">
                {filteredListings.length} {filteredListings.length === 1 ? text.resultsCount : text.resultsCountPlural}
              </p>
            </div>
            {demoMode && <p className="text-[10px] text-[#96a198]">{rtl ? "وضع تجريبي · الإعلانات والطلبات محفوظة محلياً." : "Mode démo · annonces et demandes enregistrées localement."}</p>}
            {loadError && <p role="alert" className="text-[10px] text-red-700">{loadError}</p>}
            {favoriteError && <p role="alert" className="text-[10px] text-red-700">{favoriteError}</p>}
            <label className="flex items-center gap-2 text-xs text-[#758179]">
              {text.sortBy}
              <span className="relative">
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="appearance-none rounded-lg border border-[#e2e8e3] bg-white py-2 pe-8 ps-3 text-xs font-semibold text-[#34463a] outline-none"
                >
                  <option value="recommended">{text.recommended}</option>
                  <option value="price">{text.priceLow}</option>
                  <option value="rating">{text.ratingHigh}</option>
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-[#819087]" />
              </span>
            </label>
          </div>

          {filteredListings.length > 0 ? (
            <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  locale={contentLocale}
                  text={text}
                  categoryLabel={marketplaceCategories.find((item) => item.id === listing.category)?.name[contentLocale]}
                  favorite={favorites.includes(listing.id)}
                  onToggleFavorite={() => toggleFavorite(listing.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-[#d7e1d8] bg-white px-5 text-center">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef6ef] text-[#17734e]">
                <Search size={23} />
              </span>
              <h3 className="text-lg font-bold">{text.emptyTitle}</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[#7b887f]">{text.emptyDescription}</p>
              <button type="button" onClick={resetFilters} className="mt-5 rounded-xl bg-[#17734e] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#10583b]">
                {text.clearFilters}
              </button>
            </div>
          )}
        </section>
      </div>

      <footer className="border-t border-[#e7ece7] bg-white py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-xs text-[#8a968e] sm:flex-row sm:px-6 lg:px-8">
          <span className="max-w-xl text-center font-bold text-[#52645a]">اكريلي · EKRRILI — رسوم التمييز وPRO خدمات للمنصة؛ أموال الكراء والضمان لا تمر عبر اكريلي.</span>
          <span>{text.footer}</span>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <a href="/privacy" className="hover:text-[#176744]">الخصوصية</a>
            <a href="/terms" className="hover:text-[#176744]">الشروط</a>
            <a href="/support" className="hover:text-[#176744]">الدعم</a>
            <a href="/stores" className="hover:text-[#176744]">متاجر PRO</a>
            <select aria-label="Language" value={locale} onChange={(event) => chooseLocale(event.target.value as SiteLanguage)} className="rounded-lg border border-[#dfe6e0] bg-white px-2 py-1 text-xs font-semibold">
              <option value="ar">العربية</option><option value="en">English</option><option value="fr">Français</option>
            </select>
          </div>
        </div>
      </footer>
    </main>
  );
}

function CategoryPill({
  id,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  id: string;
  label: string;
  icon: typeof Camera;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-category={id}
      className={cn(
        "flex min-w-[105px] snap-start flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-center transition sm:min-w-[124px] sm:py-4",
        active
          ? "border-[#17734e] bg-[#edf7f0] text-[#176744] shadow-sm"
          : "border-[#e7ece7] bg-white text-[#637168] hover:border-[#a6c8b0] hover:bg-[#fbfdfb]",
      )}
    >
      <Icon size={20} strokeWidth={1.8} />
      <span className="whitespace-nowrap text-[11px] font-semibold sm:text-xs">{label}</span>
    </button>
  );
}

function ListingCard({
  listing,
  locale,
  text,
  categoryLabel,
  favorite,
  onToggleFavorite,
}: {
  listing: DiscoveryListing;
  locale: Locale;
  text: Record<string, string>;
  categoryLabel?: string;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const location = locations.find((item) => item.code === listing.wilaya);
  const category = localCategories.find((item) => item.id === listing.category);
  const listingTitle = listing.title[locale];
  const nextImage = (offset: number) => {
    setImageIndex((index) => (index + offset + listing.images.length) % listing.images.length);
  };

  return (
    <article className="group min-w-0">
      <div className="relative aspect-[1.18/1] overflow-hidden rounded-2xl bg-[#e8eee9]">
        <Link href={`/listings/${listing.id}`} aria-label={listingTitle} className="absolute inset-0">
          <Image
            src={listing.images[imageIndex]}
            alt={listingTitle}
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-[1.035]"
          />
        </Link>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10" />
        {listing.featured && listing.featuredUntil && Date.parse(listing.featuredUntil) > Date.now() && (
          <span className="pointer-events-none absolute start-3 top-3 z-10 max-w-[72%] truncate rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-[#34483b] shadow-sm">
            {locale === "ar" ? "إعلان مميز" : "À la une"}
          </span>
        )}
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={favorite ? (locale === "ar" ? "إزالة من المفضلة" : "Retirer des favoris") : (locale === "ar" ? "إضافة للمفضلة" : "Ajouter aux favoris")}
          aria-pressed={favorite}
          className="absolute end-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-[#44534a] shadow-sm transition hover:scale-105"
        >
          <Heart size={17} fill={favorite ? "#dd695f" : "none"} className={favorite ? "text-[#dd695f]" : ""} />
        </button>
        {listing.images.length > 1 && (
          <>
            <button
              type="button"
              aria-label={locale === "ar" ? "الصورة السابقة" : "Photo précédente"}
              onClick={() => nextImage(-1)}
              className="absolute start-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#34483b] opacity-0 shadow-sm transition hover:bg-white group-hover:opacity-100 focus:opacity-100"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label={locale === "ar" ? "الصورة التالية" : "Photo suivante"}
              onClick={() => nextImage(1)}
              className="absolute end-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#34483b] opacity-0 shadow-sm transition hover:bg-white group-hover:opacity-100 focus:opacity-100"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-3 start-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
              {listing.images.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`${locale === "ar" ? "الصورة" : "Photo"} ${index + 1}`}
                  onClick={() => setImageIndex(index)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    index === imageIndex ? "w-4 bg-white" : "w-1.5 bg-white/65",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="pt-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/listings/${listing.id}`} className="line-clamp-1 flex-1 text-sm font-bold text-[#26372d] hover:text-[#176744]">{listingTitle}</Link>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#35463b]">
            <Star size={13} fill="#eab54e" className="text-[#eab54e]" />
            {listing.rating.toFixed(1)}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#7b887f]">
          <MapPin size={13} className="shrink-0" />
          <span className="truncate">{listing.commune}, {location?.name[locale]}</span>
          <span className="text-[#c1c9c2]">·</span>
          <span className="truncate">{categoryLabel ?? category?.label[locale]}</span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#edf0ed] pt-3">
          <p className="text-sm">
            <span className="font-extrabold text-[#1e3025]">{formatNumber(listing.price, locale)} {text.perDay.split(" /")[0]}</span>
            <span className="ms-1 text-[10px] text-[#849087]">/ {locale === "ar" ? "يوم" : "jour"}</span>
          </p>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fff7e8] px-2 py-1 text-[10px] font-semibold text-[#896526]">
            <span>{text.caution}:</span>
            {listing.caution === 0 ? text.noCaution : `${formatNumber(listing.caution, locale)} ${text.perDay.split(" /")[0]}`}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eaf1eb] text-[10px] font-bold text-[#42624d]">
              {listing.owner[locale].slice(0, 1)}
            </span>
            <span className="truncate text-[11px] text-[#738078]">{listing.owner[locale]}</span>
            {listing.verified && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#17734e]" title={text.verified}>
                <BadgeCheck size={14} />
                <span className="hidden sm:inline">{text.verified}</span>
              </span>
            )}
          </div>
          <span className="shrink-0 text-[10px] text-[#8a968e]">{listing.reviews} {text.reviews}</span>
        </div>
      </div>
    </article>
  );
}
