"use client";

import { useEffect, useState } from "react";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { LegalPage, LegalSection } from "@/features/legal/legal-page";
import { getLocalMarketplace } from "@/features/listings/local-marketplace";

export function SupportContent({ initialPhone }: { initialPhone: string }) {
  const [supportPhone, setSupportPhone] = useState(initialPhone);

  useEffect(() => {
    if (initialPhone) return;
    setSupportPhone(getLocalMarketplace().promotionSettings?.support_phone ?? "");
  }, [initialPhone]);

  const phone = supportPhone.replace(/\D/g, "").replace(/^00/, "");
  const message = encodeURIComponent("مرحباً، أحتاج إلى مساعدة بخصوص اكريلي.");
  const whatsappHref = phone.length >= 8 && phone.length <= 15
    ? `https://wa.me/${phone}?text=${message}`
    : `https://wa.me/?text=${message}`;

  return (
    <LegalPage page="support">
      <LegalSection title="كيف أستأجر غرضاً؟">
        <p>تصفح الإعلانات، افتح الإعلان المناسب، ثم اتصل بالمالك هاتفياً أو راسله عبر واتساب للاتفاق مباشرة على المدة والتسليم والشروط.</p>
      </LegalSection>
      <LegalSection title="كيف يعمل مبلغ التأمين (Caution)؟">
        <p>التأمين مبلغ يتفق عليه المالك والمستأجر لتغطية المخاطر المتفق عليها. ناقشا قيمته وطريقة دفعه واسترداده مباشرة قبل التسليم، واستخدما نموذج العقد الاختياري إذا رغبتما. اكريلي لا تحتفظ بالتأمين.</p>
      </LegalSection>
      <LegalSection title="ما رسوم التمييز واشتراك PRO؟">
        <p>هي رسوم اختيارية تُدفع لمالك اكريلي مقابل إبراز إعلان أو واجهة متجر PRO على المنصة. لا تتعلق بالكراء أو الضمان ولا تحول اكريلي أموالاً بين المالك والمستأجر. محاكاة البطاقة المحلية للتجربة فقط ولا تخصم أموالاً؛ الدفع الفعلي بالبطاقة غير متاح دون مزود معتمد.</p>
      </LegalSection>
      <LegalSection title="ماذا أفعل عند حدوث نزاع؟">
        <p>احتفظ بالاتفاق والرسائل والصور ذات الصلة، وحاول التواصل بهدوء مع الطرف الآخر. يمكنك الإبلاغ عن محتوى الإعلان أو إساءة استخدام المنصة من صفحة الإعلان. لا ترسل بيانات البطاقة أو كلمات المرور ضمن البلاغ.</p>
      </LegalSection>
      <LegalSection title="كيف أتحقق من هوية المستخدم؟">
        <p>اعتمد على شارة التحقق الظاهرة في الملف، وراجع تفاصيل الإعلان والاتفاق قبل التسليم. شارة التحقق مؤشر مراجعة للهوية وليست ضماناً لأداء المستخدم أو سلامة المعاملة.</p>
      </LegalSection>
      <LegalSection title="التواصل عبر واتساب">
        <p>استخدم الزر لفتح محادثة واتساب للدعم. تجنب إرسال كلمات المرور أو بيانات البطاقات أو رمز CVV.</p>
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#16865a] px-5 text-sm font-extrabold text-white hover:bg-[#116d48]">
          <MessageCircle size={18} aria-hidden="true" /> تواصل مع الدعم عبر واتساب
        </a>
        {!phone && <p className="mt-2 text-xs text-[#829087]">لإظهار رقم دعم مباشر، يُرجى من الإدارة إضافته في إعدادات الدفع والدعم. يفتح الرابط حالياً واتساب لاختيار جهة التواصل.</p>}
      </LegalSection>
      <p className="flex items-start gap-2 rounded-xl bg-[#f0f7f1] p-3 text-xs leading-6 text-[#52645a]">
        <ShieldCheck size={16} className="mt-1 shrink-0 text-[#176744]" aria-hidden="true" />
        لا ترسل رقم البطاقة أو CVV إلى الدعم. محاكاة البطاقة في الوضع التجريبي لا تخصم أموالاً، ولا تتم مدفوعات الكراء أو الضمان عبر اكريلي.
      </p>
    </LegalPage>
  );
}
