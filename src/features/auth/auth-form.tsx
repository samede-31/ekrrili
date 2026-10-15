"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/field";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register";
type Channel = "email" | "phone";

const authSchema = z.object({
  fullName: z.string(),
  identifier: z.string().trim().min(1, "identifier"),
  password: z.string(),
});

type AuthValues = z.infer<typeof authSchema>;

export function AuthForm({ mode: initialMode }: { mode: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [channel, setChannel] = useState<Channel>("email");
  const [locale, setLocale] = useState<"ar" | "fr">("ar");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const rtl = locale === "ar";
  const form = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { fullName: "", identifier: "", password: "" },
  });
  const text = rtl
    ? {
        brand: "اكريلي · EKRILLI",
        titleLogin: "مرحباً بعودتك",
        titleRegister: "أنشئ حسابك في اكريلي",
        subtitle: "سجّل بأمان واكتشف الكراء بين الأفراد في الجزائر.",
        login: "تسجيل الدخول",
        register: "إنشاء حساب",
        email: "البريد الإلكتروني",
        phone: "رقم الهاتف",
        fullName: "الاسم الكامل",
        password: "كلمة المرور",
        passwordHint: "8 أحرف على الأقل",
        sendCode: "إرسال رمز التحقق",
        verify: "تأكيد الرمز",
        code: "رمز التحقق",
        submitLogin: "دخول",
        submitRegister: "إنشاء الحساب",
        switchLogin: "لديك حساب؟ سجّل الدخول",
        switchRegister: "ليس لديك حساب؟ أنشئ حساباً",
        safe: "بياناتك محمية بسياسات Supabase وتشفير الاتصال.",
        emailSent: "تحقق من بريدك الإلكتروني لتأكيد الحساب، ثم سجّل الدخول.",
        otpSent: "أرسلنا رمزاً إلى رقمك. أدخله لإكمال العملية.",
        invalidIdentifier: "أدخل بريداً إلكترونياً أو رقم هاتف صالحاً.",
        invalidPassword: "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.",
        back: "العودة إلى السوق",
        passwordRequired: "كلمة المرور مطلوبة.",
        identifier: "البريد الإلكتروني أو الهاتف",
      }
    : {
        brand: "EKRRILI · اكريلي",
        titleLogin: "Ravi de vous revoir",
        titleRegister: "Créer votre compte Ekrrili",
        subtitle: "Connectez-vous pour louer entre particuliers en Algérie.",
        login: "Connexion",
        register: "Créer un compte",
        email: "E-mail",
        phone: "Téléphone",
        fullName: "Nom complet",
        password: "Mot de passe",
        passwordHint: "8 caractères minimum",
        sendCode: "Envoyer le code",
        verify: "Vérifier le code",
        code: "Code de vérification",
        submitLogin: "Se connecter",
        submitRegister: "Créer le compte",
        switchLogin: "Déjà inscrit ? Connectez-vous",
        switchRegister: "Pas de compte ? Inscrivez-vous",
        safe: "Vos données sont protégées par Supabase et une connexion chiffrée.",
        emailSent: "Vérifiez votre e-mail pour confirmer votre compte, puis connectez-vous.",
        otpSent: "Un code a été envoyé. Saisissez-le pour continuer.",
        invalidIdentifier: "Saisissez une adresse e-mail ou un numéro valide.",
        invalidPassword: "Le mot de passe doit contenir au moins 8 caractères.",
        back: "Retour au marché",
        passwordRequired: "Le mot de passe est obligatoire.",
        identifier: "E-mail ou téléphone",
      };

  const identifierLabel = channel === "email" ? text.email : text.phone;

  const onSubmit = form.handleSubmit(async (values) => {
    setError("");
    setNotice("");
    setBusy(true);

    try {
      const supabase = createSupabaseBrowserClient();
      if (channel === "phone") {
        if (mode === "register" && values.fullName.trim().length < 2) {
          setError(rtl ? "أدخل اسمك الكامل." : "Saisissez votre nom complet.");
          return;
        }
        if (!/^\+[1-9]\d{7,14}$/.test(values.identifier)) {
          setError(rtl ? "أدخل الهاتف بالصيغة الدولية، مثلاً ‎+213555123456." : "Utilisez le format international, par ex. +213555123456.");
          return;
        }
        const { error: authError } = await supabase.auth.signInWithOtp({
          phone: values.identifier,
          options: {
            shouldCreateUser: mode === "register",
            ...(mode === "register" ? { data: { full_name: values.fullName.trim() } } : {}),
          },
        });
        if (authError) throw authError;
        setOtpSent(true);
        setNotice(text.otpSent);
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.identifier)) {
        setError(text.invalidIdentifier);
        return;
      }

      if (mode === "register") {
        if (values.password.length < 8) {
          setError(text.invalidPassword);
          return;
        }
        if (!values.fullName.trim()) {
          setError(rtl ? "أدخل اسمك الكامل." : "Saisissez votre nom complet.");
          return;
        }
        const { data, error: authError } = await supabase.auth.signUp({
          email: values.identifier,
          password: values.password,
          options: {
            data: { full_name: values.fullName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          },
        });
        if (authError) throw authError;
        if (data.session) {
          router.replace("/dashboard");
          router.refresh();
        } else {
          setNotice(text.emailSent);
        }
        return;
      }

      if (!values.password) {
        setError(text.passwordRequired);
        return;
      }
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: values.identifier,
        password: values.password,
      });
      if (authError) throw authError;
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (rtl ? "تعذر إكمال العملية." : "Impossible de terminer l'opération."));
    } finally {
      setBusy(false);
    }
  });

  const verifyOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    const values = form.getValues();
    const formData = new FormData(event.currentTarget);
    const token = String(formData.get("otp") ?? "").trim();
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.verifyOtp({
        phone: values.identifier,
        token,
        type: "sms",
      });
      if (authError) throw authError;
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (rtl ? "تعذر تأكيد الرمز." : "Impossible de vérifier le code."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main dir={rtl ? "rtl" : "ltr"} lang={locale} className="flex min-h-screen items-center justify-center bg-[#f7f8f6] px-4 py-10">
      <section className="w-full max-w-md rounded-[2rem] border border-[#e4eae5] bg-white p-6 shadow-[0_20px_70px_rgba(24,49,32,0.08)] sm:p-9">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm font-extrabold tracking-wide text-[#176744]">{text.brand}</Link>
          <button type="button" onClick={() => setLocale(rtl ? "fr" : "ar")} className="rounded-lg px-3 py-2 text-xs font-bold text-[#617067] hover:bg-[#f2f6f3]">
            {rtl ? "Français" : "العربية"}
          </button>
        </div>
        <Link href="/" className="mt-7 inline-flex items-center gap-1 text-xs font-semibold text-[#748078] hover:text-[#176744]">
          <ArrowRight size={14} /> {text.back}
        </Link>
        <h1 className="mt-5 text-2xl font-extrabold text-[#17231d]">{mode === "login" ? text.titleLogin : text.titleRegister}</h1>
        <p className="mt-2 text-sm leading-6 text-[#748078]">{text.subtitle}</p>

        <div className="mt-6 grid grid-cols-2 rounded-xl bg-[#f2f5f2] p-1">
          {(["email", "phone"] as const).map((item) => (
            <button key={item} type="button" onClick={() => { setChannel(item); setOtpSent(false); setError(""); setNotice(""); }} className={cn("rounded-lg px-3 py-2.5 text-sm font-bold transition", channel === item ? "bg-white text-[#176744] shadow-sm" : "text-[#77837b]")}>
              {item === "email" ? text.email : text.phone}
            </button>
          ))}
        </div>

        {!otpSent ? (
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            {mode === "register" && (
              <div>
                <FieldLabel htmlFor="fullName" required>{text.fullName}</FieldLabel>
                <Input id="fullName" autoComplete="name" {...form.register("fullName")} />
              </div>
            )}
            <div>
              <FieldLabel htmlFor="identifier" required>{identifierLabel}</FieldLabel>
              <Input
                id="identifier"
                dir={channel === "phone" ? "ltr" : undefined}
                type={channel === "email" ? "email" : "tel"}
                autoComplete={channel === "email" ? "email" : "tel"}
                placeholder={channel === "phone" ? "+213 555 123 456" : undefined}
                {...form.register("identifier")}
              />
              {form.formState.errors.identifier && <p className="mt-1 text-xs text-red-700">{text.invalidIdentifier}</p>}
            </div>
            {channel === "email" && (
              <div>
                <FieldLabel htmlFor="password" required>{text.password}</FieldLabel>
                <Input id="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder={mode === "register" ? text.passwordHint : undefined} {...form.register("password")} />
              </div>
            )}
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-800">{error}</p>}
            {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">{notice}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <LoaderCircle size={16} className="animate-spin" />}
              {channel === "phone" ? text.sendCode : mode === "login" ? text.submitLogin : text.submitRegister}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="mt-5 space-y-4">
            <div>
              <FieldLabel htmlFor="otp" required>{text.code}</FieldLabel>
              <Input id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code" dir="ltr" required minLength={4} maxLength={10} />
            </div>
            {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">{notice}</p>}
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-800">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <LoaderCircle size={16} className="animate-spin" />}{text.verify}
            </Button>
            <button type="button" onClick={() => { setOtpSent(false); setNotice(""); }} className="w-full py-2 text-sm font-semibold text-[#65736b]">
              {rtl ? "تغيير رقم الهاتف" : "Modifier le numéro"}
            </button>
          </form>
        )}

        {!otpSent && (
          <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setNotice(""); setError(""); }} className="mt-5 w-full text-sm font-bold text-[#176744]">
            {mode === "login" ? text.switchRegister : text.switchLogin}
          </button>
        )}
        <div className="mt-6 flex items-center gap-2 border-t border-[#edf0ed] pt-5 text-xs leading-5 text-[#859188]">
          <ShieldCheck size={17} className="shrink-0 text-[#17734e]" /> {text.safe}
        </div>
      </section>
    </main>
  );
}
