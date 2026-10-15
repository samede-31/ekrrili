"use client";

import { useState } from "react";
import { submitDisputeReport } from "@/features/disputes/dispute-actions";
import { addLocalDisputeReport } from "@/features/listings/local-marketplace";

const reasonNames = {
  damage: "إتلاف الغرض",
  late_return: "تأخير الإرجاع",
  no_show: "عدم الحضور",
  fraud: "احتيال",
  other: "أخرى",
} as const;

export function ReportDisputeModal({
  listingId,
  requestId,
  targetUserId,
  demoMode,
  reportType = "dispute",
}: {
  listingId?: string;
  requestId?: string;
  targetUserId?: string;
  demoMode: boolean;
  reportType?: "ad" | "dispute";
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<keyof typeof reasonNames>("other");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (details.trim().length < 10) {
      setMessage("اكتب تفاصيل لا تقل عن 10 أحرف.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (demoMode) {
        addLocalDisputeReport({ listingId, requestId, targetUserId, reason, details: reportType === "ad" ? `بلاغ عن الإعلان: ${details}` : details });
        setMessage("تم حفظ البلاغ محلياً لإظهاره في لوحة الإدارة التجريبية.");
      } else {
        const result = await submitDisputeReport({ listingId, requestId, targetUserId, reason, details: reportType === "ad" ? `بلاغ عن الإعلان: ${details}` : details });
        if (result.loginRequired) {
          window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        if (result.error) {
          setMessage(result.error);
          return;
        }
        setMessage(result.success ?? "تم إرسال البلاغ.");
      }
      setDetails("");
      setOpen(false);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "تعذر إرسال البلاغ.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-bold text-red-700 hover:underline">
        {reportType === "ad" ? "إبلاغ عن هذا الإعلان" : "طلب مساعدة / نزاع"}
      </button>
      {message && <p role="status" className="mt-2 text-xs text-[#176744]">{message}</p>}
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" onClick={() => setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="report-heading" dir="rtl" className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h2 id="report-heading" className="text-lg font-extrabold">{reportType === "ad" ? "إبلاغ عن هذا الإعلان" : "طلب مساعدة / نزاع"}</h2>
            <label className="mt-4 block text-sm font-semibold">نوع البلاغ
              <select value={reason} onChange={(event) => setReason(event.target.value as keyof typeof reasonNames)} className="mt-1 h-11 w-full rounded-xl border border-[#dce5dd] bg-white px-3">
                {Object.entries(reasonNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-sm font-semibold">التفاصيل
              <textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={5} maxLength={3000} className="mt-1 w-full rounded-xl border border-[#dce5dd] p-3" placeholder={reportType === "ad" ? "اذكر ما يخالف قواعد الإعلانات أو المعلومات المضللة." : "اشرح ما حدث، مع ذكر التواريخ أو التفاصيل المهمة."} />
            </label>
            {message && <p role="alert" className="mt-2 text-xs text-red-700">{message}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border px-4 py-2 text-sm">إلغاء</button>
              <button type="button" disabled={busy} onClick={() => void submit()} className="rounded-xl bg-[#176744] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "جارٍ الإرسال…" : "إرسال البلاغ"}</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
