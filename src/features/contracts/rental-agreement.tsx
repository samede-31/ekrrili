"use client";

import { FileDown, LoaderCircle, Printer } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { RentalAgreementData } from "@/features/contracts/rental-agreement-types";

export function RentalAgreementPrintActions({
  agreement,
  locale,
}: {
  agreement: RentalAgreementData;
  locale: "ar" | "en" | "fr";
}) {
  const [printing, setPrinting] = useState(false);
  const isConfirmed = ["approved", "active", "completed"].includes(agreement.status);

  const printAgreement = async () => {
    if (!isConfirmed || printing) return;
    setPrinting(true);
    try {
      await document.fonts.load('8pt "Cairo"');
      await document.fonts.ready;
      window.print();
    } finally {
      setPrinting(false);
    }
  };

  if (!isConfirmed) {
    return (
      <Button type="button" variant="outline" disabled>
        <FileDown size={17} />
        {locale === "ar"
          ? "يتاح العقد بعد تأكيد الحجز"
          : locale === "fr"
            ? "Disponible après confirmation"
            : "Available after booking confirmation"}
      </Button>
    );
  }

  return (
    <Button type="button" className="agreement-screen-only" onClick={() => void printAgreement()} disabled={printing}>
      {printing ? <LoaderCircle size={17} className="animate-spin" /> : <Printer size={17} />}
      {locale === "ar"
        ? "طباعة العقد أو حفظه PDF"
        : locale === "fr"
          ? "Imprimer ou enregistrer en PDF"
          : "Print agreement or save as PDF"}
    </Button>
  );
}
