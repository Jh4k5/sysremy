import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Systemy 5.2 — ابنِ حياتك كنظام",
  description:
    "نظام تشغيل شخصي يجمع المال والملاحظات والعادات والأهداف في تدفق واحد. عربي أولاً، يبني ذكاؤه الاصطناعي أنظمتك ويحللها ويقترح تحسينها.",
  keywords: ["Systemy", "سيستمي", "إدارة حياة", "مصاريف", "عادات", "يوميات", "أهداف", "نظام شخصي"],
  applicationName: "Systemy",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Systemy",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#F8F7F2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${plexArabic.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="top-center" theme="light" richColors closeButton dir="rtl" />
      </body>
    </html>
  );
}
