"use client";

import { Check, Copy, CreditCard, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { PromotionPaymentSettings } from "@/features/promotions/promotion-settings";
import { addLocalPromotion, addLocalProStoreApplication, activateLocalCardPlan, redeemLocalFeaturedPromoCode } from "@/features/listings/local-marketplace";
import { redeemFeaturedPromoCode, submitPlatformSubscriptionPayment } from "@/features/dashboard/dashboard-actions";
import type { PromotionPlan } from "@/features/promotions/promotion-settings";

type CheckoutTarget =
  | { type: "featured"; listingId: string; listingTitle: string }
  | { type: "pro_store" };

type Props = {
  target: CheckoutTarget;
  settings: PromotionPaymentSettings;
  demoMode: boolean;
  onClose?: () => void;
};

const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-[#dce5de] bg-white px-3 text-sm outline-none focus:border-[#72a987]";

function brandFor(number: string): "bybit_card" | "edahabia" | "visa" | "mastercard" {
  const digits = number.replace(/\D/g, "");
  if (digits.startsWith("9704") || digits.startsWith("6037")) return "edahabia";
  if (digits.startsWith("4")) return "visa";
  if (/^(5[1-5]|2)/.test(digits)) return "mastercard";
  return "bybit_card";
}

function formatCardNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

function passesLuhn(digits: string) {
  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("تعذرت قراءة صورة الإيصال."));
    reader.onerror = () => reject(new Error("تعذرت قراءة صورة الإيصال."));
    reader.readAsDataURL(file);
  });
}

