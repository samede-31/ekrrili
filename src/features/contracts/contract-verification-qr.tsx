"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function ContractVerificationQr({ requestId }: { requestId: string }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const url = `${window.location.origin}/verify/${encodeURIComponent(requestId)}`;
    setVerificationUrl(url);
    QRCode.toDataURL(url, {
      width: 176,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#163f2d", light: "#ffffff" },
    }).then((url) => {
      if (active) setQrDataUrl(url);
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : "تعذر إنشاء رمز التحقق.");
    });
    return () => { active = false; };
  }, [requestId]);

  return (
    <section className="agreement-verification">
      <div>
        <strong>التحقق من العقد</strong>
        <p>امسح الرمز للتحقق من حالة العقد وبيانات فترة الكراء المسجلة في اكريلي.</p>
        {verificationUrl && <a href={verificationUrl} dir="ltr">{verificationUrl}</a>}
        {error && <small role="alert">{error}</small>}
      </div>
      {qrDataUrl ? <img src={qrDataUrl} width={112} height={112} alt="رمز QR للتحقق من العقد" /> : <span aria-label="جار إنشاء رمز التحقق" className="agreement-qr-placeholder" />}
    </section>
  );
}
