import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/bottom-nav";
import { SitePreferences } from "@/components/site-preferences";
import { SiteFooter } from "@/components/site-footer";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#17734e",
};

export const metadata: Metadata = {
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) } : {}),
  applicationName: "اكريلي - Ekrrili",
  title: {
    default: "اكريلي - Ekrrili",
    template: "%s | اكريلي",
  },
  description: "اكريلي — سوق الكراء بين الأفراد في الجزائر.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "اكريلي",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `var t=localStorage.getItem("ekrrili-theme-v1");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";var l=localStorage.getItem("ekrrili-language-v1");if(l==="ar"||l==="en"||l==="fr"){document.documentElement.lang=l;document.documentElement.dir=l==="ar"?"rtl":"ltr"}` }} />
      </head>
      <body>
        {children}
        <SitePreferences />
        <SiteFooter />
        <BottomNav />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