export function PromotionCheckout({ target, settings, demoMode, onClose }: Props) {
  const plans = settings.promotion_plans.filter((plan) => plan.enabled);
  const [planId, setPlanId] = useState<PromotionPlan["id"]>(plans[0]?.id ?? "plan_7d");
  const [currency, setCurrency] = useState<"DZD" | "USD">("DZD");
  const [method, setMethod] = useState<"baridimob" | "ccp" | "bybit">("baridimob");
  const [tab, setTab] = useState<"card" | "transfer">("transfer");
  const [holder, setHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [receiptPreview, setReceiptPreview] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const router = useRouter();
  const selectedPlan = plans.find((plan) => plan.id === planId) ?? plans[0];
  const amount = selectedPlan ? (currency === "DZD" ? selectedPlan.amount_dzd : selectedPlan.amount_usd) : 0;
  const cardBrand = useMemo(() => brandFor(cardNumber), [cardNumber]);
  const isProStore = target.type === "pro_store";

  const chooseCurrency = (value: "DZD" | "USD") => {
    setCurrency(value);
    setMethod(value === "DZD" ? "baridimob" : "bybit");
  };

  const applyPromoCode = async () => {
    if (target.type !== "featured") return;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      if (demoMode) {
        const result = redeemLocalFeaturedPromoCode(target.listingId, promoCode);
        setFeedback(`تم تفعيل التمييز المجاني لمدة ${result.durationDays} يوماً.`);
      } else {
        const result = await redeemFeaturedPromoCode(target.listingId, promoCode);
        if (result.error) throw new Error(result.error);
        setFeedback(result.success ?? "تم تطبيق الرمز الترويجي.");
      }
      setPromoCode("");
      router.refresh();
      onClose?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تطبيق الرمز الترويجي.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setFeedback("تم نسخ البيانات.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر نسخ البيانات.");
    }
  };

  const startDemoOtp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const digits = cardNumber.replace(/\D/g, "");
    if (!demoMode) {
      setError("الدفع بالبطاقة متاح كمحاكاة تعليمية في الوضع التجريبي فقط. استخدم التحويل المباشر.");
      return;
    }
    if (holder.trim().length < 3 || digits.length !== 16 || !passesLuhn(digits) || !/^\d{2}\/\d{2}$/.test(expiry) || cvv.length !== 3) {
      setError("أدخل اسم حامل البطاقة ورقم 16 خانة وتاريخاً صالحاً ورمز CVV من 3 أرقام.");
      return;
    }
    if (isProStore && (localStoreName.trim().length < 2 || !/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(localStoreSlug) || !localStoreWilaya.trim())) {
      setError("أكمل اسم المتجر ورابطه والولاية قبل الدفع.");
      return;
    }
    const [month, year] = expiry.split("/").map(Number);
    const expiryDate = new Date(2000 + year, month, 0, 23, 59, 59);
    if (month < 1 || month > 12 || expiryDate.getTime() <= Date.now()) {
      setError("تاريخ انتهاء البطاقة غير صالح.");
      return;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setGeneratedOtp(code);
    setOtp("");
    setOtpStep(true);
    setError("");
    setFeedback(`رمز التحقق التجريبي: ${code}`);
  };

  const confirmDemoPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (otp !== generatedOtp) {
      setError("رمز التحقق غير صحيح.");
      return;
    }
    if (!selectedPlan) return;
    setBusy(true);
    setError("");
    try {
      const result = activateLocalCardPlan({
        target: isProStore ? "pro_store" : "featured",
        listingId: target.type === "featured" ? target.listingId : undefined,
        planId: selectedPlan.id,
        durationDays: selectedPlan.duration_days,
        currency,
        amount,
        cardBrand,
        cardLast4: cardNumber.replace(/\D/g, "").slice(-4),
        store: isProStore ? {
          storeName: localStoreName,
          slug: localStoreSlug,
          bio: localStoreBio,
          businessHours: {},
          wilaya: localStoreWilaya,
        } : undefined,
      });
      setFeedback(`تمت المحاكاة بنجاح. رقم الفاتورة ${result.transactionId} — لا توجد عملية خصم حقيقية.`);
      setCardNumber("");
      setCvv("");
      setExpiry("");
      setOtp("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذرت محاكاة الدفع.");
    } finally {
      setBusy(false);
    }
  };

  const [localStoreName, setLocalStoreName] = useState("");
  const [localStoreSlug, setLocalStoreSlug] = useState("");
  const [localStoreBio, setLocalStoreBio] = useState("");
  const [localStoreWilaya, setLocalStoreWilaya] = useState("");

  const submitTransfer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPlan) return;
    if (currency === "DZD" && (method === "baridimob" ? !settings.baridimob_rip : !settings.ccp_account_number)) {
      setError(`بيانات ${method === "baridimob" ? "BaridiMob RIP" : "CCP"} غير مضبوطة بعد من الإدارة.`);
      return;
    }
    if (currency === "USD" && !settings.bybit_uid && !settings.usdt_wallet_address) {
      setError("بيانات Bybit/USDT غير مضبوطة بعد من الإدارة.");
      return;
    }
    if (isProStore && (localStoreName.trim().length < 2 || !/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(localStoreSlug) || !localStoreWilaya.trim())) {
      setError("أكمل اسم المتجر ورابطه والولاية.");
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("targetType", target.type);
    data.set("listingId", target.type === "featured" ? target.listingId : "");
    data.set("planId", selectedPlan.id);
    data.set("durationDays", String(selectedPlan.duration_days));
    data.set("currency", currency);
    data.set("amount", String(amount));
    data.set("paymentMethod", currency === "USD" ? "bybit" : method);
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      if (demoMode) {
        const file = data.get("receipt");
        const receiptDataUrl = file instanceof File && file.size ? await readFile(file) : null;
        const common = {
          planId: selectedPlan.id,
          durationDays: selectedPlan.duration_days,
          currency,
          amountDzd: currency === "DZD" ? amount : null,
          amountUsd: currency === "USD" ? amount : null,
          paymentMethod: currency === "USD" ? "bybit" as const : method,
          paymentReference: String(data.get("paymentReference") ?? ""),
          senderInfo: String(data.get("senderInfo") ?? ""),
        };
        if (target.type === "featured") {
          addLocalPromotion({
            listingId: target.listingId,
            receiptName: file instanceof File && file.size ? file.name : null,
            receiptDataUrl,
            ...common,
          });
        } else {
          addLocalProStoreApplication({
            storeName: String(data.get("storeName") ?? ""),
            slug: String(data.get("storeSlug") ?? "").toLowerCase(),
            bio: String(data.get("storeBio") ?? ""),
            businessHours: {},
            wilaya: String(data.get("storeWilaya") ?? ""),
            receiptDataUrl,
            paymentReference: common.paymentReference,
            proDays: selectedPlan.duration_days,
            planId: selectedPlan.id,
            currency,
            amountDzd: common.amountDzd,
            amountUsd: common.amountUsd,
            paymentMethod: common.paymentMethod,
            senderInfo: common.senderInfo,
          });
        }
        setFeedback("تم إرسال طلب الدفع إلى قائمة مراجعة الإدارة. لن يتم تفعيل الاشتراك قبل التأكيد.");
      } else {
        const result = await submitPlatformSubscriptionPayment(data);
        if (result.error) throw new Error(result.error);
        setFeedback(result.success ?? "تم إرسال طلب الدفع للمراجعة.");
        router.refresh();
      }
      form.reset();
      setReceiptPreview("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر إرسال طلب الدفع.");
    } finally {
      setBusy(false);
    }
  };

  const onReceiptChange = (file?: File) => {
    setReceiptPreview(file ? URL.createObjectURL(file) : "");
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/45 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="الدفع والترقية">
      <section className="mx-auto my-3 max-w-3xl overflow-hidden rounded-3xl bg-[#f8faf8] shadow-2xl sm:my-8">
        <header className="flex items-center justify-between border-b border-[#e5ebe6] bg-white px-5 py-4">
          <div><p className="text-xs font-bold text-[#17734e]">خدمات المنصة فقط</p><h2 className="mt-1 text-lg font-extrabold">{isProStore ? "اشتراك متجر محترف PRO" : `ترقية الإعلان: ${target.listingTitle}`}</h2></div>
          {onClose && <button onClick={onClose} type="button" aria-label="إغلاق" className="rounded-xl p-2 text-[#718078] hover:bg-[#f1f5f1]"><X size={20} /></button>}
        </header>
        <div className="space-y-5 p-4 sm:p-6">
          <p className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs leading-5 text-sky-900">هذه الرسوم مقابل إبراز الإعلان أو اشتراك واجهة المتجر فقط. الكراء والضمان وتسليم الأغراض تبقى معاملات مباشرة بين المستخدمين خارج اكريلي.</p>
          {isProStore && <div className="grid gap-3 rounded-2xl border border-[#e1e9e2] bg-white p-4 sm:grid-cols-2">
            <label className="text-xs font-bold">اسم المتجر<input required minLength={2} maxLength={120} value={localStoreName} onChange={(event) => setLocalStoreName(event.target.value)} className={inputClass} /></label>
            <label className="text-xs font-bold">رابط المتجر (بالإنجليزية)<input required pattern="[a-z0-9][a-z0-9-]{1,58}[a-z0-9]" value={localStoreSlug} onChange={(event) => setLocalStoreSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} className={inputClass} placeholder="my-store" dir="ltr" /></label>
            <label className="text-xs font-bold">الولاية<input required maxLength={100} value={localStoreWilaya} onChange={(event) => setLocalStoreWilaya(event.target.value)} className={inputClass} /></label>
            <label className="text-xs font-bold sm:col-span-2">نبذة عن المتجر<textarea maxLength={2000} value={localStoreBio} onChange={(event) => setLocalStoreBio(event.target.value)} className="mt-1.5 min-h-20 w-full rounded-xl border border-[#dce5de] bg-white p-3 text-sm" /></label>
          </div>}
          {target.type === "featured" && (
            <form className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4" onSubmit={(event) => { event.preventDefault(); void applyPromoCode(); }}>
              <label className="block text-xs font-extrabold" htmlFor="promotion-promo-code">كود ترويجي (Promo Code)</label>
              <div className="mt-2 flex gap-2">
                <input id="promotion-promo-code" value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} maxLength={32} autoCapitalize="characters" className="h-11 min-w-0 flex-1 rounded-xl border border-emerald-200 bg-white px-3 text-sm" placeholder="LAUNCH2026" />
                <button type="submit" disabled={busy || promoCode.trim().length < 3} className="shrink-0 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white disabled:opacity-50">تفعيل مجاناً</button>
              </div>
              <p className="mt-2 text-[10px] leading-5 text-emerald-900">إن كان الرمز صالحاً، سيفعّل التمييز فوراً دون رفع إيصال.</p>
            </form>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset>
              <legend className="mb-2 text-xs font-extrabold">اختر الباقة</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{plans.map((plan) => <button type="button" key={plan.id} onClick={() => setPlanId(plan.id)} className={`rounded-xl border p-3 text-start ${plan.id === planId ? "border-[#17734e] bg-[#edf6ef]" : "border-[#e0e7e1] bg-white"}`}><strong className="block text-sm">{plan.name}</strong><span className="mt-1 block text-[10px] text-[#77847b]">{plan.duration_days} يوم</span><b className="mt-2 block text-xs">{currency === "DZD" ? `${plan.amount_dzd.toLocaleString("fr-DZ")} د.ج` : `$${plan.amount_usd} USD / USDT`}</b></button>)}</div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-xs font-extrabold">العملة</legend>
              <div className="flex rounded-xl border border-[#e0e7e1] bg-white p-1"><button type="button" onClick={() => chooseCurrency("DZD")} className={`min-h-10 flex-1 rounded-lg text-xs font-bold ${currency === "DZD" ? "bg-[#17734e] text-white" : "text-[#647269]"}`}>DZD د.ج</button><button type="button" onClick={() => chooseCurrency("USD")} className={`min-h-10 flex-1 rounded-lg text-xs font-bold ${currency === "USD" ? "bg-[#17734e] text-white" : "text-[#647269]"}`}>USD $ / USDT</button></div>
              <p className="mt-3 text-xs text-[#76837a]">السعر الحالي: <strong className="text-[#17231d]">{currency === "DZD" ? `${amount.toLocaleString("fr-DZ")} د.ج` : `$${amount} USD / USDT`}</strong></p>
              <p className="mt-1 text-[10px] text-[#849087]">يبدأ الاشتراك بعد تأكيد الدفع. انتهاء الباقة يزيل شارة التمييز/PRO تلقائياً.</p>
            </fieldset>
          </div>

          <div className="flex gap-2 border-b border-[#e2e9e3]">
            <button type="button" onClick={() => { setTab("card"); setError(""); }} className={`flex min-h-11 items-center gap-2 border-b-2 px-3 text-xs font-bold ${tab === "card" ? "border-[#17734e] text-[#176744]" : "border-transparent text-[#718078]"}`}><CreditCard size={15} /> الدفع المباشر بالبطاقة</button>
            <button type="button" onClick={() => { setTab("transfer"); setOtpStep(false); setError(""); }} className={`flex min-h-11 items-center gap-2 border-b-2 px-3 text-xs font-bold ${tab === "transfer" ? "border-[#17734e] text-[#176744]" : "border-transparent text-[#718078]"}`}><ShieldCheck size={15} /> تحويل إلى المنصة</button>
          </div>

          {tab === "card" && <div className="space-y-4">
            <div className={`relative mx-auto aspect-[1.75/1] w-full max-w-md overflow-hidden rounded-2xl p-5 text-white shadow-xl transition-all ${cardBrand === "edahabia" ? "bg-gradient-to-br from-amber-700 via-yellow-600 to-amber-300" : cardBrand === "visa" || cardBrand === "mastercard" ? "bg-gradient-to-br from-slate-900 to-blue-800" : "bg-gradient-to-br from-[#111b17] via-[#1e3529] to-[#a88337]"}`}>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest"><span>{cardBrand === "edahabia" ? "Algérie Poste · Edahabia" : cardBrand === "visa" || cardBrand === "mastercard" ? (cardBrand === "visa" ? "VISA" : "Mastercard") : "Bybit · Black / Gold"}</span><span>EKRRILI · SIMULATION</span></div>
              <div className="mt-7 text-xl tracking-[0.15em] sm:mt-9 sm:text-2xl">{cardNumber || "•••• •••• •••• ••••"}</div>
              <div className="mt-5 flex items-end justify-between"><span className="truncate text-xs uppercase">{holder || "CARDHOLDER NAME"}</span><span className="text-xs">{expiry || "MM/YY"}</span></div>
            </div>
            {demoMode ? otpStep ? <form onSubmit={confirmDemoPayment} className="grid gap-3 sm:grid-cols-[1fr_auto]"><label className="text-xs font-bold">رمز التحقق التجريبي (OTP)<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} className={inputClass} /></label><button disabled={busy} className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17734e] px-4 text-xs font-bold text-white disabled:opacity-50">{busy ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />} تأكيد وإصدار فاتورة</button></form> : <form onSubmit={startDemoOtp} className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold sm:col-span-2">الاسم الكامل على البطاقة<input autoComplete="cc-name" value={holder} onChange={(event) => setHolder(event.target.value)} className={inputClass} /></label>
              <label className="text-xs font-bold sm:col-span-2">رقم البطاقة<input inputMode="numeric" autoComplete="cc-number" value={cardNumber} onChange={(event) => setCardNumber(formatCardNumber(event.target.value))} placeholder="0000 0000 0000 0000" className={inputClass} /></label>
              <label className="text-xs font-bold">تاريخ الانتهاء<input inputMode="numeric" autoComplete="cc-exp" value={expiry} onChange={(event) => { const digits = event.target.value.replace(/\D/g, "").slice(0, 4); setExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits); }} placeholder="MM/YY" className={inputClass} /></label>
              <label className="text-xs font-bold">رمز الأمان CVV<input inputMode="numeric" autoComplete="cc-csc" type="password" maxLength={3} value={cvv} onChange={(event) => setCvv(event.target.value.replace(/\D/g, "").slice(0, 3))} className={inputClass} /></label>
              <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17734e] px-4 text-xs font-bold text-white sm:col-span-2"><ShieldCheck size={16} /> بدء تحقق 3D Secure التجريبي</button>
              <p className="text-[10px] leading-5 text-[#68766d] sm:col-span-2">محاكاة تطوير فقط، لا يوجد خصم أو اتصال ببنك. رقم البطاقة وCVV يبقيان في ذاكرة الصفحة ويُمحَيان بعد التأكيد؛ لا يُرسلان إلى الخادم ولا يُحفظان.</p>
            </form> : <p className="rounded-xl bg-amber-50 p-4 text-xs leading-6 text-amber-900">إدخال البطاقة معطل في الإنتاج لعدم وجود مزود دفع حقيقي. استخدم التحويل المباشر، أو اختبر محاكاة البطاقة في Local Demo.</p>}
          </div>}

          {tab === "transfer" && <form onSubmit={submitTransfer} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {currency === "DZD" ? <>
                <div className="rounded-xl border border-[#e0e7e1] bg-white p-3"><p className="text-[10px] font-bold text-[#829087]">BaridiMob RIP</p><div className="mt-2 flex items-center justify-between gap-2"><b dir="ltr" className="text-sm">{settings.baridimob_rip || "غير مضبوط من الإدارة"}</b><button type="button" onClick={() => void copy(settings.baridimob_rip)} className="rounded-lg border p-2" aria-label="نسخ RIP"><Copy size={14} /></button></div></div>
                <div className="rounded-xl border border-[#e0e7e1] bg-white p-3"><p className="text-[10px] font-bold text-[#829087]">رقم حساب CCP</p><div className="mt-2 flex items-center justify-between gap-2"><b dir="ltr" className="text-sm">{settings.ccp_account_number || "غير مضبوط من الإدارة"}</b><button type="button" onClick={() => void copy(settings.ccp_account_number)} className="rounded-lg border p-2" aria-label="نسخ CCP"><Copy size={14} /></button></div></div>
              </> : <>
                <div className="rounded-xl border border-[#e0e7e1] bg-white p-3"><p className="text-[10px] font-bold text-[#829087]">Bybit UID</p><div className="mt-2 flex items-center justify-between gap-2"><b dir="ltr" className="text-sm">{settings.bybit_uid || "غير مضبوط من الإدارة"}</b><button type="button" onClick={() => void copy(settings.bybit_uid)} className="rounded-lg border p-2" aria-label="نسخ Bybit UID"><Copy size={14} /></button></div></div>
                <div className="rounded-xl border border-[#e0e7e1] bg-white p-3"><p className="text-[10px] font-bold text-[#829087]">USDT Wallet (BEP20/TRC20)</p><div className="mt-2 flex items-center justify-between gap-2"><b dir="ltr" className="break-all text-xs">{settings.usdt_wallet_address || "غير مضبوط من الإدارة"}</b><button type="button" onClick={() => void copy(settings.usdt_wallet_address)} className="rounded-lg border p-2" aria-label="نسخ المحفظة"><Copy size={14} /></button></div>{settings.bybit_pay_qr_url && <><a href={settings.bybit_pay_qr_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-bold text-[#176744] underline">عرض QR بايبيت</a><img src={settings.bybit_pay_qr_url} alt="رمز Bybit Pay QR" className="mt-3 max-h-40 rounded-lg border object-contain" /></>}</div>
              </>}
            </div>
            {currency === "DZD" && <div className="flex gap-2"><button type="button" onClick={() => setMethod("baridimob")} className={`min-h-9 rounded-lg px-3 text-xs font-bold ${method === "baridimob" ? "bg-[#17734e] text-white" : "border bg-white"}`}>BaridiMob</button><button type="button" onClick={() => setMethod("ccp")} className={`min-h-9 rounded-lg px-3 text-xs font-bold ${method === "ccp" ? "bg-[#17734e] text-white" : "border bg-white"}`}>CCP</button></div>}
            {isProStore && <><input type="hidden" name="storeName" value={localStoreName} /><input type="hidden" name="storeSlug" value={localStoreSlug} /><input type="hidden" name="storeBio" value={localStoreBio} /><input type="hidden" name="storeWilaya" value={localStoreWilaya} /></>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">رقم العملية / Bybit Transaction ID<input name="paymentReference" required minLength={4} maxLength={100} className={inputClass} dir="ltr" /></label>
              <label className="text-xs font-bold">اسم المرسل أو آخر أرقام RIP / UID<input name="senderInfo" required minLength={2} maxLength={120} className={inputClass} /></label>
              {currency === "DZD" && <label className="text-xs font-bold sm:col-span-2">صورة وصل الدفع<input name="receipt" type="file" accept="image/png,image/jpeg,image/webp" required className={`${inputClass} py-2`} onChange={(event) => onReceiptChange(event.target.files?.[0])} />{receiptPreview && <img src={receiptPreview} alt="معاينة وصل الدفع" className="mt-2 max-h-40 rounded-xl border object-contain" />}</label>}
              {currency === "USD" && <label className="text-xs font-bold sm:col-span-2">لقطة التحويل (اختيارية)<input name="receipt" type="file" accept="image/png,image/jpeg,image/webp" className={`${inputClass} py-2`} onChange={(event) => onReceiptChange(event.target.files?.[0])} />{receiptPreview && <img src={receiptPreview} alt="معاينة التحويل" className="mt-2 max-h-40 rounded-xl border object-contain" />}</label>}
            </div>
            <button disabled={busy || !selectedPlan} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17734e] px-5 text-xs font-bold text-white disabled:opacity-50">{busy ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />} إرسال إثبات الدفع للمراجعة</button>
          </form>}
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-800">{error}</p>}
          {feedback && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">{feedback}</p>}
        </div>
      </section>
    </div>
  );
}
