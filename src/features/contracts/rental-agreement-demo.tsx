"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useSiteLanguage } from "@/components/site-preferences";
import { RentalAgreementPrintActions } from "@/features/contracts/rental-agreement";
import { RentalAgreementPrintable } from "@/features/contracts/rental-agreement-printable";
import type { RentalAgreementData } from "@/features/contracts/rental-agreement-types";

const sampleAgreement: RentalAgreementData = {
  contractId: "EKR-DEMO-20261014-001",
  generatedAt: "2026-10-14T18:00:00.000Z",
  status: "approved",
  owner: {
    fullName: "ياسمين بن صالح",
    phoneNumber: "+213 555 010 101",
  },
  renter: {
    fullName: "مراد قادري",
    phoneNumber: "+213 555 010 202",
  },
  item: {
    title: "كاميرا Sony Alpha مع عدسة 50mm",
    condition: "حالة ممتازة، تم اختبارها قبل التسليم.",
    accessories: ["بطارية إضافية", "شاحن", "حقيبة"],
  },
  caution: {
    amountDzd: 20000,
    type: "cash",
    reimbursementTerms: "يُعاد مبلغ الضمان عند الإرجاع بعد فحص الغرض، مع توثيق أي خصم متفق عليه بين الطرفين.",
  },
  rental: {
    pickupAt: "2026-11-02T09:00:00+01:00",
    returnAt: "2026-11-04T18:00:00+01:00",
    totalCostDzd: 7000,
    damageTerms: "يتحمل المستأجر مسؤولية الضرر الذي يتجاوز الاستهلاك العادي، ويُبلغ المالك فوراً عن أي تلف.",
    lateReturnTerms: "يجب إعادة الغرض في الموعد المتفق عليه. يتطلب أي تمديد أو تكلفة إضافية موافقة الطرفين.",
  },
};

export function RentalAgreementDemo() {
  const locale = useSiteLanguage();
  const text = {
    ar: {
      back: "العودة إلى اكريلي", title: "معاينة عقد الإيجار",
      subtitle: "نموذج اختياري للطباعة أو الحفظ كملف PDF، ثم مراجعته وتوقيعه مباشرة بين الطرفين.",
      demo: "هذه بيانات توضيحية. اكريلي منصة إعلانات مبوبة فقط، ولا تنشئ هذا الاتفاق أو تتحقق من أطرافه أو تتوسط في تنفيذه.",
      confirmed: "نموذج استرشادي اختياري — لا يمثل حجزاً أو معاملة عبر المنصة",
      legal: "هذا العقد نموذج استرشادي اختياري ولا تتحمل منصة اكريلي أي مسؤولية قانونية عنه. يراجع الطرفان جميع الشروط قبل التوقيع.",
    },
    en: {
      back: "Back to Ekrrili", title: "Rental Agreement Preview",
      subtitle: "An optional template to print or save as PDF, then review and sign directly between the parties.",
      demo: "Sample data. Ekrrili is a classified ads platform only and does not create this agreement, verify its parties, or mediate its execution.",
      confirmed: "Optional reference template — not a booking or platform transaction",
      legal: "This is an optional reference template. Ekrrili accepts no legal responsibility for it. The parties should review all terms before signing.",
    },
    fr: {
      back: "Retour à Ekrrili", title: "Aperçu du contrat de location",
      subtitle: "Modèle facultatif à imprimer ou enregistrer en PDF, puis à vérifier et signer directement entre les parties.",
      demo: "Exemple illustratif. Ekrrili est uniquement une plateforme de petites annonces et ne crée ni ne facilite cet accord.",
      confirmed: "Modèle indicatif facultatif — aucune réservation ni transaction sur la plateforme",
      legal: "Ce document est un modèle facultatif. Ekrrili décline toute responsabilité juridique à son égard. Les parties doivent vérifier les conditions avant signature.",
    },
  }[locale];

  return (
    <main dir={locale === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#f7f8f6] px-4 py-8 text-[#17231d] sm:px-6">
      <div className="agreement-screen-only mx-auto mb-5 flex max-w-[210mm] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#176744]">
            <ArrowRight size={17} />
            {text.back}
          </Link>
          <h1 className="mt-4 text-2xl font-extrabold">{text.title}</h1>
          <p className="mt-1 text-sm leading-6 text-[#69776e]">{text.subtitle}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="rounded-lg border border-[#dfe6e0] bg-white px-3 py-2 text-xs font-semibold text-[#52645a]">
            {locale.toUpperCase()}
          </span>
          <RentalAgreementPrintActions agreement={sampleAgreement} locale={locale} />
        </div>
      </div>

      <div className="agreement-screen-only mx-auto mb-3 flex max-w-[210mm] items-center gap-2 text-xs font-bold text-[#176744]">
        <ShieldCheck size={15} />
        {text.confirmed}
      </div>
      <RentalAgreementPrintable agreement={sampleAgreement} locale={locale} />
      <p role="note" className="agreement-screen-only mx-auto mt-4 max-w-[210mm] rounded-xl border border-[#e9ddba] bg-[#fff9e9] p-4 text-xs leading-6 text-[#705d2c]">
        {text.demo}
      </p>
      <p className="agreement-screen-only mx-auto mt-3 max-w-[210mm] text-xs leading-6 text-[#818d84]">{text.legal}</p>
    </main>
  );
}
