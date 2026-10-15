import { demoListings, type DemoListing } from "@/features/listings/demo-listings";
import type { ListingFormValues } from "@/features/listings/listing-schema";
import { categories, locations } from "@/features/listings/listing-options";
import { defaultPromotionPaymentSettings, type PromotionPaymentSettings } from "@/features/promotions/promotion-settings";

export const LOCAL_MARKETPLACE_KEY = "ekrrili-local-marketplace-v1";
export const LOCAL_OWNER_ID = "ekrrili-demo-owner";
export const LOCAL_RENTER_ID = "ekrrili-demo-renter";

export type LocalListing = DemoListing & {
  status: "active" | "paused" | "rented";
  ownerId: string;
  condition: string;
  cautionTerms: string;
  createdAt: string;
  featuredUntil?: string | null;
  proUntil?: string | null;
  storeName?: string | null;
  storeSlug?: string | null;
  storeBio?: string | null;
  businessHours?: Record<string, string>;
  mapLocation?: string | null;
};

export type LocalRentalRequest = {
  id: string;
  listingId: string;
  renterId: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  deliveryMethod?: "pickup" | "delivery";
  deliveryFeeDzd?: number;
  selectedAddons?: Array<{ name: string; price_per_day_dzd: number }>;
  cautionAmount: number;
  cautionType: "cash" | "cheque" | null;
  status: "pending" | "approved" | "active" | "completed" | "cancelled";
  createdAt: string;
};

export type LocalHandoverLog = {
  id: string;
  requestId: string;
  userId: string;
  phase: "check_in" | "check_out";
  notes: string;
  photoDataUrl: string | null;
  createdAt: string;
};

