import type { CategoryId, Locale } from "@/features/listings/listing-options";

export type DemoListing = {
  id: string;
  title: Record<Locale, string>;
  description: string;
  category: CategoryId;
  wilaya: string;
  commune: string;
  price: number;
  pricePerWeek?: number;
  pricePerMonth?: number;
  deliveryAvailable?: boolean;
  deliveryFeeDzd?: number;
  addons?: Array<{ name: string; price_per_day_dzd: number }>;
  caution: number;
  cautionType: "cash" | "cheque" | null;
  rating: number;
  reviews: number;
  owner: Record<Locale, string>;
  ownerPhone: string;
  verified: boolean;
  responseRate: number | null;
  images: string[];
  metadata: Record<string, unknown>;
  condition: string;
  featured?: boolean;
  badge?: Record<Locale, string>;
};

export const demoListings: DemoListing[] = [
  {
    id: "camera-kit",
    title: { ar: "كاميرا Sony Alpha مع عدسة 50mm", fr: "Sony Alpha avec objectif 50 mm" },
    description: "كاميرا احترافية بحالة ممتازة، مناسبة للتصوير والمناسبات. تُسلّم مع البطارية والشاحن والحقيبة.",
    category: "camera",
    wilaya: "16",
    commune: "Alger-Centre",
    price: 3500,
    caution: 20000,
    cautionType: "cash",
    rating: 4.9,
    reviews: 28,
    owner: { ar: "ياسمين بن صالح", fr: "Yasmine Ben Salah" },
    ownerPhone: "+213555010101",
    verified: true,
    responseRate: 96,
    images: [
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1502982720700-bfff97f2ecac?auto=format&fit=crop&w=1200&q=85",
    ],
    metadata: { model: "Sony Alpha", accessories: ["battery", "charger", "bag"], serialNumber: "غير معلن" },
    condition: "حالة ممتازة، تم اختبارها قبل التسليم.",
    badge: { ar: "مفضّل لدى المستأجرين", fr: "Coup de cœur" },
  },
  {
    id: "city-car",
    title: { ar: "سيارة Peugeot 208 اقتصادية", fr: "Peugeot 208 économique" },
    description: "سيارة مريحة ونظيفة للتنقل داخل المدينة وخارجها. يرجى التواصل لتأكيد التوفر وشروط الاستلام.",
    category: "vehicle",
    wilaya: "16",
    commune: "Bir Mourad Raïs",
    price: 6500,
    caution: 30000,
    cautionType: "cheque",
    rating: 4.8,
    reviews: 46,
    owner: { ar: "مراد قادري", fr: "Mourad K." },
    ownerPhone: "+213555010202",
    verified: true,
    responseRate: 92,
    images: [
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=85",
    ],
    metadata: { transmission: "automatic", fuelType: "petrol", mileage: 42000 },
    condition: "حالة جيدة جداً، صيانة دورية حديثة.",
  },
  {
    id: "drill-set",
    title: { ar: "مثقاب احترافي مع طقم كامل", fr: "Perceuse pro avec accessoires" },
    description: "مثقاب عملي للأعمال المنزلية والورش، مع طقم ملحقات. متاح للاستلام في وهران.",
    category: "machinery",
    wilaya: "31",
    commune: "Bir El Djir",
    price: 1800,
    caution: 5000,
    cautionType: "cash",
    rating: 5,
    reviews: 17,
    owner: { ar: "سفيان بوعلام", fr: "Sofiane Boualem" },
    ownerPhone: "+213555010303",
    verified: true,
    responseRate: null,
    images: [
      "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1581147036324-c1c89c2c8b5c?auto=format&fit=crop&w=1200&q=85",
    ],
    metadata: { machineType: "مثقاب كهربائي", voltage: "220V", operatingHours: 28, powerSource: "electric" },
    condition: "حالة جيدة، يعمل بجهد 220V ويُفحص عند التسليم.",
    badge: { ar: "إعلان جديد", fr: "Nouveau" },
  },
  {
    id: "laptop-pro",
    title: { ar: "MacBook Pro للعمل والإبداع", fr: "MacBook Pro pour créer" },
    description: "حاسوب محمول مناسب للعمل الإبداعي والدراسة. يأتي مع الشاحن وغطاء حماية.",
    category: "electronics",
    wilaya: "25",
    commune: "Constantine",
    price: 4200,
    caution: 25000,
    cautionType: "cheque",
    rating: 4.9,
    reviews: 34,
    owner: { ar: "ليلى مراد", fr: "Leïla Mourad" },
    ownerPhone: "+213555010404",
    verified: true,
    responseRate: 88,
    images: [
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=85",
    ],
    metadata: { model: "MacBook Pro", accessories: ["charger", "case"], serialNumber: "متاح عند المعاينة" },
    condition: "حالة ممتازة، البطارية والشاشة تعملان جيداً.",
  },
  {
    id: "event-lighting",
    title: { ar: "طقم إضاءة وصوت للحفلات", fr: "Pack lumière et sonorisation" },
    description: "تجهيزات صوت وإضاءة مناسبة للمناسبات الصغيرة والمتوسطة. السعر للطقم في اليوم.",
    category: "event",
    wilaya: "31",
    commune: "Oran",
    price: 8000,
    caution: 15000,
    cautionType: "cash",
    rating: 4.7,
    reviews: 12,
    owner: { ar: "أمين", fr: "Amine" },
    ownerPhone: "+213555010505",
    verified: false,
    responseRate: null,
    images: [
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1200&q=85",
    ],
    metadata: { itemType: "إضاءة وصوت", quantity: 1 },
    condition: "تم اختبار جميع القطع قبل التسليم.",
  },
  {
    id: "camping-tent",
    title: { ar: "خيمة عائلية لأربعة أشخاص", fr: "Tente familiale 4 personnes" },
    description: "خيمة عائلية واسعة للرحلات والتخييم، سهلة التركيب ومناسبة لأربعة أشخاص.",
    category: "camping",
    wilaya: "06",
    commune: "Béjaïa",
    price: 2200,
    caution: 6000,
    cautionType: "cash",
    rating: 4.9,
    reviews: 21,
    owner: { ar: "نور", fr: "Nour" },
    ownerPhone: "+213555010606",
    verified: true,
    responseRate: 95,
    images: [
      "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1504851149312-7a075b496cc7?auto=format&fit=crop&w=1200&q=85",
    ],
    metadata: { itemType: "خيمة عائلية", capacity: 4, accessories: ["أوتاد", "غطاء مطر"] },
    condition: "نظيفة وسليمة، تُسلّم مع الأوتاد وغطاء المطر.",
    badge: { ar: "قرب البحر", fr: "Près de la mer" },
  },
  {
    id: "weekend-home",
    title: { ar: "شقة مضيئة لقضاء عطلة", fr: "Appartement lumineux pour un séjour" },
    description: "شقة مشرقة ومجهزة لقضاء عطلة مريحة. يرجى تحديد عدد الضيوف عند طلب الحجز.",
    category: "real-estate",
    wilaya: "15",
    commune: "Tizi Ouzou",
    price: 9500,
    caution: 20000,
    cautionType: "cash",
    rating: 4.8,
    reviews: 19,
    owner: { ar: "كمال", fr: "Kamel" },
    ownerPhone: "+213555010707",
    verified: true,
    responseRate: 90,
    images: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=85",
    ],
    metadata: { propertyType: "شقة", bedrooms: 2, area: 82 },
    condition: "نظيفة ومجهزة، تُسلّم بعد المعاينة.",
  },
];

export function getDemoListing(id: string) {
  return demoListings.find((listing) => listing.id === id);
}