export type LocalReview = {
  requestId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type LocalDisputeReport = {
  id: string;
  listingId?: string;
  requestId?: string;
  reporterId: string;
  targetUserId?: string;
  reason: "damage" | "late_return" | "no_show" | "fraud" | "other";
  details: string;
  status: "pending" | "reviewing" | "resolved" | "dismissed";
  createdAt: string;
};

export type LocalProStoreApplication = {
  id: string;
  ownerId: string;
  storeName: string;
  slug: string;
  bio: string;
  businessHours: Record<string, string>;
  wilaya: string;
  receiptDataUrl: string | null;
  paymentReference: string;
  proDays: number;
  planId: string;
  currency: "DZD" | "USD";
  amountDzd: number | null;
  amountUsd: number | null;
  paymentMethod: "baridimob" | "ccp" | "bybit";
  senderInfo: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export type LocalProStore = {
  ownerId: string;
  storeName: string;
  slug: string;
  bio: string;
  businessHours: Record<string, string>;
  wilaya: string;
  proUntil: string;
};

export type LocalPromotion = {
  id: string;
  listingId: string;
  ownerId: string;
  receiptName: string | null;
  receiptDataUrl: string | null;
  planId: string;
  durationDays: number;
  amountDzd: number | null;
  amountUsd: number | null;
  currency: "DZD" | "USD";
  paymentMethod: "baridimob" | "ccp" | "bybit";
  paymentReference: string;
  senderInfo: string;
  receiptImageDataUrl: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export type LocalMarketplaceState = {
  version: 1;
  listings: LocalListing[];
  requests: LocalRentalRequest[];
  blackoutDates?: Array<{ listingId: string; date: string }>;
  handoverLogs?: LocalHandoverLog[];
  reviews?: LocalReview[];
  promotions?: LocalPromotion[];
  notifications?: Array<{ id: string; title: string; body: string; createdAt: string; read: boolean; requestId?: string }>;
  favorites?: string[];
  disputeReports?: LocalDisputeReport[];
  proStoreApplications?: LocalProStoreApplication[];
  proStores?: LocalProStore[];
  demoInvoices?: Array<{
    transactionId: string;
    planId: string;
    currency: "DZD" | "USD";
    amount: number;
    durationDays: number;
    cardBrand: "bybit_card" | "edahabia" | "visa" | "mastercard";
    cardLast4: string;
    expiresAt: string;
    target: "featured" | "pro_store";
  }>;
  promotionSettings?: PromotionPaymentSettings;
  profile?: {
    fullName: string;
    phoneNumber: string;
    wilaya: string;
  };
};

export type LocalListingInput = Omit<ListingFormValues, "images"> & {
  images: string[];
};

export function makeInitialLocalMarketplace(): LocalMarketplaceState {
  return {
    version: 1,
    listings: demoListings.map((listing) => ({
      ...listing,
      featured: Boolean(listing.badge),
      featuredUntil: listing.badge ? new Date(Date.now() + 30 * 86_400_000).toISOString() : null,
      status: "active",
      ownerId: LOCAL_OWNER_ID,
      cautionTerms: "يُعاد مبلغ الضمان بعد المعاينة والتأكد من سلامة الغرض.",
      createdAt: new Date(0).toISOString(),
    })),
    requests: [],
    blackoutDates: [],
    handoverLogs: [],
    reviews: [],
    promotions: [],
    notifications: [],
    favorites: [],
    disputeReports: [],
    proStoreApplications: [],
    proStores: [],
    demoInvoices: [],
    promotionSettings: {
      ...structuredClone(defaultPromotionPaymentSettings),
      promo_codes: [{
        code: "FREE7",
        duration_days: 7,
        active: true,
        max_uses: 100,
        redeemed_count: 0,
        redeemed_by: [],
      }],
    },
    profile: { fullName: "عضو تجريبي", phoneNumber: "+213555000000", wilaya: "16" },
  };
}

export function isLocalMarketplaceState(value: unknown): value is LocalMarketplaceState {
  if (typeof value !== "object" || value === null || !("version" in value) || !("listings" in value) || !("requests" in value)) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1 || !Array.isArray(candidate.listings) || !Array.isArray(candidate.requests)) return false;
  const validListing = (listing: unknown) =>
    typeof listing === "object" && listing !== null &&
    "id" in listing && typeof listing.id === "string" &&
    "title" in listing && typeof listing.title === "object" && listing.title !== null &&
    "ar" in listing.title && typeof listing.title.ar === "string" &&
    "fr" in listing.title && typeof listing.title.fr === "string" &&
    "category" in listing && categories.some((category) => category.id === listing.category) &&
    "price" in listing && typeof listing.price === "number" && Number.isFinite(listing.price) &&
    "caution" in listing && typeof listing.caution === "number" && Number.isFinite(listing.caution) &&
    "images" in listing && Array.isArray(listing.images) && listing.images.every((image) => typeof image === "string") &&
    "metadata" in listing && typeof listing.metadata === "object" && listing.metadata !== null && !Array.isArray(listing.metadata) &&
    "status" in listing && ["active", "paused", "rented"].includes(String(listing.status)) &&
    "ownerId" in listing && typeof listing.ownerId === "string";
  const validRequest = (request: unknown) =>
    typeof request === "object" && request !== null &&
    "id" in request && typeof request.id === "string" &&
    "listingId" in request && typeof request.listingId === "string" &&
    "startDate" in request && typeof request.startDate === "string" &&
    "endDate" in request && typeof request.endDate === "string" &&
    "totalPrice" in request && typeof request.totalPrice === "number" && Number.isFinite(request.totalPrice) &&
    "status" in request && ["pending", "approved", "active", "completed", "cancelled"].includes(String(request.status));
  const validProfile = candidate.profile === undefined ||
    (typeof candidate.profile === "object" && candidate.profile !== null &&
      "fullName" in candidate.profile && typeof candidate.profile.fullName === "string" &&
      "phoneNumber" in candidate.profile && typeof candidate.profile.phoneNumber === "string" &&
      "wilaya" in candidate.profile && typeof candidate.profile.wilaya === "string");
  return candidate.listings.every(validListing) && candidate.requests.every(validRequest) && validProfile &&
    (candidate.blackoutDates === undefined || Array.isArray(candidate.blackoutDates)) &&
    (candidate.handoverLogs === undefined || Array.isArray(candidate.handoverLogs)) &&
    (candidate.reviews === undefined || Array.isArray(candidate.reviews)) &&
    (candidate.promotions === undefined || Array.isArray(candidate.promotions)) &&
    (candidate.notifications === undefined || Array.isArray(candidate.notifications)) &&
    (candidate.favorites === undefined || (Array.isArray(candidate.favorites) && candidate.favorites.every((id) => typeof id === "string"))) &&
    (candidate.disputeReports === undefined || Array.isArray(candidate.disputeReports)) &&
    (candidate.proStoreApplications === undefined || Array.isArray(candidate.proStoreApplications)) &&
    (candidate.proStores === undefined || Array.isArray(candidate.proStores)) &&
    (candidate.promotionSettings === undefined || (
      typeof candidate.promotionSettings === "object" &&
      candidate.promotionSettings !== null
    ));
}

function normalizeLocalPromotionSettings(value: unknown): PromotionPaymentSettings {
  const candidate = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const configuredPlanRows = Array.isArray(candidate.promotion_plans) && candidate.promotion_plans.length > 0
    ? candidate.promotion_plans.filter((plan): plan is PromotionPaymentSettings["promotion_plans"][number] =>
      typeof plan === "object" && plan !== null &&
      (plan as Record<string, unknown>).id !== undefined &&
      ["plan_7d", "plan_15d", "plan_30d"].includes(String((plan as Record<string, unknown>).id)))
    : [];
  const configuredPlans = defaultPromotionPaymentSettings.promotion_plans.map((official) => {
    const saved = configuredPlanRows.find((plan) => plan.id === official.id);
    return saved ? {
      ...official,
      amount_dzd: Number.isInteger(saved.amount_dzd) && saved.amount_dzd > 0 ? saved.amount_dzd : official.amount_dzd,
      amount_usd: Number.isFinite(saved.amount_usd) && saved.amount_usd > 0 ? saved.amount_usd : official.amount_usd,
      enabled: typeof saved.enabled === "boolean" ? saved.enabled : official.enabled,
    } : official;
  });
  const configuredPromoCodes = Array.isArray(candidate.promo_codes)
    ? candidate.promo_codes.filter((code): code is PromotionPaymentSettings["promo_codes"][number] =>
      typeof code === "object" && code !== null &&
      typeof (code as Record<string, unknown>).code === "string" &&
      [7, 14].includes(Number((code as Record<string, unknown>).duration_days)) &&
      typeof (code as Record<string, unknown>).active === "boolean" &&
      Array.isArray((code as Record<string, unknown>).redeemed_by))
    : [];
  return {
    ccp_account_number: typeof candidate.ccp_account_number === "string" ? candidate.ccp_account_number : "",
    ccp_key: typeof candidate.ccp_key === "string" ? candidate.ccp_key : "",
    baridimob_rip: typeof candidate.baridimob_rip === "string" ? candidate.baridimob_rip : "",
    account_holder_name: typeof candidate.account_holder_name === "string" ? candidate.account_holder_name : "",
    support_phone: typeof candidate.support_phone === "string" ? candidate.support_phone : "",
    bybit_uid: typeof candidate.bybit_uid === "string" ? candidate.bybit_uid : "",
    bybit_pay_qr_url: typeof candidate.bybit_pay_qr_url === "string" ? candidate.bybit_pay_qr_url : "",
    usdt_wallet_address: typeof candidate.usdt_wallet_address === "string" ? candidate.usdt_wallet_address : "",
    promotion_plans: configuredPlans,
    promo_codes: configuredPromoCodes.map((code) => ({
      code: code.code.toUpperCase(),
      duration_days: code.duration_days,
      active: code.active,
      max_uses: Number.isInteger(code.max_uses) && code.max_uses! > 0 ? code.max_uses : null,
      redeemed_count: Number.isInteger(code.redeemed_count) && code.redeemed_count! >= 0 ? code.redeemed_count : 0,
      redeemed_by: (code.redeemed_by ?? []).filter((id): id is string => typeof id === "string"),
    })),
  };
}

export function getLocalMarketplace(): LocalMarketplaceState {
  if (typeof window === "undefined") return makeInitialLocalMarketplace();
  const raw = window.localStorage.getItem(LOCAL_MARKETPLACE_KEY);
  if (!raw) return makeInitialLocalMarketplace();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (caught) {
    throw new Error(`تعذر قراءة بيانات السوق المحلية: ${caught instanceof Error ? caught.message : "بيانات غير صالحة"}`);
  }
  if (!isLocalMarketplaceState(parsed)) {
    throw new Error("بيانات السوق المحلية غير صالحة. لم يتم حذفها تلقائياً.");
  }
  const now = Date.now();
  const expiredListings = parsed.listings.filter((listing) =>
    Boolean(listing.featured) && Boolean(listing.featuredUntil) && Date.parse(listing.featuredUntil!) <= now,
  );
  const expiredStores = (parsed.proStores ?? []).filter((store) => Date.parse(store.proUntil) <= now);
  const normalized: LocalMarketplaceState = {
    ...parsed,
    listings: parsed.listings.map((listing) => ({
      ...listing,
      featured: Boolean(listing.featured && listing.featuredUntil && Date.parse(listing.featuredUntil) > now),
    })),
    requests: [],
    blackoutDates: [],
    handoverLogs: [],
    reviews: [],
    promotions: parsed.promotions ?? [],
    notifications: parsed.notifications ?? [],
    favorites: parsed.favorites ?? [],
    disputeReports: parsed.disputeReports ?? [],
    proStoreApplications: parsed.proStoreApplications ?? [],
    proStores: (parsed.proStores ?? []).filter((store) => Date.parse(store.proUntil) > now),
    demoInvoices: parsed.demoInvoices ?? [],
    promotionSettings: normalizeLocalPromotionSettings(parsed.promotionSettings),
  };
  window.localStorage.setItem(LOCAL_MARKETPLACE_KEY, JSON.stringify(normalized));
  if (expiredListings.length || expiredStores.length) {
    const expiredIds = new Set(expiredListings.map((listing) => listing.id));
    const timestamp = new Date(now).toISOString();
    const expiredNotifications = expiredListings.map((listing) => ({
      id: `local-notification-${crypto.randomUUID()}`,
      title: "انتهت مدة تمييز إعلانك",
      body: `انتهت مدة إبراز إعلان «${listing.title.ar}» وأصبح يظهر ضمن الإعلانات العادية.`,
      createdAt: timestamp,
      read: false,
    }));
    const expiredStoreNotifications = expiredStores.map((store) => ({
      id: `local-notification-${crypto.randomUUID()}`,
      title: "انتهى اشتراك متجر PRO",
      body: `انتهت مدة اشتراك «${store.storeName}» وأصبح المتجر غير ظاهر في دليل المحترفين.`,
      createdAt: timestamp,
      read: false,
    }));
    normalized.listings = normalized.listings.map((listing) =>
      expiredIds.has(listing.id) ? { ...listing, featured: false, featuredUntil: null } : listing,
    );
    normalized.notifications = [...expiredNotifications, ...expiredStoreNotifications, ...(normalized.notifications ?? [])];
    window.localStorage.setItem(LOCAL_MARKETPLACE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent("ekrrili-local-marketplace-change"));
  }
  return normalized;
}

export function saveLocalMarketplace(state: LocalMarketplaceState) {
  window.localStorage.setItem(LOCAL_MARKETPLACE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("ekrrili-local-marketplace-change"));
}

export function addLocalDisputeReport(input: {
  listingId?: string;
  requestId?: string;
  targetUserId?: string;
  reason: LocalDisputeReport["reason"];
  details: string;
}) {
  const state = getLocalMarketplace();
  const report: LocalDisputeReport = {
    ...input,
    id: `local-dispute-${crypto.randomUUID()}`,
    reporterId: LOCAL_RENTER_ID,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  saveLocalMarketplace({ ...state, disputeReports: [report, ...(state.disputeReports ?? [])] });
}

export function addLocalProStoreApplication(input: Omit<LocalProStoreApplication, "id" | "ownerId" | "status" | "createdAt">) {
  const state = getLocalMarketplace();
  const plan = state.promotionSettings?.promotion_plans.find((item) =>
    item.id === input.planId && item.enabled && item.duration_days === input.proDays &&
    (input.currency === "DZD" ? item.amount_dzd === input.amountDzd : item.amount_usd === input.amountUsd),
  );
  if (input.storeName.trim().length < 2 || !/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(input.slug) ||
      input.bio.length > 2000 || input.paymentReference.trim().length < 4 || input.paymentReference.trim().length > 100 ||
      input.senderInfo.trim().length < 2 || input.senderInfo.trim().length > 120 ||
      !plan ||
      ![7, 15, 30].includes(input.proDays) ||
      (input.currency === "DZD" && (!input.amountDzd || input.amountUsd !== null || input.paymentMethod === "bybit" || !input.receiptDataUrl)) ||
      (input.currency === "USD" && (!input.amountUsd || input.amountDzd !== null || input.paymentMethod !== "bybit"))) {
    throw new Error("بيانات متجر المحترفين غير صالحة.");
  }
  if ((state.proStoreApplications ?? []).some((item) => item.status === "pending")) throw new Error("لديك طلب متجر قيد المراجعة.");
  if ((state.proStoreApplications ?? []).some((item) => item.paymentReference.toLowerCase() === input.paymentReference.trim().toLowerCase())) {
    throw new Error("رقم العملية مستخدم مسبقاً.");
  }
  if ((state.promotions ?? []).some((item) => item.paymentReference.toLowerCase() === input.paymentReference.trim().toLowerCase())) {
    throw new Error("رقم العملية مستخدم مسبقاً.");
  }
  if ((state.proStores ?? []).some((store) => store.slug === input.slug && store.ownerId !== LOCAL_OWNER_ID)) {
    throw new Error("رابط المتجر مستخدم مسبقاً.");
  }
  saveLocalMarketplace({
    ...state,
    proStoreApplications: [{
      ...input,
      id: `local-store-application-${crypto.randomUUID()}`,
      ownerId: LOCAL_OWNER_ID,
      status: "pending",
      createdAt: new Date().toISOString(),
    }, ...(state.proStoreApplications ?? [])],
  });
}

export function reviewLocalProStoreApplication(id: string, decision: "approved" | "rejected") {
  const state = getLocalMarketplace();
  const application = (state.proStoreApplications ?? []).find((item) => item.id === id && item.status === "pending");
  if (!application) throw new Error("لم يتم العثور على طلب متجر بانتظار المراجعة.");
  const now = Date.now();
  const existingStore = (state.proStores ?? []).find((store) => store.ownerId === application.ownerId);
  const extensionBase = existingStore ? Math.max(now, Date.parse(existingStore.proUntil)) : now;
  const proUntil = new Date(extensionBase + application.proDays * 86_400_000).toISOString();
  const proStores = (state.proStores ?? []).filter((store) => store.ownerId !== application.ownerId);
  if (decision === "approved") {
    if (proStores.some((store) => store.slug === application.slug)) throw new Error("رابط المتجر مستخدم مسبقاً.");
    proStores.push({
      ownerId: application.ownerId,
      storeName: application.storeName,
      slug: application.slug,
      bio: application.bio,
      businessHours: application.businessHours,
      wilaya: application.wilaya,
      proUntil,
    });
  }
  saveLocalMarketplace({
    ...state,
    proStores,
    proStoreApplications: (state.proStoreApplications ?? []).map((item) => item.id === id
      ? { ...item, status: decision }
      : item),
    notifications: [{
      id: `local-notification-${crypto.randomUUID()}`,
      title: decision === "approved" ? "تم تفعيل اشتراك متجرك PRO" : "تم رفض طلب متجر PRO",
      body: decision === "approved" ? `تم تفعيل متجر «${application.storeName}» لمدة ${application.proDays} يوماً.` : "يمكنك مراجعة بيانات الدفع وإعادة تقديم الطلب.",
      createdAt: new Date(now).toISOString(),
      read: false,
    }, ...(state.notifications ?? [])],
  });
}

export function setLocalProStoreExpiry(ownerId: string, expiresOn: string) {
  const state = getLocalMarketplace();
  const store = (state.proStores ?? []).find((item) => item.ownerId === ownerId);
  if (!store) throw new Error("لم يتم العثور على متجر محترف.");
  const expiry = new Date(`${expiresOn}T23:59:59.999Z`);
  if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) throw new Error("تاريخ انتهاء المتجر يجب أن يكون مستقبلياً.");
  saveLocalMarketplace({
    ...state,
    proStores: (state.proStores ?? []).map((item) => item.ownerId === ownerId ? { ...item, proUntil: expiry.toISOString() } : item),
  });
}

export function addLocalListing(input: LocalListingInput) {
  const state = getLocalMarketplace();
  const category = categories.find((item) => item.id === input.category);
  const location = locations.find((item) => item.code === input.wilaya);
  if (!category || !location) throw new Error("تحقق من الفئة والولاية المختارتين.");

  const id = `local-${crypto.randomUUID()}`;
  const listing: LocalListing = {
    id,
    title: { ar: input.title, fr: input.title },
    description: input.description,
    category: input.category,
    wilaya: input.wilaya,
    commune: input.commune,
    price: input.pricePerDay,
    pricePerWeek: input.pricePerWeek || undefined,
    pricePerMonth: input.pricePerMonth || undefined,
    deliveryAvailable: input.deliveryAvailable ?? false,
    deliveryFeeDzd: input.deliveryFeeDzd ?? 0,
    addons: (input.addons ?? []).map((addon) => ({ name: addon.name, price_per_day_dzd: addon.pricePerDayDzd })),
    caution: input.cautionDepositAmount,
    cautionType: input.cautionType === "none" ? null : input.cautionType,
    rating: 0,
    reviews: 0,
    owner: { ar: "صاحب الإعلان التجريبي", fr: "Membre de démonstration" },
    ownerPhone: "+213555000000",
    verified: false,
    responseRate: null,
    images: input.images,
    metadata: input.metadata,
    condition: String(input.metadata.condition ?? "الحالة تُحدّد عند التسليم الحضوري."),
    featured: false,
    status: "active",
    ownerId: LOCAL_OWNER_ID,
    cautionTerms: input.cautionTerms,
    createdAt: new Date().toISOString(),
  };
  saveLocalMarketplace({ ...state, listings: [listing, ...state.listings] });
  return listing;
}

export function updateLocalListing(
  id: string,
  patch: { title?: string; description?: string; price?: number },
) {
  const state = getLocalMarketplace();
  const index = state.listings.findIndex((listing) => listing.id === id && listing.ownerId === LOCAL_OWNER_ID);
  if (index < 0) throw new Error("لم يتم العثور على الإعلان.");
  const listings = [...state.listings];
  listings[index] = { ...listings[index], ...patch, title: patch.title ? { ar: patch.title, fr: patch.title } : listings[index].title };
  saveLocalMarketplace({ ...state, listings });
}

export function updateLocalProfile(profile: { fullName: string; phoneNumber: string; wilaya: string }) {
  const state = getLocalMarketplace();
  const wilayaCode = locations.find((location) => location.code === profile.wilaya || location.name.ar === profile.wilaya)?.code ?? "";
  saveLocalMarketplace({
    ...state,
    profile: { ...profile, wilaya: wilayaCode },
  });
}

export function setLocalListingStatus(id: string, status: "active" | "paused") {
  const state = getLocalMarketplace();
  const listing = state.listings.find((item) => item.id === id && item.ownerId === LOCAL_OWNER_ID);
  if (!listing) throw new Error("لم يتم العثور على الإعلان.");
  if (listing.status === "rented") throw new Error("لا يمكن تغيير حالة إعلان مرتبط بإيجار جارٍ.");
  saveLocalMarketplace({
    ...state,
    listings: state.listings.map((item) => item.id === id ? { ...item, status } : item),
  });
}

export function deleteLocalListing(id: string) {
  const state = getLocalMarketplace();
  if (state.requests.some((request) => request.listingId === id)) {
    throw new Error("لا يمكن حذف إعلان له طلبات محفوظة. أوقفه مؤقتاً بدلاً من ذلك.");
  }
  saveLocalMarketplace({
    ...state,
    listings: state.listings.filter((listing) => listing.id !== id || listing.ownerId !== LOCAL_OWNER_ID),
  });
}

export function addLocalRentalRequest(input: {
  listingId: string;
  startDate: string;
  endDate: string;
  deliveryMethod?: "pickup" | "delivery";
  selectedAddons?: string[];
}) {
  void input;
  throw new Error("اكريلي منصة إعلانات مبوبة فقط؛ يرجى التواصل مباشرة مع المعلن.");
}

export function saveLocalPromotionSettings(settings: PromotionPaymentSettings) {
  const officialPlans = [
    ["plan_7d", 7, "باقة 7 أيام - أسبوع"],
    ["plan_15d", 15, "خطة 15 يوم"],
    ["plan_30d", 30, "خطة 30 يوم - شهر كامل"],
  ] as const;
  if (settings.promotion_plans.length !== officialPlans.length ||
      !settings.promotion_plans.some((plan) => plan.enabled) ||
      officialPlans.some(([id, days, name]) => !settings.promotion_plans.some((plan) =>
        plan.id === id &&
        plan.duration_days === days &&
        plan.name === name &&
        Number.isInteger(plan.amount_dzd) && plan.amount_dzd > 0 &&
        Number.isFinite(plan.amount_usd) && plan.amount_usd > 0)) ||
      settings.promo_codes.some((promo) =>
        !/^[A-Z0-9_-]{3,32}$/.test(promo.code) ||
        ![7, 14].includes(promo.duration_days) ||
        (promo.max_uses !== null && (!Number.isInteger(promo.max_uses) || promo.max_uses < 1)))) {
    throw new Error("تحقق من الباقات الثلاثة ورموز الخصم ومددها وأسعارها.");
  }
  const state = getLocalMarketplace();
  saveLocalMarketplace({ ...state, promotionSettings: settings });
}

export function redeemLocalFeaturedPromoCode(listingId: string, rawCode: string) {
  const state = getLocalMarketplace();
  const code = rawCode.trim().toUpperCase();
  const promo = state.promotionSettings?.promo_codes.find((item) => item.code === code && item.active);
  const listing = state.listings.find((item) => item.id === listingId && item.ownerId === LOCAL_OWNER_ID);
  if (!listing || !promo) throw new Error("الإعلان أو الرمز الترويجي غير صالح.");
  if (listing.featured && listing.featuredUntil && Date.parse(listing.featuredUntil) > Date.now()) {
    throw new Error("هذا الإعلان لديه تمييز نشط بالفعل.");
  }
  if ((promo.redeemed_by ?? []).includes(LOCAL_OWNER_ID)) throw new Error("تم استخدام هذا الرمز مسبقاً لهذا الحساب.");
  if (promo.max_uses !== null && promo.redeemed_count >= promo.max_uses) throw new Error("انتهت مرات استخدام هذا الرمز.");
  const featuredUntil = new Date(Date.now() + promo.duration_days * 86_400_000).toISOString();
  saveLocalMarketplace({
    ...state,
    listings: state.listings.map((item) => item.id === listingId ? { ...item, featured: true, featuredUntil } : item),
    promotionSettings: {
      ...state.promotionSettings!,
      promo_codes: state.promotionSettings!.promo_codes.map((item) => item.code === code
        ? { ...item, redeemed_count: item.redeemed_count + 1, redeemed_by: [...(item.redeemed_by ?? []), LOCAL_OWNER_ID] }
        : item),
    },
    notifications: [{
      id: `local-notification-${crypto.randomUUID()}`,
      title: "تم تفعيل التمييز المجاني",
      body: `تم تفعيل تمييز إعلانك لمدة ${promo.duration_days} يوماً باستخدام الرمز ${code}.`,
      createdAt: new Date().toISOString(),
      read: false,
    }, ...(state.notifications ?? [])],
  });
  return { featuredUntil, durationDays: promo.duration_days };
}

export function addLocalPromotion(input: {
  listingId: string;
  receiptName: string | null;
  receiptDataUrl: string | null;
  planId: string;
  durationDays: number;
  amountDzd: number | null;
  amountUsd: number | null;
  currency: "DZD" | "USD";
  paymentMethod: "baridimob" | "ccp" | "bybit";
  paymentReference: string;
  senderInfo: string;
}) {
  const state = getLocalMarketplace();
  const plan = state.promotionSettings?.promotion_plans.find((item) =>
    item.id === input.planId && item.enabled && item.duration_days === input.durationDays &&
    (input.currency === "DZD" ? item.amount_dzd === input.amountDzd : item.amount_usd === input.amountUsd),
  );
  const listing = state.listings.find((item) => item.id === input.listingId && item.ownerId === LOCAL_OWNER_ID);
  if (!listing || !plan) throw new Error("تعذر العثور على الإعلان أو الباقة.");
  if (input.paymentReference.trim().length < 4 || input.paymentReference.trim().length > 100 ||
      input.senderInfo.trim().length < 2 || input.senderInfo.trim().length > 120 ||
      (input.currency === "DZD" && !input.receiptDataUrl)) throw new Error("أكمل رقم العملية وبيانات التحويل وأرفق الإيصال.");
  if ([...(state.promotions ?? []), ...(state.proStoreApplications ?? [])].some((item) =>
    item.paymentReference.toLowerCase() === input.paymentReference.trim().toLowerCase())) {
    throw new Error("رقم العملية مستخدم مسبقاً.");
  }
  if ((state.promotions ?? []).some((item) => item.listingId === listing.id && item.status === "pending")) {
    throw new Error("يوجد طلب تمييز قيد المراجعة لهذا الإعلان.");
  }
  const promotion: LocalPromotion = {
    ...input,
    id: `local-promotion-${crypto.randomUUID()}`,
    ownerId: LOCAL_OWNER_ID,
    receiptImageDataUrl: input.receiptDataUrl,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  saveLocalMarketplace({ ...state, promotions: [promotion, ...(state.promotions ?? [])] });
}

export function reviewLocalPromotion(promotionId: string, decision: "approved" | "rejected") {
  const state = getLocalMarketplace();
  const promotion = (state.promotions ?? []).find((item) => item.id === promotionId && item.status === "pending");
  if (!promotion) throw new Error("لم يتم العثور على طلب تمييز بانتظار المراجعة.");
  const featuredUntil = new Date(Date.now() + promotion.durationDays * 86_400_000).toISOString();
  saveLocalMarketplace({
    ...state,
    listings: decision === "approved" ? state.listings.map((listing) => listing.id === promotion.listingId
      ? { ...listing, featured: true, featuredUntil }
      : listing) : state.listings,
    promotions: (state.promotions ?? []).map((item) => item.id === promotionId ? { ...item, status: decision } : item),
    notifications: [{
      id: `local-notification-${crypto.randomUUID()}`,
      title: decision === "approved" ? "تم تمييز إعلانك" : "تم رفض طلب التمييز",
      body: decision === "approved" ? `تم تفعيل التمييز لمدة ${promotion.durationDays} يوماً.` : "راجع بيانات التحويل ثم أعد تقديم الطلب.",
      createdAt: new Date().toISOString(),
      read: false,
    }, ...(state.notifications ?? [])],
  });
}

export function activateLocalCardPlan(input: {
  target: "featured" | "pro_store";
  listingId?: string;
  planId: "plan_7d" | "plan_15d" | "plan_30d";
  durationDays: number;
  currency: "DZD" | "USD";
  amount: number;
  cardBrand: "bybit_card" | "edahabia" | "visa" | "mastercard";
  cardLast4: string;
  store?: Omit<LocalProStore, "ownerId" | "proUntil">;
}) {
  const state = getLocalMarketplace();
  const plan = state.promotionSettings?.promotion_plans.find((item) =>
    item.id === input.planId && item.enabled && item.duration_days === input.durationDays &&
    (input.currency === "DZD" ? item.amount_dzd : item.amount_usd) === input.amount,
  );
  if (!plan || !/^\d{4}$/.test(input.cardLast4)) throw new Error("بيانات تجربة الدفع غير صالحة.");
  const transactionId = `INV-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const now = Date.now();
  const currentStore = (state.proStores ?? []).find((item) => item.ownerId === LOCAL_OWNER_ID);
  const extensionBase = currentStore ? Math.max(now, Date.parse(currentStore.proUntil)) : now;
  const expiresAt = new Date(extensionBase + input.durationDays * 86_400_000).toISOString();
  const invoice = {
    transactionId, planId: input.planId, currency: input.currency, amount: input.amount,
    durationDays: input.durationDays, cardBrand: input.cardBrand, cardLast4: input.cardLast4, expiresAt, target: input.target,
  };
  if (input.target === "featured") {
    const targetListingId = input.listingId;
    if (!targetListingId) throw new Error("حدد الإعلان المطلوب تمييزه.");
    const listing = state.listings.find((item) => item.id === targetListingId && item.ownerId === LOCAL_OWNER_ID);
    if (!listing) throw new Error("الإعلان غير موجود أو لا تملكه.");
    saveLocalMarketplace({
      ...state,
      listings: state.listings.map((item) => item.id === targetListingId ? { ...item, featured: true, featuredUntil: expiresAt } : item),
      demoInvoices: [invoice, ...(state.demoInvoices ?? [])],
    });
  } else {
    if (!input.store) throw new Error("أدخل بيانات المتجر المحترف.");
    const stores = (state.proStores ?? []).filter((item) => item.ownerId !== LOCAL_OWNER_ID);
    if (stores.some((item) => item.slug === input.store?.slug)) throw new Error("رابط المتجر مستخدم مسبقاً.");
    stores.push({ ...input.store, ownerId: LOCAL_OWNER_ID, proUntil: expiresAt });
    saveLocalMarketplace({ ...state, proStores: stores, demoInvoices: [invoice, ...(state.demoInvoices ?? [])] });
  }
  return { transactionId, expiresAt };
}
